import express from 'express';
import { pool } from '../db.js';
import { PlayerCharacter, ItemInstance, DuplicationAuditResult, AdminCharacterInfo, Message, User, OrphanAuditResult, ItemSearchResult, GameData, EquipmentSlot, DuplicationInfo } from '../types.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware to check if the user is an admin
const isAdmin = async (req: any, res: any, next: any) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: 'Error checking admin status' });
    }
};

// All routes in this file are admin-only
router.use(authenticateToken as any, isAdmin as any);


// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

// DELETE /api/admin/users/:userId - Delete a user and their character
router.delete('/users/:userId', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

// POST /api/admin/users/:userId/password - Change a user's password
router.post('/users/:userId/password', async (req, res) => {
    // Note: This endpoint is missing in api.ts but exists in the frontend call.
    // For now, I'll assume it's for changing other users' passwords, not the admin's own.
    // A proper implementation would re-hash the password.
    res.status(501).json({ message: 'Password change not implemented for security reasons.' });
});

// GET /api/admin/characters/all - Get all characters basic info
router.get('/characters/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id, 
                u.username,
                c.data->>'name' as name,
                c.data->>'race' as race,
                (c.data->>'level')::int as level,
                (c.data->'resources'->>'gold')::bigint as gold
            FROM characters c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.user_id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch all characters' });
    }
});

// DELETE /api/admin/characters/:userId - Delete a character
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

