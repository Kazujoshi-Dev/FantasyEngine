import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { RankingPlayer } from '../types.js';

const router = Router();

// Helper function to calculate the total XP required to reach a certain level.
const calculatePreviousLevelsExperience = (level: number): number => {
    let total = 0;
    // Sums up the XP required for all levels *before* the current one.
    // e.g., for level 3, it sums XP for level 1 and level 2.
    for (let i = 1; i < level; i++) {
        total += Math.floor(100 * Math.pow(i, 1.3));
    }
    return total;
};


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

        const ranking: RankingPlayer[] = result.rows.map(row => {
            // Assume the 'experience' from DB is the TOTAL accumulated experience.
            const totalExperience = row.experience;
            
            // Calculate the experience for all previous levels.
            const previousLevelsExperience = calculatePreviousLevelsExperience(row.level);
            
            // Calculate the experience gained within the current level.
            const currentLevelExperience = totalExperience - previousLevelsExperience;

            return { 
                ...row,
                experience: currentLevelExperience, // This is now progress in the current level
                totalExperience: totalExperience    // This is the true total for sorting
            };
        });

        ranking.sort((a, b) => b.totalExperience - a.totalExperience);

        res.json(ranking);
    } catch (err) {
        console.error('Error fetching ranking:', err);
        res.status(500).json({ message: 'Failed to fetch ranking data.' });
    }
});

export default router;