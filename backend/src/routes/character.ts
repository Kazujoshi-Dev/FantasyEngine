
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter } from '../types.js';
import { pruneExpiredBuffs } from '../logic/guilds.js';

// Import sub-routers
import statsRoutes from './character/stats.js';
import campRoutes from './character/camp.js';
import storageRoutes from './character/storage.ts';
import skillsRoutes from './character/skills.js';
import loadoutsRoutes from './character/loadouts.js';

const router = express.Router();

// Middleware: Wszystkie trasy w tej grupie wymagają tokenu
router.use(authenticateToken);

// Delegacja do wyspecjalizowanych routerów
router.use('/stats', statsRoutes);
router.use('/camp', campRoutes);
router.use('/storage', storageRoutes); // Obsługuje treasury i warehouse
router.use('/skills', skillsRoutes);
router.use('/loadouts', loadoutsRoutes);

// Zachowanie kompatybilności wstecznej dla ścieżek wywoływanych bezpośrednio
router.use('/', statsRoutes); // Obsługuje /stats i /reset-stats
router.use('/', campRoutes);  // Obsługuje /heal i /camp/upgrade
router.use('/', storageRoutes); // Obsługuje /treasury/* i /warehouse/*
router.use('/', skillsRoutes);  // Obsługuje /skills/* i /class i /convert-essence
router.use('/', loadoutsRoutes); // Obsługuje /loadouts/*

// GET /api/character - Jedyny GET: Pobierz pełne dane postaci
router.get('/', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`
            SELECT 
                c.data, u.email, g.buildings, g.active_buffs, g.id as guild_id,
                (SELECT row_to_json(tr) FROM tower_runs tr WHERE tr.user_id = c.user_id AND tr.status = 'IN_PROGRESS' LIMIT 1) as active_tower_run
            FROM characters c 
            JOIN users u ON c.user_id = u.id
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [req.user.id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json(null);
        }

        const row = result.rows[0];
        const charData: PlayerCharacter = row.data;

        // Inicjalizacja struktur obronnych
        if (!charData.loadouts) charData.loadouts = [];
        if (!charData.resources) charData.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
        if (row.email) charData.email = row.email;

        if (row.guild_id) {
            charData.guildId = row.guild_id;
            charData.guildBarracksLevel = row.buildings?.barracks || 0;
            charData.guildShrineLevel = row.buildings?.shrine || 0;
            const { pruned, wasModified } = pruneExpiredBuffs(row.active_buffs || []);
            if (wasModified) {
                await client.query('UPDATE guilds SET active_buffs = $1 WHERE id = $2', [JSON.stringify(pruned), row.guild_id]);
                charData.activeGuildBuffs = pruned;
            } else {
                charData.activeGuildBuffs = row.active_buffs || [];
            }
        }

        if (row.active_tower_run) {
            charData.activeTowerRun = {
                id: row.active_tower_run.id,
                userId: row.active_tower_run.user_id,
                towerId: row.active_tower_run.tower_id,
                currentFloor: row.active_tower_run.current_floor,
                currentHealth: row.active_tower_run.current_health,
                currentMana: row.active_tower_run.current_mana,
                accumulatedRewards: row.active_tower_run.accumulated_rewards,
                status: row.active_tower_run.status
            };
        }

        await client.query('COMMIT');
        res.json(charData);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Błąd pobierania postaci' });
    } finally {
        client.release();
    }
});

export default router;
