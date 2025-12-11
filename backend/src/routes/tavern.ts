import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { TavernMessage } from '../types.js';

const router = express.Router();

router.get('/messages', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        // 1. Register/Update user presence
        await client.query(
            `INSERT INTO tavern_presence (user_id, last_seen) 
             VALUES ($1, NOW()) 
             ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW()`,
            [req.user!.id]
        );

        // 2. Clean up old presence entries (older than 2 minutes)
        await client.query(`DELETE FROM tavern_presence WHERE last_seen < NOW() - INTERVAL '2 minutes'`);

        // 3. Fetch messages
        const messagesResult = await client.query(
            "SELECT * FROM tavern_messages ORDER BY created_at ASC LIMIT 100"
        );

        // 4. Fetch active users (those in tavern_presence)
        const usersResult = await client.query(`
            SELECT c.data->>'name' as name 
            FROM tavern_presence tp 
            JOIN characters c ON tp.user_id = c.user_id
            ORDER BY name ASC
        `);
        const activeUsers = usersResult.rows.map(row => row.name);

        res.json({
            messages: messagesResult.rows,
            activeUsers: activeUsers
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch tavern data' });
    } finally {
        client.release();
    }
});

router.post('/messages', authenticateToken, async (req: any, res: any) => {
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