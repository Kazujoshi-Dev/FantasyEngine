
import express from 'express';
import { pool } from '../../db.js';
import { hashPassword } from '../../logic/helpers.js';
import { PlayerCharacter, Race, CharacterClass } from '../../types.js';
import { calculateDerivedStatsOnServer } from '../../logic/stats.js';

const router = express.Router();

// GET /api/admin/characters/all - Lista podstawowa
router.get('/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.user_id, u.username, c.data->>'name' as name, (c.data->>'level')::int as level, (c.data->'resources'->>'gold')::bigint as gold
            FROM characters c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.user_id ASC
        `);
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch characters' }); 
    }
});

// GET /api/admin/characters/:id/inspect - Pełne dane postaci
router.get('/:id/inspect', async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Character not found' });
        res.json(result.rows[0].data);
    } catch (err) {
        res.status(500).json({ message: 'Error inspecting character' });
    }
});

// POST /api/admin/characters/:id/heal - Pełne leczenie
router.post('/:id/heal', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const char = charRes.rows[0].data as PlayerCharacter;
        // Pobieramy dane gry do przeliczenia max stats
        const gDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const gData = gDataRes.rows.reduce((acc: any, r: any) => ({ ...acc, [r.key]: r.data }), {});
        
        const derived = calculateDerivedStatsOnServer(char, gData.itemTemplates, gData.affixes, 0, 0, gData.skills);
        
        char.stats.currentHealth = derived.stats.maxHealth;
        char.stats.currentMana = derived.stats.maxMana;
        char.isResting = false;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Character healed' });
    } catch (err: any) { 
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message }); 
    } finally { client.release(); }
});

// POST /api/admin/characters/:id/regenerate-energy - Przywrócenie energii
router.post('/:id/regenerate-energy', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const char = charRes.rows[0].data as PlayerCharacter;
        
        char.stats.currentEnergy = char.stats.maxEnergy || 10;
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Energy regenerated' });
    } catch (err: any) { 
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message }); 
    } finally { client.release(); }
});

// POST /api/admin/characters/:id/reset-stats - Darmowy reset statystyk
router.post('/:id/reset-stats', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const char = charRes.rows[0].data as PlayerCharacter;

        const totalPoints = 20 + (char.level - 1) * 1;
        char.stats.strength = 1;
        char.stats.agility = 1;
        char.stats.accuracy = 1;
        char.stats.stamina = 1;
        char.stats.intelligence = 1;
        char.stats.energy = 1;
        char.stats.luck = 1;
        char.stats.statPoints = totalPoints;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Stats reset' });
    } catch (err: any) { 
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message }); 
    } finally { client.release(); }
});

// POST /api/admin/characters/:id/update-details - Zmiana lvl/rasy/klasy
router.post('/:id/update-details', async (req, res) => {
    const { name, race, characterClass, level } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const char = charRes.rows[0].data as PlayerCharacter;

        if (name) char.name = name;
        if (race) char.race = race as Race;
        if (characterClass !== undefined) char.characterClass = characterClass as CharacterClass;
        if (level) {
            char.level = parseInt(level);
            char.experience = 0;
            char.experienceToNextLevel = Math.floor(100 * Math.pow(char.level, 1.3));
            // Resetuj punkty przy zmianie lvl by uniknąć exploitów/błędów
            char.stats.statPoints = 20 + (char.level - 1) * 1;
            char.stats.strength = 1; char.stats.agility = 1; char.stats.accuracy = 1;
            char.stats.stamina = 1; char.stats.intelligence = 1; char.stats.energy = 1; char.stats.luck = 1;
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Details updated' });
    } catch (err: any) { 
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message }); 
    } finally { client.release(); }
});

// POST /api/admin/characters/:id/update-gold - Zmiana złota
router.post('/:id/update-gold', async (req, res) => {
    const { gold } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const char = charRes.rows[0].data as PlayerCharacter;

        char.resources.gold = parseInt(gold);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Gold updated' });
    } catch (err: any) { 
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message }); 
    } finally { client.release(); }
});

router.post('/:id/password', async (req, res) => {
    const { newPassword } = req.body;
    try {
        const { salt, hash } = hashPassword(newPassword);
        await pool.query('UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3', [hash, salt, req.params.id]);
        res.json({ message: 'Password updated' });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM characters WHERE user_id = $1', [req.params.id]);
        res.json({ message: 'Character deleted successfully' });
    } catch (err) { res.status(500).json({ message: 'Delete failed' }); }
});

router.post('/:id/soft-reset', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const resChar = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.id]);
        if (resChar.rows.length === 0) return res.status(404).json({ message: 'Not found' });

        const char = resChar.rows[0].data as PlayerCharacter;
        char.level = 1;
        char.experience = 0;
        char.experienceToNextLevel = 100;
        char.stats.strength = 1;
        char.stats.agility = 1;
        char.stats.accuracy = 1;
        char.stats.stamina = 1;
        char.stats.intelligence = 1;
        char.stats.energy = 1;
        char.stats.luck = 1;
        char.stats.statPoints = 20;
        char.stats.currentHealth = char.stats.maxHealth || 60;
        char.stats.currentMana = char.stats.maxMana || 30;
        char.activeExpedition = null;
        char.isResting = false;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Soft reset complete', data: char });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally { client.release(); }
});

router.post('/:id/reset-progress', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const resChar = await client.query("SELECT data->>'name' as name, data->>'race' as race, data->>'gender' as gender FROM characters WHERE user_id = $1", [req.params.id]);
        if (resChar.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        
        const { name, race, gender } = resChar.rows[0];

        const initialData = {
            name: name,
            race: race as Race,
            gender: gender || 'Male',
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: {
                strength: 1, agility: 1, accuracy: 1, stamina: 1, intelligence: 1, energy: 1, luck: 1,
                statPoints: 20,
                currentHealth: 60, maxHealth: 60, currentMana: 30, maxMana: 30,
                currentEnergy: 10, maxEnergy: 10, minDamage: 1, maxDamage: 2,
                magicDamageMin: 0, magicDamageMax: 0, armor: 0, critChance: 0, 
                critDamageModifier: 200, attacksPerRound: 1, dodgeChance: 0, manaRegen: 2,
                armorPenetrationPercent: 0, armorPenetrationFlat: 0,
                lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0
            },
            resources: { gold: 100, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            equipment: { head: null, neck: null, chest: null, hands: null, waist: null, legs: null, feet: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            inventory: [],
            currentLocationId: 'start',
            activeTravel: null,
            activeExpedition: null,
            isResting: false,
            backpack: { level: 1 },
            camp: { level: 1 },
            treasury: { level: 1, gold: 0 },
            warehouse: { level: 1, items: [] },
            workshop: { level: 1 },
            learnedSkills: [],
            activeSkills: [],
            acceptedQuests: [],
            questProgress: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0
        };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(initialData), req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'Hard reset complete' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally { client.release(); }
});

export default router;
