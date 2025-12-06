import express from 'express';
import { pool } from '../db.js';
import { PlayerCharacter } from '../types.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/admin/character/:userId/update-gold
router.post('/character/:userId/update-gold', authenticateToken, async (req: any, res: any) => {
    // Basic admin check via username for now, assuming 'Kazujoshi' is admin
    // In a real app, use roles.
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
    if (userRes.rows[0]?.username !== 'Kazujoshi') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { gold } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;
        character.resources.gold = Number(gold);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to update gold' });
    } finally {
        client.release();
    }
});

// POST /api/admin/character/:userId/update-details
router.post('/character/:userId/update-details', authenticateToken, async (req: any, res: any) => {
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
    if (userRes.rows[0]?.username !== 'Kazujoshi') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { race, characterClass, level } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        
        let character: PlayerCharacter = charRes.rows[0].data;
        let statsUpdated = false;

        if (race) {
            character.race = race;
        }

        if (characterClass !== undefined) {
            character.characterClass = characterClass || null;
        }

        if (level !== undefined && level !== character.level) {
            const newLevel = Math.max(1, Number(level));
            character.level = newLevel;
            character.experience = 0; 
            character.experienceToNextLevel = Math.floor(100 * Math.pow(newLevel, 1.3));

            const expectedTotalPoints = 10 + (newLevel - 1);
            
            character.stats.strength = 0;
            character.stats.agility = 0;
            character.stats.accuracy = 0;
            character.stats.stamina = 0;
            character.stats.intelligence = 0;
            character.stats.energy = 0;
            character.stats.luck = 0;
            
            character.stats.statPoints = expectedTotalPoints;
            
            character.stats.currentHealth = 50;
            character.stats.maxHealth = 50;
            character.stats.currentMana = 20;
            character.stats.maxMana = 20;
            character.stats.currentEnergy = 10;
            character.stats.maxEnergy = 10;

            statsUpdated = true;
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        
        res.json({ message: 'Character details updated', statsReset: statsUpdated });
    } catch(err: any) {
        await client.query('ROLLBACK');
        console.error("Update details error:", err);
        res.status(500).json({ message: 'Failed to update details: ' + err.message });
    } finally {
        client.release();
    }
});

// POST /api/admin/characters/:userId/regenerate-energy
router.post('/characters/:userId/regenerate-energy', authenticateToken, async (req: any, res: any) => {
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
    if (userRes.rows[0]?.username !== 'Kazujoshi') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;
        
        // Reset to max (simplified, real logic uses derived stats but this is admin force)
        // We can assume maxEnergy is stored in stats or just force it high
        character.stats.currentEnergy = character.stats.maxEnergy || 10;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to regenerate energy' });
    } finally {
        client.release();
    }
});

export default router;