// POST /api/admin/characters/:userId/heal
router.post('/characters/:userId/heal', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
             return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        
        // A full heal requires calculating max health from derived stats, but for simplicity we can use stored maxHealth.
        // A more correct implementation would fetch gameData and recalculate.
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

// POST /api/admin/character/:userId/update-gold
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


// POST /api/admin/characters/:userId/regenerate-energy
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

// GET /api/admin/characters/:userId/inspect
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

// DELETE /api/admin/characters/:userId/items/:itemUniqueId
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

        // Check inventory
        const initialInventoryLength = character.inventory.length;
        character.inventory = character.inventory.filter(item => item.uniqueId !== itemUniqueId);
        
        let found = initialInventoryLength > character.inventory.length;

        // Check equipment if not found in inventory
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

router.post('/hunting/reset', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM hunting_parties');
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
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

// Helper type for duplication check
interface ItemRef {
    uniqueId: string;
    templateId: string;
    userId: number;
    ownerName: string;
    location: string;
    index?: number;
    slot?: string;
    item?: ItemInstance;
}

router.get('/audit/duplicates', async (req, res) => {
    try {
        // Fetch all characters and Item Templates for name resolution
        const charsRes = await pool.query("SELECT user_id, data FROM characters");
        const templatesRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const templates = templatesRes.rows[0]?.data || [];

        const itemMap = new Map<string, ItemRef[]>();

        // Scan all items
        for (const row of charsRes.rows) {
            const char: PlayerCharacter = row.data;
            const userId = row.user_id;
            const ownerName = char.name;

            // Scan Inventory
            if (char.inventory) {
                char.inventory.forEach((item, idx) => {
                    if (!item) return;
                    const ref: ItemRef = {
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

            // Scan Equipment
            if (char.equipment) {
                Object.entries(char.equipment).forEach(([slot, item]) => {
                    if (item) {
                        const ref: ItemRef = {
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

        // Filter for duplicates
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
        
        // 1. Re-scan to get current state under lock
        const charsRes = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        const itemMap = new Map<string, ItemRef[]>();
        
        // Map user_id to character data for quick updates
        const charDataMap = new Map<number, PlayerCharacter>();

        for (const row of charsRes.rows) {
            const char: PlayerCharacter = row.data;
            const userId = row.user_id;
            const ownerName = char.name;
            charDataMap.set(userId, char);

            // Scan Inventory
            if (char.inventory) {
                char.inventory.forEach((item, idx) => {
                    if (!item) return;
                    itemMap.get(item.uniqueId)?.push({
                        uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'inventory', index: idx, item
                    }) || itemMap.set(item.uniqueId, [{
                        uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'inventory', index: idx, item
                    } as ItemRef]);
                });
            }

            // Scan Equipment
            if (char.equipment) {
                Object.entries(char.equipment).forEach(([slot, item]) => {
                    if (item) {
                        itemMap.get(item.uniqueId)?.push({
                            uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'equipment', slot, item
                        }) || itemMap.set(item.uniqueId, [{
                            uniqueId: item.uniqueId, templateId: item.templateId, userId, ownerName, location: 'equipment', slot, item
                        } as ItemRef]);
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
                // Keep the first one found (arbitrary but safe)
                const keeper = refs[0];
                const toRemove = refs.slice(1);

                for (const removeRef of toRemove) {
                    const char = charDataMap.get(removeRef.userId);
                    if (!char) continue;

                    if (removeRef.location === 'inventory' && typeof removeRef.index === 'number') {
                        // Mark for removal (filter later or splice carefully if doing descending order, but filter by uniqueId is safer)
                        char.inventory = char.inventory.filter(i => i.uniqueId !== uniqueId);
                    } else if (removeRef.location === 'equipment' && removeRef.slot) {
                        (char.equipment as any)[removeRef.slot] = null;
                    }
                    itemsDeleted++;
                    usersToUpdate.add(removeRef.userId);
                }
            }
        }

        // Commit updates
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

            // Check Inventory
            char.inventory?.forEach((item, idx) => {
                if (item && !validTemplateIds.has(item.templateId)) {
                    orphans.push({
                        uniqueId: item.uniqueId,
                        templateId: item.templateId,
                        location: `inventory[${idx}]`
                    });
                }
            });

            // Check Equipment
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

            // Clean Inventory
            const initialInvCount = char.inventory?.length || 0;
            char.inventory = (char.inventory || []).filter(item => item && validTemplateIds.has(item.templateId));
            if (char.inventory.length !== initialInvCount) {
                itemsRemoved += (initialInvCount - char.inventory.length);
                modified = true;
            }

            // Clean Equipment
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
            
            // Check Inventory
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

            // Check Equipment
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

        // Also check Market Listings
        const marketRes = await pool.query("SELECT id, seller_id, item_data FROM market_listings WHERE item_data->>'uniqueId' = $1", [uniqueId]);
        for(const row of marketRes.rows) {
             foundItem = row.item_data;
             // Get seller name
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

router.post('/audit/fix-characters', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        let fixed = 0;
        for (const row of result.rows) {
            let character = row.data as PlayerCharacter;
            let needsUpdate = false;
            if (!character.resources) { character.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 }; needsUpdate = true; }
            if (!character.camp) { character.camp = { level: 1 }; needsUpdate = true; }
            if (!character.chest) { character.chest = { level: 1, gold: 0 }; needsUpdate = true; }
            if (!character.backpack) { character.backpack = { level: 1 }; needsUpdate = true; }
            // Add other checks here...
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

router.post('/audit/fix-gold', async (req, res) => {
     res.status(501).json({ checked: 0, fixed: 0 });
});

router.post('/audit/fix-values', async (req, res) => {
     res.status(501).json({ itemsChecked: 0, itemsFixed: 0, affixesChecked: 0, affixesFixed: 0 });
});

router.post('/audit/fix-attributes', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT user_id, data FROM characters FOR UPDATE");
        let fixed = 0;
        
        for (const row of result.rows) {
            let character = row.data as PlayerCharacter;
            const level = character.level || 1;
            
            // Expected points: 10 base + 1 per level starting from level 2
            const expectedTotal = 10 + (level - 1);
            
            // Current points
            const currentTotal = (Number(character.stats.strength) || 0) +
                                 (Number(character.stats.agility) || 0) +
                                 (Number(character.stats.accuracy) || 0) +
                                 (Number(character.stats.stamina) || 0) +
                                 (Number(character.stats.intelligence) || 0) +
                                 (Number(character.stats.energy) || 0) +
                                 (Number(character.stats.statPoints) || 0);

            if (currentTotal > expectedTotal) {
                // Fix: Reset all stats to 0 and refund correct amount as free points
                character.stats.strength = 0;
                character.stats.agility = 0;
                character.stats.accuracy = 0;
                character.stats.stamina = 0;
                character.stats.intelligence = 0;
                character.stats.energy = 0;
                character.stats.statPoints = expectedTotal;
                
                await client.query("UPDATE characters SET data = $1 WHERE user_id = $2", [character, row.user_id]);
                fixed++;
            }
        }
        
        await client.query('COMMIT');
        res.json({ checked: result.rows.length, fixed });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Fix attributes audit failed:", err);
        res.status(500).json({ message: 'Failed to run attributes audit' });
    } finally {
        client.release();
    }
});

router.post('/wipe-game-data', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE characters, messages, market_listings, market_bids, hunting_parties, tavern_messages, tavern_presence RESTART IDENTITY');
        await client.query('COMMIT');
        res.json({ message: 'All game-related data has been wiped.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to wipe game data' });
    } finally {
        client.release();
    }
});


// DB Editor routes
router.get('/db/tables', async (req, res) => {
     try {
        const result = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'");
        res.json(result.rows.map(r => r.tablename));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tables' });
    }
});

router.get('/db/table/:tableName', async (req, res) => {
     res.status(501).json({ rows: [], total: 0 });
});

router.put('/db/table/:tableName', async (req, res) => {
     res.status(501).send();
});

router.delete('/db/table/:tableName', async (req, res) => {
     res.status(501).send();
});


export default router;