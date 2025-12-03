
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { Guild, GuildMember, GuildRole, PlayerCharacter, GuildTransaction, EssenceType, GuildInviteBody, GuildArmoryItem, ItemTemplate, ItemInstance, Affix, PublicGuildProfile } from '../types.js';
import { getBackpackCapacity } from '../logic/helpers.js';
import { canManage, getBuildingCost } from '../logic/guilds.js';

const router = express.Router();

// GET /api/guilds/my-guild - Get current user's guild data with detailed members
router.get('/my-guild', authenticateToken, async (req: any, res: any) => {
    try {
        // Get user's guild membership
        const membershipRes = await pool.query(
            `SELECT guild_id, role FROM guild_members WHERE user_id = $1`,
            [req.user.id]
        );

        if (membershipRes.rows.length === 0) {
            return res.json(null); // Not in a guild
        }

        const guildId = membershipRes.rows[0].guild_id;
        const myRole = membershipRes.rows[0].role;

        // Fetch Guild Info
        const guildRes = await pool.query(`SELECT * FROM guilds WHERE id = $1`, [guildId]);
        const guildData = guildRes.rows[0];

        // Fetch Members with Character Info
        const membersRes = await pool.query(`
            SELECT gm.user_id, gm.role, gm.joined_at, c.data->>'name' as name, c.data->>'level' as level, c.data->>'race' as race, c.data->>'characterClass' as "characterClass",
            EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
            FROM guild_members gm
            JOIN characters c ON gm.user_id = c.user_id
            WHERE gm.guild_id = $1
            ORDER BY 
                CASE gm.role WHEN 'LEADER' THEN 1 WHEN 'OFFICER' THEN 2 WHEN 'MEMBER' THEN 3 ELSE 4 END ASC,
                gm.joined_at ASC
        `, [guildId]);

        const members: GuildMember[] = membersRes.rows.map(row => ({
            userId: row.user_id,
            role: row.role,
            joinedAt: row.joined_at,
            name: row.name,
            level: parseInt(row.level),
            race: row.race,
            characterClass: row.characterClass,
            isOnline: row.isOnline
        }));

        // Fetch Bank History
        const historyRes = await pool.query(`
            SELECT gbh.*, c.data->>'name' as character_name
            FROM guild_bank_history gbh
            LEFT JOIN characters c ON gbh.user_id = c.user_id
            WHERE gbh.guild_id = $1
            ORDER BY gbh.created_at DESC LIMIT 100
        `, [guildId]);

        const transactions: GuildTransaction[] = historyRes.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            characterName: row.character_name || 'Unknown',
            type: row.type,
            currency: row.currency,
            amount: row.amount,
            timestamp: row.created_at
        }));
        
        // Fetch Chat History (last 50)
        const chatRes = await pool.query(`
            SELECT gc.*, c.data->>'name' as name, gm.role
            FROM guild_chat gc
            JOIN characters c ON gc.user_id = c.user_id
            JOIN guild_members gm ON gc.user_id = gm.user_id AND gm.guild_id = gc.guild_id
            WHERE gc.guild_id = $1
            ORDER BY gc.created_at ASC LIMIT 50
        `, [guildId]);
        
        const chatHistory = chatRes.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            characterName: row.name,
            role: row.role,
            content: row.content,
            timestamp: row.created_at
        }));

        // Robust merging of buildings to ensure new types (like scoutHouse, shrine) are present even if DB JSON is old
        const defaultBuildings = { headquarters: 0, armory: 0, barracks: 0, scoutHouse: 0, shrine: 0 };
        const mergedBuildings = { ...defaultBuildings, ...(guildData.buildings || {}) };

        const guild: Guild & { members: GuildMember[], transactions: GuildTransaction[], myRole: GuildRole, chatHistory: any[] } = {
            id: guildData.id,
            name: guildData.name,
            tag: guildData.tag,
            leaderId: guildData.leader_id,
            description: guildData.description,
            crestUrl: guildData.crest_url,
            resources: guildData.resources,
            memberCount: members.length,
            maxMembers: guildData.max_members,
            createdAt: guildData.created_at,
            isPublic: guildData.is_public,
            minLevel: guildData.min_level,
            rentalTax: guildData.rental_tax || 10,
            buildings: mergedBuildings,
            members,
            transactions,
            myRole,
            chatHistory
        };

        res.json(guild);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch guild info' });
    }
});

