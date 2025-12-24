
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, Expedition } from '../types.js';
import { processCompletedExpedition } from '../logic/expeditions.js';
import { enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// POST /api/expedition/start
router.post('/start', authenticateToken, async (req: any, res: any) => {
    const { expeditionId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Fetch Character and Guild Building Info
        const charRes = await client.query(`
            SELECT c.data, g.buildings 
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [req.user.id]);

        if (charRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        const guildBuildings = charRes.rows[0].buildings || {};

        // 2. Validate State
        if (character.activeExpedition) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You are already on an expedition.' });
        }
        if (character.activeTravel) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You are traveling.' });
        }
        if (character.isResting) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You must stop resting first.' });
        }

        const towerRes = await client.query("SELECT 1 FROM tower_runs WHERE user_id = $1 AND status = 'IN_PROGRESS'", [req.user.id]);
        if (towerRes.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Nie możesz wyruszyć na wyprawę będąc w Wieży Mroku.' });
        }

        // 3. Fetch Expedition Data
        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'expeditions'");
        const expeditions: Expedition[] = gameDataRes.rows[0]?.data || [];
        const expedition = expeditions.find(e => e.id === expeditionId);

        if (!expedition) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Expedition not found.' });
        }

        // 4. Validate Location & Resources
        if (!expedition.locationIds.includes(character.currentLocationId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You are not in the correct location.' });
        }
        if (character.resources.gold < expedition.goldCost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough gold.' });
        }
        
        let energyCost = expedition.energyCost;
        
        // --- Pioneer's Instinct Energy Reduction ---
        if (character.learnedSkills?.includes('pioneers-instinct')) {
            energyCost = Math.max(1, energyCost - 1);
        }

        if (character.stats.currentEnergy < energyCost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough energy.' });
        }

        // 5. Apply Costs & Set State
        character.resources.gold -= expedition.goldCost;
        character.stats.currentEnergy -= energyCost;
        
        // --- STABLES REDUCTION ---
        const stablesLevel = guildBuildings.stables || 0;
        const reductionFactor = 1 - (stablesLevel * 0.1);
        const finalDuration = Math.max(5, Math.floor(expedition.duration * reductionFactor));
        
        const finishTime = Date.now() + (finalDuration * 1000);
        character.activeExpedition = {
            expeditionId: expedition.id,
            finishTime: finishTime,
            enemies: [], 
            combatLog: [],
            rewards: { gold: 0, experience: 0 }
        };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        
        res.json(character);

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Start Expedition Error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// Reszta pliku bez zmian...
export default router;
