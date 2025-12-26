
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, RaidType, Affix, PlayerCharacter, Ritual, GuildBuff } from '../types.js';
import { getBackpackCapacity, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { enforceInboxLimit, fetchFullCharacter } from '../logic/helpers.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/guilds/my-guild - Pobieranie danych gildii
router.get('/my-guild', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.json(null);

        const guildId = memberRes.rows[0].guild_id;
        const myRole = memberRes.rows[0].role;

        const guildRes = await pool.query('SELECT * FROM guilds WHERE id = $1', [guildId]);
        const guild = guildRes.rows[0];

        const membersRes = await pool.query(`
            SELECT gm.user_id as "userId", gm.role, gm.joined_at as "joinedAt", 
                   c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race,
                   EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes' ) as "isOnline"
            FROM guild_members gm
            JOIN characters c ON gm.user_id = c.user_id
            WHERE gm.guild_id = $1
            ORDER BY gm.role ASC, level DESC
        `, [guildId]);

        const transactionsRes = await pool.query(`
            SELECT h.*, c.data->>'name' as "characterName"
            FROM guild_bank_history h
            JOIN characters c ON h.user_id = c.user_id
            WHERE h.guild_id = $1
            ORDER BY h.created_at DESC LIMIT 50
        `, [guildId]);

        res.json({
            ...guild,
            createdAt: guild.created_at,
            memberCount: guild.member_count,
            maxMembers: guild.max_members,
            isPublic: guild.is_public,
            rentalTax: guild.rental_tax,
            huntingTax: guild.hunting_tax,
            activeBuffs: guild.active_buffs || [],
            members: membersRes.rows,
            transactions: transactionsRes.rows.map(t => ({ ...t, timestamp: t.created_at })),
            myRole
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych gildii' });
    }
});

// GET /api/guilds/targets - Lista gildii do atakowania/szpiegowania
router.get('/targets', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        const myGuildId = memberRes.rows[0]?.guild_id || -1;

        // Używamy GROUP BY zamiast subquery dla pewności wyników i stabilności typów
        const query = `
            SELECT 
                g.id, 
                g.name, 
                g.tag, 
                g.member_count as "memberCount",
                COALESCE(SUM((c.data->>'level')::int), 0)::int as "totalLevel"
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            LEFT JOIN characters c ON gm.user_id = c.user_id
            WHERE g.id != $1
            GROUP BY g.id, g.name, g.tag, g.member_count
            ORDER BY "totalLevel" DESC, g.name ASC
        `;

        const result = await pool.query(query, [myGuildId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching guild targets:', err);
        res.status(500).json({ message: 'Błąd pobierania listy celów' });
    }
});

// POST /api/guilds/bank - Wpłaty i wypłaty
router.post('/bank', async (req: any, res: any) => {
    const { type, currency, amount } = req.body; // type: 'DEPOSIT' | 'WITHDRAW'
    const val = parseInt(amount);

    if (isNaN(val) || val <= 0) return res.status(400).json({ message: 'Nieprawidłowa kwota.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Sprawdź gildię gracza
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Nie należysz do gildii.');
        const { guild_id: guildId, role } = memberRes.rows[0];

        // 2. Zablokuj wiersze gildii i postaci do edycji
        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        
        const guildResources = guildRes.rows[0].resources;
        const character = charRes.rows[0].data;

        if (type === 'DEPOSIT') {
            const playerAmount = currency === 'gold' ? character.resources.gold : character.resources[currency];
            if ((playerAmount || 0) < val) throw new Error('Nie masz wystarczającej ilości zasobów w plecaku.');

            if (currency === 'gold') character.resources.gold -= val;
            else character.resources[currency] -= val;

            guildResources[currency] = (guildResources[currency] || 0) + val;
        } else if (type === 'WITHDRAW') {
            if (!canManage(role as GuildRole)) throw new Error('Tylko oficerowie mogą wypłacać zasoby ze skarbca.');
            if ((guildResources[currency] || 0) < val) throw new Error('Skarbiec gildii nie posiada takiej ilości zasobów.');

            guildResources[currency] -= val;

            if (currency === 'gold') character.resources.gold = (character.resources.gold || 0) + val;
            else character.resources[currency] = (character.resources[currency] || 0) + val;
        } else {
            throw new Error('Nieprawidłowy typ transakcji.');
        }

        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildResources), guildId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);

        await client.query(
            `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) 
             VALUES ($1, $2, $3, $4, $5)`,
            [guildId, req.user.id, type, currency, val]
        );

        await client.query('COMMIT');
        if (req.io) req.io.to(`guild_${guildId}`).emit('guild_update');

        res.json({ message: 'Transakcja zakończona pomyślnie.', resources: guildResources, characterResources: character.resources });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/altar/sacrifice
router.post('/altar/sacrifice', async (req: any, res: any) => {
    const { ritualId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Nie należysz do gildii.');
        const { guild_id: guildId, role } = memberRes.rows[0];

        if (!canManage(role as GuildRole)) throw new Error('Brak uprawnień.');

        const ritualsRes = await client.query("SELECT data FROM game_data WHERE key = 'rituals'");
        const rituals: Ritual[] = ritualsRes.rows[0]?.data || [];
        const ritual = rituals.find(r => r.id === ritualId);
        if (!ritual) throw new Error('Rytuał nie istnieje.');

        const guildRes = await client.query('SELECT resources, buildings, active_buffs FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];

        const altarLevel = guild.buildings?.altar || 0;
        if (altarLevel < ritual.tier) throw new Error('Zbyt niski poziom ołtarza.');

        const resources = guild.resources;
        for (const cost of ritual.cost) {
            if ((resources[cost.type] || 0) < cost.amount) throw new Error(`Brak zasobów: ${cost.type}`);
        }

        for (const cost of ritual.cost) {
            resources[cost.type] -= cost.amount;
        }

        let activeBuffs: GuildBuff[] = guild.active_buffs || [];
        activeBuffs = activeBuffs.filter(b => b.name !== ritual.name);
        activeBuffs.push({
            id: crypto.randomUUID(),
            name: ritual.name,
            stats: ritual.stats,
            expiresAt: Date.now() + (ritual.durationMinutes * 60 * 1000)
        });

        await client.query('UPDATE guilds SET resources = $1, active_buffs = $2 WHERE id = $3', 
            [JSON.stringify(resources), JSON.stringify(activeBuffs), guildId]);

        await client.query('COMMIT');
        if (req.io) req.io.to(`guild_${guildId}`).emit('guild_update');
        res.json({ message: 'Rytuał odprawiony.', activeBuffs });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;
