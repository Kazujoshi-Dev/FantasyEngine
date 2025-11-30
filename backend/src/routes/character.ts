
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter, CharacterClass, GameData, ItemReward, ResourceReward, QuestType, CharacterResources, ItemInstance, PlayerQuestProgress, LootDrop, Skill, SkillRequirements, SkillCost, ExpeditionRewardSummary, PublicCharacterProfile, EquipmentSlot, CharacterStats, Expedition, EssenceType } from '../types.js';
import { processCompletedExpedition } from '../logic/expeditions.js';
import { createItemInstance } from '../logic/items.js';
import { getBackpackCapacity } from '../logic/helpers.js';
import { calculateDerivedStatsOnServer, calculateTotalExperience } from '../logic/stats.js';

const router = express.Router();

// Helper function for upgrade costs (Mirrors frontend logic)
const getCampUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 5 && level <= 7) essences.push({ type: EssenceType.Common, amount: (level - 4) * 2 });
    if (level >= 8) essences.push({ type: EssenceType.Common, amount: 6 }, { type: EssenceType.Uncommon, amount: level - 7 });
    return { gold, essences };
};

const getChestUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 6) essences.push({ type: EssenceType.Uncommon, amount: Math.floor((level - 5) / 2) + 1 });
    return { gold, essences };
};

const getBackpackUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 4 && level <= 6) essences.push({ type: EssenceType.Common, amount: (level - 3) * 5 });
    if (level >= 7 && level <= 8) essences.push({ type: EssenceType.Uncommon, amount: (level - 6) * 3 });
    if (level >= 9) essences.push({ type: EssenceType.Rare, amount: level - 8 });
    return { gold, essences };
};

