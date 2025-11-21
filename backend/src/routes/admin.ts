import express from 'express';
import { pool } from '../db.js';
import { PlayerCharacter, ItemInstance, DuplicationAuditResult, AdminCharacterInfo, Message, User, OrphanAuditResult, ItemSearchResult, GameData } from '../types.js';
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

router.get('/audit/duplicates', async (req, res) => {
    // This is a complex query, a full implementation would be needed here.
    res.status(501).json([]);
});

router.post('/resolve-duplicates', async (req, res) => {
    res.status(501).json({ resolvedSets: 0, itemsDeleted: 0 });
});

router.get('/audit/orphans', async (req, res) => {
    res.status(501).json([]);
});

router.post('/resolve-orphans', async (req, res) => {
    res.status(501).json({ charactersAffected: 0, itemsRemoved: 0 });
});

router.get('/find-item/:uniqueId', async (req, res) => {
    res.status(501).json(null);
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