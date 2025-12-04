
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/public/report/:id - Get a specific report by message ID
router.get('/report/:id', async (req, res) => {
    const { id } = req.params;

    if (isNaN(Number(id))) {
        return res.status(400).json({ message: 'Invalid report ID.' });
    }

    try {
        const result = await pool.query(
            "SELECT message_type, body, subject, sender_name FROM messages WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found or has been deleted.' });
        }

        const message = result.rows[0];

        // Ensure it's a report type before returning
        if (message.message_type !== 'expedition_report' && message.message_type !== 'pvp_report' && message.message_type !== 'raid_report') {
            return res.status(403).json({ message: 'This message is not a shareable report.' });
        }

        res.json(message);
    } catch (err) {
        console.error(`Error fetching public report ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch report data.' });
    }
});

export default router;