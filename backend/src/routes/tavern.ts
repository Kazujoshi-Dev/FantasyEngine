


// fix: Use named imports for Express types
import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { TavernMessage } from '../types.js';

const router = express.Router();

router.get('/messages', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT * FROM tavern_messages ORDER BY created_at ASC LIMIT 100"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tavern messages' });
    }
});

router.post('/messages', authenticateToken, async (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 500) {
        return res.status(400).json({ message: 'Invalid message content.' });
    }

    try {
        const charRes = await pool.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: "Character not found." });
        }
        const characterName = charRes.rows[0].name;

        const result = await pool.query(
            'INSERT INTO tavern_messages (user_id, character_name, content) VALUES ($1, $2, $3) RETURNING *',
            [req.user!.id, characterName, content.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to send message' });
    }
});

export default router;
