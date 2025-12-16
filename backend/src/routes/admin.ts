
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, Race, EssenceType, ItemInstance } from '../types.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';
import { enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// Middleware: Check if user is Admin (Kazujoshi)
const checkAdmin = async (req: any, res: any, next: any) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length === 0 || userRes.rows[0].username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: 'Auth check failed' });
    }
};

router.use(authenticateToken, checkAdmin);

// ==========================================
//               GLOBAL STATS
// ==========================================

router.get('/stats/global', async (req: any, res: any) => {
    try {
        const client = await pool.connect();
        try {
            // 1. Race & Class Counts & Economy
            const demographicsRes = await client.query(`
                SELECT 
                    COALESCE(data->>'race', 'Unknown') as race,
                    COALESCE(data->>'characterClass', 'Novice') as "characterClass",
                    COALESCE((data->'resources'->>'gold')::bigint, 0) as gold,
                    COUNT(*) as count
                FROM characters
                GROUP BY data->>'race', data->>'characterClass', data->'resources'->>'gold'
            `);

            const raceCounts: Record<string, number> = {};
            const classCounts: Record<string, number> = {};
            let totalPlayers = 0;
            let totalGoldInEconomy = 0;

            demographicsRes.rows.forEach(row => {
                const count = parseInt(row.count, 10);
                const gold = parseInt(row.gold, 10) || 0;
                
                raceCounts[row.race] = (raceCounts[row.race] || 0) + count;
                classCounts[row.characterClass] = (classCounts[row.characterClass] || 0) + count;
                
                totalPlayers += count;
                totalGoldInEconomy += (gold * count); // Approx if grouped, or exact if rows are unique per gold val
            });
            
            // Re-calculate total gold accurately without grouping interference
            const goldRes = await client.query(`SELECT SUM(COALESCE((data->'resources'->>'gold')::bigint, 0)) as total_gold FROM characters`);
            totalGoldInEconomy = parseInt(goldRes.rows[0].total_gold || '0', 10);

            // 2. Item & Affix Popularity (Aggregating Inventory + Equipment)
            // Using LATERAL and COALESCE for safety against null JSON fields
            const popularityRes = await client.query(`
                WITH all_items AS (
                    -- Inventory items (Handle null inventory)
                    SELECT value as item_data 
                    FROM characters, 
                    LATERAL jsonb_array_elements(COALESCE(data->'inventory', '[]'::jsonb))
                    
                    UNION ALL
                    
                    -- Equipment items (Handle null equipment and null slots)
                    SELECT value as item_data 
                    FROM characters, 
                    LATERAL jsonb_each(COALESCE(data->'equipment', '{}'::jsonb))
                    WHERE jsonb_typeof(value) != 'null'
                )
                SELECT 
                    item_data->>'templateId' as "templateId",
                    item_data->>'prefixId' as "prefixId",
                    item_data->>'suffixId' as "suffixId"
                FROM all_items
            `);

            const itemCounts: Record<string, number> = {};
            const affixCounts: Record<string, number> = {};

            popularityRes.rows.forEach(row => {
                // Count Item Templates
                if (row.templateId) {
                    itemCounts[row.templateId] = (itemCounts[row.templateId] || 0) + 1;
                }
                // Count Affixes (Prefix)
                if (row.prefixId) {
                    affixCounts[row.prefixId] = (affixCounts[row.prefixId] || 0) + 1;
                }
                // Count Affixes (Suffix)
                if (row.suffixId) {
                    affixCounts[row.suffixId] = (affixCounts[row.suffixId] || 0) + 1;
                }
            });

            // Sort and limit results for frontend
            const topItems = Object.entries(itemCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50)
                .map(([id, count]) => ({ id, count }));

            const topAffixes = Object.entries(affixCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50)
                .map(([id, count]) => ({ id, count }));

            res.json({
                totalPlayers,
                totalGoldInEconomy,
                raceCounts,
                classCounts,
                topItems,
                topAffixes
            });

        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Global Stats Error:", err);
        res.status(500).json({ message: 'Failed to fetch global stats' });
    }
});

// ==========================================
//               USERS & CHARACTERS
// ==========================================

router.get('/characters/all', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT c.user_id, u.username, c.data 
            FROM characters c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.user_id ASC
        `);
        
        const mapped = result.rows.map(row => ({
            user_id: row.user_id,
            username: row.username,
            name: row.data.name,
            race: row.data.race,
            characterClass: row.data.characterClass,
            level: row.data.level,
            gold: row.data.resources?.gold || 0
        }));
        
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch characters' });
    }
});

router.delete('/characters/:id', async (req: any, res: any) => {
    try {
        await pool.query('DELETE FROM characters WHERE user_id = $1', [req.params.id]);
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ message: 'Character and user deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to delete character' });
    }
});

router.post('/characters/:id/heal', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        
        const char = result.rows[0].data;
        char.stats.currentHealth = char.stats.maxHealth;
        char.stats.currentMana = char.stats.maxMana;
        
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        res.json({ message: 'Healed' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

router.post('/characters/:id/regenerate-energy', async (req: any, res: any) => {
    const userId = req.params.id;
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
            if (charRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Character not found' });
            }

            const char: PlayerCharacter = charRes.rows[0].data;

            // Fetch game data to properly calculate max energy
            const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
            const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

            // Calculate derived stats to ensure maxEnergy is correct based on stats/items
            const derivedChar = calculateDerivedStatsOnServer(char, itemTemplates, affixes);
            const maxEnergy = derivedChar.stats.maxEnergy || 10;

            char.stats.currentEnergy = maxEnergy;
            
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
            await client.query('COMMIT');
            
            res.json({ message: 'Energy regenerated', currentEnergy: maxEnergy });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error regenerating energy' });
    }
});

router.post('/characters/:id/reset-stats', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        
        const char = result.rows[0].data;
        // Reset Logic: 20 base + 2 per level (excluding base level 1)
        const totalPoints = 20 + (char.level - 1) * 2;
        char.stats.strength = 0;
        char.stats.agility = 0;
        char.stats.accuracy = 0;
        char.stats.stamina = 0;
        char.stats.intelligence = 0;
        char.stats.energy = 0;
        char.stats.luck = 0;
        char.stats.statPoints = totalPoints;

        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        res.json({ message: 'Stats reset' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

router.post('/characters/:id/reset-progress', async (req: any, res: any) => {
    try {
        const userId = req.params.id;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Not found' });
            }
            
            const oldChar = result.rows[0].data;
            
            // Hard Reset to default level 1 state
            const resetChar: PlayerCharacter = {
                ...oldChar,
                level: 1,
                experience: 0,
                experienceToNextLevel: 100,
                stats: {
                    strength: 1, agility: 1, accuracy: 1, stamina: 1, intelligence: 1, energy: 1, luck: 1, statPoints: 20, // Updated to 20
                    currentHealth: 50, maxHealth: 50, currentMana: 20, maxMana: 20, currentEnergy: 10, maxEnergy: 10,
                    minDamage: 1, maxDamage: 2, magicDamageMin: 0, magicDamageMax: 0,
                    armor: 0, critChance: 0, critDamageModifier: 200, attacksPerRound: 1, dodgeChance: 0, manaRegen: 0,
                    armorPenetrationPercent: 0, armorPenetrationFlat: 0, lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0
                },
                resources: { gold: 100, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
                equipment: { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
                inventory: [],
                activeTravel: null,
                activeExpedition: null,
                isResting: false,
                backpack: { level: 1 },
                camp: { level: 1 },
                treasury: { level: 1, gold: 0 },
                warehouse: { level: 1, items: [] },
                acceptedQuests: [],
                questProgress: [],
                learnedSkills: [],
                activeSkills: [],
                pvpWins: 0,
                pvpLosses: 0,
                pvpProtectionUntil: 0,
                characterClass: undefined, // Reset class
                activeTowerRun: undefined
            };

            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(resetChar), userId]);
            await client.query('COMMIT');
            
            res.json({ message: 'Progress hard reset successful' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error resetting progress' });
    }
});

router.post('/character/:id/update-details', async (req: any, res: any) => {
    const { name, race, characterClass, level } = req.body;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        const char = result.rows[0].data;
        
        if (name) char.name = name;
        if (race) char.race = race;
        if (characterClass !== undefined) char.characterClass = characterClass || null;
        if (level) {
            char.level = level;
            char.experience = 0;
            char.experienceToNextLevel = Math.floor(100 * Math.pow(level, 1.3));
            // Recalculate stat points roughly
            const spentPoints = char.stats.strength + char.stats.agility + char.stats.accuracy + char.stats.stamina + char.stats.intelligence + char.stats.energy + char.stats.luck;
            // Updated formula: 20 + 2 per level
            const totalShouldBe = 20 + (level - 1) * 2;
            if (spentPoints > totalShouldBe) {
                // If level down, force reset stats to avoid negative points
                char.stats.strength = 0; char.stats.agility = 0; char.stats.accuracy = 0; char.stats.stamina = 0;
                char.stats.intelligence = 0; char.stats.energy = 0; char.stats.luck = 0;
                char.stats.statPoints = totalShouldBe;
            } else {
                char.stats.statPoints = totalShouldBe - spentPoints;
            }
        }

        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating details' });
    }
});

router.post('/character/:id/update-gold', async (req: any, res: any) => {
    const { gold } = req.body;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        const char = result.rows[0].data;
        char.resources.gold = gold;
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        res.json({ message: 'Gold updated' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

router.post('/users/:id/password', async (req: any, res: any) => {
    const { newPassword } = req.body;
    // Note: In real app, import hashPassword from helpers
    const { hashPassword } = await import('../logic/helpers.js');
    
    try {
        const { salt, hash } = hashPassword(newPassword);
        await pool.query('UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3', [hash, salt, req.params.id]);
        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

router.get('/characters/:id/inspect', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(result.rows[0].data);
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// ==========================================
//               AUDITS
// ==========================================

router.get('/audit/duplicates', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT user_id, data FROM characters');
        const itemMap = new Map<string, any[]>();

        result.rows.forEach(row => {
            const char = row.data;
            const items = [...(char.inventory || []), ...Object.values(char.equipment || {})].filter(i => i);
            
            items.forEach((item: any) => {
                if (!item.uniqueId) return;
                if (!itemMap.has(item.uniqueId)) {
                    itemMap.set(item.uniqueId, []);
                }
                itemMap.get(item.uniqueId)?.push({
                    userId: row.user_id,
                    ownerName: char.name,
                    location: 'inventory/equipment',
                    templateId: item.templateId
                });
            });
        });

        // Check Market
        const marketRes = await pool.query(`SELECT m.id, m.seller_id, m.item_data, c.data->>'name' as name FROM market_listings m JOIN characters c ON m.seller_id = c.user_id WHERE status = 'ACTIVE'`);
        marketRes.rows.forEach(row => {
            const item = row.item_data;
            if (item && item.uniqueId) {
                if (!itemMap.has(item.uniqueId)) itemMap.set(item.uniqueId, []);
                itemMap.get(item.uniqueId)?.push({
                    userId: row.seller_id,
                    ownerName: row.name,
                    location: `market_listing_${row.id}`,
                    templateId: item.templateId
                });
            }
        });

        const duplicates = [];
        for (const [uniqueId, instances] of itemMap.entries()) {
            if (instances.length > 1) {
                // Get item name for display
                const gameDataRes = await pool.query(`SELECT data FROM game_data WHERE key = 'itemTemplates'`);
                const templates = gameDataRes.rows[0]?.data || [];
                const template = templates.find((t: any) => t.id === instances[0].templateId);
                
                duplicates.push({
                    uniqueId,
                    itemName: template?.name || 'Unknown Item',
                    templateId: instances[0].templateId,
                    instances
                });
            }
        }

        res.json(duplicates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Audit failed' });
    }
});

router.post('/resolve-duplicates', async (req: any, res: any) => {
    try {
        await pool.query('BEGIN');
        console.log("Resolving duplicates triggered (Placeholder logic)");
        await pool.query('COMMIT');
        res.json({ resolvedSets: 0, itemsDeleted: 0 });
    } catch (e) {
        await pool.query('ROLLBACK');
        res.status(500).json({ message: 'Failed' });
    }
});

router.post('/audit/fix-characters', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT user_id, data FROM characters');
        let fixedCount = 0;
        
        for (const row of result.rows) {
            let char = row.data;
            let modified = false;

            if (!char.resources) { char.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 }; modified = true; }
            if (!char.camp) { char.camp = { level: 1 }; modified = true; }
            if (!char.chest) { char.chest = { level: 1, gold: 0 }; modified = true; }
            if (!char.backpack) { char.backpack = { level: 1 }; modified = true; }
            if (!char.questProgress) { char.questProgress = []; modified = true; }
            if (!char.acceptedQuests) { char.acceptedQuests = []; modified = true; }
            if (!char.learnedSkills) { char.learnedSkills = []; modified = true; }
            if (!char.activeSkills) { char.activeSkills = []; modified = true; }

            // Ensure numeric values
            if (typeof char.resources.gold !== 'number') { char.resources.gold = parseInt(char.resources.gold) || 0; modified = true; }

            if (modified) {
                await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                fixedCount++;
            }
        }
        res.json({ checked: result.rows.length, fixed: fixedCount });
    } catch (err) {
        res.status(500).json({ message: 'Audit failed' });
    }
});

// Fix Quests Audit
router.post('/audit/fix-quests', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT user_id, data FROM characters');
        const questsRes = await pool.query("SELECT data FROM game_data WHERE key = 'quests'");
        const validQuests: any[] = questsRes.rows[0]?.data || [];
        const validQuestIds = new Set(validQuests.map(q => q.id));

        let fixedCount = 0;

        for (const row of result.rows) {
            let char = row.data;
            let modified = false;

            // 1. Ensure arrays exist
            if (!Array.isArray(char.questProgress)) {
                char.questProgress = [];
                modified = true;
            }
            if (!Array.isArray(char.acceptedQuests)) {
                char.acceptedQuests = [];
                modified = true;
            }

            // 2. Filter out invalid IDs from acceptedQuests
            const originalAcceptedLength = char.acceptedQuests.length;
            char.acceptedQuests = char.acceptedQuests.filter((id: string) => validQuestIds.has(id));
            if (char.acceptedQuests.length !== originalAcceptedLength) modified = true;

            // 3. Filter out invalid questProgress entries
            const originalProgressLength = char.questProgress.length;
            char.questProgress = char.questProgress.filter((p: any) => validQuestIds.has(p.questId));
            if (char.questProgress.length !== originalProgressLength) modified = true;
            
            // 4. Clean up invalid progress objects (e.g. NaN)
            char.questProgress.forEach((p: any) => {
                if (typeof p.progress !== 'number' || isNaN(p.progress)) { p.progress = 0; modified = true; }
                if (typeof p.completions !== 'number' || isNaN(p.completions)) { p.completions = 0; modified = true; }
            });

            // 5. Sync: If in acceptedQuests, must be in questProgress
            char.acceptedQuests.forEach((qId: string) => {
                if (!char.questProgress.find((p: any) => p.questId === qId)) {
                    char.questProgress.push({ questId: qId, progress: 0, completions: 0 });
                    modified = true;
                }
            });

            // 6. Deduplicate
            char.acceptedQuests = Array.from(new Set(char.acceptedQuests));
            // Dedupe progress? Keep last or merge? Usually unique by ID.
            const uniqueProgressMap = new Map();
            char.questProgress.forEach((p: any) => uniqueProgressMap.set(p.questId, p));
            if (char.questProgress.length !== uniqueProgressMap.size) {
                 char.questProgress = Array.from(uniqueProgressMap.values());
                 modified = true;
            }

            if (modified) {
                await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                fixedCount++;
            }
        }
        res.json({ checked: result.rows.length, fixed: fixedCount });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: 'Audit failed: ' + err.message });
    }
});


// Fix Gold Audit
router.post('/audit/fix-gold', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT user_id, data FROM characters');
        let fixedCount = 0;

        for (const row of result.rows) {
            let char = row.data;
            let modified = false;
            
            if (char.resources) {
                if (typeof char.resources.gold !== 'number' || isNaN(char.resources.gold) || char.resources.gold < 0) {
                    const parsed = parseInt(char.resources.gold);
                    char.resources.gold = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                    modified = true;
                }
            } else {
                char.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
                modified = true;
            }

            if (modified) {
                await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                fixedCount++;
            }
        }
        res.json({ checked: result.rows.length, fixed: fixedCount });
    } catch (err) {
        res.status(500).json({ message: 'Audit failed' });
    }
});

// Fix Values Audit (Game Data)
router.post('/audit/fix-values', async (req: any, res: any) => {
    try {
        // Fix Items
        const itemsRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        let itemsFixed = 0;
        if (itemsRes.rows.length > 0) {
            const items: ItemTemplate[] = itemsRes.rows[0].data || [];
            let modified = false;
            items.forEach(item => {
                if (typeof item.value !== 'number') {
                    item.value = parseInt(item.value as any) || 0;
                    modified = true;
                    itemsFixed++;
                }
                if (typeof item.requiredLevel !== 'number') {
                    item.requiredLevel = parseInt(item.requiredLevel as any) || 1;
                    modified = true;
                }
            });
            if (modified) {
                await pool.query("UPDATE game_data SET data = $1 WHERE key = 'itemTemplates'", [JSON.stringify(items)]);
            }
        }

        // Fix Affixes
        const affixesRes = await pool.query("SELECT data FROM game_data WHERE key = 'affixes'");
        let affixesFixed = 0;
        if (affixesRes.rows.length > 0) {
            const affixes: Affix[] = affixesRes.rows[0].data || [];
            let modified = false;
            affixes.forEach(affix => {
                if (typeof affix.value !== 'number') {
                    affix.value = parseInt(affix.value as any) || 0;
                    modified = true;
                    affixesFixed++;
                }
            });
            if (modified) {
                await pool.query("UPDATE game_data SET data = $1 WHERE key = 'affixes'", [JSON.stringify(affixes)]);
            }
        }
        
        res.json({ itemsChecked: itemsRes.rows[0]?.data?.length || 0, itemsFixed, affixesChecked: affixesRes.rows[0]?.data?.length || 0, affixesFixed });
    } catch (err) {
        res.status(500).json({ message: 'Audit failed' });
    }
});

// Fix Attributes Audit
router.post('/audit/fix-attributes', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT user_id, data FROM characters');
        let fixedCount = 0;

        for (const row of result.rows) {
            let char = row.data as PlayerCharacter;
            if (!char.stats) continue;

            const stats = char.stats;
            // Updated Formula: 20 points base + 2 points per level beyond 1st
            const expectedTotalPoints = 20 + (char.level - 1) * 2;
            
            const strength = Number(stats.strength) || 0;
            const agility = Number(stats.agility) || 0;
            const accuracy = Number(stats.accuracy) || 0;
            const stamina = Number(stats.stamina) || 0;
            const intelligence = Number(stats.intelligence) || 0;
            const energy = Number(stats.energy) || 0;
            const luck = Number(stats.luck) || 0;
            const statPoints = Number(stats.statPoints) || 0;

            const currentTotal = strength + agility + accuracy + stamina + intelligence + energy + luck + statPoints;

            if (currentTotal !== expectedTotalPoints) {
                char.stats.strength = 0;
                char.stats.agility = 0;
                char.stats.accuracy = 0;
                char.stats.stamina = 0;
                char.stats.intelligence = 0;
                char.stats.energy = 0;
                char.stats.luck = 0;
                char.stats.statPoints = expectedTotalPoints;
                
                await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                fixedCount++;
            }
        }
        res.json({ checked: result.rows.length, fixed: fixedCount });

    } catch (err) {
        res.status(500).json({ message: 'Audit failed' });
    }
});

router.get('/audit/orphans', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT user_id, data FROM characters');
        const gameDataRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates = gameDataRes.rows[0]?.data || [];
        const templateIds = new Set(itemTemplates.map((t: any) => t.id));

        const orphans = [];

        for (const row of result.rows) {
            const char = row.data;
            const charOrphans = [];

            // Check Inventory
            (char.inventory || []).forEach((item: any) => {
                if (item && item.templateId && !templateIds.has(item.templateId)) {
                    charOrphans.push({ uniqueId: item.uniqueId, templateId: item.templateId, location: 'inventory' });
                }
            });

            // Check Equipment
            for (const key in (char.equipment || {})) {
                 const item = char.equipment[key];
                 if (item && item.templateId && !templateIds.has(item.templateId)) {
                     charOrphans.push({ uniqueId: item.uniqueId, templateId: item.templateId, location: `equipment:${key}` });
                 }
            }

            if (charOrphans.length > 0) {
                orphans.push({ userId: row.user_id, characterName: char.name, orphans: charOrphans });
            }
        }
        res.json(orphans);
    } catch(err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/resolve-orphans', async (req: any, res: any) => {
    try {
        await pool.query('BEGIN');
        const result = await pool.query('SELECT user_id, data FROM characters FOR UPDATE');
        const gameDataRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates = gameDataRes.rows[0]?.data || [];
        const templateIds = new Set(itemTemplates.map((t: any) => t.id));

        let itemsRemoved = 0;
        let charactersAffected = 0;

        for (const row of result.rows) {
            let char = row.data;
            let modified = false;

            // Clean Inventory
            const originalInvSize = (char.inventory || []).length;
            char.inventory = (char.inventory || []).filter((item: any) => item && item.templateId && templateIds.has(item.templateId));
            if (char.inventory.length !== originalInvSize) {
                itemsRemoved += (originalInvSize - char.inventory.length);
                modified = true;
            }

            // Clean Equipment
            for (const key in (char.equipment || {})) {
                 const item = char.equipment[key];
                 if (item && item.templateId && !templateIds.has(item.templateId)) {
                     char.equipment[key] = null;
                     itemsRemoved++;
                     modified = true;
                 }
            }
            
            if (modified) {
                 await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                 charactersAffected++;
            }
        }
        
        await pool.query('COMMIT');
        res.json({ itemsRemoved, charactersAffected });
    } catch(err: any) {
        await pool.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
//               GUILDS
// ==========================================

router.get('/guilds', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.id, g.name, g.tag, g.buildings, c.data->>'name' as leader_name 
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            ORDER BY g.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch guilds' });
    }
});

router.put('/guilds/:guildId/buildings', async (req: any, res: any) => {
    const { guildId } = req.params;
    const { buildings } = req.body;

    if (!buildings || typeof buildings !== 'object') {
        return res.status(400).json({ message: 'Invalid buildings data' });
    }

    try {
        await pool.query('UPDATE guilds SET buildings = $1 WHERE id = $2', [JSON.stringify(buildings), guildId]);
        res.json({ message: 'Guild buildings updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update guild buildings' });
    }
});

// ==========================================
//               ITEMS
// ==========================================

router.post('/give-item', async (req: any, res: any) => {
    const { userId, templateId, prefixId, suffixId, upgradeLevel } = req.body;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        
        const char = result.rows[0].data;
        
        const newItem = {
            uniqueId: crypto.randomUUID(),
            templateId,
            prefixId: prefixId || undefined,
            suffixId: suffixId || undefined,
            upgradeLevel: upgradeLevel || 0,
        };
        
        char.inventory.push(newItem);
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        
        res.json({ message: 'Item given' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed' });
    }
});

router.delete('/characters/:userId/items/:uniqueId', async (req: any, res: any) => {
    const { userId, uniqueId } = req.params;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        const char = result.rows[0].data;
        
        char.inventory = char.inventory.filter((i: any) => i.uniqueId !== uniqueId);
        for (const slot in char.equipment) {
            if (char.equipment[slot]?.uniqueId === uniqueId) {
                char.equipment[slot] = null;
            }
        }
        
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        res.json(char);
    } catch (err) {
        res.status(500).json({ message: 'Failed' });
    }
});

// Find item by ID
router.get('/items/find/:id', async (req: any, res: any) => {
    const uniqueId = req.params.id;
    try {
        const result = await pool.query('SELECT user_id, data FROM characters');
        const gameDataRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates = gameDataRes.rows[0]?.data || [];

        let foundItem: ItemInstance | null = null;
        let foundTemplate = null;
        const locations: any[] = [];

        for (const row of result.rows) {
            const char = row.data;
            const userId = row.user_id;

            // Check Inventory
            const invItem = (char.inventory || []).find((i: any) => i.uniqueId === uniqueId);
            if (invItem) {
                foundItem = invItem;
                locations.push({ userId, ownerName: char.name, location: 'inventory' });
            }

            // Check Equipment
            for (const key in (char.equipment || {})) {
                 const eqItem = char.equipment[key];
                 if (eqItem?.uniqueId === uniqueId) {
                     foundItem = eqItem;
                     locations.push({ userId, ownerName: char.name, location: `equipment:${key}` });
                 }
            }
        }

        // Check Market
        const marketRes = await pool.query(`SELECT m.id, m.seller_id, m.item_data, c.data->>'name' as name FROM market_listings m JOIN characters c ON m.seller_id = c.user_id WHERE status = 'ACTIVE'`);
        marketRes.rows.forEach(row => {
            const item = row.item_data;
            if (item?.uniqueId === uniqueId) {
                foundItem = item;
                locations.push({ userId: row.seller_id, ownerName: row.name, location: `market:${row.id}` });
            }
        });

        // Check Guild Armory
        const armoryRes = await pool.query(`SELECT id, item_data, owner_id FROM guild_armory_items`);
        for (const row of armoryRes.rows) {
             const item = row.item_data;
             if (item?.uniqueId === uniqueId) {
                 foundItem = item;
                 locations.push({ userId: row.owner_id, ownerName: 'Guild', location: `armory:${row.id}` });
             }
        }

        if (foundItem) {
             foundTemplate = templates.find((t: any) => t.id === foundItem!.templateId);
             res.json({ item: foundItem, template: foundTemplate, locations });
        } else {
             res.status(404).json({ message: 'Item not found' });
        }
    } catch(err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Soft Reset
router.post('/characters/:id/soft-reset', async (req: any, res: any) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        
        const char = result.rows[0].data;
        char.level = 1;
        char.experience = 0;
        char.stats.currentHealth = char.stats.maxHealth;
        char.activeExpedition = null;
        char.activeTravel = null;
        char.isResting = false;
        
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.params.id]);
        res.json({ message: 'Soft reset complete' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// Reset Hunting
router.post('/hunting/reset', async (req: any, res: any) => {
    try {
        await pool.query('DELETE FROM hunting_parties');
        res.json({ message: 'All hunting parties cleared.' });
    } catch (err) {
        res.status(500).json({ message: 'Error' });
    }
});

// Wipe Game Data
router.post('/wipe-game-data', async (req: any, res: any) => {
    try {
        await pool.query('BEGIN');
        await pool.query('TRUNCATE TABLE characters CASCADE');
        await pool.query('TRUNCATE TABLE messages CASCADE');
        await pool.query('TRUNCATE TABLE market_listings CASCADE');
        await pool.query('TRUNCATE TABLE market_bids CASCADE');
        await pool.query('TRUNCATE TABLE tavern_messages CASCADE');
        await pool.query('TRUNCATE TABLE hunting_parties CASCADE');
        await pool.query('TRUNCATE TABLE guilds CASCADE');
        await pool.query('TRUNCATE TABLE guild_members CASCADE');
        await pool.query('TRUNCATE TABLE guild_chat CASCADE');
        await pool.query('TRUNCATE TABLE guild_armory_items CASCADE');
        await pool.query('TRUNCATE TABLE guild_bank_history CASCADE');
        await pool.query('TRUNCATE TABLE guild_raids CASCADE');
        await pool.query('TRUNCATE TABLE tower_runs CASCADE');
        await pool.query('COMMIT');
        res.json({ message: 'Game data wiped successfully. Users preserved.' });
    } catch (err: any) {
        await pool.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    }
});

// Global Message
router.post('/global-message', async (req: any, res: any) => {
    const { subject, content } = req.body;
    try {
        const usersRes = await pool.query('SELECT user_id FROM characters');
        const userIds = usersRes.rows.map(r => r.user_id);
        
        // This could be slow for many users, batch insert would be better but simple loop for now
        for (const uid of userIds) {
             await enforceInboxLimit(pool, uid);
             await pool.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', $2, $3)`,
                [uid, subject, JSON.stringify({ content })]
            );
        }
        res.json({ message: 'Sent' });
    } catch(err: any) {
        res.status(500).json({ message: err.message });
    }
});

