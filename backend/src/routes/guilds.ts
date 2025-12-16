
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';

const router = express.Router();

// GET /api/guilds/targets - List potential war targets
router.get('/targets', authenticateToken, async (req: any, res: any) => {
     try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        // Dynamic count here too for consistency, added total_level sum calculation
        const result = await pool.query(`
            SELECT g.id, g.name, g.tag,
            (SELECT COUNT(*)::int FROM guild_members gm WHERE gm.guild_id = g.id) as member_count,
            (
                SELECT COALESCE(SUM((c.data->>'level')::int), 0)::int 
                FROM guild_members gm 
                JOIN characters c ON gm.user_id = c.user_id 
                WHERE gm.guild_id = g.id
            ) as total_level
            FROM guilds g
            WHERE g.id != $1
            ORDER BY member_count DESC
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
        const guildId = memberRes.rows[0].guild_id;

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
        const guildId = memberRes.rows[0].guild_id;

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
        const guildId = memberRes.rows[0].guild_id;

        await joinRaid(raidId, req.user.id, guildId);
        res.json({ message: 'Joined raid' });
    } catch (err: any) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
});

export default router;