// GET /api/guilds/profile/:id - Get public guild profile
router.get('/profile/:id', authenticateToken, async (req: any, res: any) => {
    const guildId = req.params.id;
    try {
        const result = await pool.query(`
            SELECT 
                g.name, g.tag, g.description, g.crest_url, g.created_at, g.is_public, g.min_level, g.max_members,
                c.data->>'name' as leader_name,
                (SELECT COUNT(*) FROM guild_members WHERE guild_id = g.id) as member_count,
                (SELECT SUM((c2.data->>'level')::int) FROM guild_members gm2 JOIN characters c2 ON gm2.user_id = c2.user_id WHERE gm2.guild_id = g.id) as total_level
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            WHERE g.id = $1
        `, [guildId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Guild not found' });
        }

        const row = result.rows[0];
        const profile: PublicGuildProfile = {
            name: row.name,
            tag: row.tag,
            leaderName: row.leader_name,
            description: row.description,
            crestUrl: row.crest_url,
            memberCount: parseInt(row.member_count),
            maxMembers: row.max_members,
            totalLevel: parseInt(row.total_level) || 0,
            createdAt: row.created_at,
            isPublic: row.is_public,
            minLevel: row.min_level
        };

        res.json(profile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch guild profile' });
    }
});

// GET /api/guilds/armory - Get items in guild armory
router.get('/armory', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        // Fetch items physically in armory
        const itemsRes = await pool.query(`
            SELECT gai.*, c.data->>'name' as owner_name 
            FROM guild_armory_items gai
            JOIN characters c ON gai.owner_id = c.user_id
            WHERE gai.guild_id = $1
        `, [guildId]);

        const armoryItems: GuildArmoryItem[] = itemsRes.rows.map(row => ({
            id: row.id,
            item: row.item_data,
            ownerId: row.owner_id,
            ownerName: row.owner_name,
            depositedAt: row.created_at
        }));

        // Fetch borrowed items (scan all guild members characters)
        const guildMembersRes = await pool.query('SELECT user_id FROM guild_members WHERE guild_id = $1', [guildId]);
        const userIds = guildMembersRes.rows.map(r => r.user_id);
        
        const borrowedItems: GuildArmoryItem[] = [];
        
        if (userIds.length > 0) {
            const charsRes = await pool.query(`SELECT user_id, data FROM characters WHERE user_id = ANY($1)`, [userIds]);
            
            charsRes.rows.forEach(row => {
                const char: PlayerCharacter = row.data;
                const borrowerName = char.name;
                
                // Helper to check item
                const checkItem = (item: ItemInstance | null | undefined, location: string) => {
                    if (item && item.isBorrowed && item.borrowedFromGuildId === guildId) {
                        borrowedItems.push({
                            id: 0, // Virtual ID, not in armory table
                            item: item,
                            ownerId: item.originalOwnerId!,
                            ownerName: item.originalOwnerName || 'Unknown',
                            depositedAt: item.borrowedAt ? new Date(item.borrowedAt).toISOString() : '', // Map borrowedAt to depositedAt for display
                            borrowedBy: borrowerName,
                            userId: row.user_id
                        });
                    }
                };

                char.inventory.forEach(i => checkItem(i, 'inventory'));
                Object.values(char.equipment).forEach(i => checkItem(i, 'equipment'));
            });
        }

        res.json({ armoryItems, borrowedItems });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch armory' });
    }
});

