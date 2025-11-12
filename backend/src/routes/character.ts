// Replaced aliased express types with direct imports to resolve type conflicts.
import express, { Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PlayerCharacter, CharacterClass, GameData } from '../types.js';
import { processCompletedExpedition } from '../logic/expeditions.js';

const router = express.Router();

// GET /api/character - Get the current user's character data
// FIX: Use Request and Response types to resolve type conflicts.
router.get('/character', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        
        if (result.rows.length === 0) {
            await client.query('COMMIT');
            return res.status(200).json(null);
        }
        
        let character: PlayerCharacter = result.rows[0].data;
        let expeditionSummary = null;

        if (character.activeExpedition && Date.now() >= character.activeExpedition.finishTime) {
            const gameDataRes = await client.query("SELECT key, data FROM game_data");
            const gameData: Partial<GameData> = gameDataRes.rows.reduce((acc, row) => {
                acc[row.key as keyof GameData] = row.data;
                return acc;
            }, {});

            const outcome = processCompletedExpedition(character, gameData as GameData);
            character = outcome.updatedCharacter;
            expeditionSummary = outcome.summary;

            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);
        }

        await client.query('COMMIT');

        const response: any = character;
        if (expeditionSummary) {
            response.expeditionSummary = expeditionSummary;
        }

        res.json(response);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error fetching character:', err);
        res.status(500).json({ message: 'Failed to fetch character data.' });
    } finally {
        client.release();
    }
});

// POST /api/character - Create a new character
// FIX: Use Request and Response types to resolve type conflicts.
router.post('/character', authenticateToken, async (req: Request, res: Response) => {
    try {
        const newCharacterData: PlayerCharacter = req.body;
        if (!newCharacterData.name || !newCharacterData.race) {
            return res.status(400).json({ message: 'Name and race are required.' });
        }
        
        const existingChar = await pool.query('SELECT 1 FROM characters WHERE user_id = $1', [req.user!.id]);
        if (existingChar.rows.length > 0) {
            return res.status(409).json({ message: 'A character already exists for this user.' });
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
// FIX: Use Request and Response types to resolve type conflicts.
router.put('/character', authenticateToken, async (req: Request, res: Response) => {
    try {
        const updatedCharacterData: PlayerCharacter = req.body;
        
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
// FIX: Use Request and Response types to resolve type conflicts.
router.post('/character/select-class', authenticateToken, async (req: Request, res: Response) => {
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

// GET /api/characters/names - Get all character names
// FIX: Use Request and Response types to resolve type conflicts.
router.get('/characters/names', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = await pool.query("SELECT data->>'name' as name FROM characters");
        res.json(result.rows.map(r => r.name));
    } catch (err) {
        console.error('Error fetching character names:', err);
        res.status(500).json({ message: 'Failed to fetch character names.' });
    }
});

export default router;