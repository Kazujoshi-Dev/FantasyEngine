
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, ItemInstance, TraderInventoryData, ItemTemplate, Affix, GameSettings, Language, TraderData } from '../types.js';
import { generateTraderInventory } from '../logic/items.js';
// Fix: Import getBackpackCapacity from stats.js
import { getBackpackCapacity } from '../logic/stats.js';

const router = express.Router();

const ONE_HOUR_MS = 60 * 60 * 1000;

// Helper to refresh inventory for a specific character
const refreshCharacterTraderInventory = async (character: PlayerCharacter, force: boolean = false, client: any) => {
    const now = Date.now();
    const lastRefresh = character.traderData?.lastRefresh || 0;
    
    // Check if refresh is needed (every hour or forced)
    const currentHour = Math.floor(now / ONE_HOUR_MS);
    const lastRefreshHour = Math.floor(lastRefresh / ONE_HOUR_MS);

    if (force || currentHour > lastRefreshHour || !character.traderData) {
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'settings')");
        const gameData: Partial<GameData> = gameDataRes.rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.data }), {});
        
        const itemTemplates = gameData.itemTemplates || [];
        const affixes = gameData.affixes || [];
        const settings = gameData.settings || { language: Language.PL } as GameSettings;

        if (itemTemplates.length > 0) {
            const { regularItems, specialOfferItems } = generateTraderInventory(itemTemplates, affixes, settings);
            
            character.traderData = {
                regularItems,
                specialOfferItems,
                lastRefresh: now
            };
            
            return true; // Indicates updated
        }
    }
    return false;
};


router.get('/inventory', authenticateToken, async (req: any, res: any) => {
    const forceRefresh = req.query.force === 'true';
    const userId = req.user!.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }

        const character: PlayerCharacter = charRes.rows[0].data;
        
        const updated = await refreshCharacterTraderInventory(character, forceRefresh, client);
        
        if (updated) {
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, userId]);
        }
        
        await client.query('COMMIT');
        
        res.json({ 
            regularItems: character.traderData?.regularItems || [], 
            specialOfferItems: character.traderData?.specialOfferItems || [] 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch trader inventory' });
    } finally {
        client.release();
    }
});

router.post('/buy', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const userId = req.user!.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        
        let character: PlayerCharacter = charRes.rows[0].data;

        // Ensure inventory is initialized if character was just created or migrated
        const updated = await refreshCharacterTraderInventory(character, false, client);
        if (updated) {
             // If we generated new items, the item ID from request might be stale, 
             // but we proceed to check against CURRENT inventory.
             // Usually frontend refreshes before buying, but race conditions exist.
        }

        const traderData = character.traderData;
        if (!traderData) {
             await client.query('ROLLBACK');
             return res.status(500).json({ message: 'Trader inventory not available.' });
        }

        const itemToBuy = traderData.regularItems.find(i => i.uniqueId === itemId) || traderData.specialOfferItems.find(i => i.uniqueId === itemId);
        
        if (!itemToBuy) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Item not found in trader inventory.' });
        }

        // Fetch metadata to calculate cost
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const template = itemTemplates.find((t: any) => t.id === itemToBuy.templateId)!;
        let itemValue = Number(template.value) || 0;
        if (itemToBuy.prefixId) {
            const prefix = affixes.find((a: any) => a.id === itemToBuy.prefixId);
            itemValue += Number(prefix?.value) || 0;
        }
        if (itemToBuy.suffixId) {
            const suffix = affixes.find((a: any) => a.id === itemToBuy.suffixId);
            itemValue += Number(suffix?.value) || 0;
        }

        const isSpecial = traderData.specialOfferItems.some(i => i.uniqueId === itemId);
        const cost = isSpecial ? itemValue * 5 : itemValue * 2;
        
        if (character.resources.gold < cost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold.' });
        }
        if (character.inventory.length >= getBackpackCapacity(character)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Inventory is full.' });
        }

        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);

        // Remove from trader inventory
        if(isSpecial) {
             character.traderData!.specialOfferItems = traderData.specialOfferItems.filter(i => i.uniqueId !== itemId);
        } else {
             character.traderData!.regularItems = traderData.regularItems.filter(i => i.uniqueId !== itemId);
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
            if (item.isBorrowed) {
                await client.query('ROLLBACK');
                return res.status(403).json({ message: 'Cannot sell borrowed items.' });
            }

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
