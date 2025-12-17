
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, Race, EssenceType, ItemInstance, PlayerRank } from '../types.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';
import { enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// Middleware: Check if user is Admin (Kazujoshi)
const checkAdmin = async (req: any, res: any, next: any) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length === 0 || userRes.rows[0].username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: 'Auth check failed' });
    }
};

router.use(authenticateToken, checkAdmin);

// Rank Granting
router.post('/grant-rank', async (req: any, res: any) => {
    const { userId, rankId } = req.body;
    if (!userId || !rankId) return res.status(400).json({ message: 'Missing userId or rankId' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }
        
        const char = result.rows[0].data;
        if (!char.ownedRankIds) char.ownedRankIds = [];
        if (!char.ownedRankIds.includes(rankId)) {
            char.ownedRankIds.push(rankId);
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        await client.query('COMMIT');
        res.json({ message: 'Rank granted' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Grant failed' });
    } finally {
        client.release();
    }
});

router.get('/stats/global', async (req: any, res: any) => {
    try {
        const client = await pool.connect();
        try {
            // 1. Race & Class Counts & Economy
            const demographicsRes = await client.query(`
                SELECT 
                    COALESCE(data->>'race', 'Unknown') as race,
                    COALESCE(data->>'characterClass', 'Novice') as "characterClass",
                    COALESCE((data->'resources'->>'gold')::bigint, 0) as gold,
                    COUNT(*) as count
                FROM characters
                GROUP BY data->>'race', data->>'characterClass', data->'resources'->>'gold'
            `);

            const raceCounts: Record<string, number> = {};
            const classCounts: Record<string, number> = {};
            let totalPlayers = 0;
            let totalGoldInEconomy = 0;

            demographicsRes.rows.forEach(row => {
                const count = parseInt(row.count, 10);
                const gold = parseInt(row.gold, 10) || 0;
                
                raceCounts[row.race] = (raceCounts[row.race] || 0) + count;
                classCounts[row.characterClass] = (classCounts[row.characterClass] || 0) + count;
                
                totalPlayers += count;
                totalGoldInEconomy += (gold * count); // Approx if grouped, or exact if rows are unique per gold val
            });
            
            // Re-calculate total gold accurately without grouping interference
            const goldRes = await client.query(`SELECT SUM(COALESCE((data->'resources'->>'gold')::bigint, 0)) as total_gold FROM characters`);
            totalGoldInEconomy = parseInt(goldRes.rows[0].total_gold || '0', 10);

            // 2. Item & Affix Popularity (Aggregating Inventory + Equipment)
            // Using LATERAL and COALESCE for safety against null JSON fields
            const popularityRes = await client.query(`
                WITH all_items AS (
                    -- Inventory items (Handle null inventory)
                    SELECT value as item_data 
                    FROM characters, 
                    LATERAL jsonb_array_elements(COALESCE(data->'inventory', '[]'::jsonb))
                    
                    UNION ALL
                    
                    -- Equipment items (Handle null equipment and null slots)
                    SELECT value as item_data 
                    FROM characters, 
                    LATERAL jsonb_each(COALESCE(data->'equipment', '{}'::jsonb))
                    WHERE jsonb_typeof(value) != 'null'
                )
                SELECT 
                    item_data->>'templateId' as "templateId",
                    item_data->>'prefixId' as "prefixId",
                    item_data->>'suffixId' as "suffixId"
                FROM all_items
            `);

            const itemCounts: Record<string, number> = {};
            const affixCounts: Record<string, number> = {};

            popularityRes.rows.forEach(row => {
                // Count Item Templates
                if (row.templateId) {
                    itemCounts[row.templateId] = (itemCounts[row.templateId] || 0) + 1;
                }
                // Count Affixes (Prefix)
                if (row.prefixId) {
                    affixCounts[row.prefixId] = (affixCounts[row.prefixId] || 0) + 1;
                }
                // Count Affixes (Suffix)
                if (row.suffixId) {
                    affixCounts[row.suffixId] = (affixCounts[row.suffixId] || 0) + 1;
                }
            });

            // Sort and limit results for frontend
            const topItems = Object.entries(itemCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50)
                .map(([id, count]) => ({ id, count }));

            const topAffixes = Object.entries(affixCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50)
                .map(([id, count]) => ({ id, count }));

            res.json({
                totalPlayers,
                totalGoldInEconomy,
                raceCounts,
                classCounts,
                topItems,
                topAffixes
            });

        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Global Stats Error:", err);
        res.status(500).json({ message: 'Failed to fetch global stats' });
    }
});

// FIX: Added default export for router
export default router;
