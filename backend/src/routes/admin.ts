
import express from 'express';
import { pool } from '../db.js';
import { PlayerCharacter, ItemInstance, DuplicationAuditResult, OrphanAuditResult, ItemSearchResult, GameData, EquipmentSlot, CharacterStats, Language, ItemTemplate, Affix } from '../types.js';
import { authenticateToken } from '../middleware/auth.js';
import { hashPassword } from '../logic/helpers.js';
import { rollTemplateStats, rollAffixStats } from '../logic/items.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Middleware: Sprawdź czy użytkownik to Admin
const isAdmin = async (req: any, res: any, next: any) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows.length === 0 || userRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: 'Error checking admin status' });
    }
};

// Zastosuj middleware dla wszystkich tras w tym pliku
router.use(authenticateToken as any, isAdmin as any);

// ==========================================
//                 USERS
// ==========================================

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

// POST /api/admin/users/:userId/password
router.post('/users/:userId/password', async (req, res) => {
    const { newPassword } = req.body;
    const { userId } = req.params;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        const { salt, hash } = hashPassword(newPassword);
        
        await pool.query(
            'UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3',
            [hash, salt, userId]
        );

        res.json({ message: 'User password updated successfully.' });
    } catch (err) {
        console.error('Admin password change error:', err);
        res.status(500).json({ message: 'Failed to update password.' });
    }
});

// ==========================================
//               CHARACTERS
// ==========================================

// GET /api/admin/characters/all
router.get('/characters/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id, 
                u.username,
                c.data->>'name' as name,
                c.data->>'race' as race,
                c.data->>'characterClass' as "characterClass",
                COALESCE((c.data->>'level')::int, 1) as level,
                COALESCE((c.data->'resources'->>'gold')::bigint, 0) as gold
            FROM characters c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.user_id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch all characters' });
    }
});

// DELETE /api/admin/characters/:userId
router.delete('/characters/:userId', async (req, res) => {
    try {
        await pool.query('DELETE FROM characters WHERE user_id = $1', [req.params.userId]);
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete character' });
    }
});

router.post('/characters/:userId/reset-stats', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const correctTotalPoints = 10 + (character.level - 1);

        character.stats.strength = 0;
        character.stats.agility = 0;
        character.stats.accuracy = 0;
        character.stats.stamina = 0;
        character.stats.intelligence = 0;
        character.stats.energy = 0;
        character.stats.luck = 0;
        character.stats.statPoints = correctTotalPoints;
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to reset stats' });
    } finally {
        client.release();
    }
});