// POST /api/guilds/armory/deposit
router.post('/armory/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Verify guild
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;

        // Check armory capacity
        const guildRes = await client.query('SELECT buildings FROM guilds WHERE id = $1', [guildId]);
        const buildings = guildRes.rows[0].buildings || { armory: 0 };
        const armoryLevel = buildings.armory || 0;
        const maxCapacity = 10 + armoryLevel;
        
        const currentCountRes = await client.query('SELECT COUNT(*) FROM guild_armory_items WHERE guild_id = $1', [guildId]);
        if (parseInt(currentCountRes.rows[0].count) >= maxCapacity) {
            throw new Error('Armory is full');
        }

        // Lock character
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char: PlayerCharacter = charRes.rows[0].data;

        // Find item in inventory
        const itemIndex = char.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) throw new Error('Item not found in inventory');
        
        const item = char.inventory[itemIndex];
        if (item.isBorrowed) throw new Error('Cannot deposit a borrowed item');

        // Remove from inventory
        char.inventory.splice(itemIndex, 1);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);

        // Add to armory
        await client.query(
            `INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`,
            [guildId, userId, JSON.stringify(item)]
        );

        await client.query('COMMIT');
        res.json({ message: 'Item deposited' });

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

        // Calculate Tax based on Guild Settings
        const guildRes = await client.query('SELECT resources, rental_tax FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const resources = guildRes.rows[0].resources;
        const rentalTaxRate = guildRes.rows[0].rental_tax || 10;

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const templates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        const template = templates.find((t: any) => t.id === item.templateId);
        
        let value = template ? (Number(template.value) || 0) : 0;
        
        // Add Affix Values
        if (item.prefixId) {
            const prefix = affixes.find(a => a.id === item.prefixId);
            if (prefix) value += (Number(prefix.value) || 0);
        }
        if (item.suffixId) {
            const suffix = affixes.find(a => a.id === item.suffixId);
            if (suffix) value += (Number(suffix.value) || 0);
        }

        const tax = Math.ceil(value * (rentalTaxRate / 100));
        
        if (char.resources.gold < tax) throw new Error(`Not enough gold for tax (${tax})`);

        // Get owner name for metadata
        const ownerRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [originalOwnerId]);
        const ownerName = ownerRes.rows[0]?.name || 'Unknown';

        // Modify item
        item.isBorrowed = true;
        item.borrowedFromGuildId = guildId;
        item.originalOwnerId = originalOwnerId;
        item.originalOwnerName = ownerName;
        item.borrowedAt = Date.now(); // Set borrowed timestamp

        // Transaction
        char.resources.gold -= tax;
        char.inventory.push(item);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        await client.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);
        
        // Add tax to guild bank
        resources.gold += tax;
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [resources, guildId]);
        
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'RENTAL', 'gold', $3)`, [guildId, userId, tax]);

        await client.query('COMMIT');
        res.json({ message: 'Item borrowed', taxPaid: tax });

    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/armory/recall
router.post('/armory/recall', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, itemUniqueId } = req.body;
    const requesterId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check requester role
        const requesterRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [requesterId]);
        if (requesterRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id, role } = requesterRes.rows[0];

        // Check target character
        const targetRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [targetUserId]);
        if (targetRes.rows.length === 0) throw new Error('Target not found');
        const targetChar: PlayerCharacter = targetRes.rows[0].data;

        // Find item on target
        let itemIndex = -1;
        let location = 'inventory';
        let item: ItemInstance | null = null;

        // Check inventory
        itemIndex = targetChar.inventory.findIndex(i => i.uniqueId === itemUniqueId);
        if (itemIndex > -1) {
            item = targetChar.inventory[itemIndex];
        } else {
            // Check equipment
            for (const slot in targetChar.equipment) {
                const eqItem = (targetChar.equipment as any)[slot];
                if (eqItem && eqItem.uniqueId === itemUniqueId) {
                    item = eqItem;
                    location = slot;
                    break;
                }
            }
        }

        if (!item) throw new Error('Item not found on player');
        if (!item.isBorrowed || item.borrowedFromGuildId !== guild_id) throw new Error('Item is not borrowed from this guild');

        // Verify permissions: Must be owner OR Leader/Officer
        if (item.originalOwnerId !== requesterId && !canManage(role)) {
            throw new Error('No permission to recall this item');
        }

        // Remove from target
        if (location === 'inventory') {
            targetChar.inventory.splice(itemIndex, 1);
        } else {
            (targetChar.equipment as any)[location] = null;
        }
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [targetChar, targetUserId]);

        // Clean item data
        delete item.isBorrowed;
        delete item.borrowedFromGuildId;
        delete item.borrowedAt;
        const ownerId = item.originalOwnerId!;
        delete item.originalOwnerId;
        delete item.originalOwnerName;

        // Return to armory table
        await client.query(
            `INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`,
            [guild_id, ownerId, JSON.stringify(item)]
        );

        await client.query('COMMIT');
        res.json({ message: 'Item recalled to armory' });

    } catch (e: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
});

// DELETE /api/guilds/armory/:id
router.delete('/armory/:id', authenticateToken, async (req: any, res: any) => {
    const armoryId = req.params.id;
    const userId = req.user.id;

    try {
        // Verify guild and role
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        
        const { guild_id, role } = memberRes.rows[0];
        
        if (role !== GuildRole.LEADER) {
            return res.status(403).json({ message: 'Only Leader can delete items from armory' });
        }

        // Verify item belongs to this guild
        const itemRes = await pool.query('SELECT 1 FROM guild_armory_items WHERE id = $1 AND guild_id = $2', [armoryId, guild_id]);
        if (itemRes.rows.length === 0) {
            return res.status(404).json({ message: 'Item not found in your armory' });
        }

        await pool.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);
        res.json({ message: 'Item deleted' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to delete item' });
    }
});

// GET /api/guilds/list - List public guilds for browsing
router.get('/list', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.id, g.name, g.tag, g.max_members, g.min_level, c.data->>'name' as leader_name
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            WHERE g.is_public = TRUE
            LIMIT 20
        `);
        
        const guilds = await Promise.all(result.rows.map(async (row) => {
            const countRes = await pool.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [row.id]);
            return { ...row, member_count: parseInt(countRes.rows[0].count) };
        }));

        const availableGuilds = guilds.filter(g => g.member_count < g.max_members);

        res.json(availableGuilds);
    } catch (err) {
        res.status(500).json({ message: 'Failed to list guilds' });
    }
});

