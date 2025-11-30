
import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import { pool } from '../db.js';

export async function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    try {
        // Fetch user_id AND active_character_id
        const result = await pool.query('SELECT user_id, active_character_id FROM sessions WHERE token = $1', [token]);
        if (result.rows.length === 0) {
            return res.status(403).json({ message: "Invalid token" });
        }
        
        const session = result.rows[0];
        
        // Attach both to request
        req.user = { 
            id: session.user_id,
            characterId: session.active_character_id
        };
        
        next();
    } catch (err) {
        console.error("Authentication error:", err);
        return res.sendStatus(500);
    }
}