// HARD RESET
router.post('/characters/:userId/reset-progress', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        
        const oldChar: PlayerCharacter = charRes.rows[0].data;
        
        const initialStats: CharacterStats = {
          strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0,
          statPoints: 10,
          currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10,
          currentMana: 20, maxMana: 20,
          minDamage: 0, maxDamage: 0,
          magicDamageMin: 0, magicDamageMax: 0,
          critChance: 0,
          critDamageModifier: 200,
          armor: 0,
          armorPenetrationPercent: 0,
          armorPenetrationFlat: 0,
          attacksPerRound: 1,
          manaRegen: 0,
          lifeStealPercent: 0,
          lifeStealFlat: 0,
          manaStealPercent: 0,
          manaStealFlat: 0,
          dodgeChance: 0,
        };

        const newChar: PlayerCharacter = {
            name: oldChar.name,
            race: oldChar.race,
            settings: oldChar.settings || { language: Language.PL },
            characterClass: null,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: initialStats,
            resources: { gold: 500, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            currentLocationId: oldChar.currentLocationId, 
            activeExpedition: null,
            activeTravel: null,
            camp: { level: 1 },
            chest: { level: 1, gold: 0 },
            backpack: { level: 1 },
            isResting: false,
            restStartHealth: 0,
            lastRestTime: undefined,
            lastEnergyUpdateTime: Date.now(),
            equipment: { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            inventory: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0,
            learnedSkills: [],
            questProgress: [],
            acceptedQuests: [],
            freeStatResetUsed: false,
            guildId: oldChar.guildId,
        };
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [newChar, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to reset progress' });
    } finally {
        client.release();
    }
});

// SOFT RESET (Repair)
router.post('/characters/:userId/soft-reset', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        
        const oldChar: PlayerCharacter = charRes.rows[0].data;
        
        const initialStats: CharacterStats = {
          strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0,
          statPoints: 10, 
          currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10,
          currentMana: 20, maxMana: 20,
          minDamage: 0, maxDamage: 0,
          magicDamageMin: 0, magicDamageMax: 0,
          critChance: 0,
          critDamageModifier: 200,
          armor: 0,
          armorPenetrationPercent: 0,
          armorPenetrationFlat: 0,
          attacksPerRound: 1,
          manaRegen: 0,
          lifeStealPercent: 0,
          lifeStealFlat: 0,
          manaStealPercent: 0,
          manaStealFlat: 0,
          dodgeChance: 0,
        };

        const fixedChar: PlayerCharacter = {
            // Identity
            name: oldChar.name || 'Unknown Hero',
            race: oldChar.race || 'Human' as any,
            username: oldChar.username,
            id: oldChar.id,
            
            // Reset Progression
            characterClass: null,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: initialStats,
            
            // Keep Resources/Items
            resources: oldChar.resources || { gold: 500, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            inventory: Array.isArray(oldChar.inventory) ? oldChar.inventory : [],
            equipment: oldChar.equipment || { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            
            // Reset World State
            currentLocationId: 'village',
            activeExpedition: null,
            activeTravel: null,
            isResting: false,
            
            // Keep Buildings
            camp: oldChar.camp || { level: 1 },
            chest: oldChar.chest || { level: 1, gold: 0 },
            backpack: oldChar.backpack || { level: 1 },
            
            // Keep Social
            guildId: oldChar.guildId,
            
            // Reset combat counters
            pvpWins: oldChar.pvpWins || 0,
            pvpLosses: oldChar.pvpLosses || 0,
            pvpProtectionUntil: 0,
            
            questProgress: oldChar.questProgress || [],
            acceptedQuests: oldChar.acceptedQuests || [],
            
            learnedSkills: oldChar.learnedSkills || [],
            activeSkills: [], 
            settings: oldChar.settings || { language: Language.PL },
            
            lastEnergyUpdateTime: Date.now(),
            restStartHealth: 0
        };
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [fixedChar, req.params.userId]);
        await client.query('COMMIT');
        res.json({ message: 'Postać naprawiona (Soft Reset)', character: fixedChar });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to repair character: ' + err.message });
    } finally {
        client.release();
    }
});

router.post('/characters/:userId/heal', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
             return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        character.stats.currentHealth = character.stats.maxHealth;
        character.stats.currentMana = character.stats.maxMana;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to heal character' });
    } finally {
        client.release();
    }
});

router.post('/character/:userId/update-gold', async (req, res) => {
    const { gold } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;
        character.resources.gold = Number(gold);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to update gold' });
    } finally {
        client.release();
    }
});

// Update Details (Race, Class, Level)
router.post('/character/:userId/update-details', async (req, res) => {
    const { race, characterClass, level } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        
        let character: PlayerCharacter = charRes.rows[0].data;
        let statsUpdated = false;

        if (race) {
            character.race = race;
        }

        if (characterClass !== undefined) {
            character.characterClass = characterClass || null;
        }

        if (level !== undefined && level !== character.level) {
            const newLevel = Math.max(1, Number(level));
            character.level = newLevel;
            character.experience = 0; 
            character.experienceToNextLevel = Math.floor(100 * Math.pow(newLevel, 1.3));

            const expectedTotalPoints = 10 + (newLevel - 1);
            
            character.stats.strength = 0;
            character.stats.agility = 0;
            character.stats.accuracy = 0;
            character.stats.stamina = 0;
            character.stats.intelligence = 0;
            character.stats.energy = 0;
            character.stats.luck = 0;
            
            character.stats.statPoints = expectedTotalPoints;
            
            character.stats.currentHealth = 50;
            character.stats.maxHealth = 50;
            character.stats.currentMana = 20;
            character.stats.maxMana = 20;

            statsUpdated = true;
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        
        res.json({ message: 'Character details updated', statsReset: statsUpdated });
    } catch(err: any) {
        await client.query('ROLLBACK');
        console.error("Update details error:", err);
        res.status(500).json({ message: 'Failed to update details: ' + err.message });
    } finally {
        client.release();
    }
});

