

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// FIX: Import NewsModal component.
import { Sidebar, NewsModal } from './components/Sidebar';
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
import { Market } from './components/Market';
import { Options } from './components/Options';
import { Tab, PlayerCharacter, Location, Expedition, Enemy, ExpeditionRewardSummary, CombatLogEntry, Race, RankingPlayer, Language, GameSettings, User, AdminCharacterInfo, RewardSource, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, ItemRarity, EssenceType, MagicAttackType, Message, PvpRewardSummary, Quest, QuestType, PlayerQuestProgress, LootDrop, TavernMessage, GameData, Affix, RolledAffixStats, GrammaticalGender, CharacterClass } from './types';
import { api } from './api';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';

const getBackpackCapacity = (character: PlayerCharacter) => 40 + ((character.backpack?.level || 1) - 1) * 10;

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Player and Game Data
  const [playerCharacter, setPlayerCharacter] = useState<PlayerCharacter | null>(null);
  const [baseCharacter, setBaseCharacter] = useState<PlayerCharacter | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [expeditionReport, setExpeditionReport] = useState<ExpeditionRewardSummary | null>(null);
  const [pvpReport, setPvpReport] = useState<PvpRewardSummary | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
  // FIX: Added state for news modal.
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  
  // Admin & Social State
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [allCharacters, setAllCharacters] = useState<AdminCharacterInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isComposingMessage, setIsComposingMessage] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState<{ recipient: string; subject: string } | undefined>(undefined);
  const [allCharacterNames, setAllCharacterNames] = useState<string[]>([]);
  const [hasNewTavernMessages, setHasNewTavernMessages] = useState(false);
  
  // Trader State
  const [traderInventory, setTraderInventory] = useState<ItemInstance[]>([]);

  // Tavern State
  const [tavernMessages, setTavernMessages] = useState<TavernMessage[]>([]);
  const tavernIntervalRef = useRef<number | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const isCompletingExpeditionRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);

  // i18n
  const currentLanguage = playerCharacter?.settings?.language || Language.PL;
  const t = useMemo(() => getT(currentLanguage), [currentLanguage]);

  // Derived State
  const currentLocation = useMemo(() => gameData?.locations.find(loc => loc.id === playerCharacter?.currentLocationId), [gameData, playerCharacter]);
  const hasUnreadMessages = useMemo(() => messages.some(m => !m.is_read), [messages]);
  const lastReadTavernMessageIdRef = useRef<number | null>(null);
  // FIX: Added derived state for new news notification.
  const hasNewNews = useMemo(() => {
    if (!gameData?.settings.newsLastUpdatedAt || !playerCharacter) {
        return false;
    }
    // Only show "new" if there's actual content
    return !!gameData.settings.newsContent && gameData.settings.newsLastUpdatedAt > (playerCharacter.lastReadNewsTimestamp || 0);
  }, [gameData, playerCharacter]);


  const handleLogout = useCallback(() => {
    if (token) {
      api.logout(token).catch(err => console.error("Logout failed:", err));
    }
    localStorage.removeItem('token');
    setToken(null);
    setPlayerCharacter(null);
    setBaseCharacter(null);
  }, [token]);
  
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = window.setTimeout(() => {
      if (localStorage.getItem('token')) {
        console.log("Logging out due to 30 minutes of inactivity.");
        handleLogout();
      }
    }, 30 * 60 * 1000); // 30 minutes
  }, [handleLogout]);

  const handleCheckExpeditionCompletion = useCallback(async () => {
    if (isCompletingExpeditionRef.current) return;

    isCompletingExpeditionRef.current = true;
    try {
        const charData = await api.getCharacter();
        if (charData.expeditionSummary) {
            setExpeditionReport(charData.expeditionSummary);
            delete charData.expeditionSummary;
        }
        setBaseCharacter(charData);
        const freshMessages = await api.getMessages();
        setMessages(freshMessages);
    } catch (err: any) {
        setError(err.message);
    } finally {
        isCompletingExpeditionRef.current = false;
    }
  }, []);

  // Derived Stat Calculation for UI Previews
  const calculateDerivedStats = useCallback((character: PlayerCharacter, gameDataForCalc: GameData | null): PlayerCharacter => {
      if (!gameDataForCalc) return character;
      const { itemTemplates, affixes } = gameDataForCalc;

      const getMaxValue = (value: number | { min: number; max: number } | undefined): number => {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value; // Handles old format
        if (typeof value === 'object' && 'max' in value) return value.max; // Handles new format
        return 0; // Fallback for any other case
      };

      const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
          strength: character.stats.strength, agility: character.stats.agility, accuracy: character.stats.accuracy,
          stamina: character.stats.stamina, intelligence: character.stats.intelligence, energy: character.stats.energy
      };

      let bonusDamageMin = 0, bonusDamageMax = 0, bonusMagicDamageMin = 0, bonusMagicDamageMax = 0;
      let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0, bonusDodgeChance = 0;
      let bonusAttacksPerRound = 0;
      let bonusCritDamageModifier = 0;
      let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
      let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
      let bonusManaStealPercent = 0, bonusManaStealFlat = 0;
      
      const applyAffixBonuses = (source: RolledAffixStats) => {
          if (source.statsBonus) {
              for (const stat in source.statsBonus) {
                  const key = stat as keyof typeof source.statsBonus;
                  totalPrimaryStats[key] += source.statsBonus[key] || 0;
              }
          }
          bonusDamageMin += source.damageMin || 0;
          bonusDamageMax += source.damageMax || 0;
          bonusMagicDamageMin += source.magicDamageMin || 0;
          bonusMagicDamageMax += source.magicDamageMax || 0;
          bonusArmor += source.armorBonus || 0;
          bonusCritChance += source.critChanceBonus || 0;
          bonusMaxHealth += source.maxHealthBonus || 0;
          bonusCritDamageModifier += source.critDamageModifierBonus || 0;
          bonusArmorPenetrationPercent += source.armorPenetrationPercent || 0;
          bonusArmorPenetrationFlat += source.armorPenetrationFlat || 0;
          bonusLifeStealPercent += source.lifeStealPercent || 0;
          bonusLifeStealFlat += source.lifeStealFlat || 0;
          bonusManaStealPercent += source.manaStealPercent || 0;
          bonusManaStealFlat += source.manaStealFlat || 0;
          bonusAttacksPerRound += source.attacksPerRoundBonus || 0;
          bonusDodgeChance += source.dodgeChanceBonus || 0;
      };

      for (const slot in character.equipment) {
          const itemInstance = character.equipment[slot as EquipmentSlot];
          if (itemInstance) {
              const template = itemTemplates.find(t => t.id === itemInstance.templateId);
              if (template) {
                  const upgradeLevel = itemInstance.upgradeLevel || 0;
                  const upgradeBonusFactor = upgradeLevel * 0.1;
                  
                  if (template.statsBonus) {
                      for (const stat in template.statsBonus) {
                          const key = stat as keyof typeof template.statsBonus;
                          const bonusValue = template.statsBonus[key];
                          const baseBonus = getMaxValue(bonusValue as any);
                          totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                      }
                  }

                  const baseDamageMin = getMaxValue(template.damageMin as any);
                  const baseDamageMax = getMaxValue(template.damageMax as any);
                  const baseMagicDamageMin = getMaxValue(template.magicDamageMin as any);
                  const baseMagicDamageMax = getMaxValue(template.magicDamageMax as any);
                  const baseArmor = getMaxValue(template.armorBonus as any);
                  const baseCritChance = getMaxValue(template.critChanceBonus as any);
                  const baseMaxHealth = getMaxValue(template.maxHealthBonus as any);
                  
                  bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeBonusFactor);
                  bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeBonusFactor);
                  bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeBonusFactor);
                  bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeBonusFactor);
                  bonusArmor += baseArmor + Math.round(baseArmor * upgradeBonusFactor);
                  bonusCritChance += baseCritChance + (baseCritChance * upgradeBonusFactor);
                  bonusMaxHealth += baseMaxHealth + Math.round(baseMaxHealth * upgradeBonusFactor);

                  bonusCritDamageModifier += getMaxValue(template.critDamageModifierBonus as any);
                  bonusArmorPenetrationPercent += getMaxValue(template.armorPenetrationPercent as any);
                  bonusArmorPenetrationFlat += getMaxValue(template.armorPenetrationFlat as any);
                  bonusLifeStealPercent += getMaxValue(template.lifeStealPercent as any);
                  bonusLifeStealFlat += getMaxValue(template.lifeStealFlat as any);
                  bonusManaStealPercent += getMaxValue(template.manaStealPercent as any);
                  bonusManaStealFlat += getMaxValue(template.manaStealFlat as any);
              }
              if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
              if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
          }
      }

      const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
      const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;

      const baseAttacksPerRound = mainHandTemplate?.attacksPerRound || 1;
      const attacksPerRound = parseFloat((baseAttacksPerRound + bonusAttacksPerRound).toFixed(2));

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
      const dodgeChance = totalPrimaryStats.agility * 0.1 + bonusDodgeChance;

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
      
      if (isNaN(maxHealth) || isNaN(maxEnergy) || isNaN(maxMana)) {
          console.error("NaN detected in derived stats calculation!", {
              totalPrimaryStats, bonusMaxHealth, bonusCritChance, bonusArmor
          });
          return character;
      }

      return {
          ...character,
          stats: {
              ...character.stats, ...totalPrimaryStats,
              maxHealth, maxEnergy, maxMana, minDamage, maxDamage, critChance, armor,
              magicDamageMin, magicDamageMax, attacksPerRound, manaRegen,
              currentHealth, currentMana, currentEnergy,
              critDamageModifier, armorPenetrationPercent, armorPenetrationFlat,
              lifeStealPercent, lifeStealFlat, manaStealPercent, manaStealFlat,
              dodgeChance,
          }
      };
  }, []);

  const handleCharacterUpdate = useCallback(async (character: PlayerCharacter, immediate = false) => {
    setBaseCharacter(character);
    if (immediate) {
      try {
        const updatedChar = await api.updateCharacter(character);
        setBaseCharacter(updatedChar); // sync with server response
      } catch (err: any) {
        setError(err.message);
      }
    }
  }, []);

  // FIX: Added handlers for opening and closing the news modal.
  const handleOpenNews = useCallback(() => {
    setIsNewsModalOpen(true);
  }, []);

  const handleCloseNews = useCallback(() => {
    setIsNewsModalOpen(false);
    if (playerCharacter && baseCharacter && gameData?.settings.newsLastUpdatedAt) {
        if ((baseCharacter.lastReadNewsTimestamp || 0) < gameData.settings.newsLastUpdatedAt) {
            const updatedChar: PlayerCharacter = {
                ...baseCharacter,
                lastReadNewsTimestamp: gameData.settings.newsLastUpdatedAt,
            };
            handleCharacterUpdate(updatedChar, true);
        }
    }
  }, [playerCharacter, baseCharacter, gameData, handleCharacterUpdate]);

  const handleStartExpedition = useCallback((expeditionId: string) => {
    if (!baseCharacter || !gameData || baseCharacter.isResting || baseCharacter.activeTravel) return;

    const expedition = gameData.expeditions.find(e => e.id === expeditionId);
    if (!expedition) {
      alert(t('expedition.lackResources'));
      return;
    }

    if (baseCharacter.resources.gold < expedition.goldCost || baseCharacter.stats.currentEnergy < expedition.energyCost) {
      alert(t('expedition.lackResources'));
      return;
    }
    
    const updatedCharacter: PlayerCharacter = {
      ...baseCharacter,
      resources: { ...baseCharacter.resources, gold: baseCharacter.resources.gold - expedition.goldCost, },
      stats: { ...baseCharacter.stats, currentEnergy: baseCharacter.stats.currentEnergy - expedition.energyCost, },
      activeExpedition: {
        expeditionId: expedition.id,
        finishTime: Date.now() + expedition.duration * 1000,
        enemies: [], combatLog: [], rewards: { gold: 0, experience: 0 },
      },
    };
    handleCharacterUpdate(updatedCharacter, true);
  }, [baseCharacter, gameData, handleCharacterUpdate, t]);

  const handleToggleResting = useCallback(() => {
    if (!baseCharacter) return;
    const isNowResting = !baseCharacter.isResting;
    const updatedChar: PlayerCharacter = {
        ...baseCharacter,
        isResting: isNowResting,
        lastRestTime: isNowResting ? Date.now() : baseCharacter.lastRestTime,
        restStartHealth: isNowResting ? baseCharacter.stats.currentHealth : baseCharacter.restStartHealth
    };
    handleCharacterUpdate(updatedChar, true);
  }, [baseCharacter, handleCharacterUpdate]);

  const handleHealToFull = useCallback(() => {
      if (!baseCharacter) return;
      const derived = calculateDerivedStats(baseCharacter, gameData);
      const updatedChar: PlayerCharacter = {
          ...baseCharacter,
          stats: { ...baseCharacter.stats, currentHealth: derived.stats.maxHealth }
      };
      handleCharacterUpdate(updatedChar, true);
  }, [baseCharacter, gameData, calculateDerivedStats, handleCharacterUpdate]);
  
  const handleResetAttributes = useCallback(async () => {
    if (!baseCharacter || !gameData) return;

    const isFreeReset = !baseCharacter.freeStatResetUsed;
    const resetCost = 100 * baseCharacter.level;
    const costText = isFreeReset ? t('statistics.reset.free') : t('statistics.reset.cost', { cost: resetCost });

    if (!window.confirm(t('statistics.reset.confirm', { costText }))) {
        return;
    }

    if (!isFreeReset && baseCharacter.resources.gold < resetCost) {
        alert(t('statistics.reset.notEnoughGold', { cost: resetCost }));
        return;
    }

    // Sum up all base attributes and stat points
    const totalPointsToRefund =
        baseCharacter.stats.strength +
        baseCharacter.stats.agility +
        baseCharacter.stats.accuracy +
        baseCharacter.stats.stamina +
        baseCharacter.stats.intelligence +
        baseCharacter.stats.energy +
        baseCharacter.stats.statPoints;

    const updatedChar: PlayerCharacter = {
        ...baseCharacter,
        stats: {
            ...baseCharacter.stats,
            strength: 0,
            agility: 0,
            accuracy: 0,
            stamina: 0,
            intelligence: 0,
            energy: 0,
            statPoints: totalPointsToRefund,
        },
        resources: {
            ...baseCharacter.resources,
            gold: isFreeReset ? baseCharacter.resources.gold : baseCharacter.resources.gold - resetCost,
        },
        freeStatResetUsed: true,
    };
    
    await handleCharacterUpdate(updatedChar, true);

}, [baseCharacter, gameData, handleCharacterUpdate, t]);

