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
    // 1. Gather Character Data for all accepted members
    const acceptedMembers = party.members.filter(m => m.status !== PartyMemberStatus.Pending);
    const playerCombatants: PlayerCharacter[] = [];
    const rawCharactersMap: Record<number, PlayerCharacter> = {};
    
    for (const member of acceptedMembers) {
        const res = await client.query('SELECT data FROM characters WHERE user_id = $1', [member.userId]);
        if (res.rows.length > 0) {
            const rawChar: PlayerCharacter = {
                // Provide defaults for potentially missing fields to ensure robustness
                inventory: [],
                resources: { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
                ...res.rows[0].data,
            };
            rawChar.id = member.userId; 
            rawCharactersMap[member.userId] = JSON.parse(JSON.stringify(rawChar));
            const combatChar = calculateDerivedStatsOnServer(rawChar, gameData.itemTemplates || [], gameData.affixes || []);
            playerCombatants.push(combatChar);
        }
    }

    if (playerCombatants.length === 0) {
        throw new Error('No valid players found to start combat.');
    }

    // 2. Get Boss Data
    const bossTemplate = (gameData.enemies || []).find(e => e.id === party.bossId);
    if (!bossTemplate) throw new Error(`Boss template with id ${party.bossId} not found.`);

    // 3. Simulate Combat
    const { combatLog, finalPlayers } = simulateTeamVsBossCombat(playerCombatants, bossTemplate, gameData);
    
    // FIX: Victory depends ONLY on boss health being <= 0. Previous condition required no players to be dead.
    const isVictory = bossTemplate ? combatLog[combatLog.length - 1]?.enemyHealth <= 0 : false;

    // 4. Update player health and mana from combat results
    for (const finalPlayerState of finalPlayers) {
        const charToUpdate = rawCharactersMap[finalPlayerState.data.id!];
        if (charToUpdate) {
            charToUpdate.stats.currentHealth = Math.max(0, finalPlayerState.currentHealth);
            charToUpdate.stats.currentMana = Math.max(0, finalPlayerState.currentMana);
        }
    }

    // 5. Calculate Rewards and Save State
    const rewardsMap: Record<number, { gold: number, experience: number, items: ItemInstance[], essences: Partial<Record<EssenceType, number>> }> = {};
    const allRewardsForReport: Record<string, { gold: number; experience: number }> = {};

    if (isVictory) {
        const bossBonusMultiplier = 1.5; 
        const rolledGold = Math.floor(Math.random() * ((bossTemplate.rewards.maxGold || 0) - (bossTemplate.rewards.minGold || 0) + 1)) + (bossTemplate.rewards.minGold || 0);
        const totalPoolGold = rolledGold * playerCombatants.length * bossBonusMultiplier;
        const rolledExp = Math.floor(Math.random() * ((bossTemplate.rewards.maxExperience || 0) - (bossTemplate.rewards.minExperience || 0) + 1)) + (bossTemplate.rewards.minExperience || 0);
        const totalPoolExp = rolledExp * playerCombatants.length * bossBonusMultiplier;
        const splitGold = Math.floor(totalPoolGold / playerCombatants.length);
        const splitExp = Math.floor(totalPoolExp / playerCombatants.length);

        for (const userId of Object.keys(rawCharactersMap).map(Number)) {
            const char = rawCharactersMap[userId];
            const finalState = finalPlayers.find(p => p.data.id === char.id);
            const isDefeated = !finalState || finalState.isDead;
            const rewardMultiplier = isDefeated ? 0.5 : 1.0;
            
            let finalGold = Math.floor(splitGold * rewardMultiplier);
            let finalExp = Math.floor(splitExp * rewardMultiplier);

            // Apply race/class bonuses to rewards
            if (char.race === 'Gnome') finalGold = Math.floor(finalGold * 1.2);
            if (char.characterClass === 'Thief') finalGold = Math.floor(finalGold * 1.25);
            if (char.race === 'Human') finalExp = Math.floor(finalExp * 1.1);
            
            const itemsFound: ItemInstance[] = [];
            const essencesFound: Partial<Record<EssenceType, number>> = {};
            if (!isDefeated) {
                const backpackCap = getBackpackCapacity(char);
                const combinedLootTable = [...(bossTemplate.lootTable || [])];

                // Dungeon Hunter Bonus Loot
                if (char.characterClass === CharacterClass.DungeonHunter && combinedLootTable.length > 0) {
                    if (Math.random() < 0.3) combinedLootTable.push(combinedLootTable[Math.floor(Math.random() * combinedLootTable.length)]);
                    if (Math.random() < 0.15) combinedLootTable.push(combinedLootTable[Math.floor(Math.random() * combinedLootTable.length)]);
                }
                
                for (const drop of combinedLootTable) {
                    if (Math.random() * 100 < drop.chance) {
                        if ((char.inventory || []).length + itemsFound.length < backpackCap) {
                            itemsFound.push(createItemInstance(drop.templateId, gameData.itemTemplates || [], gameData.affixes || []));
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

            char.resources.gold = (Number(char.resources.gold) || 0) + finalGold;
            char.experience = (Number(char.experience) || 0) + finalExp;
            char.inventory.push(...itemsFound);
            for(const [key, val] of Object.entries(essencesFound)) {
                 char.resources[key as EssenceType] = (char.resources[key as EssenceType] || 0) + (val || 0);
            }
            
            // Druid post-combat heal
            if (char.characterClass === CharacterClass.Druid) {
                const derivedAfterCombat = calculateDerivedStatsOnServer(char, gameData.itemTemplates || [], gameData.affixes || []);
                char.stats.currentHealth = Math.min(derivedAfterCombat.stats.maxHealth, char.stats.currentHealth + derivedAfterCombat.stats.maxHealth * 0.5);
            }
            
            // Level-up logic
            while (char.experience >= char.experienceToNextLevel) {
                char.experience -= char.experienceToNextLevel;
                char.level += 1;
                char.stats.statPoints += 1;
                char.experienceToNextLevel = Math.floor(100 * Math.pow(char.level, 1.3));
            }

            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        }
        
        // Send individual success messages
        for (const userId of Object.keys(rawCharactersMap).map(Number)) {
            const userRewards = rewardsMap[userId];
            const summary: ExpeditionRewardSummary = {
                isVictory: true, totalGold: userRewards.gold, totalExperience: userRewards.experience, combatLog,
                itemsFound: userRewards.items, essencesFound: userRewards.essences,
                rewardBreakdown: [{ source: `Polowanie na Bossa: ${bossTemplate.name}`, gold: userRewards.gold, experience: userRewards.experience }],
                huntingMembers: party.members, allRewards: allRewardsForReport, bossId: party.bossId
            };
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                [userId, `Raport z Polowania: ${bossTemplate.name}`, JSON.stringify(summary)]
            );
        }
    } else { // Defeat
         for (const userId of Object.keys(rawCharactersMap).map(Number)) {
            const charToUpdate = rawCharactersMap[userId];
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [charToUpdate, userId]);

            const summary: ExpeditionRewardSummary = {
                isVictory: false, totalGold: 0, totalExperience: 0, combatLog, itemsFound: [], essencesFound: {}, 
                rewardBreakdown: [], huntingMembers: party.members, bossId: party.bossId
            };
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                [userId, `Raport z Polowania: ${bossTemplate.name}`, JSON.stringify(summary)]
            );
         }
    }
    
    // 6. Finalize Party State
    await client.query(
        "UPDATE hunting_parties SET status = 'FINISHED', combat_log = $1, rewards = $2, victory = $3 WHERE id = $4",
        [JSON.stringify(combatLog), JSON.stringify(allRewardsForReport), isVictory, party.id]
    );
};

export const camelizeParty = (dbParty: any): HuntingParty => {
    return {
        id: dbParty.id,
        leaderId: dbParty.leader_id,
        bossId: dbParty.boss_id,
        maxMembers: dbParty.max_members,
        status: dbParty.status,
        startTime: dbParty.start_time,
        createdAt: dbParty.created_at,
        members: dbParty.members,
        combatLog: dbParty.combat_log,
        allRewards: dbParty.rewards,
        victory: dbParty.victory
    };
};