router.post('/characters/:userId/regenerate-energy', async (req, res) => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        character.stats.currentEnergy = character.stats.maxEnergy;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to regenerate energy' });
    } finally {
        client.release();
    }
});

router.get('/characters/:userId/inspect', async (req, res) => {
    try {
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        res.json(charRes.rows[0].data);
    } catch(err) {
        res.status(500).json({ message: 'Failed to inspect character' });
    }
});

// ==========================================
//               ITEMS & GIVING
// ==========================================

router.post('/give-item', async (req: any, res: any) => {
    const { userId, templateId, prefixId, suffixId, upgradeLevel } = req.body;

    if (!userId || !templateId) {
        return res.status(400).json({ message: 'User ID and Template ID are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const template = itemTemplates.find(t => t.id === templateId);
        if (!template) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid Template ID' });
        }

        const newItem: ItemInstance = {
            uniqueId: randomUUID(),
            templateId: template.id,
            rolledBaseStats: rollTemplateStats(template, 1000) 
        };

        if (prefixId) {
            const prefix = affixes.find(a => a.id === prefixId);
            if (prefix) {
                newItem.prefixId = prefix.id;
                newItem.rolledPrefix = rollAffixStats(prefix, 1000);
            }
        }

        if (suffixId) {
            const suffix = affixes.find(a => a.id === suffixId);
            if (suffix) {
                newItem.suffixId = suffix.id;
                newItem.rolledSuffix = rollAffixStats(suffix, 1000);
            }
        }

        if (upgradeLevel > 0) {
            newItem.upgradeLevel = Math.min(Math.max(0, upgradeLevel), 10);
        }

        if (!character.inventory) character.inventory = [];
        character.inventory.push(newItem);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, userId]);
        await client.query('COMMIT');

        res.json({ message: 'Item sent successfully', item: newItem });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Admin Give Item Error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.delete('/characters/:userId/items/:itemUniqueId', async (req, res) => {
    const { userId, itemUniqueId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        const initialInventoryLength = character.inventory.length;
        character.inventory = character.inventory.filter(item => item.uniqueId !== itemUniqueId);
        
        let found = initialInventoryLength > character.inventory.length;

        if (!found) {
            for (const slot in character.equipment) {
                if (character.equipment[slot as keyof typeof character.equipment]?.uniqueId === itemUniqueId) {
                    character.equipment[slot as keyof typeof character.equipment] = null;
                    found = true;
                    break;
                }
            }
        }
        
        if (!found) {
             return res.status(404).json({ message: 'Item not found on character' });
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to delete item' });
    } finally {
        client.release();
    }
});

router.get('/find-item/:uniqueId', async (req, res) => {
    const { uniqueId } = req.params;
    try {
        const charsRes = await pool.query("SELECT user_id, data FROM characters");
        const templatesRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates = templatesRes.rows[0]?.data || [];

        let foundItem: ItemInstance | null = null;
        let foundTemplate: any = null;
        const locations: ItemSearchResult['locations'] = [];

        for (const row of charsRes.rows) {
            const char: PlayerCharacter = row.data;
            
            char.inventory?.forEach((item, idx) => {
                if (item && item.uniqueId === uniqueId) {
                    foundItem = item;
                    locations.push({
                        ownerName: char.name,
                        userId: row.user_id,
                        location: `inventory[${idx}]`
                    });
                }
            });

            if (char.equipment) {
                Object.entries(char.equipment).forEach(([slot, item]) => {
                    if (item && item.uniqueId === uniqueId) {
                        foundItem = item;
                        locations.push({
                            ownerName: char.name,
                            userId: row.user_id,
                            location: `equipment.${slot}`
                        });
                    }
                });
            }
        }

        const marketRes = await pool.query("SELECT id, seller_id, item_data FROM market_listings WHERE item_data->>'uniqueId' = $1", [uniqueId]);
        for(const row of marketRes.rows) {
             foundItem = row.item_data;
             const sellerRes = await pool.query("SELECT username FROM users WHERE id = $1", [row.seller_id]);
             const sellerName = sellerRes.rows[0]?.username || 'Unknown';
             locations.push({
                 ownerName: sellerName,
                 userId: row.seller_id,
                 location: `market_listing[${row.id}]`
             });
        }

        if (foundItem) {
            foundTemplate = templates.find((t: any) => t.id === (foundItem as any).templateId);
            res.json({
                item: foundItem,
                template: foundTemplate,
                locations
            });
        } else {
            res.status(404).json({ message: 'Item not found' });
        }

    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
//                 AUDITS
// ==========================================

router.get('/audit/duplicates', async (req, res) => {
    try {
        const charsRes = await pool.query("SELECT user_id, data FROM characters");
        const templatesRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates = templatesRes.rows[0]?.data || [];

        const itemMap = new Map<string, any[]>();

        for (const row of charsRes.rows) {
            const char: PlayerCharacter = row.data;
            const userId = row.user_id;
            const ownerName = char.name;

            if (char.inventory) {
                char.inventory.forEach((item, idx) => {
                    if (!item) return;
                    const ref = {
                        uniqueId: item.uniqueId,
                        templateId: item.templateId,
                        userId,
                        ownerName,
                        location: `inventory[${idx}]`
                    };
                    const existing = itemMap.get(item.uniqueId) || [];
                    existing.push(ref);
                    itemMap.set(item.uniqueId, existing);
                });
            }

            if (char.equipment) {
                Object.entries(char.equipment).forEach(([slot, item]) => {
                    if (item) {
                        const ref = {
                            uniqueId: item.uniqueId,
                            templateId: item.templateId,
                            userId,
                            ownerName,
                            location: `equipment.${slot}`
                        };
                        const existing = itemMap.get(item.uniqueId) || [];
                        existing.push(ref);
                        itemMap.set(item.uniqueId, existing);
                    }
                });
            }
        }

        const duplicates: DuplicationAuditResult[] = [];
        for (const [uniqueId, refs] of itemMap.entries()) {
            if (refs.length > 1) {
                const template = templates.find((t: any) => t.id === refs[0].templateId);
                const itemName = template ? template.name : 'Unknown Item';
                const gender = template ? template.gender : 'Masculine';

                duplicates.push({
                    uniqueId,
                    templateId: refs[0].templateId,
                    itemName,
                    gender,
                    instances: refs.map(r => ({
                        ownerName: r.ownerName,
                        location: r.location,
                        userId: r.userId
                    }))
                });
            }
        }

        res.json(duplicates);
    } catch (err: any) {
        console.error("Audit duplicates failed", err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/resolve-duplicates', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charsRes = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        const itemMap = new Map<string, any[]>();
        const charDataMap = new Map<number, PlayerCharacter>();

        for (const row of charsRes.rows) {
            const char: PlayerCharacter = row.data;
            const userId = row.user_id;
            const ownerName = char.name;
            charDataMap.set(userId, char);

            if (char.inventory) {
                char.inventory.forEach((item, idx) => {
                    if (!item) return;
                    itemMap.get(item.uniqueId)?.push({
                        uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'inventory', index: idx, item
                    }) || itemMap.set(item.uniqueId, [{
                        uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'inventory', index: idx, item
                    }]);
                });
            }

            if (char.equipment) {
                Object.entries(char.equipment).forEach(([slot, item]) => {
                    if (item) {
                        itemMap.get(item.uniqueId)?.push({
                            uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'equipment', slot, item
                        }) || itemMap.set(item.uniqueId, [{
                            uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'equipment', slot, item
                        }]);
                    }
                });
            }
        }

        let resolvedSets = 0;
        let itemsDeleted = 0;
        const usersToUpdate = new Set<number>();

        for (const [uniqueId, refs] of itemMap.entries()) {
            if (refs.length > 1) {
                resolvedSets++;
                const toRemove = refs.slice(1);

                for (const removeRef of toRemove) {
                    const char = charDataMap.get(removeRef.userId);
                    if (!char) continue;

                    if (removeRef.location === 'inventory' && typeof removeRef.index === 'number') {
                        char.inventory = char.inventory.filter(i => i.uniqueId !== uniqueId);
                    } else if (removeRef.location === 'equipment' && removeRef.slot) {
                        (char.equipment as any)[removeRef.slot] = null;
                    }
                    itemsDeleted++;
                    usersToUpdate.add(removeRef.userId);
                }
            }
        }

        for (const userId of usersToUpdate) {
            const char = charDataMap.get(userId);
            await client.query("UPDATE characters SET data = $1 WHERE user_id = $2", [char, userId]);
        }

        await client.query('COMMIT');
        res.json({ resolvedSets, itemsDeleted });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Resolve duplicates failed", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.get('/audit/orphans', async (req, res) => {
    try {
        const charsRes = await pool.query("SELECT user_id, data FROM characters");
        const templatesRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates = templatesRes.rows[0]?.data || [];
        const validTemplateIds = new Set(templates.map((t: any) => t.id));

        const orphansResults: OrphanAuditResult[] = [];

        for (const row of charsRes.rows) {
            const char: PlayerCharacter = row.data;
            const orphans: any[] = [];

            char.inventory?.forEach((item, idx) => {
                if (item && !validTemplateIds.has(item.templateId)) {
                    orphans.push({
                        uniqueId: item.uniqueId,
                        templateId: item.templateId,
                        location: `inventory[${idx}]`
                    });
                }
            });

            if (char.equipment) {
                Object.entries(char.equipment).forEach(([slot, item]) => {
                    if (item && !validTemplateIds.has(item.templateId)) {
                        orphans.push({
                            uniqueId: item.uniqueId,
                            templateId: item.templateId,
                            location: `equipment.${slot}`
                        });
                    }
                });
            }

            if (orphans.length > 0) {
                orphansResults.push({
                    characterName: char.name,
                    userId: row.user_id,
                    orphans
                });
            }
        }

        res.json(orphansResults);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/resolve-orphans', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charsRes = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        const templatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates = templatesRes.rows[0]?.data || [];
        const validTemplateIds = new Set(templates.map((t: any) => t.id));

        let charactersAffected = 0;
        let itemsRemoved = 0;

        for (const row of charsRes.rows) {
            let char: PlayerCharacter = row.data;
            let modified = false;

            const initialInvCount = char.inventory?.length || 0;
            char.inventory = (char.inventory || []).filter(item => item && validTemplateIds.has(item.templateId));
            if (char.inventory.length !== initialInvCount) {
                itemsRemoved += (initialInvCount - char.inventory.length);
                modified = true;
            }

            if (char.equipment) {
                Object.entries(char.equipment).forEach(([slot, item]) => {
                    if (item && !validTemplateIds.has(item.templateId)) {
                        (char.equipment as any)[slot] = null;
                        itemsRemoved++;
                        modified = true;
                    }
                });
            }

            if (modified) {
                await client.query("UPDATE characters SET data = $1 WHERE user_id = $2", [char, row.user_id]);
                charactersAffected++;
            }
        }

        await client.query('COMMIT');
        res.json({ charactersAffected, itemsRemoved });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// Audit Fix Character Data (Structure)
router.post('/audit/fix-characters', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        let fixed = 0;
        
        for (const row of result.rows) {
            let character = row.data as PlayerCharacter;
            let needsUpdate = false;
            
            if (!character.race || character.race === 'race.null' as any) {
                character.race = 'Human' as any;
                needsUpdate = true;
            }
            
            if (!character.resources) { character.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 }; needsUpdate = true; }
            if (!character.camp) { character.camp = { level: 1 }; needsUpdate = true; }
            if (!character.chest) { character.chest = { level: 1, gold: 0 }; needsUpdate = true; }
            if (!character.backpack) { character.backpack = { level: 1 }; needsUpdate = true; }
            
            if (!character.stats || isNaN(Number(character.stats.maxHealth)) || character.stats.maxHealth <= 0) {
                 if(!character.stats) {
                      character.stats = {
                        strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0, statPoints: 10 + (character.level - 1),
                        currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10, currentMana: 20, maxMana: 20,
                        minDamage: 0, maxDamage: 0, magicDamageMin: 0, magicDamageMax: 0, critChance: 0, critDamageModifier: 200, armor: 0, armorPenetrationPercent: 0, armorPenetrationFlat: 0,
                        attacksPerRound: 1, manaRegen: 0, lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0, dodgeChance: 0
                    };
                 } else {
                     character.stats.maxHealth = Math.max(50, Number(character.stats.maxHealth) || 50);
                     character.stats.currentHealth = Math.min(character.stats.currentHealth, character.stats.maxHealth);
                 }
                 needsUpdate = true;
            }

            if (needsUpdate) {
                await client.query("UPDATE characters SET data = $1 WHERE user_id = $2", [character, row.user_id]);
                fixed++;
            }
        }
        await client.query('COMMIT');
        res.json({ checked: result.rows.length, fixed });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to run character audit' });
    } finally {
        client.release();
    }
});

// Audit Fix Gold
router.post('/audit/fix-gold', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        let fixed = 0;
        for (const row of result.rows) {
            let character = row.data as PlayerCharacter;
            let needsUpdate = false;

            if (!character.resources) {
                character.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
                needsUpdate = true;
            }

            const currentGold = character.resources.gold;
            if (currentGold == null || isNaN(Number(currentGold))) {
                character.resources.gold = 0;
                needsUpdate = true;
            } else {
                const numericGold = Number(currentGold);
                if (character.resources.gold !== numericGold) {
                    character.resources.gold = numericGold;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await client.query("UPDATE characters SET data = $1 WHERE user_id = $2", [character, row.user_id]);
                fixed++;
            }
        }
        await client.query('COMMIT');
        res.json({ checked: result.rows.length, fixed });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to run gold audit' });
    } finally {
        client.release();
    }
});

// Audit Fix Values
router.post('/audit/fix-values', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const itemsRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates' FOR UPDATE");
        let itemsFixed = 0;
        let itemsChecked = 0;
        if (itemsRes.rows.length > 0) {
            let itemTemplates = itemsRes.rows[0].data as any[];
            itemsChecked = itemTemplates.length;
            itemTemplates.forEach(item => {
                const currentValue = Number(item.value);
                if (isNaN(currentValue) || currentValue <= 0) {
                    item.value = 10;
                    itemsFixed++;
                }
            });
            if (itemsFixed > 0) {
                await client.query("UPDATE game_data SET data = $1 WHERE key = 'itemTemplates'", [JSON.stringify(itemTemplates)]);
            }
        }

        const affixesRes = await client.query("SELECT data FROM game_data WHERE key = 'affixes' FOR UPDATE");
        let affixesFixed = 0;
        let affixesChecked = 0;
        if (affixesRes.rows.length > 0) {
            let affixes = affixesRes.rows[0].data as any[];
            affixesChecked = affixes.length;
            affixes.forEach(affix => {
                const currentValue = Number(affix.value);
                if (isNaN(currentValue) || currentValue <= 0) {
                    affix.value = 10;
                    affixesFixed++;
                }
            });
            if (affixesFixed > 0) {
                await client.query("UPDATE game_data SET data = $1 WHERE key = 'affixes'", [JSON.stringify(affixes)]);
            }
        }

        await client.query('COMMIT');
        res.json({ itemsChecked, itemsFixed, affixesChecked, affixesFixed });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to run values audit' });
    } finally {
        client.release();
    }
});

// Audit Fix Attributes
router.post('/audit/fix-attributes', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        let fixed = 0;
        
        for (const row of result.rows) {
            let character = row.data as PlayerCharacter;
            const level = character.level || 1;
            
            const expectedTotal = 10 + (level - 1);
            
            const currentTotal = (Number(character.stats.strength) || 0) +
                                 (Number(character.stats.agility) || 0) +
                                 (Number(character.stats.accuracy) || 0) +
                                 (Number(character.stats.stamina) || 0) +
                                 (Number(character.stats.intelligence) || 0) +
                                 (Number(character.stats.energy) || 0) +
                                 (Number(character.stats.luck) || 0) +
                                 (Number(character.stats.statPoints) || 0);

            if (currentTotal > expectedTotal) {
                character.stats.strength = 0;
                character.stats.agility = 0;
                character.stats.accuracy = 0;
                character.stats.stamina = 0;
                character.stats.intelligence = 0;
                character.stats.energy = 0;
                character.stats.luck = 0;
                character.stats.statPoints = expectedTotal;
                
                await client.query("UPDATE characters SET data = $1 WHERE user_id = $2", [character, row.user_id]);
                fixed++;
            }
        }
        
        await client.query('COMMIT');
        res.json({ checked: result.rows.length, fixed });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to run attributes audit' });
    } finally {
        client.release();
    }
});

// ==========================================
//               GENERAL / OTHER
// ==========================================

router.post('/hunting/reset', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM hunting_parties');
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to reset hunting parties' });
    } finally {
        client.release();
    }
});


router.post('/pvp/reset-cooldowns', async (req, res) => {
     try {
        await pool.query("UPDATE characters SET data = data || '{\"pvpProtectionUntil\": 0}'::jsonb");
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to reset PvP cooldowns' });
    }
});

router.post('/messages/global', async (req, res) => {
    const { subject, content } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const usersRes = await client.query('SELECT id FROM users');
        const body = JSON.stringify({ content });

        for (const user of usersRes.rows) {
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Administrator', 'system', $2, $3)`,
                [user.id, subject, body]
            );
        }
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to send global message' });
    } finally {
        client.release();
    }
});

