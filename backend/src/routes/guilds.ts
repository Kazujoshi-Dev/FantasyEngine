
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, Affix } from '../types.js';
import { getBackpackCapacity, enforceInboxLimit, fetchFullCharacter } from '../logic/helpers.js';

const router = express.Router();

// GET /api/guilds/list - Publiczna lista gildii
router.get('/list', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.*, COUNT(gm.user_id) as "memberCount"
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            WHERE g.is_public = TRUE
            GROUP BY g.id
            ORDER BY g.member_count DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania listy gildii' });
    }
});

// GET /api/guilds/my-guild - Dane gildii aktualnego gracza
router.get('/my-guild', authenticateToken, async (req: any, res: any) => {
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
                   EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
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
            members: membersRes.rows,
            transactions: transactionsRes.rows.map(t => ({ ...t, timestamp: t.created_at })),
            myRole
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych gildii' });
    }
});

// POST /api/guilds/create - Tworzenie nowej gildii
router.post('/create', authenticateToken, async (req: any, res: any) => {
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
router.post('/join/:id', authenticateToken, async (req: any, res: any) => {
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

// POST /api/guilds/manage-member
router.post('/manage-member', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, action } = req.body; // action: kick, promote, demote
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const myMemberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (myMemberRes.rows.length === 0) throw new Error('Nie należysz do gildii');
        const { guild_id: guildId, role: myRole } = myMemberRes.rows[0];

        if (!canManage(myRole as GuildRole)) throw new Error('Brak uprawnień');

        const targetMemberRes = await client.query('SELECT role FROM guild_members WHERE user_id = $1 AND guild_id = $2', [targetUserId, guildId]);
        if (targetMemberRes.rows.length === 0) throw new Error('Gracz nie jest w Twojej gildii');
        const targetRole = targetMemberRes.rows[0].role as GuildRole;

        if (action === 'kick') {
            if (myRole !== GuildRole.LEADER && targetRole !== GuildRole.RECRUIT) throw new Error('Tylko Lider może wyrzucać oficerów i członków');
            if (targetRole === GuildRole.LEADER) throw new Error('Nie możesz wyrzucić Lidera');
            await client.query('DELETE FROM guild_members WHERE user_id = $1', [targetUserId]);
            await client.query('UPDATE guilds SET member_count = member_count - 1 WHERE id = $1', [guildId]);
        } else if (action === 'promote') {
            if (myRole !== GuildRole.LEADER) throw new Error('Tylko Lider może awansować');
            let newRole = targetRole === GuildRole.RECRUIT ? GuildRole.MEMBER : GuildRole.OFFICER;
            await client.query('UPDATE guild_members SET role = $1 WHERE user_id = $2', [newRole, targetUserId]);
        } else if (action === 'demote') {
            if (myRole !== GuildRole.LEADER) throw new Error('Tylko Lider może degradować');
            let newRole = targetRole === GuildRole.OFFICER ? GuildRole.MEMBER : GuildRole.RECRUIT;
            await client.query('UPDATE guild_members SET role = $1 WHERE user_id = $2', [newRole, targetUserId]);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/upgrade-building
router.post('/upgrade-building', authenticateToken, async (req: any, res: any) => {
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

        // Apply Costs
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

// GET /api/guilds/armory
router.get('/armory', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
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
                   item.value as item, item.key as "itemKey",
                   (item.value->>'originalOwnerId')::int as "ownerId",
                   item.value->>'originalOwnerName' as "ownerName",
                   (item.value->>'borrowedAt')::bigint as "depositedAt"
            FROM characters c, jsonb_array_elements(c.data->'inventory') AS item
            WHERE (item.value->>'isBorrowed')::boolean = TRUE 
            AND (item.value->>'borrowedFromGuildId')::int = $1
        `, [guildId]);

        res.json({
            armoryItems: armoryItems.rows,
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

// POST /api/guilds/armory/deposit
router.post('/armory/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Brak gildii');
        const guildId = memberRes.rows[0].guild_id;

        const guildRes = await client.query('SELECT buildings, (SELECT COUNT(*) FROM guild_armory_items WHERE guild_id = $1) as count FROM guilds WHERE id = $1', [guildId]);
        const armoryLevel = guildRes.rows[0].buildings?.armory || 0;
        if (parseInt(guildRes.rows[0].count) >= 10 + armoryLevel) throw new Error('Zbrojownia jest pełna');

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        const itemIdx = char.inventory.findIndex((i: any) => i.uniqueId === itemId);
        if (itemIdx === -1) throw new Error('Nie znaleziono przedmiotu');
        const item = char.inventory[itemIdx];
        if (item.isBorrowed) throw new Error('Nie możesz deponować pożyczonych przedmiotów');

        char.inventory.splice(itemIdx, 1);
        await client.query('INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)', [guildId, req.user.id, JSON.stringify(item)]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);

        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/armory/borrow
router.post('/armory/borrow', authenticateToken, async (req: any, res: any) => {
    const { armoryId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.inventory.length >= getBackpackCapacity(char)) throw new Error('Backpack full');

        const itemRes = await client.query('SELECT * FROM guild_armory_items WHERE id = $1 AND guild_id = $2 FOR UPDATE', [armoryId, guildId]);
        if (itemRes.rows.length === 0) throw new Error('Item not found in armory');
        
        const armoryEntry = itemRes.rows[0];
        const item: ItemInstance = armoryEntry.item_data;
        const ownerRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [armoryEntry.owner_id]);
        const ownerName = ownerRes.rows[0]?.name || 'Unknown';

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const templates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        const template = templates.find(t => t.id === item.templateId);
        let value = template ? template.value : 100;
        
        if (item.prefixId) {
            const prefix = affixes.find(a => a.id === item.prefixId);
            if (prefix) value += (prefix.value || 0);
        }
        if (item.suffixId) {
            const suffix = affixes.find(a => a.id === item.suffixId);
            if (suffix) value += (suffix.value || 0);
        }

        const guildRes = await client.query('SELECT rental_tax, resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        const tax = Math.ceil(value * (guild.rental_tax / 100));

        if (char.resources.gold < tax) throw new Error(`Not enough gold for rental tax (Required: ${tax})`);

        char.resources.gold -= tax;
        if (!guild.resources) guild.resources = { gold: 0 };
        guild.resources.gold = (Number(guild.resources.gold) || 0) + tax;
        
        item.isBorrowed = true;
        item.borrowedFromGuildId = guildId;
        item.originalOwnerId = armoryEntry.owner_id;
        item.originalOwnerName = ownerName;
        item.borrowedAt = Date.now();
        
        char.inventory.push(item);
        
        await client.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guild.resources), guildId]);
        
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'RENTAL', 'gold', $3)`, [guildId, req.user.id, tax]);

        const fullChar = await fetchFullCharacter(client, req.user.id);
        await client.query('COMMIT');
        res.json(fullChar);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/bank - Wpłaty do banku
router.post('/bank', authenticateToken, async (req: any, res: any) => {
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

// GET /api/guilds/profile/:id - Publiczna wizytówka gildii
router.get('/profile/:id', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.*, c.data->>'name' as "leaderName"
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            WHERE g.id = $1
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Gildia nie istnieje' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania wizytówki' });
    }
});

export default router;
