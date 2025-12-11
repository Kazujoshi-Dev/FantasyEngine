
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { pool } from '../db.js';
import { RankingPlayer } from '../types.js';
import { calculateTotalExperience } from '../logic/stats.js';

const router = express.Router();

router.get('/', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id as id,
                COALESCE(c.data->>'name', 'Nieznany') as name,
                COALESCE(c.data->>'race', 'Human') as race,
                c.data->>'characterClass' as "characterClass",
                COALESCE((c.data->>'level')::int, 1) as level,
                COALESCE((c.data->>'experience')::bigint, 0) as experience,
                COALESCE((c.data->>'pvpWins')::int, 0) as "pvpWins",
                COALESCE((c.data->>'pvpLosses')::int, 0) as "pvpLosses",
                COALESCE((c.data->>'pvpProtectionUntil')::bigint, 0) as "pvpProtectionUntil",
                g.tag as "guildTag",
                EXISTS (
                    SELECT 1 
                    FROM sessions s 
                    WHERE s.user_id = c.user_id AND s.last_active_at > NOW() - INTERVAL '1 minute'
                ) as "isOnline"
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
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
