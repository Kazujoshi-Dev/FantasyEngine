
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import statsRoutes from './admin/stats.js';
import characterRoutes from './admin/characters.js';

const router = express.Router();

// Middleware: Check if user is Admin
const checkAdmin = async (req: any, res: any, next: any) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length === 0 || userRes.rows[0].username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        next();
    } catch (err) { res.status(500).json({ message: 'Auth check failed' }); }
};

router.use(authenticateToken, checkAdmin);

// Delegacja do pod-routerów
router.use('/stats', statsRoutes);
router.use('/characters', characterRoutes);

// Metody pomocnicze zachowane w głównym pliku dla prostoty (globalne akcje)
router.post('/global-message', async (req: any, res: any) => {
    const { subject, content } = req.body;
    try {
        const users = await pool.query('SELECT user_id FROM characters');
        for (const u of users.rows) {
            await pool.query("INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', $2, $3)", 
                [u.user_id, subject, JSON.stringify({ content })]);
        }
        res.json({ message: 'Sent' });
    } catch (err) { res.status(500).json({ message: 'Failed' }); }
});

export default router;
