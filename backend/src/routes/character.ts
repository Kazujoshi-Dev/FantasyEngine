
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter, CharacterClass, GameData, ItemReward, ResourceReward, QuestType, CharacterResources, ItemInstance, PlayerQuestProgress, LootDrop, Skill, SkillRequirements, SkillCost } from '../types.js';
import { processCompletedExpedition } from '../logic/expeditions.js';
import { createItemInstance } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';

const router = express.Router();

// GET /api/character - Get the current user's character data
router.get('/character', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user!.id]);
        
        if (result.rows.length === 0) {
            return res.status(200).json(null);
        }
        
        const character: PlayerCharacter = result.rows[0].data;
        const now = Date.now();
        let needsDbUpdate = false;

        // --- Energy regeneration logic ---
        const lastUpdate = character.lastEnergyUpdateTime || now;
        const hoursPassed = Math.floor((now - lastUpdate) / (1000 * 60 * 60));

        if (hoursPassed > 0 && character.stats.currentEnergy < character.stats.maxEnergy) {
            const energyToRegen = Math.min(
                hoursPassed,
                character.stats.maxEnergy - character.stats.currentEnergy
            );

            if (energyToRegen > 0) {
                character.stats.currentEnergy += energyToRegen;
                // Correctly set the last update time to the beginning of the current hour.
                const lastFullHourTimestamp = Math.floor(now / (1000 * 60 * 60)) * (1000 * 60 * 60);
                character.lastEnergyUpdateTime = lastFullHourTimestamp;
                needsDbUpdate = true;
            }
        }

        // --- Health Regeneration Logic (Resting) ---
        if (character.isResting) {
            // Fallback to 'now' if lastRestTime is missing/invalid to prevent NaN math
            const lastRestTime = Number(character.lastRestTime) || now;
            const msPassed = now - lastRestTime;
            
            // Update if at least 1 second passed. Previously 10s, which caused sync issues with client polling.
            if (msPassed >= 1000) { 
                // Fetch necessary GameData to calculate Max Health correctly (including item bonuses)
                const gameDataRes = await pool.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
                const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
                const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

                const derivedChar = calculateDerivedStatsOnServer(character, itemTemplates, affixes);
                const maxHealth = derivedChar.stats.maxHealth;

                // Camp level % of Max HP per minute
                const regenPercentagePerMinute = character.camp.level; 
                
                // Calculate fractional HP gain based on milliseconds passed
                const hpToGain = (maxHealth * (regenPercentagePerMinute / 100)) * (msPassed / 60000);

                if (hpToGain > 0 && character.stats.currentHealth < maxHealth) {
                    character.stats.currentHealth = Math.min(maxHealth, character.stats.currentHealth + hpToGain);
                    // Update cursor to now
                    character.lastRestTime = now;
                    needsDbUpdate = true;
                } else if (character.stats.currentHealth >= maxHealth) {
                    character.stats.currentHealth = maxHealth;
                    character.isResting = false; // Auto-stop resting if full
                    character.lastRestTime = undefined;
                    needsDbUpdate = true;
                } else if (!character.lastRestTime) {
                    // Fix data if lastRestTime was missing but we are resting
                    character.lastRestTime = now;
                    needsDbUpdate = true;
                }
            }
        }
        
        // Asynchronously update the character in the DB if needed, without blocking the response.
        if (needsDbUpdate) {
            pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id])
                .catch(err => console.error("Async character update failed:", err));
        }


        // Check if expedition is finished and update character state in memory if needed, but don't finalize here
        if (character.activeExpedition && Date.now() >= character.activeExpedition.finishTime) {
            // The client will call /complete-expedition to finalize
        }

        if (character.activeTravel && Date.now() >= character.activeTravel.finishTime) {
            character.currentLocationId = character.activeTravel.destinationLocationId;
            character.activeTravel = null;
            pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id])
                .catch(err => console.error("Async travel completion update failed:", err));
        }

        res.json(character);

    } catch (err) {
        console.error('Error fetching character:', err);
        res.status(500).json({ message: 'Failed to fetch character data.' });
    }
});

