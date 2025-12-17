
import express from 'express';
import { pool } from '../../db.js';
import { hashPassword } from '../../logic/helpers.js';

const router = express.Router();

router.get('/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.user_id, u.username, c.data->>'name' as name, c.data->>'level' as level, (c.data->'resources'->>'gold')::bigint as gold
            FROM characters c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.user_id ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch characters' }); }
});

router.post('/:id/heal', async (req, res) => {
    try {
        await pool.query("UPDATE characters SET data = jsonb_set(jsonb_set(data, '{stats,currentHealth}', data->'stats'->'maxHealth'), '{stats,currentMana}', data->'stats'->'maxMana') WHERE user_id = $1", [req.params.id]);
        res.json({ message: 'Healed' });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

router.post('/:id/password', async (req, res) => {
    const { newPassword } = req.body;
    try {
        const { salt, hash } = hashPassword(newPassword);
        await pool.query('UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3', [hash, salt, req.params.id]);
        res.json({ message: 'Password updated' });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

export default router;
