
import { pool } from '../db.js';
import { PartyStatus, PartyMemberStatus, HuntingParty, PlayerCharacter, GameData, Enemy, ItemTemplate, Affix, EssenceType, ItemInstance, CharacterClass, ExpeditionRewardSummary } from '../types.js';
import { calculateDerivedStatsOnServer } from './stats.js';
import { simulateTeamCombat } from './combat.js';
import { createItemInstance } from './items.js';
import { getBackpackCapacity } from './helpers.js';

export const getPartyByLeader = async (leaderId: number): Promise<HuntingParty | null> => {
    const res = await pool.query('SELECT * FROM hunting_parties WHERE leader_id = $1', [leaderId]);
    if (res.rows.length === 0) return null;
    return camelizeParty(res.rows[0]);
};

export const getPartyByMember = async (userId: number): Promise<HuntingParty | null> => {
    const res = await pool.query(`
        SELECT p.* 
        FROM hunting_parties p, 
        jsonb_array_elements(p.members) AS member 
        WHERE (member->>'userId')::int = $1
    `, [userId]);
    
    if (res.rows.length === 0) return null;
    return camelizeParty(res.rows[0]);
};

export const processPartyCombat = async (party: HuntingParty, gameData: GameData): Promise<HuntingParty> => {
    // 1. Gather Character Data
    const acceptedMembers = party.members.filter(m => m.status !== PartyMemberStatus.Pending);
    const playerCombatants: PlayerCharacter[] = [];
    const rawCharactersMap: Record<number, PlayerCharacter> = {};
    
    for (const member of acceptedMembers) {
        const res = await pool.query('SELECT data FROM characters WHERE user_id = $1', [member.userId]);
        if (res.rows.length > 0) {
            const rawChar = res.rows[0].data;
            // Deep copy raw char to ensure we have a clean version to save back to DB later
            rawCharactersMap[member.userId] = JSON.parse(JSON.stringify(rawChar));

            // Create a derived version ONLY for combat simulation
            const combatChar = calculateDerivedStatsOnServer(rawChar, gameData.itemTemplates, gameData.affixes);
            playerCombatants.push(combatChar);
        }
    }

    // 2. Get Boss Data
    const bossTemplate = gameData.enemies.find(e => e.id === party.bossId);
    if (!bossTemplate) throw new Error('Boss not found');

    // 3. Simulate Combat using derived stats
    const combatLog = simulateTeamCombat(playerCombatants, bossTemplate, gameData);
    const lastEntry = combatLog[combatLog.length - 1];
    const isVictory = lastEntry.enemyHealth <= 0;

    // 4. Calculate Rewards (Individually)
    const rewardsMap: Record<number, { gold: number, experience: number, items: ItemInstance[], essences: Partial<Record<EssenceType, number>> }> = {};

    if (isVictory) {
        // Randomize rewards within range, then multiply by 2 for Boss bonus
        const minGold = bossTemplate.rewards.minGold;
        const maxGold = bossTemplate.rewards.maxGold;
        const rolledGold = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
        const baseGold = rolledGold * 2;

        const minExp = bossTemplate.rewards.minExperience;
        const maxExp = bossTemplate.rewards.maxExperience;
        const rolledExp = Math.floor(Math.random() * (maxExp - minExp + 1)) + minExp;
        const baseExp = rolledExp * 2;

        const splitGold = Math.floor(baseGold / playerCombatants.length);
        const splitExp = Math.floor(baseExp / playerCombatants.length);

        // Iterate over raw characters to apply rewards to the clean state
        for (const userIdStr of Object.keys(rawCharactersMap)) {
            const userId = parseInt(userIdStr, 10);
            const char = rawCharactersMap[userId];
            
            let finalGold = splitGold;
            let finalExp = splitExp;

            // Bonuses
            if (char.race === 'Gnome') finalGold = Math.floor(finalGold * 1.2);
            if (char.characterClass === 'Thief') finalGold = Math.floor(finalGold * 1.25);
            if (char.race === 'Human') finalExp = Math.floor(finalExp * 1.1);
            
            // Individual Loot Roll
            const itemsFound: ItemInstance[] = [];
            const essencesFound: Partial<Record<EssenceType, number>> = {};
            const backpackCap = getBackpackCapacity(char);
            
            // Use Boss Loot Table
            for (const drop of (bossTemplate.lootTable || [])) {
                if (Math.random() * 100 < drop.chance) {
                    if (char.inventory.length + itemsFound.length < backpackCap) {
                        itemsFound.push(createItemInstance(drop.templateId, gameData.itemTemplates, gameData.affixes));
                    }
                }
            }
            
            // Use Boss Resource Table
             for (const drop of (bossTemplate.resourceLootTable || [])) {
                if (Math.random() * 100 < drop.chance) {
                    let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                     if(char.characterClass === 'Engineer' && Math.random() < 0.5) amount *= 2;
                    essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
                }
            }
            
            rewardsMap[userId] = { gold: finalGold, experience: finalExp, items: itemsFound, essences: essencesFound };

            // Update Character in DB (Using the RAW char, not the combat one)
            char.resources.gold = (Number(char.resources.gold) || 0) + finalGold;
            char.experience = (Number(char.experience) || 0) + finalExp;
            char.inventory.push(...itemsFound);
            for(const [key, val] of Object.entries(essencesFound)) {
                 char.resources[key as EssenceType] = (char.resources[key as EssenceType] || 0) + (val as number);
            }
            
            // Level Up Check
            while (char.experience >= char.experienceToNextLevel) {
                char.experience -= char.experienceToNextLevel;
                char.level += 1;
                char.stats.statPoints += 1;
                char.experienceToNextLevel = Math.floor(100 * Math.pow(char.level, 1.3));
            }

            await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);

            // Send Message Report
            const summary: ExpeditionRewardSummary = {
                isVictory: true,
                totalGold: finalGold,
                totalExperience: finalExp,
                combatLog: combatLog, // Full log might be heavy, but required for replay
                itemsFound: itemsFound,
                essencesFound: essencesFound,
                rewardBreakdown: [{ source: `Polowanie na Bossa: ${bossTemplate.name}`, gold: finalGold, experience: finalExp }]
            };

            // Do NOT JSON.stringify summary for JSONB column if using pg driver with object support
            await pool.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                 VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                [userId, `Raport z Polowania: ${bossTemplate.name}`, summary]
            );
        }
    } else {
        // Handle defeat messages (no rewards)
        for (const userIdStr of Object.keys(rawCharactersMap)) {
            const userId = parseInt(userIdStr, 10);
             const summary: ExpeditionRewardSummary = {
                isVictory: false,
                totalGold: 0,
                totalExperience: 0,
                combatLog: combatLog,
                itemsFound: [],
                essencesFound: {},
                rewardBreakdown: []
            };

            // Do NOT JSON.stringify summary
             await pool.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                 VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                [userId, `Raport z Polowania: ${bossTemplate.name} (Porażka)`, summary]
            );
        }
    }

    // 5. Update Party Status
    await pool.query(`
        UPDATE hunting_parties 
        SET status = 'FINISHED', 
            combat_log = $1, 
            rewards = $2,
            victory = $3
        WHERE id = $4
    `, [JSON.stringify(combatLog), JSON.stringify(rewardsMap), isVictory, party.id]);

    return {
        ...party,
        status: PartyStatus.Finished,
        combatLog: combatLog,
        victory: isVictory,
        // Note: we don't return myRewards here, endpoint handles specific user filtering
    };
};

// Helper to convert snake_case DB rows to camelCase objects
const camelizeParty = (row: any): HuntingParty => {
    return {
        id: row.id,
        leaderId: row.leader_id,
        bossId: row.boss_id,
        maxMembers: row.max_members,
        status: row.status,
        startTime: row.start_time,
        createdAt: row.created_at,
        members: row.members,
        combatLog: row.combat_log,
        victory: row.victory,
        // rewards is internal, filtered by API
    };
};
