
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { Guild, GuildMember, GuildRole, GuildTransaction, GuildChatMessage, PlayerCharacter, ItemTemplate, ItemInstance } from '../types.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

// GET /api/guilds/my-guild
router.get('/my-guild', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.json(null);
        
        const { guild_id, role } = memberRes.rows[0];
        
        const guildRes = await pool.query('SELECT * FROM guilds WHERE id = $1', [guild_id]);
        if (guildRes.rows.length === 0) return res.json(null);
        
        const guild = guildRes.rows[0];
        
        // Fetch members
        const membersRes = await pool.query(`
            SELECT gm.*, c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race, c.data->>'characterClass' as "characterClass",
            EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
            FROM guild_members gm
            JOIN characters c ON gm.user_id = c.user_id
            WHERE gm.guild_id = $1
            ORDER BY 
                CASE gm.role WHEN 'LEADER' THEN 1 WHEN 'OFFICER' THEN 2 WHEN 'MEMBER' THEN 3 ELSE 4 END,
                c.data->>'level' DESC
        `, [guild_id]);
        
        // Fetch recent transactions
        const transRes = await pool.query(`
            SELECT gbh.*, c.data->>'name' as "characterName"
            FROM guild_bank_history gbh
            LEFT JOIN characters c ON gbh.user_id = c.user_id
            WHERE gbh.guild_id = $1
            ORDER BY gbh.created_at DESC LIMIT 20
        `, [guild_id]);
        
        // Fetch recent chat
        const chatRes = await pool.query(`
            SELECT gc.id, gc.user_id as "userId", gc.content, gc.created_at as timestamp, 
                   c.data->>'name' as "characterName", gm.role
            FROM guild_chat gc
            JOIN characters c ON gc.user_id = c.user_id
            JOIN guild_members gm ON gc.user_id = gm.user_id AND gm.guild_id = gc.guild_id
            WHERE gc.guild_id = $1
            ORDER BY gc.created_at ASC LIMIT 50
        `, [guild_id]);

        res.json({
            ...guild,
            myRole: role,
            members: membersRes.rows,
            transactions: transRes.rows,
            chatHistory: chatRes.rows,
            memberCount: membersRes.rows.length
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error fetching guild data' });
    }
});

// GET /api/guilds/list
router.get('/list', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.id, g.name, g.tag, g.description, g.min_level, g.is_public, g.crest_url, COUNT(gm.user_id) as "memberCount", g.max_members
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            GROUP BY g.id
            ORDER BY "memberCount" DESC
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ message: 'Error fetching guild list' });
    }
});

