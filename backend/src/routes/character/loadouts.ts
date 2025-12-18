
import express from 'express';
import { pool } from '../../db.js';
import { PlayerCharacter, EquipmentLoadout } from '../../types.js';
import { getBackpackCapacity } from '../../logic/helpers.js';

const router = express.Router();

router.post('/save', async (req: any, res: any) => {
    const { loadoutId, name } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        if (!char.loadouts) char.loadouts = [];
        const equipmentMap: any = {};
        Object.keys(char.equipment).forEach(slot => {
            const item = (char.equipment as any)[slot];
            equipmentMap[slot] = item ? item.uniqueId : null;
        });
        const existingIdx = char.loadouts.findIndex(l => l.id === loadoutId);
        const newLoadout: EquipmentLoadout = { id: loadoutId, name: name || `Zestaw ${loadoutId + 1}`, equipment: equipmentMap };
        if (existingIdx > -1) char.loadouts[existingIdx] = newLoadout;
        else char.loadouts.push(newLoadout);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/load', async (req: any, res: any) => {
    const { loadoutId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        const loadout = char.loadouts?.find(l => l.id === loadoutId);
        if (!loadout) throw new Error("Zestaw nie istnieje.");
        const allItems = [...char.inventory, ...Object.values(char.equipment).filter(i => i !== null)];
        const newEquipment: any = {};
        const usedUniqueIds = new Set<string>();
        for (const [slot, targetUniqueId] of Object.entries(loadout.equipment)) {
            if (!targetUniqueId) { newEquipment[slot] = null; continue; }
            const item = allItems.find(i => i.uniqueId === targetUniqueId);
            if (item && !usedUniqueIds.has(item.uniqueId)) { newEquipment[slot] = item; usedUniqueIds.add(item.uniqueId); }
            else newEquipment[slot] = null;
        }
        const newInventory = allItems.filter(i => !usedUniqueIds.has(i.uniqueId));
        if (newInventory.length > getBackpackCapacity(char)) throw new Error("Przepełniony plecak.");
        char.equipment = newEquipment;
        char.inventory = newInventory;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.put('/rename', async (req: any, res: any) => {
    const { loadoutId, name } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        const loadout = char.loadouts?.find(l => l.id === loadoutId);
        if (loadout) loadout.name = name;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

export default router;
