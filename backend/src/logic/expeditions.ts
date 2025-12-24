
import { PlayerCharacter, Expedition, Enemy, GameData, ExpeditionRewardSummary, RewardSource, CombatLogEntry, Race, PlayerQuestProgress, QuestType, CharacterClass, EssenceType, LootDrop, ResourceDrop, ItemInstance } from '../types.js';
import { simulate1v1Combat, simulate1vManyCombat } from './combat/simulations/index.js';
import { createItemInstance, pickWeighted } from './items.js';
// Fix: Import getBackpackCapacity from stats.js
import { calculateDerivedStatsOnServer, getBackpackCapacity } from './stats.js';

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

    const characterWithStats = calculateDerivedStatsOnServer(
        character, 
        gameData.itemTemplates || [], 
        gameData.affixes || [], 
        guildBarracksLevel, 
        shrineLevel, 
        gameData.skills || [],
        character.activeGuildBuffs || [],
        gameData.itemSets || []
    );
    
    const combatReadyCharacter = {
        ...characterWithStats,
        stats: { ...characterWithStats.stats, currentMana: characterWithStats.stats.maxMana }
    };
    
    let fullCombatLog: CombatLogEntry[] = [];
    let finalPlayerHealth: number;
    let finalPlayerMana: number;
    let isVictory: boolean;

    if (encounteredEnemies.length > 1) {
        const combatLogs = simulate1vManyCombat(combatReadyCharacter, encounteredEnemies, gameData);
        fullCombatLog = combatLogs;
        const lastLog = combatLogs[combatLogs.length - 1];
        if (lastLog) {
            finalPlayerHealth = lastLog.playerHealth;
            finalPlayerMana = lastLog.playerMana;
            const areAllEnemiesDead = lastLog.allEnemiesHealth ? lastLog.allEnemiesHealth.every(e => e.currentHealth <= 0) : (lastLog.enemyHealth <= 0);
            isVictory = finalPlayerHealth > 0 && areAllEnemiesDead;
        } else {
            finalPlayerHealth = characterWithStats.stats.currentHealth;
            finalPlayerMana = characterWithStats.stats.currentMana;
            isVictory = true; 
        }
    } else if (encounteredEnemies.length === 1) {
        const singleCombatLog = simulate1v1Combat(combatReadyCharacter, encounteredEnemies[0], gameData);
        fullCombatLog = singleCombatLog;
        const lastLog = singleCombatLog.length > 0 ? singleCombatLog[singleCombatLog.length - 1] : null;
        if (lastLog) {
            finalPlayerHealth = lastLog.playerHealth;
            finalPlayerMana = lastLog.playerMana;
            isVictory = finalPlayerHealth > 0 && lastLog.enemyHealth <= 0;
        } else {
            finalPlayerHealth = characterWithStats.stats.currentHealth;
            finalPlayerMana = characterWithStats.stats.currentMana;
            isVictory = true;
        }
    } else {
        finalPlayerHealth = characterWithStats.stats.currentHealth;
        finalPlayerMana = characterWithStats.stats.currentMana;
        isVictory = true;
    }

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
        const backpackCapacity = getBackpackCapacity(finalCharacter);
        
        for (const enemy of encounteredEnemies) {
            const minGold = enemy.rewards?.minGold ?? 0;
            const maxGold = enemy.rewards?.maxGold ?? 0;
            const goldReward = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
            
            const minExp = enemy.rewards?.minExperience ?? 0;
            const maxExp = enemy.rewards?.maxExperience ?? 0;
            const experienceReward = Math.floor(Math.random() * (maxExp - minExp + 1)) + minExp;
            
            rewardBreakdown.push({ source: `Pokonano: ${enemy.name}`, gold: goldReward, experience: experienceReward });

            if (enemy.lootTable && enemy.lootTable.length > 0) {
                 // Type assertion fix: Property 'templateId' on pickWeighted result
                 const droppedTemplateId = (pickWeighted(enemy.lootTable) as LootDrop | null)?.templateId;
                 if (droppedTemplateId) {
                     if (finalCharacter.inventory.length < backpackCapacity) {
                        const newItem = createItemInstance(droppedTemplateId, gameData.itemTemplates || [], gameData.affixes || [], finalCharacter);
                        finalCharacter.inventory.push(newItem);
                        itemsFound.push(newItem);
                    } else { itemsLostCount++; }
                 }
            }
            
            if (enemy.resourceLootTable && enemy.resourceLootTable.length > 0) {
                 // Type assertion fix: Property access on pickWeighted result
                 const drop = pickWeighted(enemy.resourceLootTable) as ResourceDrop | null;
                 if (drop) {
                    let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    if(character.characterClass === CharacterClass.Engineer && Math.random() < 0.5) amount *= 2;
                    essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
                    finalCharacter.resources[drop.resource] = (finalCharacter.resources[drop.resource] || 0) + amount;
                 }
            }
            
            character.questProgress.forEach(qp => {
                const quest = gameData.quests.find(q => q.id === qp.questId);
                if(quest && quest.objective.type === QuestType.Kill && quest.objective.targetId === enemy.id && character.acceptedQuests.includes(quest.id)) {
                    qp.progress += 1;
                }
            });
        }

        const baseGold = Math.floor(Math.random() * (expedition.maxBaseGoldReward - expedition.minBaseGoldReward + 1)) + expedition.minBaseGoldReward;
        const baseExperience = Math.floor(Math.random() * (expedition.maxBaseExperienceReward - expedition.minBaseExperienceReward + 1)) + expedition.minBaseExperienceReward;
        rewardBreakdown.unshift({ source: `Nagroda z Wyprawy: ${expedition.name}`, gold: baseGold, experience: baseExperience });
        
        rewardBreakdown.forEach(rb => {
            totalGold += rb.gold;
            totalExperience += rb.experience;
        });
        
        // Aplikacja bonusów klasowych (które nie są w statystykach)
        if(character.characterClass === CharacterClass.Thief) totalGold = Math.floor(totalGold * 1.25);
        
        // APLIKACJA WSZYSTKICH BONUSÓW PROCENTOWYCH ZE STATYSTYK (Zestawy, Buffy, Rasa)
        // stats.expBonusPercent i goldBonusPercent zawierają już wszystko co wyliczył calculateDerivedStats
        if (characterWithStats.stats.goldBonusPercent > 0) {
            totalGold += Math.floor(totalGold * (characterWithStats.stats.goldBonusPercent / 100));
        }
        if (characterWithStats.stats.expBonusPercent > 0) {
            totalExperience += Math.floor(totalExperience * (characterWithStats.stats.expBonusPercent / 100));
        }
        
        // Przeszukiwanie (Scavenging)
        let maxPotentialItems = (expedition.maxItems || 0) || 1;
        maxPotentialItems += scoutHouseLevel;
        if (character.activeSkills?.includes('dokladne-przeszukiwanie')) maxPotentialItems += 1;
        if(character.characterClass === CharacterClass.DungeonHunter) {
             if (Math.random() < 0.3) maxPotentialItems += 1;
             if (Math.random() < 0.15) maxPotentialItems += 1;
        }
        
        const baseFindChance = 40;
        const luckBonus = (characterWithStats.stats.luck || 0) * 0.25;
        const totalFindChance = Math.min(100, baseFindChance + luckBonus);

        for (let i = 0; i < maxPotentialItems; i++) {
             if (Math.random() * 100 > totalFindChance) continue;
             if (expedition.lootTable && expedition.lootTable.length > 0) {
                 // Type assertion fix: Property access on pickWeighted result
                 const droppedTemplateId = (pickWeighted(expedition.lootTable) as LootDrop | null)?.templateId;
                 if (droppedTemplateId && finalCharacter.inventory.length < backpackCapacity) {
                    const newItem = createItemInstance(droppedTemplateId, gameData.itemTemplates || [], gameData.affixes || [], finalCharacter);
                    finalCharacter.inventory.push(newItem);
                    itemsFound.push(newItem);
                } else if (droppedTemplateId) { itemsLostCount++; }
             }
        }
        
        const resourceRolls = 1 + (scoutHouseLevel > 0 ? 1 : 0);
        for (let i = 0; i < resourceRolls; i++) {
            if (expedition.resourceLootTable && expedition.resourceLootTable.length > 0) {
                // Type assertion fix: Property access on pickWeighted result
                const drop = pickWeighted(expedition.resourceLootTable) as ResourceDrop | null;
                if (drop) {
                    let amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    if(character.characterClass === CharacterClass.Engineer && Math.random() < 0.5) amount *= 2;
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

    while (finalCharacter.experience >= finalCharacter.experienceToNextLevel) {
        finalCharacter.experience -= finalCharacter.experienceToNextLevel;
        finalCharacter.level += 1;
        finalCharacter.stats.statPoints += 2; 
        finalCharacter.experienceToNextLevel = Math.floor(100 * Math.pow(finalCharacter.level, 1.3));
    }
    
    finalCharacter.activeExpedition = null;
    const summary: ExpeditionRewardSummary = { rewardBreakdown, totalGold, totalExperience, combatLog: fullCombatLog, isVictory, itemsFound, essencesFound, itemsLostCount: itemsLostCount > 0 ? itemsLostCount : undefined, encounteredEnemies: encounteredEnemies };
    return { updatedCharacter: finalCharacter, summary, expeditionName: expedition.name };
};
