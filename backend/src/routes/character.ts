
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, ActiveTowerRun, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, SkillCost, EssenceType, CharacterClass, CharacterResources, EquipmentLoadout, GuildBuff, Skill, SkillType, SkillCategory } from '../types.js';
import { getCampUpgradeCost, getTreasuryUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getTreasuryCapacity, calculateDerivedStatsOnServer, getWarehouseCapacity } from '../logic/stats.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';
import { pruneExpiredBuffs } from '../logic/guilds.js';

const router = express.Router();

// GET /api/character - Get Character Data
router.get('/', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`
            SELECT 
                c.data,
                u.email,
                g.buildings,
                g.active_buffs,
                g.id as guild_id,
                (
                    SELECT row_to_json(tr) 
                    FROM tower_runs tr 
                    WHERE tr.user_id = c.user_id AND tr.status = 'IN_PROGRESS'
                    LIMIT 1
                ) as active_tower_run
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
        const activeRunDB = row.active_tower_run;

        if (row.email) {
            charData.email = row.email;
        }

        if (row.guild_id) {
            charData.guildId = row.guild_id;
            charData.guildBarracksLevel = row.buildings?.barracks || 0;
            charData.guildShrineLevel = row.buildings?.shrine || 0;
            
            // --- LAZY PRUNING OF BUFFS FOR CHARACTER LOAD ---
            const { pruned, wasModified } = pruneExpiredBuffs(row.active_buffs || []);
            if (wasModified) {
                await client.query('UPDATE guilds SET active_buffs = $1 WHERE id = $2', [JSON.stringify(pruned), row.guild_id]);
                charData.activeGuildBuffs = pruned;
            } else {
                charData.activeGuildBuffs = row.active_buffs || [];
            }
            // -----------------------------------------------
        } else {
            charData.guildId = undefined;
            charData.guildBarracksLevel = 0;
            charData.guildShrineLevel = 0;
            charData.activeGuildBuffs = [];
        }

        if (activeRunDB) {
            const mappedRun: ActiveTowerRun = {
                id: activeRunDB.id,
                userId: activeRunDB.user_id,
                towerId: activeRunDB.tower_id,
                currentFloor: activeRunDB.current_floor,
                currentHealth: activeRunDB.current_health,
                currentMana: activeRunDB.current_mana,
                accumulatedRewards: activeRunDB.accumulated_rewards,
                status: activeRunDB.status
            };
            charData.activeTowerRun = mappedRun;
        } else {
            charData.activeTowerRun = undefined;
        }

        await client.query('COMMIT');
        res.json(charData);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch character' });
    } finally {
        client.release();
    }
});

// ==========================================
//               STATS & SKILLS
// ==========================================

router.post('/stats', authenticateToken, async (req: any, res: any) => {
    const { stats } = req.body; // Partial stats to add
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        let totalPointsToSpend = 0;
        for (const [key, value] of Object.entries(stats)) {
            const points = parseInt(value as string, 10);
            if (points > 0) {
                (character.stats as any)[key] += points;
                totalPointsToSpend += points;
            }
        }

        if (character.stats.statPoints < totalPointsToSpend) {
            throw new Error("Niewystarczająca liczba punktów umiejętności.");
        }

        character.stats.statPoints -= totalPointsToSpend;

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

router.post('/reset-stats', authenticateToken, async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Postać nie znaleziona.");
        const character: PlayerCharacter = charRes.rows[0].data;

        const primaryStatKeys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
        
        let pointsToReturn = 0;
        primaryStatKeys.forEach(key => {
            const currentVal = character.stats[key] || 1;
            if (currentVal > 1) {
                pointsToReturn += (currentVal - 1);
                character.stats[key] = 1;
            }
        });

        // Use optional property resetsUsed from fixed PlayerCharacter interface
        const resetsUsed = character.resetsUsed || 0;
        let cost = 0;
        if (resetsUsed > 0) {
            cost = pointsToReturn * 1000;
        }

        if (character.resources.gold < cost) {
            throw new Error(`Niewystarczająca ilość złota. Wymagane: ${cost.toLocaleString()} g.`);
        }

        character.resources.gold -= cost;
        character.stats.statPoints += pointsToReturn;
        // Increment resetsUsed
        character.resetsUsed = resetsUsed + 1;

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

router.post('/skills/learn', authenticateToken, async (req: any, res: any) => {
    const { skillId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Get Character
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        // 2. Get Skill Data
        const skillsRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        const skills: Skill[] = skillsRes.rows[0]?.data || [];
        const skill = skills.find(s => s.id === skillId);

        if (!skill) throw new Error("Umiejętność nie istnieje.");
        if (character.learnedSkills?.includes(skillId)) throw new Error("Już znasz tę umiejętność.");

        // 3. Check Requirements
        if (skill.requirements) {
            if (skill.requirements.level && character.level < skill.requirements.level) throw new Error("Zbyt niski poziom.");
            if (skill.requirements.characterClass && character.characterClass !== skill.requirements.characterClass) throw new Error("Nieodpowiednia klasa.");
            if (skill.requirements.race && character.race !== skill.requirements.race) throw new Error("Nieodpowiednia rasa.");
            
            const statsToCheck = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
            for (const s of statsToCheck) {
                const reqVal = (skill.requirements as any)[s];
                if (reqVal && (character.stats as any)[s] < reqVal) throw new Error(`Wymagana większa wartość atrybutu: ${s}`);
            }
        }

        // 4. Check & Deduct Cost
        if (skill.cost) {
            if (skill.cost.gold && character.resources.gold < skill.cost.gold) throw new Error("Za mało złota.");
            const essences: EssenceType[] = Object.values(EssenceType);
            for (const e of essences) {
                const reqEss = (skill.cost as any)[e];
                if (reqEss && (character.resources as any)[e] < reqEss) throw new Error(`Za mało esencji: ${e}`);
            }

            // Perform deduction
            if (skill.cost.gold) character.resources.gold -= skill.cost.gold;
            for (const e of essences) {
                const reqEss = (skill.cost as any)[e];
                if (reqEss) (character.resources as any)[e] -= reqEss;
            }
        }

        // 5. Learn
        if (!character.learnedSkills) character.learnedSkills = [];
        character.learnedSkills.push(skillId);

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

router.post('/skills/toggle', authenticateToken, async (req: any, res: any) => {
    const { skillId, isActive } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.learnedSkills?.includes(skillId)) {
            throw new Error("Nie znasz tej umiejętności.");
        }

        if (!character.activeSkills) character.activeSkills = [];

        if (isActive) {
            if (!character.activeSkills.includes(skillId)) {
                character.activeSkills.push(skillId);
            }
        } else {
            character.activeSkills = character.activeSkills.filter(id => id !== skillId);
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

// Added default export for router
export default router;