// POST /api/guilds/create
router.post('/create', authenticateToken, async (req: any, res: any) => {
    const { name, tag, description } = req.body;
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check if already in guild
        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [userId]);
        if (memberCheck.rows.length > 0) throw new Error('Already in a guild');
        
        // Check gold
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char = charRes.rows[0].data;
        if (char.resources.gold < 5000) throw new Error('Not enough gold (5000 required)');
        
        // Deduct gold
        char.resources.gold -= 5000;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        
        // Create Guild
        const guildRes = await client.query(`
            INSERT INTO guilds (name, tag, description, leader_id) 
            VALUES ($1, $2, $3, $4) RETURNING id
        `, [name, tag, description, userId]);
        
        const guildId = guildRes.rows[0].id;
        
        // Add Leader
        await client.query(`
            INSERT INTO guild_members (guild_id, user_id, role) 
            VALUES ($1, $2, 'LEADER')
        `, [guildId, userId]);
        
        await client.query('COMMIT');
        res.sendStatus(201);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/join/:id
router.post('/join/:id', authenticateToken, async (req: any, res: any) => {
    const guildId = req.params.id;
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [userId]);
        if (memberCheck.rows.length > 0) throw new Error('Already in a guild');
        
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) throw new Error('Guild not found');
        const guild = guildRes.rows[0];
        
        // Check Requirements
        if (!guild.is_public) throw new Error('Guild is not public');
        
        const membersCount = (await client.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [guildId])).rows[0].count;
        if (membersCount >= guild.max_members) throw new Error('Guild is full');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        const char = charRes.rows[0].data;
        if (char.level < guild.min_level) throw new Error(`Level too low (min: ${guild.min_level})`);
        
        // Join
        await client.query(`
            INSERT INTO guild_members (guild_id, user_id, role) 
            VALUES ($1, $2, 'RECRUIT')
        `, [guildId, userId]);
        
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/leave
router.post('/leave', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error('Not in a guild');
        
        const { guild_id, role } = memberRes.rows[0];
        
        if (role === 'LEADER') {
            const count = (await client.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [guild_id])).rows[0].count;
            if (count > 1) throw new Error('Leader cannot leave until leadership is transferred.');
            // Delete guild if last member
            await client.query('DELETE FROM guilds WHERE id = $1', [guild_id]);
        } else {
            await client.query('DELETE FROM guild_members WHERE user_id = $1', [userId]);
        }
        
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/invite
router.post('/invite', authenticateToken, async (req: any, res: any) => {
    const { characterName } = req.body;
    const senderId = req.user.id;
    
    try {
        const senderMember = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [senderId]);
        if (senderMember.rows.length === 0) throw new Error('Not in a guild');
        const { guild_id, role } = senderMember.rows[0];
        if (role === 'MEMBER' || role === 'RECRUIT') throw new Error('No permission');
        
        const recipientRes = await pool.query("SELECT user_id FROM characters WHERE data->>'name' = $1", [characterName]);
        if (recipientRes.rows.length === 0) throw new Error('Character not found');
        const recipientId = recipientRes.rows[0].user_id;
        
        const inGuildCheck = await pool.query('SELECT 1 FROM guild_members WHERE user_id = $1', [recipientId]);
        if (inGuildCheck.rows.length > 0) throw new Error('Player already in a guild');
        
        const guildNameRes = await pool.query('SELECT name FROM guilds WHERE id = $1', [guild_id]);
        const guildName = guildNameRes.rows[0].name;
        
        const inviteBody = JSON.stringify({ guildId: guild_id, guildName });
        
        await pool.query(`
            INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
            VALUES ($1, 'System', 'guild_invite', $2, $3)
        `, [recipientId, `Zaproszenie do gildii ${guildName}`, inviteBody]);
        
        res.sendStatus(200);
    } catch (e: any) {
        res.status(400).json({ message: e.message });
    }
});

// POST /api/guilds/accept-invite
router.post('/accept-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const msgRes = await client.query('SELECT body FROM messages WHERE id = $1 AND recipient_id = $2', [messageId, userId]);
        if (msgRes.rows.length === 0) throw new Error('Message not found');
        
        const body = msgRes.rows[0].body;
        if (!body.guildId) throw new Error('Invalid invite');
        
        // Same checks as join
        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [userId]);
        if (memberCheck.rows.length > 0) throw new Error('Already in a guild');
        
        const guildRes = await client.query('SELECT max_members FROM guilds WHERE id = $1 FOR UPDATE', [body.guildId]);
        if (guildRes.rows.length === 0) throw new Error('Guild not found');
        
        const count = (await client.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [body.guildId])).rows[0].count;
        if (count >= guildRes.rows[0].max_members) throw new Error('Guild is full');
        
        await client.query(`
            INSERT INTO guild_members (guild_id, user_id, role) 
            VALUES ($1, $2, 'RECRUIT')
        `, [body.guildId, userId]);
        
        await client.query('DELETE FROM messages WHERE id = $1', [messageId]);
        
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

router.post('/reject-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    try {
        await pool.query('DELETE FROM messages WHERE id = $1 AND recipient_id = $2', [messageId, req.user.id]);
        res.sendStatus(200);
    } catch(e) {
        res.status(500).json({message: 'Error'});
    }
});

