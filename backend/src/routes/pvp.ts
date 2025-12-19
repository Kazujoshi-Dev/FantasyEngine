import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, GameData, PvpRewardSummary, Enemy, Race, CharacterClass, GuildBuff, CombatType } from '../types.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';
import { simulate1v1Combat } from '../logic/combat/simulations/index.js';
import { enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

router.post('/attack/:defenderId', authenticateToken, async (req: any, res: any) => {
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

        // Modified queries to fetch guild building info for barracks bonus
        const attackerRes = await client.query(`
            SELECT c.data, g.buildings, g.active_buffs
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [attackerId]);

        const defenderRes = await client.query(`
            SELECT c.data, g.buildings, g.active_buffs
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [defenderId]);

        if (attackerRes.rows.length === 0 || defenderRes.rows.length === 0) {
            return res.status(404).json({ message: 'Player not found.' });
        }

        let attacker: PlayerCharacter = attackerRes.rows[0].data;
        const attackerBarracks = attackerRes.rows[0].buildings?.barracks || 0;
        const attackerShrine = attackerRes.rows[0].buildings?.shrine || 0;
        const attackerBuffs: GuildBuff[] = attackerRes.rows[0].active_buffs || [];

        let defender: PlayerCharacter = defenderRes.rows[0].data;
        const defenderBarracks = defenderRes.rows[0].buildings?.barracks || 0;
        const defenderShrine = defenderRes.rows[0].buildings?.shrine || 0;
        const defenderBuffs: GuildBuff[] = defenderRes.rows[0].active_buffs || [];

        // Validation
        if (Math.abs(attacker.level - defender.level) > 3) return res.status(400).json({ message: 'Level difference is too high.' });
        if (attacker.stats.currentEnergy < 3) return res.status(400).json({ message: 'Not enough energy.' });
        if (defender.pvpProtectionUntil > Date.now()) return res.status(400).json({ message: 'Target is protected.' });

        attacker.stats.currentEnergy -= 3;

        // Apply guild bonuses to stats
        const attackerWithStats = calculateDerivedStatsOnServer(attacker, gameData.itemTemplates!, gameData.affixes!, attackerBarracks, attackerShrine, gameData.skills || [], attackerBuffs);
        const defenderWithStats = calculateDerivedStatsOnServer(defender, gameData.itemTemplates!, gameData.affixes!, defenderBarracks, defenderShrine, gameData.skills || [], defenderBuffs);

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
                dodgeChance: defenderWithStats.stats.dodgeChance,
                maxMana: defenderWithStats.stats.maxMana,
                manaRegen: defenderWithStats.stats.manaRegen,
                magicDamageMin: defenderWithStats.stats.magicDamageMin,
                magicDamageMax: defenderWithStats.stats.magicDamageMax,
                attacksPerTurn: defenderWithStats.stats.attacksPerRound,
                // Default values for EnemyStats required properties
                magicAttackChance: 0,
                magicAttackManaCost: 0,
            },
            rewards: { minGold: 0, maxGold: 0, minExperience: 0, maxExperience: 0 },
            lootTable: [],
            resourceLootTable: [],
            isBoss: false // Mandatory now
        };

        const combatLog = simulate1v1Combat(attackerWithStats, defenderAsEnemy, gameData);
        const lastLog = combatLog[combatLog.length - 1];
        const isVictory = lastLog.enemyHealth <= 0;

        let goldStolen = 0;
        let expGained = 0;

        if (isVictory) {
            goldStolen = Math.min(defender.resources.gold, Math.floor(defender.resources.gold * 0.1));
            expGained = Math.floor(defender.experienceToNextLevel * 0.1);

            // Rogue Class Bonus (+100% XP)
            if (attacker.characterClass === CharacterClass.Rogue) {
                expGained *= 2;
            }
            // Human Race Bonus (+10% XP)
            if (attacker.race === Race.Human) {
                expGained = Math.floor(expGained * 1.10);
            }

            attacker.resources.gold = (Number(attacker.resources.gold) || 0) + goldStolen;
            attacker.experience = (Number(attacker.experience) || 0) + expGained;
            attacker.pvpWins = (attacker.pvpWins || 0) + 1;

            // Druid Bonus: Heal 50% max HP on win
            if (attacker.characterClass === CharacterClass.Druid) {
                const maxHealth = attackerWithStats.stats.maxHealth;
                attacker.stats.currentHealth = Math.min(maxHealth, attacker.stats.currentHealth + maxHealth * 0.5);
            }

            defender.resources.gold = (Number(defender.resources.gold) || 0) - goldStolen;
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
            attacker.stats.statPoints += 2; // Updated to 2
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
            defender: defenderWithStats,
            combatType: CombatType.PVP
        };

        // Create messages for both players with limit enforcement
        await enforceInboxLimit(client, attackerId);
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, subject, body, message_type) VALUES ($1, $2, $3, $4, 'pvp_report')`,
            [attackerId, "System", `Raport z ataku: Zaatakowałeś ${defender.name}!`, JSON.stringify(summary)]
        );

        await enforceInboxLimit(client, defenderId);
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