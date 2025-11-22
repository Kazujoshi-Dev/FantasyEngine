import { PlayerCharacter, Expedition, Enemy, GameData, ExpeditionRewardSummary, RewardSource, CombatLogEntry, Race, PlayerQuestProgress, QuestType, CharacterClass, EssenceType } from '../types.js';
import { simulate1v1Combat, simulate1vManyCombat } from './combat/simulations.js';
import { createItemInstance } from './items.js';
import { getBackpackCapacity } from './helpers.js';
import { calculateDerivedStatsOnServer } from './stats.js';

export const processCompletedExpedition = (character: PlayerCharacter, gameData: GameData): { updatedCharacter: PlayerCharacter, summary: ExpeditionRewardSummary, expeditionName: string } => {
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
    const characterWithStats = calculateDerivedStatsOnServer(character, gameData.itemTemplates || [], gameData.affixes || []);
    
    let fullCombatLog: CombatLogEntry[] = [];
    let finalPlayerHealth: number;
    let finalPlayerMana: number;
    let isVictory: boolean;

    if (encounteredEnemies.length > 1) {
        // Use group combat for multiple enemies
        const { combatLog } = simulate1vManyCombat(characterWithStats, encounteredEnemies, gameData);
        fullCombatLog = combatLog;
        const lastLog = combatLog[combatLog.length -1];
        finalPlayerHealth = lastLog.playerHealth;
        finalPlayerMana = lastLog.playerMana;
        isVictory = finalPlayerHealth > 0 && (combatLog.length === 0 || !lastLog.allEnemiesHealth?.some(e => e.currentHealth > 0));

    } else if (encounteredEnemies.length === 1) {
        // Use single combat for one enemy
        const singleCombatLog = simulate1v1Combat(characterWithStats, encounteredEnemies[0], gameData);
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
    const itemsFound = [];
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
        
        // Handle loot drops
        const allLootTables = [
            ...(expedition.lootTable || []),
            ...encounteredEnemies.flatMap(e => e.lootTable || [])
        ];

        const backpackCapacity = getBackpackCapacity(finalCharacter);
        const maxItems = expedition.maxItems;
        
        if(character.characterClass === CharacterClass.DungeonHunter) {
            if (Math.random() < 0.3) {
                 const extraDrop = allLootTables[Math.floor(Math.random() * allLootTables.length)];
                 if(extraDrop) allLootTables.push(extraDrop);
            }
             if (Math.random() < 0.15) {
                 const extraDrop = allLootTables[Math.floor(Math.random() * allLootTables.length)];
                 if(extraDrop) allLootTables.push(extraDrop);
            }
        }
        
        for (const drop of allLootTables) {
            if (maxItems != null && maxItems > 0 && itemsFound.length >= maxItems) {
                break;
            }

            if (Math.random() * 100 < drop.chance) {
                if (finalCharacter.inventory.length < backpackCapacity) {
                    const newItem = createItemInstance(drop.templateId, gameData.itemTemplates || [], gameData.affixes || []);
                    finalCharacter.inventory.push(newItem);
                    itemsFound.push(newItem);
                } else {
                    itemsLostCount++;
                }
            }
        }
        
        // Handle resource drops
        const allResourceLootTables = [
            ...(expedition.resourceLootTable || []),
            ...encounteredEnemies.flatMap(e => e.resourceLootTable || [])
        ];
        
        for (const drop of allResourceLootTables) {
            if (Math.random() * 100 < drop.chance) {
                let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                if(character.characterClass === CharacterClass.Engineer && Math.random() < 0.5) {
                    amount *= 2;
                }
                essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
                finalCharacter.resources[drop.resource] = (finalCharacter.resources[drop.resource] || 0) + amount;
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
        finalCharacter.stats.statPoints += 1;
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
