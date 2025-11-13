
import express from 'express';
import { pool } from '../db.js';
import { RankingPlayer } from '../types.js';

const router = express.Router();

router.get('/', async (req: express.Request, res: express.Response) => {
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
                (s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
            FROM characters c
            LEFT JOIN sessions s ON c.user_id = s.user_id
        `);

        const ranking: RankingPlayer[] = result.rows.map(row => {
            const totalExperience = calculateTotalExperience(row.level, row.experience);
            return { ...row, totalExperience };
        });

        ranking.sort((a, b) => b.totalExperience - a.totalExperience);

        res.json(ranking);
    } catch (err) {
        console.error('Error fetching ranking:', err);
        res.status(500).json({ message: 'Failed to fetch ranking data.' });
    }
});

const calculateTotalExperience = (level: number, currentExperience: number): number => {
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += Math.floor(100 * Math.pow(i, 1.3));
    }
    total += currentExperience;
    return total;
};

export default router;