// PvP Reset Cooldowns
router.post('/pvp/reset-cooldowns', async (req: any, res: any) => {
    try {
        await pool.query("UPDATE characters SET data = jsonb_set(data, '{pvpProtectionUntil}', '0')");
        res.json({ message: 'Cooldowns reset' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// DB Editor Routes
router.get('/db/tables', async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        res.json(result.rows.map(r => r.table_name));
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/db/table/:name', async (req: any, res: any) => {
    const { name } = req.params;
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const offset = (page - 1) * limit;

    try {
        // Validate table name to prevent injection
        const validTablesRes = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        const validTables = validTablesRes.rows.map(r => r.table_name);
        if (!validTables.includes(name)) return res.status(400).json({ message: 'Invalid table name' });

        const countRes = await pool.query(`SELECT COUNT(*) FROM ${name}`);
        const total = parseInt(countRes.rows[0].count);

        const dataRes = await pool.query(`SELECT * FROM ${name} LIMIT $1 OFFSET $2`, [limit, offset]);
        res.json({ rows: dataRes.rows, total });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/db/table/:name', async (req: any, res: any) => {
    const { name } = req.params;
    const row = req.body;
    
    try {
        // Simple update logic based on primary key. 
        // Need to identify PK dynamically or hardcode per table.
        let pk = 'id';
        if (name === 'characters') pk = 'user_id';
        if (name === 'sessions') pk = 'token';
        if (name === 'game_data') pk = 'key';

        const id = row[pk];
        if (!id) return res.status(400).json({ message: 'Primary key missing in row data' });
        
        // Construct SET clause
        const keys = Object.keys(row).filter(k => k !== pk);
        const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const values = keys.map(k => {
             const val = row[k];
             return typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
        });
        
        await pool.query(`UPDATE ${name} SET ${setClause} WHERE ${pk} = $1`, [id, ...values]);
        res.json({ message: 'Updated' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/db/table/:name/:id', async (req: any, res: any) => {
    const { name, id } = req.params;
    try {
         let pk = 'id';
        if (name === 'characters') pk = 'user_id';
        if (name === 'sessions') pk = 'token';
        if (name === 'game_data') pk = 'key';

        await pool.query(`DELETE FROM ${name} WHERE ${pk} = $1`, [id]);
        res.json({ message: 'Deleted' });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export default router;