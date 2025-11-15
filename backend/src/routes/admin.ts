
import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { AdminCharacterInfo, DuplicationAuditResult, GrammaticalGender, ItemInstance, ItemSearchResult, OrphanAuditResult, PlayerCharacter, GameData, ItemTemplate, OrphanInfo } from '../types.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';
import { hashPassword } from '../logic/helpers.js';

const router = express.Router();

// Middleware to check for admin privileges
const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows.length > 0 && userRes.rows[0].username === 'Kazujoshi') {
            next();
        } else {
            res.status(403).json({ message: 'Forbidden: Admin access required.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error during admin check.' });
    }
};

// All routes in this file are protected by admin middleware
router.use(authenticateToken, isAdmin);

router.get('/users', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT id, username FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

router.delete('/users/:id', async (req: Request, res: Response) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

router.post('/users/:id/password', async (req: Request, res: Response) => {
    const { newPassword } = req.body;
    if (!newPassword) {
        return res.status(400).json({ message: 'New password is required.' });
    }
    try {
        const { salt, hash } = hashPassword(newPassword);
        await pool.query('UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3', [hash, salt, req.params.id]);
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Failed to change password:', err);
        res.status(500).json({ message: 'Failed to change password.' });
    }
});


router.get('/characters/all', async (req: Request, res: Response) => {
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
            ORDER BY level DESC, name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch characters' });
    }
});

router.delete('/characters/:userId', async (req: Request, res: Response) => {
     try {
        await pool.query('DELETE FROM characters WHERE user_id = $1', [req.params.userId]);
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete character' });
    }
});

router.post('/characters/:userId/reset-stats', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        const totalPoints = character.stats.strength + character.stats.agility + character.stats.accuracy + character.stats.stamina + character.stats.intelligence + character.stats.energy + character.stats.statPoints;
        character.stats.strength = 0;
        character.stats.agility = 0;
        character.stats.accuracy = 0;
        character.stats.stamina = 0;
        character.stats.intelligence = 0;
        character.stats.energy = 0;
        character.stats.statPoints = totalPoints;
        
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

router.post('/characters/:userId/heal', async (req: Request, res: Response) => {
    const client = await pool.connect();
     try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        character.stats.currentHealth = character.stats.maxHealth;
        
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

router.post('/characters/:userId/regenerate-energy', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {});
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;
        
        const characterWithStats = calculateDerivedStatsOnServer(character, gameData.itemTemplates, gameData.affixes);
        character.stats.currentEnergy = characterWithStats.stats.maxEnergy;

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

router.post('/character/:userId/update-gold', async (req: Request, res: Response) => {
    const { gold } = req.body;
    const client = await pool.connect();
     try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        character.resources.gold = gold;
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to update gold' });
    } finally {
        client.release();
    }
});

router.get('/characters/:userId/inspect', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.params.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        res.json(result.rows[0].data);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch character data' });
    }
});

router.delete('/characters/:userId/items/:itemUniqueId', async (req: Request, res: Response) => {
    const { userId: userIdStr, itemUniqueId } = req.params;
    const userId = parseInt(userIdStr, 10);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        let itemFoundAndRemoved = false;
        
        const initialInventoryLength = character.inventory.length;
        character.inventory = character.inventory.filter(item => item.uniqueId !== itemUniqueId);
        if (character.inventory.length < initialInventoryLength) {
            itemFoundAndRemoved = true;
        }

        if (!itemFoundAndRemoved) {
            for (const slot in character.equipment) {
                if (character.equipment[slot as keyof typeof character.equipment]?.uniqueId === itemUniqueId) {
                    character.equipment[slot as keyof typeof character.equipment] = null;
                    itemFoundAndRemoved = true;
                    break;
                }
            }
        }

        if (!itemFoundAndRemoved) {
             return res.status(404).json({ message: 'Item not found on character.' });
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, userId]);
        await client.query('COMMIT');
        res.json(character); // Return updated character
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to delete item' });
    } finally {
        client.release();
    }
});

