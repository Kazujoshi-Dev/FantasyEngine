import express, { Router, Response } from 'express';
import { pool } from '../db.js';
import { RankingPlayer } from '../types.js';

const router = Router();

const calculateTotalExperience = (level: number, currentExperience: number): number => {
    let totalXp = currentExperience;
    // Sum up the experience required for all previous levels
    for (let i = 1; i < level; i++) {
        const xpForPrevLevel = Math.floor(100 * Math.pow(i, 1.3));
        totalXp += xpForPrevLevel;
    }
    return totalXp;
};

router.get('/', async (req: express.Request, res: Response) => {
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

        const rankingData: RankingPlayer[] = result.rows;

        const rankingWithTotalXp = rankingData.map(player => {
            const totalExperience = calculateTotalExperience(player.level, player.experience);
            return {
                ...player,
                experience: totalExperience, // Overwrite with total experience
            };
        });

        // Sort by the new total experience.
        rankingWithTotalXp.sort((a, b) => b.experience - a.experience);

        res.json(rankingWithTotalXp);
    } catch (err) {
        console.error('Error fetching ranking:', err);
        res.status(500).json({ message: 'Failed to fetch ranking data.' });
    }
});

export default router;