// GET /api/character - Get the current user's character data
router.get('/character', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT c.user_id, c.data, u.username, c.created_at, g.buildings 
            FROM characters c 
            JOIN users u ON c.user_id = u.id 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1
        `, [req.user!.id]);
        
        if (result.rows.length === 0) {
            return res.status(200).json(null);
        }
        
        const row = result.rows[0];
        const character: PlayerCharacter = {
            ...row.data,
            id: row.user_id,
            username: row.username,
        };
        
        // Extract Guild Barracks Level
        const guildBuildings = row.buildings || {};
        const barracksLevel = guildBuildings['barracks'] || 0;
        
        const now = Date.now();
        let needsDbUpdate = false;

        // Fetch necessary GameData to calculate Max Health/Energy correctly (including item bonuses)
        const gameDataRes = await pool.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        // Calculate true max stats based on current equipment, attributes AND guild bonus
        const derivedChar = calculateDerivedStatsOnServer(character, itemTemplates, affixes, barracksLevel);
        const trueMaxEnergy = derivedChar.stats.maxEnergy;
        const trueMaxHealth = derivedChar.stats.maxHealth;

        // --- Energy Regeneration "Catch-up" Logic ---
        const lastEnergyUpdate = character.lastEnergyUpdateTime || new Date(row.created_at).getTime();
        const msPerHour = 60 * 60 * 1000;
        const hoursPassed = Math.floor((now - lastEnergyUpdate) / msPerHour);

        if (hoursPassed > 0) {
            const currentEnergy = character.stats.currentEnergy;
            if (currentEnergy < trueMaxEnergy) {
                character.stats.currentEnergy = Math.min(trueMaxEnergy, currentEnergy + hoursPassed);
                needsDbUpdate = true;
            }
            character.lastEnergyUpdateTime = lastEnergyUpdate + (hoursPassed * msPerHour);
            needsDbUpdate = true;
        }

        // --- Health Regeneration Logic (Resting) ---
        if (character.isResting) {
            const lastRestTime = Number(character.lastRestTime) || now;
            const msPassed = now - lastRestTime;
            
            if (msPassed >= 1000) { 
                const regenPercentagePerMinute = character.camp.level; 
                const hpToGain = (trueMaxHealth * (regenPercentagePerMinute / 100)) * (msPassed / 60000);

                if (hpToGain > 0 && character.stats.currentHealth < trueMaxHealth) {
                    character.stats.currentHealth = Math.min(trueMaxHealth, character.stats.currentHealth + hpToGain);
                    character.lastRestTime = now;
                    needsDbUpdate = true;
                } else if (character.stats.currentHealth >= trueMaxHealth) {
                    character.stats.currentHealth = trueMaxHealth;
                    character.isResting = false;
                    character.lastRestTime = undefined;
                    needsDbUpdate = true;
                } else if (!character.lastRestTime) {
                    character.lastRestTime = now;
                    needsDbUpdate = true;
                }
            }
        }
        
        if (needsDbUpdate) {
            pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id])
                .catch(err => console.error("Async character update failed:", err));
        }

        if (character.activeTravel && Date.now() >= character.activeTravel.finishTime) {
            character.currentLocationId = character.activeTravel.destinationLocationId;
            character.activeTravel = null;
            pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id])
                .catch(err => console.error("Async travel completion update failed:", err));
        }

        character.guildBarracksLevel = barracksLevel;

        res.json(character);

    } catch (err) {
        console.error('Error fetching character:', err);
        res.status(500).json({ message: 'Failed to fetch character data.' });
    }
});

// GET /api/character/profile/:name - Get public profile
router.get('/character/profile/:name', authenticateToken, async (req: any, res: any) => {
    const charName = req.params.name;
    try {
        const result = await pool.query(`
            SELECT c.data, g.name as guild_name, g.tag as guild_tag
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.data->>'name' = $1
        `, [charName]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }

        const row = result.rows[0];
        const data = row.data;

        const totalExperience = calculateTotalExperience(data.level, data.experience);

        const profile: PublicCharacterProfile = {
            name: data.name,
            race: data.race,
            characterClass: data.characterClass,
            level: data.level,
            experience: totalExperience,
            pvpWins: data.pvpWins || 0,
            pvpLosses: data.pvpLosses || 0,
            guildName: row.guild_name,
            guildTag: row.guild_tag,
            description: data.description,
            avatarUrl: data.avatarUrl
        };

        res.json(profile);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
});

router.post('/character/start-expedition', authenticateToken, async (req: any, res: any) => {
    const { expeditionId } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found.' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        if (character.activeExpedition) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Character is already on an expedition.' });
        }
        if (character.activeTravel) {
             await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Character is travelling.' });
        }
        if (character.isResting) {
             await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Character is resting.' });
        }
        if (character.stats.currentHealth <= 0) {
             await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Twoje zdrowie jest zbyt niskie, aby wyruszyć na wyprawę. Odpocznij lub ulecz się.' });
        }

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'expeditions'");
        const expeditions: Expedition[] = gameDataRes.rows[0]?.data || [];
        const expedition = expeditions.find(e => e.id === expeditionId);

        if (!expedition) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Expedition not found.' });
        }

        if ((character.resources?.gold || 0) < expedition.goldCost) {
             await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold.' });
        }
        if (character.stats.currentEnergy < expedition.energyCost) {
             await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough energy.' });
        }

        character.resources.gold = (Number(character.resources.gold) || 0) - expedition.goldCost;
        character.stats.currentEnergy -= expedition.energyCost;
        
        character.activeExpedition = {
            expeditionId: expedition.id,
            finishTime: Date.now() + expedition.duration * 1000,
            enemies: [], 
            combatLog: [],
            rewards: { gold: 0, experience: 0 }
        };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        
        res.json(character);

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error starting expedition:', err);
        res.status(500).json({ message: 'Failed to start expedition.' });
    } finally {
        client.release();
    }
});

router.post('/character/complete-expedition', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const result = await client.query(`
            SELECT c.data, g.buildings
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 
            FOR UPDATE OF c
        `, [req.user!.id]);
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        let character: PlayerCharacter = result.rows[0].data;
        const guildBuildings = result.rows[0].buildings || {};
        const barracksLevel = guildBuildings['barracks'] || 0;
        const scoutHouseLevel = guildBuildings['scoutHouse'] || 0;

        if (!character.activeExpedition || Date.now() < character.activeExpedition.finishTime) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No expedition to complete.' });
        }

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => {
            acc[row.key as keyof GameData] = row.data;
            return acc;
        }, {} as GameData);

        let updatedCharacter: PlayerCharacter = character;
        let summary: ExpeditionRewardSummary;
        let expeditionName = 'Wyprawa';

        try {
            const processingResult = processCompletedExpedition(character, gameData, barracksLevel, scoutHouseLevel);
            updatedCharacter = processingResult.updatedCharacter;
            summary = processingResult.summary;
            expeditionName = processingResult.expeditionName;
        } catch (calcError: any) {
            console.error("CRITICAL ERROR processing expedition:", calcError);
            character.activeExpedition = null;
            updatedCharacter = character;

            summary = {
                rewardBreakdown: [],
                totalGold: 0,
                totalExperience: 0,
                combatLog: [{
                    turn: 0,
                    attacker: 'System',
                    defender: 'Player',
                    action: 'Wystąpił błąd krytyczny podczas obliczania wyników wyprawy. Postać została bezpiecznie przywołana do obozu.',
                    playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0
                }],
                isVictory: false,
                itemsFound: [],
                essencesFound: {},
            };
            expeditionName = "Błąd Wyprawy";
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [updatedCharacter, req.user!.id]);

        const messageRes = await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
             VALUES ($1, 'System', 'expedition_report', $2, $3) RETURNING id`,
            [req.user!.id, `Raport: ${expeditionName}`, JSON.stringify(summary)]
        );
        const messageId = messageRes.rows[0].id;

        await client.query('COMMIT');
        res.json({ updatedCharacter, summary, messageId });

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

