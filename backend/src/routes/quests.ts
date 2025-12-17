
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, Quest, QuestType, EssenceType, ItemInstance, ItemTemplate } from '../types.js';
import { createItemInstance } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

const ensureQuestArrays = (char: PlayerCharacter) => {
    if (!Array.isArray(char.acceptedQuests)) char.acceptedQuests = [];
    if (!Array.isArray(char.questProgress)) char.questProgress = [];
};

router.post('/accept', authenticateToken, async (req: any, res: any) => {
    const { questId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        ensureQuestArrays(character);

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'quests'");
        const quests: Quest[] = gameDataRes.rows[0]?.data || [];
        const quest = quests.find(q => q.id === questId);

        if (!quest) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Quest not found' });
        }

        if (character.acceptedQuests.includes(questId)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Quest already accepted' });
        }
        
        character.acceptedQuests.push(questId);
        
        if (!character.questProgress.some(p => p.questId === questId)) {
            character.questProgress.push({ questId, progress: 0, completions: 0 });
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to accept quest' });
    } finally {
        client.release();
    }
});

router.post('/complete', authenticateToken, async (req: any, res: any) => {
    const { questId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const character: PlayerCharacter = charRes.rows[0].data;
        ensureQuestArrays(character);

        if (!character.acceptedQuests.includes(questId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Quest not active' });
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('quests', 'itemTemplates', 'affixes')");
        const quests: Quest[] = gameDataRes.rows.find(r => r.key === 'quests')?.data || [];
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: any[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const quest = quests.find(q => q.id === questId);
        if (!quest) throw new Error('Quest data invalid');

        const progressEntry = character.questProgress.find(p => p.questId === questId);
        if (!progressEntry) throw new Error('Quest progress missing');

        const { objective } = quest;
        let isComplete = false;

        if (objective.type === QuestType.Kill) {
             if (progressEntry.progress >= objective.amount) isComplete = true;
        } else if (objective.type === QuestType.Gather) {
             // CRITICAL: Exclusion of borrowed items
             const count = character.inventory.filter(i => i.templateId === objective.targetId && !i.isBorrowed).length;
             if (count >= objective.amount) {
                 isComplete = true;
                 let removed = 0;
                 character.inventory = character.inventory.filter(i => {
                     if (removed < objective.amount && i.templateId === objective.targetId && !i.isBorrowed) {
                         removed++;
                         return false;
                     }
                     return true;
                 });
             }
        } else if (objective.type === QuestType.GatherResource) {
             const resKey = objective.targetId as string;
             const currentResource = (character.resources as any)[resKey] || 0;
             if (currentResource >= objective.amount) {
                 isComplete = true;
                 (character.resources as any)[resKey] -= objective.amount;
             }
        } else if (objective.type === QuestType.PayGold) {
             if (character.resources.gold >= objective.amount) {
                 isComplete = true;
                 character.resources.gold -= objective.amount;
             }
        }

        if (!isComplete) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Quest objectives not met.' });
        }

        if (quest.rewards) {
             character.resources.gold += (quest.rewards.gold || 0);
             character.experience += (quest.rewards.experience || 0);
             
             while (character.experience >= character.experienceToNextLevel) {
                character.experience -= character.experienceToNextLevel;
                character.level += 1;
                character.stats.statPoints += 2;
                character.experienceToNextLevel = Math.floor(100 * Math.pow(character.level, 1.3));
            }

             if (quest.rewards.resourceRewards) {
                 quest.rewards.resourceRewards.forEach(r => {
                     (character.resources as any)[r.resource] = ((character.resources as any)[r.resource] || 0) + r.quantity;
                 });
             }

             if (quest.rewards.itemRewards || quest.rewards.lootTable) {
                 const backpackCap = getBackpackCapacity(character);
                 const itemsToAdd: ItemInstance[] = [];
                 if (quest.rewards.itemRewards) {
                     for(const reward of quest.rewards.itemRewards) {
                         for(let i=0; i<reward.quantity; i++) itemsToAdd.push(createItemInstance(reward.templateId, itemTemplates, affixes, character));
                     }
                 }
                 if (quest.rewards.lootTable) {
                     for(const loot of quest.rewards.lootTable) if(Math.random() * 100 < loot.weight) itemsToAdd.push(createItemInstance(loot.templateId, itemTemplates, affixes, character));
                 }
                 for(const item of itemsToAdd) if (character.inventory.length < backpackCap) character.inventory.push(item);
             }
        }

        character.acceptedQuests = character.acceptedQuests.filter(id => id !== questId);
        progressEntry.progress = 0; 
        progressEntry.completions += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to complete quest' });
    } finally {
        client.release();
    }
});

export default router;
