
// FIX: Use explicit express types to resolve type conflicts.
import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, PvpRewardSummary, Enemy } from '../types.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';
import { simulateCombat } from '../logic/combat.js';

const router = express.Router();

// FIX: Use explicit express types for req, res.
router.post('/attack/:defenderId', authenticateToken, async (req: Request, res: Response) => {
    const attackerId = req.user!.id;
    const defenderId = parseInt(req.params.defenderId, 10);

    if (attackerId === defenderId) {
        return res.status(400).json({ message: "You cannot attack yourself." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {});

        const attackerRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [attackerId]);
        const defenderRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [defenderId]);

        if (attackerRes.rows.length === 0 || defenderRes.rows.length === 0) {
            return res.status(404).json({ message: 'Player not found.' });
        }

        let attacker: PlayerCharacter = attackerRes.rows[0].data;
        let defender: PlayerCharacter = defenderRes.rows[0].data;

        // Validation
        if (Math.abs(attacker.level - defender.level) > 3) return res.status(400).json({ message: 'Level difference is too high.' });
        if (attacker.stats.currentEnergy < 3) return res.status(400).json({ message: 'Not enough energy.' });
        if (defender.pvpProtectionUntil > Date.now()) return res.status(400).json({ message: 'Target is protected.' });

        attacker.stats.currentEnergy -= 3;

        const attackerWithStats = calculateDerivedStatsOnServer(attacker, gameData.itemTemplates!, gameData.affixes!);
        const defenderWithStats = calculateDerivedStatsOnServer(defender, gameData.itemTemplates!, gameData.affixes!);

        const defenderAsEnemy: Enemy = {
            id: defenderId.toString(),
            name: defenderWithStats.name,
            description: `Level ${defenderWithStats.level} ${defenderWithStats.race} ${defenderWithStats.characterClass || ''}`.trim(),
            stats: {
                maxHealth: defenderWithStats.stats.maxHealth,
                minDamage: defenderWithStats.stats.minDamage,
                maxDamage: defenderWithStats.stats.maxDamage,
                armor: defenderWithStats.stats.armor,
                critChance: defenderWithStats.stats.critChance,
                critDamageModifier: defenderWithStats.stats.critDamageModifier,
                agility: defenderWithStats.stats.agility,
                maxMana: defenderWithStats.stats.maxMana,
                manaRegen: defenderWithStats.stats.manaRegen,
                magicDamageMin: defenderWithStats.stats.magicDamageMin,
                magicDamageMax: defenderWithStats.stats.magicDamageMax,
                attacksPerTurn: defenderWithStats.stats.attacksPerRound,
            },
            rewards: { minGold: 0, maxGold: 0, minExperience: 0, maxExperience: 0 },
            lootTable: [],
        };

        const combatLog = simulateCombat(attackerWithStats, defenderAsEnemy, gameData);
        const lastLog = combatLog[combatLog.length - 1];
        const isVictory = lastLog.enemyHealth <= 0;

        let goldStolen = 0;
        let expGained = 0;

        if (isVictory) {
            goldStolen = Math.min(defender.resources.gold, Math.floor(defender.resources.gold * 0.1));
            expGained = Math.floor(defender.experienceToNextLevel * 0.1);

            attacker.resources.gold += goldStolen;
            attacker.experience += expGained;
            attacker.pvpWins = (attacker.pvpWins || 0) + 1;

            defender.resources.gold -= goldStolen;
            defender.pvpLosses = (defender.pvpLosses || 0) + 1;
        } else {
            attacker.pvpLosses = (attacker.pvpLosses || 0) + 1;
            defender.pvpWins = (defender.pvpWins || 0) + 1;
        }

        const pvpProtectionMinutes = gameData.settings?.pvpProtectionMinutes || 60;
        defender.pvpProtectionUntil = Date.now() + pvpProtectionMinutes * 60 * 1000;
        
        while (attacker.experience >= attacker.experienceToNextLevel) {
            attacker.experience -= attacker.experienceToNextLevel;
            attacker.level += 1;
            attacker.stats.statPoints += 1;
            attacker.experienceToNextLevel = Math.floor(100 * Math.pow(attacker.level, 1.3));
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [attacker, attackerId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [defender, defenderId]);

        const summary: PvpRewardSummary = {
            gold: goldStolen,
            experience: expGained,
            combatLog,
            isVictory,
            attacker: attackerWithStats,
            defender: defenderWithStats
        };

        // Create messages for both players
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, subject, body, message_type) VALUES ($1, $2, $3, $4, 'pvp_report')`,
            [attackerId, "System", `Raport z ataku: Zaatakowałeś ${defender.name}!`, JSON.stringify(summary)]
        );
         await client.query(
            `INSERT INTO messages (recipient_id, sender_name, subject, body, message_type) VALUES ($1, $2, $3, $4, 'pvp_report')`,
            [defenderId, "System", `Zostałeś zaatakowany przez ${attacker.name}!`, JSON.stringify(summary)]
        );

        await client.query('COMMIT');

        res.json({ summary, updatedAttacker: attacker });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during PvP attack:', err);
        res.status(500).json({ message: 'Server error during attack.' });
    } finally {
        client.release();
    }
});

export default router;