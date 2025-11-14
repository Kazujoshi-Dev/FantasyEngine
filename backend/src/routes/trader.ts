// fix: Changed import to use express namespace for types, resolving conflicts.
import express, { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, ItemInstance } from '../types.js';
import { generateTraderInventory } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = Router();

let traderInventory: ItemInstance[] = [];
let lastTraderRefresh = 0;

const refreshTraderInventoryIfNeeded = async () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    if (now - lastTraderRefresh > oneHour) {
        const gameDataRes = await pool.query("SELECT key, data FROM game_data");
        const gameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {});
        
        traderInventory = generateTraderInventory(gameData.itemTemplates, gameData.affixes, gameData.settings);
        lastTraderRefresh = now;
        console.log('Trader inventory refreshed.');
    }
};

// fix: Use express.Request and express.Response types.
router.get('/inventory', authenticateToken, async (req: express.Request, res: express.Response) => {
    const forceRefresh = req.query.force === 'true';
    if (forceRefresh) {
        lastTraderRefresh = 0; // Force refresh on next check
    }
    await refreshTraderInventoryIfNeeded();
    res.json(traderInventory);
});

// fix: Use express.Request and express.Response types.
router.post('/buy', authenticateToken, async (req: express.Request, res: express.Response) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // fix: Use req.user directly, as its type is extended globally.
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        const itemToBuy = traderInventory.find(i => i.uniqueId === itemId);
        if (!itemToBuy) {
            return res.status(404).json({ message: 'Item not available from trader' });
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        const template = itemTemplates.find((t: any) => t.id === itemToBuy.templateId);
        
        if (!template) {
            console.error(`Inconsistent data: Item template ${itemToBuy.templateId} not found for item ${itemToBuy.uniqueId}.`);
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'Item data is inconsistent. Please contact an administrator.' });
        }

        let cost = template.value * 2;

        if (character.resources.gold < cost) {
            return res.status(400).json({ message: 'Not enough gold' });
        }
        if (character.inventory.length >= getBackpackCapacity(character)) {
            return res.status(400).json({ message: 'Inventory is full' });
        }

        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);
        traderInventory = traderInventory.filter(i => i.uniqueId !== itemId);

        // fix: Use req.user directly, as its type is extended globally.
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error during trader purchase:", err);
        res.status(500).json({ message: 'Server error during purchase' });
    } finally {
        client.release();
    }
});

// fix: Use express.Request and express.Response types.
router.post('/sell', authenticateToken, async (req: express.Request, res: express.Response) => {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: 'No items to sell' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // fix: Use req.user directly, as its type is extended globally.
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        let totalValue = 0;
        const remainingInventory = character.inventory.filter(item => {
            if (itemIds.includes(item.uniqueId)) {
                const template = itemTemplates.find((t: any) => t.id === item.templateId);
                let value = template?.value || 0;
                // Add affix value if needed
                totalValue += value;
                return false; // remove from inventory
            }
            return true;
        });

        if (remainingInventory.length === character.inventory.length - itemIds.length) {
            character.inventory = remainingInventory;
            character.resources.gold += totalValue;
        } else {
            throw new Error("Mismatch selling items, rolling back.");
        }
        
        // fix: Use req.user directly, as its type is extended globally.
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Server error during selling' });
    } finally {
        client.release();
    }
});


export default router;