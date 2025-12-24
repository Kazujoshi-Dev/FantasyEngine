
import express from 'express';
import { pool } from '../../db.js';
// Fix: Import getBackpackCapacity from stats.js
import { getTreasuryCapacity, getWarehouseCapacity, getTreasuryUpgradeCost, getWarehouseUpgradeCost, getBackpackCapacity } from '../../logic/stats.js';

const router = express.Router();

// --- TREASURY (GOLD) ---
router.post('/treasury/deposit', async (req: any, res: any) => {
    const { amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (!char.treasury) char.treasury = { level: 1, gold: 0 };
        const cap = getTreasuryCapacity(char.treasury.level);
        const canFit = cap - char.treasury.gold;
        const toDeposit = Math.min(amount, char.resources.gold, canFit);
        if (toDeposit <= 0) throw new Error("Skarbiec jest pełny lub nie masz złota.");
        char.resources.gold -= toDeposit;
        char.treasury.gold += toDeposit;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/treasury/withdraw', async (req: any, res: any) => {
    const { amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (!char.treasury || char.treasury.gold < amount) throw new Error("Brak środków w skarbcu.");
        char.resources.gold += amount;
        char.treasury.gold -= amount;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/treasury/upgrade', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (!char.treasury) char.treasury = { level: 1, gold: 0 };
        const cost = getTreasuryUpgradeCost(char.treasury.level);
        if (char.resources.gold < cost.gold) throw new Error("Za mało złota.");
        for (const e of cost.essences) if (char.resources[e.type] < e.amount) throw new Error(`Brak esencji: ${e.type}`);
        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        char.treasury.level += 1;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

// --- WAREHOUSE (ITEMS) ---
router.post('/warehouse/deposit', async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (!char.warehouse) char.warehouse = { level: 1, items: [] };
        const cap = getWarehouseCapacity(char.warehouse.level);
        if (char.warehouse.items.length >= cap) throw new Error("Magazyn jest pełny.");
        const idx = char.inventory.findIndex((i: any) => i.uniqueId === itemId);
        if (idx === -1) throw new Error("Przedmiot nie znaleziony.");
        const [item] = char.inventory.splice(idx, 1);
        char.warehouse.items.push(item);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/warehouse/withdraw', async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.inventory.length >= getBackpackCapacity(char)) throw new Error("Plecak jest pełny.");
        const idx = char.warehouse.items.findIndex((i: any) => i.uniqueId === itemId);
        if (idx === -1) throw new Error("Przedmiot nie znaleziony w magazynie.");
        const [item] = char.warehouse.items.splice(idx, 1);
        char.inventory.push(item);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/warehouse/upgrade', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (!char.warehouse) char.warehouse = { level: 1, items: [] };
        const cost = getWarehouseUpgradeCost(char.warehouse.level);
        if (char.resources.gold < cost.gold) throw new Error("Za mało złota.");
        for (const e of cost.essences) if (char.resources[e.type] < e.amount) throw new Error(`Brak esencji: ${e.type}`);
        char.resources.gold -= cost.gold;
        for (const e of cost.essences) char.resources[e.type] -= e.amount;
        char.warehouse.level += 1;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

export default router;
