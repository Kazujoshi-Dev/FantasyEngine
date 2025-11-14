

import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { GameData, ItemInstance, ItemTemplate, PlayerCharacter } from '../types.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public endpoint to get all game data
router.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT key, data FROM game_data');
        const gameData: Partial<GameData> = {};
        for (const row of result.rows) {
            (gameData as any)[row.key] = row.data;
        }
        res.json(gameData);
    } catch (err) {
        console.error('Error fetching game data:', err);
        res.status(500).json({ message: 'Failed to fetch game data.' });
    }
});

// Admin-only endpoint to update game data
router.put('/', authenticateToken, async (req: Request, res: Response) => {
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [(req as any).user!.id]);
    if (userRes.rows[0]?.username !== 'Kazujoshi') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { key, data } = req.body as { key: keyof GameData, data: any };
    if (!key || data === undefined) {
        return res.status(400).json({ message: 'Key and data are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Special handling for itemTemplates to clean up orphans
        if (key === 'itemTemplates') {
            const oldTemplatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
            const oldTemplates: ItemTemplate[] = oldTemplatesRes.rows[0]?.data || [];
            const oldTemplateIds = new Set(oldTemplates.map(t => t.id));
            const newTemplateIds = new Set((data as ItemTemplate[]).map(t => t.id));

            const deletedTemplateIds = [...oldTemplateIds].filter(id => !newTemplateIds.has(id));

            if (deletedTemplateIds.length > 0) {
                console.log(`[ADMIN] Deleting instances of templates: ${deletedTemplateIds.join(', ')}`);
                
                // Fetch all characters to modify their data
                const charactersRes = await client.query('SELECT user_id, data FROM characters FOR UPDATE');
                for (const row of charactersRes.rows) {
                    let character: PlayerCharacter = row.data;
                    let modified = false;

                    // Clean inventory
                    const initialInventoryCount = character.inventory.length;
                    // fix: Use .includes() for array check
                    character.inventory = character.inventory.filter(item => !deletedTemplateIds.includes(item.templateId));
                    if (character.inventory.length < initialInventoryCount) {
                        modified = true;
                    }

                    // Clean equipment
                    for (const slot in character.equipment) {
                        const item = character.equipment[slot as keyof typeof character.equipment];
                        // fix: Use .includes() for array check
                        if (item && deletedTemplateIds.includes(item.templateId)) {
                            character.equipment[slot as keyof typeof character.equipment] = null;
                            modified = true;
                        }
                    }

                    if (modified) {
                        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, row.user_id]);
                    }
                }

                // Clean market listings
                const marketRes = await client.query("SELECT id, item_data FROM market_listings WHERE status = 'ACTIVE' FOR UPDATE");
                for (const row of marketRes.rows) {
                    const item: ItemInstance = row.item_data;
                    if (deletedTemplateIds.includes(item.templateId)) {
                        // Instead of deleting, we'll cancel it so the user is notified (even if they can't see the item)
                        // Or just delete it to prevent confusion. Let's delete.
                        await client.query("DELETE FROM market_listings WHERE id = $1", [row.id]);
                        console.log(`[ADMIN] Deleted market listing ${row.id} because its template was removed.`);
                    }
                }
            }
        }

        await client.query(
            'INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = $2',
            [key, JSON.stringify(data)]
        );
        
        await client.query('COMMIT');
        res.status(200).json({ message: `Game data for '${key}' updated successfully.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error updating game data for key ${key}:`, err);
        res.status(500).json({ message: 'Failed to update game data.' });
    } finally {
        client.release();
    }
});

export default router;