// POST /api/guilds/create
router.post('/create', authenticateToken, async (req: any, res: any) => {
    const { name, tag, description } = req.body;
    const userId = req.user.id;
    const COST = 1000;

    if (!name || !tag) return res.status(400).json({ message: 'Name and Tag required' });
    if (tag.length > 5) return res.status(400).json({ message: 'Tag too long (max 5)' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if user is already in guild
        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [userId]);
        if (memberCheck.rows.length > 0) return res.status(400).json({ message: 'You are already in a guild' });

        // Check Gold
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char: PlayerCharacter = charRes.rows[0].data;
        if (char.resources.gold < COST) return res.status(400).json({ message: 'Not enough gold' });

        // Deduct Gold
        char.resources.gold -= COST;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);

        // Create Guild with full default buildings, explicitly including scoutHouse and shrine
        const defaultBuildings = { headquarters: 0, armory: 0, barracks: 0, scoutHouse: 0, shrine: 0 };
        const createRes = await client.query(
            `INSERT INTO guilds (name, tag, leader_id, description, buildings) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [name, tag, userId, description || '', JSON.stringify(defaultBuildings)]
        );
        const guildId = createRes.rows[0].id;

        // Add Member as Leader
        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'LEADER')`,
            [guildId, userId]
        );
        
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, userId]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Guild created', guildId });

    } catch (err: any) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(409).json({ message: 'Name or Tag already taken' });
        res.status(500).json({ message: 'Failed to create guild' });
    } finally {
        client.release();
    }
});

