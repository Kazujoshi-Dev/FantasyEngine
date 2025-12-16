
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, CharacterStats, SpyReportResult, EquipmentSlot } from '../types.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';

const router = express.Router();

router.post('/:targetId', authenticateToken, async (req: any, res: any) => {
    const attackerId = req.user!.id;
    const targetId = parseInt(req.params.targetId, 10);

    if (attackerId === targetId) {
        return res.status(400).json({ message: "You cannot spy on yourself." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch Attacker
        const attackerRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [attackerId]);
        if (attackerRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Character not found' });
        }
        const attacker: PlayerCharacter = attackerRes.rows[0].data;

        // 2. Check Requirements
        const hasSkill = (attacker.learnedSkills || []).includes('espionage-mastery');
        if (!hasSkill) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Nie posiadasz umiejętności "Nauki Szpiegowskie".' });
        }

        // 3. Fetch Target
        const targetRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [targetId]);
        if (targetRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Target not found' });
        }
        const target: PlayerCharacter = targetRes.rows[0].data;

        // 4. Calculate Costs
        const energyCost = 5;
        const goldCost = Math.max(100, target.level * 50);

        if (attacker.stats.currentEnergy < energyCost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Brak energii (wymagane 5).' });
        }
        if (attacker.resources.gold < goldCost) {
             await client.query('ROLLBACK');
            return res.status(400).json({ message: `Brak złota (wymagane ${goldCost}).` });
        }

        // 5. Calculate Stats (including items)
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const gameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as any);

        const derivedAttacker = calculateDerivedStatsOnServer(attacker, gameData.itemTemplates, gameData.affixes);
        const derivedTarget = calculateDerivedStatsOnServer(target, gameData.itemTemplates, gameData.affixes);

        // 6. Success Logic
        // Formula: 50% base + ((Attacker Int + Luck) - (Defender Int + Luck)) * 0.5%
        const attackerPower = derivedAttacker.stats.intelligence + derivedAttacker.stats.luck;
        const defenderPower = derivedTarget.stats.intelligence + derivedTarget.stats.luck;
        
        let chance = 50 + (attackerPower - defenderPower) * 0.5;
        chance = Math.max(10, Math.min(90, chance)); // Clamp between 10% and 90%
        
        const roll = Math.random() * 100;
        const isSuccess = roll < chance;

        // 7. Deduct Costs & Save
        attacker.stats.currentEnergy -= energyCost;
        attacker.resources.gold -= goldCost;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(attacker), attackerId]);

        // 8. Handle Result
        if (isSuccess) {
            const report: SpyReportResult = {
                success: true,
                targetName: target.name,
                gold: target.resources.gold,
                stats: derivedTarget.stats, // Full stats
                equipment: derivedTarget.equipment,
                inventoryCount: derivedTarget.inventory.length
            };
            
            await client.query('COMMIT');
            res.json({ result: report, updatedCharacter: attacker });
        } else {
            // Failure logic
            // Maybe notify target? For now, just return failure.
            await client.query('COMMIT');
            res.json({ 
                result: { success: false, targetName: target.name }, 
                updatedCharacter: attacker 
            });
        }

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Espionage error:", err);
        res.status(500).json({ message: 'Server error during espionage.' });
    } finally {
        client.release();
    }
});

export default router;