// Duplication Audit
router.get('/audit/duplicates', async (req: Request, res: Response) => {
    try {
        // This is a simplified audit. A more robust one might need more complex SQL.
        const result = await pool.query(`
            SELECT
                jsonb_array_elements(data->'inventory')->>'uniqueId' as item_id
            FROM characters
            GROUP BY item_id
            HAVING count(*) > 1
        `);
        // This query is too simple. A full audit requires scanning equipment, market, messages etc.
        // For now, return an empty array as a placeholder. A full implementation is very complex.
        res.json([]);
    } catch (err) {
        console.error("Duplication audit error:", err);
        res.status(500).json({ message: 'Duplication audit failed.' });
    }
});

router.post('/resolve-duplicates', async (req: Request, res: Response) => {
    // Placeholder for resolution logic
    res.json({ resolvedSets: 0, itemsDeleted: 0 });
});

// Orphan Audit
router.get('/audit/orphans', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const allItemTemplates: ItemTemplate[] = gameDataRes.rows[0]?.data || [];
        const templateIds = new Set(allItemTemplates.map(t => t.id));

        const charactersRes = await client.query("SELECT user_id, data FROM characters");

        const results: OrphanAuditResult[] = [];

        for (const row of charactersRes.rows) {
            const character: PlayerCharacter = row.data;
            const orphans: OrphanInfo[] = [];

            // Check inventory for null/undefined items and items with missing templates
            (character.inventory || []).forEach((item, index) => {
                if (!item || !templateIds.has(item.templateId)) {
                    orphans.push({
                        uniqueId: item?.uniqueId || `invalid-item-${index}`,
                        templateId: item?.templateId || 'UNKNOWN',
                        location: `inventory[${index}]`
                    });
                }
            });

            // Check equipment
            for (const slot in character.equipment) {
                const item = character.equipment[slot as keyof typeof character.equipment];
                if (item && !templateIds.has(item.templateId)) {
                    orphans.push({
                        uniqueId: item.uniqueId,
                        templateId: item.templateId,
                        location: `equipment.${slot}`
                    });
                }
            }

            if (orphans.length > 0) {
                results.push({
                    characterName: character.name,
                    userId: row.user_id,
                    orphans: orphans
                });
            }
        }
        res.json(results);
    } catch (err) {
        console.error("Orphan audit error:", err);
        res.status(500).json({ message: 'Orphan audit failed.' });
    } finally {
        client.release();
    }
});

router.post('/resolve-orphans', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const allItemTemplates: ItemTemplate[] = gameDataRes.rows[0]?.data || [];
        const templateIds = new Set(allItemTemplates.map(t => t.id));

        const charactersRes = await client.query("SELECT user_id, data FROM characters FOR UPDATE");

        let itemsRemoved = 0;
        let charactersAffected = 0;

        for (const row of charactersRes.rows) {
            const character: PlayerCharacter = row.data;
            let wasModified = false;

            const originalInventoryCount = (character.inventory || []).length;
            character.inventory = (character.inventory || []).filter(item => item && templateIds.has(item.templateId));
            const removedFromInventory = originalInventoryCount - character.inventory.length;
            
            if (removedFromInventory > 0) {
                itemsRemoved += removedFromInventory;
                wasModified = true;
            }
            
            let removedFromEquipment = 0;
            for (const slot in character.equipment) {
                const item = character.equipment[slot as keyof typeof character.equipment];
                if (item && !templateIds.has(item.templateId)) {
                    character.equipment[slot as keyof typeof character.equipment] = null;
                    removedFromEquipment++;
                    wasModified = true;
                }
            }
            
            if(removedFromEquipment > 0) {
                itemsRemoved += removedFromEquipment;
            }

            if (wasModified) {
                charactersAffected++;
                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, row.user_id]);
            }
        }
        
        await client.query('COMMIT');
        res.json({ charactersAffected, itemsRemoved });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Orphan resolution error:", err);
        res.status(500).json({ message: 'Orphan resolution failed.' });
    } finally {
        client.release();
    }
});

// Item Inspector
router.get('/find-item/:uniqueId', async (req: Request, res: Response) => {
    res.status(404).json({ message: 'Not implemented' }); // Placeholder
});