// POST /api/guilds/update - Update description and crest
router.post('/update', authenticateToken, async (req: any, res: any) => {
    const { description, crestUrl, minLevel, isPublic, rentalTax } = req.body;
    const userId = req.user.id;

    try {
        // Check permissions (Only Leader)
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        
        const { guild_id, role } = memberRes.rows[0];
        if (role !== GuildRole.LEADER) return res.status(403).json({ message: 'Only leader can update settings' });

        // Build dynamic update query
        const fields = [];
        const values = [];
        let index = 1;

        if (description !== undefined) {
            fields.push(`description = $${index++}`);
            values.push(description);
        }
        if (crestUrl !== undefined) {
            fields.push(`crest_url = $${index++}`);
            values.push(crestUrl);
        }
        if (minLevel !== undefined) {
            fields.push(`min_level = $${index++}`);
            values.push(minLevel);
        }
        if (isPublic !== undefined) {
            fields.push(`is_public = $${index++}`);
            values.push(isPublic);
        }
        if (rentalTax !== undefined) {
            const tax = parseInt(rentalTax);
            if(tax < 0 || tax > 50) return res.status(400).json({ message: 'Tax must be between 0 and 50%'});
            fields.push(`rental_tax = $${index++}`);
            values.push(tax);
        }

        if (fields.length > 0) {
            values.push(guild_id);
            await pool.query(
                `UPDATE guilds SET ${fields.join(', ')} WHERE id = $${index}`,
                values
            );
        }

        res.json({ message: 'Guild updated' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update guild' });
    }
});

// POST /api/guilds/invite
router.post('/invite', authenticateToken, async (req: any, res: any) => {
    const { characterName } = req.body;
    const userId = req.user.id;

    try {
        // Check permissions
        const senderRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (senderRes.rows.length === 0 || !canManage(senderRes.rows[0].role)) {
            return res.status(403).json({ message: 'No permission' });
        }
        const guildId = senderRes.rows[0].guild_id;

        // Find recipient
        const targetRes = await pool.query("SELECT user_id FROM characters WHERE data->>'name' = $1", [characterName]);
        if (targetRes.rows.length === 0) return res.status(404).json({ message: 'Player not found' });
        const targetId = targetRes.rows[0].user_id;

        // Check if target is in guild
        const inGuildCheck = await pool.query('SELECT 1 FROM guild_members WHERE user_id = $1', [targetId]);
        if (inGuildCheck.rows.length > 0) return res.status(400).json({ message: 'Player is already in a guild' });

        // Send Message Invite
        const guildRes = await pool.query('SELECT name FROM guilds WHERE id = $1', [guildId]);
        const guildName = guildRes.rows[0].name;

        const inviteBody: GuildInviteBody = { guildId, guildName };
        
        await pool.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) 
             VALUES ($1, $2, 'guild_invite', $3, $4)`,
            [targetId, 'System', `Zaproszenie do gildii: ${guildName}`, JSON.stringify(inviteBody)]
        );

        res.json({ message: 'Invite sent' });

    } catch (err) {
        res.status(500).json({ message: 'Error sending invite' });
    }
});

// POST /api/guilds/accept-invite
router.post('/accept-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch Message
        const msgRes = await client.query(
            `SELECT body, recipient_id FROM messages WHERE id = $1`,
            [messageId]
        );

        if (msgRes.rows.length === 0) return res.status(404).json({ message: 'Message not found' });
        if (msgRes.rows[0].recipient_id !== userId) return res.status(403).json({ message: 'Not your message' });

        const body = msgRes.rows[0].body as GuildInviteBody;
        if (!body.guildId) return res.status(400).json({ message: 'Invalid invite' });

        // 2. Check if user is already in a guild
        const inGuildCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [userId]);
        if (inGuildCheck.rows.length > 0) return res.status(400).json({ message: 'You are already in a guild' });

        // 3. Check guild capacity
        const guildRes = await client.query('SELECT max_members, (SELECT COUNT(*) FROM guild_members WHERE guild_id = $1) as count FROM guilds WHERE id = $1 FOR UPDATE', [body.guildId]);
        if (guildRes.rows.length === 0) return res.status(404).json({ message: 'Guild no longer exists' });
        
        if (parseInt(guildRes.rows[0].count) >= guildRes.rows[0].max_members) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Guild is full' });
        }

        // 4. Add member
        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'MEMBER')`,
            [body.guildId, userId]
        );
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [body.guildId, userId]);

        // 5. Delete Message
        await client.query('DELETE FROM messages WHERE id = $1', [messageId]);

        await client.query('COMMIT');
        res.json({ message: 'Joined guild successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to join guild' });
    } finally {
        client.release();
    }
});

