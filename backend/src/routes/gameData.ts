

import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { pool } from '../db.js';
import { GameData, GameSettings } from '../types.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint to get all game data
router.get('/', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT key, data FROM game_data');
        const gameData: Partial<GameData> = {};
        for (const row of result.rows) {
            (gameData as any)[row.key] = row.data;
        }
        // Explicitly return empty object if result is empty, ensuring valid JSON
        res.json(gameData || {});
    } catch (err) {
        console.error('Error fetching game data:', err);
        res.status(500).json({ message: 'Failed to fetch game data.' });
    }
});

// Admin-only endpoint to update game data
router.put('/', authenticateToken, async (req: any, res: any) => {
    // A simple admin check could be based on username
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
    if (userRes.rows[0]?.username !== 'Kazujoshi') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { key, data } = req.body as { key: keyof GameData, data: any };
    if (!key || data === undefined) {
        return res.status(400).json({ message: 'Key and data are required.' });
    }

    try {
        await pool.query(
            'INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = $2',
            [key, JSON.stringify(data)]
        );
        res.status(200).json({ message: `Game data for '${String(key)}' updated successfully.` });
    } catch (err) {
        console.error(`Error updating game data for key ${String(key)}:`, err);
        res.status(500).json({ message: 'Failed to update game data.' });
    }
});

export default router;