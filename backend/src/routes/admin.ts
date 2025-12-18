
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import statsRoutes from './admin/stats.js';
import characterRoutes from './admin/characters.js';
import auditRoutes from './admin/audit.js';

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
router.use('/audit', auditRoutes);

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

// WIPE GAME DATA - Czyści postępy graczy, zachowuje konta i dane gry
router.post('/wipe-game-data', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('[WIPE] Starting full game data wipe...');

        await client.query(`
            TRUNCATE 
                characters, 
                messages, 
                market_listings, 
                market_bids, 
                hunting_parties, 
                guilds, 
                guild_members, 
                guild_chat, 
                guild_armory_items, 
                guild_bank_history, 
                guild_raids, 
                guild_espionage, 
                tavern_messages, 
                tavern_presence, 
                tower_runs 
            RESTART IDENTITY CASCADE
        `);

        await client.query('DELETE FROM sessions');

        await client.query('COMMIT');
        console.log('[WIPE] Wipe completed successfully.');

        res.json({ message: 'Dane gry zostały pomyślnie wyczyszczone. Wszystkie postacie i gildie przestały istnieć.' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[WIPE] Error during wipe:', err);
        res.status(500).json({ message: 'Błąd podczas czyszczenia danych: ' + err.message });
    } finally {
        client.release();
    }
});

export default router;