// POST /api/guilds/reject-invite
router.post('/reject-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    const userId = req.user.id;

    try {
        await pool.query(
            `DELETE FROM messages WHERE id = $1 AND recipient_id = $2`,
            [messageId, userId]
        );
        res.json({ message: 'Invite rejected' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to reject invite' });
    }
});

// POST /api/guilds/join/:guildId
router.post('/join/:guildId', authenticateToken, async (req: any, res: any) => {
    const guildId = parseInt(req.params.guildId);
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if already in guild
        const inGuild = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [userId]);
        if (inGuild.rows.length > 0) return res.status(400).json({ message: 'Already in a guild' });

        // Check guild capacity and restrictions
        const guildRes = await client.query('SELECT max_members, min_level, is_public, (SELECT COUNT(*) FROM guild_members WHERE guild_id = $1) as count FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) return res.status(404).json({ message: 'Guild not found' });
        
        const guildInfo = guildRes.rows[0];

        if (!guildInfo.is_public) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'This guild is closed for recruitment.' });
        }

        if (parseInt(guildInfo.count) >= guildInfo.max_members) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Guild is full' });
        }

        // Check level requirement
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        const charLevel = charRes.rows[0].data.level || 1;
        
        if (charLevel < guildInfo.min_level) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Level ${guildInfo.min_level} required to join.` });
        }

        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'RECRUIT')`,
            [guildId, userId]
        );
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, userId]);

        await client.query('COMMIT');
        res.json({ message: 'Joined guild' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to join' });
    } finally {
        client.release();
    }
});

// POST /api/guilds/leave
router.post('/leave', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    try {
        const memRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memRes.rows.length === 0) return res.status(400).json({ message: 'Not in a guild' });
        
        if (memRes.rows[0].role === GuildRole.LEADER) {
            // Check if last member
            const countRes = await pool.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [memRes.rows[0].guild_id]);
            if (parseInt(countRes.rows[0].count) > 1) {
                return res.status(400).json({ message: 'Leader cannot leave if there are other members. Transfer leadership or disband.' });
            } else {
                // Delete guild
                await pool.query('DELETE FROM guilds WHERE id = $1', [memRes.rows[0].guild_id]);
                await pool.query('UPDATE characters SET guild_id = NULL WHERE user_id = $1', [userId]);
                return res.json({ message: 'Guild disbanded' });
            }
        }

        await pool.query('DELETE FROM guild_members WHERE user_id = $1', [userId]);
        await pool.query('UPDATE characters SET guild_id = NULL WHERE user_id = $1', [userId]);
        res.json({ message: 'Left guild' });

    } catch (err) {
        res.status(500).json({ message: 'Failed to leave' });
    }
});

// POST /api/guilds/manage-member
router.post('/manage-member', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, action } = req.body; // action: 'kick' | 'promote' | 'demote'
    const userId = req.user.id;

    try {
        // Auth check
        const senderRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (senderRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        
        const guildId = senderRes.rows[0].guild_id;
        const senderRole = senderRes.rows[0].role;

        const targetRes = await pool.query('SELECT role FROM guild_members WHERE user_id = $1 AND guild_id = $2', [targetUserId, guildId]);
        if (targetRes.rows.length === 0) return res.status(404).json({ message: 'Target not in guild' });
        const targetRole = targetRes.rows[0].role;

        if (!canManage(senderRole)) return res.status(403).json({ message: 'No permission' });
        
        // Officers can't manage Leaders or other Officers
        if (senderRole === GuildRole.OFFICER && (targetRole === GuildRole.LEADER || targetRole === GuildRole.OFFICER)) {
            return res.status(403).json({ message: 'Insufficient rank' });
        }

        if (action === 'kick') {
            await pool.query('DELETE FROM guild_members WHERE user_id = $1', [targetUserId]);
            await pool.query('UPDATE characters SET guild_id = NULL WHERE user_id = $1', [targetUserId]);
        } else if (action === 'promote') {
            if (targetRole === GuildRole.RECRUIT) {
                await pool.query("UPDATE guild_members SET role = 'MEMBER' WHERE user_id = $1", [targetUserId]);
            } else if (targetRole === GuildRole.MEMBER && senderRole === GuildRole.LEADER) {
                await pool.query("UPDATE guild_members SET role = 'OFFICER' WHERE user_id = $1", [targetUserId]);
            }
        } else if (action === 'demote') {
             if (targetRole === GuildRole.MEMBER) {
                await pool.query("UPDATE guild_members SET role = 'RECRUIT' WHERE user_id = $1", [targetUserId]);
            } else if (targetRole === GuildRole.OFFICER && senderRole === GuildRole.LEADER) {
                await pool.query("UPDATE guild_members SET role = 'MEMBER' WHERE user_id = $1", [targetUserId]);
            }
        }

        res.sendStatus(200);

    } catch (err) {
        res.status(500).json({ message: 'Action failed' });
    }
});

