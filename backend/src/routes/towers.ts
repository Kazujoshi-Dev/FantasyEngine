
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { GameData, PlayerCharacter, Tower, ActiveTowerRun, Enemy, CombatLogEntry, ExpeditionRewardSummary, ItemInstance, EssenceType, CharacterClass, ItemRarity, ItemTemplate, AffixType, Race } from '../types.js';
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
        currentHealth: Number(row.current_health),
        currentMana: Number(row.current_mana),
        accumulatedRewards: row.accumulated_rewards,
        status: row.status
    };
};

// GET /api/towers - Pobierz wieże dostępne w lokacji lub aktywny bieg
router.get('/', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        const character: PlayerCharacter = charRes.rows[0].data;

        const gameData = await getGameData();
        const activeRun = await getActiveRun(userId, client);
        
        // Pobierz wieże: 
        // 1. Muszą być aktywne (lub isActive nie jest ustawione - traktujemy jako aktywne dla wstecznej kompatybilności)
        // 2. Muszą być w obecnej lokacji gracza
        const towers = (gameData.towers || []).filter(t => {
            const isAtLocation = t.locationId === character.currentLocationId;
            const isActive = t.isActive !== false; // null/undefined/true = active
            return isAtLocation && isActive;
        });

        // Jeśli trwa bieg, pobieramy też dane wieży, w której jest gracz (nawet jeśli już w niej nie jest fizycznie)
        let tower = null;
        if (activeRun) {
            tower = (gameData.towers || []).find(t => t.id === activeRun.towerId);
        }

        res.json({
            towers,
            activeRun,
            tower
        });

    } catch (err: any) {
        console.error("GET TOWERS ERROR:", err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

router.post('/start', authenticateToken, async (req: any, res: any) => {
    const { towerId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const existing = await getActiveRun(userId, client);
        if (existing) throw new Error("Już jesteś w wieży.");

        const gameData = await getGameData();
        const tower = gameData.towers.find(t => t.id === towerId);
        if (!tower) throw new Error("Wieża nie istnieje.");

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char = charRes.rows[0].data as PlayerCharacter;

        if (char.currentLocationId !== tower.locationId) throw new Error("Nie jesteś w odpowiedniej lokacji.");

        const firstFloor = tower.floors.find(f => f.floorNumber === 1);
        if (!firstFloor) throw new Error("Błąd konfiguracji wieży.");

        if (char.stats.currentEnergy < firstFloor.energyCost) throw new Error("Brak energii.");

        // Oblicz statystyki pochodne dla startowego zdrowia/many
        const derived = calculateDerivedStatsOnServer(char, gameData.itemTemplates, gameData.affixes, 0, 0, gameData.skills);

        char.stats.currentEnergy -= firstFloor.energyCost;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);

        const resRun = await client.query(
            `INSERT INTO tower_runs (user_id, tower_id, current_floor, current_health, current_mana, accumulated_rewards, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'IN_PROGRESS') RETURNING *`,
            [userId, towerId, 1, derived.stats.maxHealth, derived.stats.maxMana, JSON.stringify({ gold: 0, experience: 0, items: [], essences: {} })]
        );

        await client.query('COMMIT');
        res.json({
            activeRun: { ...resRun.rows[0], userId: resRun.rows[0].user_id, towerId: resRun.rows[0].tower_id, accumulatedRewards: resRun.rows[0].accumulated_rewards },
            tower
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
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
            return res.status(404).json({ message: 'Brak aktywnego biegu.' });
        }
        const activeRun = activeRunRaw.rows[0];
        
        const gameData = await getGameData();
        const tower = (gameData.towers || []).find(t => t.id === activeRun.tower_id);
        if (!tower) throw new Error('Nie znaleziono danych wieży.');
        
        const floorConfig = tower.floors.find(f => f.floorNumber === activeRun.current_floor);
        if (!floorConfig) throw new Error('Błąd konfiguracji piętra.');

        const charRes = await client.query(`
            SELECT c.data, g.buildings, g.active_buffs 
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id 
            LEFT JOIN guilds g ON gm.guild_id = g.id 
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [userId]);
        const charData: PlayerCharacter = charRes.rows[0].data;
        const guildBuildings = charRes.rows[0].buildings || {};
        const activeBuffs = charRes.rows[0].active_buffs || [];

        // Walka
        const encounteredEnemies: Enemy[] = floorConfig.enemies.map(fe => {
            const template = gameData.enemies.find(e => e.id === fe.enemyId);
            return template ? { ...template, uniqueId: randomUUID() } : null;
        }).filter(e => e !== null) as Enemy[];

        const derivedChar = calculateDerivedStatsOnServer(charData, gameData.itemTemplates, gameData.affixes, guildBuildings.barracks || 0, guildBuildings.shrine || 0, gameData.skills, activeBuffs);
        
        // Podstawienie zdrowia z biegu do statystyk postaci na czas symulacji
        const combatReadyChar = {
            ...derivedChar,
            stats: { 
                ...derivedChar.stats, 
                currentHealth: Number(activeRun.current_health),
                currentMana: Number(activeRun.current_mana)
            }
        };

        const combatLog = simulate1vManyCombat(combatReadyChar, encounteredEnemies, gameData);
        const lastEntry = combatLog[combatLog.length - 1];
        const victory = lastEntry && lastEntry.playerHealth > 0;

        let rewards = activeRun.accumulated_rewards || { gold: 0, experience: 0, items: [], essences: {} };

        if (victory) {
            // Dodaj nagrody z piętra
            rewards.gold += (floorConfig.guaranteedReward?.gold || 0);
            rewards.experience += (floorConfig.guaranteedReward?.experience || 0);
            
            // Loot z wrogów
            encounteredEnemies.forEach(enemy => {
                const gold = Math.floor(Math.random() * (enemy.rewards.maxGold - enemy.rewards.minGold + 1)) + enemy.rewards.minGold;
                const exp = Math.floor(Math.random() * (enemy.rewards.maxExperience - enemy.rewards.minExperience + 1)) + enemy.rewards.minExperience;
                rewards.gold += gold;
                rewards.experience += exp;
            });

            // Resource Loot Table
            if (floorConfig.resourceLootTable) {
                floorConfig.resourceLootTable.forEach(drop => {
                    if (Math.random() * 100 < drop.weight) {
                        const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                        rewards.essences[drop.resource] = (rewards.essences[drop.resource] || 0) + amount;
                    }
                });
            }

            // Specific Items
            if (floorConfig.specificItemRewards) {
                rewards.items.push(...floorConfig.specificItemRewards.map(i => ({ ...i, uniqueId: randomUUID() })));
            }

            const isTowerComplete = activeRun.current_floor >= tower.totalFloors;
            
            if (isTowerComplete) {
                // Dodaj nagrodę główną
                if (tower.grandPrize) {
                    rewards.gold += (tower.grandPrize.gold || 0);
                    rewards.experience += (tower.grandPrize.experience || 0);
                    rewards.items.push(...(tower.grandPrize.items || []).map(i => ({ ...i, uniqueId: randomUUID() })));
                    Object.entries(tower.grandPrize.essences || {}).forEach(([k, v]) => {
                        rewards.essences[k] = (rewards.essences[k] || 0) + (v as number);
                    });
                }

                // Finalize character
                charData.resources.gold += rewards.gold;
                charData.experience += rewards.experience;
                charData.inventory.push(...rewards.items);
                Object.entries(rewards.essences).forEach(([k, v]) => {
                    (charData.resources as any)[k] = ((charData.resources as any)[k] || 0) + (v as number);
                });
                
                while (charData.experience >= charData.experienceToNextLevel) {
                    charData.experience -= charData.experienceToNextLevel;
                    charData.level += 1;
                    charData.stats.statPoints += 2;
                    charData.experienceToNextLevel = Math.floor(100 * Math.pow(charData.level, 1.3));
                }

                await client.query("UPDATE tower_runs SET status = 'COMPLETED', accumulated_rewards = $1 WHERE id = $2", [JSON.stringify(rewards), activeRun.id]);
                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(charData), userId]);
            } else {
                // Update run
                await client.query(
                    "UPDATE tower_runs SET current_floor = current_floor + 1, current_health = $1, current_mana = $2, accumulated_rewards = $3 WHERE id = $4",
                    [lastEntry.playerHealth, lastEntry.playerMana, JSON.stringify(rewards), activeRun.id]
                );
            }

            await client.query('COMMIT');
            res.json({ victory: true, combatLog, rewards, isTowerComplete, enemies: encounteredEnemies, currentFloor: isTowerComplete ? activeRun.current_floor : activeRun.current_floor + 1 });

        } else {
            // Defeat
            await client.query("UPDATE tower_runs SET status = 'FAILED' WHERE id = $1", [activeRun.id]);
            // Zresetuj zdrowie postaci do 0 (pół-śmierć)
            charData.stats.currentHealth = 0;
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(charData), userId]);
            
            await client.query('COMMIT');
            res.json({ victory: false, combatLog, rewards: { gold: 0, experience: 0, items: [], essences: {} }, enemies: encounteredEnemies });
        }

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("TOWER FIGHT ERROR:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/retreat', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const activeRun = await getActiveRun(userId, client);
        if (!activeRun) throw new Error("Brak aktywnego biegu.");

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const char = charRes.rows[0].data as PlayerCharacter;

        const rewards = activeRun.accumulatedRewards;
        char.resources.gold += rewards.gold;
        char.experience += rewards.experience;
        char.inventory.push(...rewards.items);
        Object.entries(rewards.essences).forEach(([k, v]) => {
            (char.resources as any)[k] = ((char.resources as any)[k] || 0) + (v as number);
        });

        while (char.experience >= char.experienceToNextLevel) {
            char.experience -= char.experienceToNextLevel;
            char.level += 1;
            char.stats.statPoints += 2;
            char.experienceToNextLevel = Math.floor(100 * Math.pow(char.level, 1.3));
        }

        await client.query("UPDATE tower_runs SET status = 'RETREATED' WHERE id = $1", [activeRun.id]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);

        await client.query('COMMIT');
        res.json({ rewards });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;
