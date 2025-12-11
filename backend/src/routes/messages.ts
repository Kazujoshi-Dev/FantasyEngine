
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { Message, MarketNotificationBody } from '../types.js';
import { enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// GET status/unread - Check if there are any unread messages (lightweight)
router.get('/status/unread', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(
            "SELECT 1 FROM messages WHERE recipient_id = $1 AND is_read = FALSE LIMIT 1",
            [req.user!.id]
        );
        // Handle potential null rowCount (TS18047)
        const count = result.rowCount || 0;
        res.json({ hasUnread: count > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to check messages status' });
    }
});

// GET all messages for the user
router.get('/', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(
            "SELECT * FROM messages WHERE recipient_id = $1 ORDER BY created_at DESC",
            [req.user!.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

// POST a new message
router.post('/', authenticateToken, async (req: any, res: any) => {
    const { recipientName, subject, content } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const senderRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [req.user!.id]);
        if (senderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Sender character not found." });
        }
        const senderName = senderRes.rows[0].name;

        const recipientRes = await client.query("SELECT user_id FROM characters WHERE data->>'name' = $1", [recipientName]);
        if (recipientRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Recipient not found." });
        }
        const recipientId = recipientRes.rows[0].user_id;
        
        // Enforce inbox limit for recipient
        await enforceInboxLimit(client, recipientId);

        const body = { content };
        const result = await client.query(
            `INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body)
             VALUES ($1, $2, $3, 'player_message', $4, $5) RETURNING *`,
            [recipientId, req.user!.id, senderName, subject, JSON.stringify(body)]
        );
        
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to send message' });
    } finally {
        client.release();
    }
});

// PUT to mark as read
router.put('/:id', authenticateToken, async (req: any, res: any) => {
    try {
        await pool.query(
            "UPDATE messages SET is_read = TRUE WHERE id = $1 AND recipient_id = $2",
            [req.params.id, req.user!.id]
        );
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update message' });
    }
});

// PUT to toggle saved state
router.put('/:id/save', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const msgRes = await client.query(
            "SELECT is_saved FROM messages WHERE id = $1 AND recipient_id = $2 FOR UPDATE",
            [req.params.id, req.user!.id]
        );

        if (msgRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Message not found' });
        }

        const isSaved = msgRes.rows[0].is_saved;

        // If attempting to save (currently false), check limit
        if (!isSaved) {
             const countRes = await client.query(
                 "SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_saved = TRUE",
                 [req.user!.id]
             );
             const savedCount = parseInt(countRes.rows[0].count);
             if (savedCount >= 50) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ message: 'Max 50 saved messages limit reached.' });
             }
        }

        await client.query(
            "UPDATE messages SET is_saved = $1 WHERE id = $2",
            [!isSaved, req.params.id]
        );

        await client.query('COMMIT');
        res.sendStatus(204);

    } catch(err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to toggle save state' });
    } finally {
        client.release();
    }
});

// DELETE a message
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
    try {
        await pool.query(
            "DELETE FROM messages WHERE id = $1 AND recipient_id = $2",
            [req.params.id, req.user!.id]
        );
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete message' });
    }
});

// POST to claim item from market return message
router.post('/claim-return/:id', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const msgRes = await client.query("SELECT * FROM messages WHERE id = $1 AND recipient_id = $2 FOR UPDATE", [req.params.id, req.user!.id]);
        if (msgRes.rows.length === 0) {
            return res.status(404).json({ message: 'Message not found.' });
        }
        const message = msgRes.rows[0];
        const body = message.body as MarketNotificationBody;

        // Allow claiming for both RETURNED items (expired/cancelled) and WON items (auctions)
        if (message.message_type !== 'market_notification' || (body.type !== 'ITEM_RETURNED' && body.type !== 'WON') || !body.item) {
            return res.status(400).json({ message: 'This message does not contain a claimable item.' });
        }

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character = charRes.rows[0].data;

        character.inventory.push(body.item);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
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

// POST for bulk deletion
router.post('/bulk-delete', authenticateToken, async (req: any, res: any) => {
    const { type } = req.body;
    const userId = req.user!.id;
    let query;
    const params = [userId];

    // IMPORTANT: Do NOT delete saved messages in bulk actions unless explicitly requested (future feature).
    // Safeguard applied to all bulk deletes.
    switch (type) {
        case 'read':
            query = 'DELETE FROM messages WHERE recipient_id = $1 AND is_read = TRUE AND is_saved = FALSE';
            break;
        case 'all':
            query = 'DELETE FROM messages WHERE recipient_id = $1 AND is_saved = FALSE';
            break;
        case 'expedition_reports':
            query = "DELETE FROM messages WHERE recipient_id = $1 AND message_type = 'expedition_report' AND is_saved = FALSE";
            break;
        default:
            return res.status(400).json({ message: 'Invalid bulk delete type.' });
    }

    try {
        const result = await pool.query(query, params);
        res.json({ deletedCount: result.rowCount });
    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: 'Failed to delete messages.' });
    }
});

export default router;
