
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { GameData, PlayerCharacter, Tower, ActiveTowerRun, Enemy, CombatLogEntry, ExpeditionRewardSummary, ItemInstance, EssenceType, CharacterClass } from '../types.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';
import { simulate1v1Combat } from '../logic/combat/simulations/index.js';
import { enforceInboxLimit } from '../logic/helpers.js';
import { createItemInstance } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';
import { randomUUID } from 'crypto';

const router = express.Router();

const getGameData = async (): Promise<GameData> => {
    const gameDataRes = await pool.query("SELECT key, data FROM game_data");
    return gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);
};

// Helper: Ensure active run exists and belongs to user
const getActiveRun = async (userId: number, client: any): Promise<ActiveTowerRun | null> => {
    const res = await client.query(
        "SELECT * FROM tower_runs WHERE user_id = $1 AND status = 'IN_PROGRESS'",
        [userId]
    );
    if (res.rows.length === 0) return null;
    
    const row = res.rows[0];
    return {
        id: row.id,
        userId: row.user_id,
        towerId: row.tower_id,
        currentFloor: row.current_floor,
        currentHealth: row.current_health,
        currentMana: row.current_mana,
        accumulatedRewards: row.accumulated_rewards,
        status: row.status
    };
};

// GET /api/towers - List active run or available towers
router.get('/', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        const activeRun = await getActiveRun(userId, client);
        const gameData = await getGameData();
        const towers = gameData.towers || [];

        // If player has active run, return context for that
        if (activeRun) {
            const tower = towers.find(t => t.id === activeRun.towerId);
            return res.json({ activeRun, tower });
        }

        // Otherwise return available towers for current location
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const availableTowers = towers.filter(t => t.locationId === character.currentLocationId && t.isActive);
        res.json({ towers: availableTowers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching towers' });
    } finally {
        client.release();
    }
});

// POST /api/towers/start
router.post('/start', authenticateToken, async (req: any, res: any) => {
    const { towerId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Checks
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (character.activeExpedition || character.activeTravel || character.isResting) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Character is busy.' });
        }
        
        const activeRunCheck = await getActiveRun(userId, client);
        if (activeRunCheck) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You already have an active tower run.' });
        }
        
        const gameData = await getGameData();
        const tower = (gameData.towers || []).find(t => t.id === towerId);
        
        if (!tower) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Tower not found.' });
        }
        
        if (tower.locationId !== character.currentLocationId) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Wrong location.' });
        }
        
        // 2. Start Run
        // Snapshot current HP/Mana. If full, great. If not, they start damaged.
        const currentHP = character.stats.currentHealth;
        const currentMana = character.stats.currentMana;
        
        if (currentHP <= 0) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'You cannot enter with 0 HP.' });
        }

        const initialRewards = { gold: 0, experience: 0, items: [], essences: {} };
        
        const insertRes = await client.query(
            `INSERT INTO tower_runs (user_id, tower_id, current_floor, current_health, current_mana, accumulated_rewards, status)
             VALUES ($1, $2, 1, $3, $4, $5, 'IN_PROGRESS') RETURNING *`,
            [userId, towerId, currentHP, currentMana, JSON.stringify(initialRewards)]
        );

        const row = insertRes.rows[0];
        const activeRun: ActiveTowerRun = {
            id: row.id,
            userId: row.user_id,
            towerId: row.tower_id,
            currentFloor: row.current_floor,
            currentHealth: row.current_health,
            currentMana: row.current_mana,
            accumulatedRewards: row.accumulated_rewards,
            status: row.status
        };

        await client.query('COMMIT');
        res.json({ activeRun, tower });

    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/towers/fight
