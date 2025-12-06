
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, EssenceType, GameData, EquipmentSlot, MessageType, ExpeditionRewardSummary, GuildBuff, CharacterStats } from '../types.js';
import { getBackpackCapacity } from '../logic/helpers.js';
import { processCompletedExpedition } from '../logic/expeditions.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js'; // Import stats calculator

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
        const result = await pool.query('SELECT data, guild_id FROM characters WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.json(null);
        }
        const char = result.rows[0].data;
        const guildId = result.rows[0].guild_id;
        
        // Attach active guild buffs if in a guild
        if (guildId) {
            const guildRes = await pool.query('SELECT active_buffs, buildings FROM guilds WHERE id = $1', [guildId]);
            if (guildRes.rows.length > 0) {
                const rawBuffs = guildRes.rows[0].active_buffs;
                const buildings = guildRes.rows[0].buildings || {};
                
                // Ensure buffs array is valid and filter expired ones on read
                const activeBuffs = Array.isArray(rawBuffs) 
                    ? (rawBuffs as GuildBuff[]).filter(b => b.expiresAt > Date.now()) 
                    : [];

                char.activeGuildBuffs = activeBuffs;
                char.guildBarracksLevel = buildings.barracks || 0;
                char.guildShrineLevel = buildings.shrine || 0;
            }
        }

        res.json(char);
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

// Update Character (Partial Update / Merge)
router.put('/character', authenticateToken, async (req: any, res: any) => {
    const updates = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }

        const currentData = charRes.rows[0].data;
        
        // Deep merge logic (simplified for top-level keys + settings, but robust enough for current usage)
        const updatedData = {
            ...currentData,
            ...updates,
            // Ensure we don't accidentally overwrite nested objects with partials if updates contains them shallowly
            // (Though in this specific case, App.tsx sends flat updates mostly. For 'settings', we might need care)
            settings: {
                ...currentData.settings,
                ...(updates.settings || {})
            }
        };

        // Specific logic for isResting toggle to snapshot health
        if (updates.isResting === true && !currentData.isResting) {
            updatedData.restStartHealth = currentData.stats.currentHealth;
            updatedData.lastRestTime = Date.now();
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(updatedData), req.user.id]);
        await client.query('COMMIT');
        
        res.json(updatedData);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Update character error:", err);
        res.status(500).json({ message: 'Failed to update character' });
    } finally {
        client.release();
    }
});

// Distribute Stat Points (Fix for "Unknown Error")
router.post('/character/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body; // Partial<CharacterStats> containing deltas
    
    if (!stats) return res.status(400).json({ message: 'Missing stats data' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;

        let totalPointsSpent = 0;
        const allowedStats = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];

        for (const [key, value] of Object.entries(stats)) {
            if (!allowedStats.includes(key)) continue;
            const points = Number(value);
            if (isNaN(points) || points < 0) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ message: 'Invalid stat value' });
            }
            totalPointsSpent += points;
        }

        if (character.stats.statPoints < totalPointsSpent) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough stat points' });
        }

        // Apply updates
        for (const [key, value] of Object.entries(stats)) {
            if (allowedStats.includes(key)) {
                (character.stats as any)[key] = ((character.stats as any)[key] || 0) + Number(value);
            }
        }
        character.stats.statPoints -= totalPointsSpent;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Stat distribution error:", err);
        res.status(500).json({ message: 'Failed to distribute stats' });
    } finally {
        client.release();
    }
});