// POST /api/guilds/bank
router.post('/bank', authenticateToken, async (req: any, res: any) => {
    const { type, currency, amount } = req.body; // type: 'DEPOSIT' (WITHDRAW disabled)
    const userId = req.user.id;
    const amountInt = parseInt(amount);

    if (amountInt <= 0) return res.status(400).json({ message: 'Invalid amount' });
    
    // Prevent withdrawals
    if (type !== 'DEPOSIT') {
        return res.status(403).json({ message: 'Withdrawals are disabled' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check user
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const { guild_id } = memberRes.rows[0];

        // Lock Character and Guild
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        let char: PlayerCharacter = charRes.rows[0].data;
        
        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        let guildResources = guildRes.rows[0].resources;

        // Perform Transaction (Only Deposit)
        if (currency === 'gold') {
            if (char.resources.gold < amountInt) return res.status(400).json({ message: 'Not enough gold' });
            char.resources.gold -= amountInt;
            guildResources.gold = (guildResources.gold || 0) + amountInt;
        } else {
            // Essence
            if ((char.resources[currency as EssenceType] || 0) < amountInt) return res.status(400).json({ message: 'Not enough essence' });
            (char.resources[currency as EssenceType] as number) -= amountInt;
            guildResources[currency] = (guildResources[currency] || 0) + amountInt;
        }

        // Save Updates
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [guildResources, guild_id]);

        // Log Transaction
        await client.query(
            `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, $3, $4, $5)`,
            [guild_id, userId, type, currency, amountInt]
        );

        await client.query('COMMIT');
        res.json({ character: char, guildResources });

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
    const { buildingType } = req.body; // e.g., 'headquarters', 'armory', 'barracks', 'scoutHouse', 'shrine'
    const userId = req.user.id;

    if (buildingType !== 'headquarters' && buildingType !== 'armory' && buildingType !== 'barracks' && buildingType !== 'scoutHouse' && buildingType !== 'shrine') return res.status(400).json({ message: 'Invalid building type' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check user role
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const { guild_id, role } = memberRes.rows[0];

        if (!canManage(role)) return res.status(403).json({ message: 'Only leaders and officers can upgrade buildings' });

        // Lock Guild
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        const guild = guildRes.rows[0];
        
        // Robustly initialize default buildings including new ones like scoutHouse and shrine
        let buildings = { headquarters: 0, armory: 0, barracks: 0, scoutHouse: 0, shrine: 0, ...(guild.buildings || {}) };
        
        const currentLevel = buildings[buildingType] || 0;

        // Max Level Check for Barracks
        if (buildingType === 'barracks' && currentLevel >= 5) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Building is at maximum level.' });
        }
        
        // Max Level Check for Scout House
        if (buildingType === 'scoutHouse' && currentLevel >= 3) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Building is at maximum level.' });
        }
        
        // Max Level Check for Shrine
        if (buildingType === 'shrine' && currentLevel >= 5) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Building is at maximum level.' });
        }

        // Calculate Cost (Updated to return array of costs)
        const { gold, costs } = getBuildingCost(buildingType, currentLevel);

        // Check resources
        const currentGold = guild.resources.gold || 0;
        
        if (currentGold < gold) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold in guild bank' });
        }

        // Check all required essences
        for (const costItem of costs) {
            const currentEssence = guild.resources[costItem.type] || 0;
            if (currentEssence < costItem.amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough ${costItem.type} in guild bank` });
            }
        }

        // Deduct Resources
        guild.resources.gold -= gold;
        for (const costItem of costs) {
            guild.resources[costItem.type] -= costItem.amount;
        }

        // Level Up
        buildings[buildingType] = currentLevel + 1;

        // Apply Effect (Headquarters: +1 Member Slot)
        let maxMembers = guild.max_members;
        if (buildingType === 'headquarters') {
            maxMembers += 1;
        }

        // Save
        await client.query('UPDATE guilds SET resources = $1, buildings = $2, max_members = $3 WHERE id = $4', 
            [JSON.stringify(guild.resources), JSON.stringify(buildings), maxMembers, guild_id]);

        await client.query('COMMIT');
        res.json({ message: 'Building upgraded', buildings, resources: guild.resources, maxMembers });

    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Upgrade failed' });
    } finally {
        client.release();
    }
});

export default router;
