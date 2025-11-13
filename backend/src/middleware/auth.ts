// FIX: Use Request, Response, and NextFunction types directly from express to resolve type conflicts.
import express, { NextFunction } from 'express';
import { pool } from '../db.js';

// FIX: Use Request, Response, and NextFunction to resolve type conflicts.
export async function authenticateToken(req: express.Request, res: express.Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    try {
        const result = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
        if (result.rows.length === 0) {
            return res.status(403).json({ message: "Invalid token" });
        }
        req.user = { id: result.rows[0].user_id };
        next();
    } catch (err) {
        console.error("Authentication error:", err);
        return res.sendStatus(500);
    }
}