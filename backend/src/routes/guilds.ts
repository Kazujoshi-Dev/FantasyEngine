
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, RaidType } from '../types.js';
// Fix: Import getBackpackCapacity from stats.js, keep enforceInboxLimit and fetchFullCharacter from helpers.js
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

// GET /api/guilds/my-guild - Dane gildii aktualnego gracza
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
            members: membersRes.rows,
            transactions: transactionsRes.rows.map(t => ({ ...t, timestamp: t.created_at })),
            myRole
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych gildii' });
    }
});

// GET /api/guilds/raids - Lista rajdów (Aktywne i historia)
router.get('/raids', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Brak gildii' });
        const guildId = memberRes.rows[0].guild_id;

        const raids = await getActiveRaids(guildId);
        res.json(raids);
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania rajdów' });
    }
});

// GET /api/guilds/espionage - Aktywne misje szpiegowskie i raporty
router.get('/espionage', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Brak gildii' });
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
            activeSpies: activeSpies.rows.map(r => ({ ...r, targetGuildName: r.targetGuildName, endTime: r.end_time })),
            history: history.rows.map(r => ({ ...r, targetGuildName: r.targetGuildName, endTime: r.end_time, resultSnapshot: r.result_snapshot }))
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych wywiadu' });
    }
});

// GET /api/guilds/targets - Inne gildie dla szpiegostwa i rajdów
router.get('/targets', async (req: any, res: any) => {
    try {
        const myGuildRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        const myGuildId = myGuildRes.rows[0]?.guild_id;

        const result = await pool.query(`
            SELECT g.id, g.name, g.tag, g.member_count as "memberCount", 
                   COALESCE(SUM((c.data->>'level')::int), 0) as "totalLevel"
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            LEFT JOIN characters c ON gm.user_id = c.user_id
            WHERE g.id != $1
            GROUP BY g.id
            ORDER BY "totalLevel" DESC
        `, [myGuildId || 0]);

        res.json(result.rows.map(r => ({
            ...r,
            memberCount: parseInt(r.memberCount) || 0,
            totalLevel: parseInt(r.totalLevel) || 0
        })));
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania celów' });
    }
});

// POST /api/guilds/create - Tworzenie nowej gildii
router.post('/create', async (req: any, res: any) => {
    const { name, tag, description } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.resources.gold < 1000) throw new Error('Brak złota (wymagane 1000g)');

        const existingMember = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (existingMember.rows.length > 0) throw new Error('Już należysz do gildii');

        const guildInsert = await client.query(
            `INSERT INTO guilds (name, tag, description, leader_id) VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, tag, description, req.user.id]
        );
        const guildId = guildInsert.rows[0].id;

        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, $3)`,
            [guildId, req.user.id, GuildRole.LEADER]
        );

        char.resources.gold -= 1000;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);

        await client.query('COMMIT');
        res.status(201).json({ id: guildId });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/join/:id - Dołączanie do gildii
router.post('/join/:id', async (req: any, res: any) => {
    const guildId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) throw new Error('Gildia nie istnieje');
        const guild = guildRes.rows[0];

        if (!guild.is_public) throw new Error('Ta gildia jest zamknięta');
        if (guild.member_count >= guild.max_members) throw new Error('Gildia jest pełna');

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.level < guild.min_level) throw new Error(`Wymagany poziom: ${guild.min_level}`);

        const existingMember = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (existingMember.rows.length > 0) throw new Error('Już należysz do gildii');

        await client.query('INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, $3)', [guildId, req.user.id, GuildRole.RECRUIT]);
        await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guildId]);

        await client.query('COMMIT');
        res.json({ message: 'Dołączono' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// GET /api/guilds/armory - Pobieranie zbrojowni
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

        // Fix: Correct usage of jsonb_array_elements. 'item' is already the value.
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
        console.error("Zbrojownia Error:", err);
        res.status(500).json({ message: 'Błąd zbrojowni' });
    }
});

