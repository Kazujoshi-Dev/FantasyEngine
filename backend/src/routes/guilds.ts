



import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { Guild, GuildMember, GuildRole, PlayerCharacter, GuildTransaction, EssenceType, GuildInviteBody } from '../types.js';

const router = express.Router();

// Helper to check roles
const canManage = (role: GuildRole) => role === GuildRole.LEADER || role === GuildRole.OFFICER;

// Helper for building costs
const getBuildingCost = (type: string, level: number) => {
    if (type === 'headquarters') {
        const gold = Math.floor(5000 * Math.pow(1.5, level));
        const essenceTypes = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        // Change type every 5 levels
        const typeIndex = Math.min(Math.floor(level / 5), 4);
        const essenceType = essenceTypes[typeIndex];
        const essenceAmount = 5 + (level % 5);
        return { gold, essenceType, essenceAmount };
    }
    return { gold: Infinity, essenceType: EssenceType.Common, essenceAmount: Infinity };
}

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
            ORDER BY gbh.created_at DESC LIMIT 50
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

        const guild: Guild & { members: GuildMember[], transactions: GuildTransaction[], myRole: GuildRole, chatHistory: any[] } = {
            id: guildData.id,
            name: guildData.name,
            tag: guildData.tag,
            leaderId: guildData.leader_id,
            description: guildData.description,
            resources: guildData.resources,
            memberCount: members.length,
            maxMembers: guildData.max_members,
            createdAt: guildData.created_at,
            isPublic: guildData.is_public,
            minLevel: guildData.min_level,
            buildings: guildData.buildings || { headquarters: 0 },
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

// GET /api/guilds/list - List public guilds for browsing
router.get('/list', authenticateToken, async (req: any, res: any) => {
    try {
        // Removed filter `WHERE g.member_count < g.max_members` to rely on dynamic count below
        const result = await pool.query(`
            SELECT g.id, g.name, g.tag, g.max_members, g.min_level, c.data->>'name' as leader_name
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            LIMIT 20
        `);
        
        const guilds = await Promise.all(result.rows.map(async (row) => {
            const countRes = await pool.query('SELECT COUNT(*) FROM guild_members WHERE guild_id = $1', [row.id]);
            return { ...row, member_count: parseInt(countRes.rows[0].count) };
        }));

        // Filter full guilds here if desired, or show them as full
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

        // Create Guild
        const createRes = await client.query(
            `INSERT INTO guilds (name, tag, leader_id, description, buildings) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [name, tag, userId, description || '', JSON.stringify({ headquarters: 0 })]
        );
        const guildId = createRes.rows[0].id;

        // Add Member as Leader
        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'LEADER')`,
            [guildId, userId]
        );
        
        // Update character guild_id column for easier lookups if implemented
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

        // Check guild capacity
        const guildRes = await client.query('SELECT max_members, (SELECT COUNT(*) FROM guild_members WHERE guild_id = $1) as count FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) return res.status(404).json({ message: 'Guild not found' });
        
        if (parseInt(guildRes.rows[0].count) >= guildRes.rows[0].max_members) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Guild is full' });
        }

        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'RECRUIT')`,
            [guildId, userId]
        );
        await client.query('UPDATE characters SET guild_id = $1 WHERE user_id = $2', [guildId, userId]);

        // Cleanup invites
        // (Optional: remove invites)

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

        if (senderRole !== GuildRole.LEADER && senderRole !== GuildRole.OFFICER) return res.status(403).json({ message: 'No permission' });
        
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
    const { type, currency, amount } = req.body; // type: 'DEPOSIT' | 'WITHDRAW'
    const userId = req.user.id;
    const amountInt = parseInt(amount);

    if (amountInt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check user
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const { guild_id, role } = memberRes.rows[0];

        // Check Permissions for Withdraw
        if (type === 'WITHDRAW' && role !== GuildRole.LEADER && role !== GuildRole.OFFICER) {
            return res.status(403).json({ message: 'Only leaders and officers can withdraw' });
        }

        // Lock Character and Guild
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        let char: PlayerCharacter = charRes.rows[0].data;
        
        const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
        let guildResources = guildRes.rows[0].resources;

        // Perform Transaction
        if (type === 'DEPOSIT') {
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
        } else { // WITHDRAW
             if (currency === 'gold') {
                if ((guildResources.gold || 0) < amountInt) return res.status(400).json({ message: 'Guild bank low on gold' });
                guildResources.gold -= amountInt;
                char.resources.gold += amountInt;
            } else {
                if ((guildResources[currency] || 0) < amountInt) return res.status(400).json({ message: 'Guild bank low on essence' });
                guildResources[currency] -= amountInt;
                (char.resources[currency as EssenceType] as number) += amountInt;
            }
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
    const { buildingType } = req.body; // e.g., 'headquarters'
    const userId = req.user.id;

    if (buildingType !== 'headquarters') return res.status(400).json({ message: 'Invalid building type' });

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
        let buildings = guild.buildings || { headquarters: 0 };
        const currentLevel = buildings[buildingType] || 0;

        // Calculate Cost
        const { gold, essenceType, essenceAmount } = getBuildingCost(buildingType, currentLevel);

        // Check resources
        const currentGold = guild.resources.gold || 0;
        const currentEssence = guild.resources[essenceType] || 0;

        if (currentGold < gold) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold in guild bank' });
        }
        if (currentEssence < essenceAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough essence in guild bank' });
        }

        // Deduct Resources
        guild.resources.gold -= gold;
        guild.resources[essenceType] -= essenceAmount;

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
