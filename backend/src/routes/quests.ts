
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, Quest, QuestType, EssenceType, ItemInstance, ItemTemplate } from '../types.js';
import { createItemInstance } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

// Helper to ensure quest arrays exist
const ensureQuestArrays = (char: PlayerCharacter) => {
    if (!Array.isArray(char.acceptedQuests)) char.acceptedQuests = [];
    if (!Array.isArray(char.questProgress)) char.questProgress = [];
};

// POST /api/quests/accept
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

        // Fetch quest definition
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'quests'");
        const quests: Quest[] = gameDataRes.rows[0]?.data || [];
        const quest = quests.find(q => q.id === questId);

        if (!quest) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Quest not found' });
        }

        // Check if already accepted
        if (character.acceptedQuests.includes(questId)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Quest already accepted' });
        }

        // Check location requirements (optional, but good for validation)
        if (quest.locationIds && quest.locationIds.length > 0 && !quest.locationIds.includes(character.currentLocationId)) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'You are not in the correct location to accept this quest.' });
        }
        
        // Add to accepted
        character.acceptedQuests.push(questId);
        
        // Initialize progress if not exists
        if (!character.questProgress.some(p => p.questId === questId)) {
            character.questProgress.push({ questId, progress: 0, completions: 0 });
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        
        res.json(character);

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Accept Quest Error:", err);
        res.status(500).json({ message: 'Failed to accept quest: ' + err.message });
    } finally {
        client.release();
    }
});

// POST /api/quests/complete
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
        if (!quest) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Quest data invalid' });
        }

        const progressEntry = character.questProgress.find(p => p.questId === questId);
        if (!progressEntry) {
             // Should theoretically not happen if acceptedQuests check passed, but for safety:
             await client.query('ROLLBACK');
             return res.status(500).json({ message: 'Quest progress missing' });
        }

        // Verify Objective Completion
        const { objective } = quest;
        let isComplete = false;

        if (objective.type === QuestType.Kill) {
             if (progressEntry.progress >= objective.amount) isComplete = true;
        } else if (objective.type === QuestType.Gather) {
             const count = character.inventory.filter(i => i.templateId === objective.targetId).length;
             if (count >= objective.amount) {
                 isComplete = true;
                 // Remove items
                 let removed = 0;
                 character.inventory = character.inventory.filter(i => {
                     if (removed < objective.amount && i.templateId === objective.targetId) {
                         removed++;
                         return false;
                     }
                     return true;
                 });
             }
        } else if (objective.type === QuestType.GatherResource) {
             const currentResource = (character.resources as any)[objective.targetId as string] || 0;
             if (currentResource >= objective.amount) {
                 isComplete = true;
                 // Remove resources (Note: usually 'Gather' implies keeping? Logic varies. Assuming consumption for quests)
                 // Actually, "Gather Resource" quests usually imply *having* or *collecting*. 
                 // If it's a delivery quest, we consume. Let's assume consumption for consistency with Gather Item.
                 (character.resources as any)[objective.targetId as string] -= objective.amount;
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

        // Apply Rewards
        if (quest.rewards) {
             character.resources.gold += (quest.rewards.gold || 0);
             character.experience += (quest.rewards.experience || 0);
             
             // Level up check
             while (character.experience >= character.experienceToNextLevel) {
                character.experience -= character.experienceToNextLevel;
                character.level += 1;
                character.stats.statPoints += 1;
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
                 
                 // Fixed rewards
                 if (quest.rewards.itemRewards) {
                     for(const reward of quest.rewards.itemRewards) {
                         for(let i=0; i<reward.quantity; i++) {
                             itemsToAdd.push(createItemInstance(reward.templateId, itemTemplates, affixes));
                         }
                     }
                 }
                 
                 // Random loot
                 if (quest.rewards.lootTable) {
                     for(const loot of quest.rewards.lootTable) {
                         if(Math.random() * 100 < loot.chance) {
                              itemsToAdd.push(createItemInstance(loot.templateId, itemTemplates, affixes));
                         }
                     }
                 }

                 if (character.inventory.length + itemsToAdd.length <= backpackCap) {
                     character.inventory.push(...itemsToAdd);
                 } else {
                     // Handle overflow (mail? or just fail? For simplicity, adding gold compensation or just warn)
                     // Here we just warn in logs, or could reject.
                     // Let's add gold compensation for lost items to be nice.
                     character.resources.gold += itemsToAdd.length * 50; 
                 }
             }
        }

        // Update Status
        character.acceptedQuests = character.acceptedQuests.filter(id => id !== questId);
        progressEntry.progress = 0; // Reset progress for repeatable
        progressEntry.completions += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        
        res.json(character);

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Complete Quest Error:", err);
        res.status(500).json({ message: 'Failed to complete quest' });
    } finally {
        client.release();
    }
});

export default router;
