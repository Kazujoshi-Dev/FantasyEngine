
import express from 'express';
import { pool } from '../../db.js';

const router = express.Router();

router.get('/global', async (req, res) => {
    try {
        const goldRes = await pool.query(`SELECT SUM(COALESCE((data->'resources'->>'gold')::bigint, 0)) as total_gold FROM characters`);
        const totalGold = parseInt(goldRes.rows[0].total_gold || '0', 10);

        const demographics = await pool.query(`
            SELECT 
                COALESCE(data->>'race', 'Unknown') as race,
                COALESCE(data->>'characterClass', 'Novice') as "characterClass",
                COUNT(*) as count
            FROM characters
            GROUP BY data->>'race', data->>'characterClass'
        `);

        res.json({
            totalGoldInEconomy: totalGold,
            demographics: demographics.rows
        });
    } catch (err) { res.status(500).json({ message: 'Failed to fetch global stats' }); }
});

export default router;
