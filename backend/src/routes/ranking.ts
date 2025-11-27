


import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
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

router.get('/', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id as id,
                c.data->>'name' as name,
                c.data->>'race' as race,
                c.data->>'characterClass' as "characterClass",
                COALESCE((c.data->>'level')::int, 1) as level,
                COALESCE((c.data->>'experience')::bigint, 0) as experience,
                COALESCE((c.data->>'pvpWins')::int, 0) as "pvpWins",
                COALESCE((c.data->>'pvpLosses')::int, 0) as "pvpLosses",
                COALESCE((c.data->>'pvpProtectionUntil')::bigint, 0) as "pvpProtectionUntil",
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

router.get('/guilds', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT 
                g.id, 
                g.name, 
                g.tag, 
                COUNT(gm.user_id) as "memberCount",
                SUM((c.data->>'level')::int) as "totalLevel"
            FROM guilds g
            JOIN guild_members gm ON g.id = gm.guild_id
            JOIN characters c ON gm.user_id = c.user_id
            GROUP BY g.id, g.name, g.tag
            ORDER BY "totalLevel" DESC
        `);

        // Convert string sums to numbers if necessary (depends on pg driver config)
        const guildRanking = result.rows.map(row => ({
            ...row,
            totalLevel: parseInt(row.totalLevel) || 0,
            memberCount: parseInt(row.memberCount) || 0
        }));

        res.json(guildRanking);
    } catch (err) {
        console.error('Error fetching guild ranking:', err);
        res.status(500).json({ message: 'Failed to fetch guild ranking.' });
    }
});

export default router;
