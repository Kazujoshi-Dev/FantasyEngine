
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { hashPassword } from '../logic/helpers.js';

const router = express.Router();

const checkAdmin = async (req: any, res: any, next: any) => {
    try {
        const u = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        if (u.rows.length === 0 || u.rows[0].username !== 'Kazujoshi') return res.status(403).json({ message: 'Admin only' });
        next();
    } catch (err) { res.status(500).json({ message: 'Auth failed' }); }
};

router.use(authenticateToken, checkAdmin);

router.get('/characters/all', async (req, res) => {
    const r = await pool.query(`SELECT user_id, username, data->>'name' as name, (data->>'level')::int as level, (data->'resources'->>'gold')::bigint as gold FROM characters c JOIN users u ON c.user_id = u.id`);
    res.json(r.rows);
});

router.get('/characters/:id/inspect', async (req, res) => {
    const r = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).send();
    res.json(r.rows[0].data);
});

router.post('/grant-rank', async (req: any, res: any) => {
    const { userId, rankId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (r.rows.length === 0) throw new Error('Not found');
        let char = r.rows[0].data;
        if (!char.ownedRankIds) char.ownedRankIds = [];
        if (!char.ownedRankIds.includes(rankId)) char.ownedRankIds.push(rankId);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        await client.query('COMMIT');
        res.json({ message: 'Rank granted' });
    } catch (err: any) { await client.query('ROLLBACK'); res.status(500).json({ message: err.message }); }
    finally { client.release(); }
});

export default router;
