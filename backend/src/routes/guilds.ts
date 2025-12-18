
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage } from '../logic/guilds.js';
import { GuildRole, EssenceType } from '../types.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// ==========================================
//               CORE GUILD
// ==========================================

// GET /api/guilds/list
router.get('/list', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT id, name, tag, member_count, max_members, min_level, is_public, created_at 
            FROM guilds 
            ORDER BY member_count DESC, created_at ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching guilds' });
    }
});

// GET /api/guilds/my-guild
router.get('/my-guild', authenticateToken, async (req: any, res: any) => {
    try {
        // 1. Check membership
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.json(null); // Not in guild
        
        const { guild_id, role } = memberRes.rows[0];

        // 2. Get Guild Data
        const guildRes = await pool.query('SELECT * FROM guilds WHERE id = $1', [guild_id]);
        if (guildRes.rows.length === 0) return res.json(null);
        const guild = guildRes.rows[0];

        // 3. Get Members
        const membersRes = await pool.query(`
            SELECT gm.user_id, gm.role, gm.joined_at, c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race, c.data->>'characterClass' as "characterClass",
            EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
            FROM guild_members gm
            JOIN characters c ON gm.user_id = c.user_id
            WHERE gm.guild_id = $1
        `, [guild_id]);

        // 4. Get Transactions (Last 50)
        const transRes = await pool.query(`
            SELECT t.*, c.data->>'name' as "characterName"
            FROM guild_bank_history t
            LEFT JOIN characters c ON t.user_id = c.user_id
            WHERE t.guild_id = $1
            ORDER BY t.created_at DESC LIMIT 50
        `, [guild_id]);

        // 5. Get Chat (Last 50)
        const chatRes = await pool.query(`
            SELECT gc.*, c.data->>'name' as "characterName", gm.role
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
            chatHistory: chatRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching guild data' });
    }
});

// POST /api/guilds/create
router.post('/create', authenticateToken, async (req: any, res: any) => {
    const { name, tag, description } = req.body;
    if (!name || !tag) return res.status(400).json({ message: 'Name and Tag required' });
    if (tag.length > 5) return res.status(400).json({ message: 'Tag too long' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check if already in guild
        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You are already in a guild' });
        }

        // Check gold
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.resources.gold < 1000) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold (1000 required)' });
        }
        
        char.resources.gold -= 1000;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);

        // Create Guild
        const guildRes = await client.query(
            `INSERT INTO guilds (name, tag, description, leader_id) VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, tag, description, req.user.id]
        );
        const guildId = guildRes.rows[0].id;

        // Add Member
        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'LEADER')`,
            [guildId, req.user.id]
        );
        
        // Update char guild_id link
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, req.user.id]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Guild created' });
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
        
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) return res.status(404).json({ message: 'Guild not found' });
        const guild = guildRes.rows[0];

        if (!guild.is_public) return res.status(403).json({ message: 'Guild is closed' });
        if (guild.member_count >= guild.max_members) return res.status(403).json({ message: 'Guild is full' });

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char = charRes.rows[0].data;
        
        if (char.level < guild.min_level) return res.status(403).json({ message: 'Level too low' });

        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberCheck.rows.length > 0) return res.status(400).json({ message: 'Already in a guild' });

        await client.query('INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, \'RECRUIT\')', [guildId, req.user.id]);
        await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guildId]);
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, req.user.id]);

        await client.query('COMMIT');
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
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(400).json({ message: 'Not in a guild' });
        
        const { guild_id, role } = memberRes.rows[0];
        
        if (role === 'LEADER') {
             // Check if only member
             const countRes = await client.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [guild_id]);
             if (parseInt(countRes.rows[0].count) > 1) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ message: 'Leader cannot leave if there are other members. Transfer leadership or disband.' });
             } else {
                 // Disband logic
                 await client.query('DELETE FROM guild_members WHERE guild_id = $1', [guild_id]);
                 await client.query('DELETE FROM guilds WHERE id = $1', [guild_id]);
             }
        } else {
            await client.query('DELETE FROM guild_members WHERE user_id = $1', [req.user.id]);
            await client.query('UPDATE guilds SET member_count = member_count - 1 WHERE id = $1', [guild_id]);
        }
        
        await client.query('UPDATE characters SET guild_id = NULL WHERE user_id = $1', [req.user.id]);

        await client.query('COMMIT');
        res.json({ message: 'Left guild' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/update (Settings)
router.post('/update', authenticateToken, async (req: any, res: any) => {
    const { description, crestUrl, minLevel, isPublic, rentalTax, huntingTax } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || memberRes.rows[0].role !== 'LEADER') return res.status(403).json({ message: 'Not authorized' });
        
        await pool.query(
            `UPDATE guilds SET description=$1, crest_url=$2, min_level=$3, is_public=$4, rental_tax=$5, hunting_tax=$6 WHERE id=$7`,
            [description, crestUrl, minLevel, isPublic, rentalTax, huntingTax, memberRes.rows[0].guild_id]
        );
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// POST /api/guilds/manage-member
router.post('/manage-member', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, action } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const actorRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (actorRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id, role: actorRole } = actorRes.rows[0];

        const targetRes = await client.query('SELECT role FROM guild_members WHERE user_id = $1 AND guild_id = $2 FOR UPDATE', [targetUserId, guild_id]);
        if (targetRes.rows.length === 0) throw new Error('Target not in guild');
        const targetRole = targetRes.rows[0].role;

        // Role hierarchy logic... simplified
        if (action === 'kick') {
            if (actorRole === 'MEMBER' || actorRole === 'RECRUIT') throw new Error('Cannot kick');
            if (actorRole === 'OFFICER' && targetRole !== 'MEMBER' && targetRole !== 'RECRUIT') throw new Error('Officer can only kick members/recruits');
            
            await client.query('DELETE FROM guild_members WHERE user_id = $1', [targetUserId]);
            await client.query('UPDATE guilds SET member_count = member_count - 1 WHERE id = $1', [guild_id]);
            await client.query('UPDATE characters SET guild_id = NULL WHERE user_id = $1', [targetUserId]);
        } else if (action === 'promote') {
            if (actorRole !== 'LEADER') throw new Error('Only leader can promote');
            if (targetRole === 'RECRUIT') await client.query("UPDATE guild_members SET role='MEMBER' WHERE user_id=$1", [targetUserId]);
            else if (targetRole === 'MEMBER') await client.query("UPDATE guild_members SET role='OFFICER' WHERE user_id=$1", [targetUserId]);
        } else if (action === 'demote') {
            if (actorRole !== 'LEADER') throw new Error('Only leader can demote');
            if (targetRole === 'OFFICER') await client.query("UPDATE guild_members SET role='MEMBER' WHERE user_id=$1", [targetUserId]);
            else if (targetRole === 'MEMBER') await client.query("UPDATE guild_members SET role='RECRUIT' WHERE user_id=$1", [targetUserId]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Success' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/upgrade-building
router.post('/upgrade-building', authenticateToken, async (req: any, res: any) => {
    const { buildingType } = req.body; // headquarters, armory, etc.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || !canManage(memberRes.rows[0].role)) throw new Error('Not authorized');
        const guildId = memberRes.rows[0].guild_id;

        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        const currentLevel = (guild.buildings || {})[buildingType] || 0;
        const nextLevel = currentLevel + 1;

        const { gold, costs } = getBuildingCost(buildingType, currentLevel);
        
        if (guild.resources.gold < gold) throw new Error('Not enough gold');
        for (const c of costs) {
            if ((guild.resources[c.type] || 0) < c.amount) throw new Error(`Not enough ${c.type}`);
        }

        // Deduct
        const resources = guild.resources;
        resources.gold -= gold;
        costs.forEach(c => resources[c.type] -= c.amount);

        // Update
        const buildings = guild.buildings || {};
        buildings[buildingType] = nextLevel;
        
        // Apply effects if needed
        if (buildingType === 'headquarters') {
            // Update max members
             await client.query('UPDATE guilds SET max_members = $1 WHERE id = $2', [10 + nextLevel, guildId]);
        }

        await client.query('UPDATE guilds SET resources = $1, buildings = $2 WHERE id = $3', [JSON.stringify(resources), JSON.stringify(buildings), guildId]);

        await client.query('COMMIT');
        res.json({ message: 'Upgraded' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               GUILD ARMORY
// ==========================================
router.get('/armory', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        const armoryRes = await pool.query(`
            SELECT ga.id, ga.item_data as item, ga.owner_id as "ownerId", c.data->>'name' as "ownerName", ga.created_at as "depositedAt"
            FROM guild_armory_items ga
            JOIN characters c ON ga.owner_id = c.user_id
            WHERE ga.guild_id = $1
            ORDER BY ga.created_at DESC
        `, [guildId]);
        
        // Also fetch currently borrowed items (items in players inventories with isBorrowed flag and guildId)
        // This is tricky as items are in JSON. We need to check all members inventories? No, that's slow.
        // We can query characters who are in the guild.
        const borrowedRes = await pool.query(`
            SELECT c.user_id as "userId", c.data->>'name' as "borrowedBy", item
            FROM characters c
            JOIN guild_members gm ON c.user_id = gm.user_id,
            jsonb_array_elements(c.data->'inventory') item
            WHERE gm.guild_id = $1 AND (item->>'isBorrowed')::boolean IS TRUE AND (item->>'borrowedFromGuildId')::int = $1
        `, [guildId]);
        
        const borrowedItems = borrowedRes.rows.map(row => ({
            ...row,
            item: row.item,
            ownerId: row.item.originalOwnerId,
            ownerName: row.item.originalOwnerName,
            depositedAt: row.item.borrowedAt ? new Date(row.item.borrowedAt).toISOString() : null
        }));

        res.json({ armoryItems: armoryRes.rows, borrowedItems });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching armory' });
    }
});

router.post('/armory/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;

        const guildRes = await client.query('SELECT buildings FROM guilds WHERE id = $1', [guildId]);
        const capacity = 10 + (guildRes.rows[0].buildings?.armory || 0);
        
        const countRes = await client.query('SELECT COUNT(*) FROM guild_armory_items WHERE guild_id = $1', [guildId]);
        if (parseInt(countRes.rows[0].count) >= capacity) throw new Error('Armory is full');

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;

        const itemIndex = char.inventory.findIndex((i: any) => i.uniqueId === itemId);
        if (itemIndex === -1) throw new Error('Item not found');
        const item = char.inventory[itemIndex];
        
        if (item.isBorrowed) throw new Error('Cannot deposit borrowed item');

        char.inventory.splice(itemIndex, 1);
        
        await client.query(
            `INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`,
            [guildId, req.user.id, JSON.stringify(item)]
        );
        
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'DEPOSIT', 'item', 1)`, [guildId, req.user.id]);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json({ message: 'Deposited' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

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
        if (itemRes.rows.length === 0) throw new Error('Item not found');
        
        const armoryEntry = itemRes.rows[0];
        const item = armoryEntry.item_data;
        const ownerRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [armoryEntry.owner_id]);
        const ownerName = ownerRes.rows[0]?.name || 'Unknown';

        // Calculate Tax
        const guildRes = await client.query('SELECT rental_tax, resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        
        // We need item value. Ideally stored on item or fetched from template. 
        // For simplicity, we fetch template.
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const template = gameDataRes.rows[0].data.find((t: any) => t.id === item.templateId);
        const value = template ? template.value : 100;
        const tax = Math.ceil(value * (guild.rental_tax / 100));

        if (char.resources.gold < tax) throw new Error('Not enough gold for rental tax');

        // Process Transaction
        char.resources.gold -= tax;
        guild.resources.gold = (guild.resources.gold || 0) + tax;
        
        // Add Borrow Flags
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

        await client.query('COMMIT');
        res.json({ message: 'Borrowed' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/armory/recall', authenticateToken, async (req: any, res: any) => {
    const { targetUserId, itemUniqueId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id, role } = memberRes.rows[0];
        
        // Only Leader/Officer can recall ANY item. 
        // Regular member can recall THEIR OWN item (handled by checking originalOwnerId on item)
        const isStaff = canManage(role);

        const targetCharRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [targetUserId]);
        if (targetCharRes.rows.length === 0) throw new Error('Target character not found');
        const targetChar = targetCharRes.rows[0].data;

        // Find item in inventory OR equipment
        let itemIndex = -1;
        let item = null;
        let location = 'inventory';
        let eqSlot = null;

        // Check Inventory
        itemIndex = targetChar.inventory.findIndex((i: any) => i.uniqueId === itemUniqueId);
        if (itemIndex > -1) {
            item = targetChar.inventory[itemIndex];
        } else {
            // Check Equipment
            for (const slot of Object.keys(targetChar.equipment)) {
                if (targetChar.equipment[slot]?.uniqueId === itemUniqueId) {
                    item = targetChar.equipment[slot];
                    location = 'equipment';
                    eqSlot = slot;
                    break;
                }
            }
        }

        if (!item) throw new Error('Item not found on player');
        if (!item.isBorrowed || item.borrowedFromGuildId !== guild_id) throw new Error('Item is not borrowed from your guild');
        
        if (!isStaff && item.originalOwnerId !== req.user.id) throw new Error('You can only recall your own items');

        // Remove from target
        if (location === 'inventory') {
            targetChar.inventory.splice(itemIndex, 1);
        } else {
            targetChar.equipment[eqSlot!] = null;
        }
        
        // Clean flags
        delete item.isBorrowed;
        delete item.borrowedFromGuildId;
        delete item.originalOwnerName; // Keep ID? Nah, clean for armory
        delete item.borrowedAt;
        
        // Return to Armory
        await client.query(
            `INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`,
            [guild_id, item.originalOwnerId, JSON.stringify(item)]
        );

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(targetChar), targetUserId]);
        
        // Notify Target
        await enforceInboxLimit(client, targetUserId);
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Gildia', 'system', 'Zwrot przedmiotu', $2)`,
            [targetUserId, JSON.stringify({ content: `Przedmiot został wymuszony do zwrotu do zbrojowni gildii.` })]
        );

        await client.query('COMMIT');
        res.json({ message: 'Recalled' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.delete('/armory/:id', authenticateToken, async (req: any, res: any) => {
    const id = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || !canManage(memberRes.rows[0].role)) throw new Error('Not authorized');
        
        await client.query('DELETE FROM guild_armory_items WHERE id = $1 AND guild_id = $2', [id, memberRes.rows[0].guild_id]);
        
        await client.query('COMMIT');
        res.json({ message: 'Deleted' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               GUILD BANK
// ==========================================
router.post('/bank', authenticateToken, async (req: any, res: any) => {
    const { type, currency, amount } = req.body; // type: DEPOSIT (for now)
    if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guildResources = guildRes.rows[0].resources;

        if (type === 'DEPOSIT') {
            if ((char.resources[currency] || 0) < amount) throw new Error('Not enough resources');
            char.resources[currency] -= amount;
            guildResources[currency] = (guildResources[currency] || 0) + amount;
        } else {
             throw new Error('Only deposits allowed manually');
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildResources), guildId]);
        
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, $3, $4, $5)`, [guildId, req.user.id, type, currency, amount]);

        await client.query('COMMIT');
        res.json({ message: 'Transaction successful' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               ALTAR
// ==========================================
router.post('/altar/sacrifice', authenticateToken, async (req: any, res: any) => {
    const { ritualId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;
        
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        const altarLevel = guild.buildings?.altar || 0;

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'rituals'");
        const rituals = gameDataRes.rows[0]?.data || [];
        const ritual = rituals.find((r: any) => r.id === ritualId);
        
        if (!ritual) throw new Error('Ritual not found');
        if (altarLevel < ritual.tier) throw new Error('Altar level too low');

        // Check active buffs
        const currentBuffs = guild.active_buffs || [];
        if (currentBuffs.some((b: any) => b.name === ritual.name)) throw new Error('Ritual already active');

        // Check Cost
        for (const c of ritual.cost) {
            if ((guild.resources[c.type] || 0) < c.amount) throw new Error(`Not enough ${c.type}`);
        }

        // Deduct
        for (const c of ritual.cost) {
             guild.resources[c.type] -= c.amount;
        }

        // Apply Buff
        const expiresAt = Date.now() + (ritual.durationMinutes * 60 * 1000);
        currentBuffs.push({
            id: ritual.id,
            name: ritual.name,
            stats: ritual.stats,
            expiresAt
        });

        await client.query('UPDATE guilds SET resources = $1, active_buffs = $2 WHERE id = $3', [JSON.stringify(guild.resources), JSON.stringify(currentBuffs), guildId]);
        
        await client.query(`INSERT INTO guild_chat (guild_id, user_id, content) VALUES ($1, $2, $3)`, [guildId, req.user.id, `Rozpoczęto rytuał: ${ritual.name}`]);

        await client.query('COMMIT');
        res.json({ message: 'Ritual started' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               INVITES
// ==========================================
router.post('/invite', authenticateToken, async (req: any, res: any) => {
    const { targetName } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || !canManage(memberRes.rows[0].role)) return res.status(403).json({ message: 'Not authorized' });
        const guildId = memberRes.rows[0].guild_id;

        const targetRes = await pool.query("SELECT user_id FROM characters WHERE data->>'name' = $1", [targetName]);
        if (targetRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const targetId = targetRes.rows[0].user_id;

        const targetMemberCheck = await pool.query('SELECT 1 FROM guild_members WHERE user_id = $1', [targetId]);
        if (targetMemberCheck.rows.length > 0) return res.status(400).json({ message: 'User already in a guild' });

        const guildNameRes = await pool.query('SELECT name FROM guilds WHERE id = $1', [guildId]);
        const guildName = guildNameRes.rows[0].name;

        await enforceInboxLimit(pool, targetId);
        await pool.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, $2, 'guild_invite', 'Zaproszenie do gildii', $3)`,
            [targetId, guildName, JSON.stringify({ guildId, guildName })]
        );

        res.json({ message: 'Invite sent' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

router.post('/accept-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const msgRes = await client.query('SELECT * FROM messages WHERE id = $1 AND recipient_id = $2 FOR UPDATE', [messageId, req.user.id]);
        if (msgRes.rows.length === 0) throw new Error('Message not found');
        const msg = msgRes.rows[0];
        if (msg.message_type !== 'guild_invite') throw new Error('Invalid message type');
        
        const { guildId } = msg.body;
        
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) throw new Error('Guild not found');
        const guild = guildRes.rows[0];

        if (guild.member_count >= guild.max_members) throw new Error('Guild is full');

        const memberCheck = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberCheck.rows.length > 0) throw new Error('Already in a guild');

        await client.query('INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, \'RECRUIT\')', [guildId, req.user.id]);
        await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guildId]);
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, req.user.id]);
        
        // Delete invite message
        await client.query('DELETE FROM messages WHERE id = $1', [messageId]);

        await client.query('COMMIT');
        res.json({ message: 'Joined' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/reject-invite', authenticateToken, async (req: any, res: any) => {
    const { messageId } = req.body;
    try {
        await pool.query('DELETE FROM messages WHERE id = $1 AND recipient_id = $2', [messageId, req.user.id]);
        res.json({ message: 'Rejected' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

router.get('/profile/:id', async (req: any, res: any) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                g.id, g.name, g.tag, g.description, g.crest_url as "crestUrl", g.created_at as "createdAt",
                g.member_count as "memberCount", g.max_members as "maxMembers", g.min_level as "minLevel", g.is_public as "isPublic",
                c.data->>'name' as "leaderName",
                (SELECT SUM((ch.data->>'level')::int) FROM guild_members gm JOIN characters ch ON gm.user_id = ch.user_id WHERE gm.guild_id = g.id) as "totalLevel"
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            WHERE g.id = $1
        `, [id]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: 'Guild not found' });
        
        const profile = result.rows[0];
        // Ensure numbers
        profile.totalLevel = parseInt(profile.totalLevel) || 0;
        
        res.json(profile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error' });
    }
});

// ==========================================
//               ESPIONAGE
// ==========================================

router.get('/espionage', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        const activeRes = await pool.query(`
            SELECT ge.id, ge.defender_guild_id, ge.status, ge.start_time, ge.end_time, ge.cost,
            g.name as "targetGuildName"
            FROM guild_espionage ge
            JOIN guilds g ON ge.defender_guild_id = g.id
            WHERE ge.attacker_guild_id = $1 AND ge.status = 'IN_PROGRESS'
        `, [guildId]);
        
        const historyRes = await pool.query(`
            SELECT ge.id, ge.defender_guild_id, ge.status, ge.start_time, ge.end_time, ge.cost, ge.result_snapshot,
            g.name as "targetGuildName"
            FROM guild_espionage ge
            JOIN guilds g ON ge.defender_guild_id = g.id
            WHERE ge.attacker_guild_id = $1 AND ge.status = 'COMPLETED'
            ORDER BY ge.end_time DESC LIMIT 20
        `, [guildId]);

        res.json({
            activeSpies: activeRes.rows.map(r => ({...r, startTime: r.start_time, endTime: r.end_time, targetGuildName: r.targetGuildName, resultSnapshot: r.result_snapshot})),
            history: historyRes.rows.map(r => ({...r, startTime: r.start_time, endTime: r.end_time, targetGuildName: r.targetGuildName, resultSnapshot: r.result_snapshot}))
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error' });
    }
});

router.post('/espionage/start', authenticateToken, async (req: any, res: any) => {
    const { targetGuildId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const { guild_id: guildId, role } = memberRes.rows[0];

        if (role !== GuildRole.LEADER && role !== GuildRole.OFFICER) {
             throw new Error('Only Leaders and Officers can send spies.');
        }
        
        if (Number(guildId) === Number(targetGuildId)) throw new Error('Cannot spy on yourself');

        const guildRes = await client.query('SELECT resources, buildings FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        const spyLevel = guild.buildings?.spyHideout || 0;
        
        if (spyLevel === 0) throw new Error('Spy Hideout required');

        // Check active limit
        const activeCountRes = await client.query('SELECT COUNT(*) FROM guild_espionage WHERE attacker_guild_id = $1 AND status = \'IN_PROGRESS\'', [guildId]);
        if (parseInt(activeCountRes.rows[0].count) >= spyLevel) throw new Error('Spy limit reached');

        // Calculate Cost (Dynamic based on target level)
        const targetRes = await client.query(`
            SELECT SUM((c.data->>'level')::int) as total_level
            FROM guild_members gm 
            JOIN characters c ON gm.user_id = c.user_id 
            WHERE gm.guild_id = $1
        `, [targetGuildId]);
        const targetTotalLevel = parseInt(targetRes.rows[0].total_level) || 1;
        const cost = targetTotalLevel * 125;

        if ((guild.resources.gold || 0) < cost) throw new Error('Not enough gold in guild bank');
        
        // Deduct
        guild.resources.gold -= cost;
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guild.resources), guildId]);

        // Duration logic
        let durationMinutes = 15; // Lvl 1
        if (spyLevel === 2) durationMinutes = 10;
        if (spyLevel >= 3) durationMinutes = 5;
        
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        await client.query(
            `INSERT INTO guild_espionage (attacker_guild_id, defender_guild_id, status, start_time, end_time, cost)
             VALUES ($1, $2, 'IN_PROGRESS', $3, $4, $5)`,
            [guildId, targetGuildId, startTime, endTime, cost]
        );

        await client.query('COMMIT');
        res.json({ message: 'Spy sent' });

    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});


// ==========================================
//               RAIDS
// ==========================================

// GET /api/guilds/targets
router.get('/targets', authenticateToken, async (req: any, res: any) => {
     try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = Number(memberRes.rows[0].guild_id);

        const result = await pool.query(`
            SELECT g.id, g.name, g.tag,
            (SELECT COUNT(*)::int FROM guild_members gm WHERE gm.guild_id = g.id) as "memberCount",
            (
                SELECT COALESCE(SUM((c.data->>'level')::int), 0)::int 
                FROM guild_members gm 
                JOIN characters c ON gm.user_id = c.user_id 
                WHERE gm.guild_id = g.id
            ) as "totalLevel"
            FROM guilds g
            WHERE g.id != $1
            ORDER BY "memberCount" DESC
        `, [guildId]);
        
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch targets' });
    }
});

// GET /api/guilds/raids - Get active raids and history
router.get('/raids', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = Number(memberRes.rows[0].guild_id);

        const data = await getActiveRaids(guildId);
        res.json(data);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch raids' });
    }
});

// POST /api/guilds/raids/create - Declare War
router.post('/raids/create', authenticateToken, async (req: any, res: any) => {
    const { targetGuildId, raidType } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = Number(memberRes.rows[0].guild_id);

        const raid = await createRaid(guildId, req.user.id, targetGuildId, raidType);
        res.status(201).json(raid);
    } catch (err: any) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
});

// POST /api/guilds/raids/join
router.post('/raids/join', authenticateToken, async (req: any, res: any) => {
    const { raidId } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = Number(memberRes.rows[0].guild_id);

        await joinRaid(raidId, req.user.id, guildId);
        res.json({ message: 'Joined raid' });
    } catch (err: any) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
});


export default router;
