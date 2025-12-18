
import express from 'express';
import { pool } from '../../db.js';
import { calculateDerivedStatsOnServer, getCampUpgradeCost, getBackpackUpgradeCost } from '../../logic/stats.js';

const router = express.Router();

// POST /api/character/camp/heal - Leczenie w obozie
router.post('/heal', async (req: any, res: any) => {
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
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Błąd leczenia' }); }
    finally { client.release(); }
});

// POST /api/character/camp/upgrade - Ulepszenie obozu
router.post('/upgrade', async (req: any, res: any) => {
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

// POST /api/character/camp/backpack-upgrade
router.post('/backpack-upgrade', async (req: any, res: any) => {
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

export default router;