// PUT /api/character - Restricted Update (Settings/Profile/Resting)
router.put('/character', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        const dbChar: PlayerCharacter = charRes.rows[0].data;
        const incomingChar: PlayerCharacter = req.body;

        // Whitelist allowed fields for direct update
        // Only strictly safe fields can be updated directly by the client
        if (incomingChar.description !== undefined) dbChar.description = incomingChar.description;
        if (incomingChar.avatarUrl !== undefined) dbChar.avatarUrl = incomingChar.avatarUrl;
        if (incomingChar.settings) {
            if (incomingChar.settings.language) {
                if (!dbChar.settings) dbChar.settings = {};
                dbChar.settings.language = incomingChar.settings.language;
            }
        }
        if (incomingChar.lastReadNewsTimestamp !== undefined) dbChar.lastReadNewsTimestamp = incomingChar.lastReadNewsTimestamp;

        // Resting Toggle Logic
        if (incomingChar.isResting !== undefined && incomingChar.isResting !== dbChar.isResting) {
            // Check if action is allowed (not traveling/expedition)
            if (dbChar.activeExpedition || dbChar.activeTravel) {
                // Deny resting toggle
            } else {
                dbChar.isResting = incomingChar.isResting;
                if (dbChar.isResting) {
                    dbChar.restStartHealth = dbChar.stats.currentHealth;
                    dbChar.lastRestTime = Date.now();
                } else {
                    dbChar.lastRestTime = undefined;
                }
            }
        }
        
        await client.query(
            'UPDATE characters SET data = $1 WHERE user_id = $2',
            [dbChar, req.user!.id]
        );
        
        await client.query('COMMIT');
        
        res.json(dbChar);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating character:', err);
        res.status(500).json({ message: 'Failed to update character.' });
    } finally {
        client.release();
    }
});

// POST /api/character/distribute-points
router.post('/character/distribute-points', authenticateToken, async (req: any, res: any) => {
    const { stats: pointsToAdd } = req.body as { stats: Partial<CharacterStats> };
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const totalToAdd = Object.values(pointsToAdd).reduce((a, b) => (a || 0) + (b || 0), 0) as number;
        
        if (totalToAdd <= 0) {
             await client.query('ROLLBACK');
             return res.json(character);
        }

        if (character.stats.statPoints < totalToAdd) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough stat points.' });
        }

        // Apply points
        const statKeys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];
        for (const key of statKeys) {
            if (pointsToAdd[key]) {
                character.stats[key] = (character.stats[key] || 0) + (pointsToAdd[key] || 0);
            }
        }
        character.stats.statPoints -= totalToAdd;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error distributing points' });
    } finally {
        client.release();
    }
});

