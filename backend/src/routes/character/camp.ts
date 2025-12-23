
import express from 'express';
import { pool } from '../../db.js';
import { calculateDerivedStatsOnServer, getCampUpgradeCost, getBackpackUpgradeCost } from '../../logic/stats.js';
import { PlayerCharacter } from '../../types.js';
import { fetchFullCharacter } from '../../logic/helpers.js';

const router = express.Router();

router.post('/heal', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const result = await client.query(`
            SELECT 
                c.data, g.buildings, g.active_buffs
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [req.user.id]);

        if (result.rows.length === 0) throw new Error("Postać nie znaleziona.");

        const char = result.rows[0].data as PlayerCharacter;
        const buildings = result.rows[0].buildings || {};
        const buffs = result.rows[0].active_buffs || [];

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const gameData = gameDataRes.rows.reduce((acc: any, r: any) => ({ ...acc, [r.key]: r.data }), {});
        
        const derived = calculateDerivedStatsOnServer(
            char, 
            gameData.itemTemplates || [], 
            gameData.affixes || [], 
            buildings.barracks || 0, 
            buildings.shrine || 0, 
            gameData.skills || [],
            buffs
        );

        char.stats.currentHealth = derived.stats.maxHealth;
        char.stats.currentMana = derived.stats.maxMana;
        char.isResting = false;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        const fullChar = await fetchFullCharacter(client, req.user.id);
        await client.query('COMMIT');
        res.json(fullChar);
    } catch (err: any) { 
        await client.query('ROLLBACK'); 
        res.status(500).json({ message: err.message || 'Błąd leczenia' }); 
    }
    finally { client.release(); }
});

router.post('/upgrade', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        const cost = getCampUpgradeCost(char.camp.level);
        if (char.resources.gold < cost.gold) throw new Error("Za mało złota.");
        for (const e of cost.essences) if ((char.resources[e.type] || 0) < e.amount) throw new Error(`Brak esencji: ${e.type}`);
        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        char.camp.level += 1;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        const fullChar = await fetchFullCharacter(client, req.user.id);
        await client.query('COMMIT');
        res.json(fullChar);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/backpack-upgrade', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const char = charRes.rows[0].data as PlayerCharacter;
        const currentBackpackLevel = char.backpack?.level || 1;
        const cost = getBackpackUpgradeCost(currentBackpackLevel);
        
        if ((char.resources.gold || 0) < cost.gold) throw new Error("Za mało złota.");
        
        for (const e of cost.essences) {
            const owned = char.resources[e.type] || 0;
            if (owned < e.amount) throw new Error(`Brak esencji: ${e.type}`);
        }
        
        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        
        if (!char.backpack) char.backpack = { level: 1 };
        char.backpack.level = currentBackpackLevel + 1;
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        const fullChar = await fetchFullCharacter(client, req.user.id);
        await client.query('COMMIT');
        res.json(fullChar);
    } catch (err: any) { 
        await client.query('ROLLBACK'); 
        res.status(400).json({ message: err.message }); 
    } finally { 
        client.release(); 
    }
});

export default router;
