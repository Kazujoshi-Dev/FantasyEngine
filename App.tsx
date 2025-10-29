



import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Statistics } from './components/Statistics';
import { Equipment } from './components/Equipment';
import { Expedition as ExpeditionComponent, ExpeditionSummaryModal } from './components/Expedition';
import { Camp } from './components/Camp';
import { Location as LocationComponent } from './components/Location';
import { Resources } from './components/Resources';
import { AdminPanel } from './components/AdminPanel';
import { CharacterCreation } from './components/CharacterCreation';
import { Auth } from './components/Auth';
import { Ranking } from './components/Ranking';
import { Trader } from './components/Trader';
import { Blacksmith } from './components/Blacksmith';
import { Messages, ComposeMessageModal } from './components/Messages';
import { Quests } from './components/Quests';
import { Tavern } from './components/Tavern';
// FIX: Add GameData to import from types.ts to resolve "Cannot find name 'GameData'".
import { Tab, PlayerCharacter, Location, Expedition, Enemy, ExpeditionRewardSummary, CombatLogEntry, Race, RankingPlayer, Language, GameSettings, User, AdminCharacterInfo, RewardSource, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, ItemRarity, EssenceType, MagicAttackType, Message, PvpRewardSummary, Quest, QuestType, PlayerQuestProgress, LootDrop, TavernMessage, GameData } from './types';
import { api } from './api';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';

