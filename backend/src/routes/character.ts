// fix: Correctly import express and its types.
import express, { Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter, CharacterClass, GameData, EssenceType, QuestType, ResourceReward, ItemReward } from '../types.js';
import { processCompletedExpedition } from '../logic/expeditions.js';
import { createItemInstance } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

// GET /api/character - Get the current user's character data
// fix: Use Request and Response types directly.
router.get('/character', authenticateToken, async (req: Request, res: Response) => {
    try {
        // fix: Use req.user directly, as its type is extended globally.
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user!.id]);
        
        if (result.rows.length === 0) {
            return res.status(200).json(null);
        }
        
        const character: PlayerCharacter = result.rows[0].data;

        // Energy regeneration logic
        const now = Date.now();
        const lastUpdate = character.lastEnergyUpdateTime || now;
        const hoursPassed = Math.floor((now - lastUpdate) / (1000 * 60 * 60));

        let needsDbUpdate = false;
        if (hoursPassed > 0 && character.stats.currentEnergy < character.stats.maxEnergy) {
            const energyToRegen = Math.min(
                hoursPassed,
                character.stats.maxEnergy - character.stats.currentEnergy
            );

            if (energyToRegen > 0) {
                character.stats.currentEnergy += energyToRegen;
                // Update the timestamp to the last full hour for which energy was granted
                character.lastEnergyUpdateTime = lastUpdate + hoursPassed * (1000 * 60 * 60);
                needsDbUpdate = true;
            }
        }
        
        // Asynchronously update the character in the DB if energy changed, without blocking the response.
        if (needsDbUpdate) {
            // fix: Use req.user directly, as its type is extended globally.
            pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id])
                .catch(err => console.error("Async energy update failed:", err));
        }


        // Check if expedition is finished and update character state in memory if needed, but don't finalize here
        if (character.activeExpedition && Date.now() >= character.activeExpedition.finishTime) {
            // The client will call /complete-expedition to finalize
        }

        res.json(character);

    } catch (err) {
        console.error('Error fetching character:', err);
        res.status(500).json({ message: 'Failed to fetch character data.' });
    }
});

