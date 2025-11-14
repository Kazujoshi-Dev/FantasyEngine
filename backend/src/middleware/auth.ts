// fix: Changed import to use express namespace for types, resolving conflicts.
import express from 'express';
import { pool } from '../db.js';

// fix: Use express.Request, express.Response, and express.NextFunction types.
export async function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    try {
        const result = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
        if (result.rows.length === 0) {
            return res.status(403).json({ message: "Invalid token" });
        }
        // fix: Use req.user directly, as its type is extended globally.
        req.user = { id: result.rows[0].user_id };
        next();
    } catch (err) {
        console.error("Authentication error:", err);
        return res.sendStatus(500);
    }
}
