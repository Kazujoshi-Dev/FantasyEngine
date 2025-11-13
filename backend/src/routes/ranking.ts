import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { RankingPlayer } from '../types.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id as id,
                c.data->>'name' as name,
                c.data->>'race' as race,
                c.data->>'characterClass' as "characterClass",
                (c.data->>'level')::int as level,
                (c.data->>'experience')::bigint as experience,
                (c.data->>'pvpWins')::int as "pvpWins",
                (c.data->>'pvpLosses')::int as "pvpLosses",
                (c.data->>'pvpProtectionUntil')::bigint as "pvpProtectionUntil",
                (active_sessions.user_id IS NOT NULL) as "isOnline"
            FROM characters c
            LEFT JOIN (
                SELECT DISTINCT user_id 
                FROM sessions 
                WHERE last_active_at > NOW() - INTERVAL '5 minutes'
            ) as active_sessions ON c.user_id = active_sessions.user_id
        `);

        // The 'experience' from DB is the TOTAL accumulated experience.
        const ranking: RankingPlayer[] = result.rows;

        // Sort by total experience.
        ranking.sort((a, b) => b.experience - a.experience);

        res.json(ranking);
    } catch (err) {
        console.error('Error fetching ranking:', err);
        res.status(500).json({ message: 'Failed to fetch ranking data.' });
    }
});

export default router;