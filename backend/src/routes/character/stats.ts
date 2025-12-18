
import express from 'express';
import { pool } from '../../db.js';
import { CharacterStats, PlayerCharacter } from '../../types.js';

const router = express.Router();

// POST /api/character/stats - Rozdawanie punktów
router.post('/', async (req: any, res: any) => {
    const { stats } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        let spent = 0;
        for (const [k, v] of Object.entries(stats)) {
            const p = parseInt(v as string);
            if (p > 0) { (character.stats as any)[k] += p; spent += p; }
        }
        if (character.stats.statPoints < spent) throw new Error("Brak punktów.");
        character.stats.statPoints -= spent;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

// POST /api/character/stats/reset - Reset atrybutów
router.post('/reset', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        const keys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
        let returned = 0;
        keys.forEach(k => { if (character.stats[k] > 1) { returned += (character.stats[k] - 1); character.stats[k] = 1; } });
        const resets = character.resetsUsed || 0;
        const cost = resets > 0 ? returned * 1000 : 0;
        if (character.resources.gold < cost) throw new Error("Brak złota.");
        character.resources.gold -= cost;
        character.stats.statPoints += returned;
        character.resetsUsed = resets + 1;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

// POST /api/character/stats/class - Wybór klasy
router.post('/class', async (req: any, res: any) => {
    const { characterClass } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        if (character.level < 10) throw new Error("Wymagany 10 poziom.");
        if (character.characterClass) throw new Error("Klasa została już wybrana.");
        character.characterClass = characterClass;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

export default router;
