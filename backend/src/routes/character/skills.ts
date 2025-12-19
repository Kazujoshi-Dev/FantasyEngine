
import express from 'express';
import { pool } from '../../db.js';
import { PlayerCharacter, CharacterClass } from '../../types.js';

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

        // --- Class Restriction Check for Dual Wield ---
        if (skillId === 'dual-wield-mastery') {
            const allowed = [CharacterClass.Warrior, CharacterClass.Rogue, CharacterClass.Berserker, CharacterClass.Thief];
            if (!character.characterClass || !allowed.includes(character.characterClass)) {
                throw new Error("Ta umiejętność jest dostępna tylko dla klas: Wojownik, Łotrzyk, Berserker, Złodziej.");
            }
        }
        // ----------------------------------------------

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

        // --- Dual Wield Toggle Protection ---
        if (skillId === 'dual-wield-mastery' && !isActive) {
            // Próba dezaktywacji - sprawdź czy gracz ma broń w offhand
            const offHand = char.equipment?.offHand;
            if (offHand) {
                // Pobierz dane gry aby sprawdzić czy to broń
                const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
                const templates = gameDataRes.rows[0]?.data || [];
                const template = templates.find((t: any) => t.id === offHand.templateId);
                
                if (template && template.category === 'Weapon') {
                    throw new Error("Nie możesz wyłączyć tej umiejętności, gdy używasz dwóch broni. Najpierw zdejmij broń z drugiej ręki.");
                }
            }
        }
        // ------------------------------------

        if (isActive) {
            if (!char.activeSkills.includes(skillId)) char.activeSkills.push(skillId);
        } else {
            char.activeSkills = char.activeSkills.filter(id => id !== skillId);
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) { 
        await client.query('ROLLBACK'); 
        res.status(400).json({ message: err.message }); 
    }
    finally { client.release(); }
});

export default router;