// POST /api/character/reset-attributes
router.post('/character/reset-attributes', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        const character: PlayerCharacter = charRes.rows[0].data;

        const isFree = !character.freeStatResetUsed;
        const cost = 100 * character.level;

        if (!isFree && character.resources.gold < cost) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough gold.' });
        }

        if (!isFree) {
            character.resources.gold -= cost;
        }
        
        const totalPoints = 10 + (character.level - 1);
        character.stats.strength = 0;
        character.stats.agility = 0;
        character.stats.accuracy = 0;
        character.stats.stamina = 0;
        character.stats.intelligence = 0;
        character.stats.energy = 0;
        character.stats.statPoints = totalPoints;
        
        character.freeStatResetUsed = true;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error resetting attributes' });
    } finally {
        client.release();
    }
});

// POST /api/character/equip
router.post('/character/equip', authenticateToken, async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        // Fetch Metadata
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        // Find Item
        const inventoryIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (inventoryIndex === -1) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Item not found in inventory' });
        }
        const itemToEquip = character.inventory[inventoryIndex];
        const template = itemTemplates.find((t: any) => t.id === itemToEquip.templateId);
        
        if (!template) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Item template invalid' });
        }
        
        // Check Requirements (Level & Stats)
        if (character.level < template.requiredLevel) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Level too low' });
        }
        
        // Calculate stats to verify requirements
        const derivedChar = calculateDerivedStatsOnServer(character, itemTemplates, affixes);
        for (const stat in (template.requiredStats || {})) {
             // @ts-ignore
             if ((derivedChar.stats[stat] || 0) < template.requiredStats[stat]) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ message: `Requirement not met: ${stat}` });
             }
        }

        // Determine Slot
        let targetSlot: EquipmentSlot = template.slot as EquipmentSlot;
        
        // Handle Rings
        if (template.slot === 'ring') {
             if (!character.equipment.ring1) targetSlot = EquipmentSlot.Ring1;
             else if (!character.equipment.ring2) targetSlot = EquipmentSlot.Ring2;
             else {
                 // Both full, swap with ring1 (or handle error? let's swap 1)
                 // Alternatively fail if user didn't specify slot.
                 // For simple API, assume swapping Ring 1 if full.
                 targetSlot = EquipmentSlot.Ring1;
             }
        }
        
        // Unequip existing item in slot
        if (character.equipment[targetSlot]) {
             character.inventory.push(character.equipment[targetSlot]!);
             character.equipment[targetSlot] = null;
        }
        
        // Handle Two Handed Logic
        if (targetSlot === EquipmentSlot.TwoHand) {
            if (character.equipment.mainHand) {
                character.inventory.push(character.equipment.mainHand);
                character.equipment.mainHand = null;
            }
            if (character.equipment.offHand) {
                character.inventory.push(character.equipment.offHand);
                character.equipment.offHand = null;
            }
        }
        if (targetSlot === EquipmentSlot.MainHand || targetSlot === EquipmentSlot.OffHand) {
             if (character.equipment.twoHand) {
                character.inventory.push(character.equipment.twoHand);
                character.equipment.twoHand = null;
             }
        }

        // Equip
        character.inventory.splice(inventoryIndex, 1); // Remove from inv
        character.equipment[targetSlot] = itemToEquip;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error equipping item' });
    } finally {
        client.release();
    }
});

// POST /api/character/unequip
router.post('/character/unequip', authenticateToken, async (req: any, res: any) => {
    const { slot } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const item = character.equipment[slot as EquipmentSlot];
        if (!item) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'No item in slot' });
        }
        
        const capacity = getBackpackCapacity(character);
        if (character.inventory.length >= capacity) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Backpack full' });
        }

        character.equipment[slot as EquipmentSlot] = null;
        character.inventory.push(item);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error unequipping item' });
    } finally {
        client.release();
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
        
        const charRes = await client.query(`
            SELECT c.data, g.buildings
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 
            FOR UPDATE OF c
        `, [req.user!.id]);
        
        let character: PlayerCharacter = charRes.rows[0].data;
        const barracksLevel = charRes.rows[0].buildings?.barracks || 0;

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

        const characterWithDerivedStats = calculateDerivedStatsOnServer(character, itemTemplates, affixes, barracksLevel);
        const derivedStats = characterWithDerivedStats.stats;

        for (const key of Object.keys(skill.requirements) as (keyof SkillRequirements)[]) {
            if ((derivedStats[key as keyof typeof derivedStats] || 0) < (skill.requirements[key]!)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Requirement not met: ${String(key)}` });
            }
        }

        for (const key of Object.keys(skill.cost) as (keyof SkillCost)[]) {
            if ((character.resources[key as keyof typeof character.resources] || 0) < (skill.cost[key]!)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Not enough resources: ${String(key)}` });
            }
        }

        for (const key of Object.keys(skill.cost) as (keyof SkillCost)[]) {
            (character.resources[key as keyof typeof character.resources] as number) -= skill.cost[key]!
        }

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
    res.status(501).json({ message: 'Not implemented' });
});

