


// fix: Use named imports for Express types
import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, ItemInstance, TraderInventoryData, ItemTemplate, Affix } from '../types.js';
import { generateTraderInventory } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

let traderInventory: ItemInstance[] = [];
let specialOfferItems: ItemInstance[] = [];
let lastTraderRefresh = 0;
let cachedGameDataForTrader: GameData | null = null;

const refreshTraderInventoryIfNeeded = async () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    if (now - lastTraderRefresh > oneHour || lastTraderRefresh === 0 || !cachedGameDataForTrader) {
        const gameDataRes = await pool.query("SELECT key, data FROM game_data");
        const gameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);
        
        if (gameData.itemTemplates && gameData.affixes && gameData.settings) {
            const newInventory = generateTraderInventory(gameData.itemTemplates, gameData.affixes, gameData.settings);
            traderInventory = newInventory.regularItems;
            specialOfferItems = newInventory.specialOfferItems;
            lastTraderRefresh = now;
            cachedGameDataForTrader = gameData;
            console.log('Trader inventory and game data cache refreshed.');
        }
    }
};

router.get('/inventory', authenticateToken, async (req: Request, res: Response) => {
    const force = req.query.force === 'true';
    if (force) {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username === 'Kazujoshi') {
             lastTraderRefresh = 0; // Force refresh
             cachedGameDataForTrader = null;
             console.log('Force refreshing trader inventory by admin.');
        } else {
            return res.status(403).json({ message: 'Forbidden' });
        }
    }
    await refreshTraderInventoryIfNeeded();
    res.json({ regularItems: traderInventory, specialOfferItems });
});

router.post('/buy', authenticateToken, async (req: Request, res: Response) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await refreshTraderInventoryIfNeeded();
        await client.query('BEGIN');

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            throw new Error('Character not found.');
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        if (character.inventory.length >= getBackpackCapacity(character)) {
            throw new Error('Inventory is full.');
        }
        
        if (!cachedGameDataForTrader) {
            throw new Error('Trader data is not available. Please try again in a moment.');
        }
        const itemTemplates: ItemTemplate[] = cachedGameDataForTrader.itemTemplates || [];
        const affixes: Affix[] = cachedGameDataForTrader.affixes || [];
        
        const itemToBuy = traderInventory.find(i => i.uniqueId === itemId) || specialOfferItems.find(i => i.uniqueId === itemId);
        if (!itemToBuy) {
            throw new Error('Item not found in trader inventory.');
        }

        const template = itemTemplates.find(t => t.id === itemToBuy.templateId);
        if(!template) {
            console.error(`CRITICAL: Template not found for item ${itemToBuy.uniqueId} (templateId: ${itemToBuy.templateId}) even with cached game data. This indicates a data corruption issue during item generation.`);
            throw new Error('Item template not found.');
        }
        
        let itemValue = template.value;
        if(itemToBuy.prefixId) itemValue += affixes.find(a => a.id === itemToBuy.prefixId)?.value || 0;
        if(itemToBuy.suffixId) itemValue += affixes.find(a => a.id === itemToBuy.suffixId)?.value || 0;
        
        const isSpecial = specialOfferItems.some(i => i.uniqueId === itemToBuy.uniqueId);
        const cost = isSpecial ? itemValue * 5 : itemValue * 2;

        if (character.resources.gold < cost) {
            throw new Error('Not enough gold.');
        }

        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);

        if (isSpecial) {
            specialOfferItems = specialOfferItems.filter(i => i.uniqueId !== itemId);
        } else {
            traderInventory = traderInventory.filter(i => i.uniqueId !== itemId);
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');

        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message || 'Failed to buy item.' });
    } finally {
        client.release();
    }
});

router.post('/sell', authenticateToken, async (req: Request, res: Response) => {
    const { itemIds } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character: PlayerCharacter = charRes.rows[0].data;
        
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        let totalValue = 0;
        const itemsToSell = character.inventory.filter(i => itemIds.includes(i.uniqueId));
        
        if(itemsToSell.length !== itemIds.length) {
            throw new Error("Some items to sell were not found in inventory.");
        }

        for (const item of itemsToSell) {
            const template = itemTemplates.find(t => t.id === item.templateId);
            let itemValue = template?.value || 0;
            if(item.prefixId) itemValue += affixes.find(a => a.id === item.prefixId)?.value || 0;
            if(item.suffixId) itemValue += affixes.find(a => a.id === item.suffixId)?.value || 0;
            totalValue += itemValue;
        }
        
        character.inventory = character.inventory.filter(i => !itemIds.includes(i.uniqueId));
        character.resources.gold += totalValue;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');

        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message || 'Failed to sell items.' });
    } finally {
        client.release();
    }
});


export default router;