router.post('/character/complete-expedition', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        let character: PlayerCharacter = result.rows[0].data;

        if (!character.activeExpedition || Date.now() < character.activeExpedition.finishTime) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No expedition to complete.' });
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => {
            acc[row.key as keyof GameData] = row.data;
            return acc;
        }, {} as GameData);

        const { updatedCharacter, summary, expeditionName } = processCompletedExpedition(character, gameData);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [updatedCharacter, req.user!.id]);

        // Save expedition report as a message - Pass OBJECT not string for JSONB column
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
             VALUES ($1, 'System', 'expedition_report', $2, $3)`,
            [req.user!.id, `Raport z Wyprawy: ${expeditionName}`, JSON.stringify(summary)]
        );

        await client.query('COMMIT');
        res.json({ updatedCharacter, summary });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error completing expedition:', err);
        res.status(500).json({ message: err.message || 'Failed to complete expedition.' });
    } finally {
        client.release();
    }
});

// POST /api/character - Create a new character
router.post('/character', authenticateToken, async (req: any, res: any) => {
    try {
        const newCharacterData: PlayerCharacter = req.body;
        if (!newCharacterData.name || !newCharacterData.race) {
            return res.status(400).json({ message: 'Name and race are required.' });
        }
        
        const existingChar = await pool.query('SELECT 1 FROM characters WHERE user_id = $1', [req.user!.id]);
        if (existingChar.rows.length > 0) {
            return res.status(409).json({ message: 'A character already exists for this user.' });
        }

        // Send class choice message if character reaches level 10
        if (newCharacterData.level >= 10 && !newCharacterData.characterClass) {
             const subject = 'Czas wybrać klasę!';
             const content = 'Gratulacje! Osiągnąłeś 10 poziom. Możesz teraz wybrać klasę dla swojej postaci w zakładce Statystyki -> Ścieżka rozwoju. Wybierz mądrze, ponieważ ten wybór jest ostateczny!';
             const body = { content };
             pool.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                 VALUES ($1, 'System', 'system', $2, $3)`,
                [req.user!.id, subject, JSON.stringify(body)]
            ).catch(err => console.error("Failed to send class choice message:", err));
        }

        const result = await pool.query(
            'INSERT INTO characters (user_id, data) VALUES ($1, $2) RETURNING data',
            [req.user!.id, newCharacterData]
        );
        res.status(201).json(result.rows[0].data);
    } catch (err) {
        console.error('Error creating character:', err);
        res.status(500).json({ message: 'Failed to create character.' });
    }
});

