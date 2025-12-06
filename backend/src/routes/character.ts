
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, EssenceType } from '../types.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

const getChestCapacity = (level: number) => Math.floor(500 * Math.pow(level, 1.8));

const getChestUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 6) essences.push({ type: EssenceType.Uncommon, amount: Math.floor((level - 5) / 2) + 1 });
    return { gold, essences };
};

const getBackpackUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 4 && level <= 6) essences.push({ type: EssenceType.Common, amount: (level - 3) * 5 });
    if (level >= 7 && level <= 8) essences.push({ type: EssenceType.Uncommon, amount: (level - 6) * 3 });
    if (level >= 9) essences.push({ type: EssenceType.Rare, amount: level - 8 });
    return { gold, essences };
};

// Get Character
router.get('/character', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.json(null);
        }
        res.json(result.rows[0].data);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch character' });
    }
});

// Create Character
router.post('/character', authenticateToken, async (req: any, res: any) => {
    const { name, race, startLocationId } = req.body;
    
    // Basic validation
    if (!name || name.length > 20) return res.status(400).json({ message: 'Invalid name' });

    const newCharacter: PlayerCharacter = {
        name,
        race,
        level: 1,
        experience: 0,
        experienceToNextLevel: 100,
        stats: {
            strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0, statPoints: 10,
            currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10, currentMana: 20, maxMana: 20,
            minDamage: 0, maxDamage: 0, magicDamageMin: 0, magicDamageMax: 0, critChance: 0, critDamageModifier: 200, armor: 0, armorPenetrationPercent: 0, armorPenetrationFlat: 0,
            attacksPerRound: 1, manaRegen: 0, lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0, dodgeChance: 0
        },
        resources: { gold: 500, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
        currentLocationId: startLocationId,
        activeExpedition: null,
        activeTravel: null,
        camp: { level: 1 },
        chest: { level: 1, gold: 0 },
        backpack: { level: 1 },
        isResting: false,
        restStartHealth: 0,
        lastEnergyUpdateTime: Date.now(),
        equipment: { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
        inventory: [],
        pvpWins: 0,
        pvpLosses: 0,
        pvpProtectionUntil: 0,
        questProgress: [],
        acceptedQuests: []
    };

    try {
        await pool.query('INSERT INTO characters (user_id, data) VALUES ($1, $2)', [req.user.id, JSON.stringify(newCharacter)]);
        res.status(201).json(newCharacter);
    } catch (err: any) {
        if (err.code === '23505') return res.status(409).json({ message: 'Character already exists for this user' });
        res.status(500).json({ message: 'Failed to create character' });
    }
});

// Update Character (Sync)
router.put('/character', authenticateToken, async (req: any, res: any) => {
    const character = req.body;
    try {
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        res.json(character);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update character' });
    }
});

// Upgrade Chest
router.post('/character/upgrade-chest', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const cost = getChestUpgradeCost(character.chest.level);
        
         // Check Gold
        if ((character.resources.gold || 0) < cost.gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); 
        }
        // Check Essences
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` }); 
            }
        }

        // Deduct & Upgrade
        character.resources.gold -= cost.gold;
        for (const e of cost.essences) character.resources[e.type] -= e.amount;
        character.chest.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Upgrade failed' });
    } finally { client.release(); }
});

// Chest Deposit
router.post('/character/chest/deposit', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const depositAmount = parseInt(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;

        // Init chest if missing
        if (!character.chest) character.chest = { level: 1, gold: 0 };
        
        // Validate Funds
        if ((character.resources.gold || 0) < depositAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold in inventory.' });
        }

        // Validate Capacity
        const capacity = getChestCapacity(character.chest.level);
        const currentChestGold = Number(character.chest.gold) || 0;
        const space = capacity - currentChestGold;
        
        if (space <= 0) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Chest is full.' });
        }

        const actualDeposit = Math.min(depositAmount, space);

        // Execute Transfer
        character.resources.gold -= actualDeposit;
        character.chest.gold = currentChestGold + actualDeposit;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Deposit failed' });
    } finally {
        client.release();
    }
});

// Chest Withdraw
router.post('/character/chest/withdraw', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const withdrawAmount = parseInt(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;

        // Init chest if missing
        if (!character.chest) character.chest = { level: 1, gold: 0 };
        
        const currentChestGold = Number(character.chest.gold) || 0;

        // Validate Funds in Chest
        if (currentChestGold < withdrawAmount) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold in chest.' });
        }

        // Execute Transfer
        character.chest.gold = currentChestGold - withdrawAmount;
        character.resources.gold = (Number(character.resources.gold) || 0) + withdrawAmount;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Withdraw failed' });
    } finally {
        client.release();
    }
});

// Upgrade Backpack
router.post('/character/upgrade-backpack', authenticateToken, async (req: any, res: any) => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;

        // Init backpack level if missing
        if (!character.backpack) character.backpack = { level: 1 };
        const currentLevel = character.backpack.level || 1;

        if(currentLevel >= 10) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Backpack is already at max level' });
        }

        const cost = getBackpackUpgradeCost(currentLevel);

         // Check Gold
        if ((character.resources.gold || 0) < cost.gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); 
        }
        // Check Essences
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` }); 
            }
        }

        // Deduct & Upgrade
        character.resources.gold -= cost.gold;
        for (const e of cost.essences) character.resources[e.type] -= e.amount;
        character.backpack.level = currentLevel + 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Upgrade failed' });
    } finally {
        client.release();
    }
});

// Route to get character names for compose message autocomplete
router.get('/characters/names', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT data->>'name' as name FROM characters");
        const names = result.rows.map(row => row.name);
        res.json(names);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch names' });
    }
});

export default router;