// POST /api/guilds/manage-member
router.post('/manage-member', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, action } = req.body; // kick, promote, demote
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const actorRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (actorRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id, role } = actorRes.rows[0];
        
        const targetRes = await client.query('SELECT role FROM guild_members WHERE user_id = $1 AND guild_id = $2', [targetUserId, guild_id]);
        if (targetRes.rows.length === 0) throw new Error('Target not in guild');
        const targetRole = targetRes.rows[0].role;
        
        if (action === 'kick') {
            if (role === 'LEADER' || (role === 'OFFICER' && (targetRole === 'MEMBER' || targetRole === 'RECRUIT'))) {
                await client.query('DELETE FROM guild_members WHERE user_id = $1 AND guild_id = $2', [targetUserId, guild_id]);
            } else {
                throw new Error('Insufficient permissions');
            }
        } else if (action === 'promote') {
            if (role !== 'LEADER') throw new Error('Only leader can promote');
            let newRole = 'MEMBER';
            if (targetRole === 'RECRUIT') newRole = 'MEMBER';
            else if (targetRole === 'MEMBER') newRole = 'OFFICER';
            else throw new Error('Max rank reached');
            
            await client.query('UPDATE guild_members SET role = $1 WHERE user_id = $2 AND guild_id = $3', [newRole, targetUserId, guild_id]);
        } else if (action === 'demote') {
            if (role !== 'LEADER') throw new Error('Only leader can demote');
            let newRole = 'MEMBER';
            if (targetRole === 'OFFICER') newRole = 'MEMBER';
            else if (targetRole === 'MEMBER') newRole = 'RECRUIT';
            else throw new Error('Min rank reached');
            
            await client.query('UPDATE guild_members SET role = $1 WHERE user_id = $2 AND guild_id = $3', [newRole, targetUserId, guild_id]);
        }
        
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/bank
router.post('/bank', authenticateToken, async (req: any, res: any) => {
    const { type, currency, amount } = req.body;
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id, role } = memberRes.rows[0];
        
        if (type === 'WITHDRAW' && role !== 'LEADER' && role !== 'OFFICER') throw new Error('No permission to withdraw');
        
        // Lock guild and char
        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        const guildResources = guildRes.rows[0].resources;
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char = charRes.rows[0].data;
        
        if (type === 'DEPOSIT') {
            if ((char.resources[currency] || 0) < amount) throw new Error('Not enough resources');
            char.resources[currency] -= amount;
            guildResources[currency] = (guildResources[currency] || 0) + amount;
        } else {
            if ((guildResources[currency] || 0) < amount) throw new Error('Not enough guild resources');
            guildResources[currency] -= amount;
            char.resources[currency] = (char.resources[currency] || 0) + amount;
        }
        
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [guildResources, guild_id]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        
        await client.query(`
            INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount)
            VALUES ($1, $2, $3, $4, $5)
        `, [guild_id, userId, type, currency, amount]);
        
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// GET /api/guilds/armory
router.get('/armory', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) return res.status(400).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        const armoryItemsRes = await pool.query(`
            SELECT gai.id, gai.item_data as item, gai.owner_id as "ownerId", u.username as "ownerName", gai.created_at as "depositedAt"
            FROM guild_armory_items gai
            JOIN users u ON gai.owner_id = u.id
            WHERE gai.guild_id = $1
        `, [guildId]);

        // Find borrowed items by scanning all guild members' inventory
        // This is a bit heavy, in prod we'd track borrowed items in a separate table or flag.
        // For now we scan char data.
        const borrowedItemsRes = await pool.query(`
            SELECT c.user_id, u.username, c.data->'inventory' as inventory
            FROM guild_members gm
            JOIN characters c ON gm.user_id = c.user_id
            JOIN users u ON c.user_id = u.id
            WHERE gm.guild_id = $1
        `, [guildId]);

        const borrowedItems: any[] = [];
        for (const row of borrowedItemsRes.rows) {
            const inv = row.inventory as ItemInstance[];
            if (inv) {
                inv.forEach(item => {
                    if (item.isBorrowed && item.borrowedFromGuildId === guildId) {
                        borrowedItems.push({
                            id: 0, // Placeholder
                            item: item,
                            ownerId: item.originalOwnerId,
                            ownerName: item.originalOwnerName,
                            depositedAt: '',
                            borrowedBy: row.username,
                            userId: row.user_id // Holder ID
                        });
                    }
                });
            }
        }

        res.json({
            armoryItems: armoryItemsRes.rows,
            borrowedItems: borrowedItems
        });

    } catch (e: any) {
        res.status(500).json({ message: 'Error fetching armory' });
    }
});

// POST /api/guilds/armory/deposit
router.post('/armory/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char: PlayerCharacter = charRes.rows[0].data;

        const itemIndex = char.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) throw new Error('Item not found');
        const item = char.inventory[itemIndex];
        
        if (item.isBorrowed) throw new Error('Cannot deposit borrowed item');

        char.inventory.splice(itemIndex, 1);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        
        await client.query(`
            INSERT INTO guild_armory_items (guild_id, owner_id, item_data)
            VALUES ($1, $2, $3)
        `, [guildId, userId, item]);

        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/armory/borrow
