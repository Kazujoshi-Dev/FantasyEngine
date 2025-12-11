
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, EssenceType, GameData, EquipmentSlot, MessageType, ExpeditionRewardSummary, GuildBuff, CharacterStats, QuestType, Quest, ItemInstance, PublicCharacterProfile } from '../types.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';
import { processCompletedExpedition } from '../logic/expeditions.js';
import { calculateDerivedStatsOnServer, getWarehouseUpgradeCost, getWarehouseCapacity, getTreasuryUpgradeCost } from '../logic/stats.js';
import { createItemInstance } from '../logic/items.js';

const router = express.Router();

const getChestCapacity = (level: number) => Math.floor(500 * Math.pow(level, 1.8));

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
        // Updated query to join users and get email
        const result = await pool.query(`
            SELECT c.data, c.guild_id, u.email 
            FROM characters c
            JOIN users u ON c.user_id = u.id
            WHERE c.user_id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.json(null);
        }
        const char = result.rows[0].data;
        const guildId = result.rows[0].guild_id;
        const email = result.rows[0].email;
        
        // Inject email into character object for frontend (it's not in the JSON blob)
        char.email = email;

        // Migration check for older characters
        if (!char.treasury) char.treasury = { level: char.chest?.level || 1, gold: char.chest?.gold || 0 };
        if (!char.warehouse) char.warehouse = { level: 1, items: [] };

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
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch character' });
    }
});

// GET /character/profile/:name (Public Profile)
router.get('/character/profile/:name', authenticateToken, async (req: any, res: any) => {
    const { name } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                c.data->>'name' as name,
                c.data->>'race' as race,
                c.data->>'characterClass' as "characterClass",
                COALESCE((c.data->>'level')::int, 1) as level,
                COALESCE((c.data->>'experience')::bigint, 0) as experience,
                COALESCE((c.data->>'pvpWins')::int, 0) as "pvpWins",
                COALESCE((c.data->>'pvpLosses')::int, 0) as "pvpLosses",
                c.data->>'description' as description,
                c.data->>'avatarUrl' as "avatarUrl",
                g.name as "guildName",
                g.tag as "guildTag"
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.data->>'name' = $1
        `, [name]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }

        const row = result.rows[0];
        const profile: PublicCharacterProfile = {
            name: row.name,
            race: row.race,
            characterClass: row.characterClass,
            level: row.level,
            experience: parseInt(row.experience), // bigint comes as string
            pvpWins: row.pvpWins,
            pvpLosses: row.pvpLosses,
            description: row.description,
            avatarUrl: row.avatarUrl,
            guildName: row.guildName,
            guildTag: row.guildTag
        };

        res.json(profile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch profile' });
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
        treasury: { level: 1, gold: 0 }, // Initial Treasury
        warehouse: { level: 1, items: [] }, // Initial Warehouse
        chest: { level: 1, gold: 0 }, // Deprecated but initialized for backward compatibility
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
        
        // 1. Handle Email Update specifically (if provided)
        if (updates.email) {
            const userRes = await client.query('SELECT email FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
            if (userRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'User not found' });
            }
            
            const currentEmail = userRes.rows[0].email;
            if (currentEmail) {
                // Email already set, ignore update or error
                if (currentEmail !== updates.email) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Email is already set and cannot be changed here.' });
                }
            } else {
                // Update email
                try {
                    await client.query('UPDATE users SET email = $1 WHERE id = $2', [updates.email, req.user.id]);
                } catch (e: any) {
                    if (e.code === '23505') { // Unique violation
                        await client.query('ROLLBACK');
                        return res.status(409).json({ message: 'This email is already in use.' });
                    }
                    throw e;
                }
            }
            // Remove email from updates object so it doesn't get saved into character JSONB
            delete updates.email;
        }

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

// Distribute Stat Points
router.post('/character/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body; 
    
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

// Upgrade Camp
router.post('/character/camp/upgrade', authenticateToken, async (req: any, res: any) => {
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

        const cost = Math.floor(150 * Math.pow(currentLevel, 1.5));
         if (character.resources.gold < cost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }
        
        character.resources.gold -= cost;
        character.camp = { level: currentLevel + 1 };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
});

// Heal Character (Full Heal)
router.post('/character/heal', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data, guild_id FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        const guildId = charRes.rows[0].guild_id;

        if (character.activeExpedition || character.activeTravel) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot heal while active' });
        }

        // --- DYNAMIC MAX HEALTH CALCULATION ---
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        const skills = gameDataRes.rows.find(r => r.key === 'skills')?.data || [];

        let activeBuffs: GuildBuff[] = [];
        let barracksLevel = 0;
        let shrineLevel = 0;

        if (guildId) {
            const guildRes = await client.query('SELECT active_buffs, buildings FROM guilds WHERE id = $1', [guildId]);
            if (guildRes.rows.length > 0) {
                 const rawBuffs = guildRes.rows[0].active_buffs || [];
                 activeBuffs = Array.isArray(rawBuffs) ? (rawBuffs as GuildBuff[]).filter(b => b.expiresAt > Date.now()) : [];
                 barracksLevel = guildRes.rows[0].buildings?.barracks || 0;
                 shrineLevel = guildRes.rows[0].buildings?.shrine || 0;
            }
        }

        // Calculate stats on the fly to get true max health
        const derivedChar = calculateDerivedStatsOnServer(
            character, 
            itemTemplates, 
            affixes, 
            barracksLevel, 
            shrineLevel, 
            skills, 
            activeBuffs
        );

        // Apply heal using calculated max values
        character.stats.currentHealth = derivedChar.stats.maxHealth;
        character.stats.currentMana = derivedChar.stats.maxMana;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error healing character' });
    } finally {
        client.release();
    }
});


