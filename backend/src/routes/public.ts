import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * Public routes for viewing shared combat reports and guild profiles.
 */

router.get('/report/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT message_type, subject, body, sender_name FROM messages WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Report not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

router.get('/raid/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM guild_raids WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Raid not found' });
        
        const raid = result.rows[0];
        res.json({
            message_type: 'raid_report',
            subject: 'Raport z Rajdu',
            body: {
                totalGold: raid.loot?.gold || 0,
                essencesFound: raid.loot?.essences || {},
                combatLog: raid.combat_log,
                huntingMembers: raid.attacker_participants,
                opponents: raid.defender_participants,
                isVictory: true 
            },
            sender_name: 'Gildia'
        });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

export default router;
