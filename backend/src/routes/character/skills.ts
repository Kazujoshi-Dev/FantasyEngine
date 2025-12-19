
import express from 'express';
import { pool } from '../../db.js';
import { PlayerCharacter } from '../../types.js';

const router = express.Router();

router.post('/learn', async (req: any, res: any) => {
    const { skillId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        if (!character.learnedSkills) character.learnedSkills = [];
        if (character.learnedSkills.includes(skillId)) throw new Error("Skill już znany.");
        character.learnedSkills.push(skillId);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); }
    finally { client.release(); }
});

router.post('/toggle', async (req: any, res: any) => {
    const { skillId, isActive } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        if (!char.activeSkills) char.activeSkills = [];
        if (isActive) {
            if (!char.activeSkills.includes(skillId)) char.activeSkills.push(skillId);
        } else {
            char.activeSkills = char.activeSkills.filter(id => id !== skillId);
        }
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Błąd przełączania' }); }
    finally { client.release(); }
});

router.post('/convert-essence', async (req: any, res: any) => {
    const { fromType } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        // Logika konwersji (uproszczona dla architektury)
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Błąd konwersji' }); }
    finally { client.release(); }
});

export default router;
