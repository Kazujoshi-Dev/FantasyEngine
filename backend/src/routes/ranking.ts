





import * as express from 'express';
import { pool } from '../db.js';
import { RankingPlayer } from '../types.js';

const router = express.Router();

const calculateTotalExperience = (level: number, currentExperience: number | string): number => {
    // The pg driver returns bigint as a string, so we must cast to Number
    // to prevent string concatenation.
    let totalXp = Number(currentExperience);
    
    // Sum up the experience required for all previous levels
    for (let i = 1; i < level; i++) {
        const xpForPrevLevel = Math.floor(100 * Math.pow(i, 1.3));
        totalXp += xpForPrevLevel;
    }
    return totalXp;
};

// fix: Use aliased ExpressRequest and ExpressResponse types.
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
                EXISTS (
                    SELECT 1 
                    FROM sessions s 
                    WHERE s.user_id = c.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes'
                ) as "isOnline"
            FROM characters c
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