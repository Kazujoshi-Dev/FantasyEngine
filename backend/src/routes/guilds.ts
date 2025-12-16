
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { GuildRole, EssenceType, RaidType, PlayerCharacter, ItemInstance, ItemTemplate, Affix, EquipmentSlot, GuildInviteBody } from '../types.js';
import { canManage, getBuildingCost } from '../logic/guilds.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';

const router = express.Router();

// GET /api/guilds/list
router.get('/list', authenticateToken, async (req: any, res: any) => {
    try {
        // Safe query: counts members dynamically instead of relying on a potentially missing column
        const result = await pool.query(`
            SELECT 
                g.id, g.name, g.tag, g.max_members, g.min_level, g.is_public,
                (SELECT COUNT(*)::int FROM guild_members gm WHERE gm.guild_id = g.id) as member_count
            FROM guilds g
            ORDER BY member_count DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching guild list:', err);
        res.status(500).json({ message: 'Failed to fetch guild list' });
    }
});

// GET /api/guilds/my-guild
router.get('/my-guild', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.json(null);
        
        const guildId = memberRes.rows[0].guild_id;
        const role = memberRes.rows[0].role;
        
        const guildRes = await pool.query(`
            SELECT g.*, 
            (SELECT jsonb_agg(jsonb_build_object(
                'userId', gm.user_id, 
                'name', c.data->>'name', 
                'level', (c.data->>'level')::int, 
                'race', c.data->>'race', 
                'characterClass', c.data->>'characterClass',
                'role', gm.role,
                'joinedAt', gm.joined_at,
                'isOnline', (EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes'))
            )) FROM guild_members gm JOIN characters c ON gm.user_id = c.user_id WHERE gm.guild_id = g.id) as members,
            (SELECT jsonb_agg(jsonb_build_object(
                'id', gbh.id,
                'userId', gbh.user_id,
                'characterName', c.data->>'name',
                'type', gbh.type,
                'currency', gbh.currency,
                'amount', gbh.amount,
                'timestamp', gbh.created_at
            ) ORDER BY gbh.created_at DESC) FROM (SELECT * FROM guild_bank_history WHERE guild_id = g.id ORDER BY created_at DESC LIMIT 50) gbh LEFT JOIN characters c ON gbh.user_id = c.user_id) as transactions,
            (SELECT jsonb_agg(jsonb_build_object(
                'id', gc.id,
                'userId', gc.user_id,
                'characterName', c.data->>'name',
                'role', gm.role,
                'content', gc.content,
                'timestamp', gc.created_at
            ) ORDER BY gc.created_at DESC) FROM (SELECT * FROM guild_chat WHERE guild_id = g.id ORDER BY created_at DESC LIMIT 50) gc JOIN characters c ON gc.user_id = c.user_id JOIN guild_members gm ON gc.user_id = gm.user_id AND gm.guild_id = g.id) as "chatHistory"
            FROM guilds g WHERE g.id = $1
        `, [guildId]);

        if (guildRes.rows.length === 0) return res.json(null);
        
        const guild = guildRes.rows[0];
        // Normalize snake_case to camelCase
        const formattedGuild = {
            id: guild.id,
            name: guild.name,
            tag: guild.tag,
            leaderId: guild.leader_id,
            description: guild.description,
            crestUrl: guild.crest_url,
            resources: guild.resources,
            memberCount: guild.member_count || guild.members?.length || 0,
            maxMembers: guild.max_members,
            createdAt: guild.created_at,
            isPublic: guild.is_public,
            minLevel: guild.min_level,
            rentalTax: guild.rental_tax,
            huntingTax: guild.hunting_tax,
            buildings: guild.buildings,
            activeBuffs: guild.active_buffs,
            members: guild.members,
            transactions: guild.transactions,
            chatHistory: (guild.chatHistory || []).reverse(), // Reverse to show oldest first in chat window usually, but frontend handles it
            myRole: role
        };

        res.json(formattedGuild);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch guild' });
    }
});

// POST /api/guilds/update - Update Guild Settings
router.post('/update', authenticateToken, async (req: any, res: any) => {
    const { description, crestUrl, minLevel, isPublic, rentalTax, huntingTax } = req.body;
    
    // Validation
    if (rentalTax < 0 || rentalTax > 50) return res.status(400).json({ message: 'Invalid rental tax (0-50)' });
    if (huntingTax < 0 || huntingTax > 50) return res.status(400).json({ message: 'Invalid hunting tax (0-50)' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check permissions (Leader only)
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(403).json({ message: 'Not in a guild' });
        }
        
        const { guild_id, role } = memberRes.rows[0];
        if (role !== GuildRole.LEADER) {
             await client.query('ROLLBACK');
             return res.status(403).json({ message: 'Only the Leader can update guild settings.' });
        }

        await client.query(
            `UPDATE guilds 
             SET description = $1, crest_url = $2, min_level = $3, is_public = $4, rental_tax = $5, hunting_tax = $6
             WHERE id = $7`,
            [description, crestUrl, minLevel, isPublic, rentalTax, huntingTax, guild_id]
        );

        await client.query('COMMIT');
        
        if (req.io) req.io.to(`guild_${guild_id}`).emit('guild_update');
        
        res.json({ message: 'Settings updated' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/create
router.post('/create', authenticateToken, async (req: any, res: any) => {
    const { name, tag, description } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check existing guild
        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You are already in a guild' });
        }

        // Check costs (1000 gold)
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.resources.gold < 1000) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold (1000 required)' });
        }
        
        char.resources.gold -= 1000;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, req.user.id]);

        const guildRes = await client.query(
            `INSERT INTO guilds (name, tag, description, leader_id, member_count) VALUES ($1, $2, $3, $4, 1) RETURNING id`,
            [name, tag, description, req.user.id]
        );
        const guildId = guildRes.rows[0].id;

        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'LEADER')`,
            [guildId, req.user.id]
        );

        // Update character guild_id column for easier lookups
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, req.user.id]);

        await client.query('COMMIT');
        res.json({ message: 'Guild created' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/join/:id
router.post('/join/:id', authenticateToken, async (req: any, res: any) => {
    const guildId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberCheck.rows.length > 0) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'You are already in a guild' });
        }

        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Guild not found' });
        }
        const guild = guildRes.rows[0];

        if (!guild.is_public) {
             await client.query('ROLLBACK');
             return res.status(403).json({ message: 'This guild is not accepting public applications.' });
        }
        
        // Count actual members for safety
        const countRes = await client.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [guildId]);
        const actualMemberCount = parseInt(countRes.rows[0].count);
        
        if (actualMemberCount >= (guild.max_members || 10)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Guild is full.' });
        }
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.level < (guild.min_level || 1)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Level too low.' });
        }

        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'RECRUIT')`,
            [guildId, req.user.id]
        );
        // Sync the member_count column if it exists to keep it fresh
        await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guildId]);
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, req.user.id]);

        await client.query('COMMIT');
        
        if (req.io) req.io.to(`guild_${guildId}`).emit('guild_update');
        
        res.json({ message: 'Joined guild' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/leave
router.post('/leave', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not in a guild' });
        }
        const { guild_id, role } = memberRes.rows[0];

        if (role === GuildRole.LEADER) {
            // Disband guild logic
            await client.query('DELETE FROM guilds WHERE id = $1', [guild_id]);
            // guild_members will cascade delete, but we need to clear character guild_ids
            await client.query('UPDATE characters SET guild_id = NULL WHERE guild_id = $1', [guild_id]);
        } else {
            await client.query('DELETE FROM guild_members WHERE user_id = $1', [req.user.id]);
            await client.query('UPDATE guilds SET member_count = member_count - 1 WHERE id = $1', [guild_id]);
            await client.query('UPDATE characters SET guild_id = NULL WHERE user_id = $1', [req.user.id]);
        }

        await client.query('COMMIT');
        
        if (req.io && role !== GuildRole.LEADER) req.io.to(`guild_${guild_id}`).emit('guild_update');
        
        res.json({ message: 'Left guild' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/manage-member
router.post('/manage-member', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, action } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get Requester Info
        const reqRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (reqRes.rows.length === 0) {
             await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in a guild' }); 
        }
        const { guild_id, role: myRole } = reqRes.rows[0];

        // 2. Get Target Info
        const targetRes = await client.query('SELECT role FROM guild_members WHERE user_id = $1 AND guild_id = $2 FOR UPDATE', [targetUserId, guild_id]);
        if (targetRes.rows.length === 0) {
             await client.query('ROLLBACK'); return res.status(404).json({ message: 'Target not in your guild' }); 
        }
        const targetRole = targetRes.rows[0].role;

        // 3. Hierarchy Check
        const roleValues: Record<string, number> = { 'LEADER': 3, 'OFFICER': 2, 'MEMBER': 1, 'RECRUIT': 0 };
        
        // You cannot manage someone with equal or higher rank
        if (roleValues[myRole] <= roleValues[targetRole]) {
             await client.query('ROLLBACK'); return res.status(403).json({ message: 'Insufficient permissions (Rank too low)' });
        }

        // 4. Handle Actions
        if (action === 'kick') {
            await client.query('DELETE FROM guild_members WHERE user_id = $1 AND guild_id = $2', [targetUserId, guild_id]);
            await client.query('UPDATE guilds SET member_count = member_count - 1 WHERE id = $1', [guild_id]);
            await client.query('UPDATE characters SET guild_id = NULL WHERE user_id = $1', [targetUserId]);
        } else if (action === 'promote') {
            let newRole = targetRole;
            if (targetRole === 'RECRUIT') newRole = 'MEMBER';
            else if (targetRole === 'MEMBER') {
                if (myRole !== 'LEADER') {
                    await client.query('ROLLBACK'); 
                    return res.status(403).json({ message: 'Only Leader can promote to Officer' });
                }
                newRole = 'OFFICER';
            }
            else {
                await client.query('ROLLBACK'); 
                return res.status(400).json({ message: 'Cannot promote further' });
            }
            
            await client.query('UPDATE guild_members SET role = $1 WHERE user_id = $2 AND guild_id = $3', [newRole, targetUserId, guild_id]);
        } else if (action === 'demote') {
            let newRole = targetRole;
            if (targetRole === 'OFFICER') newRole = 'MEMBER';
            else if (targetRole === 'MEMBER') newRole = 'RECRUIT';
            else {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Cannot demote further' });
            }

            await client.query('UPDATE guild_members SET role = $1 WHERE user_id = $2 AND guild_id = $3', [newRole, targetUserId, guild_id]);
        } else {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid action' });
        }

        await client.query('COMMIT');
        
        if (req.io) req.io.to(`guild_${guild_id}`).emit('guild_update');
        
        res.json({ message: 'Success' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/invite
router.post('/invite', authenticateToken, async (req: any, res: any) => {
    const { characterName } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in a guild' }); }
        const { guild_id, role } = memberRes.rows[0];
        
        if (!canManage(role)) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Insufficient permissions' }); }
        
        const targetRes = await client.query("SELECT user_id FROM characters WHERE data->>'name' = $1", [characterName]);
        if (targetRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Player not found' }); }
        const targetId = targetRes.rows[0].user_id;

        const targetGuildCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [targetId]);
        if (targetGuildCheck.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Player is already in a guild' }); }

        const guildRes = await client.query('SELECT name FROM guilds WHERE id = $1', [guild_id]);
        const guildName = guildRes.rows[0].name;

        const inviteBody: GuildInviteBody = { guildId: guild_id, guildName };
        
        await enforceInboxLimit(client, targetId);
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'guild_invite', $2, $3)`,
            [targetId, `Zaproszenie do gildii ${guildName}`, JSON.stringify(inviteBody)]
        );

        await client.query('COMMIT');
        res.json({ message: 'Invitation sent' });
    } catch(err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/accept-invite
router.post('/accept-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const msgRes = await client.query("SELECT body FROM messages WHERE id = $1 AND recipient_id = $2 AND message_type = 'guild_invite'", [messageId, req.user.id]);
        if (msgRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Invite not found' }); }
        
        const body = msgRes.rows[0].body;
        const guildId = body.guildId;

        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberCheck.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'You are already in a guild' }); }

        // Use count for accuracy
        const countRes = await client.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [guildId]);
        const memberCount = parseInt(countRes.rows[0].count);
        
        const guildRes = await client.query('SELECT max_members FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Guild no longer exists' }); }
        const guild = guildRes.rows[0];
        
        if (memberCount >= guild.max_members) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Guild is full' }); }

        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'RECRUIT')`,
            [guildId, req.user.id]
        );
        await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guildId]);
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, req.user.id]);
        
        await client.query('DELETE FROM messages WHERE id = $1', [messageId]);

        await client.query('COMMIT');
        if (req.io) req.io.to(`guild_${guildId}`).emit('guild_update');
        res.json({ message: 'Joined guild' });
    } catch(err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/reject-invite
router.post('/reject-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    try {
        await pool.query("DELETE FROM messages WHERE id = $1 AND recipient_id = $2 AND message_type = 'guild_invite'", [messageId, req.user.id]);
        res.json({ message: 'Invite rejected' });
    } catch(err: any) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/guilds/profile/:id
router.get('/profile/:id', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.name, g.tag, g.description, g.crest_url, g.member_count, g.max_members, g.created_at, g.is_public, g.min_level,
            c.data->>'name' as leader_name,
            (SELECT SUM((c2.data->>'level')::int) FROM guild_members gm JOIN characters c2 ON gm.user_id = c2.user_id WHERE gm.guild_id = g.id) as total_level
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            WHERE g.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Guild not found' });
        
        const row = result.rows[0];
        res.json({
            name: row.name,
            tag: row.tag,
            leaderName: row.leader_name,
            description: row.description,
            crestUrl: row.crest_url,
            memberCount: row.member_count,
            maxMembers: row.max_members,
            totalLevel: parseInt(row.total_level) || 0,
            createdAt: row.created_at,
            isPublic: row.is_public,
            minLevel: row.min_level
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch guild profile' });
    }
});

// GET /api/guilds/armory
router.get('/armory', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        const armoryRes = await pool.query(`
            SELECT gai.id, gai.item_data as item, gai.owner_id as "ownerId", gai.created_at as "depositedAt", 
            c.data->>'name' as "ownerName",
            (
                SELECT c_borrower.data->>'name'
                FROM characters c_borrower
                WHERE EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(c_borrower.data->'inventory') as inv_item
                    WHERE (inv_item->>'uniqueId') = (gai.item_data->>'uniqueId') AND (inv_item->>'isBorrowed')::boolean = true
                ) OR EXISTS (
                    SELECT 1
                    FROM jsonb_each(c_borrower.data->'equipment') as equip
                    WHERE (equip.value->>'uniqueId') = (gai.item_data->>'uniqueId') AND (equip.value->>'isBorrowed')::boolean = true
                )
            ) as "borrowedBy",
            (
                SELECT c_borrower.user_id
                FROM characters c_borrower
                WHERE EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(c_borrower.data->'inventory') as inv_item
                    WHERE (inv_item->>'uniqueId') = (gai.item_data->>'uniqueId') AND (inv_item->>'isBorrowed')::boolean = true
                ) OR EXISTS (
                     SELECT 1
                     FROM jsonb_each(c_borrower.data->'equipment') as equip
                     WHERE (equip.value->>'uniqueId') = (gai.item_data->>'uniqueId') AND (equip.value->>'isBorrowed')::boolean = true
                )
            ) as "userId"
            FROM guild_armory_items gai
            JOIN characters c ON gai.owner_id = c.user_id
            WHERE gai.guild_id = $1
            ORDER BY gai.created_at DESC
        `, [guildId]);
        
        const armoryItems = [];
        const borrowedItems = [];

        for (const row of armoryRes.rows) {
            const item = {
                id: row.id,
                item: row.item,
                ownerId: row.ownerId,
                ownerName: row.ownerName,
                depositedAt: row.depositedAt,
                borrowedBy: row.borrowedBy,
                userId: row.userId
            };
            if (row.borrowedBy) borrowedItems.push(item);
            else armoryItems.push(item);
        }

        res.json({ armoryItems, borrowedItems });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error fetching armory' });
    }
});

// POST /api/guilds/armory/deposit
router.post('/armory/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in guild' }); }
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Item not found' }); }
        
        const item = character.inventory[itemIndex];
        if (item.isBorrowed) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Cannot deposit borrowed items' }); }
        
        // Remove from inventory
        character.inventory.splice(itemIndex, 1);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        
        // Add to armory
        await client.query(`INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`, [guildId, req.user.id, JSON.stringify(item)]);

        await client.query('COMMIT');
        if (req.io) req.io.to(`guild_${guildId}`).emit('guild_update');
        res.json({ message: 'Deposited' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
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
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in guild' }); }
        const guildId = memberRes.rows[0].guild_id;

        const itemRes = await client.query('SELECT * FROM guild_armory_items WHERE id = $1 AND guild_id = $2 FOR UPDATE', [armoryId, guildId]);
        if (itemRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Item not found in armory' }); }
        const armoryItem = itemRes.rows[0];
        const item: ItemInstance = armoryItem.item_data;

        // Calculate Cost
        const guildRes = await client.query('SELECT rental_tax FROM guilds WHERE id = $1', [guildId]);
        const rentalTax = guildRes.rows[0].rental_tax || 10;
        
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates = gameDataRes.rows[0].data;
        const template = templates.find((t: any) => t.id === item.templateId);
        
        // Simple value calc (ignoring affixes for brevity, but should include)
        const cost = Math.ceil((template?.value || 0) * (rentalTax / 100));

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (character.resources.gold < cost) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); }
        if (character.inventory.length >= getBackpackCapacity(character)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Inventory full' }); }

        // Transfer Gold
        character.resources.gold -= cost;
        await client.query(`UPDATE guilds SET resources = jsonb_set(resources, '{gold}', (COALESCE(resources->>'gold','0')::int + $1)::text::jsonb) WHERE id = $2`, [cost, guildId]);
        
        // Log Transaction
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'RENTAL', 'gold', $3)`, [guildId, req.user.id, cost]);

        // Prepare Item
        const ownerNameRes = await client.query(`SELECT data->>'name' as name FROM characters WHERE user_id = $1`, [armoryItem.owner_id]);
        
        item.isBorrowed = true;
        item.borrowedFromGuildId = guildId;
        item.originalOwnerId = armoryItem.owner_id;
        item.originalOwnerName = ownerNameRes.rows[0]?.name || 'Unknown';
        item.borrowedAt = Date.now();

        character.inventory.push(item);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        
        // Note: We delete from armory table, but track it as 'borrowed' implicitly because it exists in player inventory with isBorrowed=true
        // The GET /armory endpoint reconstructs the "Borrowed Items" list by scanning player inventories.
        await client.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);

        await client.query('COMMIT');
        if (req.io) req.io.to(`guild_${guildId}`).emit('guild_update');
        res.json({ message: 'Borrowed' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/armory/recall
router.post('/armory/recall', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, itemUniqueId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in guild' }); }
        const { guild_id, role } = memberRes.rows[0];

        // Fetch Target Character
        const targetRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [targetUserId]);
        if (targetRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Target not found' }); }
        const targetChar: PlayerCharacter = targetRes.rows[0].data;

        // Find item in inventory or equipment
        let itemIndex = -1;
        let itemLocation: string = 'inventory';
        let item: ItemInstance | null = null;
        
        // Check inventory
        itemIndex = targetChar.inventory.findIndex(i => i.uniqueId === itemUniqueId);
        if (itemIndex > -1) {
            item = targetChar.inventory[itemIndex];
        } else {
            // Check equipment using EquipmentSlot enum keys
            const equipment = targetChar.equipment;
            for (const key of Object.keys(equipment)) {
                 const slot = key as EquipmentSlot;
                 if (equipment[slot]?.uniqueId === itemUniqueId) {
                     item = equipment[slot];
                     itemLocation = slot;
                     break;
                 }
            }
        }

        if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Item not found on player' }); }
        if (!item.isBorrowed || item.borrowedFromGuildId !== guild_id) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Item does not belong to this guild' });
        }

        // Permission check: Leader/Officer OR Original Owner
        const isOwner = item.originalOwnerId === req.user.id;
        if (!isOwner && role !== GuildRole.LEADER && role !== GuildRole.OFFICER) {
             await client.query('ROLLBACK'); return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Remove from target
        if (itemLocation === 'inventory') {
            targetChar.inventory.splice(itemIndex, 1);
        } else {
            targetChar.equipment[itemLocation as EquipmentSlot] = null;
        }

        // Clean item tags
        delete item.isBorrowed;
        delete item.borrowedFromGuildId;
        delete item.originalOwnerId;
        delete item.originalOwnerName;
        delete item.borrowedAt;

        // Add back to armory
        await client.query(`INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`, [guild_id, req.user.id, JSON.stringify(item)]); 
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(targetChar), targetUserId]);
        await client.query('COMMIT');
        
        if (req.io) req.io.to(`guild_${guild_id}`).emit('guild_update');
        res.json({ message: 'Recalled' });

    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// DELETE /api/guilds/armory/:id - Delete item permanently (Leader only)
router.delete('/armory/:id', authenticateToken, async (req: any, res: any) => {
    const armoryId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in guild' }); }
        const { guild_id, role } = memberRes.rows[0];

        if (role !== GuildRole.LEADER) {
             await client.query('ROLLBACK'); return res.status(403).json({ message: 'Only Leader can delete items' });
        }

        await client.query('DELETE FROM guild_armory_items WHERE id = $1 AND guild_id = $2', [armoryId, guild_id]);
        await client.query('COMMIT');
        
        if (req.io) req.io.to(`guild_${guild_id}`).emit('guild_update');
        res.json({ message: 'Deleted' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});


// POST /api/guilds/bank - Handle Deposits and Withdrawals
router.post('/bank', authenticateToken, async (req: any, res: any) => {
    const { type, currency, amount } = req.body;
    const userId = req.user.id;
    
    // Type checking
    if (type !== 'DEPOSIT' && type !== 'WITHDRAW') return res.status(400).json({ message: 'Invalid transaction type' });
    if (amount <= 0) return res.status(400).json({ message: 'Amount must be positive' });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check guild membership
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in guild' }); }
        const { guild_id, role } = memberRes.rows[0];

        // Fetch Character and Guild for update
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        
        let character = charRes.rows[0].data;
        let guildResources = guildRes.rows[0].resources;
        
        // Defensive initialization
        if (!guildResources) guildResources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
        
        if (type === 'DEPOSIT') {
            // Check player resources
            if (currency === 'gold') {
                if (character.resources.gold < amount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); }
                character.resources.gold -= amount;
                guildResources.gold += amount;
            } else {
                if ((character.resources[currency] || 0) < amount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough essence' }); }
                character.resources[currency] -= amount;
                guildResources[currency] = (guildResources[currency] || 0) + amount;
            }
        } else if (type === 'WITHDRAW') {
            // Check permissions (Leaders/Officers only?)
             if (!canManage(role)) { 
                  await client.query('ROLLBACK'); return res.status(403).json({ message: 'Only leaders and officers can withdraw.' }); 
             }
             
             // Check guild resources
             if (currency === 'gold') {
                if (guildResources.gold < amount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold in guild bank' }); }
                guildResources.gold -= amount;
                character.resources.gold += amount;
            } else {
                if ((guildResources[currency] || 0) < amount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough essence in guild bank' }); }
                guildResources[currency] -= amount;
                character.resources[currency] = (character.resources[currency] || 0) + amount;
            }
        }

        // Persist changes
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildResources), guild_id]);
        
        // Log Transaction
        await client.query(
            `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, $3, $4, $5)`,
            [guild_id, userId, type, currency, amount]
        );

        await client.query('COMMIT');
        
        // Emit update event to the guild room so all members refresh their guild view
        if (req.io) {
            req.io.to(`guild_${guild_id}`).emit('guild_update');
        }
        
        res.json({ message: 'Transaction successful' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Transaction failed' });
    } finally {
        client.release();
    }
});

// POST /api/guilds/upgrade-building
router.post('/upgrade-building', authenticateToken, async (req: any, res: any) => {
    const { buildingType } = req.body;
    const userId = req.user.id;

    if (!buildingType) {
        return res.status(400).json({ message: 'Building type is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Validate User Role
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) { 
            await client.query('ROLLBACK'); 
            return res.status(403).json({ message: 'Not in guild' }); 
        }
        const { guild_id, role } = memberRes.rows[0];

        if (!canManage(role)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Only leaders and officers can upgrade buildings.' });
        }

        // 2. Fetch Guild Data
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        const guild = guildRes.rows[0];
        
        if (!guild.buildings) {
            guild.buildings = { headquarters: 0, armory: 0, barracks: 0, scoutHouse: 0, shrine: 0, altar: 0 };
        }
        
        const currentLevel = guild.buildings[buildingType] || 0;

        // 3. Calculate Cost
        const { gold, costs } = getBuildingCost(buildingType, currentLevel);
        
        if (gold === Infinity) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Building is already at max level' });
        }

        // 4. Check Resources in Guild Bank
        if ((guild.resources.gold || 0) < gold) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold in guild bank' });
        }
        
        for (const c of costs) {
            if ((guild.resources[c.type] || 0) < c.amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough ${c.type} in guild bank` });
            }
        }

        // 5. Deduct Resources and Log Transaction
        guild.resources.gold -= gold;
        if (gold > 0) {
            await client.query(
                `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'WITHDRAW', 'gold', $3)`,
                [guild_id, userId, gold]
            );
        }

        for (const c of costs) {
            if (c.amount > 0) {
                guild.resources[c.type] -= c.amount;
                await client.query(
                    `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'WITHDRAW', $3, $4)`,
                    [guild_id, userId, c.type, c.amount]
                );
            }
        }

        // 6. Update Building Level
        guild.buildings[buildingType] = currentLevel + 1;
        
        // Update dependent properties like max_members
        if (buildingType === 'headquarters') {
            guild.max_members = 10 + guild.buildings[buildingType];
        }

        await client.query(
            'UPDATE guilds SET resources = $1, buildings = $2, max_members = $3 WHERE id = $4', 
            [JSON.stringify(guild.resources), JSON.stringify(guild.buildings), guild.max_members, guild_id]
        );

        await client.query('COMMIT');
        
        // Notify guild members
        if (req.io) {
            req.io.to(`guild_${guild_id}`).emit('guild_update');
        }

        res.json({ message: 'Building upgraded successfully', buildings: guild.buildings });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Upgrade building error:', err);
        res.status(500).json({ message: 'Failed to upgrade building' });
    } finally {
        client.release();
    }
});

// POST /api/guilds/altar/sacrifice - Perform ritual
router.post('/altar/sacrifice', authenticateToken, async (req: any, res: any) => {
    const { ritualId } = req.body;
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in guild' }); }
        const { guild_id, role } = memberRes.rows[0];
        
        if (!canManage(role)) {
             await client.query('ROLLBACK'); return res.status(403).json({ message: 'Only leaders and officers can perform rituals.' });
        }

        const guildRes = await client.query('SELECT resources, buildings, active_buffs FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        const guild = guildRes.rows[0];
        const buildings = guild.buildings || {};
        
        // Fetch ritual def
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'rituals'");
        const rituals = gameDataRes.rows[0]?.data || [];
        const ritual = rituals.find((r: any) => r.id === ritualId);
        
        if (!ritual) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Ritual not found' }); }

        // Check Altar Level
        const altarLevel = buildings.altar || 0;
        if (altarLevel < ritual.tier) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Altar level too low for this ritual.' });
        }

        // Check Active Buffs (Prevent duplicate of same ritual)
        const activeBuffs = guild.active_buffs || [];
        const now = Date.now();
        if (activeBuffs.some((b: any) => b.name === ritual.name && b.expiresAt > now)) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'This ritual is already active.' });
        }

        // Check Costs
        for (const c of ritual.cost) {
            const current = c.type === 'gold' ? guild.resources.gold : guild.resources[c.type];
            if ((current || 0) < c.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${c.type}.` });
            }
        }

        // Deduct & Log
        for (const c of ritual.cost) {
            if (c.type === 'gold') {
                guild.resources.gold -= c.amount;
            } else {
                guild.resources[c.type] -= c.amount;
            }
            // Log history
             await client.query(
                `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'WITHDRAW', $3, $4)`,
                [guild_id, userId, c.type, c.amount]
            );
        }

        // Apply Buff
        const expiresAt = Date.now() + (ritual.durationMinutes * 60 * 1000);
        // Clean expired buffs first
        const newBuffs = activeBuffs.filter((b: any) => b.expiresAt > now);
        
        newBuffs.push({
            id: ritual.id,
            name: ritual.name,
            stats: ritual.stats,
            expiresAt
        });

        await client.query(
            'UPDATE guilds SET resources = $1, active_buffs = $2 WHERE id = $3', 
            [JSON.stringify(guild.resources), JSON.stringify(newBuffs), guild_id]
        );

        await client.query('COMMIT');
        if (req.io) req.io.to(`guild_${guild_id}`).emit('guild_update');
        
        res.json({ message: 'Ritual performed' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// GET /api/guilds/raids - Fetch Raids
router.get('/raids', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;
        
        const data = await getActiveRaids(guildId);
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// GET /api/guilds/targets - List potential war targets
router.get('/targets', authenticateToken, async (req: any, res: any) => {
     try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        // Dynamic count here too for consistency
        const result = await pool.query(`
            SELECT g.id, g.name, g.tag,
            (SELECT COUNT(*)::int FROM guild_members gm WHERE gm.guild_id = g.id) as member_count
            FROM guilds g
            WHERE g.id != $1
            ORDER BY member_count DESC
        `, [guildId]);
        
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch targets' });
    }
});

// POST /api/guilds/raids/create
router.post('/raids/create', authenticateToken, async (req: any, res: any) => {
    const { targetGuildId, raidType } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        const result = await createRaid(guildId, req.user.id, targetGuildId, raidType);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// POST /api/guilds/raids/join
router.post('/raids/join', authenticateToken, async (req: any, res: any) => {
    const { raidId } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        await joinRaid(raidId, req.user.id, guildId);
        res.json({ message: 'Joined raid' });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

// --- ESPIONAGE ROUTES ---

// GET /api/guilds/espionage - List espionage data
router.get('/espionage', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        // Fetch Active Spies
        const activeRes = await client.query(`
            SELECT ge.id, ge.defender_guild_id as "targetGuildId", ge.start_time as "startTime", ge.end_time as "endTime", ge.cost,
                   g.name as "targetGuildName"
            FROM guild_espionage ge
            JOIN guilds g ON ge.defender_guild_id = g.id
            WHERE ge.attacker_guild_id = $1 AND ge.status = 'IN_PROGRESS'
            ORDER BY ge.end_time ASC
        `, [guildId]);

        // Fetch History
        const historyRes = await client.query(`
            SELECT ge.id, ge.defender_guild_id as "targetGuildId", ge.end_time as "endTime", ge.cost, ge.result_snapshot as "result",
                   g.name as "targetGuildName"
            FROM guild_espionage ge
            JOIN guilds g ON ge.defender_guild_id = g.id
            WHERE ge.attacker_guild_id = $1 AND ge.status = 'COMPLETED'
            ORDER BY ge.end_time DESC
            LIMIT 15
        `, [guildId]);

        res.json({
            activeSpies: activeRes.rows,
            history: historyRes.rows
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/espionage/start - Send a spy
router.post('/espionage/start', authenticateToken, async (req: any, res: any) => {
    const { targetGuildId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Check Permissions & Building
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not in guild' }); }
        const { guild_id, role } = memberRes.rows[0];

        // 2. Fetch Guild Data
        const guildRes = await client.query('SELECT resources, buildings FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        const guild = guildRes.rows[0];
        const spyLevel = guild.buildings?.spyHideout || 0;

        if (spyLevel < 1) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Spy Hideout Level 1 required.' });
        }
        
        // Check active spies limit
        const activeCountRes = await client.query('SELECT COUNT(*) FROM guild_espionage WHERE attacker_guild_id = $1 AND status = \'IN_PROGRESS\'', [guild_id]);
        if (parseInt(activeCountRes.rows[0].count) >= spyLevel) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: `Maximum active spies reached (${spyLevel}).` });
        }

        // 3. Calculate Cost
        // Get sum of levels of target guild members
        const targetMembersRes = await client.query(
            `SELECT SUM((c.data->>'level')::int) as sum_levels 
             FROM guild_members gm 
             JOIN characters c ON gm.user_id = c.user_id 
             WHERE gm.guild_id = $1`, 
            [targetGuildId]
        );
        const sumLevels = parseInt(targetMembersRes.rows[0].sum_levels) || 0;
        const cost = 125 * sumLevels;

        if ((guild.resources.gold || 0) < cost) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough gold in guild bank. Cost: ${cost}g` });
        }

        // 4. Determine Duration
        // Lvl 1: 15m, Lvl 2: 10m, Lvl 3: 5m
        let durationMinutes = 15;
        if (spyLevel === 2) durationMinutes = 10;
        if (spyLevel >= 3) durationMinutes = 5;
        
        const endTime = new Date(Date.now() + durationMinutes * 60 * 1000);

        // 5. Execute Transaction
        guild.resources.gold -= cost;
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guild.resources), guild_id]);
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'WITHDRAW', 'gold', $3)`, [guild_id, req.user.id, cost]);

        await client.query(
            `INSERT INTO guild_espionage (attacker_guild_id, defender_guild_id, status, end_time, cost)
             VALUES ($1, $2, 'IN_PROGRESS', $3, $4)`,
            [guild_id, targetGuildId, endTime, cost]
        );

        await client.query('COMMIT');
        
        if (req.io) req.io.to(`guild_${guild_id}`).emit('guild_update');
        res.json({ message: 'Spy sent successfully' });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});


export default router;
