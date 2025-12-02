import { HuntingParty, PartyMember, GameData, ItemInstance, EssenceType, PlayerCharacter, Enemy, CharacterClass, Race, PartyStatus, EquipmentSlot } from '../types.js';
import { pool } from '../db.js';
import { simulateTeamVsBossCombat } from './combat/simulations.js';
import { createItemInstance } from './items.js';
import { getBackpackCapacity } from './helpers.js';
import { calculateDerivedStatsOnServer } from './stats.js';

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
        myRewards: undefined, // Populated later
        allRewards: row.rewards // Stored rewards
    };
};

export const getPartyByLeader = async (leaderId: number): Promise<HuntingParty | null> => {
    const res = await pool.query('SELECT * FROM hunting_parties WHERE leader_id = $1', [leaderId]);
    if (res.rows.length === 0) return null;
    return camelizeParty(res.rows[0]);
};

export const getPartyByMember = async (userId: number): Promise<HuntingParty | null> => {
    // Queries JSONB members array for userId
    const res = await pool.query(`
        SELECT * FROM hunting_parties 
        WHERE members @> jsonb_build_array(jsonb_build_object('userId', $1::int))
    `, [userId]);
    if (res.rows.length === 0) return null;
    return camelizeParty(res.rows[0]);
};

export const processPartyCombat = async (party: HuntingParty, gameData: GameData, client: any) => {
    const { members, bossId } = party;
    const bossTemplate = gameData.enemies.find(e => e.id === bossId);
    
    if (!bossTemplate) throw new Error("Boss template not found");

    // 1. Fetch all characters
    const userIds = members.map(m => m.userId);
    // We need to lock these characters to update them later
    // Sorting userIds to avoid deadlocks is good practice, though less critical for single query
    const sortedUserIds = [...userIds].sort((a,b) => a - b);
    
    // Fetch characters with FOR UPDATE to lock them
    // Note: client should already be in transaction from the route handler calling this
    const charsRes = await client.query(
        `SELECT data, user_id, g.buildings 
         FROM characters c
         LEFT JOIN guild_members gm ON c.user_id = gm.user_id
         LEFT JOIN guilds g ON gm.guild_id = g.id
         WHERE c.user_id = ANY($1) 
         FOR UPDATE OF c`, 
        [sortedUserIds]
    );
    
    const rawCharactersMap: Record<number, PlayerCharacter> = {};
    charsRes.rows.forEach((row: any) => {
        let charData = row.data as PlayerCharacter;
        // Defensive initialization to prevent crashes from legacy/corrupted character data
        if (!charData.resources) charData.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
        if (!charData.inventory) charData.inventory = [];
        if (!charData.questProgress) charData.questProgress = [];
        if (!charData.acceptedQuests) charData.acceptedQuests = [];
        if (!charData.equipment) charData.equipment = { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null };

        rawCharactersMap[row.user_id] = charData;
        rawCharactersMap[row.user_id].guildBarracksLevel = row.buildings?.barracks || 0;
        rawCharactersMap[row.user_id].id = row.user_id; // Ensure ID is present
    });

    const playerCharacters: PlayerCharacter[] = [];
    
    // Calculate derived stats for everyone
    for (const member of members) {
        const rawChar = rawCharactersMap[member.userId];
        if (rawChar) {
            // Recalculate stats with server authority
            const derived = calculateDerivedStatsOnServer(rawChar, gameData.itemTemplates, gameData.affixes, rawChar.guildBarracksLevel);
            // Ensure full health/mana for the fight simulation start (or keep current? logic says full for now or current?)
            // Hunting usually assumes prepared adventurers. Let's use currentHealth but ensure it's not buggy.
            playerCharacters.push(derived);
        }
    }

    // 2. Prepare Boss (Scale stats if needed)
    // Boss stats might scale with party size if desired, but usually fixed for specific boss ID.
    // If we want dynamic scaling:
    const partySizeMultiplier = 1.0; 
    
    const bossEntity: Enemy = {
        ...bossTemplate,
        stats: {
            ...bossTemplate.stats,
            maxHealth: Math.floor(bossTemplate.stats.maxHealth * partySizeMultiplier),
            // Scale other stats if needed
        }
    };

    // 3. Simulate Combat
    const { combatLog, finalPlayers } = simulateTeamVsBossCombat(playerCharacters, bossEntity, gameData);
    
    // 4. Update Characters State (Health, Mana, Death)
    // We update the RAW characters with the results
    for (const finalState of finalPlayers) {
        const userId = finalState.data.id!;
        const rawChar = rawCharactersMap[userId];
        
        rawChar.stats.currentHealth = Math.max(0, finalState.currentHealth);
        rawChar.stats.currentMana = Math.max(0, finalState.currentMana);
    }

    const isVictory = combatLog[combatLog.length - 1].action === 'enemy_death';

    // 5. Calculate Rewards and Save State
    const allRewardsForReport: Record<string, { gold: number; experience: number; items?: ItemInstance[]; essences?: Partial<Record<EssenceType, number>> }> = {};

    if (isVictory) {
        // Scale multiplier by party size to reward group play against scaled bosses
        // 1 Player: 1.3x, 5 Players: 2.5x
        const bossBonusMultiplier = 1.0 + (playerCharacters.length * 0.3);

        // Rewards use base template stats for range, but multiplied by pool count
        const rolledGold = Math.floor(Math.random() * ((bossTemplate.rewards.maxGold || 0) - (bossTemplate.rewards.minGold || 0) + 1)) + (bossTemplate.rewards.minGold || 0);
        const totalPoolGold = rolledGold * playerCharacters.length * bossBonusMultiplier;
        const rolledExp = Math.floor(Math.random() * ((bossTemplate.rewards.maxExperience || 0) - (bossTemplate.rewards.minExperience || 0) + 1)) + (bossTemplate.rewards.minExperience || 0);
        const totalPoolExp = rolledExp * playerCharacters.length * bossBonusMultiplier;
        
        const splitGold = Math.floor(totalPoolGold / playerCharacters.length);
        const splitExp = Math.floor(totalPoolExp / playerCharacters.length);

        for (const userId of Object.keys(rawCharactersMap).map(Number)) {
            const char = rawCharactersMap[userId];
            const finalState = finalPlayers.find(p => p.data.id === char.id);
            const isDefeated = !finalState || finalState.isDead;
            const rewardMultiplier = isDefeated ? 0.5 : 1.0;
            
            let finalGold = Math.floor(splitGold * rewardMultiplier);
            let finalExp = Math.floor(splitExp * rewardMultiplier);

            // Apply race/class bonuses to rewards
            if (char.race === Race.Human) finalExp = Math.floor(finalExp * 1.10);
            if (char.race === Race.Gnome) finalGold = Math.floor(finalGold * 1.20);
            if (char.characterClass === CharacterClass.Thief) finalGold = Math.floor(finalGold * 1.25);

            char.resources.gold += finalGold;
            char.experience += finalExp;
            
            // Level up check
            while (char.experience >= char.experienceToNextLevel) {
                char.experience -= char.experienceToNextLevel;
                char.level += 1;
                char.stats.statPoints += 1;
                char.experienceToNextLevel = Math.floor(100 * Math.pow(char.level, 1.3));
            }

            // Loot Generation
            const items: ItemInstance[] = [];
            const essences: Partial<Record<EssenceType, number>> = {};
            const backpackCap = getBackpackCapacity(char);

            // Loot drops are individual chance per player
            const allLootTables = [...(bossTemplate.lootTable || [])];
            // Dungeon Hunter bonus
            if(char.characterClass === CharacterClass.DungeonHunter && allLootTables.length > 0) {
                if (Math.random() < 0.3) {
                     const extraDrop = allLootTables[Math.floor(Math.random() * allLootTables.length)];
                     if(extraDrop) allLootTables.push({ ...extraDrop, chance: 100 });
                }
            }

            for (const drop of allLootTables) {
                if (Math.random() * 100 < drop.chance) {
                    if (char.inventory.length + items.length < backpackCap) {
                        const newItem = createItemInstance(drop.templateId, gameData.itemTemplates, gameData.affixes);
                        char.inventory.push(newItem);
                        items.push(newItem);
                    }
                }
            }

            // Resource drops
            for (const drop of (bossTemplate.resourceLootTable || [])) {
                if (Math.random() * 100 < drop.chance) {
                    let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    if(char.characterClass === CharacterClass.Engineer && Math.random() < 0.5) amount *= 2;
                    
                    char.resources[drop.resource] = (char.resources[drop.resource] || 0) + amount;
                    essences[drop.resource] = (essences[drop.resource] || 0) + amount;
                }
            }

            allRewardsForReport[char.name] = { gold: finalGold, experience: finalExp, items, essences };
        }
    }

    // 6. Persist updates
    for (const userId of Object.keys(rawCharactersMap).map(Number)) {
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [rawCharactersMap[userId], userId]);
    }

    // 7. Update Party Record
    await client.query(
        `UPDATE hunting_parties 
         SET status = $1, combat_log = $2, rewards = $3, victory = $4
         WHERE id = $5`,
        [
            PartyStatus.Finished, 
            JSON.stringify(combatLog), 
            JSON.stringify(allRewardsForReport), 
            isVictory,
            party.id
        ]
    );
};