// TREASURY / CHEST ENDPOINTS

// Upgrade Treasury
router.post('/character/treasury/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        // Ensure treasury exists
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        
        const currentLevel = character.treasury.level;
        const upgradeCost = getTreasuryUpgradeCost(currentLevel);

        // Check gold
        if (character.resources.gold < upgradeCost.gold) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold' });
        }
        
        // Check essences
        for (const cost of upgradeCost.essences) {
             const playerAmount = (character.resources as any)[cost.type] || 0;
             if (playerAmount < cost.amount) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ message: `Not enough ${cost.type}` });
             }
        }

        // Deduct cost
        character.resources.gold -= upgradeCost.gold;
        for (const cost of upgradeCost.essences) {
             (character.resources as any)[cost.type] -= cost.amount;
        }

        character.treasury.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error upgrading treasury' });
    } finally {
        client.release();
    }
});

// Treasury Deposit
router.post('/character/treasury/deposit', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const depositAmount = parseInt(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        
        if (character.resources.gold < depositAmount) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold' });
        }

        const capacity = getChestCapacity(character.treasury.level);
        if (character.treasury.gold + depositAmount > capacity) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Treasury full' });
        }

        character.resources.gold -= depositAmount;
        character.treasury.gold += depositAmount;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error depositing gold' });
    } finally {
        client.release();
    }
});

// Treasury Withdraw
router.post('/character/treasury/withdraw', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const withdrawAmount = parseInt(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        
        if (character.treasury.gold < withdrawAmount) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold in treasury' });
        }

        character.treasury.gold -= withdrawAmount;
        character.resources.gold += withdrawAmount;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error withdrawing gold' });
    } finally {
        client.release();
    }
});

// Upgrade Backpack
router.post('/character/upgrade-backpack', authenticateToken, async (req: any, res: any) => {
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
        
        character.resources.gold -= cost.gold;
        for (const e of cost.essences) character.resources[e.type] -= e.amount;
        character.backpack = { level: currentLevel + 1 };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
});

// Legacy chest routes pointing to treasury logic for compatibility
router.post('/character/chest/deposit', (req, res) => res.redirect(307, '/api/character/treasury/deposit'));
router.post('/character/chest/withdraw', (req, res) => res.redirect(307, '/api/character/treasury/withdraw'));
router.post('/character/upgrade-chest', (req, res) => res.redirect(307, '/api/character/treasury/upgrade'));

// WAREHOUSE ENDPOINTS

// Upgrade Warehouse
router.post('/character/warehouse/upgrade', authenticateToken, async (req: any, res: any) => {
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

        const cost = getWarehouseUpgradeCost(currentLevel);
        
        // Check Gold
        if (character.resources.gold < cost.gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); 
        }
        // Check Essences
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` }); 
            }
        }
        
        character.resources.gold -= cost.gold;
        for (const e of cost.essences) character.resources[e.type] -= e.amount;
        character.warehouse.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error upgrading warehouse' });
    } finally {
        client.release();
    }
});

// Warehouse Deposit (Item)
router.post('/character/warehouse/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.warehouse) character.warehouse = { level: 1, items: [] };

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Item not found' }); }
        
        const item = character.inventory[itemIndex];
        if (item.isBorrowed) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Cannot deposit borrowed items' }); }

        const capacity = getWarehouseCapacity(character.warehouse.level);
        if (character.warehouse.items.length >= capacity) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Warehouse full' });
        }

        character.inventory.splice(itemIndex, 1);
        character.warehouse.items.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error depositing item' });
    } finally {
        client.release();
    }
});

// Warehouse Withdraw (Item)
router.post('/character/warehouse/withdraw', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };

        const itemIndex = character.warehouse.items.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Item not found in warehouse' }); }
        
        const item = character.warehouse.items[itemIndex];

        // Check Backpack Space
        if (character.inventory.length >= getBackpackCapacity(character)) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Backpack full' });
        }

        character.warehouse.items.splice(itemIndex, 1);
        character.inventory.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error withdrawing item' });
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
        
        // Enforce inbox limit before sending report
        await enforceInboxLimit(client, req.user.id);

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

// ... (Rest of the routes including skills, class, quests etc.)

export default router;
