
import express from 'express';
import { pool } from '../../db.js';
import { CharacterStats, PlayerCharacter } from '../../types.js';
import { fetchFullCharacter } from '../../logic/helpers.js';

const router = express.Router();

router.post('/', async (req: any, res: any) => {
    const { stats } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;
        let spent = 0;
        for (const [k, v] of Object.entries(stats)) {
            const p = parseInt(v as string);
            if (p > 0) { (character.stats as any)[k] += p; spent += p; }
        }
        if (character.stats.statPoints < spent) throw new Error("Brak punktów.");
        character.stats.statPoints -= spent;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        const fullChar = await fetchFullCharacter(client, req.user.id);
        await client.query('COMMIT');
        res.json(fullChar);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/reset', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Postać nie znaleziona.");
        
        const character: PlayerCharacter = charRes.rows[0].data;
        const keys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
        
        let spentPoints = 0;
        keys.forEach(k => { 
            const currentVal = (character.stats as any)[k] || 0;
            if (currentVal > 1) { 
                spentPoints += (currentVal - 1); 
                (character.stats as any)[k] = 1; 
            } 
        });

        const resets = character.resetsUsed || 0;
        const cost = resets > 0 ? spentPoints * 1000 : 0;
        
        if (character.resources.gold < cost) throw new Error("Brak złota na reset atrybutów.");
        
        const totalPointsForLevel = 20 + (Math.max(1, character.level) - 1) * 2;
        character.resources.gold -= cost;
        character.stats.statPoints = totalPointsForLevel;
        character.resetsUsed = resets + 1;
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
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

router.post('/class', async (req: any, res: any) => {
    const { characterClass } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;
        if (character.level < 10) throw new Error("Wymagany 10 poziom.");
        if (character.characterClass) throw new Error("Klasa została już wybrana.");
        character.characterClass = characterClass;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        const fullChar = await fetchFullCharacter(client, req.user.id);
        await client.query('COMMIT');
        res.json(fullChar);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

export default router;
