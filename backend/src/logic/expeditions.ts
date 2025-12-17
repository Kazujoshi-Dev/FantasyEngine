
import { PlayerCharacter, Expedition, Enemy, GameData, ExpeditionRewardSummary, RewardSource, CombatLogEntry, Race, PlayerQuestProgress, QuestType, CharacterClass, EssenceType, LootDrop, ItemInstance } from '../types.js';
import { simulate1v1Combat, simulate1vManyCombat } from './combat/simulations/index.js';
import { createItemInstance, pickWeighted } from './items.js';
import { getBackpackCapacity } from './helpers.js';
import { calculateDerivedStatsOnServer } from './stats.js';

export const processCompletedExpedition = (character: PlayerCharacter, gameData: GameData, guildBarracksLevel: number = 0, scoutHouseLevel: number = 0, shrineLevel: number = 0): { updatedCharacter: PlayerCharacter, summary: ExpeditionRewardSummary, expeditionName: string } => {
    const expedition = gameData.expeditions.find(e => e.id === character.activeExpedition!.expeditionId);
    if (!expedition) {
        character.activeExpedition = null;
        return { 
            updatedCharacter: character, 
            summary: { 
                rewardBreakdown: [], totalGold: 0, totalExperience: 0, 
                combatLog: [], isVictory: false, itemsFound: [], essencesFound: {}
            },
            expeditionName: 'Unknown Expedition'
        };
    }
    
    // 1. Determine enemies for this expedition
    const encounteredEnemies: Enemy[] = [];
    const maxEnemies = expedition.maxEnemies || (expedition.enemies || []).length;
    let enemiesFoughtCount = 0;
    
    // Convert old spawnChance to weight for consistent picking if needed, or stick to independent chance.
    // For enemies, independent chance (spawnChance 0-100) often makes more sense than weighted pool if multiple enemies can spawn.
    // However, if the user requested "enemies, bosses, expeditions" to use weights, we might want to treat the enemy list as a pool.
    // Current logic: Loop through list, roll independent chance.
    // Let's keep independent chance for enemy spawning (as it determines IF they appear, not WHICH one from a single slot), unless explicitly changed. 
    // The user requirement "item finding system" strongly suggests Loot Tables. I will keep enemy spawning as-is for now to avoid breaking encounter logic, focusing on Loot.
    
    for (const expEnemy of (expedition.enemies || [])) {
        if (enemiesFoughtCount >= maxEnemies) break;
        if (Math.random() * 100 < expEnemy.spawnChance) {
            const enemyTemplate = gameData.enemies.find(e => e.id === expEnemy.enemyId);
            if (enemyTemplate) {
                encounteredEnemies.push({ ...enemyTemplate, uniqueId: `${enemyTemplate.id}-${Date.now()}-${Math.random()}` });
                enemiesFoughtCount++;
            }
        }
    }

    // 2. Simulate combat and gather logs/results
    // Pass guild barracks level, shrine level AND active buffs to stat calculation
    const characterWithStats = calculateDerivedStatsOnServer(
        character, 
        gameData.itemTemplates || [], 
        gameData.affixes || [], 
        guildBarracksLevel, 
        shrineLevel, 
        gameData.skills || [],
        character.activeGuildBuffs || [] // Pass buffs present on character object
    );
    
    // Create a combat-ready version of the character with full mana for the simulation.
    // Health carries over from the character's state before the expedition.
    const combatReadyCharacter = {
        ...characterWithStats,
        stats: {
            ...characterWithStats.stats,
            currentMana: characterWithStats.stats.maxMana
        }
    };
    
    let fullCombatLog: CombatLogEntry[] = [];
    let finalPlayerHealth: number;
    let finalPlayerMana: number;
    let isVictory: boolean;

    if (encounteredEnemies.length > 1) {
        // Use 1vMany logic for simultaneous combat against multiple enemies
        const combatLogs = simulate1vManyCombat(combatReadyCharacter, encounteredEnemies, gameData);
        fullCombatLog = combatLogs;
        
        const lastLog = combatLogs[combatLogs.length - 1];
        if (lastLog) {
            finalPlayerHealth = lastLog.playerHealth;
            finalPlayerMana = lastLog.playerMana;
            
            // Victory if player is alive AND all enemies are dead
            // Check last log's allEnemiesHealth if available
            const areAllEnemiesDead = lastLog.allEnemiesHealth 
                ? lastLog.allEnemiesHealth.every(e => e.currentHealth <= 0)
                : (lastLog.enemyHealth <= 0); // Fallback though likely inaccurate for groups without the snapshot

            isVictory = finalPlayerHealth > 0 && areAllEnemiesDead;
        } else {
            // Fallback
            finalPlayerHealth = characterWithStats.stats.currentHealth;
            finalPlayerMana = characterWithStats.stats.currentMana;
            isVictory = true; 
        }

    } else if (encounteredEnemies.length === 1) {
        // Use single combat for one enemy
        const singleCombatLog = simulate1v1Combat(combatReadyCharacter, encounteredEnemies[0], gameData);
        fullCombatLog = singleCombatLog;
        const lastLog = singleCombatLog.length > 0 ? singleCombatLog[singleCombatLog.length - 1] : null;
        if (lastLog) {
            finalPlayerHealth = lastLog.playerHealth;
            finalPlayerMana = lastLog.playerMana;
            isVictory = finalPlayerHealth > 0 && lastLog.enemyHealth <= 0;
        } else { // Should not happen if an enemy was encountered
            finalPlayerHealth = characterWithStats.stats.currentHealth;
            finalPlayerMana = characterWithStats.stats.currentMana;
            isVictory = true;
        }
    } else {
        // No enemies encountered
        finalPlayerHealth = characterWithStats.stats.currentHealth;
        finalPlayerMana = characterWithStats.stats.currentMana;
        isVictory = true;
    }


    // 3. Calculate final rewards and update character state
    let finalCharacter = { ...character };
    finalCharacter.stats.currentHealth = finalPlayerHealth;
    finalCharacter.stats.currentMana = finalPlayerMana;
    
    let totalGold = 0;
    let totalExperience = 0;
    const itemsFound: ItemInstance[] = [];
    const essencesFound: Partial<Record<EssenceType, number>> = {};
    let itemsLostCount = 0;
    const rewardBreakdown: RewardSource[] = [];

    if (isVictory) {
        // Enemy rewards
        for (const enemy of encounteredEnemies) {
            const minGold = enemy.rewards?.minGold ?? 0;
            const maxGold = enemy.rewards?.maxGold ?? 0;
            const goldReward = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
            
            const minExp = enemy.rewards?.minExperience ?? 0;
            const maxExp = enemy.rewards?.maxExperience ?? 0;
            const experienceReward = Math.floor(Math.random() * (maxExp - minExp + 1)) + minExp;
            
            rewardBreakdown.push({
                source: `Pokonano: ${enemy.name}`,
                gold: goldReward,
                experience: experienceReward
            });
            
            character.questProgress.forEach(qp => {
                const quest = gameData.quests.find(q => q.id === qp.questId);
                if(quest && quest.objective.type === QuestType.Kill && quest.objective.targetId === enemy.id && character.acceptedQuests.includes(quest.id)) {
                    qp.progress += 1;
                }
            });
        }

        // Base expedition rewards
        const baseGold = Math.floor(Math.random() * (expedition.maxBaseGoldReward - expedition.minBaseGoldReward + 1)) + expedition.minBaseGoldReward;
        const baseExperience = Math.floor(Math.random() * (expedition.maxBaseExperienceReward - expedition.minBaseExperienceReward + 1)) + expedition.minBaseExperienceReward;
        rewardBreakdown.unshift({
            source: `Nagroda z Wyprawy: ${expedition.name}`,
            gold: baseGold,
            experience: baseExperience
        });
        
        // Sum up all rewards
        rewardBreakdown.forEach(rb => {
            totalGold += rb.gold;
            totalExperience += rb.experience;
        });
        
        // Race bonuses
        if(character.race === Race.Human) totalExperience = Math.floor(totalExperience * 1.10);
        if(character.race === Race.Gnome) totalGold = Math.floor(totalGold * 1.20);
        if(character.characterClass === CharacterClass.Thief) totalGold = Math.floor(totalGold * 1.25);
        
        // Apply Guild Buffs (Experience Bonus)
        const expBuffs = character.activeGuildBuffs?.filter(b => (b.stats as any).expBonus);
        if (expBuffs && expBuffs.length > 0) {
            expBuffs.forEach(b => {
                 const bonus = (b.stats as any).expBonus || 0;
                 const bonusAmount = Math.floor(totalExperience * (bonus / 100));
                 totalExperience += bonusAmount;
            });
        }
        
        // --- Loot Logic (Weighted) ---
        const allLootTables: LootDrop[] = [
            ...(expedition.lootTable || []),
            ...encounteredEnemies.flatMap(e => e.lootTable || [])
        ];

        const backpackCapacity = getBackpackCapacity(finalCharacter);
        
        // Max Items Calculation
        let maxItems = (expedition.maxItems || 0) + scoutHouseLevel;
        if (maxItems === 0) maxItems = 1; // Default to at least 1 roll if not specified? Or maybe default to pool size logic? 
        // Let's assume a default of 3 rolls if maxItems not set, or derived from enemy count.
        // For backward compatibility, let's say base 1 + 1 per enemy killed + scout bonus.
        if (!expedition.maxItems) {
            maxItems = 1 + encounteredEnemies.length + scoutHouseLevel;
        }

        // Apply "Dokladne przeszukanie" skill bonus
        if (character.activeSkills?.includes('dokladne-przeszukiwanie')) {
            maxItems += 1;
        }
        
        // Dungeon Hunter Bonus Loot Logic
        if(character.characterClass === CharacterClass.DungeonHunter) {
             if (Math.random() < 0.3) maxItems += 1;
             if (Math.random() < 0.15) maxItems += 1;
        }
        
        // Roll for items
        // In weighted system, we roll 'maxItems' times against the pool.
        // We include a "Nothing" chance implicitly? No, usually weighted pools guarantee a drop if you roll on them.
        // To simulate "chance to get nothing", the pool should have an "Empty" entry with weight.
        // OR we stick to: We try to find 'maxItems' items.
        
        for (let i = 0; i < maxItems; i++) {
             // 50% base chance to get ANY item roll? Or always roll?
             // Let's assume always roll on the table if it exists.
             // To prevent flooding inventory, we can add a global "Empty" chance check before rolling the weighted table.
             // For now, let's simply roll.
             
             if (allLootTables.length > 0) {
                 const droppedTemplateId = pickWeighted(allLootTables)?.templateId;
                 
                 if (droppedTemplateId) {
                     if (finalCharacter.inventory.length < backpackCapacity) {
                        const newItem = createItemInstance(droppedTemplateId, gameData.itemTemplates || [], gameData.affixes || [], finalCharacter);
                        finalCharacter.inventory.push(newItem);
                        itemsFound.push(newItem);
                    } else {
                        itemsLostCount++;
                    }
                 }
             }
        }
        
        // Handle resource drops (Weighted)
        const allResourceLootTables = [
            ...(expedition.resourceLootTable || []),
            ...encounteredEnemies.flatMap(e => e.resourceLootTable || [])
        ];
        
        // Resources usually drop independently or in small batches.
        // Let's roll 3 times on the resource table.
        for (let i = 0; i < 3; i++) {
            if (allResourceLootTables.length > 0) {
                const drop = pickWeighted(allResourceLootTables);
                if (drop) {
                    let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    if(character.characterClass === CharacterClass.Engineer && Math.random() < 0.5) {
                        amount *= 2;
                    }
                    essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
                    finalCharacter.resources[drop.resource] = (finalCharacter.resources[drop.resource] || 0) + amount;
                }
            }
        }

        finalCharacter.resources.gold = (Number(finalCharacter.resources.gold) || 0) + totalGold;
        finalCharacter.experience = (Number(finalCharacter.experience) || 0) + totalExperience;
        
        if (character.characterClass === CharacterClass.Druid) {
            finalCharacter.stats.currentHealth = Math.min(finalCharacter.stats.maxHealth, finalCharacter.stats.currentHealth + finalCharacter.stats.maxHealth * 0.5);
        }
    }

    // Level up check
    while (finalCharacter.experience >= finalCharacter.experienceToNextLevel) {
        finalCharacter.experience -= finalCharacter.experienceToNextLevel;
        finalCharacter.level += 1;
        finalCharacter.stats.statPoints += 2; // Updated to 2
        finalCharacter.experienceToNextLevel = Math.floor(100 * Math.pow(finalCharacter.level, 1.3));
    }
    
    finalCharacter.activeExpedition = null;

    const summary: ExpeditionRewardSummary = {
        rewardBreakdown,
        totalGold,
        totalExperience,
        combatLog: fullCombatLog,
        isVictory,
        itemsFound,
        essencesFound,
        itemsLostCount: itemsLostCount > 0 ? itemsLostCount : undefined,
        encounteredEnemies: encounteredEnemies
    };

    return { updatedCharacter: finalCharacter, summary, expeditionName: expedition.name };
};
