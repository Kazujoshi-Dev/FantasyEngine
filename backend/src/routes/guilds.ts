
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, RaidType, Affix, PlayerCharacter, Ritual, GuildBuff, RaidStatus } from '../types.js';
import { getBackpackCapacity, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { enforceInboxLimit, fetchFullCharacter } from '../logic/helpers.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/guilds/list - Pobieranie listy publicznych gildii
router.get('/list', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT id, name, tag, member_count as "memberCount", max_members as "maxMembers", 
                   is_public as "isPublic", min_level as "minLevel"
            FROM guilds
            ORDER BY member_count DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania listy gildii' });
    }
});

// GET /api/guilds/my-guild - Pobieranie danych gildii gracza
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

        // Używamy LEFT JOIN i rzutujemy wyniki na INTEGER, aby uniknąć problemów z typami w JS
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

// --- RAJDY ---

router.get('/raids', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Nie należysz do gildii.' });
        const guildId = memberRes.rows[0].guild_id;

        const raids = await getActiveRaids(guildId);
        res.json(raids);
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania rajdów' });
    }
});

router.post('/raids/create', async (req: any, res: any) => {
    const { targetGuildId, raidType } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Nie należysz do gildii.' });
        const { guild_id: myGuildId, role } = memberRes.rows[0];

        if (!canManage(role as GuildRole)) return res.status(403).json({ message: 'Brak uprawnień.' });

        const raid = await createRaid(myGuildId, req.user.id, targetGuildId, raidType);
        res.json(raid);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/raids/join', async (req: any, res: any) => {
    const { raidId } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Nie należysz do gildii.' });
        const guildId = memberRes.rows[0].guild_id;

        await joinRaid(raidId, req.user.id, guildId);
        res.json({ message: 'Dołączono.' });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// --- SZPIEGOSTWO ---

router.get('/espionage', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Nie należysz do gildii.' });
        const guildId = memberRes.rows[0].guild_id;

        const activeSpies = await pool.query(`
            SELECT e.*, g.name as "targetGuildName"
            FROM guild_espionage e
            JOIN guilds g ON e.defender_guild_id = g.id
            WHERE e.attacker_guild_id = $1 AND e.status = 'IN_PROGRESS'
            ORDER BY e.end_time ASC
        `, [guildId]);

        const history = await pool.query(`
            SELECT e.*, g.name as "targetGuildName"
            FROM guild_espionage e
            JOIN guilds g ON e.defender_guild_id = g.id
            WHERE e.attacker_guild_id = $1 AND e.status = 'COMPLETED'
            ORDER BY e.end_time DESC LIMIT 20
        `, [guildId]);

        res.json({
            activeSpies: activeSpies.rows.map(row => ({ ...row, startTime: row.start_time, endTime: row.end_time })),
            history: history.rows.map(row => ({ ...row, startTime: row.start_time, endTime: row.end_time, resultSnapshot: row.result_snapshot }))
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych szpiegowskich' });
    }
});

router.post('/espionage/start', async (req: any, res: any) => {
    const { targetGuildId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Nie należysz do gildii.');
        const { guild_id: myGuildId, role } = memberRes.rows[0];

        if (!canManage(role as GuildRole)) throw new Error('Brak uprawnień.');

        const guildRes = await client.query('SELECT resources, buildings FROM guilds WHERE id = $1 FOR UPDATE', [myGuildId]);
        const myGuild = guildRes.rows[0];
        const spyLevel = myGuild.buildings?.spyHideout || 0;
        
        if (spyLevel <= 0) throw new Error('Brak Kryjówki Szpiegów.');

        const activeCount = await client.query("SELECT COUNT(*) FROM guild_espionage WHERE attacker_guild_id = $1 AND status = 'IN_PROGRESS'", [myGuildId]);
        if (parseInt(activeCount.rows[0].count) >= spyLevel) throw new Error('Brak wolnych szpiegów.');

        const targetRes = await client.query(`
            SELECT COALESCE(SUM((c.data->>'level')::int), 0)::int as "totalLevel"
            FROM guild_members gm
            JOIN characters c ON gm.user_id = c.user_id
            WHERE gm.guild_id = $1
        `, [targetGuildId]);
        
        const targetTotalLevel = targetRes.rows[0]?.totalLevel || 0;
        const cost = 1000 + (targetTotalLevel * 50);

        if (myGuild.resources.gold < cost) throw new Error('Za mało złota w skarbcu.');

        let durationMin = 15;
        if (spyLevel === 2) durationMin = 10;
        if (spyLevel >= 3) durationMin = 5;

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + durationMin * 60000);

        myGuild.resources.gold -= cost;
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(myGuild.resources), myGuildId]);

        await client.query(`
            INSERT INTO guild_espionage (attacker_guild_id, defender_guild_id, status, start_time, end_time, cost)
            VALUES ($1, $2, 'IN_PROGRESS', $3, $4, $5)
        `, [myGuildId, targetGuildId, startTime, endTime, cost]);

        await client.query('COMMIT');
        res.json({ message: 'Szpieg wysłany!' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/bank
router.post('/bank', async (req: any, res: any) => {
    const { type, currency, amount } = req.body; 
    const val = parseInt(amount);

    if (isNaN(val) || val <= 0) return res.status(400).json({ message: 'Nieprawidłowa kwota.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Nie należysz do gildii.');
        const { guild_id: guildId, role } = memberRes.rows[0];

        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        
        const guildResources = guildRes.rows[0].resources;
        const character = charRes.rows[0].data;

        if (type === 'DEPOSIT') {
            const playerAmount = currency === 'gold' ? character.resources.gold : character.resources[currency];
            if ((playerAmount || 0) < val) throw new Error('Brak zasobów.');
            if (currency === 'gold') character.resources.gold -= val;
            else character.resources[currency] -= val;
            guildResources[currency] = (guildResources[currency] || 0) + val;
        } else if (type === 'WITHDRAW') {
            if (!canManage(role as GuildRole)) throw new Error('Brak uprawnień.');
            if ((guildResources[currency] || 0) < val) throw new Error('Brak zasobów w skarbcu.');
            guildResources[currency] -= val;
            if (currency === 'gold') character.resources.gold = (character.resources.gold || 0) + val;
            else character.resources[currency] = (character.resources[currency] || 0) + val;
        }

        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildResources), guildId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, $3, $4, $5)`, [guildId, req.user.id, type, currency, val]);

        await client.query('COMMIT');
        if (req.io) req.io.to(`guild_${guildId}`).emit('guild_update');
        res.json({ message: 'Sukces', resources: guildResources, characterResources: character.resources });
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
        if (memberRes.rows.length === 0) throw new Error('Brak gildii.');
        const { guild_id: guildId, role } = memberRes.rows[0];

        if (!canManage(role as GuildRole)) throw new Error('Brak uprawnień.');

        const ritualsRes = await client.query("SELECT data FROM game_data WHERE key = 'rituals'");
        const rituals: Ritual[] = ritualsRes.rows[0]?.data || [];
        const ritual = rituals.find(r => r.id === ritualId);
        if (!ritual) throw new Error('Brak rytuału.');

        const guildRes = await client.query('SELECT resources, buildings, active_buffs FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];

        const altarLevel = guild.buildings?.altar || 0;
        if (altarLevel < ritual.tier) throw new Error('Zbyt niski poziom ołtarza.');

        const resources = guild.resources;
        for (const cost of ritual.cost) {
            if ((resources[cost.type] || 0) < cost.amount) throw new Error(`Brak: ${cost.type}`);
        }

        for (const cost of ritual.cost) resources[cost.type] -= cost.amount;

        let activeBuffs: GuildBuff[] = guild.active_buffs || [];
        activeBuffs = activeBuffs.filter(b => b.name !== ritual.name);
        activeBuffs.push({
            id: crypto.randomUUID(),
            name: ritual.name,
            stats: ritual.stats,
            expiresAt: Date.now() + (ritual.durationMinutes * 60 * 1000)
        });

        await client.query('UPDATE guilds SET resources = $1, active_buffs = $2 WHERE id = $3', [JSON.stringify(resources), JSON.stringify(activeBuffs), guildId]);
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
