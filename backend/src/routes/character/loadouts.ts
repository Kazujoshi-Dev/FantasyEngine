
import express from 'express';
import { pool } from '../../db.js';
import { PlayerCharacter, EquipmentLoadout, ItemInstance } from '../../types.js';
import { getBackpackCapacity, getWarehouseCapacity } from '../../logic/stats.js';
import { fetchFullCharacter } from '../../logic/helpers.js';

const router = express.Router();

router.post('/save', async (req: any, res: any) => {
    const { loadoutId, name } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const char: PlayerCharacter = charRes.rows[0].data;
        if (!char.loadouts) char.loadouts = [];
        
        const equipmentMap: any = {};
        Object.keys(char.equipment).forEach(slot => {
            const item = (char.equipment as any)[slot];
            equipmentMap[slot] = item ? item.uniqueId : null;
        });

        const existingIdx = char.loadouts.findIndex(l => l.id === loadoutId);
        const newLoadout: EquipmentLoadout = { 
            id: loadoutId, 
            name: name || `Zestaw ${loadoutId + 1}`, 
            equipment: equipmentMap 
        };

        if (existingIdx > -1) char.loadouts[existingIdx] = newLoadout;
        else char.loadouts.push(newLoadout);

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

router.post('/load', async (req: any, res: any) => {
    const { loadoutId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const char: PlayerCharacter = charRes.rows[0].data;
        const loadout = char.loadouts?.find(l => l.id === loadoutId);
        if (!loadout) throw new Error("Zestaw nie istnieje.");

        const allItems = [
            ...char.inventory, 
            ...Object.values(char.equipment).filter((i): i is ItemInstance => i !== null)
        ];

        const newEquipment: any = {
            head: null, neck: null, chest: null, hands: null, waist: null, 
            legs: null, feet: null, ring1: null, ring2: null, 
            mainHand: null, offHand: null, twoHand: null 
        };
        const usedUniqueIds = new Set<string>();

        for (const [slot, targetUniqueId] of Object.entries(loadout.equipment)) {
            if (!targetUniqueId) continue;
            const item = allItems.find(i => i.uniqueId === targetUniqueId);
            if (item && !usedUniqueIds.has(item.uniqueId)) {
                newEquipment[slot] = item;
                usedUniqueIds.add(item.uniqueId);
            }
        }

        let leftoverItems = allItems.filter(i => !usedUniqueIds.has(i.uniqueId));
        const backpackCap = getBackpackCapacity(char);
        const warehouseCap = getWarehouseCapacity(char.warehouse?.level || 1);
        
        if (!char.warehouse) char.warehouse = { level: 1, items: [] };
        if (!char.warehouse.items) char.warehouse.items = [];

        let finalInventory: ItemInstance[] = [];
        let itemsToWarehouse: ItemInstance[] = [];

        for (const item of leftoverItems) {
            if (finalInventory.length < backpackCap) {
                finalInventory.push(item);
            } else if (!item.isBorrowed && char.warehouse.items.length + itemsToWarehouse.length < warehouseCap) {
                itemsToWarehouse.push(item);
            } else {
                throw new Error("Brak miejsca w plecaku i magazynie na pozostałe przedmioty.");
            }
        }

        char.equipment = newEquipment;
        char.inventory = finalInventory;
        char.warehouse.items.push(...itemsToWarehouse);

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

router.put('/rename', async (req: any, res: any) => {
    const { loadoutId, name } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const char: PlayerCharacter = charRes.rows[0].data;
        const loadout = char.loadouts?.find(l => l.id === loadoutId);
        if (loadout) loadout.name = name;

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
