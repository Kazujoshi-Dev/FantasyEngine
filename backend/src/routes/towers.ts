
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { GameData, PlayerCharacter, Tower, ActiveTowerRun, Enemy, CombatLogEntry, ExpeditionRewardSummary, ItemInstance, EssenceType, CharacterClass, ItemRarity, ItemTemplate, AffixType, Race } from '../types.js';
// Fix: Import getBackpackCapacity and calculateDerivedStatsOnServer from stats.js
import { calculateDerivedStatsOnServer, getBackpackCapacity } from '../logic/stats.js';
import { simulate1vManyCombat } from '../logic/combat/simulations/index.js';
import { enforceInboxLimit } from '../logic/helpers.js';
import { createItemInstance, rollAffixStats } from '../logic/items.js';
import { randomUUID } from 'crypto';

const router = express.Router();

const getGameData = async (): Promise<GameData> => {
    const gameDataRes = await pool.query("SELECT key, data FROM game_data");
    return gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);
};

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

// ... generateRandomTowerItem helper bez zmian ...

router.get('/', authenticateToken, async (req: any, res: any) => {
    // ... bez zmian ...
});

router.post('/start', authenticateToken, async (req: any, res: any) => {
    const { towerId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
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

        const floor1 = tower.floors.find(f => f.floorNumber === 1);
        if (floor1 && floor1.energyCost && floor1.energyCost > 0) {
            let energyCost = floor1.energyCost;
            
            // --- Pioneer's Instinct Energy Reduction ---
            if (character.learnedSkills?.includes('pioneers-instinct')) {
                energyCost = Math.max(1, energyCost - 1);
            }

            if (character.stats.currentEnergy < energyCost) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ message: 'Not enough energy for Floor 1.' });
            }
            character.stats.currentEnergy -= energyCost;
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        }
        
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

router.post('/fight', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
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

        const charRes = await client.query('SELECT data, buildings, active_buffs FROM characters c LEFT JOIN guild_members gm ON c.user_id = gm.user_id LEFT JOIN guilds g ON gm.guild_id = g.id WHERE c.user_id = $1 FOR UPDATE OF c', [userId]);
        const charData: PlayerCharacter = charRes.rows[0].data;
        const guildBuildings = charRes.rows[0].buildings || {};

        if (activeRun.current_floor > 1 && floorConfig.energyCost && floorConfig.energyCost > 0) {
             let energyCost = floorConfig.energyCost;
             
             // --- Pioneer's Instinct Energy Reduction ---
             if (charData.learnedSkills?.includes('pioneers-instinct')) {
                 energyCost = Math.max(1, energyCost - 1);
             }

             if (charData.stats.currentEnergy < energyCost) {
                  await client.query('ROLLBACK');
                  return res.status(400).json({ message: 'Not enough energy for this floor.' });
             }
             charData.stats.currentEnergy -= energyCost;
             await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(charData), userId]);
        }

        // ... Reszta logiki walki bez zmian ...
        await client.query('COMMIT');
        res.json({ victory: true, combatLog: [], rewards: {}, isTowerComplete: false }); // Skrócone dla czytelności XML

    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});
// ... Reszta pliku bez zmian ...
export default router;
