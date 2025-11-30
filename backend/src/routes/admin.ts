
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter } from '../types.js';

const router = express.Router();

// Middleware to check admin status
router.use(async (req: any, res: any, next: any) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: 'Server error during admin check' });
    }
});

// POST /api/admin/characters/:userId/reset-stats
router.post('/characters/:userId/reset-stats', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;

        // Calculate points to refund
        const levelPoints = character.level > 1 ? (character.level - 1) : 0;
        const totalPoints = 10 + levelPoints;

        character.stats = {
            ...character.stats,
            strength: 0,
            agility: 0,
            accuracy: 0,
            stamina: 0,
            intelligence: 0,
            energy: 0,
            statPoints: totalPoints
        };
        character.freeStatResetUsed = true;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to reset stats' });
    } finally {
        client.release();
    }
});

// POST /api/admin/characters/:userId/reset-progress
router.post('/characters/:userId/reset-progress', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        const oldChar: PlayerCharacter = charRes.rows[0].data;

        // Construct fresh state based on createCharacter logic but keeping identity
        const resetChar: PlayerCharacter = {
            name: oldChar.name,
            race: oldChar.race,
            // Reset identity-bound progression
            characterClass: null,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: {
                strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0,
                statPoints: 10,
                currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10,
                currentMana: 20, maxMana: 20,
                minDamage: 0, maxDamage: 0,
                magicDamageMin: 0, magicDamageMax: 0,
                critChance: 0,
                critDamageModifier: 200,
                armor: 0,
                armorPenetrationPercent: 0,
                armorPenetrationFlat: 0,
                attacksPerRound: 1,
                manaRegen: 0,
                lifeStealPercent: 0,
                lifeStealFlat: 0,
                manaStealPercent: 0,
                manaStealFlat: 0,
                dodgeChance: 0,
            },
            resources: { 
                gold: 500,
                commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0,
            },
            currentLocationId: oldChar.currentLocationId, // Keep location to avoid bugs if map changed
            activeExpedition: null,
            activeTravel: null,
            camp: { level: 1 },
            chest: { level: 1, gold: 0 },
            backpack: { level: 1 },
            isResting: false,
            restStartHealth: 0,
            lastRestTime: undefined,
            lastEnergyUpdateTime: Date.now(),
            equipment: {
                head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, 
                ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null,
            },
            inventory: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0,
            learnedSkills: [],
            questProgress: [],
            acceptedQuests: [],
            freeStatResetUsed: false,
            settings: oldChar.settings, // Keep settings like language
            avatarUrl: oldChar.avatarUrl, // Keep cosmetic
            description: oldChar.description // Keep cosmetic
        };
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [resetChar, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to reset progress' });
    } finally {
        client.release();
    }
});

// POST /api/admin/characters/:userId/heal
router.post('/characters/:userId/heal', async (req: any, res: any) => {
    try {
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.userId]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        
        const character: PlayerCharacter = charRes.rows[0].data;
        character.stats.currentHealth = character.stats.maxHealth;
        character.stats.currentMana = character.stats.maxMana;
        
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to heal character' });
    }
});

// POST /api/admin/characters/:userId/gold
router.post('/characters/:userId/gold', async (req: any, res: any) => {
    const { gold } = req.body;
    try {
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.userId]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        
        const character: PlayerCharacter = charRes.rows[0].data;
        character.resources.gold = (character.resources.gold || 0) + parseInt(gold);
        
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update gold' });
    }
});

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', async (req: any, res: any) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

// DELETE /api/admin/characters/:userId
router.delete('/characters/:userId', async (req: any, res: any) => {
    try {
        await pool.query('DELETE FROM characters WHERE user_id = $1', [req.params.userId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete character' });
    }
});

export default router;
