
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, EssenceType, CharacterClass, Race } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

router.get('/', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.json(null);
        res.json(result.rows[0].data);
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

router.post('/', authenticateToken, async (req: any, res: any) => {
    const { name, race, startLocationId } = req.body;
    const initialStats: CharacterStats = {
        strength: 5, agility: 5, accuracy: 5, stamina: 5, intelligence: 5, energy: 5, luck: 5,
        statPoints: 10, currentHealth: 100, maxHealth: 100, currentMana: 50, maxMana: 50,
        currentEnergy: 10, maxEnergy: 10, minDamage: 1, maxDamage: 2, magicDamageMin: 0, magicDamageMax: 0,
        armor: 0, critChance: 5, critDamageModifier: 200, attacksPerRound: 1, dodgeChance: 5, manaRegen: 10,
        armorPenetrationPercent: 0, armorPenetrationFlat: 0, lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0
    };
    const char: PlayerCharacter = {
        id: req.user.id, user_id: req.user.id, username: '', name, race, level: 1, experience: 0, experienceToNextLevel: 100,
        stats: initialStats, resources: { gold: 100, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
        equipment: { head: null, neck: null, chest: null, hands: null, waist: null, legs: null, feet: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
        inventory: [], currentLocationId: startLocationId, activeTravel: null, activeExpedition: null, isResting: false,
        restStartHealth: 100, lastRestTime: Date.now(), lastEnergyUpdateTime: Date.now(),
        backpack: { level: 1 }, camp: { level: 1 }, treasury: { level: 1, gold: 0 }, acceptedQuests: [], questProgress: [],
        learnedSkills: [], activeSkills: [], pvpWins: 0, pvpLosses: 0, pvpProtectionUntil: 0, ownedRankIds: []
    };
    try {
        await pool.query('INSERT INTO characters (user_id, data) VALUES ($1, $2)', [req.user.id, JSON.stringify(char)]);
        res.status(201).json(char);
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

router.post('/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        let char = charRes.rows[0].data;
        let cost = 0;
        for (const k in stats) { cost += stats[k]; char.stats[k] += stats[k]; }
        if (char.stats.statPoints < cost) throw new Error('Not enough points');
        char.stats.statPoints -= cost;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/equip', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        let char = charRes.rows[0].data;
        const itemIdx = char.inventory.findIndex((i: any) => i.uniqueId === itemId);
        if (itemIdx === -1) throw new Error('Item not found');
        const item = char.inventory[itemIdx];
        const gRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const tmpl = gRes.rows[0].data.find((t: any) => t.id === item.templateId);
        let slot = tmpl.slot;
        if (slot === 'ring') slot = !char.equipment.ring1 ? 'ring1' : 'ring2';
        const old = char.equipment[slot];
        char.equipment[slot] = item;
        char.inventory.splice(itemIdx, 1);
        if (old) char.inventory.push(old);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/active-rank', authenticateToken, async (req: any, res: any) => {
    const { rankId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        let char = charRes.rows[0].data;
        if (rankId && !char.ownedRankIds?.includes(rankId)) throw new Error('Nie posiadasz tej rangi');
        if (rankId) char.activeRankId = rankId; else delete char.activeRankId;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.get('/names', authenticateToken, async (req: any, res: any) => {
    const r = await pool.query("SELECT data->>'name' as name FROM characters");
    res.json(r.rows.map(row => row.name));
});

export default router;
