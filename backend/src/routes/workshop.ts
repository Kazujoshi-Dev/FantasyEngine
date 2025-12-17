import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData } from '../types.js';
import { getWorkshopUpgradeCost, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { performCraft, performReforge } from '../logic/crafting.js';

const router = express.Router();

router.post('/upgrade', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        // Ensure workshop exists
        if (!character.workshop) character.workshop = { level: 0 };
        
        const currentLevel = character.workshop.level;
        if (currentLevel >= 10) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Max level reached' });
        }
        
        // Fetch Settings
        const settingsRes = await client.query("SELECT data FROM game_data WHERE key = 'settings'");
        const settings = settingsRes.rows[0]?.data;

        const { gold, essences } = getWorkshopUpgradeCost(currentLevel + 1, settings?.crafting);
        
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
        character.workshop.level = currentLevel + 1;

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

router.post('/craft', authenticateToken, async (req: any, res: any) => {
    const { slot, rarity } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        let character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);

        const result = performCraft(character, gameData, slot, rarity);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(result.character), req.user.id]);
        await client.query('COMMIT');
        
        // Return both character and the new item
        res.json({ character: result.character, item: result.item });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/reforge', authenticateToken, async (req: any, res: any) => {
    const { itemId, type } = req.body; // type: 'values' | 'affixes'
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Postać nie znaleziona");
        
        let character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);

        // CRITICAL FIX: Calculate derived stats (including Luck from items) before reforging
        const charWithStats = calculateDerivedStatsOnServer(
            character, 
            gameData.itemTemplates || [], 
            gameData.affixes || [],
            0, 0, // Guild levels are fetched within calculateDerivedStats if needed, here we provide defaults
            gameData.skills || []
        );

        // Perform reforge using the character with calculated Luck
        const updatedCharacter = performReforge(charWithStats, gameData, itemId, type);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(updatedCharacter), req.user.id]);
        await client.query('COMMIT');
        res.json(updatedCharacter);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Reforge error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;