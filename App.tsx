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
import { Tab, PlayerCharacter, Location, Expedition, Enemy, ExpeditionRewardSummary, CombatLogEntry, Race, RankingPlayer, Language, GameSettings, User, AdminCharacterInfo, RewardSource, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, ItemRarity, EssenceType, MagicAttackType, Message, PvpRewardSummary, Quest, QuestType, PlayerQuestProgress, LootDrop, TavernMessage, GameData, Affix, RolledAffixStats, GrammaticalGender } from './types';
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
  const [expeditionReport, setExpeditionReport] = useState<ExpeditionRewardSummary | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
  
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

  // i18n
  const t = useMemo(() => getT(Language.PL), []);
  const currentLanguage = Language.PL;

  // Derived State
  const currentLocation = useMemo(() => gameData?.locations.find(loc => loc.id === playerCharacter?.currentLocationId), [gameData, playerCharacter]);
  const hasUnreadMessages = useMemo(() => messages.some(m => !m.is_read), [messages]);
  const lastReadTavernMessageIdRef = useRef<number | null>(null);

  // Derived Stat Calculation for UI Previews
  const calculateDerivedStats = useCallback((character: PlayerCharacter, gameDataForCalc: GameData | null): PlayerCharacter => {
      if (!gameDataForCalc) return character;

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

      const applyItemBonuses = (source: ItemTemplate, upgradeFactor: number) => {
          for (const stat in source.statsBonus) {
              const key = stat as keyof typeof source.statsBonus;
              const baseBonus = source.statsBonus[key] || 0;
              totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeFactor);
          }
          const baseDamageMin = source.damageMin || 0, baseDamageMax = source.damageMax || 0;
          const baseMagicDamageMin = source.magicDamageMin || 0, baseMagicDamageMax = source.magicDamageMax || 0;
          const baseArmor = source.armorBonus || 0, baseCritChance = source.critChanceBonus || 0, baseMaxHealth = source.maxHealthBonus || 0;
          
          bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeFactor);
          bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeFactor);
          bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeFactor);
          bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeFactor);
          bonusArmor += baseArmor + Math.round(baseArmor * upgradeFactor);
          bonusCritChance += baseCritChance + (baseCritChance * upgradeFactor);
          bonusMaxHealth += baseMaxHealth + Math.round(baseMaxHealth * upgradeFactor);

          bonusCritDamageModifier += source.critDamageModifierBonus || 0;
          bonusArmorPenetrationPercent += source.armorPenetrationPercent || 0;
          bonusArmorPenetrationFlat += source.armorPenetrationFlat || 0;
          bonusLifeStealPercent += source.lifeStealPercent || 0;
          bonusLifeStealFlat += source.lifeStealFlat || 0;
          bonusManaStealPercent += source.manaStealPercent || 0;
          bonusManaStealFlat += source.manaStealFlat || 0;
      };

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
              const template = gameDataForCalc.itemTemplates.find(t => t.id === itemInstance.templateId);
              if (template) {
                  const upgradeLevel = itemInstance.upgradeLevel || 0;
                  const upgradeBonusFactor = upgradeLevel * 0.1;
                  applyItemBonuses(template, upgradeBonusFactor);
              }
              if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
              if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
          }
      }

      const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
      const mainHandTemplate = mainHandItem ? gameDataForCalc.itemTemplates.find(t => t.id === mainHandItem.templateId) : null;

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

  const handleEquipItem = useCallback(async (item: ItemInstance) => {
    if (!baseCharacter || !gameData) return;

    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) return;

    // Create a temporary character with current base stats to check requirements
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

    let newEquipment = { ...baseCharacter.equipment };
    let newInventory = [...baseCharacter.inventory];

    const itemIndex = newInventory.findIndex(i => i.uniqueId === item.uniqueId);
    if (itemIndex === -1) {
        console.error("Item to equip not found in inventory.");
        return;
    }
    newInventory.splice(itemIndex, 1);

    let slotToEquipIn = template.slot as EquipmentSlot;
    if (template.slot === 'ring') {
        if (!newEquipment.ring1) slotToEquipIn = EquipmentSlot.Ring1;
        else if (!newEquipment.ring2) slotToEquipIn = EquipmentSlot.Ring2;
        else {
            alert(t('equipment.ringSlotsFull'));
            return; 
        }
    }

    if (template.slot === EquipmentSlot.TwoHand && newEquipment.offHand) {
        alert(t('equipment.twoHandedWeaponEquipped'));
        return;
    }

    const currentlyEquipped = newEquipment[slotToEquipIn];
    if (currentlyEquipped) {
        newInventory.push(currentlyEquipped);
    }
    newEquipment[slotToEquipIn] = item;

    if (slotToEquipIn === EquipmentSlot.TwoHand) {
        if (newEquipment.mainHand) {
            newInventory.push(newEquipment.mainHand);
            newEquipment.mainHand = null;
        }
        if (newEquipment.offHand) {
            newInventory.push(newEquipment.offHand);
            newEquipment.offHand = null;
        }
    } else if (slotToEquipIn === EquipmentSlot.MainHand || slotToEquipIn === EquipmentSlot.OffHand) {
        if (newEquipment.twoHand) {
            newInventory.push(newEquipment.twoHand);
            newEquipment.twoHand = null;
        }
    }

    if (newInventory.length > MAX_PLAYER_INVENTORY_SIZE) {
        alert(t('equipment.backpackFull'));
        return;
    }

    const updatedChar = { ...baseCharacter, equipment: newEquipment, inventory: newInventory };
    handleCharacterUpdate(updatedChar, true);
  }, [baseCharacter, gameData, handleCharacterUpdate, t]);

  const handleUnequipItem = useCallback(async (item: ItemInstance, fromSlot: EquipmentSlot) => {
    if (!baseCharacter) return;
    if (baseCharacter.inventory.length >= MAX_PLAYER_INVENTORY_SIZE) {
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

  const handleDisenchantItem = useCallback((item: ItemInstance): { success: boolean; amount?: number; essenceType?: EssenceType } => {
    if (!baseCharacter || !gameData) return { success: false };

    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) return { success: false };

    const cost = Math.round(template.value * 0.1);
    if (baseCharacter.resources.gold < cost) {
        alert(t('blacksmith.notEnoughGold'));
        return { success: false };
    }

    let amount = 0;
    let essenceType: EssenceType | null = null;

    switch (template.rarity) {
        case ItemRarity.Common:
            amount = Math.floor(Math.random() * 4) + 1;
            essenceType = EssenceType.Common;
            break;
        case ItemRarity.Uncommon:
            amount = Math.floor(Math.random() * 2) + 1;
            essenceType = EssenceType.Uncommon;
            break;
        case ItemRarity.Rare:
            amount = Math.floor(Math.random() * 2) + 1;
            essenceType = EssenceType.Rare;
            break;
        case ItemRarity.Epic:
            amount = 1;
            essenceType = EssenceType.Epic;
            break;
        case ItemRarity.Legendary:
            if (Math.random() < 0.5) {
                amount = 1;
                essenceType = EssenceType.Legendary;
            }
            break;
    }
    
    const updatedChar: PlayerCharacter = JSON.parse(JSON.stringify(baseCharacter));

    updatedChar.resources.gold -= cost;
    updatedChar.inventory = updatedChar.inventory.filter(i => i.uniqueId !== item.uniqueId);

    if (amount > 0 && essenceType) {
        updatedChar.resources[essenceType] = (updatedChar.resources[essenceType] || 0) + amount;
        handleCharacterUpdate(updatedChar, true);
        return { success: true, amount, essenceType };
    } else {
        handleCharacterUpdate(updatedChar, true);
        return { success: false };
    }
  }, [baseCharacter, gameData, handleCharacterUpdate, t]);

  const handleUpgradeItem = useCallback((item: ItemInstance): { success: boolean; messageKey: string; level?: number } => {
    if (!baseCharacter || !gameData) return { success: false, messageKey: 'error.title' };

    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) return { success: false, messageKey: 'error.title' };

    const currentLevel = item.upgradeLevel || 0;
    const nextLevel = currentLevel + 1;

    if (nextLevel > 10) {
        return { success: false, messageKey: 'blacksmith.upgrade.maxLevel' };
    }

    const rarityMultiplier = {
        [ItemRarity.Common]: 1,
        [ItemRarity.Uncommon]: 1.5,
        [ItemRarity.Rare]: 2.5,
        [ItemRarity.Epic]: 4,
        [ItemRarity.Legendary]: 8,
    };
    const goldCost = Math.floor(template.value * 0.5 * nextLevel * rarityMultiplier[template.rarity]);
    
    let essenceType: EssenceType | null = null;
    switch (template.rarity) {
        case ItemRarity.Common: essenceType = EssenceType.Common; break;
        case ItemRarity.Uncommon: essenceType = EssenceType.Uncommon; break;
        case ItemRarity.Rare: essenceType = EssenceType.Rare; break;
        case ItemRarity.Epic: essenceType = EssenceType.Epic; break;
        case ItemRarity.Legendary: essenceType = EssenceType.Legendary; break;
    }

    if (!essenceType) {
        return { success: false, messageKey: 'blacksmith.upgrade.cannotUpgrade' };
    }
    
    const essenceCost = 1;

    if (baseCharacter.resources.gold < goldCost) {
        alert(t('blacksmith.notEnoughGold'));
        return { success: false, messageKey: 'blacksmith.notEnoughGold' };
    }
    if ((baseCharacter.resources[essenceType] || 0) < essenceCost) {
        alert(t('blacksmith.notEnoughEssence'));
        return { success: false, messageKey: 'blacksmith.notEnoughEssence' };
    }

    const successChance = Math.max(10, 100 - (currentLevel * 10));
    const roll = Math.random() * 100;
    const isSuccess = roll < successChance;
    
    const updatedChar: PlayerCharacter = JSON.parse(JSON.stringify(baseCharacter));
    
    updatedChar.resources.gold -= goldCost;
    updatedChar.resources[essenceType] -= essenceCost;

    const findAndModifyItem = (items: ItemInstance[]) => {
        const index = items.findIndex(i => i?.uniqueId === item.uniqueId);
        if (index === -1) return false;
        
        if (isSuccess) {
            items[index].upgradeLevel = nextLevel;
        } else {
            items.splice(index, 1);
        }
        return true;
    };
    
    const findAndModifyEquippedItem = (equipment: Record<EquipmentSlot, ItemInstance | null>) => {
        for (const slot in equipment) {
            if (equipment[slot as EquipmentSlot]?.uniqueId === item.uniqueId) {
                if (isSuccess) {
                    (equipment[slot as EquipmentSlot] as ItemInstance).upgradeLevel = nextLevel;
                } else {
                    equipment[slot as EquipmentSlot] = null;
                }
                return true;
            }
        }
        return false;
    };

    if (!findAndModifyItem(updatedChar.inventory)) {
        findAndModifyEquippedItem(updatedChar.equipment);
    }
    
    handleCharacterUpdate(updatedChar, true);

    if (isSuccess) {
        return { success: true, messageKey: 'blacksmith.upgrade.upgradeSuccess', level: nextLevel };
    } else {
        return { success: false, messageKey: 'blacksmith.upgrade.upgradeFailure' };
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
      if (baseCharacter) {
        let char = { ...baseCharacter };
        let updated = false;

        // Resting
        if (char.isResting && char.stats.currentHealth < (playerCharacter?.stats.maxHealth || 0)) {
          const now = Date.now();
          const lastRest = char.lastRestTime || now;
          const secondsPassed = (now - lastRest) / 1000;
          if (secondsPassed >= 5) {
            const maxHealth = playerCharacter?.stats.maxHealth || char.stats.maxHealth;
            const regenPerMinute = maxHealth * (char.camp.level / 100);
            const regenPerInterval = regenPerMinute / 12; // 12 intervals of 5s in a minute
            char.stats.currentHealth = Math.min(maxHealth, char.stats.currentHealth + regenPerInterval);
            char.lastRestTime = now;
            updated = true;
          }
        }

        // Travel
        if (char.activeTravel && Date.now() >= char.activeTravel.finishTime) {
          char.currentLocationId = char.activeTravel.destinationLocationId;
          char.activeTravel = null;
          updated = true;
        }

        if (updated) {
          await handleCharacterUpdate(char, true);
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [baseCharacter, playerCharacter, handleCharacterUpdate]);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
        try {
            if (token) {
                const [charData, gData, messagesData, charNamesData] = await Promise.all([
                    api.getCharacter(),
                    api.getGameData(),
                    api.getMessages(),
                    api.getCharacterNames(),
                ]);
                
                setGameData(gData);
                setMessages(messagesData);
                setAllCharacterNames(charNamesData);
                
                if (charData.expeditionSummary) {
                    setExpeditionReport(charData.expeditionSummary);
                    delete charData.expeditionSummary;
                }
                setBaseCharacter(charData);
            }
        } catch (err: any) {
            if (err.message === 'Invalid token') {
                localStorage.removeItem('token');
                setToken(null);
            } else {
                setError(err.message);
            }
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
}, [token]);

  // Expedition finish timeout
  useEffect(() => {
    if (baseCharacter?.activeExpedition) {
      const finishTime = baseCharacter.activeExpedition.finishTime;
      const timeToFinish = finishTime - Date.now();
      if (timeToFinish > 0) {
        const timer = setTimeout(async () => {
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
          }
        }, timeToFinish);
        return () => clearTimeout(timer);
      }
    }
  }, [baseCharacter?.activeExpedition]);

  // Tavern Polling
  useEffect(() => {
    const fetchTavernMessages = async () => {
        try {
            const allMessages = await api.getTavernMessages();
            if (activeTabRef.current === Tab.Tavern) {
                setTavernMessages(allMessages);
                if (allMessages.length > 0) {
                    lastReadTavernMessageIdRef.current = allMessages[allMessages.length - 1].id;
                }
                setHasNewTavernMessages(false);
            } else {
                const lastMessageId = allMessages.length > 0 ? allMessages[allMessages.length - 1].id : null;
                if (lastReadTavernMessageIdRef.current !== null && lastMessageId !== null && lastMessageId > lastReadTavernMessageIdRef.current) {
                    setHasNewTavernMessages(true);
                }
            }
        } catch(e) { console.error("Failed to fetch tavern messages", e)}
    };

    api.getTavernMessages().then(initialMessages => {
        setTavernMessages(initialMessages);
        if (initialMessages.length > 0) {
            lastReadTavernMessageIdRef.current = initialMessages[initialMessages.length - 1].id;
        }
    });

    tavernIntervalRef.current = window.setInterval(fetchTavernMessages, 5000); // Poll every 5 seconds

    return () => {
        if (tavernIntervalRef.current) {
            clearInterval(tavernIntervalRef.current);
        }
    };
  }, []);


  const handleLogout = () => {
    if (token) {
      api.logout(token).catch(err => console.error("Logout failed:", err));
    }
    localStorage.removeItem('token');
    setToken(null);
    setPlayerCharacter(null);
    setBaseCharacter(null);
  };

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsLoading(true);
  };
  
  const handleCharacterCreate = async (data: { name: string; race: Race }) => {
    if (!gameData) return;
    const startLocation = gameData.locations.find(l => l.isStartLocation);
    if (!startLocation) {
      alert("Error: No starting location defined in game data.");
      return;
    }
    try {
      const newChar = await api.createCharacter(data.name, data.race, startLocation.id);
      setBaseCharacter(newChar);
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }
  
  if (error) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center text-red-400">
            <h1 className="text-2xl font-bold mb-4">{t('error.title')}</h1>
            <p className="mb-4">{error}</p>
            <p className="mb-6 text-gray-400">{t('error.refresh')}</p>
            <button onClick={handleLogout} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{t('error.logout')}</button>
        </div>
    );
  }

  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  if (!gameData) {
    return <div className="min-h-screen flex items-center justify-center">Error: Game data could not be loaded.</div>;
  }

  if (!baseCharacter) {
     const startLocationExists = gameData && gameData.locations.some(l => l.isStartLocation);
      if (!startLocationExists) {
        return <div className="min-h-screen flex items-center justify-center">Admin: Please set a starting location.</div>;
      }
    return <CharacterCreation onCharacterCreate={handleCharacterCreate} />;
  }
  
  if (!playerCharacter) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }
  
  const mainContent = () => {
    switch (activeTab) {
        case Tab.Statistics: return <Statistics character={playerCharacter} baseCharacter={baseCharacter} onCharacterUpdate={handleCharacterUpdate} calculateDerivedStats={calculateDerivedStats} gameData={gameData} onResetAttributes={handleResetAttributes} />;
        case Tab.Equipment: return <Equipment character={playerCharacter} baseCharacter={baseCharacter} gameData={gameData} onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem} />;
        case Tab.Expedition: return <ExpeditionComponent character={playerCharacter} expeditions={gameData.expeditions} enemies={gameData.enemies} currentLocation={currentLocation!} onStartExpedition={handleStartExpedition} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes || []} />;
        case Tab.Camp: return <Camp character={playerCharacter} baseCharacter={baseCharacter} onToggleResting={handleToggleResting} onUpgradeCamp={()=>{}} getUpgradeCost={() => 0} onCharacterUpdate={handleCharacterUpdate} onHealToFull={handleHealToFull} />;
        case Tab.Location: return <LocationComponent playerCharacter={playerCharacter} onCharacterUpdate={handleCharacterUpdate} locations={gameData.locations} />;
        case Tab.Resources: return <Resources character={playerCharacter} />;
        case Tab.Ranking: return <Ranking ranking={ranking} currentPlayer={playerCharacter} onRefresh={fetchRanking} isLoading={isRankingLoading} onAttack={()=>{}} onComposeMessage={()=>{}} />;
        case Tab.Trader: return <Trader character={playerCharacter} baseCharacter={baseCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes || []} settings={gameData.settings} traderInventory={traderInventory} onBuyItem={handleBuyItem} onSellItems={handleSellItems} />;
        case Tab.Blacksmith: return <Blacksmith character={playerCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes || []} onDisenchantItem={handleDisenchantItem} onUpgradeItem={handleUpgradeItem} />;
        case Tab.Messages: return <Messages messages={messages} onDeleteMessage={handleDeleteMessage} onMarkAsRead={handleMarkAsRead} onCompose={handleComposeMessage} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes || []} currentPlayer={playerCharacter} />;
        case Tab.Quests: return <Quests character={playerCharacter} quests={gameData.quests || []} enemies={gameData.enemies} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes || []} onAcceptQuest={()=>{}} onCompleteQuest={()=>{}} />;
        case Tab.Tavern: return <Tavern character={playerCharacter} messages={tavernMessages} onSendMessage={handleSendTavernMessage}/>;
        case Tab.Admin: return <AdminPanel gameData={gameData} onGameDataUpdate={handleGameDataUpdate} onSettingsUpdate={handleSettingsUpdate} users={users} onDeleteUser={handleDeleteUser} allCharacters={allCharacters} onDeleteCharacter={handleDeleteCharacter} onResetCharacterStats={handleResetCharacterStats} onHealCharacter={handleHealCharacter} onForceTraderRefresh={handleForceTraderRefresh} onResetAllPvpCooldowns={handleResetAllPvpCooldowns} onSendGlobalMessage={handleSendGlobalMessage} />;
        default: return <Statistics character={playerCharacter} baseCharacter={baseCharacter} onCharacterUpdate={handleCharacterUpdate} calculateDerivedStats={calculateDerivedStats} gameData={gameData} onResetAttributes={handleResetAttributes} />;
    }
  }

  return (
    <LanguageContext.Provider value={{ lang: currentLanguage, t }}>
        <div className="flex h-screen bg-slate-900 text-gray-200">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                playerCharacter={playerCharacter}
                currentLocation={currentLocation}
                onLogout={handleLogout}
                hasUnreadMessages={hasUnreadMessages}
                hasNewTavernMessages={hasNewTavernMessages}
            />
            <main className="flex-1 overflow-y-auto p-8">
                {mainContent()}
            </main>
        </div>
        {expeditionReport && (
            <ExpeditionSummaryModal 
                reward={expeditionReport}
                onClose={() => setExpeditionReport(null)}
                characterName={playerCharacter.name}
                itemTemplates={gameData.itemTemplates}
                affixes={gameData.affixes || []}
            />
        )}
        {isComposingMessage && (
            <ComposeMessageModal 
                allCharacterNames={allCharacterNames}
                onClose={() => setIsComposingMessage(false)}
                onSendMessage={handleSendMessage}
                initialRecipient={composeInitialData?.recipient}
                initialSubject={composeInitialData?.subject}
            />
        )}
    </LanguageContext.Provider>
  );
};

export default App;