// fix: Use Request and Response types directly.
router.post('/character/complete-expedition', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // fix: Use req.user directly, as its type is extended globally.
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
        
        // fix: Use req.user directly, as its type is extended globally.
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [updatedCharacter, req.user!.id]);

        // Save expedition report as a message
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
             VALUES ($1, 'System', 'expedition_report', $2, $3)`,
            // fix: Use req.user directly, as its type is extended globally.
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
// fix: Use Request and Response types directly.
router.post('/character', authenticateToken, async (req: Request, res: Response) => {
    try {
        const newCharacterData: PlayerCharacter = req.body;
        if (!newCharacterData.name || !newCharacterData.race) {
            return res.status(400).json({ message: 'Name and race are required.' });
        }
        
        // fix: Use req.user directly, as its type is extended globally.
        const existingChar = await pool.query('SELECT 1 FROM characters WHERE user_id = $1', [req.user!.id]);
        if (existingChar.rows.length > 0) {
            return res.status(409).json({ message: 'A character already exists for this user.' });
        }

        const result = await pool.query(
            'INSERT INTO characters (user_id, data) VALUES ($1, $2) RETURNING data',
            // fix: Use req.user directly, as its type is extended globally.
            [req.user!.id, newCharacterData]
        );
        res.status(201).json(result.rows[0].data);
    } catch (err) {
        console.error('Error creating character:', err);
        res.status(500).json({ message: 'Failed to create character.' });
    }
});

// PUT /api/character - Update character data
// fix: Use Request and Response types directly.
router.put('/character', authenticateToken, async (req: Request, res: Response) => {
    try {
        const updatedCharacterData: PlayerCharacter = req.body;
        
        const result = await pool.query(
            'UPDATE characters SET data = $1 WHERE user_id = $2 RETURNING data',
            // fix: Use req.user directly, as its type is extended globally.
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
// fix: Use Request and Response types directly.
router.post('/character/select-class', authenticateToken, async (req: Request, res: Response) => {
    const { characterClass } = req.body as { characterClass: CharacterClass };
     if (!Object.values(CharacterClass).includes(characterClass)) {
        return res.status(400).json({ message: 'Invalid character class.' });
    }
    try {
        // fix: Use req.user directly, as its type is extended globally.
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user!.id]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.characterClass || character.level < 10) {
            return res.status(400).json({ message: 'Cannot select class at this time.' });
        }

        character.characterClass = characterClass;

        // fix: Use req.user directly, as its type is extended globally.
        const result = await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2 RETURNING data', [character, req.user!.id]);
        res.json(result.rows[0].data);

    } catch (err) {
        console.error('Error selecting class:', err);
        res.status(500).json({ message: 'Failed to select class.' });
    }
});

// GET /api/characters/names - Get all character names
// fix: Use Request and Response types directly.
router.get('/characters/names', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = await pool.query("SELECT data->>'name' as name FROM characters");
        res.json(result.rows.map(r => r.name));
    } catch (err) {
        console.error('Error fetching character names:', err);
        res.status(500).json({ message: 'Failed to fetch character names.' });
    }
});

// POST /api/character/heal-to-full
// fix: Use Request and Response types directly.
router.post('/heal-to-full', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // fix: Use req.user directly, as its type is extended globally.
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) throw new Error('Character not found');
        
        let character: PlayerCharacter = charRes.rows[0].data;
        const healthToHeal = character.stats.maxHealth - character.stats.currentHealth;
        if (healthToHeal <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Already at full health." });
        }

        const cost = Math.ceil(healthToHeal / 2); // 1 gold per 2 HP
        if (character.resources.gold < cost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Not enough gold to heal." });
        }

        character.resources.gold -= cost;
        character.stats.currentHealth = character.stats.maxHealth;

        // fix: Use req.user directly, as its type is extended globally.
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to heal.' });
    } finally {
        client.release();
    }
});

// POST /api/character/upgrade-building
// fix: Use Request and Response types directly.
router.post('/upgrade-building', authenticateToken, async (req: Request, res: Response) => {
    const { building } = req.body as { building: 'camp' | 'chest' | 'backpack' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // fix: Use req.user directly, as its type is extended globally.
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) throw new Error('Character not found');

        let character: PlayerCharacter = charRes.rows[0].data;
        let cost: { gold: number, essences?: { type: EssenceType, amount: number }[] } | null = null;
        
        if (building === 'camp') {
            const level = character.camp.level;
            cost = { gold: Math.floor(100 * Math.pow(1.8, level - 1)) };
            if (character.resources.gold >= cost.gold) {
                character.resources.gold -= cost.gold;
                character.camp.level++;
            }
        } else if (building === 'chest') {
            const level = character.chest.level;
            cost = { gold: Math.floor(250 * Math.pow(1.9, level - 1)), essences: [{ type: EssenceType.Common, amount: 10 * level }] };
            const canAfford = character.resources.gold >= cost.gold && cost.essences!.every(e => (character.resources[e.type] || 0) >= e.amount);
            if (canAfford) {
                character.resources.gold -= cost.gold;
                cost.essences!.forEach(e => character.resources[e.type] -= e.amount);
                character.chest.level++;
            }
        } else if (building === 'backpack') {
            const level = character.backpack.level;
            cost = { gold: Math.floor(200 * Math.pow(1.7, level - 1)), essences: [{ type: EssenceType.Common, amount: 5 * level }] };
            const canAfford = character.resources.gold >= cost.gold && cost.essences!.every(e => (character.resources[e.type] || 0) >= e.amount);
             if (canAfford) {
                character.resources.gold -= cost.gold;
                cost.essences!.forEach(e => character.resources[e.type] -= e.amount);
                character.backpack.level++;
            }
        }

        if (!cost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: "Invalid building type." });
        }
        
        const canAfford = character.resources.gold >= cost.gold && (cost.essences || []).every(e => (character.resources[e.type] || 0) >= e.amount);
        // This check is a bit redundant due to logic inside ifs, but good as a safeguard
        if ((building === 'camp' && character.camp.level > 1) || (building === 'chest' && character.chest.level > 1) || (building === 'backpack' && character.backpack.level > 1)) {
            // It means upgrade was successful
        } else {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: "Not enough resources for upgrade." });
        }
        
        // fix: Use req.user directly, as its type is extended globally.
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to upgrade building.' });
    } finally {
        client.release();
    }
});

// POST /api/character/complete-quest
// fix: Use Request and Response types directly.
router.post('/complete-quest', authenticateToken, async (req: Request, res: Response) => {
    const { questId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // fix: Use req.user directly, as its type is extended globally.
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) throw new Error('Character not found');
        let character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'quests' OR key = 'itemTemplates' OR key = 'affixes'");
        const quests = gameDataRes.rows.find(r => r.key === 'quests')?.data || [];
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        const quest = quests.find((q: any) => q.id === questId);
        if (!quest) return res.status(404).json({ message: 'Quest not found' });
        
        let progress = character.questProgress.find(p => p.questId === questId);
        if (!progress) {
             progress = { questId, progress: 0, completions: 0 };
             character.questProgress.push(progress);
        }

        // Backend validation
        const objective = quest.objective;
        let isObjectiveMet = false;
        switch (objective.type) {
            case QuestType.Kill: isObjectiveMet = progress.progress >= objective.amount; break;
            case QuestType.Gather: isObjectiveMet = character.inventory.filter(i => i.templateId === objective.targetId).length >= objective.amount; break;
            case QuestType.GatherResource: isObjectiveMet = (character.resources[objective.targetId as EssenceType] || 0) >= objective.amount; break;
            case QuestType.PayGold: isObjectiveMet = character.resources.gold >= objective.amount; break;
        }

        if (!isObjectiveMet) return res.status(400).json({ message: 'Objective not met.' });

        // Deduct resources/items
        switch (objective.type) {
            case QuestType.Gather:
                for (let i = 0; i < objective.amount; i++) {
                    const itemIndex = character.inventory.findIndex(it => it.templateId === objective.targetId);
                    if (itemIndex > -1) character.inventory.splice(itemIndex, 1);
                }
                break;
            case QuestType.GatherResource:
                if (objective.targetId && objective.targetId in character.resources) {
                    const resourceKey = objective.targetId as keyof Omit<PlayerCharacter['resources'], 'gold'>;
                    character.resources[resourceKey] -= objective.amount;
                }
                break;
            case QuestType.PayGold: character.resources.gold -= objective.amount; break;
        }

        // Grant rewards
        character.resources.gold += quest.rewards.gold;
        character.experience += quest.rewards.experience;

        const backpackCapacity = getBackpackCapacity(character);
        (quest.rewards.itemRewards || []).forEach((r: ItemReward) => {
             for(let i=0; i<r.quantity; i++) {
                if(character.inventory.length < backpackCapacity)
                    character.inventory.push(createItemInstance(r.templateId, itemTemplates, affixes));
            }
        });
        (quest.rewards.resourceRewards || []).forEach((r: ResourceReward) => {
            character.resources[r.resource] = (character.resources[r.resource] || 0) + r.quantity;
        });

        // Update progress
        progress.completions++;
        progress.progress = 0; // Reset for repeatable quests
        if (quest.repeatable !== 0 && progress.completions >= quest.repeatable) {
            character.acceptedQuests = character.acceptedQuests.filter(id => id !== questId);
        }

        // fix: Use req.user directly, as its type is extended globally.
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to complete quest.' });
    } finally {
        client.release();
    }
});

export default router;