const handleSelectClass = useCallback(async (characterClass: CharacterClass) => {
    if (!baseCharacter) return;
    try {
        const updatedChar = await api.selectClass(characterClass);
        setBaseCharacter(updatedChar);
    } catch(err: any) {
        alert(err.message);
    }
}, [baseCharacter]);

  const handleBuyItem = useCallback(async (item: ItemInstance, cost: number) => {
    if (!baseCharacter || !gameData) return;
    try {
        const updatedCharacter = await api.buyItem(item.uniqueId);
        setBaseCharacter(updatedCharacter);
        setTraderInventory(prev => prev.filter(i => i.uniqueId !== item.uniqueId));
    } catch (err: any) {
        alert(err.message);
    }
  }, [baseCharacter, gameData]);

  const handleSellItems = useCallback(async (items: ItemInstance[]) => {
    if (!baseCharacter || items.length === 0) return;
    try {
        const itemIds = items.map(i => i.uniqueId);
        const updatedCharacter = await api.sellItems(itemIds);
        setBaseCharacter(updatedCharacter);
    } catch (err: any) {
        alert(err.message);
    }
  }, [baseCharacter]);

  const fetchRanking = useCallback(async () => {
    setIsRankingLoading(true);
    try {
      const rankingData = await api.getRanking();
      setRanking(rankingData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRankingLoading(false);
    }
  }, []);

  const fetchTraderInventory = useCallback(async () => {
    try {
      const inventoryData = await api.getTraderInventory();
      setTraderInventory(inventoryData);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: number) => {
    try {
        await api.deleteMessage(messageId);
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
    } catch (err: any) {
        setError(err.message);
    }
  }, []);

  const handleBulkDeleteMessages = useCallback(async (type: 'read' | 'all' | 'expedition_reports') => {
    try {
      await api.deleteBulkMessages(type);
      const freshMessages = await api.getMessages();
      setMessages(freshMessages);
    } catch (err: any) {
      alert(err.message);
    }
  }, []);

  const handleMarkAsRead = useCallback(async (messageId: number) => {
    try {
        await api.markMessageAsRead(messageId);
        setMessages(prevMessages => prevMessages.map(msg => 
            msg.id === messageId ? { ...msg, is_read: true } : msg
        ));
    } catch (err: any) {
        setError(err.message);
    }
  }, []);

  const handleComposeMessage = useCallback((recipient?: string, subject?: string) => {
    setComposeInitialData(recipient || subject ? { recipient: recipient || '', subject: subject || '' } : undefined);
    setIsComposingMessage(true);
  }, []);

  const handleSendMessage = useCallback(async (data: { recipientName: string; subject: string; content: string }) => {
    try {
        await api.sendMessage(data);
    } catch (err: any) {
        // Re-throw the error to be handled by the modal
        throw err;
    }
  }, []);

  const handleClaimMessageItem = useCallback(async (messageId: number): Promise<boolean> => {
    try {
        const updatedChar = await api.claimMarketReturn(messageId);
        setBaseCharacter(updatedChar);
        setMessages(prev => prev.filter(m => m.id !== messageId));
        return true;
    } catch (err: any) {
        alert(err.message);
        return false;
    }
}, []);

    const handlePvpAttack = useCallback(async (defenderId: number) => {
        if (!baseCharacter) return;
        try {
            const { summary, updatedAttacker } = await api.attackPlayer(defenderId);
            setPvpReport(summary);
            setBaseCharacter(updatedAttacker);
        } catch (err: any) {
            alert(err.message);
        }
    }, [baseCharacter]);

  const handleEquipItem = useCallback(async (item: ItemInstance) => {
    if (!baseCharacter || !gameData) return;

    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) return;

    const itemToEquip = baseCharacter.inventory.find(i => i.uniqueId === item.uniqueId);
    if (!itemToEquip) {
      console.error("Item to equip not found in inventory.");
      return;
    }

    const derivedForCheck = calculateDerivedStats(baseCharacter, gameData);
    if (derivedForCheck.level < template.requiredLevel) {
        alert(t('equipment.levelTooLow'));
        return;
    }
    if (template.requiredStats) {
        for (const stat in template.requiredStats) {
            const key = stat as keyof CharacterStats;
            if (derivedForCheck.stats[key] < (template.requiredStats[key] || 0)) {
                alert(t('equipment.attributeRequirementNotMet', { stat: t(`statistics.${key}`), value: template.requiredStats[key]! }));
                return;
            }
        }
    }

    // --- Simulation-based Backpack Capacity Check ---
    
    // 1. Determine the target slot
    let targetSlot = template.slot as EquipmentSlot;
    if (template.slot === 'ring') {
        if (!baseCharacter.equipment.ring1) targetSlot = EquipmentSlot.Ring1;
        else if (!baseCharacter.equipment.ring2) targetSlot = EquipmentSlot.Ring2;
        else targetSlot = EquipmentSlot.Ring1; // Default to replacing ring1 if both are full
    }

    // 2. Simulate the new equipment state in a temporary object
    const futureEquipment = { ...baseCharacter.equipment };
    
    // Clear conflicting slots *before* equipping the new item
    if (targetSlot === EquipmentSlot.TwoHand) {
        futureEquipment.mainHand = null;
        futureEquipment.offHand = null;
    } else if (targetSlot === EquipmentSlot.MainHand || targetSlot === EquipmentSlot.OffHand) {
        futureEquipment.twoHand = null;
    }
    
    // Equip the new item
    futureEquipment[targetSlot] = itemToEquip;
    
    // 3. Find which items were unequipped by comparing the original and simulated states
    const originalEquippedIds = new Set(Object.values(baseCharacter.equipment).filter((i): i is ItemInstance => !!i).map(i => i.uniqueId));
    const futureEquippedIds = new Set(Object.values(futureEquipment).filter((i): i is ItemInstance => !!i).map(i => i.uniqueId));
    
    const unequippedItems: ItemInstance[] = [];
    originalEquippedIds.forEach(id => {
        if (!futureEquippedIds.has(id)) {
            // Find the full item object from the original equipment to add to the inventory
            const unequippedItem = (Object.values(baseCharacter.equipment) as (ItemInstance | null)[]).find(i => i?.uniqueId === id);
            if (unequippedItem) {
                unequippedItems.push(unequippedItem);
            }
        }
    });

    // 4. Calculate future inventory size
    const netInventoryChange = unequippedItems.length - 1; // -1 for the item leaving inventory to be equipped
    const futureInventorySize = baseCharacter.inventory.length + netInventoryChange;
    const backpackCapacity = getBackpackCapacity(baseCharacter);

    // 5. Perform the final check
    if (futureInventorySize > backpackCapacity) {
      alert(t('equipment.backpackFull'));
      return;
    }
    
    // --- If check passes, apply the changes for real ---
    const newInventory = baseCharacter.inventory
        .filter(i => i.uniqueId !== itemToEquip.uniqueId) // Remove the equipped item
        .concat(unequippedItems); // Add all the unequipped items

    const updatedChar = { ...baseCharacter, equipment: futureEquipment, inventory: newInventory };
    handleCharacterUpdate(updatedChar, true);
  }, [baseCharacter, gameData, handleCharacterUpdate, t, calculateDerivedStats]);

  const handleUnequipItem = useCallback(async (item: ItemInstance, fromSlot: EquipmentSlot) => {
    if (!baseCharacter) return;
    const backpackCapacity = getBackpackCapacity(baseCharacter);
    if (baseCharacter.inventory.length >= backpackCapacity) {
        alert(t('equipment.backpackFull'));
        return;
    }

    let newEquipment = { ...baseCharacter.equipment };
    let newInventory = [...baseCharacter.inventory];

    newEquipment[fromSlot] = null;
    newInventory.push(item);

    const updatedChar = { ...baseCharacter, equipment: newEquipment, inventory: newInventory };
    handleCharacterUpdate(updatedChar, true);
  }, [baseCharacter, handleCharacterUpdate, t]);

  const handleSendTavernMessage = useCallback(async (content: string) => {
    try {
        const newMessage = await api.sendTavernMessage(content);
        setTavernMessages(prev => [...prev, newMessage]);
    } catch (err: any) {
        console.error("Failed to send tavern message:", err.message);
    }
  }, []);

  const handleDisenchantItem = useCallback(async (item: ItemInstance) => {
    if (!baseCharacter) return { success: false };

    try {
        const { updatedCharacter, result } = await api.disenchantItem(item.uniqueId);
        setBaseCharacter(updatedCharacter);
        return result;
    } catch (err: any) {
        alert(err.message);
        return { success: false };
    }
  }, [baseCharacter]);
  
  const handleUpgradeItem = useCallback(async (item: ItemInstance) => {
    if (!baseCharacter) return { success: false, messageKey: 'error.title' };

    try {
        const { updatedCharacter, result } = await api.upgradeItem(item.uniqueId);
        setBaseCharacter(updatedCharacter);
        return result;
    } catch (err: any) {
        alert(err.message);
        return { success: false, messageKey: 'error.title' };
    }
  }, [baseCharacter]);

    const getCampUpgradeCost = (level: number): number => {
        return Math.floor(100 * Math.pow(1.5, level - 1));
    };

    const handleUpgradeCamp = useCallback(async () => {
        if (!baseCharacter) return;
        const cost = getCampUpgradeCost(baseCharacter.camp.level);
        if (baseCharacter.resources.gold < cost) {
            alert(t('camp.notEnoughGold'));
            return;
        }
        const updatedChar = JSON.parse(JSON.stringify(baseCharacter));
        updatedChar.resources.gold -= cost;
        updatedChar.camp.level += 1;
        await handleCharacterUpdate(updatedChar, true);
    }, [baseCharacter, handleCharacterUpdate, t]);

    const handleUpgradeChest = useCallback(async () => {
        if (!baseCharacter) return;
        const level = baseCharacter.chest.level;
        const upgradeCost = getChestUpgradeCost(level);

        const canAfford = baseCharacter.resources.gold >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);
        if (!canAfford) {
            alert(t('camp.notEnoughGold')); // Generic message for simplicity
            return;
        }

        const newChar = JSON.parse(JSON.stringify(baseCharacter));
        newChar.resources.gold -= upgradeCost.gold;
        upgradeCost.essences.forEach(e => {
            newChar.resources[e.type] -= e.amount;
        });
        newChar.chest.level += 1;
        await handleCharacterUpdate(newChar, true);
    }, [baseCharacter, handleCharacterUpdate, t]);

    const handleUpgradeBackpack = useCallback(async () => {
        if (!baseCharacter) return;
        const level = baseCharacter.backpack?.level || 1;
        const upgradeCost = getBackpackUpgradeCost(level);
        const isMaxLevel = level >= 10;

        if (isMaxLevel) return;

        const canAfford = baseCharacter.resources.gold >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

        if (!canAfford) {
            alert(t('camp.notEnoughGold')); // Generic message for simplicity
            return;
        }

        const newChar = JSON.parse(JSON.stringify(baseCharacter));
        newChar.resources.gold -= upgradeCost.gold;
        upgradeCost.essences.forEach(e => {
            newChar.resources[e.type] -= e.amount;
        });
        if (newChar.backpack) {
            newChar.backpack.level += 1;
        } else {
            newChar.backpack = { level: 2 };
        }
        await handleCharacterUpdate(newChar, true);
    }, [baseCharacter, handleCharacterUpdate, t]);

  const handleAcceptQuest = useCallback(async (questId: string) => {
        if (!baseCharacter) return;

        const updatedChar = JSON.parse(JSON.stringify(baseCharacter));

        if (!updatedChar.acceptedQuests.includes(questId)) {
            updatedChar.acceptedQuests.push(questId);
        }

        const progressExists = updatedChar.questProgress.some((p: PlayerQuestProgress) => p.questId === questId);
        if (!progressExists) {
            updatedChar.questProgress.push({ questId, progress: 0, completions: 0 });
        }

        await handleCharacterUpdate(updatedChar, true);
    }, [baseCharacter, handleCharacterUpdate]);

    const handleCompleteQuest = useCallback(async (questId: string) => {
        if (!baseCharacter || !gameData) return;
        
        const quest = gameData.quests.find(q => q.id === questId);
        const progress = baseCharacter.questProgress.find(p => p.questId === questId);
        
        if (!quest || !progress) return;

        const updatedChar = JSON.parse(JSON.stringify(baseCharacter));
        let canComplete = false;
        
        switch (quest.objective.type) {
            case QuestType.Kill:
                canComplete = progress.progress >= quest.objective.amount;
                break;
            case QuestType.Gather:
                const itemsInInventory = updatedChar.inventory.filter((i: ItemInstance) => i.templateId === quest.objective.targetId).length;
                canComplete = itemsInInventory >= quest.objective.amount;
                if (canComplete) {
                    let itemsToRemove = quest.objective.amount;
                    updatedChar.inventory = updatedChar.inventory.filter((i: ItemInstance) => {
                        if (i.templateId === quest.objective.targetId && itemsToRemove > 0) {
                            itemsToRemove--;
                            return false;
                        }
                        return true;
                    });
                }
                break;
            case QuestType.GatherResource:
                const resourceAmount = updatedChar.resources[quest.objective.targetId as EssenceType] || 0;
                canComplete = resourceAmount >= quest.objective.amount;
                if(canComplete) {
                     updatedChar.resources[quest.objective.targetId as EssenceType] -= quest.objective.amount;
                }
                break;
            case QuestType.PayGold:
                canComplete = updatedChar.resources.gold >= quest.objective.amount;
                if (canComplete) {
                    updatedChar.resources.gold -= quest.objective.amount;
                }
                break;
        }

        if (canComplete) {
            // Apply rewards
            updatedChar.resources.gold += quest.rewards.gold;
            updatedChar.experience += quest.rewards.experience;
            
            // Item rewards
            if (quest.rewards.itemRewards) {
                for (const reward of quest.rewards.itemRewards) {
                    for(let i = 0; i < reward.quantity; i++) {
                        const newItem = { uniqueId: crypto.randomUUID(), templateId: reward.templateId };
                        updatedChar.inventory.push(newItem);
                    }
                }
            }
             // Resource rewards
            if (quest.rewards.resourceRewards) {
                for (const reward of quest.rewards.resourceRewards) {
                    updatedChar.resources[reward.resource] = (updatedChar.resources[reward.resource] || 0) + reward.quantity;
                }
            }
            // Loot table rewards
            if (quest.rewards.lootTable) {
                for(const drop of quest.rewards.lootTable) {
                    if (Math.random() * 100 < drop.chance) {
                         const newItem = { uniqueId: crypto.randomUUID(), templateId: drop.templateId };
                         updatedChar.inventory.push(newItem);
                    }
                }
            }


            // Update quest progress
            const progressIndex = updatedChar.questProgress.findIndex((p: PlayerQuestProgress) => p.questId === questId);
            if(progressIndex > -1) {
                updatedChar.questProgress[progressIndex].completions += 1;
                updatedChar.questProgress[progressIndex].progress = 0; // Reset for repeatable
            }

            // Remove from accepted (unless infinitely repeatable and designed to stay)
            updatedChar.acceptedQuests = updatedChar.acceptedQuests.filter((id: string) => id !== questId);

            // Level up check
            while (updatedChar.experience >= updatedChar.experienceToNextLevel) {
                updatedChar.experience -= updatedChar.experienceToNextLevel;
                updatedChar.level += 1;
                updatedChar.stats.statPoints += 1;
                updatedChar.experienceToNextLevel = Math.floor(100 * Math.pow(updatedChar.level, 1.3));
            }
            
            await handleCharacterUpdate(updatedChar, true);
            alert(t('quests.questCompleted'));

        } else {
            if (quest.objective.type === QuestType.Gather) alert(t('quests.notEnoughItems'));
            else if (quest.objective.type === QuestType.PayGold) alert(t('quests.notEnoughGold'));
            else if (quest.objective.type === QuestType.GatherResource) alert(t('quests.notEnoughEssence'));
        }
    }, [baseCharacter, gameData, handleCharacterUpdate, t]);

  // --- Admin Panel Handlers ---
  const fetchAdminData = useCallback(async () => {
      try {
          const [usersData, charactersData] = await Promise.all([
              api.getUsers(),
              api.getAllCharacters(),
          ]);
          setUsers(usersData);
          setAllCharacters(charactersData);
      } catch (err: any) {
          setError(err.message);
      }
  }, []);

  const handleGameDataUpdate = useCallback(async (key: keyof Omit<GameData, 'settings'>, data: any) => {
    try {
      await api.updateGameData(key, data);
      setGameData(prev => prev ? { ...prev, [key]: data } : null);
      alert(`${key} data updated successfully!`);
    } catch(err: any) {
      alert(`Error updating ${key}: ${err.message}`);
    }
  }, []);
  
  const handleSettingsUpdate = useCallback(async (settings: GameSettings) => {
    try {
        await api.updateGameSettings(settings);
        setGameData(prev => prev ? { ...prev, settings: settings } : null);
        alert(`Game settings updated!`);
    } catch(err: any) {
        alert(`Error updating settings: ${err.message}`);
    }
  }, []);

  const handleDeleteUser = useCallback(async (userId: number) => {
    if (window.confirm(t('admin.deleteConfirm'))) {
        try {
            await api.deleteUser(userId);
            await fetchAdminData();
        } catch(err: any) { alert(err.message); }
    }
  }, [fetchAdminData, t]);

  const handleDeleteCharacter = useCallback(async (userId: number) => {
    if (window.confirm(t('admin.deleteCharacterConfirm'))) {
        try {
            await api.deleteCharacter(userId);
            await fetchAdminData();
        } catch(err: any) { alert(err.message); }
    }
  }, [fetchAdminData, t]);

  const handleResetCharacterStats = useCallback(async (userId: number) => {
    if (window.confirm(t('admin.resetStatsConfirm'))) {
        try {
            await api.resetCharacterStats(userId);
            alert(t('admin.resetStatsSuccess'));
        } catch(err: any) { alert(err.message); }
    }
  }, [t]);

  const handleHealCharacter = useCallback(async (userId: number) => {
    if (window.confirm(t('admin.healCharacterConfirm'))) {
        try {
            await api.healCharacter(userId);
            alert(t('admin.healSuccess'));
        } catch(err: any) { alert(err.message); }
    }
  }, [t]);

  const handleUpdateCharacterGold = useCallback(async (userId: number, gold: number) => {
    try {
        await api.updateCharacterGold(userId, gold);
        await fetchAdminData(); // Refresh the data
        alert('Gold updated successfully!');
    } catch(err: any) {
        alert(err.message);
        throw err; // Re-throw to be caught in AdminPanel if needed
    }
  }, [fetchAdminData]);

  const handleForceTraderRefresh = useCallback(async () => {
    if (window.confirm(t('admin.traderRefreshConfirm'))) {
        try {
            const newInventory = await api.getTraderInventory(true);
            setTraderInventory(newInventory);
            alert(t('admin.traderRefreshSuccess'));
        } catch(err: any) { alert(err.message); }
    }
  }, [t]);

  const handleResetAllPvpCooldowns = useCallback(async () => {
    if (window.confirm(t('admin.pvp.resetCooldownsConfirm'))) {
        try {
            await api.resetAllPvpCooldowns();
            alert(t('admin.pvp.resetCooldownsSuccess'));
        } catch(err: any) { alert(err.message); }
    }
  }, [t]);

  const handleSendGlobalMessage = useCallback(async (data: { subject: string, content: string }) => {
    try {
      await api.sendGlobalMessage(data);
    } catch(err: any) {
      alert(`Error: ${err.message}`);
      throw err;
    }
  }, []);

  // Fetch data for active tab
  useEffect(() => {
    if (activeTab === Tab.Ranking) {
        fetchRanking();
    }
    if (activeTab === Tab.Trader) {
        fetchTraderInventory();
    }
    if (activeTab === Tab.Admin) {
        fetchAdminData();
    }
  }, [activeTab, fetchRanking, fetchTraderInventory, fetchAdminData]);
  
  // Calculate derived stats
  useEffect(() => {
    if (baseCharacter) {
      const derived = calculateDerivedStats(baseCharacter, gameData);
      setPlayerCharacter(derived);
    }
  }, [baseCharacter, gameData, calculateDerivedStats]);
  
  // Game loop for passive actions
  useEffect(() => {
    const interval = setInterval(async () => {
      if (baseCharacter?.activeExpedition && Date.now() >= baseCharacter.activeExpedition.finishTime) {
          handleCheckExpeditionCompletion();
          return;
      }

      if (baseCharacter) {
        let char = { ...baseCharacter };
        let updated = false;

        // Resting
        if (char.isResting && char.lastRestTime) {
          const now = Date.now();
          const restDuration = now - char.lastRestTime;
          const healthToRegen = (char.camp.level / 100) * (restDuration / (60 * 1000)); 
          if (healthToRegen > 0) {
              const derivedStats = calculateDerivedStats(char, gameData);
              const newHealth = Math.min(derivedStats.stats.maxHealth, char.stats.currentHealth + healthToRegen);
              if (newHealth > char.stats.currentHealth) {
                  char.stats.currentHealth = newHealth;
                  char.lastRestTime = now;
                  updated = true;
              }
          }
        }

        // Travel
        if (char.activeTravel && Date.now() >= char.activeTravel.finishTime) {
          char.currentLocationId = char.activeTravel.destinationLocationId;
          char.activeTravel = null;
          updated = true;
        }
        
        // Energy regeneration
        const now = Date.now();
        const timeSinceLastUpdate = now - char.lastEnergyUpdateTime;
        const hoursPassed = Math.floor(timeSinceLastUpdate / (1000 * 60 * 60));

        if (hoursPassed > 0) {
            const derivedStats = calculateDerivedStats(char, gameData);
            if (char.stats.currentEnergy < derivedStats.stats.maxEnergy) {
                const newEnergy = Math.min(derivedStats.stats.maxEnergy, char.stats.currentEnergy + hoursPassed);
                if (newEnergy > char.stats.currentEnergy) {
                    char.stats.currentEnergy = newEnergy;
                    char.lastEnergyUpdateTime += hoursPassed * (1000 * 60 * 60);
                    updated = true;
                }
            }
        }


        if (updated) {
          handleCharacterUpdate(char);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [baseCharacter, gameData, calculateDerivedStats, handleCharacterUpdate, handleCheckExpeditionCompletion]);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (token) {
          const [gameDataRes, charData] = await Promise.all([
            api.getGameData(),
            api.getCharacter(),
          ]);
          setGameData(gameDataRes);
          if (charData) {
            if (charData.expeditionSummary) {
                setExpeditionReport(charData.expeditionSummary);
                delete charData.expeditionSummary;
            }
            setBaseCharacter(charData);
            const initialMessages = await api.getMessages();
            setMessages(initialMessages);
          } else {
            setBaseCharacter(null); // No character exists for this user
          }
        } else {
            const gameDataRes = await api.getGameData();
            setGameData(gameDataRes);
        }
      } catch (err: any) {
        if (err.message === 'Invalid token') {
            handleLogout();
        } else {
            setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [token, handleLogout]);

    useEffect(() => {
        const loadCharacterNames = async () => {
            if(playerCharacter) {
                const names = await api.getCharacterNames();
                setAllCharacterNames(names.filter(name => name !== playerCharacter.name));
            }
        };
        loadCharacterNames();
    }, [playerCharacter]);
    
  // Tavern message polling
  useEffect(() => {
    const fetchTavernMessages = async () => {
      if (token) {
        try {
          const latestMessages = await api.getTavernMessages();
          setTavernMessages(latestMessages);

          if (latestMessages.length > 0) {
            const latestId = latestMessages[latestMessages.length - 1].id;
            if (activeTabRef.current !== Tab.Tavern && lastReadTavernMessageIdRef.current !== null && latestId > lastReadTavernMessageIdRef.current) {
                setHasNewTavernMessages(true);
            }
            if (activeTabRef.current === Tab.Tavern) {
                lastReadTavernMessageIdRef.current = latestId;
                setHasNewTavernMessages(false);
            } else if (lastReadTavernMessageIdRef.current === null) {
                lastReadTavernMessageIdRef.current = latestId;
            }
          }

        } catch (err) {
          console.error("Failed to fetch tavern messages:", err);
        }
      }
    };

    fetchTavernMessages(); 
    tavernIntervalRef.current = window.setInterval(fetchTavernMessages, 5000); 

    return () => {
      if (tavernIntervalRef.current) {
        clearInterval(tavernIntervalRef.current);
      }
    };
  }, [token]);

  // Inactivity and Heartbeat timers
  useEffect(() => {
      if (token) {
          const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
          events.forEach(event => window.addEventListener(event, resetInactivityTimer));
          
          const heartbeatInterval = setInterval(() => api.sendHeartbeat(), 60 * 1000); // Send heartbeat every minute

          resetInactivityTimer();
          
          return () => {
              events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
              if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
              clearInterval(heartbeatInterval);
          };
      }
  }, [token, resetInactivityTimer]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-white">{t('loading')}</div>;
  }
  
  if (error) {
      return (
          <div className="min-h-screen flex items-center justify-center text-white text-center p-4">
            <div>
              <h2 className="text-2xl font-bold text-red-500 mb-4">{t('error.title')}</h2>
              <p className="mb-4">{error}</p>
              <p className="mb-6">{t('error.refresh')}</p>
              <button onClick={handleLogout} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700">{t('error.logout')}</button>
            </div>
          </div>
      );
  }

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} settings={gameData?.settings} />;
  }
  
  if (!baseCharacter || !playerCharacter) {
    if (!gameData) return <div>{t('loading')}</div>;
    const startLocation = gameData.locations.find(l => l.isStartLocation);
    if (!startLocation) return <div className="text-red-500">CRITICAL ERROR: No start location defined!</div>;
    
    return <CharacterCreation onCharacterCreate={async (char) => {
        try {
            const newChar = await api.createCharacter(char.name, char.race, startLocation.id);
            setBaseCharacter(newChar);
        } catch(err: any) {
            alert(err.message);
            throw err;
        }
    }} />;
  }

  const getChestUpgradeCost = (level: number): { gold: number; essences: { type: EssenceType; amount: number }[] } => {
        return {
            gold: Math.floor(500 * Math.pow(1.8, level - 1)),
            essences: [
                { type: EssenceType.Common, amount: level * 5 },
                { type: EssenceType.Uncommon, amount: level > 2 ? Math.floor(Math.pow(level - 2, 1.5)) * 3 : 0 },
            ].filter(e => e.amount > 0)
        };
    };

    const getBackpackUpgradeCost = (level: number): { gold: number; essences: { type: EssenceType; amount: number }[] } => {
        return {
            gold: Math.floor(250 * Math.pow(2, level - 1)),
            essences: [
                { type: EssenceType.Common, amount: level * 10 },
                { type: EssenceType.Uncommon, amount: level > 1 ? Math.floor(Math.pow(level - 1, 1.6)) * 4 : 0 },
            ].filter(e => e.amount > 0)
        };
    };
  
  const mainContent = () => {
    if (!gameData) return <div>{t('loading')}</div>;

    switch(activeTab) {
      case Tab.Statistics: return <Statistics character={playerCharacter} baseCharacter={baseCharacter} onCharacterUpdate={handleCharacterUpdate} calculateDerivedStats={calculateDerivedStats} gameData={gameData} onResetAttributes={handleResetAttributes} onSelectClass={handleSelectClass}/>;
      case Tab.Equipment: return <Equipment character={playerCharacter} baseCharacter={baseCharacter} gameData={gameData} onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem} />;
      case Tab.Expedition: return <ExpeditionComponent character={playerCharacter} expeditions={gameData.expeditions} enemies={gameData.enemies} currentLocation={currentLocation!} onStartExpedition={handleStartExpedition} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} />;
      case Tab.Camp: return <Camp character={playerCharacter} baseCharacter={baseCharacter} onToggleResting={handleToggleResting} onUpgradeCamp={handleUpgradeCamp} getCampUpgradeCost={getCampUpgradeCost} onCharacterUpdate={handleCharacterUpdate} onHealToFull={handleHealToFull} onUpgradeChest={handleUpgradeChest} onUpgradeBackpack={handleUpgradeBackpack} getChestUpgradeCost={getChestUpgradeCost} getBackpackUpgradeCost={getBackpackUpgradeCost} />;
      case Tab.Location: return <LocationComponent playerCharacter={playerCharacter} onCharacterUpdate={handleCharacterUpdate} locations={gameData.locations} />;
      case Tab.Resources: return <Resources character={playerCharacter} />;
      case Tab.Ranking: return <Ranking ranking={ranking} currentPlayer={playerCharacter} onRefresh={fetchRanking} isLoading={isRankingLoading} onAttack={handlePvpAttack} onComposeMessage={handleComposeMessage} />;
      case Tab.Trader: return <Trader character={playerCharacter} baseCharacter={baseCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} settings={gameData.settings} traderInventory={traderInventory} onBuyItem={handleBuyItem} onSellItems={handleSellItems} />;
      case Tab.Blacksmith: return <Blacksmith character={playerCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onDisenchantItem={handleDisenchantItem} onUpgradeItem={handleUpgradeItem} />;
      case Tab.Messages: return <Messages messages={messages} onDeleteMessage={handleDeleteMessage} onMarkAsRead={handleMarkAsRead} onCompose={handleComposeMessage} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} currentPlayer={playerCharacter} onClaimReturn={handleClaimMessageItem} onDeleteBulk={handleBulkDeleteMessages} />;
      case Tab.Quests: return <Quests character={playerCharacter} quests={gameData.quests} enemies={gameData.enemies} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onAcceptQuest={handleAcceptQuest} onCompleteQuest={handleCompleteQuest}/>;
      case Tab.Tavern: return <Tavern character={playerCharacter} messages={tavernMessages} onSendMessage={handleSendTavernMessage} />;
      case Tab.Market: return <Market character={playerCharacter} gameData={gameData} onCharacterUpdate={handleCharacterUpdate} />;
      case Tab.Options: return <Options character={playerCharacter} onCharacterUpdate={handleCharacterUpdate} />;
      case Tab.Admin: return <AdminPanel gameData={gameData} onGameDataUpdate={handleGameDataUpdate} onSettingsUpdate={handleSettingsUpdate} users={users} onDeleteUser={handleDeleteUser} allCharacters={allCharacters} onDeleteCharacter={handleDeleteCharacter} onResetCharacterStats={handleResetCharacterStats} onHealCharacter={handleHealCharacter} onUpdateCharacterGold={handleUpdateCharacterGold} onForceTraderRefresh={handleForceTraderRefresh} onResetAllPvpCooldowns={handleResetAllPvpCooldowns} onSendGlobalMessage={handleSendGlobalMessage} />;
      default: return null;
    }
  };

  return (
    <LanguageContext.Provider value={{ lang: currentLanguage, t }}>
      <div 
        className="min-h-screen flex" 
        style={{ backgroundImage: gameData?.settings.gameBackground ? `url(${gameData.settings.gameBackground})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
      >
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          playerCharacter={playerCharacter} 
          currentLocation={currentLocation}
          onLogout={handleLogout}
          hasUnreadMessages={hasUnreadMessages}
          hasNewTavernMessages={hasNewTavernMessages}
          onOpenNews={handleOpenNews}
          hasNewNews={hasNewNews}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          {mainContent()}
        </main>
      </div>
      {expeditionReport && (
          <ExpeditionSummaryModal 
            reward={expeditionReport} 
            onClose={() => setExpeditionReport(null)} 
            characterName={playerCharacter.name}
            itemTemplates={gameData?.itemTemplates || []}
            affixes={gameData?.affixes || []}
          />
      )}
      {pvpReport && (
          <ExpeditionSummaryModal 
            reward={{
                combatLog: pvpReport.combatLog,
                isVictory: pvpReport.isVictory,
                totalGold: pvpReport.gold,
                totalExperience: pvpReport.experience,
                rewardBreakdown: [],
                itemsFound: [],
                essencesFound: {}
            }} 
            onClose={() => setPvpReport(null)} 
            characterName={pvpReport.attacker.name}
            itemTemplates={gameData?.itemTemplates || []}
            affixes={gameData?.affixes || []}
            isPvp={true}
            pvpData={{
                attacker: pvpReport.attacker,
                defender: pvpReport.defender,
            }}
          />
      )}
       {isComposingMessage && (
        <ComposeMessageModal 
            onClose={() => setIsComposingMessage(false)} 
            onSendMessage={handleSendMessage}
            allCharacterNames={allCharacterNames}
            initialRecipient={composeInitialData?.recipient}
            initialSubject={composeInitialData?.subject}
        />
      )}
      {/* FIX: Add NewsModal to the main render tree. */}
      <NewsModal 
        isOpen={isNewsModalOpen}
        onClose={handleCloseNews}
        content={gameData?.settings.newsContent || ''}
      />
    </LanguageContext.Provider>
  );
};

export default App;