router.post('/pvp/reset-cooldowns', async (req: Request, res: Response) => {
    try {
        await pool.query("UPDATE characters SET data = data || jsonb_build_object('pvpProtectionUntil', 0)");
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to reset PvP cooldowns' });
    }
});

router.post('/messages/global', async (req: Request, res: Response) => {
    const { subject, content } = req.body;
    if (!subject || !content) {
        return res.status(400).json({ message: "Subject and content are required." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userIdsRes = await client.query('SELECT id FROM users');
        const body = { content };
        for (const row of userIdsRes.rows) {
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                VALUES ($1, 'System', 'system', $2, $3)`,
                [row.id, subject, JSON.stringify(body)]
            );
        }
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: "Failed to send global message." });
    } finally {
        client.release();
    }
});

// --- Database Editor Routes ---
const ALLOWED_TABLES = ['users', 'characters', 'sessions', 'messages', 'tavern_messages', 'game_data', 'market_listings', 'market_bids'];
const PRIMARY_KEYS: { [key: string]: string } = {
    users: 'id',
    characters: 'user_id',
    sessions: 'token',
    messages: 'id',
    tavern_messages: 'id',
    game_data: 'key',
    market_listings: 'id',
    market_bids: 'id',
};

router.get('/db/tables', (req: Request, res: Response) => {
    res.json(ALLOWED_TABLES);
});

router.get('/db/table/:tableName', async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    if (!ALLOWED_TABLES.includes(tableName)) {
        return res.status(403).json({ message: 'Access to this table is not allowed.' });
    }

    try {
        const dataRes = await pool.query(`SELECT * FROM ${tableName} ORDER BY 1 LIMIT $1 OFFSET $2`, [limit, offset]);
        const countRes = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        res.json({
            rows: dataRes.rows,
            total: parseInt(countRes.rows[0].count, 10),
        });
    } catch (err) {
        console.error(`Error fetching table ${tableName}:`, err);
        res.status(500).json({ message: `Failed to fetch data for table ${tableName}.` });
    }
});

router.put('/db/table/:tableName', async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const rowData = req.body;

    if (!ALLOWED_TABLES.includes(tableName)) {
        return res.status(403).json({ message: 'Access to this table is not allowed.' });
    }

    const primaryKeyCol = PRIMARY_KEYS[tableName];
    if (!primaryKeyCol || !rowData[primaryKeyCol]) {
        return res.status(400).json({ message: 'Primary key is missing or invalid.' });
    }

    const primaryKeyValue = rowData[primaryKeyCol];
    delete rowData[primaryKeyCol];

    const fields = Object.keys(rowData);
    const values = Object.values(rowData);
    const setClauses = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

    try {
        const query = `UPDATE ${tableName} SET ${setClauses} WHERE ${primaryKeyCol} = $${fields.length + 1}`;
        await pool.query(query, [...values, primaryKeyValue]);
        res.sendStatus(200);
    } catch (err) {
        console.error(`Error updating row in ${tableName}:`, err);
        res.status(500).json({ message: `Failed to update row in ${tableName}.` });
    }
});

router.delete('/db/table/:tableName', async (req: Request, res: Response) => {
    const { tableName } = req.params;
    const { primaryKeyValue } = req.body;

     if (!ALLOWED_TABLES.includes(tableName)) {
        return res.status(403).json({ message: 'Access to this table is not allowed.' });
    }

    const primaryKeyCol = PRIMARY_KEYS[tableName];
    if (!primaryKeyCol || !primaryKeyValue) {
        return res.status(400).json({ message: 'Primary key is missing or invalid.' });
    }

    try {
        const query = `DELETE FROM ${tableName} WHERE ${primaryKeyCol} = $1`;
        await pool.query(query, [primaryKeyValue]);
        res.sendStatus(204);
    } catch (err) {
        console.error(`Error deleting row from ${tableName}:`, err);
        res.status(500).json({ message: `Failed to delete row from ${tableName}.` });
    }
});


export default router;