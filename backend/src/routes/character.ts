
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, ActiveTowerRun, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, SkillCost, EssenceType, CharacterClass, CharacterResources } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getTreasuryCapacity, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// GET /api/character - Get Character Data
router.get('/', authenticateToken, async (req: any, res: any) => {
    try {
        const client = await pool.connect();
        try {
            // Fetch character data AND check for active tower run AND guild info in one go
            // Added JOIN users to fetch email
            const result = await client.query(`
                SELECT 
                    c.data,
                    u.email,
                    g.buildings,
                    g.active_buffs,
                    g.id as guild_id,
                    (
                        SELECT row_to_json(tr) 
                        FROM tower_runs tr 
                        WHERE tr.user_id = c.user_id AND tr.status = 'IN_PROGRESS'
                        LIMIT 1
                    ) as active_tower_run
                FROM characters c 
                JOIN users u ON c.user_id = u.id
                LEFT JOIN guild_members gm ON c.user_id = gm.user_id
                LEFT JOIN guilds g ON gm.guild_id = g.id
                WHERE c.user_id = $1
            `, [req.user.id]);

            if (result.rows.length === 0) {
                return res.json(null); // No character yet
            }

            const row = result.rows[0];
            const charData: PlayerCharacter = row.data;
            const activeRunDB = row.active_tower_run;

            // Inject Email from users table
            if (row.email) {
                charData.email = row.email;
            }

            // Inject Guild Data for Stat Calculation
            if (row.guild_id) {
                charData.guildId = row.guild_id;
                charData.guildBarracksLevel = row.buildings?.barracks || 0;
                charData.guildShrineLevel = row.buildings?.shrine || 0;
                charData.activeGuildBuffs = row.active_buffs || [];
            } else {
                // Ensure fields are reset if user left guild
                charData.guildId = undefined;
                charData.guildBarracksLevel = 0;
                charData.guildShrineLevel = 0;
                charData.activeGuildBuffs = [];
            }

            // Inject active tower run into character data if it exists
            if (activeRunDB) {
                const mappedRun: ActiveTowerRun = {
                    id: activeRunDB.id,
                    userId: activeRunDB.user_id,
                    towerId: activeRunDB.tower_id,
                    currentFloor: activeRunDB.current_floor,
                    currentHealth: activeRunDB.current_health,
                    currentMana: activeRunDB.current_mana,
                    accumulatedRewards: activeRunDB.accumulated_rewards,
                    status: activeRunDB.status
                };
                charData.activeTowerRun = mappedRun;
            } else {
                charData.activeTowerRun = undefined;
            }

            res.json(charData);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch character' });
    }
});

// GET /api/character/names - Get list of all character names (for messages)
router.get('/names', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`SELECT data->>'name' as name FROM characters ORDER BY name ASC`);
        const names = result.rows.map(row => row.name);
        res.json(names);
    } catch (err) {
        res.status(500).json({ message: 'Failed' });
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
                strength: 1, agility: 1, accuracy: 1, stamina: 1, intelligence: 1, energy: 1, luck: 1, statPoints: 20,
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

// POST /character/equip
router.post('/equip', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Fetch Character & Metadata
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        // FETCH ALL NECESSARY DATA FOR STAT CALCULATION
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        const skills = gameDataRes.rows.find(r => r.key === 'skills')?.data || [];

        // FETCH GUILD DATA
        const guildRes = await client.query(`
            SELECT g.buildings, g.active_buffs
            FROM guild_members gm
            JOIN guilds g ON gm.guild_id = g.id
            WHERE gm.user_id = $1
        `, [req.user.id]);

        let barracksLevel = 0;
        let shrineLevel = 0;
        let activeBuffs = [];

        if (guildRes.rows.length > 0) {
            barracksLevel = guildRes.rows[0].buildings?.barracks || 0;
            shrineLevel = guildRes.rows[0].buildings?.shrine || 0;
            activeBuffs = guildRes.rows[0].active_buffs || [];
        }

        // 2. Find Item in Inventory
        const inventoryIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (inventoryIndex === -1) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Item not found in inventory' });
        }
        const itemToEquip = character.inventory[inventoryIndex];
        const template = itemTemplates.find(t => t.id === itemToEquip.templateId);

        if (!template) {
             await client.query('ROLLBACK');
             return res.status(500).json({ message: 'Item template data missing' });
        }

        // 3. Validation
        if (character.level < template.requiredLevel) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Level requirement not met' });
        }
        if (template.requiredStats) {
             // CALCULATE DERIVED STATS FOR VALIDATION
             const characterWithStats = calculateDerivedStatsOnServer(
                character,
                itemTemplates,
                affixes,
                barracksLevel,
                shrineLevel,
                skills,
                activeBuffs
             );

             for (const stat of Object.keys(template.requiredStats)) {
                const key = stat as keyof CharacterStats;
                const reqValue = template.requiredStats[key] || 0;
                if ((characterWithStats.stats[key] || 0) < reqValue) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Requirement for ${stat} not met` });
                }
             }
        }

        // 4. Determine Target Slot
        let targetSlot: EquipmentSlot | null = null;
        if (template.slot === 'ring') {
            if (!character.equipment.ring1) targetSlot = EquipmentSlot.Ring1;
            else if (!character.equipment.ring2) targetSlot = EquipmentSlot.Ring2;
            else targetSlot = EquipmentSlot.Ring1; 
        } else if (template.slot === 'consumable') {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Cannot equip consumables' });
        } else {
            targetSlot = template.slot as EquipmentSlot;
        }

        if (!targetSlot) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Invalid slot' });
        }

        // 5. Handle Slot Conflicts (Two Handed vs One Handed)
        const itemsToUnequip: ItemInstance[] = [];

        if (targetSlot === EquipmentSlot.TwoHand) {
            if (character.equipment.mainHand) itemsToUnequip.push(character.equipment.mainHand);
            if (character.equipment.offHand) itemsToUnequip.push(character.equipment.offHand);
            character.equipment.mainHand = null;
            character.equipment.offHand = null;
        } else if (targetSlot === EquipmentSlot.MainHand || targetSlot === EquipmentSlot.OffHand) {
             if (character.equipment.twoHand) {
                itemsToUnequip.push(character.equipment.twoHand);
                character.equipment.twoHand = null;
            }
        }
        
        // Handle standard swap
        if (character.equipment[targetSlot]) {
            itemsToUnequip.push(character.equipment[targetSlot]!);
        }

        // 6. Execute Swap
        character.inventory.splice(inventoryIndex, 1);
        
        for (const unequipped of itemsToUnequip) {
            character.inventory.push(unequipped);
        }

        character.equipment[targetSlot] = itemToEquip;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');

        res.json(character);

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Equip Error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /character/unequip
router.post('/unequip', authenticateToken, async (req: any, res: any) => {
    const { slot } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;
        
        const itemToUnequip = character.equipment[slot as EquipmentSlot];
        if (!itemToUnequip) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Slot is empty' });
        }

        const capacity = getBackpackCapacity(character);
        if (character.inventory.length >= capacity) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Inventory is full' });
        }

        character.equipment[slot as EquipmentSlot] = null;
        character.inventory.push(itemToUnequip);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        
        res.json(character);

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Unequip Error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /camp/upgrade
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
        
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
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
        character.chest = character.treasury; 

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
    const depositAmount = parseInt(amount, 10);

    if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        if (character.chest && !character.treasury) character.treasury = character.chest;

        if ((character.resources.gold || 0) < depositAmount) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold to deposit' });
        }

        const capacity = getTreasuryCapacity(character.treasury.level);
        const currentStored = character.treasury.gold || 0;
        const spaceLeft = capacity - currentStored;

        if (spaceLeft <= 0) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Treasury is full' });
        }

        const actualDeposit = Math.min(depositAmount, spaceLeft);

        character.resources.gold -= actualDeposit;
        character.treasury.gold += actualDeposit;
        character.chest = character.treasury; 

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Treasury deposit error', err);
        res.status(500).json({ message: 'Error depositing gold' });
    } finally {
        client.release();
    }
});

// POST /treasury/withdraw
router.post('/treasury/withdraw', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const withdrawAmount = parseInt(amount, 10);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        if (character.chest && !character.treasury) character.treasury = character.chest;

        const currentStored = character.treasury.gold || 0;

        if (currentStored < withdrawAmount) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold in treasury' });
        }

        character.treasury.gold -= withdrawAmount;
        character.resources.gold = (character.resources.gold || 0) + withdrawAmount;
        character.chest = character.treasury; 

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Treasury withdraw error', err);
        res.status(500).json({ message: 'Error withdrawing gold' });
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

// POST /warehouse/deposit
router.post('/warehouse/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };

        // Check Capacity
        const cap = 5 + ((character.warehouse.level - 1) * 3);
        if (character.warehouse.items.length >= cap) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Warehouse full' });
        }
        
        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Item not found' });
        }
        const item = character.inventory[itemIndex];
        if (item.isBorrowed) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Cannot deposit borrowed items' });
        }
        
        character.inventory.splice(itemIndex, 1);
        character.warehouse.items.push(item);
        
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

// POST /warehouse/withdraw
router.post('/warehouse/withdraw', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };
        
        const backpackCap = getBackpackCapacity(character);
        if (character.inventory.length >= backpackCap) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Backpack full' });
        }
        
        const itemIndex = character.warehouse.items.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Item not found in warehouse' });
        }
        
        const item = character.warehouse.items[itemIndex];
        character.warehouse.items.splice(itemIndex, 1);
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

// POST /heal (Self)
router.post('/heal', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        // Fetch game data to get true max HP
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const derivedChar = calculateDerivedStatsOnServer(character, itemTemplates, affixes);
        const maxHealth = derivedChar.stats.maxHealth;
        
        character.stats.currentHealth = maxHealth;
        character.stats.currentMana = derivedChar.stats.maxMana;

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

// POST /stats (Distribute Points)
router.post('/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        let pointsSpent = 0;
        for (const key in stats) {
            const val = stats[key];
            if (val > 0) {
                pointsSpent += val;
                (character.stats as any)[key] = ((character.stats as any)[key] || 0) + val;
            }
        }
        
        if (character.stats.statPoints < pointsSpent) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough stat points' });
        }
        
        character.stats.statPoints -= pointsSpent;

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

// POST /reset-stats (Self)
router.post('/reset-stats', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        // Check cost
        // First reset is free if flag not set
        const isFree = !(character as any).freeStatResetUsed;
        const cost = 100 * character.level;
        
        if (!isFree) {
            if (character.resources.gold < cost) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Not enough gold' });
            }
            character.resources.gold -= cost;
        } else {
            (character as any).freeStatResetUsed = true;
        }

        // Updated formula: 20 base + 2 per level (excluding current level 1 which is base)
        const totalPoints = 20 + (character.level - 1) * 2;
        character.stats.strength = 0;
        character.stats.agility = 0;
        character.stats.accuracy = 0;
        character.stats.stamina = 0;
        character.stats.intelligence = 0;
        character.stats.energy = 0;
        character.stats.luck = 0;
        character.stats.statPoints = totalPoints;

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
        
        if (!character.learnedSkills) character.learnedSkills = [];
        if (character.learnedSkills.includes(skillId)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Skill already learned' });
        }

        // Fetch Skill Data
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        const skills = gameDataRes.rows[0]?.data || [];
        const skill = skills.find((s: any) => s.id === skillId);
        
        if (!skill) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Skill not found' });
        }

        // Check Requirements
        // (Simplified check - full check should match frontend logic)
        
        // Check Costs
        const costKeys = ['gold', 'commonEssence', 'uncommonEssence', 'rareEssence', 'epicEssence', 'legendaryEssence'] as const;

        for (const key of costKeys) {
            const costVal = skill.cost[key];
            if (typeof costVal === 'number' && costVal > 0) {
                if ((character.resources[key] || 0) < costVal) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Not enough ${key}` });
                }
            }
        }
        
        // Deduct
        for (const key of costKeys) {
             const costVal = skill.cost[key];
             if (typeof costVal === 'number' && costVal > 0) {
                 character.resources[key] -= costVal;
             }
        }
        
        character.learnedSkills.push(skillId);

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

