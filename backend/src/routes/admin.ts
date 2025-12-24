
import express from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import statsRoutes from './admin/stats.js';
import characterRoutes from './admin/characters.js';
import auditRoutes from './admin/audit.js';
import guildAdminRoutes from './admin/guilds.js'; // Import nowego routera
import { PlayerCharacter, ItemTemplate, Affix } from '../types.js';
import { rollTemplateStats, rollAffixStats } from '../logic/items.js';
import { randomUUID } from 'crypto';
import { getBackpackCapacity } from '../logic/stats.js';

const router = express.Router();

// Middleware: Check if user is Admin
const checkAdmin = async (req: any, res: any, next: any) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length === 0 || userRes.rows[0].username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        next();
    } catch (err) { res.status(500).json({ message: 'Auth check failed' }); }
};

router.use(authenticateToken, checkAdmin);

// Delegacja do pod-routerów
router.use('/stats', statsRoutes);
router.use('/characters', characterRoutes);
router.use('/audit', auditRoutes);
router.use('/guilds', guildAdminRoutes); // Rejestracja ścieżki /guilds

// Endpoint do dawania konkretnych przedmiotów (Kreator Admina)
router.post('/give-item', async (req: any, res: any) => {
    const { userId, templateId, prefixId, suffixId, upgradeLevel } = req.body;
    
    if (!userId || !templateId) {
        return res.status(400).json({ message: 'User ID and Template ID are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Pobierz postać
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found.' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;

        // 2. Sprawdź miejsce w plecaku
        const backpackCap = getBackpackCapacity(character);
        if (character.inventory.length >= backpackCap) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Target inventory is full.' });
        }

        // 3. Pobierz dane gry
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const itemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const template = itemTemplates.find(t => t.id === templateId);
        if (!template) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Item template not found.' });
        }

        // 4. Skonstruuj przedmiot
        const luck = character.stats?.luck || 0;
        const newItem = {
            uniqueId: randomUUID(),
            templateId: templateId,
            upgradeLevel: parseInt(upgradeLevel) || 0,
            rolledBaseStats: rollTemplateStats(template, luck),
            prefixId: prefixId || undefined,
            suffixId: suffixId || undefined,
            crafterName: 'Administrator'
        } as any;

        if (prefixId) {
            const p = affixes.find(a => a.id === prefixId);
            if (p) newItem.rolledPrefix = rollAffixStats(p, luck);
        }
        if (suffixId) {
            const s = affixes.find(a => a.id === suffixId);
            if (s) newItem.rolledSuffix = rollAffixStats(s, luck);
        }

        // 5. Dodaj do inventory i zapisz
        character.inventory.push(newItem);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        
        await client.query('COMMIT');
        res.json({ message: 'Item granted successfully', itemUniqueId: newItem.uniqueId });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("ADMIN GIVE ITEM ERROR:", err);
        res.status(500).json({ message: 'Failed to grant item: ' + err.message });
    } finally {
        client.release();
    }
});

// Metody pomocnicze zachowane w głównym pliku dla prostoty (globalne akcje)
router.post('/global-message', async (req: any, res: any) => {
    const { subject, content } = req.body;
    try {
        const users = await pool.query('SELECT user_id FROM characters');
        for (const u of users.rows) {
            await pool.query("INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', $2, $3)", 
                [u.user_id, subject, JSON.stringify({ content })]);
        }
        res.json({ message: 'Sent' });
    } catch (err) { res.status(500).json({ message: 'Failed' }); }
});

// WIPE GAME DATA - Czyści postępy graczy, zachowuje konta i dane gry
router.post('/wipe-game-data', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('[WIPE] Starting full game data wipe...');

        await client.query(`
            TRUNCATE 
                characters, 
                messages, 
                market_listings, 
                market_bids, 
                hunting_parties, 
                guilds, 
                guild_members, 
                guild_chat, 
                guild_armory_items, 
                guild_bank_history, 
                guild_raids, 
                guild_espionage, 
                tavern_messages, 
                tavern_presence, 
                tower_runs 
            RESTART IDENTITY CASCADE
        `);

        await client.query('DELETE FROM sessions');

        await client.query('COMMIT');
        console.log('[WIPE] Wipe completed successfully.');

        res.json({ message: 'Dane gry zostały pomyślnie wyczyszczone. Wszystkie postacie i gildie przestały istnieć.' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[WIPE] Error during wipe:', err);
        res.status(500).json({ message: 'Błąd podczas czyszczenia danych: ' + err.message });
    } finally {
        client.release();
    }
});

export default router;
