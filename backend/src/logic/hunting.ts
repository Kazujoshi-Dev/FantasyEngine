
import { pool } from '../db.js';
import { PartyStatus, PartyMemberStatus, HuntingParty, PlayerCharacter, GameData, Enemy, ItemTemplate, Affix, EssenceType, ItemInstance, CharacterClass, ExpeditionRewardSummary, CharacterResources, CharacterStats, GuildBuff } from '../types.js';
import { calculateDerivedStatsOnServer } from './stats.js';
import { simulateTeamVsBossCombat } from './combat/simulations/index.js';
import { createItemInstance } from './items.js';
import { getBackpackCapacity, enforceInboxLimit } from './helpers.js';

// ... (getPartyByLeader, getPartyByMember remain unchanged)
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
        // Updated query to fetch guild building data as well
        const res = await client.query(`
            SELECT c.data, g.buildings, g.active_buffs
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1
        `, [member.userId]);

        if (res.rows.length > 0) {
             const defaultStats: CharacterStats = {
                strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0, statPoints: 0,
                currentHealth: 1, maxHealth: 1, currentEnergy: 1, maxEnergy: 1, currentMana: 0, maxMana: 0,
                minDamage: 0, maxDamage: 1, magicDamageMin: 0, magicDamageMax: 0, critChance: 0, critDamageModifier: 150,
                armor: 0, armorPenetrationPercent: 0, armorPenetrationFlat: 0, attacksPerRound: 1, manaRegen: 0,
                lifeStealPercent: 0, lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0, dodgeChance: 0,
            };

            const rawChar: PlayerCharacter = {
                // Provide robust defaults for potentially missing fields to ensure stability
                inventory: [],
                resources: { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
                stats: defaultStats,
                equipment: { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
                ...res.rows[0].data,
            };

            rawChar.id = member.userId; 
            rawCharactersMap[member.userId] = JSON.parse(JSON.stringify(rawChar));
            
            const barracksLevel = res.rows[0].buildings?.barracks || 0;
            const shrineLevel = res.rows[0].buildings?.shrine || 0;
            const activeBuffs: GuildBuff[] = res.rows[0].active_buffs || [];
            
            // Pass barracks level, shrine level and active buffs to calculation
            const combatChar = calculateDerivedStatsOnServer(rawChar, gameData.itemTemplates || [], gameData.affixes || [], barracksLevel, shrineLevel, gameData.skills || [], activeBuffs);
            playerCombatants.push(combatChar);
        }
    }

    if (playerCombatants.length === 0) {
        throw new Error('No valid players found to start combat.');
    }

    // 2. Get Boss Data and Apply Scaling
    const originalBossTemplate = (gameData.enemies || []).find(e => e.id === party.bossId);
    if (!originalBossTemplate) throw new Error(`Boss template with id ${party.bossId} not found.`);

    // Clone boss to apply scaling and explicitly type it to avoid 'any'
    const bossTemplate: Enemy = JSON.parse(JSON.stringify(originalBossTemplate));
    
    // Scaling Logic: Matches Frontend
    // 1-2 Players: Base Stats (1.0x)
    // 3+ Players: +70% HP per player > 2, +10% DMG per player > 2
    const playerCount = playerCombatants.length;
    const healthMult = 1 + Math.max(0, playerCount - 2) * 0.7;
    const damageMult = 1 + Math.max(0, playerCount - 2) * 0.1;

    bossTemplate.stats.maxHealth = Math.floor(bossTemplate.stats.maxHealth * healthMult);
    bossTemplate.stats.minDamage = Math.floor(bossTemplate.stats.minDamage * damageMult);
    bossTemplate.stats.maxDamage = Math.floor(bossTemplate.stats.maxDamage * damageMult);
    if (bossTemplate.stats.magicDamageMin) {
        bossTemplate.stats.magicDamageMin = Math.floor(bossTemplate.stats.magicDamageMin * damageMult);
    }
    if (bossTemplate.stats.magicDamageMax) {
        bossTemplate.stats.magicDamageMax = Math.floor(bossTemplate.stats.magicDamageMax * damageMult);
    }

    // 3. Simulate Combat
    const { combatLog, finalPlayers } = simulateTeamVsBossCombat(playerCombatants, bossTemplate, gameData);
    
    // Victory depends ONLY on boss health being <= 0
    const isVictory = bossTemplate ? combatLog[combatLog.length - 1]?.enemyHealth <= 0 : false;

    // 5. Calculate Rewards and Save State
    const rewardsMap: Record<number, { gold: number, experience: number, items: ItemInstance[], essences: Partial<Record<EssenceType, number>> }> = {};
    const allRewardsForReport: Record<string, { gold: number; experience: number; items?: ItemInstance[]; essences?: Partial<Record<EssenceType, number>> }> = {};

    // Guild Tax Data Fetch
    let guildTaxRate = 0;
    let guildResources: any = null;
    if (party.guildId) {
        const guildRes = await client.query('SELECT resources, hunting_tax FROM guilds WHERE id = $1 FOR UPDATE', [party.guildId]);
        if (guildRes.rows.length > 0) {
            guildResources = guildRes.rows[0].resources;
            guildTaxRate = guildRes.rows[0].hunting_tax || 0;
        }
    }

    if (isVictory) {
        const bossBonusMultiplier = 1.0 + (playerCombatants.length * 0.3);
        // Rewards use base template stats for range, but multiplied by pool count
        const rolledGold = Math.floor(Math.random() * ((originalBossTemplate.rewards.maxGold || 0) - (originalBossTemplate.rewards.minGold || 0) + 1)) + (originalBossTemplate.rewards.minGold || 0);
        const totalPoolGold = rolledGold * bossBonusMultiplier;
        const rolledExp = Math.floor(Math.random() * ((originalBossTemplate.rewards.maxExperience || 0) - (originalBossTemplate.rewards.minExperience || 0) + 1)) + (originalBossTemplate.rewards.minExperience || 0);
        const totalPoolExp = rolledExp * bossBonusMultiplier;
        
        const splitGold = Math.floor(totalPoolGold); // Base gold PER player (simplified logic for game balance)
        const splitExp = Math.floor(totalPoolExp);
        
        let totalGuildTaxGold = 0;
        const totalGuildTaxEssences: Record<string, number> = {};

        for (const userId of Object.keys(rawCharactersMap).map(Number)) {
            // Static data for bonus checks
            const staticChar = rawCharactersMap[userId];
            // We need the fully derived character (including luck) to pass to item generation
            const derivedChar = playerCombatants.find(pc => pc.id === userId);

            // Re-fetch FRESH character data with lock to prevent race conditions (health overwrite)
            const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
            if (charRes.rows.length === 0) continue;
            const char = charRes.rows[0].data as PlayerCharacter;

            // Apply Combat State (Health/Mana)
            const finalState = finalPlayers.find(p => p.data.id === userId);
            const isDefeated = !finalState || finalState.isDead;
            
            if (finalState) {
                char.stats.currentHealth = Math.max(0, Math.floor(finalState.currentHealth));
                char.stats.currentMana = Math.max(0, Math.floor(finalState.currentMana));
            }

            const rewardMultiplier = isDefeated ? 0.5 : 1.0;
            let finalGold = Math.floor(splitGold * rewardMultiplier);
            let finalExp = Math.floor(splitExp * rewardMultiplier);

            // Apply race/class bonuses to rewards (using staticChar traits)
            if (staticChar.race === 'Gnome') finalGold = Math.floor(finalGold * 1.2);
            if (staticChar.characterClass === 'Thief') finalGold = Math.floor(finalGold * 1.25);
            if (staticChar.race === 'Human') finalExp = Math.floor(finalExp * 1.1);
            
            // --- Apply Guild Tax (Individually per player) ---
            if (party.guildId && guildTaxRate > 0 && guildResources) {
                const taxAmount = Math.floor(finalGold * (guildTaxRate / 100));
                if (taxAmount > 0) {
                    finalGold -= taxAmount;
                    totalGuildTaxGold += taxAmount;
                }
            }
            
            const itemsFound: ItemInstance[] = [];
            const essencesFound: Partial<Record<EssenceType, number>> = {};
            if (!isDefeated) {
                const backpackCap = getBackpackCapacity(char);
                const combinedLootTable = [...(bossTemplate.lootTable || [])];

                // Dungeon Hunter Bonus Loot
                if (staticChar.characterClass === CharacterClass.DungeonHunter && combinedLootTable.length > 0) {
                    if (Math.random() < 0.3) combinedLootTable.push(combinedLootTable[Math.floor(Math.random() * combinedLootTable.length)]);
                    if (Math.random() < 0.15) combinedLootTable.push(combinedLootTable[Math.floor(Math.random() * combinedLootTable.length)]);
                }
                
                for (const drop of combinedLootTable) {
                    if (Math.random() * 100 < drop.chance) {
                        if ((char.inventory || []).length + itemsFound.length < backpackCap) {
                            // Passing derivedChar here ensures Luck stat is used for upgrades
                            itemsFound.push(createItemInstance(drop.templateId, gameData.itemTemplates || [], gameData.affixes || [], derivedChar));
                        }
                    }
                }
                for (const drop of (bossTemplate.resourceLootTable || [])) {
                    if (Math.random() * 100 < drop.chance) {
                        let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                        if(staticChar.characterClass === 'Engineer' && Math.random() < 0.5) amount *= 2;
                        
                        // Apply Guild Tax to Essences (Individually)
                        if (party.guildId && guildTaxRate > 0 && guildResources) {
                            const taxAmount = Math.floor(amount * (guildTaxRate / 100));
                            if (taxAmount > 0) {
                                amount -= taxAmount;
                                totalGuildTaxEssences[drop.resource] = (totalGuildTaxEssences[drop.resource] || 0) + taxAmount;
                            }
                        }

                        // drop.resource is strictly typed as EssenceType here because bossTemplate is typed as Enemy
                        essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
                    }
                }
            }
            
            rewardsMap[userId] = { gold: finalGold, experience: finalExp, items: itemsFound, essences: essencesFound };
            allRewardsForReport[char.name] = { 
                gold: finalGold, 
                experience: finalExp,
                items: itemsFound,
                essences: essencesFound
            };

            char.resources.gold = (Number(char.resources.gold) || 0) + finalGold;
            char.experience = (Number(char.experience) || 0) + finalExp;
            char.inventory.push(...itemsFound);
            
            for(const [key, val] of Object.entries(essencesFound)) {
                 const resourceKey = key as keyof CharacterResources;
                 if (char.resources[resourceKey] !== undefined) {
                     char.resources[resourceKey] = (Number(char.resources[resourceKey]) || 0) + (val || 0);
                 }
            }
            
            // Druid post-combat heal
            if (staticChar.characterClass === CharacterClass.Druid) {
                const maxHealth = derivedChar?.stats.maxHealth || char.stats.maxHealth;
                char.stats.currentHealth = Math.min(maxHealth, char.stats.currentHealth + maxHealth * 0.5);
            }
            
            // Level-up logic
            while (char.experience >= char.experienceToNextLevel) {
                char.experience -= char.experienceToNextLevel;
                char.level += 1;
                char.stats.statPoints += 2; // Updated to 2
                char.experienceToNextLevel = Math.floor(100 * Math.pow(char.level, 1.3));
            }

            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, userId]);
        }
        
        // Update Guild Bank with Tax
        if (party.guildId && guildResources) {
            if (totalGuildTaxGold > 0) {
                guildResources.gold += totalGuildTaxGold;
                await client.query(
                    `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'TAX', 'gold', $3)`,
                    [party.guildId, party.leaderId, totalGuildTaxGold]
                );
            }
            for(const [essence, amount] of Object.entries(totalGuildTaxEssences)) {
                 if (amount > 0) {
                     guildResources[essence] += amount;
                     await client.query(
                        `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'TAX', $3, $4)`,
                        [party.guildId, party.leaderId, essence, amount]
                    );
                 }
            }
            await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildResources), party.guildId]);
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
            
            await enforceInboxLimit(client, userId);
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'expedition_report', $2, $3)`,
                [userId, `Raport z Polowania: ${bossTemplate.name}`, JSON.stringify(summary)]
            );
        }
    } else { // Defeat
         for (const userId of Object.keys(rawCharactersMap).map(Number)) {
            // LOCK AND FETCH FRESH
            const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
            if (charRes.rows.length === 0) continue;
            const charToUpdate = charRes.rows[0].data as PlayerCharacter;

            // Apply Combat State
            const finalState = finalPlayers.find(p => p.data.id === userId);
            if (finalState) {
                charToUpdate.stats.currentHealth = Math.max(0, Math.floor(finalState.currentHealth));
                charToUpdate.stats.currentMana = Math.max(0, Math.floor(finalState.currentMana));
            }
            
            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [charToUpdate, userId]);

            const summary: ExpeditionRewardSummary = {
                isVictory: false, totalGold: 0, totalExperience: 0, combatLog, itemsFound: [], essencesFound: {}, 
                rewardBreakdown: [], huntingMembers: party.members, bossId: party.bossId
            };
            
            await enforceInboxLimit(client, userId);
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
        victory: dbParty.victory,
        guildId: dbParty.guild_id,
        autoJoin: dbParty.auto_join
    };
};
