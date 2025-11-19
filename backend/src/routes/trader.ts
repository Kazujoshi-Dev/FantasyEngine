
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, ItemInstance, TraderInventoryData, ItemTemplate, Affix, GameSettings, Language } from '../types.js';
import { generateTraderInventory } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

let traderInventory: ItemInstance[] = [];
let specialOfferItems: ItemInstance[] = [];
let lastTraderRefresh = 0;
let cachedGameDataForTrader: GameData | null = null;

const refreshTraderInventoryIfNeeded = async (force: boolean = false) => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const currentHour = Math.floor(now / oneHour);
    const lastRefreshHour = Math.floor(lastTraderRefresh / oneHour);

    if (force || currentHour > lastRefreshHour || !cachedGameDataForTrader || traderInventory.length === 0) {
        console.log('Refreshing trader inventory...');
        const gameDataRes = await pool.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'settings')");
        const gameData: Partial<GameData> = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {});
        
        const itemTemplates = gameData.itemTemplates || [];
        const affixes = gameData.affixes || [];
        // Provide default settings if missing from DB
        const settings = gameData.settings || { language: Language.PL } as GameSettings;

        if (itemTemplates.length > 0) {
            const { regularItems, specialOfferItems: newSpecialOffers } = generateTraderInventory(itemTemplates, affixes, settings);
            traderInventory = regularItems;
            specialOfferItems = newSpecialOffers;
            lastTraderRefresh = now;
            cachedGameDataForTrader = { itemTemplates, affixes, settings } as GameData;
        } else {
             console.warn('No item templates found in database, cannot generate trader inventory.');
        }
    }
};

router.get('/inventory', authenticateToken, async (req: any, res: any) => {
    const forceRefresh = req.query.force === 'true';
    await refreshTraderInventoryIfNeeded(forceRefresh);
    res.json({ regularItems: traderInventory, specialOfferItems: specialOfferItems });
});

router.post('/buy', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character: PlayerCharacter = charRes.rows[0].data;

        await refreshTraderInventoryIfNeeded(); // Make sure inventory is fresh before buying

        const itemToBuy = traderInventory.find(i => i.uniqueId === itemId) || specialOfferItems.find(i => i.uniqueId === itemId);
        if (!itemToBuy) {
            return res.status(404).json({ message: 'Item not found in trader inventory.' });
        }

        const template = cachedGameDataForTrader!.itemTemplates.find(t => t.id === itemToBuy.templateId)!;
        let itemValue = Number(template.value) || 0;
        if (itemToBuy.prefixId) {
            const prefix = cachedGameDataForTrader!.affixes.find(a => a.id === itemToBuy.prefixId);
            itemValue += Number(prefix?.value) || 0;
        }
        if (itemToBuy.suffixId) {
            const suffix = cachedGameDataForTrader!.affixes.find(a => a.id === itemToBuy.suffixId);
            itemValue += Number(suffix?.value) || 0;
        }

        const isSpecial = specialOfferItems.some(i => i.uniqueId === itemId);
        const cost = isSpecial ? itemValue * 5 : itemValue * 2;
        
        if (character.resources.gold < cost) {
            return res.status(400).json({ message: 'Not enough gold.' });
        }
        if (character.inventory.length >= getBackpackCapacity(character)) {
            return res.status(400).json({ message: 'Inventory is full.' });
        }

        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);

        if(isSpecial) {
             specialOfferItems = specialOfferItems.filter(i => i.uniqueId !== itemId);
        } else {
             traderInventory = traderInventory.filter(i => i.uniqueId !== itemId);
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

router.post('/sell', authenticateToken, async (req: any, res: any) => {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: 'Item IDs must be a non-empty array.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        let totalValue = 0;
        const itemsToSell = character.inventory.filter(item => itemIds.includes(item.uniqueId));

        if (itemsToSell.length !== itemIds.length) {
             await client.query('ROLLBACK');
            return res.status(404).json({ message: 'One or more items not found in inventory.' });
        }

        for (const item of itemsToSell) {
            const template = itemTemplates.find(t => t.id === item.templateId);
            let itemValue = Number(template?.value) || 0;
            if (item.prefixId) {
                const prefix = affixes.find(a => a.id === item.prefixId);
                itemValue += Number(prefix?.value) || 0;
            }
            if (item.suffixId) {
                const suffix = affixes.find(a => a.id === item.suffixId);
                itemValue += Number(suffix?.value) || 0;
            }
            totalValue += itemValue;
        }

        character.inventory = character.inventory.filter(item => !itemIds.includes(item.uniqueId));
        
        const currentGold = character.resources.gold;
        character.resources.gold = (Number.isFinite(currentGold) ? currentGold : 0) + totalValue;
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Sell items error:", err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

export default router;