router.post('/wipe-game-data', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE characters, messages, market_listings, market_bids, hunting_parties, tavern_messages, tavern_presence, guilds, guild_members, guild_invites, guild_bank_history, guild_chat, guild_armory_items, guild_raids RESTART IDENTITY');
        await client.query('COMMIT');
        res.json({ message: 'All game-related data has been wiped.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to wipe game data' });
    } finally {
        client.release();
    }
});

// ==========================================
//               DB EDITOR
// ==========================================

router.get('/db/tables', async (req, res) => {
     try {
        const result = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'");
        res.json(result.rows.map(r => r.tablename));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tables' });
    }
});

router.get('/db/table/:tableName', async (req, res) => {
    const tableName = req.params.tableName;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        const tablesResult = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        const validTables = tablesResult.rows.map(r => r.tablename);
        if (!validTables.includes(tableName)) {
             return res.status(400).json({ message: 'Invalid table name' });
        }

        const countRes = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        const total = parseInt(countRes.rows[0].count);

        const dataRes = await pool.query(`SELECT * FROM ${tableName} LIMIT $1 OFFSET $2`, [limit, offset]);
        
        res.json({ rows: dataRes.rows, total });

    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch table data' });
    }
});

router.put('/db/table/:tableName', async (req, res) => {
    const tableName = req.params.tableName;
    const rowData = req.body;
    
    try {
        const tablesResult = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        if (!tablesResult.rows.map(r => r.tablename).includes(tableName)) {
             return res.status(400).json({ message: 'Invalid table name' });
        }

        let pkCol = 'id';
        if (tableName === 'characters') pkCol = 'user_id';
        if (tableName === 'sessions') pkCol = 'token';
        if (tableName === 'game_data') pkCol = 'key';

        const pkValue = rowData[pkCol];
        if (!pkValue) return res.status(400).json({ message: 'Primary key missing in update data' });

        const keys = Object.keys(rowData).filter(k => k !== pkCol);
        const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const values = keys.map(k => rowData[k]);
        
        await pool.query(`UPDATE ${tableName} SET ${setClause} WHERE ${pkCol} = $1`, [pkValue, ...values]);
        res.json({ message: 'Updated' });

    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/db/table/:tableName', async (req, res) => {
    const tableName = req.params.tableName;
    const { primaryKeyValue } = req.body;

    try {
        const tablesResult = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        if (!tablesResult.rows.map(r => r.tablename).includes(tableName)) {
             return res.status(400).json({ message: 'Invalid table name' });
        }

        let pkCol = 'id';
        if (tableName === 'characters') pkCol = 'user_id';
        if (tableName === 'sessions') pkCol = 'token';
        if (tableName === 'game_data') pkCol = 'key';
        
        await pool.query(`DELETE FROM ${tableName} WHERE ${pkCol} = $1`, [primaryKeyValue]);
        res.json({ message: 'Deleted' });

    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
