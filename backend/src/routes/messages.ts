import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { Message, MarketNotificationBody } from '../types.js';

const router = Router();

// GET all messages for the user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT * FROM messages WHERE recipient_id = $1 ORDER BY created_at DESC",
            [(req as any).user!.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

// POST a new message
router.post('/', authenticateToken, async (req: Request, res: Response) => {
    const { recipientName, subject, content } = req.body;
    try {
        const senderRes = await pool.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [(req as any).user!.id]);
        if (senderRes.rows.length === 0) {
            return res.status(404).json({ message: "Sender character not found." });
        }
        const senderName = senderRes.rows[0].name;

        const recipientRes = await pool.query("SELECT user_id FROM characters WHERE data->>'name' = $1", [recipientName]);
        if (recipientRes.rows.length === 0) {
            return res.status(404).json({ message: "Recipient not found." });
        }
        const recipientId = recipientRes.rows[0].user_id;
        
        const body = { content };
        const result = await pool.query(
            `INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body)
             VALUES ($1, $2, $3, 'player_message', $4, $5) RETURNING *`,
            [recipientId, (req as any).user!.id, senderName, subject, JSON.stringify(body)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to send message' });
    }
});

// PUT to mark as read
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        await pool.query(
            "UPDATE messages SET is_read = TRUE WHERE id = $1 AND recipient_id = $2",
            [req.params.id, (req as any).user!.id]
        );
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update message' });
    }
});

// DELETE a message
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        await pool.query(
            "DELETE FROM messages WHERE id = $1 AND recipient_id = $2",
            [req.params.id, (req as any).user!.id]
        );
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete message' });
    }
});

// POST to claim item from market return message
router.post('/claim-return/:id', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const msgRes = await client.query("SELECT * FROM messages WHERE id = $1 AND recipient_id = $2 FOR UPDATE", [req.params.id, (req as any).user!.id]);
        if (msgRes.rows.length === 0) {
            return res.status(404).json({ message: 'Message not found.' });
        }
        const message = msgRes.rows[0];
        const body = message.body as MarketNotificationBody;

        if (message.message_type !== 'market_notification' || body.type !== 'ITEM_RETURNED' || !body.item) {
            return res.status(400).json({ message: 'This message does not contain a claimable item.' });
        }

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [(req as any).user!.id]);
        let character = charRes.rows[0].data;

        character.inventory.push(body.item);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, (req as any).user!.id]);
        await client.query('DELETE FROM messages WHERE id = $1', [req.params.id]);

        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to claim item.' });
    } finally {
        client.release();
    }
});

// POST for bulk delete
router.post('/bulk-delete', authenticateToken, async (req: Request, res: Response) => {
    const { type } = req.body;
    let query;
    const params = [(req as any).user!.id];

    switch (type) {
        case 'read':
            query = "DELETE FROM messages WHERE recipient_id = $1 AND is_read = TRUE";
            break;
        case 'all':
            query = "DELETE FROM messages WHERE recipient_id = $1";
            break;
        case 'expedition_reports':
            query = "DELETE FROM messages WHERE recipient_id = $1 AND message_type = 'expedition_report'";
            break;
        default:
            return res.status(400).json({ message: 'Invalid bulk delete type' });
    }

    try {
        const result = await pool.query(query, params);
        res.json({ deletedCount: result.rowCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to bulk delete messages' });
    }
});

export default router;