router.post('/armory/borrow', authenticateToken, async (req: any, res: any) => {
    const { armoryId } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify guild
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;

        // Get armory item
        const itemRes = await client.query('SELECT * FROM guild_armory_items WHERE id = $1 AND guild_id = $2 FOR UPDATE', [armoryId, guildId]);
        if (itemRes.rows.length === 0) throw new Error('Item not available');
        
        const armoryEntry = itemRes.rows[0];
        const item: ItemInstance = armoryEntry.item_data;
        const originalOwnerId = armoryEntry.owner_id;

        // Get character
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char: PlayerCharacter = charRes.rows[0].data;

        // Check backpack space
        if (char.inventory.length >= getBackpackCapacity(char)) throw new Error('Backpack full');

        // Calculate Tax
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates: ItemTemplate[] = gameDataRes.rows[0].data;
        const template = templates.find((t: any) => t.id === item.templateId);
        
        let value = template ? (Number(template.value) || 0) : 0;
        // Simplified value calculation (ignoring affixes for tax base to keep it simple, or query affixes if needed)
        // Let's assume tax is based on base template value for robustness or fetch affixes if precise
        
        const tax = Math.ceil(value * 0.3); // Updated to 30%
        if (char.resources.gold < tax) throw new Error(`Not enough gold for tax (${tax})`);

        // Get owner name for metadata
        const ownerRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [originalOwnerId]);
        const ownerName = ownerRes.rows[0]?.name || 'Unknown';

        // Modify item
        item.isBorrowed = true;
        item.borrowedFromGuildId = guildId;
        item.originalOwnerId = originalOwnerId;
        item.originalOwnerName = ownerName;

        // Transaction
        char.resources.gold -= tax;
        char.inventory.push(item);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        await client.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);
        
        // Add tax to guild bank
        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const resources = guildRes.rows[0].resources;
        resources.gold += tax;
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [resources, guildId]);
        
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'DEPOSIT', 'gold', $3)`, [guildId, userId, tax]);

        await client.query('COMMIT');
        res.json({ message: 'Item borrowed', taxPaid: tax });

    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/armory/recall (For Leader/Officer to force return item)
router.post('/armory/recall', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, itemUniqueId } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const actorRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (actorRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id, role } = actorRes.rows[0];
        
        if (role !== 'LEADER' && role !== 'OFFICER' && userId !== targetUserId) throw new Error('No permission');

        // Get target character
        const targetCharRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [targetUserId]);
        if (targetCharRes.rows.length === 0) throw new Error('Character not found');
        const targetChar: PlayerCharacter = targetCharRes.rows[0].data;

        // Find item
        const itemIndex = targetChar.inventory.findIndex(i => i.uniqueId === itemUniqueId && i.isBorrowed && i.borrowedFromGuildId === guild_id);
        if (itemIndex === -1) throw new Error('Borrowed item not found on user');
        
        const item = targetChar.inventory[itemIndex];
        
        // Remove from user
        targetChar.inventory.splice(itemIndex, 1);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [targetChar, targetUserId]);

        // Clean item metadata
        item.isBorrowed = false;
        const ownerId = item.originalOwnerId!; // Should exist
        delete item.borrowedFromGuildId;
        delete item.originalOwnerId;
        delete item.originalOwnerName;

        // Return to Armory
        await client.query(`
            INSERT INTO guild_armory_items (guild_id, owner_id, item_data)
            VALUES ($1, $2, $3)
        `, [guild_id, ownerId, item]);

        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/update
router.post('/update', authenticateToken, async (req: any, res: any) => {
    const { description, crestUrl, minLevel, isPublic } = req.body;
    const userId = req.user.id;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id, role } = memberRes.rows[0];
        if (role !== 'LEADER' && role !== 'OFFICER') throw new Error('No permission');
        
        await pool.query('UPDATE guilds SET description=$1, crest_url=$2, min_level=$3, is_public=$4 WHERE id=$5', [description, crestUrl, minLevel, isPublic, guild_id]);
        res.sendStatus(200);
    } catch (e: any) {
        res.status(400).json({ message: e.message });
    }
});

export default router;