// POST /api/guilds/update - Zapisywanie ustawień gildii
router.post('/update', async (req: any, res: any) => {
    const { description, crestUrl, minLevel, isPublic, rentalTax, huntingTax } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || memberRes.rows[0].role !== GuildRole.LEADER) {
            return res.status(403).json({ message: 'Brak uprawnień lidera' });
        }
        const guildId = memberRes.rows[0].guild_id;

        await pool.query(`
            UPDATE guilds 
            SET description = $1, crest_url = $2, min_level = $3, is_public = $4, rental_tax = $5, hunting_tax = $6
            WHERE id = $7
        `, [description, crestUrl, minLevel, isPublic, rentalTax, huntingTax, guildId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Błąd zapisu ustawień' });
    }
});

// POST /api/guilds/bank - Operacje bankowe
router.post('/bank', async (req: any, res: any) => {
    const { type, currency, amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Brak gildii');
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;

        if (type === 'DEPOSIT') {
            if ((char.resources[currency] || 0) < amount) throw new Error('Brak środków');
            char.resources[currency] -= amount;
            const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
            const resources = guildRes.rows[0].resources;
            resources[currency] = (resources[currency] || 0) + amount;
            await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(resources), guildId]);
            await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'DEPOSIT', $3, $4)`, [guildId, req.user.id, currency, amount]);
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/upgrade-building - Ulepszanie budynków
router.post('/upgrade-building', async (req: any, res: any) => {
    const { buildingType } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Brak gildii');
        const { guild_id: guildId, role } = memberRes.rows[0];

        if (!canManage(role as GuildRole)) throw new Error('Brak uprawnień');

        const guildRes = await client.query('SELECT buildings, resources, max_members FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        const buildings = guild.buildings || {};
        const currentLevel = buildings[buildingType] || 0;

        const cost = getBuildingCost(buildingType, currentLevel);
        if (guild.resources.gold < cost.gold) throw new Error('Skarbiec gildii nie ma dość złota');
        for (const e of cost.costs) {
            if ((guild.resources[e.type] || 0) < e.amount) throw new Error(`Brak esencji w skarbcu: ${e.type}`);
        }

        guild.resources.gold -= cost.gold;
        for (const e of cost.costs) guild.resources[e.type] -= e.amount;
        buildings[buildingType] = currentLevel + 1;

        let maxMembers = guild.max_members;
        if (buildingType === 'headquarters') maxMembers = 10 + buildings[buildingType];

        await client.query(
            'UPDATE guilds SET buildings = $1, resources = $2, max_members = $3 WHERE id = $4',
            [JSON.stringify(buildings), JSON.stringify(guild.resources), maxMembers, guildId]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// Rajdy i Szpiegostwo - Inicjacja
router.post('/raids/create', async (req: any, res: any) => {
    const { targetGuildId, raidType } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || !canManage(memberRes.rows[0].role)) throw new Error('Brak uprawnień');
        
        await createRaid(memberRes.rows[0].guild_id, req.user.id, targetGuildId, raidType);
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/raids/join', async (req: any, res: any) => {
    const { raidId } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Brak gildii');
        
        await joinRaid(raidId, req.user.id, memberRes.rows[0].guild_id);
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/espionage/start', async (req: any, res: any) => {
    const { targetGuildId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || !canManage(memberRes.rows[0].role)) throw new Error('Brak uprawnień');
        const guildId = memberRes.rows[0].guild_id;

        const targetRes = await client.query(`
            SELECT g.id, COALESCE(SUM((c.data->>'level')::int), 0) as total_level
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            LEFT JOIN characters c ON gm.user_id = c.user_id
            WHERE g.id = $1
            GROUP BY g.id
        `, [targetGuildId]);
        
        if (targetRes.rows.length === 0) throw new Error('Cel nie istnieje');
        const cost = 1000 + (targetRes.rows[0].total_level * 50);

        const guildData = await client.query('SELECT resources, buildings FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildData.rows[0].resources.gold < cost) throw new Error('Brak złota w skarbcu');
        
        const spyLevel = guildData.rows[0].buildings?.spyHideout || 0;
        const durationMin = spyLevel >= 3 ? 5 : spyLevel === 2 ? 10 : 15;
        const endTime = new Date(Date.now() + durationMin * 60000);

        guildData.rows[0].resources.gold -= cost;
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildData.rows[0].resources), guildId]);

        await client.query(`
            INSERT INTO guild_espionage (attacker_guild_id, defender_guild_id, status, start_time, end_time, cost)
            VALUES ($1, $2, 'IN_PROGRESS', NOW(), $3, $4)
        `, [guildId, targetGuildId, endTime, cost]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;
