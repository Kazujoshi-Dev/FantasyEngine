
import express from 'express';
import { pool } from '../../db.js';
import { PlayerCharacter, Skill, CharacterClass, EssenceType, ItemTemplate } from '../../types.js';
import { calculateDerivedStatsOnServer } from '../../logic/stats.js';

const router = express.Router();

router.post('/learn', async (req: any, res: any) => {
    const { skillId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        const skills: Skill[] = gameDataRes.rows[0]?.data || [];
        const skill = skills.find(s => s.id === skillId);

        if (!skill) throw new Error("Umiejętność nie istnieje.");
        
        if (!character.learnedSkills) character.learnedSkills = [];
        if (character.learnedSkills.includes(skillId)) throw new Error("Ta umiejętność jest już znana.");

        // Multi-Class check for Dual Wield
        if (skillId === 'dual-wield-mastery') {
            const allowed = [CharacterClass.Warrior, CharacterClass.Rogue, CharacterClass.Berserker, CharacterClass.Thief];
            if (!character.characterClass || !allowed.includes(character.characterClass)) {
                throw new Error("Ta umiejętność jest dostępna tylko dla klas: Wojownik, Łotrzyk, Berserker, Złodziej.");
            }
        } else if (skill.requirements.characterClass && character.characterClass !== skill.requirements.characterClass) {
            throw new Error("Nieprawidłowa klasa postaci.");
        }

        if (character.level < (skill.requirements.level || 0)) throw new Error("Zbyt niski poziom.");

        const gDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const gData = gDataRes.rows.reduce((acc: any, r: any) => ({ ...acc, [r.key]: r.data }), {});
        const derived = calculateDerivedStatsOnServer(character, gData.itemTemplates, gData.affixes, 0, 0, skills);
        
        for (const [stat, val] of Object.entries(skill.requirements)) {
            if (['level', 'characterClass', 'race'].includes(stat)) continue;
            if ((derived.stats as any)[stat] < (val as number)) {
                throw new Error(`Niewystarczająca wartość atrybutu: ${stat}`);
            }
        }

        if (skill.cost.gold && character.resources.gold < skill.cost.gold) throw new Error("Brak złota.");
        for (const [resType, amount] of Object.entries(skill.cost)) {
            if (resType === 'gold') continue;
            if ((character.resources as any)[resType] < (amount as number)) throw new Error(`Brak esencji: ${resType}`);
        }

        if (skill.cost.gold) character.resources.gold -= skill.cost.gold;
        for (const [resType, amount] of Object.entries(skill.cost)) {
            if (resType === 'gold') continue;
            (character.resources as any)[resType] -= (amount as number);
        }

        character.learnedSkills.push(skillId);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) { 
        await client.query('ROLLBACK'); 
        res.status(400).json({ message: err.message }); 
    }
    finally { client.release(); }
});

router.post('/toggle', async (req: any, res: any) => {
    const { skillId, isActive } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        
        if (!char.learnedSkills?.includes(skillId)) throw new Error("Nie znasz tej umiejętności.");
        if (!char.activeSkills) char.activeSkills = [];

        // Dual Wield Deactivation Protection
        if (skillId === 'dual-wield-mastery' && !isActive) {
            const offHandItem = char.equipment?.offHand;
            if (offHandItem) {
                const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
                const itemTemplates: ItemTemplate[] = gameDataRes.rows[0]?.data || [];
                const template = itemTemplates.find(t => t.id === offHandItem.templateId);
                
                if (template && template.category === 'Weapon') {
                    throw new Error("Najpierw musisz zdjąć broń z drugiej ręki, aby wyłączyć tę umiejętność.");
                }
            }
        }

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

router.post('/convert-essence', async (req: any, res: any) => {
    const { fromType } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        
        const essenceOrder = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const fromIdx = essenceOrder.indexOf(fromType);
        
        if (fromIdx === -1 || fromIdx === essenceOrder.length - 1) throw new Error("Invalid conversion source.");
        if (!char.learnedSkills?.includes('podstawy-alchemii')) throw new Error("Nie posiadasz wiedzy alchemicznej.");
        
        const targetType = essenceOrder[fromIdx + 1];
        const conversionCosts: Record<string, number> = {
            [EssenceType.Common]: 100,
            [EssenceType.Uncommon]: 250,
            [EssenceType.Rare]: 500,
            [EssenceType.Epic]: 1000
        };

        const goldCost = conversionCosts[fromType];
        if (char.resources.gold < goldCost) throw new Error("Brak złota.");
        if ((char.resources as any)[fromType] < 5) throw new Error("Wymagane 5 esencji.");

        char.resources.gold -= goldCost;
        (char.resources as any)[fromType] -= 5;
        (char.resources as any)[targetType] = ((char.resources as any)[targetType] || 0) + 1;

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