// Reset Attributes
router.post('/character/stats/reset', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;

        const isFreeReset = !character.freeStatResetUsed;
        const resetCost = 100 * character.level;

        if (!isFreeReset && character.resources.gold < resetCost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold' });
        }

        // Calculate total points to return
        // 10 base points + (level - 1)
        const totalPoints = 10 + (character.level - 1);
        
        // Reset stats to 0
        character.stats.strength = 0;
        character.stats.agility = 0;
        character.stats.accuracy = 0;
        character.stats.stamina = 0;
        character.stats.intelligence = 0;
        character.stats.energy = 0;
        character.stats.luck = 0;
        
        character.stats.statPoints = totalPoints;

        if (!isFreeReset) {
            character.resources.gold -= resetCost;
        }
        character.freeStatResetUsed = true;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Stat reset error:", err);
        res.status(500).json({ message: 'Failed to reset stats' });
    } finally {
        client.release();
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

// Upgrade Camp
router.post('/character/camp/upgrade', authenticateToken, async (req: any, res: any) => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;

        // Init camp if missing
        if (!character.camp) character.camp = { level: 1 };
        const currentLevel = character.camp.level || 1;

        if(currentLevel >= 10) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Camp is already at max level' });
        }
        
        // Camp upgrade cost logic duplicated here for backend validation
        const goldCost = Math.floor(150 * Math.pow(currentLevel, 1.5));
        const essenceCosts: { type: EssenceType, amount: number }[] = [];
        if (currentLevel >= 5 && currentLevel <= 7) essenceCosts.push({ type: EssenceType.Common, amount: (currentLevel - 4) * 2 });
        if (currentLevel >= 8) essenceCosts.push({ type: EssenceType.Common, amount: 6 }, { type: EssenceType.Uncommon, amount: currentLevel - 7 });

         // Check Gold
        if ((character.resources.gold || 0) < goldCost) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); 
        }
        // Check Essences
        for (const e of essenceCosts) {
            if ((character.resources[e.type] || 0) < e.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` }); 
            }
        }

        // Deduct & Upgrade
        character.resources.gold -= goldCost;
        for (const e of essenceCosts) character.resources[e.type] -= e.amount;
        character.camp.level = currentLevel + 1;

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

// POST /api/character/heal - Full Heal
router.post('/character/heal', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        // RECALCULATE maxHealth to ensure it's not corrupted/stale before setting currentHealth
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const derivedChar = calculateDerivedStatsOnServer(character, itemTemplates, affixes);
        const safeMaxHealth = derivedChar.stats.maxHealth || 50;
        const safeMaxMana = derivedChar.stats.maxMana || 20;

        character.stats.currentHealth = safeMaxHealth;
        character.stats.currentMana = safeMaxMana;

        // Ensure max stats are also synced back to stored object to prevent mismatch
        character.stats.maxHealth = safeMaxHealth;
        character.stats.maxMana = safeMaxMana;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Heal error:", err);
        res.status(500).json({ message: 'Failed to heal character' });
    } finally {
        client.release();
    }
});

// POST /api/character/equip
router.post('/character/equip', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        
        const character: PlayerCharacter = charRes.rows[0].data;
        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        
        if (itemIndex === -1) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Item not found in inventory' });
        }

        const itemToEquip = character.inventory[itemIndex];
        
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates = gameDataRes.rows[0]?.data || [];
        const template = itemTemplates.find((t: any) => t.id === itemToEquip.templateId);

        if (!template) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid item template' });
        }

        // Handle Consumables
        if (template.slot === 'consumable') {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Consumables not implemented yet via equip endpoint.' });
        }

        // Unequip existing item in slot
        let slotToEquip = template.slot as EquipmentSlot;
        
        // Handle Rings
        if (template.slot === 'ring') {
             if (!character.equipment[EquipmentSlot.Ring1]) slotToEquip = EquipmentSlot.Ring1;
             else if (!character.equipment[EquipmentSlot.Ring2]) slotToEquip = EquipmentSlot.Ring2;
             else slotToEquip = EquipmentSlot.Ring1; // Swap Ring1 by default
        }
        
        // Handle 2H Weapons
        if (template.slot === 'twoHand') {
             slotToEquip = EquipmentSlot.TwoHand;
             // Must unequip MainHand and OffHand if present
             if (character.equipment[EquipmentSlot.MainHand]) {
                 character.inventory.push(character.equipment[EquipmentSlot.MainHand]!);
                 character.equipment[EquipmentSlot.MainHand] = null;
             }
             if (character.equipment[EquipmentSlot.OffHand]) {
                 character.inventory.push(character.equipment[EquipmentSlot.OffHand]!);
                 character.equipment[EquipmentSlot.OffHand] = null;
             }
        }

        // Handle 1H/Offhand replacing 2H
        if ((template.slot === 'mainHand' || template.slot === 'offHand') && character.equipment[EquipmentSlot.TwoHand]) {
             character.inventory.push(character.equipment[EquipmentSlot.TwoHand]!);
             character.equipment[EquipmentSlot.TwoHand] = null;
        }

        const existingItem = character.equipment[slotToEquip];
        if (existingItem) {
            character.inventory.push(existingItem);
        }

        character.equipment[slotToEquip] = itemToEquip;
        character.inventory.splice(itemIndex, 1);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to equip item' });
    } finally {
        client.release();
    }
});

// POST /api/character/unequip
router.post('/character/unequip', authenticateToken, async (req: any, res: any) => {
    const { slot } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        const itemToUnequip = character.equipment[slot as EquipmentSlot];
        if (!itemToUnequip) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'No item in that slot' });
        }

        if (character.inventory.length >= getBackpackCapacity(character)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Inventory is full' });
        }

        character.inventory.push(itemToUnequip);
        character.equipment[slot as EquipmentSlot] = null;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to unequip item' });
    } finally {
        client.release();
    }
});

// POST /api/expedition/start
router.post('/expedition/start', authenticateToken, async (req: any, res: any) => {
    const { expeditionId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.activeExpedition) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Already on an expedition' });
        }
        
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'expeditions'");
        const expeditions = gameDataRes.rows[0]?.data || [];
        const expedition = expeditions.find((e: any) => e.id === expeditionId);

        if (!expedition) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Expedition not found' });
        }

        if (character.resources.gold < expedition.goldCost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        if (character.stats.currentEnergy < expedition.energyCost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough energy' });
        }

        character.resources.gold -= expedition.goldCost;
        character.stats.currentEnergy -= expedition.energyCost;
        
        character.activeExpedition = {
            expeditionId,
            finishTime: Date.now() + (expedition.duration * 1000),
            enemies: [], // populated on completion
            combatLog: [],
            rewards: { gold: 0, experience: 0 }
        };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to start expedition' });
    } finally {
        client.release();
    }
});

// POST /api/expedition/complete
router.post('/expedition/complete', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data, guild_id FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        const guildId = charRes.rows[0].guild_id;

        if (!character.activeExpedition) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No active expedition' });
        }

        if (Date.now() < character.activeExpedition.finishTime) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Expedition not finished yet' });
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);

        // Fetch Guild Building Levels (if any) and Active Buffs
        let barracksLevel = 0;
        let scoutHouseLevel = 0;
        let shrineLevel = 0;
        let activeGuildBuffs: GuildBuff[] = [];

        if (guildId) {
            const guildRes = await client.query('SELECT buildings, active_buffs FROM guilds WHERE id = $1', [guildId]);
            if (guildRes.rows.length > 0) {
                const buildings = guildRes.rows[0].buildings || {};
                barracksLevel = buildings.barracks || 0;
                scoutHouseLevel = buildings.scoutHouse || 0;
                shrineLevel = buildings.shrine || 0;
                
                // Filter expired buffs
                const rawBuffs = guildRes.rows[0].active_buffs || [];
                activeGuildBuffs = Array.isArray(rawBuffs) 
                    ? (rawBuffs as GuildBuff[]).filter(b => b.expiresAt > Date.now()) 
                    : [];
            }
        }

        // Inject active buffs into character for calculation
        character.activeGuildBuffs = activeGuildBuffs;

        const { updatedCharacter, summary, expeditionName } = processCompletedExpedition(character, gameData, barracksLevel, scoutHouseLevel, shrineLevel);
        
        // Update guild building levels on character for client-side display (optional sync)
        updatedCharacter.guildBarracksLevel = barracksLevel;
        updatedCharacter.guildShrineLevel = shrineLevel;

        // Clean transient property before saving
        delete updatedCharacter.activeGuildBuffs;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [updatedCharacter, req.user.id]);
        
        // Save report message
        const messageRes = await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) 
             VALUES ($1, 'System', 'expedition_report', $2, $3) RETURNING id`,
            [req.user.id, `Raport z Wyprawy: ${expeditionName}`, JSON.stringify(summary)]
        );

        await client.query('COMMIT');
        
        res.json({ updatedCharacter, summary, messageId: messageRes.rows[0].id });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to complete expedition' });
    } finally {
        client.release();
    }
});