// PUT /api/character - Update character data
router.put('/character', authenticateToken, async (req: any, res: any) => {
    try {
        const updatedCharacterData: PlayerCharacter = req.body;

        // Send class choice message if character reaches level 10
        if (updatedCharacterData.level >= 10 && !updatedCharacterData.characterClass) {
             const subject = 'Czas wybrać klasę!';
             const content = 'Gratulacje! Osiągnąłeś 10 poziom. Możesz teraz wybrać klasę dla swojej postaci w zakładce Statystyki -> Ścieżka rozwoju. Wybierz mądrze, ponieważ ten wybór jest ostateczny!';
             const body = { content };
             pool.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                 VALUES ($1, 'System', 'system', $2, $3)`,
                [req.user!.id, subject, JSON.stringify(body)]
            ).catch(err => console.error("Failed to send class choice message:", err));
        }
        
        const result = await pool.query(
            'UPDATE characters SET data = $1 WHERE user_id = $2 RETURNING data',
            [updatedCharacterData, req.user!.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        res.json(result.rows[0].data);
    } catch (err) {
        console.error('Error updating character:', err);
        res.status(500).json({ message: 'Failed to update character.' });
    }
});

// POST /api/character/select-class
router.post('/character/select-class', authenticateToken, async (req: any, res: any) => {
    const { characterClass } = req.body as { characterClass: CharacterClass };
     if (!Object.values(CharacterClass).includes(characterClass)) {
        return res.status(400).json({ message: 'Invalid character class.' });
    }
    try {
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.characterClass || character.level < 10) {
            return res.status(400).json({ message: 'Cannot select class at this time.' });
        }

        character.characterClass = characterClass;

        const result = await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2 RETURNING data', [character, req.user!.id]);
        res.json(result.rows[0].data);

    } catch (err) {
        console.error('Error selecting class:', err);
        res.status(500).json({ message: 'Failed to select class.' });
    }
});

router.post('/character/learn-skill', authenticateToken, async (req: any, res: any) => {
    const { skillId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character: PlayerCharacter = charRes.rows[0].data;

        if (!character.learnedSkills) {
            character.learnedSkills = [];
        }

        if (character.learnedSkills.includes(skillId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Skill already learned.' });
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('skills', 'itemTemplates', 'affixes')");
        const skills: Skill[] = gameDataRes.rows.find(r => r.key === 'skills')?.data || [];
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        const skill = skills.find(s => s.id === skillId);

        if (!skill) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Skill not found.' });
        }

        // Calculate derived stats to check requirements
        const characterWithDerivedStats = calculateDerivedStatsOnServer(character, itemTemplates, affixes);
        const derivedStats = characterWithDerivedStats.stats;

        // Check requirements using derived stats
        for (const key of Object.keys(skill.requirements) as (keyof SkillRequirements)[]) {
            if ((derivedStats[key as keyof typeof derivedStats] || 0) < (skill.requirements[key]!)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Requirement not met: ${key}` });
            }
        }

        // Check cost
        for (const key of Object.keys(skill.cost) as (keyof SkillCost)[]) {
            if ((character.resources[key as keyof typeof character.resources] || 0) < (skill.cost[key]!)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough resources: ${key}` });
            }
        }

        // Deduct cost
        for (const key of Object.keys(skill.cost) as (keyof SkillCost)[]) {
            (character.resources[key as keyof typeof character.resources] as number) -= skill.cost[key]!
        }

        // Learn skill
        character.learnedSkills.push(skillId);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error learning skill:', err);
        res.status(500).json({ message: 'Failed to learn skill.' });
    } finally {
        client.release();
    }
});


router.post('/character/upgrade-building', authenticateToken, async (req: any, res: any) => {
    // Implementation for upgrading buildings like camp, chest, backpack
    res.status(501).json({ message: 'Not implemented' });
});

// POST /api/character/heal - Fully heal the character (Free action at camp)
router.post('/character/heal', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        const character: PlayerCharacter = charRes.rows[0].data;

        // Fetch game data to calculate correct Max HP
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const derivedChar = calculateDerivedStatsOnServer(character, itemTemplates, affixes);
        character.stats.currentHealth = derivedChar.stats.maxHealth;
        character.stats.currentMana = derivedChar.stats.maxMana;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error healing character:', err);
        res.status(500).json({ message: 'Failed to heal character.' });
    } finally {
        client.release();
    }
});

router.post('/character/complete-quest', authenticateToken, async (req: any, res: any) => {
    const { questId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character: PlayerCharacter = charRes.rows[0].data;
        
        // Safeguard: Ensure questProgress is an array
        if (!Array.isArray(character.questProgress)) {
             character.questProgress = [];
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('quests', 'itemTemplates', 'affixes')");
        const quests = gameDataRes.rows.find(r => r.key === 'quests')?.data || [];
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const quest = quests.find((q: any) => q.id === questId);
        if (!quest) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Quest not found.' });
        }
        
        if (!quest.objective) {
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'Quest data corrupted (missing objective).' });
        }
        
        const progress = character.questProgress.find(p => p.questId === questId);
        if (!progress) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Quest not accepted or progress not found.' });
        }

        let isObjectiveMet = false;
        switch (quest.objective.type) {
            case QuestType.Kill:
                isObjectiveMet = progress.progress >= quest.objective.amount;
                break;
            case QuestType.Gather:
                isObjectiveMet = character.inventory.filter(i => i.templateId === quest.objective.targetId).length >= quest.objective.amount;
                break;
            case QuestType.GatherResource:
                 isObjectiveMet = (character.resources[quest.objective.targetId as keyof CharacterResources] || 0) >= quest.objective.amount;
                break;
            case QuestType.PayGold:
                isObjectiveMet = character.resources.gold >= quest.objective.amount;
                break;
        }

        if (!isObjectiveMet) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Quest objective not met.' });
        }

        // Deduct items/resources
        if (quest.objective.type === QuestType.Gather) {
            let count = quest.objective.amount;
            character.inventory = character.inventory.filter(item => {
                if (item.templateId === quest.objective.targetId && count > 0) {
                    count--;
                    return false;
                }
                return true;
            });
        } else if (quest.objective.type === QuestType.GatherResource) {
            (character.resources[quest.objective.targetId as keyof CharacterResources] as number) -= quest.objective.amount;
        } else if (quest.objective.type === QuestType.PayGold) {
            character.resources.gold = (Number(character.resources.gold) || 0) - quest.objective.amount;
        }

        // Add rewards if rewards exist
        if (quest.rewards) {
            if (quest.rewards.gold) {
                character.resources.gold = (Number(character.resources.gold) || 0) + quest.rewards.gold;
            }
            if (quest.rewards.experience) {
                character.experience = (Number(character.experience) || 0) + quest.rewards.experience;
            }

            (quest.rewards.itemRewards || []).forEach((reward: ItemReward) => {
                for (let i = 0; i < reward.quantity; i++) {
                    if (character.inventory.length < getBackpackCapacity(character)) {
                        character.inventory.push(createItemInstance(reward.templateId, itemTemplates, affixes));
                    }
                }
            });

            (quest.rewards.resourceRewards || []).forEach((reward: ResourceReward) => {
                (character.resources[reward.resource as keyof CharacterResources] as number) += reward.quantity;
            });
            
            (quest.rewards.lootTable || []).forEach((drop: LootDrop) => {
                if (Math.random() * 100 < drop.chance) {
                    if (character.inventory.length < getBackpackCapacity(character)) {
                        character.inventory.push(createItemInstance(drop.templateId, itemTemplates, affixes));
                    }
                }
            });
        }

        // Update quest progress
        progress.completions++;
        if (quest.repeatable === 0 || progress.completions < quest.repeatable) {
            progress.progress = 0; // Reset for repeatable quests
        } else {
            character.acceptedQuests = character.acceptedQuests.filter(id => id !== questId);
        }

        // Level up check
        while (character.experience >= character.experienceToNextLevel) {
            character.experience -= character.experienceToNextLevel;
            character.level += 1;
            character.stats.statPoints += 1;
            character.experienceToNextLevel = Math.floor(100 * Math.pow(character.level, 1.3));
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error completing quest:', err);
        res.status(500).json({ message: 'Failed to complete quest.' });
    } finally {
        client.release();
    }
});


// GET /api/characters/names - Get all character names
router.get('/characters/names', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query("SELECT data->>'name' as name FROM characters");
        res.json(result.rows.map(r => r.name));
    } catch (err) {
        console.error('Error fetching character names:', err);
        res.status(500).json({ message: 'Failed to fetch character names.' });
    }
});

export default router;