router.post('/fight', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Load Context
        const activeRunRaw = await client.query(
            "SELECT * FROM tower_runs WHERE user_id = $1 AND status = 'IN_PROGRESS' FOR UPDATE",
            [userId]
        );
        if (activeRunRaw.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'No active run.' });
        }
        const activeRun = activeRunRaw.rows[0];
        
        const gameData = await getGameData();
        const tower = (gameData.towers || []).find(t => t.id === activeRun.tower_id);
        if (!tower) throw new Error('Tower data missing');
        
        const floorConfig = tower.floors.find(f => f.floorNumber === activeRun.current_floor);
        if (!floorConfig) throw new Error('Floor config missing');

        const charRes = await client.query('SELECT data, buildings, active_buffs FROM characters c LEFT JOIN guild_members gm ON c.user_id = gm.user_id LEFT JOIN guilds g ON gm.guild_id = g.id WHERE c.user_id = $1', [userId]);
        const charData: PlayerCharacter = charRes.rows[0].data;
        const guildBuildings = charRes.rows[0].buildings || {};
        // Inject saved HP/Mana state into charData for simulation
        charData.stats.currentHealth = activeRun.current_health;
        charData.stats.currentMana = activeRun.current_mana;
        charData.activeGuildBuffs = charRes.rows[0].active_buffs || [];
        
        // 2. Prepare Enemy
        // Select enemy based on chance
        let selectedEnemyId = floorConfig.enemies[0].enemyId;
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (const e of floorConfig.enemies) {
            cumulative += e.spawnChance;
            if (rand < cumulative) {
                selectedEnemyId = e.enemyId;
                break;
            }
        }
        
        const enemyTemplate = gameData.enemies.find(e => e.id === selectedEnemyId);
        if (!enemyTemplate) throw new Error('Enemy template missing');

        // 3. Simulate Combat
        const derivedChar = calculateDerivedStatsOnServer(charData, gameData.itemTemplates, gameData.affixes, guildBuildings.barracks || 0, guildBuildings.shrine || 0, gameData.skills, charData.activeGuildBuffs);
        // Important: Reset derived HP to database snapshot because calculateDerived sets it to Max if missing or calcs new
        derivedChar.stats.currentHealth = activeRun.current_health;
        derivedChar.stats.currentMana = activeRun.current_mana;
        
        const combatLog = simulate1v1Combat(derivedChar, enemyTemplate, gameData);
        const lastLog = combatLog[combatLog.length - 1];
        const isVictory = lastLog.playerHealth > 0;
        
        const finalHealth = Math.max(0, Math.floor(lastLog.playerHealth));
        const finalMana = Math.max(0, Math.floor(lastLog.playerMana));

        // 4. Handle Result
        if (isVictory) {
            // Add rewards to accumulator
            const rewards = activeRun.accumulated_rewards;
            
            // Enemy Base Rewards
            const goldGain = Math.floor(Math.random() * (enemyTemplate.rewards.maxGold - enemyTemplate.rewards.minGold + 1)) + enemyTemplate.rewards.minGold;
            const xpGain = Math.floor(Math.random() * (enemyTemplate.rewards.maxExperience - enemyTemplate.rewards.minExperience + 1)) + enemyTemplate.rewards.minExperience;
            
            rewards.gold += goldGain;
            rewards.experience += xpGain;
            
            // Floor Config Rewards
            if (floorConfig.guaranteedReward) {
                rewards.gold += (floorConfig.guaranteedReward.gold || 0);
                rewards.experience += (floorConfig.guaranteedReward.experience || 0);
            }
            
            // Loot generation (Generic logic from expeditions)
            if (floorConfig.lootTable && floorConfig.lootTable.length > 0) {
                 for (const drop of floorConfig.lootTable) {
                    if (Math.random() * 100 < drop.chance) {
                        rewards.items.push(createItemInstance(drop.templateId, gameData.itemTemplates, gameData.affixes));
                    }
                }
            }
             if (floorConfig.resourceLootTable) {
                for (const drop of floorConfig.resourceLootTable) {
                    if (Math.random() * 100 < drop.chance) {
                        const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                        rewards.essences[drop.resource] = (rewards.essences[drop.resource] || 0) + amount;
                    }
                }
            }

            // Check if this was the last floor
            const isTowerComplete = activeRun.current_floor >= tower.totalFloors;
            
            if (isTowerComplete) {
                // Auto-claim grand prize and finish
                if (tower.grandPrize) {
                    rewards.gold += (tower.grandPrize.gold || 0);
                    rewards.experience += (tower.grandPrize.experience || 0);
                    
                    // Add Grand Prize Essences
                    if (tower.grandPrize.essences) {
                        for(const [key, val] of Object.entries(tower.grandPrize.essences)) {
                            rewards.essences[key] = (rewards.essences[key] || 0) + (val as number);
                        }
                    }

                    // Add Grand Prize Items
                    if (tower.grandPrize.items && tower.grandPrize.items.length > 0) {
                        for (const itemDef of tower.grandPrize.items) {
                            // Re-generate item to give it a unique ID for the player
                            const newItem = createItemInstance(
                                itemDef.templateId, 
                                gameData.itemTemplates, 
                                gameData.affixes, 
                                undefined, 
                                false 
                            );
                            
                            // Re-apply specific affixes/upgrade level
                            newItem.prefixId = itemDef.prefixId;
                            newItem.suffixId = itemDef.suffixId;
                            newItem.upgradeLevel = itemDef.upgradeLevel;
                            
                            newItem.uniqueId = randomUUID(); // Critical: New ID
                            rewards.items.push(newItem);
                        }
                    }
                }
                
                // Transfer rewards to character
                const dbChar: PlayerCharacter = charRes.rows[0].data;
                dbChar.resources.gold += rewards.gold;
                dbChar.experience += rewards.experience;
                for(const [key, val] of Object.entries(rewards.essences)) {
                     dbChar.resources[key as EssenceType] = (dbChar.resources[key as EssenceType] || 0) + (val as number);
                }
                // Items
                const backpackCap = getBackpackCapacity(dbChar);
                for(const item of rewards.items) {
                    if (dbChar.inventory.length < backpackCap) dbChar.inventory.push(item);
                }
                
                // HP Update
                dbChar.stats.currentHealth = finalHealth;
                dbChar.stats.currentMana = finalMana;
                
                // Level Up Logic
                 while (dbChar.experience >= dbChar.experienceToNextLevel) {
                    dbChar.experience -= dbChar.experienceToNextLevel;
                    dbChar.level += 1;
                    dbChar.stats.statPoints += 1;
                    dbChar.experienceToNextLevel = Math.floor(100 * Math.pow(dbChar.level, 1.3));
                }

                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(dbChar), userId]);
                await client.query("UPDATE tower_runs SET status = 'COMPLETED', accumulated_rewards = $1, current_health = $2, current_mana = $3 WHERE id = $4", [JSON.stringify(rewards), finalHealth, finalMana, activeRun.id]);

                // Send Report
                await enforceInboxLimit(client, userId);
                const summary: ExpeditionRewardSummary = {
                    isVictory: true,
                    totalGold: rewards.gold,
                    totalExperience: rewards.experience,
                    itemsFound: rewards.items,
                    essencesFound: rewards.essences,
                    combatLog: combatLog,
                    rewardBreakdown: [{ source: `Ukończono Wieżę: ${tower.name}`, gold: rewards.gold, experience: rewards.experience }]
                };
                await client.query(
                    `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) 
                     VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                    [userId, `Wieża Ukończona: ${tower.name}`, JSON.stringify(summary)]
                );
                
            } else {
                // Just update run state AND INCREMENT FLOOR
                // This automatically moves the player to the next floor upon victory
                await client.query(
                    "UPDATE tower_runs SET accumulated_rewards = $1, current_health = $2, current_mana = $3, current_floor = current_floor + 1 WHERE id = $4",
                    [JSON.stringify(rewards), finalHealth, finalMana, activeRun.id]
                );
            }

            await client.query('COMMIT');
            res.json({ victory: true, combatLog, rewards, isTowerComplete, currentFloor: activeRun.current_floor });

        } else {
            // Defeat - Lose everything
            await client.query("UPDATE tower_runs SET status = 'FAILED', current_health = 0 WHERE id = $1", [activeRun.id]);
            
            // Update character to 0 HP
            const dbChar: PlayerCharacter = charRes.rows[0].data;
            dbChar.stats.currentHealth = 0;
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(dbChar), userId]);

            await client.query('COMMIT');
            res.json({ victory: false, combatLog });
        }

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/towers/continue
// This endpoint is largely redundant now that fight auto-increments, but kept for manual overrides or specific mechanics if needed later.
router.post('/continue', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            "UPDATE tower_runs SET current_floor = current_floor + 1 WHERE user_id = $1 AND status = 'IN_PROGRESS' RETURNING *",
            [userId]
        );
        if (result.rows.length === 0) return res.status(400).json({ message: 'No active run to continue.' });
        
        const row = result.rows[0];
        const activeRun: ActiveTowerRun = {
            id: row.id,
            userId: row.user_id,
            towerId: row.tower_id,
            currentFloor: row.current_floor,
            currentHealth: row.current_health,
            currentMana: row.current_mana,
            accumulatedRewards: row.accumulated_rewards,
            status: row.status
        };

        res.json({ message: 'Proceeded to next floor', activeRun });
    } catch(err: any) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/towers/retreat
router.post('/retreat', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const runRes = await client.query("SELECT * FROM tower_runs WHERE user_id = $1 AND status = 'IN_PROGRESS' FOR UPDATE", [userId]);
        if (runRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'No active run.' });
        }
        const run = runRes.rows[0];
        const rewards = run.accumulated_rewards;

        // Transfer Rewards
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const dbChar: PlayerCharacter = charRes.rows[0].data;
        
        dbChar.resources.gold += (rewards.gold || 0);
        dbChar.experience += (rewards.experience || 0);
        
        for(const [key, val] of Object.entries(rewards.essences || {})) {
             dbChar.resources[key as EssenceType] = (dbChar.resources[key as EssenceType] || 0) + (val as number);
        }
        
        const backpackCap = getBackpackCapacity(dbChar);
        if (rewards.items) {
            for(const item of rewards.items) {
                if (dbChar.inventory.length < backpackCap) dbChar.inventory.push(item);
            }
        }
        
        // Sync Health state
        dbChar.stats.currentHealth = run.current_health;
        dbChar.stats.currentMana = run.current_mana;
        
        // Level Up Logic
        while (dbChar.experience >= dbChar.experienceToNextLevel) {
            dbChar.experience -= dbChar.experienceToNextLevel;
            dbChar.level += 1;
            dbChar.stats.statPoints += 1;
            dbChar.experienceToNextLevel = Math.floor(100 * Math.pow(dbChar.level, 1.3));
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(dbChar), userId]);
        await client.query("UPDATE tower_runs SET status = 'RETREATED' WHERE id = $1", [run.id]);

        await client.query('COMMIT');
        res.json({ message: 'Retreated successfully', rewards });

    } catch(err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;
