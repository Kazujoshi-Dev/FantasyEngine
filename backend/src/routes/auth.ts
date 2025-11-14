



// fix: Correctly import express and its types.
import express, { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../logic/helpers.js';

const router = express.Router();

// POST /api/auth/register
// fix: Use Request and Response types directly.
router.post('/register', async (req: Request, res: Response) => {
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
// fix: Use Request and Response types directly.
router.post('/login', async (req: Request, res: Response) => {
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

// POST /api/auth/logout
// fix: Use Request and Response types directly.
router.post('/logout', async (req: Request, res: Response) => {
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

// fix: Use Request and Response types directly.
router.post('/session/heartbeat', async (req: Request, res: Response) => {
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