// POST /skills/toggle
router.post('/skills/toggle', authenticateToken, async (req: any, res: any) => {
    const { skillId, isActive } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.learnedSkills?.includes(skillId)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Skill not learned' });
        }
        
        if (!character.activeSkills) character.activeSkills = [];
        
        if (isActive) {
            if (!character.activeSkills.includes(skillId)) character.activeSkills.push(skillId);
        } else {
            character.activeSkills = character.activeSkills.filter(id => id !== skillId);
        }

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

// POST /class
router.post('/class', authenticateToken, async (req: any, res: any) => {
    const { characterClass } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (character.level < 10) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Level too low' });
        }
        if (character.characterClass) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Class already selected' });
        }
        
        character.characterClass = characterClass;
        
        // Reset stats on class selection to allow re-spec? Usually not, but let's stick to simple set.
        
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

// POST /convert-essence
router.post('/convert-essence', authenticateToken, async (req: any, res: any) => {
    const { fromType } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Validate input type
        if (!Object.values(EssenceType).includes(fromType)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Invalid essence type' });
        }
        const eType = fromType as EssenceType;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        // Map types to next tier
        const tiers: EssenceType[] = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const fromIndex = tiers.indexOf(eType);
        
        if (fromIndex === -1 || fromIndex >= tiers.length - 1) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Invalid conversion' });
        }
        
        const toType = tiers[fromIndex + 1];
        
        // Check costs
        // 5:1 ratio + Gold cost
        const costs: Record<EssenceType, number> = {
            [EssenceType.Common]: 100,
            [EssenceType.Uncommon]: 250,
            [EssenceType.Rare]: 500,
            [EssenceType.Epic]: 1000,
            [EssenceType.Legendary]: 0
        };
        const goldCost = costs[eType];
        
        if ((character.resources[eType] || 0) < 5) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough essence' });
        }
        if (character.resources.gold < goldCost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        
        character.resources[eType] -= 5;
        character.resources[toType] = (character.resources[toType] || 0) + 1;
        character.resources.gold -= goldCost;
        
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

// POST /travel
router.post('/travel', authenticateToken, async (req: any, res: any) => {
    const { destinationLocationId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.activeTravel || character.activeExpedition || character.isResting) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Busy' });
        }

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'locations'");
        const locations: any[] = gameDataRes.rows[0]?.data || [];
        const dest = locations.find(l => l.id === destinationLocationId);
        
        if (!dest) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Location not found' });
        }
        
        if (character.resources.gold < dest.travelCost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        if (character.stats.currentEnergy < dest.travelEnergyCost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough energy' });
        }
        
        character.resources.gold -= dest.travelCost;
        character.stats.currentEnergy -= dest.travelEnergyCost;
        character.activeTravel = {
            destinationLocationId,
            finishTime: Date.now() + (dest.travelTime * 1000)
        };
        
        // Also update current location immediately? No, wait for finish.
        // But client needs to know we started.
        
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


export default router;
