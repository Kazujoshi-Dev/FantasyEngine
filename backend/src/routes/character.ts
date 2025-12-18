
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, ActiveTowerRun, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, SkillCost, EssenceType, CharacterClass, CharacterResources, EquipmentLoadout, GuildBuff, Skill, SkillType, SkillCategory } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getTreasuryCapacity, calculateDerivedStatsOnServer, getWarehouseCapacity } from '../logic/stats.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// GET /api/character - Get Character Data
router.get('/', authenticateToken, async (req: any, res: any) => {
    try {
        const client = await pool.connect();
        try {
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
                return res.json(null);
            }

            const row = result.rows[0];
            const charData: PlayerCharacter = row.data;
            const activeRunDB = row.active_tower_run;

            if (row.email) {
                charData.email = row.email;
            }

            if (row.guild_id) {
                charData.guildId = row.guild_id;
                charData.guildBarracksLevel = row.buildings?.barracks || 0;
                charData.guildShrineLevel = row.buildings?.shrine || 0;
                charData.activeGuildBuffs = row.active_buffs || [];
            } else {
                charData.guildId = undefined;
                charData.guildBarracksLevel = 0;
                charData.guildShrineLevel = 0;
                charData.activeGuildBuffs = [];
            }

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

// ==========================================
//               STATS & SKILLS
// ==========================================

router.post('/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body; // Partial stats to add
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        let totalPointsToSpend = 0;
        for (const [key, value] of Object.entries(stats)) {
            const points = parseInt(value as string, 10);
            if (points > 0) {
                (character.stats as any)[key] += points;
                totalPointsToSpend += points;
            }
        }

        if (character.stats.statPoints < totalPointsToSpend) {
            throw new Error("Niewystarczająca liczba punktów umiejętności.");
        }

        character.stats.statPoints -= totalPointsToSpend;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/skills/learn', authenticateToken, async (req: any, res: any) => {
    const { skillId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Get Character
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        // 2. Get Skill Data
        const skillsRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        const skills: Skill[] = skillsRes.rows[0]?.data || [];
        const skill = skills.find(s => s.id === skillId);

        if (!skill) throw new Error("Umiejętność nie istnieje.");
        if (character.learnedSkills?.includes(skillId)) throw new Error("Już znasz tę umiejętność.");

        // 3. Check Requirements
        if (skill.requirements) {
            if (skill.requirements.level && character.level < skill.requirements.level) throw new Error("Zbyt niski poziom.");
            if (skill.requirements.characterClass && character.characterClass !== skill.requirements.characterClass) throw new Error("Nieodpowiednia klasa.");
            if (skill.requirements.race && character.race !== skill.requirements.race) throw new Error("Nieodpowiednia rasa.");
            
            const statsToCheck = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
            for (const s of statsToCheck) {
                const reqVal = (skill.requirements as any)[s];
                if (reqVal && (character.stats as any)[s] < reqVal) throw new Error(`Wymagana większa wartość atrybutu: ${s}`);
            }
        }

        // 4. Check & Deduct Cost
        if (skill.cost) {
            if (skill.cost.gold && character.resources.gold < skill.cost.gold) throw new Error("Za mało złota.");
            const essences: EssenceType[] = Object.values(EssenceType);
            for (const e of essences) {
                const reqEss = (skill.cost as any)[e];
                if (reqEss && (character.resources as any)[e] < reqEss) throw new Error(`Za mało esencji: ${e}`);
            }

            // Perform deduction
            if (skill.cost.gold) character.resources.gold -= skill.cost.gold;
            for (const e of essences) {
                const reqEss = (skill.cost as any)[e];
                if (reqEss) (character.resources as any)[e] -= reqEss;
            }
        }

        // 5. Learn
        if (!character.learnedSkills) character.learnedSkills = [];
        character.learnedSkills.push(skillId);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/skills/toggle', authenticateToken, async (req: any, res: any) => {
    const { skillId, isActive } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.learnedSkills?.includes(skillId)) {
            throw new Error("Nie znasz tej umiejętności.");
        }

        if (!character.activeSkills) character.activeSkills = [];

        if (isActive) {
            if (!character.activeSkills.includes(skillId)) {
                character.activeSkills.push(skillId);
            }
        } else {
            character.activeSkills = character.activeSkills.filter(id => id !== skillId);
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               HEALING
// ==========================================

router.post('/heal', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch character with potential guild bonuses
        const charRes = await client.query(`
            SELECT 
                c.data,
                g.buildings,
                g.active_buffs
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [userId]);

        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const row = charRes.rows[0];
        const character: PlayerCharacter = row.data;
        const barracksLevel = row.buildings?.barracks || 0;
        const shrineLevel = row.buildings?.shrine || 0;
        const activeBuffs: GuildBuff[] = row.active_buffs || [];

        // Fetch game data for derived stats calculation (to know max hp)
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        const skills = gameDataRes.rows.find(r => r.key === 'skills')?.data || [];

        const characterWithStats = calculateDerivedStatsOnServer(
            character,
            itemTemplates,
            affixes,
            barracksLevel,
            shrineLevel,
            skills,
            activeBuffs
        );

        // Fully heal HP and Mana
        character.stats.currentHealth = characterWithStats.stats.maxHealth;
        character.stats.currentMana = characterWithStats.stats.maxMana;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Heal Error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               TREASURY / CHEST
// ==========================================

router.post('/treasury/deposit', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const userId = req.user.id;
    const val = parseInt(amount);

    if (isNaN(val) || val <= 0) return res.status(400).json({ message: 'Nieprawidłowa kwota.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        
        const capacity = getTreasuryCapacity(character.treasury.level);
        const currentGold = character.resources.gold || 0;

        if (currentGold < val) throw new Error("Niewystarczająca ilość złota w plecaku.");
        if (character.treasury.gold + val > capacity) throw new Error("Skarbiec jest pełny.");

        character.resources.gold -= val;
        character.treasury.gold += val;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/treasury/withdraw', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const userId = req.user.id;
    const val = parseInt(amount);

    if (isNaN(val) || val <= 0) return res.status(400).json({ message: 'Nieprawidłowa kwota.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };

        if (character.treasury.gold < val) throw new Error("Niewystarczająca ilość złota w skarbcu.");

        character.treasury.gold -= val;
        character.resources.gold = (character.resources.gold || 0) + val;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/treasury/upgrade', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.treasury) character.treasury = { level: 1, gold: 0 };
        
        const currentLevel = character.treasury.level;
        const cost = getTreasuryUpgradeCost(currentLevel);

        if (character.resources.gold < cost.gold) throw new Error("Brak złota na ulepszenie.");
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) throw new Error(`Brak esencji: ${e.type}.`);
        }

        // Deduct cost
        character.resources.gold -= cost.gold;
        cost.essences.forEach(e => {
            character.resources[e.type] = (character.resources[e.type] || 0) - e.amount;
        });

        character.treasury.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               WAREHOUSE
// ==========================================

router.post('/warehouse/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Postać nie znaleziona.");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };
        
        const capacity = getWarehouseCapacity(character.warehouse.level);
        if (character.warehouse.items.length >= capacity) throw new Error("Magazyn jest pełny.");

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) throw new Error("Przedmiot nie znajduje się w plecaku.");
        
        const item = character.inventory[itemIndex];
        if (item.isBorrowed) throw new Error("Nie można deponować pożyczonych przedmiotów.");

        // Przenoszenie
        character.inventory.splice(itemIndex, 1);
        character.warehouse.items.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/warehouse/withdraw', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Postać nie znaleziona.");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };
        
        const backpackCap = getBackpackCapacity(character);
        if (character.inventory.length >= backpackCap) throw new Error("Plecak jest pełny.");

        const itemIndex = character.warehouse.items.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) throw new Error("Przedmiot nie znajduje się w magazynie.");

        const item = character.warehouse.items[itemIndex];

        // Przenoszenie
        character.warehouse.items.splice(itemIndex, 1);
        character.inventory.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/warehouse/upgrade', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Postać nie znaleziona.");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.warehouse) character.warehouse = { level: 1, items: [] };
        
        const currentLevel = character.warehouse.level;
        if (currentLevel >= 10) throw new Error("Maksymalny poziom magazynu.");

        const cost = getWarehouseUpgradeCost(currentLevel);

        if (character.resources.gold < cost.gold) throw new Error("Brak złota na ulepszenie.");
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) throw new Error(`Brak esencji: ${e.type}.`);
        }

        // Deduct cost
        character.resources.gold -= cost.gold;
        cost.essences.forEach(e => {
            character.resources[e.type] = (character.resources[e.type] || 0) - e.amount;
        });

        character.warehouse.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
//               LOADOUTS
// ==========================================

// Zapisywanie zestawu
router.post('/loadouts/save', authenticateToken, async (req: any, res: any) => {
    const { loadoutId, name } = req.body; // loadoutId 0-4
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.loadouts) character.loadouts = [];

        // Snapshot current equipment IDs
        const eqSnapshot: any = {};
        for (const slot of Object.values(EquipmentSlot)) {
            eqSnapshot[slot] = character.equipment[slot]?.uniqueId || null;
        }

        const existingIdx = character.loadouts.findIndex(l => l.id === loadoutId);
        if (existingIdx > -1) {
            character.loadouts[existingIdx].equipment = eqSnapshot;
            if (name) character.loadouts[existingIdx].name = name;
        } else {
            if (character.loadouts.length >= 5) throw new Error("Maximum 5 loadouts allowed");
            character.loadouts.push({
                id: loadoutId,
                name: name || `Zestaw ${loadoutId + 1}`,
                equipment: eqSnapshot
            });
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// Wczytywanie zestawu
router.post('/loadouts/load', authenticateToken, async (req: any, res: any) => {
    const { loadoutId } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        const loadout = character.loadouts?.find(l => l.id === loadoutId);
        if (!loadout) throw new Error("Loadout not found");

        if (!character.warehouse) character.warehouse = { level: 1, items: [] };

        // 1. Calculate items to unequip
        const currentEquipped = Object.values(character.equipment).filter(i => i !== null) as ItemInstance[];
        
        // 2. Check Warehouse capacity
        const warehouseCap = getWarehouseCapacity(character.warehouse.level);
        const freeSpaces = warehouseCap - character.warehouse.items.length;

        if (currentEquipped.length > freeSpaces) {
            throw new Error(`Brak miejsca w Magazynie! Wymagane: ${currentEquipped.length}, Wolne: ${freeSpaces}.`);
        }

        // 3. Move current equipment to warehouse
        for (const slot of Object.values(EquipmentSlot)) {
            const item = character.equipment[slot];
            if (item) {
                character.warehouse.items.push(item);
                character.equipment[slot] = null;
            }
        }

        // 4. Equip items from the loadout
        // System szuka przedmiotu w warehouse lub inventory
        const targetEq = loadout.equipment;
        for (const slotStr of Object.keys(targetEq)) {
            const slot = slotStr as EquipmentSlot;
            const targetUniqueId = targetEq[slot];
            if (!targetUniqueId) continue;

            // Search Warehouse
            const wIdx = character.warehouse.items.findIndex(i => i.uniqueId === targetUniqueId);
            if (wIdx > -1) {
                character.equipment[slot] = character.warehouse.items[wIdx];
                character.warehouse.items.splice(wIdx, 1);
                continue;
            }

            // Search Inventory
            const iIdx = character.inventory.findIndex(i => i.uniqueId === targetUniqueId);
            if (iIdx > -1) {
                character.equipment[slot] = character.inventory[iIdx];
                character.inventory.splice(iIdx, 1);
                continue;
            }
            
            // If not found (e.g. sold), slot remains null
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// Zmiana nazwy zestawu
router.put('/loadouts/rename', authenticateToken, async (req: any, res: any) => {
    const { loadoutId, name } = req.body;
    const userId = req.user.id;

    try {
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        const character: PlayerCharacter = charRes.rows[0].data;
        const loadout = character.loadouts?.find(l => l.id === loadoutId);
        if (loadout) {
            loadout.name = name;
            await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
            res.json(character);
        } else {
            res.status(404).json({ message: "Loadout not found" });
        }
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/names', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`SELECT data->>'name' as name FROM characters ORDER BY name ASC`);
        const names = result.rows.map(row => row.name);
        res.json(names);
    } catch (err) {
        res.status(500).json({ message: 'Failed' });
    }
});

router.post('/', authenticateToken, async (req: any, res: any) => {
    const { name, race, startLocationId } = req.body;
    
    if (!name || !race || !startLocationId) {
        return res.status(400).json({ message: 'Name, race and start location are required.' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const existing = await client.query('SELECT 1 FROM characters WHERE user_id = $1', [req.user.id]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Character already exists.' });
        }
        
        const nameCheck = await client.query("SELECT 1 FROM characters WHERE data->>'name' = $1", [name]);
        if (nameCheck.rows.length > 0) {
             await client.query('ROLLBACK');
             return res.status(409).json({ message: 'Character name already taken.' });
        }
        
        const newCharacter: PlayerCharacter = {
            id: req.user.id,
            user_id: req.user.id,
            username: '',
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
            pvpProtectionUntil: 0,
            loadouts: [] // Inicjalizacja zestawów
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

router.post('/equip', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        const skills = gameDataRes.rows.find(r => r.key === 'skills')?.data || [];

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

        if (character.level < template.requiredLevel) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Level requirement not met' });
        }
        if (template.requiredStats) {
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
        
        if (character.equipment[targetSlot]) {
            itemsToUnequip.push(character.equipment[targetSlot]!);
        }

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

export default router;
