
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, RaidType, Affix, PlayerCharacter, Ritual, GuildBuff } from '../types.js';
import { getBackpackCapacity, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { enforceInboxLimit, fetchFullCharacter } from '../logic/helpers.js';

const router = express.Router();

// Middleware: Wszystkie trasy wymagają autoryzacji
router.use(authenticateToken);

// GET /api/guilds/list - Publiczna lista gildii
router.get('/list', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.*, COUNT(gm.user_id) as "memberCount"
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            WHERE g.is_public = TRUE
            GROUP BY g.id
            ORDER BY g.member_count DESC
        `);
        res.json(result.rows.map(row => ({
            ...row,
            createdAt: row.created_at,
            memberCount: parseInt(row.member_count) || 0,
            isPublic: row.is_public
        })));
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania listy gildii' });
    }
});

// GET /api/guilds/profile/:id - Publiczny profil gildii
router.get('/profile/:id', async (req: any, res: any) => {
    try {
        const guildId = req.params.id;
        const result = await pool.query(`
            SELECT 
                g.id, g.name, g.tag, g.description, g.crest_url as "crestUrl",
                g.member_count as "memberCount", g.max_members as "maxMembers",
                g.created_at as "createdAt", g.is_public as "isPublic", g.min_level as "minLevel",
                c.data->>'name' as "leaderName",
                COALESCE(SUM((mc.data->>'level')::int), 0) as "totalLevel"
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            LEFT JOIN characters mc ON gm.user_id = mc.user_id
            WHERE g.id = $1
            GROUP BY g.id, c.data->>'name'
        `, [guildId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Gildia nie została znaleziona.' });
        }

        const row = result.rows[0];
        res.json({
            ...row,
            totalLevel: parseInt(row.totalLevel) || 0,
            memberCount: parseInt(row.member_count) || 0
        });
    } catch (err) {
        console.error('Error fetching public guild profile:', err);
        res.status(500).json({ message: 'Błąd serwera' });
    }
});

// GET /api/guilds/my-guild - Dane gildii gracza
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

        // Mapowanie pól snake_case -> camelCase dla frontendu
        res.json({
            ...guild,
            createdAt: guild.created_at,
            memberCount: guild.member_count,
            maxMembers: guild.max_members,
            isPublic: guild.is_public,
            rentalTax: guild.rental_tax,
            huntingTax: guild.hunting_tax,
            activeBuffs: guild.active_buffs || [], // Kluczowe mapowanie dla Ołtarza
            members: membersRes.rows,
            transactions: transactionsRes.rows.map(t => ({ ...t, timestamp: t.created_at })),
            myRole
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych gildii' });
    }
});

// POST /api/guilds/altar/sacrifice - Wykonanie rytuału
router.post('/altar/sacrifice', async (req: any, res: any) => {
    const { ritualId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Sprawdź gildię i uprawnienia
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Nie należysz do gildii.');
        const { guild_id: guildId, role } = memberRes.rows[0];

        if (!canManage(role as GuildRole)) throw new Error('Nie masz uprawnień oficerckich do odprawiania rytuałów.');

        // 2. Pobierz dane rytuału i gildii
        const ritualsRes = await client.query("SELECT data FROM game_data WHERE key = 'rituals'");
        const rituals: Ritual[] = ritualsRes.rows[0]?.data || [];
        const ritual = rituals.find(r => r.id === ritualId);

        if (!ritual) throw new Error('Rytuał nie istnieje w księgach wiedzy.');

        const guildRes = await client.query('SELECT resources, buildings, active_buffs FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];

        // 3. Sprawdź poziom ołtarza
        const altarLevel = guild.buildings?.altar || 0;
        if (altarLevel < ritual.tier) throw new Error(`Twój ołtarz ma zbyt niski poziom (Wymagany: ${ritual.tier}).`);

        // 4. Sprawdź koszty w skarbcu
        const resources = guild.resources;
        for (const cost of ritual.cost) {
            const currentAmount = resources[cost.type] || 0;
            if (currentAmount < cost.amount) {
                throw new Error(`Brak zasobów w skarbcu gildii: ${cost.type} (Wymagane: ${cost.amount}, Masz: ${currentAmount})`);
            }
        }

        // 5. Pobierz koszty
        for (const cost of ritual.cost) {
            resources[cost.type] -= cost.amount;
        }

        // 6. Zarządzaj buffami (usuń stary o tej samej nazwie jeśli istnieje)
        let activeBuffs: GuildBuff[] = guild.active_buffs || [];
        activeBuffs = activeBuffs.filter(b => b.name !== ritual.name);

        const newBuff: GuildBuff = {
            id: crypto.randomUUID(),
            name: ritual.name,
            stats: ritual.stats,
            expiresAt: Date.now() + (ritual.durationMinutes * 60 * 1000)
        };

        activeBuffs.push(newBuff);

        // 7. Zapisz zmiany
        await client.query('UPDATE guilds SET resources = $1, active_buffs = $2 WHERE id = $3', 
            [JSON.stringify(resources), JSON.stringify(activeBuffs), guildId]);

        // 8. Log transakcji
        const goldCost = ritual.cost.find(c => c.type === 'gold')?.amount || 0;
        if (goldCost > 0) {
            await client.query(
                `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) 
                 VALUES ($1, $2, 'WITHDRAW', 'gold', $3)`,
                [guildId, req.user.id, goldCost]
            );
        }

        await client.query('COMMIT');
        
        // Powiadomienie socketowe (jeśli req.io jest dostępne)
        if (req.io) {
            req.io.to(`guild_${guildId}`).emit('guild_update');
        }

        res.json({ message: 'Rytuał odprawiony pomyślnie! Błogosławieństwo spłynęło na gildię.', activeBuffs });

    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// GET /api/guilds/armory
router.get('/armory', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Brak gildii' });
        const guildId = memberRes.rows[0].guild_id;

        const armoryItems = await pool.query(`
            SELECT a.id, a.item_data as item, a.owner_id as "ownerId", a.created_at as "depositedAt",
                   c.data->>'name' as "ownerName"
            FROM guild_armory_items a
            JOIN characters c ON a.owner_id = c.user_id
            WHERE a.guild_id = $1
            ORDER BY a.created_at DESC
        `, [guildId]);

        const borrowedItems = await pool.query(`
            SELECT c.user_id as "userId", c.data->>'name' as "borrowedBy", 
                   item as item, (item->>'uniqueId') as "itemKey",
                   (item->>'originalOwnerId')::int as "ownerId",
                   item->>'originalOwnerName' as "ownerName",
                   (item->>'borrowedAt')::bigint as "depositedAt"
            FROM characters c, jsonb_array_elements(c.data->'inventory') AS item
            WHERE (item->>'isBorrowed')::boolean = TRUE 
            AND (item->>'borrowedFromGuildId')::int = $1
        `, [guildId]);

        res.json({
            armoryItems: armoryItems.rows.map(row => ({
                ...row,
                depositedAt: row.depositedAt
            })),
            borrowedItems: borrowedItems.rows.map(row => ({
                id: row.itemKey,
                item: row.item,
                ownerId: row.ownerId,
                ownerName: row.ownerName,
                depositedAt: row.depositedAt,
                borrowedBy: row.borrowedBy,
                userId: row.userId
            }))
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd zbrojowni' });
    }
});

export default router;