// POST /api/expedition/cancel
router.post('/expedition/cancel', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.activeExpedition) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'No active expedition' });
        }

        // Refund resources logic (optional, here implemented)
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'expeditions'");
        const expeditions = gameDataRes.rows[0]?.data || [];
        const expedition = expeditions.find((e: any) => e.id === character.activeExpedition!.expeditionId);

        if (expedition) {
            character.resources.gold += expedition.goldCost;
            character.stats.currentEnergy += expedition.energyCost;
        }

        character.activeExpedition = null;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to cancel expedition' });
    } finally {
        client.release();
    }
});

// POST /character/skills/learn
router.post('/character/skills/learn', authenticateToken, async (req: any, res: any) => {
    const { skillId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        const skills: any[] = gameDataRes.rows[0]?.data || [];
        const skill = skills.find(s => s.id === skillId);

        if (!skill) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Skill not found' }); }

        // Check if already learned
        if (character.learnedSkills && character.learnedSkills.includes(skillId)) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Skill already learned' });
        }

        // Validate Requirements
        if (skill.requirements) {
            if (character.level < (skill.requirements.level || 0)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Level too low' }); }
            const stats: any = character.stats;
            for (const stat of ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy']) {
                if (stats[stat] < (skill.requirements[stat] || 0)) {
                    await client.query('ROLLBACK'); return res.status(400).json({ message: `Insufficient ${stat}` });
                }
            }
        }

        // Validate Costs
        if (skill.cost) {
            if ((character.resources.gold || 0) < (skill.cost.gold || 0)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); }
            for (const type of Object.values(EssenceType)) {
                if ((character.resources[type] || 0) < (skill.cost[type] || 0)) {
                     await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${type}` });
                }
            }
        }

        // Deduct Cost
        if (skill.cost) {
            character.resources.gold -= (skill.cost.gold || 0);
            for (const type of Object.values(EssenceType)) {
                 if (skill.cost[type]) character.resources[type] -= skill.cost[type];
            }
        }

        // Learn Skill
        if (!character.learnedSkills) character.learnedSkills = [];
        character.learnedSkills.push(skillId);

        // If passive, apply effect immediately if applicable (e.g. static stat bonus not handled by derivedStats)
        // For now, derivedStats handles passives.

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to learn skill' });
    } finally {
        client.release();
    }
});

// POST /character/skills/toggle
router.post('/character/skills/toggle', authenticateToken, async (req: any, res: any) => {
    const { skillId, isActive } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.learnedSkills || !character.learnedSkills.includes(skillId)) {
            await client.query('ROLLBACK'); return res.status(400).json({ message: 'Skill not learned' });
        }
        
        // Ensure activeSkills array exists
        if (!character.activeSkills) character.activeSkills = [];

        if (isActive) {
            if (!character.activeSkills.includes(skillId)) {
                character.activeSkills.push(skillId);
            }
        } else {
            character.activeSkills = character.activeSkills.filter(id => id !== skillId);
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to toggle skill' });
    } finally {
        client.release();
    }
});

// POST /character/class
router.post('/character/class', authenticateToken, async (req: any, res: any) => {
    const { characterClass } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.level < 10) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Level 10 required' });
        }
        if (character.characterClass) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Class already selected' });
        }
        
        // Validate class against race (Optional, but good practice)
        // ... (validation logic here based on Race enum)

        character.characterClass = characterClass;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to select class' });
    } finally {
        client.release();
    }
});

export default router;
