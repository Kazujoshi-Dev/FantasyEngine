import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { AdminCharacterInfo, DuplicationAuditResult, GrammaticalGender, ItemInstance, ItemSearchResult, OrphanAuditResult, PlayerCharacter } from '../types.js';

const router = Router();

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
router.use(isAdmin);

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
     res.json([]); // Placeholder
});
router.post('/resolve-orphans', async (req: Request, res: Response) => {
    res.json({ charactersAffected: 0, itemsRemoved: 0 }); // Placeholder
});

// Item Inspector
router.get('/find-item/:uniqueId', async (req: Request, res: Response) => {
    res.status(404).json({ message: 'Not implemented' }); // Placeholder
});

export default router;