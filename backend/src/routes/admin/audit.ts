
import express from 'express';
import { pool } from '../../db.js';
import { PlayerCharacter, ItemTemplate, Affix } from '../../types.js';

const router = express.Router();

// POST /api/admin/audit/fix-characters - Naprawa struktur JSON
router.post('/fix-characters', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const chars = await client.query('SELECT user_id, data FROM characters FOR UPDATE');
        let fixedCount = 0;

        for (const row of chars.rows) {
            let char = row.data as PlayerCharacter;
            let modified = false;

            if (!char.resources) { char.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 }; modified = true; }
            if (!char.stats) { modified = true; /* reset stats logic would go here if missing */ }
            if (!char.inventory) { char.inventory = []; modified = true; }
            if (!char.equipment) { char.equipment = { head: null, neck: null, chest: null, hands: null, waist: null, legs: null, feet: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null }; modified = true; }
            if (!char.camp) { char.camp = { level: 1 }; modified = true; }
            if (!char.backpack) { char.backpack = { level: 1 }; modified = true; }
            if (char.isResting === undefined) { char.isResting = false; modified = true; }

            if (modified) {
                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                fixedCount++;
            }
        }

        await client.query('COMMIT');
        res.json({ checked: chars.rows.length, fixed: fixedCount });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/admin/audit/fix-gold - Naprawa nieprawidłowych wartości złota
router.post('/fix-gold', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`
            UPDATE characters 
            SET data = jsonb_set(data, '{resources,gold}', COALESCE((data->'resources'->>'gold')::numeric, 0)::text::jsonb)
            WHERE data->'resources'->'gold' IS NULL OR jsonb_typeof(data->'resources'->'gold') != 'number'
        `);
        await client.query('COMMIT');
        const count = await client.query('SELECT count(*) FROM characters');
        res.json({ checked: parseInt(count.rows[0].count), fixed: result.rowCount });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/admin/audit/fix-values - Konwersja pola "value" na Number w game_data
router.post('/fix-values', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Fix Templates
        const templatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        let templates: ItemTemplate[] = templatesRes.rows[0]?.data || [];
        let itemsFixed = 0;
        templates = templates.map(t => {
            if (typeof t.value === 'string') { t.value = parseInt(t.value, 10) || 0; itemsFixed++; }
            return t;
        });
        await client.query("UPDATE game_data SET data = $1 WHERE key = 'itemTemplates'", [JSON.stringify(templates)]);

        // Fix Affixes
        const affixesRes = await client.query("SELECT data FROM game_data WHERE key = 'affixes'");
        let affixes: Affix[] = affixesRes.rows[0]?.data || [];
        let affixesFixed = 0;
        affixes = affixes.map(a => {
            if (typeof a.value === 'string') { a.value = parseInt(a.value, 10) || 0; affixesFixed++; }
            return a;
        });
        await client.query("UPDATE game_data SET data = $1 WHERE key = 'affixes'", [JSON.stringify(affixes)]);

        await client.query('COMMIT');
        res.json({ itemsChecked: templates.length, itemsFixed, affixesChecked: affixes.length, affixesFixed });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/admin/audit/fix-attributes - Walidacja sumy punktów statystyk
router.post('/fix-attributes', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const chars = await client.query('SELECT user_id, data FROM characters FOR UPDATE');
        let fixedCount = 0;

        for (const row of chars.rows) {
            const char = row.data as PlayerCharacter;
            const stats = char.stats;
            
            // Limit = (Level-1)*2 + 20 startowych
            const maxAllowed = ((char.level - 1) * 2) + 20;
            const currentTotal = 
                (stats.strength - 1) + (stats.agility - 1) + (stats.accuracy - 1) + 
                (stats.stamina - 1) + (stats.intelligence - 1) + (stats.energy - 1) + 
                (stats.luck - 1) + (stats.statPoints || 0);

            if (currentTotal > maxAllowed) {
                // Reset do 1 i przyznanie punktów
                char.stats.strength = 1; char.stats.agility = 1; char.stats.accuracy = 1;
                char.stats.stamina = 1; char.stats.intelligence = 1; char.stats.energy = 1;
                char.stats.luck = 1;
                char.stats.statPoints = maxAllowed;
                
                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                fixedCount++;
            }
        }

        await client.query('COMMIT');
        res.json({ checked: chars.rows.length, fixed: fixedCount });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;
