import { PlayerCharacter, Expedition, Enemy, GameData, ExpeditionRewardSummary, RewardSource, CombatLogEntry, Race, PlayerQuestProgress, QuestType, CharacterClass, EssenceType } from '../types.js';
import { simulateCombat } from './combat.js';
import { createItemInstance } from './items.js';
import { getBackpackCapacity } from './helpers.js';
import { calculateDerivedStatsOnServer } from './stats.js';

export const processCompletedExpedition = (character: PlayerCharacter, gameData: GameData): { updatedCharacter: PlayerCharacter, summary: ExpeditionRewardSummary } => {
    const expedition = gameData.expeditions.find(e => e.id === character.activeExpedition!.expeditionId);
    if (!expedition) {
        // This case should ideally not happen if data is consistent
        character.activeExpedition = null;
        return { 
            updatedCharacter: character, 
            summary: { 
                rewardBreakdown: [], totalGold: 0, totalExperience: 0, 
                combatLog: [], isVictory: false, itemsFound: [], essencesFound: {}
            }
        };
    }
    
    // 1. Determine enemies for this expedition
    const encounteredEnemies: Enemy[] = [];
    const maxEnemies = expedition.maxEnemies || expedition.enemies.length;
    let enemiesFoughtCount = 0;
    
    for (const expEnemy of expedition.enemies) {
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
    const characterWithStats = calculateDerivedStatsOnServer(character, gameData.itemTemplates, gameData.affixes);
    let playerHealth = characterWithStats.stats.currentHealth;
    let playerMana = characterWithStats.stats.currentMana;
    let isVictory = true;
    const fullCombatLog: CombatLogEntry[] = [];
    const rewardBreakdown: RewardSource[] = [];

    for (const enemy of encounteredEnemies) {
        const combatCharacter = { ...characterWithStats, stats: { ...characterWithStats.stats, currentHealth: playerHealth, currentMana: playerMana }};
        const combatLog = simulateCombat(combatCharacter, enemy, gameData);
        fullCombatLog.push(...combatLog);
        
        const lastLog = combatLog[combatLog.length - 1];
        playerHealth = lastLog.playerHealth;
        playerMana = lastLog.playerMana;

        if (playerHealth <= 0) {
            isVictory = false;
            break; // Player was defeated
        }

        // Add enemy rewards to breakdown
        const goldReward = Math.floor(Math.random() * (enemy.rewards.maxGold - enemy.rewards.minGold + 1)) + enemy.rewards.minGold;
        const experienceReward = Math.floor(Math.random() * (enemy.rewards.maxExperience - enemy.rewards.minExperience + 1)) + enemy.rewards.minExperience;
        
        rewardBreakdown.push({
            source: `Pokonano: ${enemy.name}`,
            gold: goldReward,
            experience: experienceReward
        });
        
        // Update kill quests
        character.questProgress.forEach(qp => {
            const quest = gameData.quests.find(q => q.id === qp.questId);
            if(quest && quest.objective.type === QuestType.Kill && quest.objective.targetId === enemy.id && character.acceptedQuests.includes(quest.id)) {
                qp.progress += 1;
            }
        });
    }

    // 3. Calculate final rewards and update character state
    let finalCharacter = { ...character };
    finalCharacter.stats.currentHealth = playerHealth;
    finalCharacter.stats.currentMana = playerMana;
    
    let totalGold = 0;
    let totalExperience = 0;
    const itemsFound = [];
    const essencesFound: Partial<Record<EssenceType, number>> = {};
    let itemsLostCount = 0;

    if (isVictory) {
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
        
        // Handle loot drops (from enemies and expedition)
        const allLootTables = [
            ...expedition.lootTable,
            ...encounteredEnemies.flatMap(e => e.lootTable)
        ];

        let potentialItemsFound = 0;
        if(character.characterClass === CharacterClass.DungeonHunter) {
            if (Math.random() < 0.3) potentialItemsFound += 1;
            if (Math.random() < 0.15) potentialItemsFound += 1;
        }

        const backpackCapacity = getBackpackCapacity(finalCharacter);
        for (const drop of allLootTables) {
            if (Math.random() * 100 < drop.chance) {
                potentialItemsFound++;
            }
        }

        for (let i = 0; i < potentialItemsFound; i++) {
             if (finalCharacter.inventory.length < backpackCapacity) {
                const drop = allLootTables[Math.floor(Math.random() * allLootTables.length)];
                const newItem = createItemInstance(drop.templateId, gameData.itemTemplates, gameData.affixes);
                finalCharacter.inventory.push(newItem);
                itemsFound.push(newItem);
            } else {
                itemsLostCount++;
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


        // Update character
        finalCharacter.resources.gold += totalGold;
        finalCharacter.experience += totalExperience;
        
         // Class bonuses after fight
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
    
    // Reset expedition status
    finalCharacter.activeExpedition = null;

    // 4. Create summary
    const summary: ExpeditionRewardSummary = {
        rewardBreakdown,
        totalGold,
        totalExperience,
        combatLog: fullCombatLog,
        isVictory,
        itemsFound,
        essencesFound,
        itemsLostCount: itemsLostCount > 0 ? itemsLostCount : undefined
    };

    return { updatedCharacter: finalCharacter, summary };
};