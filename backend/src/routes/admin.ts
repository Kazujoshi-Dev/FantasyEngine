
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, Race, EssenceType, ItemInstance, PlayerRank } from '../types.js';
import { hashPassword } from '../logic/helpers.js';

const router = express.Router();

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

// GET /characters/all - Lista wszystkich postaci
router.get('/characters/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT user_id, username, data->>'name' as name, (data->>'level')::int as level, (data->'resources'->>'gold')::bigint as gold 
            FROM characters c JOIN users u ON c.user_id = u.id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// GET /characters/:id/inspect - Pełna inspekcja postaci
router.get('/characters/:id/inspect', async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(result.rows[0].data);
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// POST /character/:id/update-gold - Ustaw złoto
router.post('/character/:id/update-gold', async (req, res) => {
    const { gold } = req.body;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        let char = result.rows[0].data;
        char.resources.gold = gold;
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        res.json({ message: 'Gold updated' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// POST /grant-rank - Przyznaj rangę graczowi
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

// POST /users/:id/password - Zmień hasło usera
router.post('/users/:id/password', async (req, res) => {
    const { newPassword } = req.body;
    const { salt, hash } = hashPassword(newPassword);
    try {
        await pool.query('UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3', [hash, salt, req.params.id]);
        res.json({ message: 'Password changed' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

export default router;
