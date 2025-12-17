
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, EssenceType, CharacterClass, Race } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

// GET / - Pobierz profil zalogowanej postaci
router.get('/', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.json(null);
        }
        res.json(result.rows[0].data);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch character' });
    }
});

// POST / - Stwórz postać
router.post('/', authenticateToken, async (req: any, res: any) => {
    const { name, race, startLocationId } = req.body;
    const userId = req.user.id;

    const initialStats: CharacterStats = {
        strength: 5, agility: 5, accuracy: 5, stamina: 5, intelligence: 5, energy: 5, luck: 5,
        statPoints: 10, currentHealth: 100, maxHealth: 100, currentMana: 50, maxMana: 50,
        currentEnergy: 10, maxEnergy: 10, minDamage: 1, maxDamage: 2, magicDamageMin: 0, magicDamageMax: 0,
        armor: 0, critChance: 5, critDamageModifier: 200, attacksPerRound: 1, dodgeChance: 5, manaRegen: 10,
        armorPenetrationPercent: 0, armorPenetrationFlat: 0, lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0
    };

    const newCharacter: PlayerCharacter = {
        id: userId, user_id: userId, username: '', name, race, level: 1, experience: 0, experienceToNextLevel: 100,
        stats: initialStats, resources: { gold: 100, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
        equipment: { head: null, neck: null, chest: null, hands: null, waist: null, legs: null, feet: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
        inventory: [], currentLocationId: startLocationId, activeTravel: null, activeExpedition: null, isResting: false,
        restStartHealth: 100, lastRestTime: Date.now(), lastEnergyUpdateTime: Date.now(),
        backpack: { level: 1 }, camp: { level: 1 }, treasury: { level: 1, gold: 0 }, acceptedQuests: [], questProgress: [],
        learnedSkills: [], activeSkills: [], pvpWins: 0, pvpLosses: 0, pvpProtectionUntil: 0, ownedRankIds: []
    };

    try {
        await pool.query('INSERT INTO characters (user_id, data) VALUES ($1, $2)', [userId, JSON.stringify(newCharacter)]);
        res.status(201).json(newCharacter);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create character' });
    }
});

// POST /stats - Rozdziel punkty statystyk
router.post('/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        let char = result.rows[0].data;

        let totalCost = 0;
        for (const key in stats) {
            totalCost += stats[key];
            char.stats[key] += stats[key];
        }

        if (char.stats.statPoints < totalCost) throw new Error('Not enough stat points');
        char.stats.statPoints -= totalCost;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /equip - Załóż przedmiot
router.post('/equip', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        let char: PlayerCharacter = charRes.rows[0].data;

        const itemIdx = char.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIdx === -1) throw new Error('Item not found');
        const item = char.inventory[itemIdx];

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates: ItemTemplate[] = gameDataRes.rows[0].data;
        const template = templates.find(t => t.id === item.templateId);
        if (!template) throw new Error('Template not found');

        let slot = template.slot as EquipmentSlot;
        if (template.slot === 'ring') {
            slot = !char.equipment.ring1 ? EquipmentSlot.Ring1 : EquipmentSlot.Ring2;
        }

        const oldItem = char.equipment[slot];
        char.equipment[slot] = item;
        char.inventory.splice(itemIdx, 1);
        if (oldItem) char.inventory.push(oldItem);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /unequip - Zdejmij przedmiot
router.post('/unequip', authenticateToken, async (req: any, res: any) => {
    const { slot } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        let char: PlayerCharacter = charRes.rows[0].data;

        const item = char.equipment[slot as EquipmentSlot];
        if (!item) throw new Error('No item in slot');

        char.equipment[slot as EquipmentSlot] = null;
        char.inventory.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /active-rank - Zmień aktywną rangę
router.post('/active-rank', authenticateToken, async (req: any, res: any) => {
    const { rankId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error('Postać nie znaleziona');
        let character: PlayerCharacter = charRes.rows[0].data;
        
        if (rankId) {
            if (!character.ownedRankIds?.includes(rankId)) throw new Error('Nie posiadasz tej rangi');
            character.activeRankId = rankId;
        } else {
            delete character.activeRankId;
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// GET /names - Lista wszystkich imion postaci (dla sugestii wiadomości)
router.get('/names', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query("SELECT data->>'name' as name FROM characters");
        res.json(result.rows.map(r => r.name));
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

export default router;
