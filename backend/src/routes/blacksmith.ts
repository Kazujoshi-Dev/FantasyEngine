
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, ItemRarity, EssenceType, ItemTemplate, CharacterClass } from '../types.js';

const router = express.Router();

router.post('/disenchant', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        // Defensive initialization to prevent data corruption
        if (!character.resources) {
            character.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
        }
        if (!character.inventory) {
            character.inventory = [];
        }
        character.inventory = character.inventory.filter(i => i); // Remove any nulls

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in inventory' });
        }
        const item = character.inventory[itemIndex];
        if (item.isBorrowed) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Cannot disenchant borrowed items.' });
        }
        
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows[0].data;
        const template = itemTemplates.find((t: any) => t.id === character.inventory[itemIndex].templateId);
        if (!template) {
             return res.status(404).json({ message: 'Item template not found' });
        }

        const cost = Math.round(Number(template.value) * 0.1);
        if ((Number(character.resources.gold) || 0) < cost) {
            return res.status(400).json({ message: 'Not enough gold' });
        }
        character.resources.gold = (Number(character.resources.gold) || 0) - cost;
        character.inventory.splice(itemIndex, 1);

        let essenceType: EssenceType | null = null;
        let amount = 0;
        let success = true;

        switch (template.rarity) {
            case ItemRarity.Common: essenceType = EssenceType.Common; amount = Math.floor(Math.random() * 4) + 1; break;
            case ItemRarity.Uncommon: essenceType = EssenceType.Uncommon; amount = Math.floor(Math.random() * 2) + 1; break;
            case ItemRarity.Rare: essenceType = EssenceType.Rare; amount = Math.floor(Math.random() * 2) + 1; break;
            case ItemRarity.Epic: essenceType = EssenceType.Epic; amount = 1; break;
            case ItemRarity.Legendary: essenceType = EssenceType.Legendary; if(Math.random() < 0.5) amount = 1; else success = false; break;
        }

        // Engineer Class Bonus
        if (character.characterClass === CharacterClass.Engineer && Math.random() < 0.5) {
            amount *= 2;
        }

        if (essenceType && amount > 0) {
            character.resources[essenceType] = (Number(character.resources[essenceType]) || 0) + amount;
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        
        res.json({ updatedCharacter: character, result: { success, amount, essenceType } });

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

router.post('/upgrade', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        
        let character: PlayerCharacter = charRes.rows[0].data;

        // Defensive initialization to prevent data corruption
        if (!character.resources) {
            character.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
        }
        if (!character.inventory) {
            character.inventory = [];
        }
        if (!character.equipment) {
            character.equipment = { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null };
        }
        character.inventory = character.inventory.filter(i => i); // Remove any nulls
        
        const itemLocation = ['inventory', ...Object.keys(character.equipment)].find(loc => {
            if(loc === 'inventory') return character.inventory.some(i => i && i.uniqueId === itemId);
            return (character.equipment as any)[loc]?.uniqueId === itemId;
        });

        if (!itemLocation) return res.status(404).json({ message: 'Item not found' });
        
        const isInventory = itemLocation === 'inventory';
        const item = isInventory ? character.inventory.find(i=>i.uniqueId === itemId)! : (character.equipment as any)[itemLocation];

        if (item.isBorrowed) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Cannot upgrade borrowed items.' });
        }

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const template: ItemTemplate | undefined = gameDataRes.rows[0].data.find((t: any) => t.id === item.templateId);
        if (!template) return res.status(404).json({ message: 'Item template not found' });

        const currentLevel = item.upgradeLevel || 0;
        if(currentLevel >= 10) return res.status(400).json({ message: 'Item is at max level' });

        const nextLevel = currentLevel + 1;
        const rarityMultiplier = { [ItemRarity.Common]: 1, [ItemRarity.Uncommon]: 1.5, [ItemRarity.Rare]: 2.5, [ItemRarity.Epic]: 4, [ItemRarity.Legendary]: 8 };
        const goldCost = Math.floor(Number(template.value) * 0.5 * nextLevel * rarityMultiplier[template.rarity]);
        
        let essenceType: EssenceType | null = null;
        switch(template.rarity) {
            case ItemRarity.Common: essenceType = EssenceType.Common; break;
            case ItemRarity.Uncommon: essenceType = EssenceType.Uncommon; break;
            case ItemRarity.Rare: essenceType = EssenceType.Rare; break;
            case ItemRarity.Epic: essenceType = EssenceType.Epic; break;
            case ItemRarity.Legendary: essenceType = EssenceType.Legendary; break;
        }

        if ((Number(character.resources.gold) || 0) < goldCost || (essenceType && (Number(character.resources[essenceType]) || 0) < 1)) {
            return res.status(400).json({ message: 'Not enough resources' });
        }
        
        character.resources.gold = (Number(character.resources.gold) || 0) - goldCost;
        if(essenceType) character.resources[essenceType] = (Number(character.resources[essenceType]) || 0) - 1;

        const successChance = Math.max(10, 100 - (currentLevel * 10));
        let isSuccess = Math.random() * 100 < successChance;

        // Blacksmith Class Bonus (Advantage on roll)
        if (character.characterClass === CharacterClass.Blacksmith && !isSuccess) {
            isSuccess = Math.random() * 100 < successChance;
        }

        if(isSuccess) {
            item.upgradeLevel = nextLevel;
        } else {
             if(isInventory) character.inventory = character.inventory.filter(i => i.uniqueId !== itemId);
             else (character.equipment as any)[itemLocation] = null;
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        
        res.json({ 
            updatedCharacter: character, 
            result: { success: isSuccess, messageKey: isSuccess ? 'blacksmith.upgrade.upgradeSuccess' : 'blacksmith.upgrade.upgradeFailure', level: nextLevel }
        });
        
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
});

export default router;
