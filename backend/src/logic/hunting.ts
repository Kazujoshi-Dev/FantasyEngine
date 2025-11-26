import { pool } from '../db.js';
import { PartyStatus, PartyMemberStatus, HuntingParty, PlayerCharacter, GameData, Enemy, ItemTemplate, Affix, EssenceType, ItemInstance, CharacterClass, ExpeditionRewardSummary } from '../types.js';
import { calculateDerivedStatsOnServer } from './stats.js';
import { simulateTeamVsBossCombat } from './combat/simulations.js';
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

export const processPartyCombat = async (party: HuntingParty, gameData: GameData, client: any): Promise<void> => {
    // 1. Gather Character Data
    const acceptedMembers = party.members.filter(m => m.status !== PartyMemberStatus.Pending);
    const playerCombatants: PlayerCharacter[] = [];
    const rawCharactersMap: Record<number, PlayerCharacter> = {};
    
    for (const member of acceptedMembers) {
        const res = await client.query('SELECT data FROM characters WHERE user_id = $1', [member.userId]);
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
    const { combatLog, finalPlayers } = simulateTeamVsBossCombat(playerCombatants, bossTemplate, gameData);
    const lastEntry = combatLog[combatLog.length - 1];
    const isVictory = lastEntry.enemyHealth <= 0;

    // 3.5 Update player health from combat results
    for (const finalPlayerState of finalPlayers) {
        const member = acceptedMembers.find(m => m.characterName === finalPlayerState.data.name);
        if(member) {
            const charToUpdate = rawCharactersMap[member.userId];
            if (charToUpdate) {
                // Apply the final health from the combat simulation. Ensure it's not negative.
                charToUpdate.stats.currentHealth = Math.max(0, finalPlayerState.currentHealth);
                charToUpdate.stats.currentMana = Math.max(0, finalPlayerState.currentMana);
            }
        }
    }

    // 4. Calculate Rewards and Save State (Individually)
    const rewardsMap: Record<number, { gold: number, experience: number, items: ItemInstance[], essences: Partial<Record<EssenceType, number>> }> = {};
    const allRewardsForReport: Record<string, { gold: number; experience: number }> = {};

    if (isVictory) {
        // Reward Logic: Total Pool = BaseReward * PlayerCount * 1.5
        const bossBonusMultiplier = 1.5; 

        const minGold = bossTemplate.rewards.minGold;
        const maxGold = bossTemplate.rewards.maxGold;
        const rolledGold = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
        const totalPoolGold = rolledGold * playerCombatants.length * bossBonusMultiplier;

        const minExp = bossTemplate.rewards.minExperience;
        const maxExp = bossTemplate.rewards.maxExperience;
        const rolledExp = Math.floor(Math.random() * (maxExp - minExp + 1)) + minExp;
        const totalPoolExp = rolledExp * playerCombatants.length * bossBonusMultiplier;

        const splitGold = Math.floor(totalPoolGold / playerCombatants.length);
        const splitExp = Math.floor(totalPoolExp / playerCombatants.length);

        // FIRST LOOP: Calculate rewards for all members and update their characters in DB.
        for (const userIdStr of Object.keys(rawCharactersMap)) {
            const userId = parseInt(userIdStr, 10);
            const char = rawCharactersMap[userId];

            const finalState = finalPlayers.find(p => p.data.name === char.name);
            const isDefeated = !finalState || finalState.isDead;
            const rewardMultiplier = isDefeated ? 0.5 : 1.0;
            
            let finalGold = Math.floor(splitGold * rewardMultiplier);
            let finalExp = Math.floor(splitExp * rewardMultiplier);

            // Bonuses
            if (char.race === 'Gnome') finalGold = Math.floor(finalGold * 1.2);
            if (char.characterClass === 'Thief') finalGold = Math.floor(finalGold * 1.25);
            if (char.race === 'Human') finalExp = Math.floor(finalExp * 1.1);
            
            // Loot is only for survivors
            const itemsFound: ItemInstance[] = [];
            const essencesFound: Partial<Record<EssenceType, number>> = {};
            if (!isDefeated) {
                const backpackCap = getBackpackCapacity(char);
                for (const drop of (bossTemplate.lootTable || [])) {
                    if (Math.random() * 100 < drop.chance) {
                        if (char.inventory.length + itemsFound.length < backpackCap) {
                            itemsFound.push(createItemInstance(drop.templateId, gameData.itemTemplates, gameData.affixes));
                        }
                    }
                }
                for (const drop of (bossTemplate.resourceLootTable || [])) {
                    if (Math.random() * 100 < drop.chance) {
                        let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                         if(char.characterClass === 'Engineer' && Math.random() < 0.5) amount *= 2;
                        essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
                    }
                }
            }
            
            rewardsMap[userId] = { gold: finalGold, experience: finalExp, items: itemsFound, essences: essencesFound };
            allRewardsForReport[char.name] = { gold: finalGold, experience: finalExp };

            // Update Character object in memory
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

            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        }
        
        // SECOND LOOP: Now that allRewardsForReport is complete, send the same report to everyone.
        for (const userIdStr of Object.keys(rawCharactersMap)) {
            const userId = parseInt(userIdStr, 10);
            const char = rawCharactersMap[userId];
            const finalState = finalPlayers.find(p => p.data.name === char.name);
            const isDefeated = !finalState || finalState.isDead;
            const userRewards = rewardsMap[userId];
            
            const breakdownSource = isDefeated 
                ? `Polowanie na Bossa: ${bossTemplate.name} (Pokonany, 50% nagrody)`
                : `Polowanie na Bossa: ${bossTemplate.name}`;
            
            const summary: ExpeditionRewardSummary = {
                isVictory: true, 
                totalGold: userRewards.gold, 
                totalExperience: userRewards.experience, 
                combatLog,
                itemsFound: userRewards.items, 
                essencesFound: userRewards.essences,
                rewardBreakdown: [{ source: breakdownSource, gold: userRewards.gold, experience: userRewards.experience }],
                huntingMembers: acceptedMembers.map(({ stats, ...member }) => member), // Strip runtime stats
                allRewards: allRewardsForReport, // This map is now complete for all players
                bossId: bossTemplate.id
            };
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                [userId, `Raport z Polowania: ${bossTemplate.name}`, JSON.stringify(summary)]
            );
        }
    } else {
        // Handle defeat: save updated health and send messages
        for (const userIdStr of Object.keys(rawCharactersMap)) {
            const userId = parseInt(userIdStr, 10);
            const char = rawCharactersMap[userId];
            
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);

             const summary: ExpeditionRewardSummary = {
                isVictory: false, totalGold: 0, totalExperience: 0, combatLog,
                itemsFound: [], essencesFound: {}, rewardBreakdown: [],
                huntingMembers: acceptedMembers.map(({ stats, ...member }) => member),
                allRewards: {},
                bossId: bossTemplate.id
            };
             await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                [userId, `Raport z Polowania: ${bossTemplate.name} (Porażka)`, JSON.stringify(summary)]
            );
        }
    }

    // 5. Update Party Status
    await client.query(`
        UPDATE hunting_parties 
        SET status = 'FINISHED', 
            combat_log = $1, 
            rewards = $2,
            victory = $3
        WHERE id = $4
    `, [JSON.stringify(combatLog), JSON.stringify(rewardsMap), isVictory, party.id]);
};

// Helper to convert snake_case DB rows to camelCase objects
export const camelizeParty = (row: any): HuntingParty => {
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