// Upgrade Camp
router.post('/character/upgrade-camp', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        if (character.camp.level >= 10) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Camp at max level' }); }
        if (character.isResting) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Cannot upgrade while resting' }); }

        const cost = getCampUpgradeCost(character.camp.level);
        
        // Check Gold
        if ((character.resources.gold || 0) < cost.gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); 
        }
        // Check Essences
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` }); 
            }
        }

        // Deduct & Upgrade
        character.resources.gold -= cost.gold;
        for (const e of cost.essences) character.resources[e.type] -= e.amount;
        character.camp.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Upgrade failed' });
    } finally { client.release(); }
});

// Upgrade Chest
router.post('/character/upgrade-chest', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const cost = getChestUpgradeCost(character.chest.level);
        
         // Check Gold
        if ((character.resources.gold || 0) < cost.gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); 
        }
        // Check Essences
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` }); 
            }
        }

        // Deduct & Upgrade
        character.resources.gold -= cost.gold;
        for (const e of cost.essences) character.resources[e.type] -= e.amount;
        character.chest.level += 1;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Upgrade failed' });
    } finally { client.release(); }
});

// Upgrade Backpack
router.post('/character/upgrade-backpack', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        if (charRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Character not found' }); }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const currentLevel = character.backpack?.level || 1;
        if (currentLevel >= 10) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Backpack at max level' }); }

        const cost = getBackpackUpgradeCost(currentLevel);
        
         // Check Gold
        if ((character.resources.gold || 0) < cost.gold) {
             await client.query('ROLLBACK'); return res.status(400).json({ message: 'Not enough gold' }); 
        }
        // Check Essences
        for (const e of cost.essences) {
            if ((character.resources[e.type] || 0) < e.amount) {
                 await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough ${e.type}` }); 
            }
        }

        // Deduct & Upgrade
        character.resources.gold -= cost.gold;
        for (const e of cost.essences) character.resources[e.type] -= e.amount;
        character.backpack = { level: currentLevel + 1 };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Upgrade failed' });
    } finally { client.release(); }
});

// POST /api/character/heal - Fully heal the character (Free action at camp)
router.post('/character/heal', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query(`
            SELECT c.data, g.buildings
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 
            FOR UPDATE OF c
        `, [req.user!.id]);
        
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        const character: PlayerCharacter = charRes.rows[0].data;
        const barracksLevel = charRes.rows[0].buildings?.barracks || 0;

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const derivedChar = calculateDerivedStatsOnServer(character, itemTemplates, affixes, barracksLevel);
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

router.post('/character/accept-quest', authenticateToken, async (req: any, res: any) => {
    const { questId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character: PlayerCharacter = charRes.rows[0].data;

        if (!character.acceptedQuests) character.acceptedQuests = [];
        if (!character.questProgress) character.questProgress = [];

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'quests'");
        const quests = gameDataRes.rows[0]?.data || [];
        const quest = quests.find((q: any) => q.id === questId);

        if (!quest) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Quest not found.' });
        }
        if (!quest.locationIds.includes(character.currentLocationId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Quest not available in this location.' });
        }
        if (character.acceptedQuests.includes(questId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Quest already accepted.' });
        }

        const progress = character.questProgress.find(p => p.questId === questId);
        if (quest.repeatable > 0 && progress && progress.completions >= quest.repeatable) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Quest has been fully completed.' });
        }

        character.acceptedQuests.push(questId);
        if (!progress) {
            character.questProgress.push({ questId, progress: 0, completions: 0 });
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error accepting quest:', err);
        res.status(500).json({ message: 'Failed to accept quest.' });
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

        progress.completions++;
        if (quest.repeatable === 0 || progress.completions < quest.repeatable) {
            progress.progress = 0;
        } else {
            character.acceptedQuests = character.acceptedQuests.filter(id => id !== questId);
        }

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
