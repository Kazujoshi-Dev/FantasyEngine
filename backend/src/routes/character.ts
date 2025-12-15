
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost } from '../logic/stats.js';

const router = express.Router();

// GET /api/character - Get Character Data
router.get('/', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.json(null); // No character yet
        }
        res.json(result.rows[0].data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch character' });
    }
});

// POST /api/character - Create Character
router.post('/', authenticateToken, async (req: any, res: any) => {
    const { name, race, startLocationId } = req.body;
    
    if (!name || !race || !startLocationId) {
        return res.status(400).json({ message: 'Name, race and start location are required.' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Check if character already exists for user
        const existing = await client.query('SELECT 1 FROM characters WHERE user_id = $1', [req.user.id]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Character already exists.' });
        }
        
        // Check name uniqueness
        const nameCheck = await client.query("SELECT 1 FROM characters WHERE data->>'name' = $1", [name]);
        if (nameCheck.rows.length > 0) {
             await client.query('ROLLBACK');
             return res.status(409).json({ message: 'Character name already taken.' });
        }
        
        const newCharacter: PlayerCharacter = {
            id: req.user.id, // Using user_id as character ID logically, but in DB it's auto-inc or user_id FK
            user_id: req.user.id,
            username: '', // Populated by join usually, here empty for storage
            name,
            race,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: {
                strength: 1, agility: 1, accuracy: 1, stamina: 1, intelligence: 1, energy: 1, luck: 1, statPoints: 10,
                currentHealth: 50, maxHealth: 50, currentMana: 20, maxMana: 20, currentEnergy: 10, maxEnergy: 10,
                minDamage: 1, maxDamage: 2, magicDamageMin: 0, magicDamageMax: 0,
                armor: 0, critChance: 0, critDamageModifier: 200, attacksPerRound: 1, dodgeChance: 0, manaRegen: 0,
                armorPenetrationPercent: 0, armorPenetrationFlat: 0, lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0
            },
            resources: { gold: 100, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            equipment: { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            inventory: [],
            currentLocationId: startLocationId,
            activeTravel: null,
            activeExpedition: null,
            isResting: false,
            restStartHealth: 0,
            lastRestTime: Date.now(),
            lastEnergyUpdateTime: Date.now(),
            backpack: { level: 1 },
            camp: { level: 1 },
            treasury: { level: 1, gold: 0 },
            warehouse: { level: 1, items: [] },
            acceptedQuests: [],
            questProgress: [],
            learnedSkills: [],
            activeSkills: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0
        };
        
        await client.query('INSERT INTO characters (user_id, data) VALUES ($1, $2)', [req.user.id, JSON.stringify(newCharacter)]);
        await client.query('COMMIT');
        
        res.status(201).json(newCharacter);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Create Character Error:", err);
        res.status(500).json({ message: 'Failed to create character.' });
    } finally {
        client.release();
    }
});

// POST /camp/upgrade - Upgrade Camp
router.post('/camp/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const currentLevel = character.camp?.level || 1;
        if (currentLevel >= 10) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Max level reached' });
        }
        
        const { gold, essences } = getCampUpgradeCost(currentLevel);
        
        if (character.resources.gold < gold) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        for (const e of essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough ${e.type}` });
            }
        }
        
        character.resources.gold -= gold;
        essences.forEach(e => character.resources[e.type] -= e.amount);
        
        if (!character.camp) {
            character.camp = { level: 1 };
        }
        character.camp.level = currentLevel + 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
});

// POST /treasury/upgrade
router.post('/treasury/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        // Initialize if missing
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        // Fallback for migration
        if (character.chest && !character.treasury) character.treasury = character.chest;

        const currentLevel = character.treasury.level;
        
        const { gold, essences } = getTreasuryUpgradeCost(currentLevel);
        
        if (character.resources.gold < gold) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        for (const e of essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough ${e.type}` });
            }
        }
        
        character.resources.gold -= gold;
        essences.forEach(e => character.resources[e.type] -= e.amount);
        character.treasury.level = currentLevel + 1;
        character.chest = character.treasury; // Keep legacy field synced

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
});

// POST /backpack/upgrade
router.post('/backpack/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const currentLevel = character.backpack?.level || 1;
        if (currentLevel >= 10) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Max level reached' });
        }
        
        const { gold, essences } = getBackpackUpgradeCost(currentLevel);
        
        if (character.resources.gold < gold) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        for (const e of essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough ${e.type}` });
            }
        }
        
        character.resources.gold -= gold;
        essences.forEach(e => character.resources[e.type] -= e.amount);
        
        if (!character.backpack) character.backpack = { level: 1 };
        character.backpack.level = currentLevel + 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
});

// POST /warehouse/upgrade
router.post('/warehouse/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };

        const currentLevel = character.warehouse.level;
        if (currentLevel >= 10) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Max level reached' });
        }

        const { gold, essences } = getWarehouseUpgradeCost(currentLevel);
        
        if (character.resources.gold < gold) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        for (const e of essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough ${e.type}` });
            }
        }
        
        character.resources.gold -= gold;
        essences.forEach(e => character.resources[e.type] -= e.amount);
        character.warehouse.level = currentLevel + 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
});

export default router;
