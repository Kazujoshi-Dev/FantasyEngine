
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, ActiveTowerRun, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, SkillCost, EssenceType, CharacterClass, CharacterResources, EquipmentLoadout, GuildBuff, Skill, SkillType, SkillCategory } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getTreasuryCapacity, calculateDerivedStatsOnServer, getWarehouseCapacity } from '../logic/stats.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';
import { pruneExpiredBuffs } from '../logic/guilds.js';

const router = express.Router();

// GET /api/character - Pobierz dane postaci (rozszerzone o gildię i wieżę)
router.get('/', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
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
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [req.user.id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json(null);
        }

        const row = result.rows[0];
        const charData: PlayerCharacter = row.data;

        if (row.email) charData.email = row.email;

        if (row.guild_id) {
            charData.guildId = row.guild_id;
            charData.guildBarracksLevel = row.buildings?.barracks || 0;
            charData.guildShrineLevel = row.buildings?.shrine || 0;
            const { pruned, wasModified } = pruneExpiredBuffs(row.active_buffs || []);
            if (wasModified) {
                await client.query('UPDATE guilds SET active_buffs = $1 WHERE id = $2', [JSON.stringify(pruned), row.guild_id]);
                charData.activeGuildBuffs = pruned;
            } else {
                charData.activeGuildBuffs = row.active_buffs || [];
            }
        } else {
            charData.guildId = undefined;
            charData.activeGuildBuffs = [];
        }

        if (row.active_tower_run) {
            charData.activeTowerRun = {
                id: row.active_tower_run.id,
                userId: row.active_tower_run.user_id,
                towerId: row.active_tower_run.tower_id,
                currentFloor: row.active_tower_run.current_floor,
                currentHealth: row.active_tower_run.current_health,
                currentMana: row.active_tower_run.current_mana,
                accumulatedRewards: row.active_tower_run.accumulated_rewards,
                status: row.active_tower_run.status
            };
        }

        await client.query('COMMIT');
        res.json(charData);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Błąd pobierania postaci' });
    } finally {
        client.release();
    }
});

// Leczenie postaci
router.post('/heal', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const gameData = gameDataRes.rows.reduce((acc: any, r: any) => ({ ...acc, [r.key]: r.data }), {});
        
        const derived = calculateDerivedStatsOnServer(char, gameData.itemTemplates, gameData.affixes, 0, 0, gameData.skills);
        
        char.stats.currentHealth = derived.stats.maxHealth;
        char.stats.currentMana = derived.stats.maxMana;
        char.isResting = false;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Błąd leczenia' });
    } finally {
        client.release();
    }
});

// --- SKARBIEC (TREASURY) ---
router.post('/treasury/deposit', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        
        if (!char.treasury) char.treasury = { level: 1, gold: 0 };
        const cap = getTreasuryCapacity(char.treasury.level);
        const canFit = cap - char.treasury.gold;
        const toDeposit = Math.min(amount, char.resources.gold, canFit);

        if (toDeposit <= 0) throw new Error("Skarbiec jest pełny lub nie masz złota.");

        char.resources.gold -= toDeposit;
        char.treasury.gold += toDeposit;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally { client.release(); }
});

router.post('/treasury/withdraw', authenticateToken, async (req: any, res: any) => {
    const { amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        
        if (!char.treasury || char.treasury.gold < amount) throw new Error("Brak środków w skarbcu.");

        char.resources.gold += amount;
        char.treasury.gold -= amount;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally { client.release(); }
});

// --- MAGAZYN (WAREHOUSE) ---
router.post('/warehouse/deposit', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        
        if (!char.warehouse) char.warehouse = { level: 1, items: [] };
        const cap = getWarehouseCapacity(char.warehouse.level);
        if (char.warehouse.items.length >= cap) throw new Error("Magazyn jest pełny.");

        const idx = char.inventory.findIndex((i: any) => i.uniqueId === itemId);
        if (idx === -1) throw new Error("Przedmiot nie znaleziony.");

        const [item] = char.inventory.splice(idx, 1);
        char.warehouse.items.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally { client.release(); }
});

router.post('/warehouse/withdraw', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        
        if (char.inventory.length >= getBackpackCapacity(char)) throw new Error("Plecak jest pełny.");

        const idx = char.warehouse.items.findIndex((i: any) => i.uniqueId === itemId);
        if (idx === -1) throw new Error("Przedmiot nie znaleziony w magazynie.");

        const [item] = char.warehouse.items.splice(idx, 1);
        char.inventory.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally { client.release(); }
});

// --- UPGRADES ---
router.post('/camp/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        const cost = getCampUpgradeCost(char.camp.level);
        
        if (char.resources.gold < cost.gold) throw new Error("Za mało złota.");
        for (const e of cost.essences) if (char.resources[e.type] < e.amount) throw new Error(`Brak esencji: ${e.type}`);

        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        char.camp.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/treasury/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (!char.treasury) char.treasury = { level: 1, gold: 0 };
        const cost = getTreasuryUpgradeCost(char.treasury.level);
        
        if (char.resources.gold < cost.gold) throw new Error("Za mało złota.");
        for (const e of cost.essences) if (char.resources[e.type] < e.amount) throw new Error(`Brak esencji: ${e.type}`);

        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        char.treasury.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/warehouse/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (!char.warehouse) char.warehouse = { level: 1, items: [] };
        const cost = getWarehouseUpgradeCost(char.warehouse.level);
        
        if (char.resources.gold < cost.gold) throw new Error("Za mało złota.");
        for (const e of cost.essences) if (char.resources[e.type] < e.amount) throw new Error(`Brak esencji: ${e.type}`);

        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        char.warehouse.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/backpack/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        const cost = getBackpackUpgradeCost(char.backpack?.level || 1);
        
        if (char.resources.gold < cost.gold) throw new Error("Za mało złota.");
        for (const e of cost.essences) if (char.resources[e.type] < e.amount) throw new Error(`Brak esencji: ${e.type}`);

        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        if(!char.backpack) char.backpack = { level: 1 };
        char.backpack.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

// Statystyki
router.post('/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        let spent = 0;
        for (const [k, v] of Object.entries(stats)) {
            const p = parseInt(v as string);
            if (p > 0) { (character.stats as any)[k] += p; spent += p; }
        }
        if (character.stats.statPoints < spent) throw new Error("Brak punktów.");
        character.stats.statPoints -= spent;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/reset-stats', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        const keys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
        let returned = 0;
        keys.forEach(k => { if (character.stats[k] > 1) { returned += (character.stats[k] - 1); character.stats[k] = 1; } });
        const resets = character.resetsUsed || 0;
        const cost = resets > 0 ? returned * 1000 : 0;
        if (character.resources.gold < cost) throw new Error("Brak złota.");
        character.resources.gold -= cost;
        character.stats.statPoints += returned;
        character.resetsUsed = resets + 1;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

// Umiejętności
router.post('/skills/learn', authenticateToken, async (req: any, res: any) => {
    const { skillId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        const skillsRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        const skill = (skillsRes.rows[0]?.data || []).find((s:any) => s.id === skillId);
        if (!skill) throw new Error("Skill nie istnieje.");
        // Logika wymagań i kosztów... (uproszczona)
        if (!character.learnedSkills) character.learnedSkills = [];
        character.learnedSkills.push(skillId);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

export default router;
