
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { randomBytes } from 'crypto';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../logic/helpers.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const { salt, hash } = hashPassword(password);
        await pool.query(
            'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3)',
            [username, hash, salt]
        );
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err: any) {
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ message: 'Username already exists.' });
        }
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Failed to register user.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const result = await pool.query('SELECT id, password_hash, salt FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = result.rows[0];
        const isPasswordValid = verifyPassword(password, user.salt, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = randomBytes(64).toString('hex');
        // Note: active_character_id defaults to NULL on login, forcing selection
        await pool.query(
            'INSERT INTO sessions (token, user_id) VALUES ($1, $2)',
            [token, user.id]
        );

        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Login failed.' });
    }
});

// POST /api/auth/select-character
router.post('/select-character', authenticateToken, async (req: any, res: any) => {
    const { characterId } = req.body;
    const userId = req.user.id;

    if (!characterId) {
        return res.status(400).json({ message: 'Character ID is required' });
    }

    try {
        // Verify ownership
        const charRes = await pool.query(
            'SELECT 1 FROM characters WHERE id = $1 AND user_id = $2',
            [characterId, userId]
        );

        if (charRes.rows.length === 0) {
            return res.status(403).json({ message: 'Character does not belong to this user' });
        }

        // Update session with active_character_id
        const token = req.headers['authorization'].split(' ')[1];
        await pool.query(
            'UPDATE sessions SET active_character_id = $1 WHERE token = $2',
            [characterId, token]
        );

        res.sendStatus(200);
    } catch (err) {
        console.error('Select character error:', err);
        res.status(500).json({ message: 'Failed to select character' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req: any, res: any) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Both old and new passwords are required.' });
    }

    try {
        const result = await pool.query('SELECT id, password_hash, salt FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = result.rows[0];
        const isPasswordValid = verifyPassword(oldPassword, user.salt, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid current password.' });
        }

        const { salt, hash } = hashPassword(newPassword);
        
        await pool.query(
            'UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3',
            [hash, salt, userId]
        );

        res.json({ message: 'Password changed successfully.' });

    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ message: 'Failed to change password.' });
    }
});

// POST /api/auth/logout
router.post('/logout', async (req: any, res: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
        } catch (err) {
            console.error('Logout error:', err);
            // Don't send error to client, just complete the logout
        }
    }
    res.sendStatus(204);
});

router.post('/session/heartbeat', async (req: any, res: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        try {
            await pool.query('UPDATE sessions SET last_active_at = NOW() WHERE token = $1', [token]);
        } catch (err) {
            // Log error but don't fail the request
            console.error('Heartbeat update failed:', err);
        }
    }
    res.sendStatus(200);
});

export default router;
