
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { randomBytes } from 'crypto';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../logic/helpers.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../logic/email.js';

const router = express.Router();

router.post('/register', async (req: any, res: any) => {
    const { username, password, email } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const { salt, hash } = hashPassword(password);
        const emailValue = email && email.trim() !== '' ? email.trim() : null;

        await pool.query(
            'INSERT INTO users (username, password_hash, salt, email) VALUES ($1, $2, $3, $4)',
            [username, hash, salt, emailValue]
        );
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err: any) {
        if (err.code === '23505') { 
             if (err.constraint && err.constraint.includes('email')) {
                 return res.status(409).json({ message: 'Email jest już zajęty.' });
             }
            return res.status(409).json({ message: 'Nazwa użytkownika jest już zajęta.' });
        }
        res.status(500).json({ message: 'Failed to register user.' });
    }
});

router.post('/login', async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query('SELECT id, password_hash, salt FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = result.rows[0];
        const isPasswordValid = verifyPassword(password, user.salt, user.password_hash);

        if (!isPasswordValid) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = randomBytes(64).toString('hex');
        
        // Robust session handling: Delete old -> Insert new
        await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
        
        // This query often fails if schema migration for 'last_active_at' didn't run.
        await client.query(
            'INSERT INTO sessions (token, user_id, created_at, last_active_at) VALUES ($1, $2, NOW(), NOW())',
            [token, user.id]
        );
        
        await client.query('COMMIT');

        res.json({ token });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("LOGIN ERROR [CRITICAL]:", err.message, err.stack);
        
        // Provide a more specific error if it's related to the missing column
        if (err.message.includes('column "last_active_at" of relation "sessions" does not exist')) {
             return res.status(500).json({ message: 'Server database is outdated. Please ask admin to rebuild the server.' });
        }
        
        res.status(500).json({ message: 'Login failed due to a server error.' });
    } finally {
        client.release();
    }
});

router.post('/forgot-password', async (req: any, res: any) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email jest wymagany.' });
    }

    try {
        const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            const userId = result.rows[0].id;
            const token = randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour

            await pool.query(
                'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
                [userId, token, expiresAt]
            );

            // Use the centralized email logic
            await sendPasswordResetEmail(email, token);
        }
        
        // Always return success to prevent email enumeration (security best practice)
        res.json({ message: 'Jeśli taki email istnieje w naszej bazie, wysłano na niego instrukcję resetowania hasła.' });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});

router.post('/reset-password', async (req: any, res: any) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token i nowe hasło są wymagane.' });
    }

    try {
        const result = await pool.query(
            'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()', 
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Token jest nieprawidłowy lub wygasł.' });
        }

        const userId = result.rows[0].user_id;
        const { salt, hash } = hashPassword(newPassword);

        // Update password
        await pool.query(
            'UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3',
            [hash, salt, userId]
        );

        // Consume token
        await pool.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);

        res.json({ message: 'Hasło zostało zmienione pomyślnie. Możesz się zalogować.' });

    } catch (err) {
        res.status(500).json({ message: 'Wystąpił błąd podczas resetowania hasła.' });
    }
});

router.post('/set-email', authenticateToken, async (req: any, res: any) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }
    
    try {
        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows[0].email) {
             return res.status(400).json({ message: 'Email is already set.' });
        }

        await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user.id]);
        res.json({ message: 'Email updated successfully.' });
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'This email is already in use.' });
        }
        res.status(500).json({ message: 'Failed to update email.' });
    }
});

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
        res.status(500).json({ message: 'Failed to change password.' });
    }
});

router.post('/logout', async (req: any, res: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
        } catch (err) {
            // Don't send error to client
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
            // Log error but don't fail
        }
    }
    res.json({ status: 'ok' });
});

export default router;
