// FIX: Use explicit express types to resolve type conflicts.
// FIX: Replaced default express import with named imports for Request and Response to resolve type conflicts.
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, ItemInstance } from '../types.js';
import { generateTraderInventory, createGuaranteedAffixItem } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

let traderInventory: ItemInstance[] = [];
let specialOfferItem: ItemInstance | null = null;
let lastTraderRefresh = 0;

const refreshTraderInventoryIfNeeded = async () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    if (now - lastTraderRefresh > oneHour) {
        const gameDataRes = await pool.query("SELECT key, data FROM game_data");
        const gameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {});
        
        const newInventory = generateTraderInventory(gameData.itemTemplates, gameData.affixes, gameData.settings);
        traderInventory = newInventory.regularItems;
        specialOfferItem = newInventory.specialOfferItem;
        lastTraderRefresh = now;
        console.log('Trader inventory refreshed.');
    }
};

// FIX: Use explicit express types for req, res.
router.get('/inventory', authenticateToken, async (req: express.Request, res: express.Response) => {
    const forceRefresh = req.query.force === 'true';
    if (forceRefresh) {
        lastTraderRefresh = 0; // Force refresh on next check
    }
    await refreshTraderInventoryIfNeeded();
    res.json({ regularItems: traderInventory, specialOfferItem: specialOfferItem });
});

// FIX: Use explicit express types for req, res.
router.post('/buy', authenticateToken, async (req: express.Request, res: express.Response) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        let itemToBuy = traderInventory.find(i => i.uniqueId === itemId);
        let isSpecialOffer = false;
        if (!itemToBuy && specialOfferItem?.uniqueId === itemId) {
            itemToBuy = specialOfferItem;
            isSpecialOffer = true;
        }

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

        let cost: number;
        if (isSpecialOffer) {
            let itemValue = template.value;
            if (itemToBuy.prefixId) {
                const prefix = affixes.find((a: any) => a.id === itemToBuy.prefixId);
                if (prefix) itemValue += prefix.value || 0;
            }
            if (itemToBuy.suffixId) {
                const suffix = affixes.find((a: any) => a.id === itemToBuy.suffixId);
                if (suffix) itemValue += suffix.value || 0;
            }
            cost = itemValue * 5;
        } else {
            cost = template.value * 2;
        }

        if (character.resources.gold < cost) {
            return res.status(400).json({ message: 'Not enough gold' });
        }
        if (character.inventory.length >= getBackpackCapacity(character)) {
            return res.status(400).json({ message: 'Inventory is full' });
        }

        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);
        
        if (isSpecialOffer) {
            specialOfferItem = null;
        } else {
            traderInventory = traderInventory.filter(i => i.uniqueId !== itemId);
        }


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

// FIX: Use explicit express types for req, res.
router.post('/buy-mysterious', authenticateToken, async (req: express.Request, res: express.Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        const cost = 5000;

        if (character.resources.gold < cost) {
            return res.status(400).json({ message: 'Not enough gold' });
        }
        if (character.inventory.length >= getBackpackCapacity(character)) {
            return res.status(400).json({ message: 'Inventory is full' });
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const newItem = createGuaranteedAffixItem(itemTemplates, affixes);
        if (!newItem) {
            throw new Error("Failed to generate a mysterious item.");
        }

        character.resources.gold -= cost;
        character.inventory.push(newItem);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error buying mysterious item:", err);
        res.status(500).json({ message: 'Server error during purchase' });
    } finally {
        client.release();
    }
});

// FIX: Use explicit express types for req, res.
router.post('/sell', authenticateToken, async (req: express.Request, res: express.Response) => {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: 'No items to sell' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
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