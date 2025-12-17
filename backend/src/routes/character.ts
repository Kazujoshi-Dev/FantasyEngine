
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, ActiveTowerRun, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, SkillCost, EssenceType, CharacterClass, CharacterResources } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getTreasuryCapacity, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// FIX: Implemented missing rank management endpoint
router.post('/active-rank', authenticateToken, async (req: any, res: any) => {
    const { rankId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error('Postać nie znaleziona');
        
        let character: PlayerCharacter = charRes.rows[0].data;
        
        if (rankId) {
            // Verify ownership
            if (!character.ownedRankIds?.includes(rankId)) {
                throw new Error('Nie posiadasz tej rangi');
            }
            character.activeRankId = rankId;
        } else {
            // Disable rank
            delete character.activeRankId;
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// FIX: Added default export for router
export default router;
