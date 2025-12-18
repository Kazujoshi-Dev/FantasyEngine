
import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import { pool } from '../db.js';

export async function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    try {
        const result = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
        if (result.rows.length === 0) {
            return res.status(403).json({ message: "Invalid token" });
        }
        
        const userId = result.rows[0].user_id;
        req.user = { id: userId };

        // Background update of last activity for accurate Online status
        pool.query('UPDATE sessions SET last_active_at = NOW() WHERE token = $1', [token]).catch(err => {
            console.error("Failed to update session activity:", err);
        });

        next();
    } catch (err) {
        console.error("Authentication error:", err);
        return res.sendStatus(500);
    }
}
