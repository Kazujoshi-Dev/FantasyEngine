
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, CharacterStats, EquipmentSlot, ItemInstance, EssenceType, CharacterClass, ItemRarity, GameData, ItemTemplate, Affix } from '../types.js';
import { getCampUpgradeCost, getChestUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getWarehouseCapacity, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

// GET / - Fetch Character (Mapped from /api/character)
router.get('/', authenticateToken, async (req: any, res: any) => {
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

// POST / - Create Character
router.post('/', authenticateToken, async (req: any, res: any) => {
    const { name, race, startLocationId } = req.body;
    try {
        const existing = await pool.query('SELECT 1 FROM characters WHERE user_id = $1', [req.user.id]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Character already exists' });
        
        const nameCheck = await pool.query("SELECT 1 FROM characters WHERE data->>'name' = $1", [name]);
        if (nameCheck.rows.length > 0) return res.status(400).json({ message: 'Character name taken' });

        const defaultStats: CharacterStats = {
            strength: 5, agility: 5, accuracy: 5, stamina: 5, intelligence: 5, energy: 5, luck: 5, statPoints: 0,
            currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10, currentMana: 20, maxMana: 20,
            minDamage: 1, maxDamage: 2, magicDamageMin: 0, magicDamageMax: 0, critChance: 5, critDamageModifier: 150,
            armor: 0, armorPenetrationPercent: 0, armorPenetrationFlat: 0, attacksPerRound: 1, manaRegen: 5,
            lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0, dodgeChance: 0
        };
        
        // Race bonuses applied to base stats
        if (race === 'Dwarf') defaultStats.stamina += 2;
        if (race === 'Elf') defaultStats.intelligence += 2;
        if (race === 'Orc') defaultStats.strength += 2;
        if (race === 'Gnome') defaultStats.agility += 2;
        if (race === 'Human') { defaultStats.strength++; defaultStats.agility++; defaultStats.stamina++; defaultStats.intelligence++; }

        const newCharacter: PlayerCharacter = {
            name, race, level: 1, experience: 0, experienceToNextLevel: 100,
            stats: defaultStats,
            resources: { gold: 100, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            currentLocationId: startLocationId,
            activeExpedition: null, activeTravel: null,
            camp: { level: 1 },
            treasury: { level: 1, gold: 0 },
            warehouse: { level: 1, items: [] },
            backpack: { level: 1 },
            isResting: false, restStartHealth: 0, lastEnergyUpdateTime: Date.now(),
            equipment: { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            inventory: [],
            pvpWins: 0, pvpLosses: 0, pvpProtectionUntil: 0,
            questProgress: [], acceptedQuests: [],
            learnedSkills: [], activeSkills: []
        };
        
        if (startLocationId) {
             // Optional validation logic
        }

        await pool.query('INSERT INTO characters (user_id, data) VALUES ($1, $2)', [req.user.id, JSON.stringify(newCharacter)]);
        res.status(201).json(newCharacter);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// PUT / - Update Character
router.put('/', authenticateToken, async (req: any, res: any) => {
    const data = req.body;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        
        const char = result.rows[0].data;
        // Merge allowed fields
        if (data.isResting !== undefined) {
             char.isResting = data.isResting;
             if (char.isResting) char.restStartHealth = char.stats.currentHealth;
        }
        if (data.description !== undefined) char.description = data.description;
        if (data.avatarUrl !== undefined) char.avatarUrl = data.avatarUrl;
        if (data.settings !== undefined) char.settings = { ...char.settings, ...data.settings };
        if (data.email !== undefined) char.email = data.email;

        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        
        if (data.email) {
             try {
                 await pool.query('UPDATE users SET email = $1 WHERE id = $2', [data.email, req.user.id]);
             } catch(e: any) {
                 if (e.code === '23505') return res.status(409).json({ message: 'Email already exists.' });
             }
        }
        
        res.json(char);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// POST /class - Select Class
router.post('/class', authenticateToken, async (req: any, res: any) => {
    const { characterClass } = req.body;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = result.rows[0].data;
        
        if (char.level < 10) return res.status(400).json({ message: 'Level 10 required' });
        if (char.characterClass) return res.status(400).json({ message: 'Class already selected' });
        
        char.characterClass = characterClass;
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        res.json(char);
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// POST /stats - Distribute Points
router.post('/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body; 
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = result.rows[0].data;
        
        let cost = 0;
        for (const key in stats) {
            cost += stats[key] || 0;
        }
        
        if (char.stats.statPoints < cost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough stat points' });
        }
        
        char.stats.statPoints -= cost;
        for (const key in stats) {
            if (char.stats[key] !== undefined) {
                char.stats[key] += stats[key];
            }
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
});

// POST /stats/reset - Reset Attributes
router.post('/stats/reset', authenticateToken, async (req: any, res: any) => {
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

        const totalPoints = 10 + (character.level - 1);
        
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

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
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

// POST /heal - Heal Character
router.post('/heal', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        
        if (charRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Character not found' });
        }
        
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.activeExpedition || character.activeTravel) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot heal while busy.' });
        }

        character.stats.currentHealth = character.stats.maxHealth;
        character.stats.currentMana = character.stats.maxMana; 
        character.isResting = false; 

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to heal character' });
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
        
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        const currentLevel = character.treasury.level;
        
        const { gold, essences } = getChestUpgradeCost(currentLevel);
        
        if (character.resources.gold < gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' });
        }
        for (const e of essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` });
            }
        }
        
        character.resources.gold -= gold;
        essences.forEach(e => character.resources[e.type] -= e.amount);
        character.treasury.level = currentLevel + 1;

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

// POST /treasury/deposit
router.post('/treasury/deposit', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        
        if (character.resources.gold < amount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); }
        
        character.resources.gold -= amount;
        character.treasury.gold += amount;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({message:'Error'}); } finally { client.release(); }
});

// POST /treasury/withdraw
router.post('/treasury/withdraw', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };

        if (character.treasury.gold < amount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold in treasury' }); }
        
        character.treasury.gold -= amount;
        character.resources.gold += amount;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({message:'Error'}); } finally { client.release(); }
});

// POST /backpack/upgrade (Standardized path)
router.post('/backpack/upgrade', authenticateToken, async (req: any, res: any) => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const currentLevel = character.backpack?.level || 1;
        const { gold, essences } = getBackpackUpgradeCost(currentLevel);
        
         if (character.resources.gold < gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' });
        }
        for (const e of essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` });
            }
        }
        
        character.resources.gold -= gold;
        essences.forEach(e => character.resources[e.type] -= e.amount);
        if(!character.backpack) character.backpack = { level: 1 };
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
        
        const { gold, essences } = getWarehouseUpgradeCost(currentLevel);
         if (character.resources.gold < gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' });
        }
        for (const e of essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` });
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

// POST /warehouse/deposit
router.post('/warehouse/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) { await client.query('ROLLBACK'); return res.status(404).json({message: 'Item not found'}); }
        
        const capacity = getWarehouseCapacity(character.warehouse.level);
        if (character.warehouse.items.length >= capacity) {
             await client.query('ROLLBACK'); return res.status(400).json({message: 'Warehouse full'});
        }

        const item = character.inventory[itemIndex];
        character.inventory.splice(itemIndex, 1);
        character.warehouse.items.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({message:'Error'}); } finally { client.release(); }
});

// POST /warehouse/withdraw
router.post('/warehouse/withdraw', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };

        const itemIndex = character.warehouse.items.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) { await client.query('ROLLBACK'); return res.status(404).json({message: 'Item not found in warehouse'}); }
        
        const backpackCap = getBackpackCapacity(character);
        if (character.inventory.length >= backpackCap) {
             await client.query('ROLLBACK'); return res.status(400).json({message: 'Backpack full'});
        }

        const item = character.warehouse.items[itemIndex];
        character.warehouse.items.splice(itemIndex, 1);
        character.inventory.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({message:'Error'}); } finally { client.release(); }
});

// POST /resources/convert
router.post('/resources/convert', authenticateToken, async (req: any, res: any) => {
    const { fromType } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const conversionCosts: Record<string, number> = {
            [EssenceType.Common]: 100,
            [EssenceType.Uncommon]: 250,
            [EssenceType.Rare]: 500,
            [EssenceType.Epic]: 1000
        };
        const cost = conversionCosts[fromType];
        if (!cost) { await client.query('ROLLBACK'); return res.status(400).json({message: 'Invalid conversion type'}); }

        if ((character.resources[fromType as EssenceType] || 0) < 5) { await client.query('ROLLBACK'); return res.status(400).json({message: 'Not enough essence'}); }
        if (character.resources.gold < cost) { await client.query('ROLLBACK'); return res.status(400).json({message: 'Not enough gold'}); }

        let toType: EssenceType | null = null;
        if (fromType === EssenceType.Common) toType = EssenceType.Uncommon;
        if (fromType === EssenceType.Uncommon) toType = EssenceType.Rare;
        if (fromType === EssenceType.Rare) toType = EssenceType.Epic;
        if (fromType === EssenceType.Epic) toType = EssenceType.Legendary;

        if (!toType) { await client.query('ROLLBACK'); return res.status(400).json({message: 'Max tier'}); }

        character.resources.gold -= cost;
        character.resources[fromType as EssenceType] -= 5;
        character.resources[toType] = (character.resources[toType] || 0) + 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({message:'Error'}); } finally { client.release(); }
});


// POST /equip
router.post('/equip', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        // Fetch Game Data for validation (Slots, etc)
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Item not found in inventory' }); }
        
        const item = character.inventory[itemIndex];
        const template = itemTemplates.find(t => t.id === item.templateId);
        if (!template) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Template not found' }); }

        // Logic for slots (simple for now, extend for rings/2h)
        let slot = template.slot;
        if (slot === 'consumable') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Cannot equip consumable' }); }
        
        // Handle Ring slots
        if (slot === 'ring') {
            if (!character.equipment.ring1) slot = EquipmentSlot.Ring1;
            else if (!character.equipment.ring2) slot = EquipmentSlot.Ring2;
            else slot = EquipmentSlot.Ring1; // Swap ring 1 if both full
        }
        
        // Handle 2H weapons
        if (template.slot === EquipmentSlot.TwoHand) {
            // Unequip both hands if occupied
            if (character.equipment.mainHand) {
                character.inventory.push(character.equipment.mainHand);
                character.equipment.mainHand = null;
            }
            if (character.equipment.offHand) {
                character.inventory.push(character.equipment.offHand);
                character.equipment.offHand = null;
            }
            slot = EquipmentSlot.TwoHand;
        }
        // Handle 1H equipping while 2H is equipped
        if ((template.slot === EquipmentSlot.MainHand || template.slot === EquipmentSlot.OffHand) && character.equipment.twoHand) {
             character.inventory.push(character.equipment.twoHand);
             character.equipment.twoHand = null;
        }

        // Swap
        const currentEquipped = character.equipment[slot as EquipmentSlot];
        if (currentEquipped) {
            character.inventory.push(currentEquipped);
        }
        
        character.equipment[slot as EquipmentSlot] = item;
        character.inventory.splice(itemIndex, 1);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /unequip
router.post('/unequip', authenticateToken, async (req: any, res: any) => {
    const { slot } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        const item = character.equipment[slot as EquipmentSlot];
        if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Slot is empty' }); }

        if (character.inventory.length >= getBackpackCapacity(character)) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Inventory full' });
        }

        character.equipment[slot as EquipmentSlot] = null;
        character.inventory.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /skills/learn
router.post('/skills/learn', authenticateToken, async (req: any, res: any) => {
    const { skillId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        const skillsRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        const skills: any[] = skillsRes.rows[0]?.data || [];
        const skill = skills.find(s => s.id === skillId);
        if (!skill) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Skill not found' }); }

        if ((character.learnedSkills || []).includes(skillId)) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Already learned' });
        }

        // Deduct cost
        for (const key in skill.cost) {
            if (character.resources[key as keyof typeof character.resources] < skill.cost[key]) {
                await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough resources' });
            }
            character.resources[key as keyof typeof character.resources] -= skill.cost[key];
        }

        if (!character.learnedSkills) character.learnedSkills = [];
        character.learnedSkills.push(skillId);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({message: 'Error'}); } finally { client.release(); }
});

// POST /skills/toggle
router.post('/skills/toggle', authenticateToken, async (req: any, res: any) => {
    const { skillId, isActive } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.activeSkills) character.activeSkills = [];
        
        if (isActive) {
            if (!character.activeSkills.includes(skillId)) character.activeSkills.push(skillId);
        } else {
            character.activeSkills = character.activeSkills.filter(id => id !== skillId);
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({message: 'Error'}); } finally { client.release(); }
});


// GET /profile/:name (Public Profile)
router.get('/profile/:name', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT c.data->>'name' as name, c.data->>'race' as race, c.data->>'characterClass' as "characterClass",
            (c.data->>'level')::int as level, (c.data->>'experience')::bigint as experience,
            (c.data->>'pvpWins')::int as "pvpWins", (c.data->>'pvpLosses')::int as "pvpLosses",
            c.data->>'description' as description, c.data->>'avatarUrl' as "avatarUrl",
            g.name as "guildName", g.tag as "guildTag",
            EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = c.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.data->>'name' = $1
        `, [req.params.name]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        res.json(result.rows[0]);
    } catch(e) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// GET /names (For Autocomplete)
router.get('/names', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query("SELECT data->>'name' as name FROM characters");
        res.json(result.rows.map(r => r.name));
    } catch(e) {
        res.status(500).json({ message: 'Error' });
    }
});

export default router;