const MAX_PLAYER_INVENTORY_SIZE = 40;

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Player and Game Data
  const [playerCharacter, setPlayerCharacter] = useState<PlayerCharacter | null>(null);
  const [baseCharacter, setBaseCharacter] = useState<PlayerCharacter | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
  const [lastReward, setLastReward] = useState<ExpeditionRewardSummary | null>(null);
  
  // Admin & Social State
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [allCharacters, setAllCharacters] = useState<AdminCharacterInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isComposingMessage, setIsComposingMessage] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState<{ recipient: string; subject: string } | undefined>(undefined);
  const [allCharacterNames, setAllCharacterNames] = useState<string[]>([]);
  
  // Trader State
  const [traderInventory, setTraderInventory] = useState<ItemInstance[]>([]);

  // Tavern State
  const [tavernMessages, setTavernMessages] = useState<TavernMessage[]>([]);
  const tavernIntervalRef = useRef<number | null>(null);

  // i18n
  const t = useMemo(() => getT(Language.PL), []);
  const currentLanguage = Language.PL;

  // Derived State
  const currentLocation = useMemo(() => gameData?.locations.find(loc => loc.id === playerCharacter?.currentLocationId), [gameData, playerCharacter]);
  const hasUnreadMessages = useMemo(() => messages.some(m => !m.is_read), [messages]);

  // Derived Stat Calculation for UI Previews
  const calculateDerivedStats = useCallback((character: PlayerCharacter, gameDataForCalc: GameData | null): PlayerCharacter => {
      if (!gameDataForCalc) return character;
      
      const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
          strength: character.stats.strength, agility: character.stats.agility, accuracy: character.stats.accuracy,
          stamina: character.stats.stamina, intelligence: character.stats.intelligence, energy: character.stats.energy
      };

      let bonusDamageMin = 0, bonusDamageMax = 0, bonusMagicDamageMin = 0, bonusMagicDamageMax = 0;
      let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0;
      let bonusCritDamageModifier = 0;
      let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
      let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
      let bonusManaStealPercent = 0, bonusManaStealFlat = 0;

      for (const slot in character.equipment) {
          const itemInstance = character.equipment[slot as EquipmentSlot];
          if (itemInstance) {
              const template = gameDataForCalc.itemTemplates.find(t => t.id === itemInstance.templateId);
              if (template) {
                  const upgradeLevel = itemInstance.upgradeLevel || 0;
                  const upgradeBonusFactor = upgradeLevel * 0.1;

                  for (const stat in template.statsBonus) {
                      const key = stat as keyof typeof template.statsBonus;
                      const baseBonus = template.statsBonus[key] || 0;
                      totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                  }
                  
                  const baseDamageMin = template.damageMin || 0, baseDamageMax = template.damageMax || 0;
                  const baseMagicDamageMin = template.magicDamageMin || 0, baseMagicDamageMax = template.magicDamageMax || 0;
                  const baseArmor = template.armorBonus || 0, baseCritChance = template.critChanceBonus || 0, baseMaxHealth = template.maxHealthBonus || 0;
                  
                  bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeBonusFactor);
                  bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeBonusFactor);
                  bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeBonusFactor);
                  bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeBonusFactor);
                  bonusArmor += baseArmor + Math.round(baseArmor * upgradeBonusFactor);
                  bonusCritChance += baseCritChance + baseCritChance * upgradeBonusFactor;
                  bonusMaxHealth += baseMaxHealth + Math.round(baseMaxHealth * upgradeBonusFactor);

                  bonusCritDamageModifier += template.critDamageModifierBonus || 0;
                  bonusArmorPenetrationPercent += template.armorPenetrationPercent || 0;
                  bonusArmorPenetrationFlat += template.armorPenetrationFlat || 0;
                  bonusLifeStealPercent += template.lifeStealPercent || 0;
                  bonusLifeStealFlat += template.lifeStealFlat || 0;
                  bonusManaStealPercent += template.manaStealPercent || 0;
                  bonusManaStealFlat += template.manaStealFlat || 0;
              }
          }
      }
      
      const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
      const mainHandTemplate = mainHandItem ? gameDataForCalc.itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
      const attacksPerRound = mainHandTemplate?.attacksPerRound || 1;

      const baseHealth = 50, baseEnergy = 10, baseMana = 20, baseMinDamage = 1, baseMaxDamage = 2;

      const maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
      const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
      const maxMana = baseMana + totalPrimaryStats.intelligence * 10;
      
      let minDamage, maxDamage;
      if (mainHandTemplate?.isMagical) {
          minDamage = baseMinDamage + bonusDamageMin;
          maxDamage = baseMaxDamage + bonusDamageMax;
      } else {
          minDamage = baseMinDamage + (totalPrimaryStats.strength * 1) + bonusDamageMin;
          maxDamage = baseMaxDamage + (totalPrimaryStats.strength * 2) + bonusDamageMax;
      }
      
      const critChance = totalPrimaryStats.accuracy * 0.5 + bonusCritChance;
      const critDamageModifier = 200 + bonusCritDamageModifier;
      const armorPenetrationPercent = bonusArmorPenetrationPercent;
      const armorPenetrationFlat = bonusArmorPenetrationFlat;
      const lifeStealPercent = bonusLifeStealPercent;
      const lifeStealFlat = bonusLifeStealFlat;
      const manaStealPercent = bonusManaStealPercent;
      const manaStealFlat = bonusManaStealFlat;

      let armor = bonusArmor;
      let manaRegen = totalPrimaryStats.intelligence * 2;

      if (character.race === Race.Dwarf) armor += 5;
      if (character.race === Race.Elf) manaRegen += 10;
      
      const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
      const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
      const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

      const currentHealth = Math.min(character.stats.currentHealth, maxHealth);
      const currentMana = Math.min(character.stats.currentMana, maxMana);
      const currentEnergy = Math.min(character.stats.currentEnergy, maxEnergy);

      return {
          ...character,
          stats: {
              ...character.stats, ...totalPrimaryStats,
              maxHealth, maxEnergy, maxMana, minDamage, maxDamage, critChance, armor,
              magicDamageMin, magicDamageMax, attacksPerRound, manaRegen,
              currentHealth, currentMana, currentEnergy,
              critDamageModifier, armorPenetrationPercent, armorPenetrationFlat,
              lifeStealPercent, lifeStealFlat, manaStealPercent, manaStealFlat,
          }
      };
  }, []);

  const fetchTavernMessages = useCallback(async () => {
    try {
        const freshMessages = await api.getTavernMessages();
        setTavernMessages(freshMessages);
    } catch (e) {
        console.error("Failed to fetch tavern messages", e);
    }
  }, []);

  const startTavernPolling = useCallback(() => {
    fetchTavernMessages();
    if (tavernIntervalRef.current) clearInterval(tavernIntervalRef.current);
    tavernIntervalRef.current = window.setInterval(fetchTavernMessages, 10000); // Poll every 10 seconds
  }, [fetchTavernMessages]);

  const stopTavernPolling = () => {
    if (tavernIntervalRef.current) {
        clearInterval(tavernIntervalRef.current);
        tavernIntervalRef.current = null;
    }
  };

  const fullCharacterSync = useCallback(async () => {
    try {
      // First, fetch game data which is not behind auth
      const localGameData = await api.getGameData();
      setGameData(localGameData);
      
      // Then, fetch all authenticated data
      const [charData, rankingData, messagesData, allNamesData, traderData] = await Promise.all([
        api.getCharacter(),
        api.getRanking(),
        api.getMessages(),
        api.getCharacterNames(),
        api.getTraderInventory(), // Now authenticated
      ]);
      
      // Ensure chest exists for old characters
      if (!charData.chest) {
        charData.chest = { level: 1, gold: 0 };
      }
      
      setAllCharacterNames(allNamesData);
      setTraderInventory(traderData);

      const calculatedChar = calculateDerivedStats(charData, localGameData);
      setPlayerCharacter(calculatedChar);
      setBaseCharacter(JSON.parse(JSON.stringify(charData)));
      setRanking(rankingData);
      setMessages(messagesData);
      startTavernPolling();

      if (charData.username === 'Kazujoshi') {
        const [usersData, allCharsData] = await Promise.all([api.getUsers(), api.getAllCharacters()]);
        setUsers(usersData);
        setAllCharacters(allCharsData);
      }
      
    } catch (error: any) {
      if (error.message.includes('Character not found')) {
        setPlayerCharacter(null); // Allows character creation screen
      } else if (error.message.includes('Invalid token') || error.message.includes('Invalid username or password')) {
        console.error("Auth failed, logging out:", error);
        handleLogout();
      } else {
        console.error("Failed full sync due to non-auth error:", error);
        setError("Failed to connect to the server. Please check your connection and refresh.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [calculateDerivedStats, startTavernPolling]);

  const handleCharacterUpdate = useCallback(async (character: PlayerCharacter, fromServer = false) => {
    if (!gameData) return;
    
    // Ensure chest exists for old characters on any update
    const sanitizedCharacter = character.chest ? character : { ...character, chest: { level: 1, gold: 0 }};

    const calculatedForUI = calculateDerivedStats(sanitizedCharacter, gameData);
    setPlayerCharacter(calculatedForUI); // Optimistic UI update
    
    if (!fromServer) {
        try {
            const serverChar = await api.updateCharacter(sanitizedCharacter);
            const finalChar = calculateDerivedStats(serverChar, gameData);
            setPlayerCharacter(finalChar); // Final update from server
            setBaseCharacter(JSON.parse(JSON.stringify(serverChar)));
        } catch (err: any) {
            setError(err.message);
            await fullCharacterSync(); // On error, resync with server to prevent desync
        }
    } else {
        setBaseCharacter(JSON.parse(JSON.stringify(sanitizedCharacter)));
    }
  }, [calculateDerivedStats, gameData, fullCharacterSync]);

  useEffect(() => {
    if (token) {
      fullCharacterSync(); // Directly attempt to sync data, which also verifies the token
    } else {
      setIsLoading(false);
    }
    return stopTavernPolling;
  }, [token]);
  
  // Game Loop
  useEffect(() => {
    const intervalId = setInterval(() => {
        // Use functional updates to prevent stale state issues
        setBaseCharacter(prevCharacter => {
            if (!prevCharacter || !gameData) {
                return prevCharacter;
            }

            const now = Date.now();
            let updatedChar = JSON.parse(JSON.stringify(prevCharacter)); // Deep copy to prevent mutation
            let needsServerUpdate = false;
            
            // Note: Decisions should use stats calculated from the potentially updated character
            // inside this loop, not from an outer scope.
            const derivedStatsForDecisions = calculateDerivedStats(updatedChar, gameData).stats;

            // Travel
            if (updatedChar.activeTravel && now >= updatedChar.activeTravel.finishTime) {
                updatedChar.currentLocationId = updatedChar.activeTravel.destinationLocationId;
                updatedChar.activeTravel = null;
                needsServerUpdate = true;
            }
            
            // Resting
            if (updatedChar.isResting && updatedChar.stats.currentHealth < derivedStatsForDecisions.maxHealth) {
                const REGEN_INTERVAL_MS = 5000;
                if (now - (updatedChar.lastRestTime || 0) >= REGEN_INTERVAL_MS) {
                    const regenAmount = derivedStatsForDecisions.maxHealth * (updatedChar.camp.level / 100) * (REGEN_INTERVAL_MS / 60000);
                    const newHealth = Math.min(derivedStatsForDecisions.maxHealth, updatedChar.stats.currentHealth + regenAmount);
                    
                    // Always update time and health to accumulate fractional values and prevent loops.
                    updatedChar.stats.currentHealth = newHealth;
                    updatedChar.lastRestTime = now;
                    needsServerUpdate = true;
                }
            }
            
            // This is the crucial part: update UI and server if needed
            if (needsServerUpdate) {
                api.updateCharacter(updatedChar).catch(err => {
                    console.error("Game loop character update failed:", err);
                    // Consider a full resync on persistent failure
                });
                // Optimistically update the main UI state
                setPlayerCharacter(calculateDerivedStats(updatedChar, gameData));
                return updatedChar; // Return the new state for setBaseCharacter
            }

            return prevCharacter; // No changes, return the previous state
        });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [gameData, calculateDerivedStats]); // Dependencies are now safer


  // Handlers
  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsLoading(true);
  };

  const handleLogout = () => {
    if(token) api.logout(token).catch(e => console.error("Logout API call failed", e));
    localStorage.removeItem('token');
    setToken(null);
    setPlayerCharacter(null);
    setBaseCharacter(null);
    setGameData(null);
    setIsLoading(false);
    stopTavernPolling();
  };

  const handleCharacterCreate = async ({ name, race }: { name: string; race: Race }) => {
    try {
      const startLocation = gameData?.locations.find(l => l.isStartLocation);
      if (!startLocation) throw new Error("No start location defined in game data.");
      await api.createCharacter(name, race, startLocation.id);
      await fullCharacterSync();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      throw err; // re-throw to keep loading state in component
    }
  };

  const handleStartExpedition = (expeditionId: string) => {
      if (!baseCharacter || !gameData) return;
      const expedition = gameData.expeditions.find(e => e.id === expeditionId);
      if (!expedition) return;

      const updatedCharacter: PlayerCharacter = {
          ...baseCharacter,
          resources: {
              ...baseCharacter.resources,
              gold: baseCharacter.resources.gold - expedition.goldCost,
          },
          stats: {
              ...baseCharacter.stats,
              currentEnergy: baseCharacter.stats.currentEnergy - expedition.energyCost,
          },
          activeExpedition: {
              expeditionId: expedition.id,
              finishTime: Date.now() + expedition.duration * 1000,
              enemies: [], combatLog: [], rewards: { gold: 0, experience: 0 }
          }
      };
      handleCharacterUpdate(updatedCharacter);
  };
  
  const handleClaimRewards = async () => {
    try {
        const charFromServer = await api.getCharacter(); // This triggers server-side completion
        if (charFromServer.lastReward) {
            setLastReward(charFromServer.lastReward as ExpeditionRewardSummary);
            handleCharacterUpdate(charFromServer, true);
        } else {
             handleCharacterUpdate(charFromServer, true);
        }
    } catch (err: any) {
        setError(err.message);
    }
  };
  
  const handleEquipItem = (itemToEquip: ItemInstance) => {
    if (!baseCharacter || !gameData) return;
    const template = gameData.itemTemplates.find(t => t.id === itemToEquip.templateId);
    if (!template) return;
    
    // Level check
    if (baseCharacter.level < template.requiredLevel) {
        alert(t('equipment.levelTooLow'));
        return;
    }
    
    // Stats check
    if (template.requiredStats) {
        for (const [stat, requiredValue] of Object.entries(template.requiredStats)) {
            if (baseCharacter.stats[stat as keyof CharacterStats] < requiredValue) {
                alert(t('equipment.attributeRequirementNotMet', { stat: t(`statistics.${stat}`), value: requiredValue }));
                return;
            }
        }
    }

    const newChar = JSON.parse(JSON.stringify(baseCharacter));
    newChar.inventory = newChar.inventory.filter((i: ItemInstance) => i.uniqueId !== itemToEquip.uniqueId);

    let targetSlot = template.slot;
    const itemsToInventory: ItemInstance[] = [];
    
    if (template.slot === 'ring') {
        if (!newChar.equipment.ring1) targetSlot = EquipmentSlot.Ring1;
        else if (!newChar.equipment.ring2) targetSlot = EquipmentSlot.Ring2;
        else {
            targetSlot = EquipmentSlot.Ring1;
            if(newChar.equipment.ring1) itemsToInventory.push(newChar.equipment.ring1);
        }
    } else if (template.slot === EquipmentSlot.TwoHand) {
        if (newChar.equipment.mainHand) itemsToInventory.push(newChar.equipment.mainHand);
        if (newChar.equipment.offHand) itemsToInventory.push(newChar.equipment.offHand);
        if (newChar.equipment.twoHand) itemsToInventory.push(newChar.equipment.twoHand);
        newChar.equipment.mainHand = null;
        newChar.equipment.offHand = null;
    } else if (template.slot === EquipmentSlot.MainHand || template.slot === EquipmentSlot.OffHand) {
        if (newChar.equipment.twoHand) {
            itemsToInventory.push(newChar.equipment.twoHand);
            newChar.equipment.twoHand = null;
        }
        const currentItemInSlot = newChar.equipment[targetSlot as EquipmentSlot];
        if (currentItemInSlot) itemsToInventory.push(currentItemInSlot);
    } else {
        const currentItemInSlot = newChar.equipment[targetSlot as EquipmentSlot];
        if (currentItemInSlot) itemsToInventory.push(currentItemInSlot);
    }
    
    newChar.inventory.push(...itemsToInventory);
    newChar.equipment[targetSlot as EquipmentSlot] = itemToEquip;
    
    if(newChar.inventory.length > MAX_PLAYER_INVENTORY_SIZE) {
        alert(t('equipment.backpackFull'));
        return;
    }

    handleCharacterUpdate(newChar);
  };
  
  const handleUnequipItem = (itemToUnequip: ItemInstance, fromSlot: EquipmentSlot) => {
    if (!baseCharacter || !gameData) return;
    
    const newChar = JSON.parse(JSON.stringify(baseCharacter));
    
    // --- Start Cascade Unequip Logic ---
    let itemsToBeUnequipped: ItemInstance[] = [itemToUnequip];
    let automaticallyUnequipped: ItemInstance[] = [];
    
    // Simulate removing the initial item to check consequences
    const simulatedEquipment = { ...newChar.equipment };
    simulatedEquipment[fromSlot] = null;
    
    let itemWasRemoved: boolean;
    do {
        itemWasRemoved = false;
        for (const slot in simulatedEquipment) {
            const equippedItem = simulatedEquipment[slot as EquipmentSlot];
            if (equippedItem) {
                const template = gameData.itemTemplates.find(t => t.id === equippedItem.templateId);
                if (template?.requiredStats) {
                    // Check requirements against base stats MINUS bonuses from items that are already marked for removal
                    const tempCharWithoutBonuses: PlayerCharacter = {
                        ...baseCharacter,
                        equipment: simulatedEquipment
                    };
                    const charWithSimulatedBonuses = calculateDerivedStats(tempCharWithoutBonuses, gameData);

                    let meetsReqs = true;
                    for (const [stat, requiredValue] of Object.entries(template.requiredStats)) {
                        // IMPORTANT: We check against BASE stats, not derived stats
                        if (baseCharacter.stats[stat as keyof CharacterStats] < requiredValue) {
                            meetsReqs = false;
                            break;
                        }
                    }

                    if (!meetsReqs) {
                        itemsToBeUnequipped.push(equippedItem);
                        simulatedEquipment[slot as EquipmentSlot] = null;
                        itemWasRemoved = true;
                    }
                }
            }
        }
    } while (itemWasRemoved);

    // --- Inventory Space Check ---
    if (newChar.inventory.length + itemsToBeUnequipped.length > MAX_PLAYER_INVENTORY_SIZE) {
        alert(t('equipment.cascadeUnequipNoSpace', { count: itemsToBeUnequipped.length - 1 }));
        return;
    }
    
    // --- Apply the unequip ---
    newChar.equipment[fromSlot] = null;
    newChar.inventory.push(itemToUnequip);

    // Process cascaded items
    itemsToBeUnequipped.slice(1).forEach(item => {
        for (const slot in newChar.equipment) {
            if (newChar.equipment[slot as EquipmentSlot]?.uniqueId === item.uniqueId) {
                newChar.equipment[slot as EquipmentSlot] = null;
                newChar.inventory.push(item);
                automaticallyUnequipped.push(item);
                break;
            }
        }
    });

    if (automaticallyUnequipped.length > 0) {
        const itemNames = automaticallyUnequipped.map(item => {
            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
            return template?.name || 'Unknown Item';
        }).join(', ');
        setTimeout(() => alert(t('equipment.autoUnequipped', { itemsList: itemNames })), 100);
    }
    
    handleCharacterUpdate(newChar);
  };

  const handleBuyItem = async (item: ItemInstance, cost: number) => {
    if (!baseCharacter) return;
    if (baseCharacter.inventory.length >= MAX_PLAYER_INVENTORY_SIZE) {
      alert(t('trader.inventoryFull'));
      return;
    }
    if (baseCharacter.resources.gold < cost) {
      alert(t('trader.notEnoughGold'));
      return;
    }
    
    try {
        const updatedCharacter = await api.buyItem(item.uniqueId);
        handleCharacterUpdate(updatedCharacter, true); // Update state with server response
        
        // Remove bought item from local trader inventory for immediate UI feedback
        setTraderInventory(prev => prev.filter(i => i.uniqueId !== item.uniqueId));

    } catch (err: any) {
        alert(`Error: ${err.message}`);
        // Optionally, force a full resync on failure to ensure consistency
        await fullCharacterSync();
    }
  };
  
  const handleSellItems = (itemsToSell: ItemInstance[]) => {
    if (!baseCharacter || !gameData || itemsToSell.length === 0) return;

    const totalValue = itemsToSell.reduce((sum, item) => {
      const template = gameData.itemTemplates.find(t => t.id === item.templateId);
      return sum + (template?.value || 0);
    }, 0);

    const newChar = JSON.parse(JSON.stringify(baseCharacter));
    newChar.resources.gold += totalValue;

    const idsToSell = new Set(itemsToSell.map(i => i.uniqueId));
    newChar.inventory = newChar.inventory.filter((i: ItemInstance) => !idsToSell.has(i.uniqueId));
    
    handleCharacterUpdate(newChar);
  };

  const handleToggleResting = () => {
    if (!baseCharacter || baseCharacter.activeTravel || baseCharacter.activeExpedition) return;
    
    const newChar = JSON.parse(JSON.stringify(baseCharacter));
    newChar.isResting = !newChar.isResting;
    
    if (newChar.isResting) {
      newChar.restStartHealth = playerCharacter!.stats.currentHealth;
      newChar.lastRestTime = Date.now();
    }
    
    handleCharacterUpdate(newChar);
  };

  const getCampUpgradeCost = (level: number) => Math.floor(150 * Math.pow(level, 1.8));

  const handleUpgradeCamp = () => {
    if (!baseCharacter || baseCharacter.isResting || baseCharacter.activeTravel) return;
    const cost = getCampUpgradeCost(baseCharacter.camp.level);
    if (baseCharacter.resources.gold < cost) {
      alert(t('camp.notEnoughGold'));
      return;
    }

    const newChar = JSON.parse(JSON.stringify(baseCharacter));
    newChar.resources.gold -= cost;
    newChar.camp.level += 1;
    handleCharacterUpdate(newChar);
  };

  const handleDisenchantItem = (item: ItemInstance): { success: boolean; amount?: number; essenceType?: EssenceType } => {
    if (!baseCharacter || !gameData) return { success: false };

    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) return { success: false };
    
    const cost = Math.round(template.value * 0.1);
    if (baseCharacter.resources.gold < cost) {
        alert(t('blacksmith.notEnoughGold'));
        return { success: false };
    }

    let essenceType: EssenceType | null = null;
    let essenceAmount = 0;

    switch (template.rarity) {
        case ItemRarity.Common: essenceType = EssenceType.Common; essenceAmount = Math.floor(Math.random() * 4) + 1; break;
        case ItemRarity.Uncommon: essenceType = EssenceType.Uncommon; essenceAmount = Math.floor(Math.random() * 2) + 1; break;
        case ItemRarity.Rare: essenceType = EssenceType.Rare; essenceAmount = Math.floor(Math.random() * 2) + 1; break;
        case ItemRarity.Epic: essenceType = EssenceType.Epic; essenceAmount = 1; break;
        case ItemRarity.Legendary: essenceType = EssenceType.Legendary; essenceAmount = Math.random() < 0.5 ? 1 : 0; break;
    }
    
    const newChar = JSON.parse(JSON.stringify(baseCharacter));
    newChar.resources.gold -= cost;
    newChar.inventory = newChar.inventory.filter((i: ItemInstance) => i.uniqueId !== item.uniqueId);
    
    if (!essenceType || essenceAmount === 0) {
        handleCharacterUpdate(newChar);
        return { success: false };
    }

    newChar.resources[essenceType] = (newChar.resources[essenceType] || 0) + essenceAmount;
    
    handleCharacterUpdate(newChar);
    return { success: true, amount: essenceAmount, essenceType };
  };

  const handleUpgradeItem = (item: ItemInstance): { success: boolean; messageKey: string; level?: number } => {
    if (!baseCharacter || !gameData) return { success: false, messageKey: 'error.title' };

    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) return { success: false, messageKey: 'error.title' };

    const currentLevel = item.upgradeLevel || 0;
    const nextLevel = currentLevel + 1;
    if (nextLevel > 10) {
        return { success: false, messageKey: 'blacksmith.upgrade.maxLevel' };
    }

    const rarityMultiplier: Record<ItemRarity, number> = { [ItemRarity.Common]: 1, [ItemRarity.Uncommon]: 1.5, [ItemRarity.Rare]: 2.5, [ItemRarity.Epic]: 4, [ItemRarity.Legendary]: 8 };
    const goldCost = Math.floor(template.value * 0.5 * nextLevel * rarityMultiplier[template.rarity]);
    
    const essenceMap: Partial<Record<ItemRarity, EssenceType>> = { [ItemRarity.Common]: EssenceType.Common, [ItemRarity.Uncommon]: EssenceType.Uncommon, [ItemRarity.Rare]: EssenceType.Rare, [ItemRarity.Epic]: EssenceType.Epic, [ItemRarity.Legendary]: EssenceType.Legendary };
    const essenceType = essenceMap[template.rarity];
    const essenceCost = 1;

    if (baseCharacter.resources.gold < goldCost) {
        alert(t('blacksmith.notEnoughGold'));
        return { success: false, messageKey: 'blacksmith.notEnoughGold' };
    }
    if (!essenceType || (baseCharacter.resources[essenceType] || 0) < essenceCost) {
        alert(t('blacksmith.notEnoughEssence'));
        return { success: false, messageKey: 'blacksmith.notEnoughEssence' };
    }

    const successChance = Math.max(10, 100 - (currentLevel * 10));
    const isSuccess = Math.random() * 100 < successChance;

    let newChar = JSON.parse(JSON.stringify(baseCharacter));
    newChar.resources.gold -= goldCost;
    if (essenceType) {
        newChar.resources[essenceType] -= essenceCost;
    }

    if (isSuccess) {
        const updateItem = (i: ItemInstance) => i.uniqueId === item.uniqueId ? { ...i, upgradeLevel: nextLevel } : i;
        newChar.inventory = newChar.inventory.map(updateItem);
        for (const slot in newChar.equipment) {
            if (newChar.equipment[slot as EquipmentSlot]?.uniqueId === item.uniqueId) {
                newChar.equipment[slot as EquipmentSlot] = updateItem(newChar.equipment[slot as EquipmentSlot]!);
            }
        }
        handleCharacterUpdate(newChar);
        return { success: true, messageKey: 'blacksmith.upgrade.upgradeSuccess', level: nextLevel };
    } else {
        newChar.inventory = newChar.inventory.filter((i: ItemInstance) => i.uniqueId !== item.uniqueId);
        for (const slot in newChar.equipment) {
             if (newChar.equipment[slot as EquipmentSlot]?.uniqueId === item.uniqueId) {
                newChar.equipment[slot as EquipmentSlot] = null;
            }
        }
        handleCharacterUpdate(newChar);
        return { success: false, messageKey: 'blacksmith.upgrade.upgradeFailure' };
    }
  };

  const handleAcceptQuest = (questId: string) => {
    if (!baseCharacter) return;
    const newChar = { ...baseCharacter };
    if (!newChar.acceptedQuests.includes(questId)) {
        newChar.acceptedQuests = [...newChar.acceptedQuests, questId];
    }
    if (!newChar.questProgress.find(p => p.questId === questId)) {
        newChar.questProgress = [...newChar.questProgress, { questId, progress: 0, completions: 0 }];
    }
    handleCharacterUpdate(newChar);
  };

  const handleCompleteQuest = (questId: string) => {
      if (!baseCharacter || !gameData) return;
      const quest = gameData.quests.find(q => q.id === questId);
      if (!quest) return;
  
      let newChar = JSON.parse(JSON.stringify(baseCharacter));
      
      // --- Calculate item rewards and check for inventory space BEFORE making changes ---
      const itemsToAdd: ItemInstance[] = [];
      if (quest.rewards.itemRewards) {
          for (const reward of quest.rewards.itemRewards) {
              for (let i = 0; i < reward.quantity; i++) {
                  itemsToAdd.push({ uniqueId: crypto.randomUUID(), templateId: reward.templateId });
              }
          }
      }
      if (quest.rewards.lootTable) {
          for (const drop of quest.rewards.lootTable) {
              if (Math.random() * 100 < drop.chance) {
                  itemsToAdd.push({ uniqueId: crypto.randomUUID(), templateId: drop.templateId });
              }
          }
      }
  
      let itemsToRemoveCount = 0;
      if (quest.objective.type === QuestType.Gather) {
          itemsToRemoveCount = quest.objective.amount;
      }
      
      if (newChar.inventory.length - itemsToRemoveCount + itemsToAdd.length > MAX_PLAYER_INVENTORY_SIZE) {
          alert(t('equipment.backpackFull'));
          return;
      }
      // --- End of pre-check ---
  
      // --- Handle Objective (remove items/gold/resources) ---
      if (quest.objective.type === QuestType.Gather) {
          let needed = quest.objective.amount;
          const newInventory = [];
          for (const item of newChar.inventory) {
              if (item.templateId === quest.objective.targetId && needed > 0) {
                  needed--;
              } else {
                  newInventory.push(item);
              }
          }
          if (needed > 0) { alert(t('quests.notEnoughItems')); return; }
          newChar.inventory = newInventory;
      } else if (quest.objective.type === QuestType.PayGold) {
          if (newChar.resources.gold < quest.objective.amount) { alert(t('quests.notEnoughGold')); return; }
          newChar.resources.gold -= quest.objective.amount;
      } else if (quest.objective.type === QuestType.GatherResource) {
           const resourceType = quest.objective.targetId as EssenceType;
           if ((newChar.resources[resourceType] || 0) < quest.objective.amount) { alert(t('quests.notEnoughEssence')); return; }
           newChar.resources[resourceType] -= quest.objective.amount;
      }
  
      // --- Add Rewards ---
      newChar.resources.gold += quest.rewards.gold;
      newChar.experience += quest.rewards.experience;
      newChar.inventory.push(...itemsToAdd);
      
      if (quest.rewards.resourceRewards) {
          for (const reward of quest.rewards.resourceRewards) {
              newChar.resources[reward.resource] = (newChar.resources[reward.resource] || 0) + reward.quantity;
          }
      }
  
      // --- Update Progress & Level ---
      const progressIndex = newChar.questProgress.findIndex((p: PlayerQuestProgress) => p.questId === questId);
      if (progressIndex > -1) {
          newChar.questProgress[progressIndex].completions += 1;
          newChar.questProgress[progressIndex].progress = 0;
          const progress = newChar.questProgress[progressIndex];
          if (quest.repeatable > 0 && progress.completions >= quest.repeatable) {
              newChar.acceptedQuests = newChar.acceptedQuests.filter((id: string) => id !== questId);
          }
      } else {
          newChar.questProgress.push({ questId, progress: 0, completions: 1 });
      }
  
      while (newChar.experience >= newChar.experienceToNextLevel) {
          newChar.experience -= newChar.experienceToNextLevel;
          newChar.level += 1;
          newChar.stats.statPoints += 1;
          newChar.experienceToNextLevel = Math.floor(100 * Math.pow(newChar.level, 1.3));
      }
  
      handleCharacterUpdate(newChar);
  };

  const handleGameDataUpdate = async (key: keyof Omit<GameData, 'settings'>, data: any) => {
    await api.updateGameData(key, data);
    await fullCharacterSync();
  };

  const handleSettingsUpdate = async (settings: GameSettings) => {
      await api.updateGameSettings(settings);
      await fullCharacterSync();
  };

  const handleDeleteUser = async (userId: number) => {
      if (window.confirm(t('admin.deleteConfirm'))) {
          await api.deleteUser(userId);
          await fullCharacterSync();
      }
  };
  
  const handleDeleteCharacter = async (userId: number) => {
      if (window.confirm(t('admin.deleteCharacterConfirm'))) {
          await api.deleteCharacter(userId);
          await fullCharacterSync();
      }
  };

  const handleResetCharacterStats = async (userId: number) => {
      if (window.confirm(t('admin.resetStatsConfirm'))) {
          await api.resetCharacterStats(userId);
          alert(t('admin.resetStatsSuccess'));
          await fullCharacterSync();
      }
  };
  
  const handleHealCharacter = async (userId: number) => {
      if (window.confirm(t('admin.healCharacterConfirm'))) {
          await api.healCharacter(userId);
          alert(t('admin.healSuccess'));
          await fullCharacterSync();
      }
  };
  
  const handleForceTraderRefresh = async () => {
    if (window.confirm(t('admin.traderRefreshConfirm'))) {
        const newInventory = await api.getTraderInventory(true); // Force refresh
        setTraderInventory(newInventory);
        alert(t('admin.traderRefreshSuccess'));
    }
  };

  const handleResetAllPvpCooldowns = async () => {
    if(window.confirm(t('admin.pvp.resetCooldownsConfirm'))) {
        await api.resetAllPvpCooldowns();
        alert(t('admin.pvp.resetCooldownsSuccess'));
        await fullCharacterSync();
    }
  };

  const handleSendTavernMessage = async (content: string) => {
    try {
        await api.sendTavernMessage(content);
        fetchTavernMessages();
    } catch(e) {
        console.error("Failed to send tavern message", e);
    }
  };

  const handleComposeMessage = (recipientName?: string, subject?: string) => {
    setComposeInitialData(recipientName ? { recipient: recipientName, subject: subject || '' } : undefined);
    setIsComposingMessage(true);
  };
  
  // Render Logic
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p>{t('loading')}</p></div>;
  if (error) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-900/50 text-white p-4">
        <h2 className="text-3xl font-bold mb-4">{t('error.title')}</h2>
        <p className="mb-4">{error}</p>
        <p className="text-sm text-gray-300 mb-6">{t('error.refresh')}</p>
        <button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded">{t('error.logout')}</button>
      </div>
  );
  if (!token) return <Auth onLoginSuccess={handleLoginSuccess} />;
  if (!playerCharacter || !baseCharacter) return <CharacterCreation onCharacterCreate={handleCharacterCreate} />;
  
  return (
    <LanguageContext.Provider value={{ lang: currentLanguage, t }}>
      <div className="flex h-screen font-sans">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          playerCharacter={playerCharacter}
          currentLocation={currentLocation}
          onLogout={handleLogout}
          hasUnreadMessages={hasUnreadMessages}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          {activeTab === Tab.Statistics && gameData && <Statistics character={playerCharacter} baseCharacter={baseCharacter} onCharacterUpdate={handleCharacterUpdate} calculateDerivedStats={calculateDerivedStats} gameData={gameData} />}
          {activeTab === Tab.Equipment && gameData && <Equipment character={playerCharacter} baseCharacter={baseCharacter} itemTemplates={gameData.itemTemplates} onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem} />}
          {activeTab === Tab.Expedition && gameData && currentLocation && <ExpeditionComponent character={playerCharacter} onCharacterUpdate={handleCharacterUpdate} expeditions={gameData.expeditions} enemies={gameData.enemies} currentLocation={currentLocation} onStartExpedition={handleStartExpedition} onClaimRewards={handleClaimRewards} lastReward={lastReward} onClearLastReward={() => setLastReward(null)} itemTemplates={gameData.itemTemplates} />}
          {activeTab === Tab.Camp && <Camp character={playerCharacter} baseCharacter={baseCharacter} onToggleResting={handleToggleResting} onUpgradeCamp={handleUpgradeCamp} getUpgradeCost={getCampUpgradeCost} onCharacterUpdate={handleCharacterUpdate} />}
          {activeTab === Tab.Location && gameData && <LocationComponent playerCharacter={playerCharacter} onCharacterUpdate={handleCharacterUpdate} locations={gameData.locations} />}
          {activeTab === Tab.Resources && <Resources character={playerCharacter} />}
          {activeTab === Tab.Ranking && <Ranking ranking={ranking} currentPlayer={playerCharacter} onRefresh={fullCharacterSync} isLoading={isRankingLoading} onAttack={async (defenderId) => { await api.attackPlayer(defenderId); await fullCharacterSync(); }} onComposeMessage={handleComposeMessage} />}
          {activeTab === Tab.Trader && gameData && <Trader character={playerCharacter} baseCharacter={baseCharacter} itemTemplates={gameData.itemTemplates} settings={gameData.settings} traderInventory={traderInventory} onBuyItem={handleBuyItem} onSellItems={handleSellItems}/>}
          {activeTab === Tab.Blacksmith && gameData && <Blacksmith character={playerCharacter} itemTemplates={gameData.itemTemplates} onDisenchantItem={handleDisenchantItem} onUpgradeItem={handleUpgradeItem} />}
          {activeTab === Tab.Messages && gameData && <Messages messages={messages} onDeleteMessage={async (id) => { await api.deleteMessage(id); await fullCharacterSync(); }} onMarkAsRead={async (id) => { await api.markMessageAsRead(id); setMessages(m => m.map(msg => msg.id === id ? {...msg, is_read: true} : msg)) }} onCompose={handleComposeMessage} itemTemplates={gameData.itemTemplates} currentPlayer={playerCharacter} />}
          {activeTab === Tab.Quests && gameData && <Quests character={playerCharacter} quests={gameData.quests} enemies={gameData.enemies} itemTemplates={gameData.itemTemplates} onAcceptQuest={handleAcceptQuest} onCompleteQuest={handleCompleteQuest} />}
          {activeTab === Tab.Tavern && <Tavern character={playerCharacter} messages={tavernMessages} onSendMessage={handleSendTavernMessage}/>}
          {activeTab === Tab.Admin && gameData && playerCharacter.username === 'Kazujoshi' && <AdminPanel locations={gameData.locations} onLocationsUpdate={(d) => handleGameDataUpdate('locations', d)} expeditions={gameData.expeditions} onExpeditionsUpdate={(d) => handleGameDataUpdate('expeditions', d)} enemies={gameData.enemies} onEnemiesUpdate={(d) => handleGameDataUpdate('enemies', d)} itemTemplates={gameData.itemTemplates} onItemTemplatesUpdate={(d) => handleGameDataUpdate('itemTemplates', d)} quests={gameData.quests} onQuestsUpdate={(d) => handleGameDataUpdate('quests', d)} settings={gameData.settings} onSettingsUpdate={handleSettingsUpdate} users={users} onDeleteUser={handleDeleteUser} allCharacters={allCharacters} onDeleteCharacter={handleDeleteCharacter} onResetCharacterStats={handleResetCharacterStats} onHealCharacter={handleHealCharacter} onForceTraderRefresh={handleForceTraderRefresh} onResetAllPvpCooldowns={handleResetAllPvpCooldowns} />}
        </main>
        {isComposingMessage && <ComposeMessageModal allCharacterNames={allCharacterNames} onClose={() => setIsComposingMessage(false)} onSendMessage={async (data) => { await api.sendMessage(data); await fullCharacterSync(); }} initialRecipient={composeInitialData?.recipient} initialSubject={composeInitialData?.subject} />}
      </div>
    </LanguageContext.Provider>
  );
};

export default App;