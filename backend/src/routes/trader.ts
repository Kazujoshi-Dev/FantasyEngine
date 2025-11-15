import express from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, ItemInstance, TraderInventoryData } from '../types.js';
import { generateTraderInventory, createGuaranteedAffixItem } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

let traderInventory: ItemInstance[] = [];
let specialOfferItem: ItemInstance | null = null;
let lastTraderRefresh = 0;

const refreshTraderInventoryIfNeeded = async () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    if (now - lastTraderRefresh > oneHour || lastTraderRefresh === 0) {
        const gameDataRes = await pool.query("SELECT key, data FROM game_data");
        const gameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);
        
        if (gameData.itemTemplates && gameData.affixes && gameData.settings) {
            const newInventory = generateTraderInventory(gameData.itemTemplates, gameData.affixes, gameData.settings);
            traderInventory = newInventory.regularItems;
            specialOfferItem = newInventory.specialOfferItem;
            lastTraderRefresh = now;
            console.log('Trader inventory refreshed.');
        }
    }
};

router.get('/inventory', authenticateToken, async (req: Request, res: Response) => {
    const force = req.query.force === 'true';
    if (force) {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username === 'Kazujoshi') {
             lastTraderRefresh = 0; // Force refresh
             console.log('Force refreshing trader inventory by admin.');
        } else {
            return res.status(403).json({ message: 'Forbidden' });
        }
    }
    await refreshTraderInventoryIfNeeded();
    res.json({ regularItems: traderInventory, specialOfferItem });
});

export default router;