import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Tab, PlayerCharacter, Location, Expedition, Enemy, ExpeditionRewardSummary, CombatLogEntry, Race, RankingPlayer, Language, GameSettings, User, AdminCharacterInfo, RewardSource, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, ItemRarity, EssenceType, MagicAttackType, Message, PvpRewardSummary, Quest, QuestType, PlayerQuestProgress, LootDrop, TavernMessage, GameData, Affix, RolledAffixStats, GrammaticalGender, CharacterClass, AffixType, TraderInventoryData } from './types';
import { api } from './api';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';

const getBackpackCapacity = (character: PlayerCharacter) => 40 + ((character.backpack?.level || 1) - 1) * 10;

const getChestUpgradeCost = (level: number): { gold: number; essences: { type: EssenceType; amount: number }[] } => {
    const gold = Math.floor(250 * Math.pow(1.8, level - 1));
    const essences = [];
    if (level >= 3) essences.push({ type: EssenceType.Uncommon, amount: Math.ceil(level / 2) });
    if (level >= 6) essences.push({ type: EssenceType.Rare, amount: Math.ceil(level / 3) });
    return { gold, essences };
};

const getBackpackUpgradeCost = (level: number): { gold: number; essences: { type: EssenceType; amount: number }[] } => {
    const gold = Math.floor(300 * Math.pow(1.7, level - 1));
    const essences = [];
    if (level >= 2) essences.push({ type: EssenceType.Common, amount: level * 5 });
    if (level >= 5) essences.push({ type: EssenceType.Uncommon, amount: level });
    return { gold, essences };
};

export const rollAffixStats = (affix: Affix): RolledAffixStats => {
    const rolled: RolledAffixStats = {};

    const rollValue = (minMax: { min: number; max: number } | undefined): number | undefined => {
        if (minMax === undefined || minMax === null) return undefined;
        const min = Math.min(minMax.min, minMax.max);
        const max = Math.max(minMax.min, minMax.max);
        if (min === max) return min;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    if (affix.statsBonus) {
        rolled.statsBonus = {};
        for (const key in affix.statsBonus) {
            const statKey = key as keyof typeof affix.statsBonus;
            const rolledStat = rollValue(affix.statsBonus[statKey]);
            if (rolledStat !== undefined) {
                (rolled.statsBonus as any)[statKey] = rolledStat;
            }
        }
        if(Object.keys(rolled.statsBonus).length === 0) {
            delete rolled.statsBonus;
        }
    }
    
    const otherStatKeys: (keyof Omit<Affix, 'id'|'name'|'type'|'requiredLevel'|'requiredStats'|'spawnChances'|'statsBonus'|'value'>)[] = [
        'damageMin', 'damageMax', 'attacksPerRoundBonus', 'dodgeChanceBonus', 'armorBonus',
        'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent',
        'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent',
        'manaStealFlat', 'magicDamageMin', 'magicDamageMax'
    ];
    
    for (const key of otherStatKeys) {
        const value = rollValue((affix as any)[key]);
        if (value !== undefined) {
            (rolled as any)[key] = value;
        }
    }

    return rolled;
};

export const rollTemplateStats = (template: ItemTemplate): RolledAffixStats => {
    const rolled: RolledAffixStats = {};

    const rollValue = (minMax: { min: number; max: number } | undefined): number | undefined => {
        if (minMax === undefined || minMax === null) return undefined;
        const min = Math.min(minMax.min, minMax.max);
        const max = Math.max(minMax.min, minMax.max);
        if (min === max) return min;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    if (template.statsBonus) {
        rolled.statsBonus = {};
        for (const key in template.statsBonus) {
            const statKey = key as keyof typeof template.statsBonus;
            const rolledStat = rollValue(template.statsBonus[statKey]);
            if (rolledStat !== undefined) {
                (rolled.statsBonus as any)[statKey] = rolledStat;
            }
        }
        if(Object.keys(rolled.statsBonus).length === 0) {
            delete rolled.statsBonus;
        }
    }
    
    const otherStatKeys: (keyof Omit<RolledAffixStats, 'statsBonus' | 'attacksPerRoundBonus' | 'dodgeChanceBonus'>)[] = [
        'damageMin', 'damageMax', 'armorBonus',
        'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent',
        'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent',
        'manaStealFlat', 'magicDamageMin', 'magicDamageMax'
    ];
    
    for (const key of otherStatKeys) {
        const value = rollValue((template as any)[key]);
        if (value !== undefined) {
            (rolled as any)[key] = value;
        }
    }

    return rolled;
};

export const createItemInstance = (templateId: string, allItemTemplates: ItemTemplate[], allAffixes: Affix[], allowAffixes = true): ItemInstance => {
    const template = allItemTemplates.find(t => t.id === templateId);
    if (!template) {
        return { uniqueId: crypto.randomUUID(), templateId };
    }

    const instance: ItemInstance = {
        uniqueId: crypto.randomUUID(),
        templateId,
        rolledBaseStats: rollTemplateStats(template),
    };

    if (allowAffixes) {
        const itemCategory = template.category;
    
        const possiblePrefixes = allAffixes.filter(a => a.type === AffixType.Prefix && a.spawnChances[itemCategory]);
        const possibleSuffixes = allAffixes.filter(a => a.type === AffixType.Suffix && a.spawnChances[itemCategory]);
    
        if (possiblePrefixes.length > 0) {
            for (const prefix of possiblePrefixes) {
                const chance = prefix.spawnChances[itemCategory] || 0;
                if (Math.random() * 100 < chance) {
                    instance.prefixId = prefix.id;
                    instance.rolledPrefix = rollAffixStats(prefix);
                    break; 
                }
            }
        }
    
        if (possibleSuffixes.length > 0) {
             for (const suffix of possibleSuffixes) {
                const chance = suffix.spawnChances[itemCategory] || 0;
                if (Math.random() * 100 < chance) {
                    instance.suffixId = suffix.id;
                    instance.rolledSuffix = rollAffixStats(suffix);
                    break;
                }
            }
        }
    }

    return instance;
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Player and Game Data
  const [playerCharacter, setPlayerCharacter] = useState<PlayerCharacter | null>(null);
  const [baseCharacter, setBaseCharacter] = useState<PlayerCharacter | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [expeditionReport, setExpeditionReport] = useState<ExpeditionRewardSummary | null>(null);
  const [postExpeditionCharacter, setPostExpeditionCharacter] = useState<PlayerCharacter | null>(null);
  const [pvpReport, setPvpReport] = useState<PvpRewardSummary | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
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
  const [traderSpecialOffer, setTraderSpecialOffer] = useState<ItemInstance | null>(null);

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

  const handleTriggerExpeditionCompletion = useCallback(async () => {
    if (isCompletingExpeditionRef.current) return;
    isCompletingExpeditionRef.current = true;
    try {
        const { updatedCharacter, summary } = await api.completeExpedition();
        setExpeditionReport(summary);
        setPostExpeditionCharacter(updatedCharacter);
    } catch (err: any) {
        // If expedition is already complete on the server (e.g. from another tab), fetch fresh character data
        if (err.message === 'No expedition to complete.') {
             try {
                const charData = await api.getCharacter();
                setBaseCharacter(charData);
             } catch (fetchErr: any) {
                setError(fetchErr.message);
             }
        } else {
            setError(err.message);
        }
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
      resources: { ...baseCharacter.resources, gold: baseCharacter.resources.gold - expedition.goldCost },
      stats: { ...baseCharacter.stats, currentEnergy: baseCharacter.stats.currentEnergy - expedition.energyCost },
      lastEnergyUpdateTime: Date.now(), // This prevents immediate regeneration on next fetch
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
        if (item.uniqueId === traderSpecialOffer?.uniqueId) {
            setTraderSpecialOffer(null);
        } else {
            setTraderInventory(prev => prev.filter(i => i.uniqueId !== item.uniqueId));
        }
    } catch (err: any) {
        alert(err.message);
    }
  }, [baseCharacter, gameData, traderSpecialOffer]);

  const handleBuyMysteriousItem = useCallback(async () => {
    if (!baseCharacter) return;
    if (baseCharacter.resources.gold < 5000) {
        alert(t('trader.notEnoughGold'));
        return;
    }
    if (baseCharacter.inventory.length >= getBackpackCapacity(baseCharacter)) {
        alert(t('trader.inventoryFull'));
        return;
    }
    try {
        const updatedCharacter = await api.buyMysteriousItem();
        setBaseCharacter(updatedCharacter);
    } catch (err: any) {
        alert(err.message);
    }
  }, [baseCharacter, t]);

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
  
  const fetchMessages = useCallback(async () => {
    try {
      const messagesData = await api.getMessages();
      setMessages(messagesData);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);
  
  const fetchTavernMessages = useCallback(async () => {
    try {
      const tavernData = await api.getTavernMessages();
      setTavernMessages(tavernData);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const fetchTraderInventory = useCallback(async (force = false) => {
    try {
      const inventoryData: TraderInventoryData = await api.getTraderInventory(force);
      setTraderInventory(inventoryData.regularItems);
      setTraderSpecialOffer(inventoryData.specialOfferItem || null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);
  
  const refreshCharacter = useCallback(async () => {
    try {
        const charData = await api.getCharacter();
        setBaseCharacter(charData);
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
    
    const requiredStats = template.requiredStats || {};
    for (const stat in requiredStats) {
        const key = stat as keyof CharacterStats;
        if (derivedForCheck.stats[key] < (requiredStats[key]!)) {
            alert(t('equipment.attributeRequirementNotMet', { stat: t(`statistics.${key}`), value: requiredStats[key]! }));
            return;
        }
    }

    const newEquipment = { ...baseCharacter.equipment };
    const newInventory = baseCharacter.inventory.filter(i => i.uniqueId !== itemToEquip.uniqueId);

    let finalSlot = template.slot as EquipmentSlot;

    // Handle ring equipping
    if (template.slot === 'ring') {
        if (!newEquipment.ring1) {
            finalSlot = EquipmentSlot.Ring1;
        } else if (!newEquipment.ring2) {
            finalSlot = EquipmentSlot.Ring2;
        } else {
             alert(t('equipment.ringSlotsFull'));
             return; // Don't proceed
        }
    }
    
    if (newEquipment[finalSlot]) {
        newInventory.push(newEquipment[finalSlot]!);
    }
    
    // Handle two-handed vs one-handed weapons
    if (finalSlot === EquipmentSlot.TwoHand) {
        if (newEquipment.mainHand) newInventory.push(newEquipment.mainHand);
        if (newEquipment.offHand) newInventory.push(newEquipment.offHand);
        newEquipment.mainHand = null;
        newEquipment.offHand = null;
    } else if (finalSlot === EquipmentSlot.MainHand || finalSlot === EquipmentSlot.OffHand) {
        if (newEquipment.twoHand) newInventory.push(newEquipment.twoHand);
        newEquipment.twoHand = null;
    }

    newEquipment[finalSlot] = itemToEquip;

    const updatedCharacter: PlayerCharacter = {
        ...baseCharacter,
        equipment: newEquipment,
        inventory: newInventory
    };
    
    handleCharacterUpdate(updatedCharacter, true);

}, [baseCharacter, gameData, handleCharacterUpdate, calculateDerivedStats, t]);

const handleUnequipItem = useCallback(async (item: ItemInstance, fromSlot: EquipmentSlot) => {
    if (!baseCharacter || !gameData) return;

    if (baseCharacter.inventory.length >= getBackpackCapacity(baseCharacter)) {
        alert(t('equipment.backpackFull'));
        return;
    }

    let tempCharacter: PlayerCharacter = {
        ...baseCharacter,
        equipment: { ...baseCharacter.equipment, [fromSlot]: null },
    };

    const itemsToUnequip = [item];
    const itemNamesToUnequip = [];

    let recheck = true;
    while(recheck) {
        recheck = false;
        const tempDerivedStats = calculateDerivedStats(tempCharacter, gameData);

        for (const slot in tempCharacter.equipment) {
            const equippedItem = tempCharacter.equipment[slot as EquipmentSlot];
            if (!equippedItem) continue;

            const template = gameData.itemTemplates.find(t => t.id === equippedItem.templateId);
            if (!template) continue;

            let meetsRequirements = true;
            if (tempDerivedStats.level < template.requiredLevel) {
                meetsRequirements = false;
            } else {
                const requiredStats = template.requiredStats || {};
                for (const stat in requiredStats) {
                    const key = stat as keyof CharacterStats;
                    if (tempDerivedStats.stats[key] < (requiredStats[key]!)) {
                        meetsRequirements = false;
                        break;
                    }
                }
            }

            if (!meetsRequirements) {
                itemsToUnequip.push(equippedItem);
                itemNamesToUnequip.push(template.name);
                (tempCharacter.equipment as any)[slot] = null;
                recheck = true; // Need to re-run checks
                break;
            }
        }
    }
    
    if (baseCharacter.inventory.length + itemsToUnequip.length > getBackpackCapacity(baseCharacter)) {
        alert(t('equipment.cascadeUnequipNoSpace', { count: itemsToUnequip.length -1 }));
        return;
    }

    if(itemNamesToUnequip.length > 0) {
         alert(t('equipment.autoUnequipped', { itemsList: itemNamesToUnequip.join(', ') }));
    }

    const finalCharacter = {
        ...tempCharacter,
        inventory: [...baseCharacter.inventory, ...itemsToUnequip]
    };

    handleCharacterUpdate(finalCharacter, true);

}, [baseCharacter, gameData, calculateDerivedStats, handleCharacterUpdate, t]);

const handlePostExpeditionClose = useCallback(() => {
    if (postExpeditionCharacter) {
      setBaseCharacter(postExpeditionCharacter);
    }
    setExpeditionReport(null);
    setPostExpeditionCharacter(null);
}, [postExpeditionCharacter]);

const handleUpgradeCamp = useCallback(async () => {
    if (!baseCharacter) return;
    const cost = 100 * Math.pow(baseCharacter.camp.level, 2);
    if (baseCharacter.resources.gold < cost) {
        alert(t('camp.notEnoughGold'));
        return;
    }
    const updatedChar = {
        ...baseCharacter,
        camp: { ...baseCharacter.camp, level: baseCharacter.camp.level + 1 },
        resources: { ...baseCharacter.resources, gold: baseCharacter.resources.gold - cost }
    };
    handleCharacterUpdate(updatedChar, true);
}, [baseCharacter, handleCharacterUpdate, t]);

const handleUpgradeChest = useCallback(async () => {
    if (!baseCharacter) return;
    const cost = getChestUpgradeCost(baseCharacter.chest.level);
    if (baseCharacter.resources.gold < cost.gold || cost.essences.some(e => (baseCharacter.resources[e.type] || 0) < e.amount)) {
        alert("Not enough resources."); return;
    }
    const newResources = { ...baseCharacter.resources, gold: baseCharacter.resources.gold - cost.gold };
    cost.essences.forEach(e => { (newResources[e.type] as number) -= e.amount; });

    const updatedChar = { ...baseCharacter, chest: { ...baseCharacter.chest, level: baseCharacter.chest.level + 1 }, resources: newResources };
    handleCharacterUpdate(updatedChar, true);
}, [baseCharacter, handleCharacterUpdate]);

const handleUpgradeBackpack = useCallback(async () => {
    if (!baseCharacter) return;
    const level = baseCharacter.backpack?.level || 1;
    if (level >= 10) return;
    const cost = getBackpackUpgradeCost(level);
     if (baseCharacter.resources.gold < cost.gold || cost.essences.some(e => (baseCharacter.resources[e.type] || 0) < e.amount)) {
        alert("Not enough resources."); return;
    }
    const newResources = { ...baseCharacter.resources, gold: baseCharacter.resources.gold - cost.gold };
    cost.essences.forEach(e => { (newResources[e.type] as number) -= e.amount; });

    const updatedChar = { ...baseCharacter, backpack: { ...baseCharacter.backpack, level: level + 1 }, resources: newResources };
    handleCharacterUpdate(updatedChar, true);
}, [baseCharacter, handleCharacterUpdate]);

const handleDisenchantItem = useCallback(async (item: ItemInstance) => {
    if (!baseCharacter) return { success: false };
    try {
        const { updatedCharacter, result } = await api.disenchantItem(item.uniqueId);
        setBaseCharacter(updatedCharacter);
        return result;
    } catch(err: any) {
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

const handleAcceptQuest = useCallback(async (questId: string) => {
    if (!baseCharacter) return;
    if (!baseCharacter.acceptedQuests.includes(questId)) {
        const questProgressExists = baseCharacter.questProgress.some(p => p.questId === questId);
        const updatedChar: PlayerCharacter = {
            ...baseCharacter,
            acceptedQuests: [...baseCharacter.acceptedQuests, questId],
            questProgress: questProgressExists 
                ? baseCharacter.questProgress 
                : [...baseCharacter.questProgress, { questId, progress: 0, completions: 0 }]
        };
        handleCharacterUpdate(updatedChar, true);
    }
}, [baseCharacter, handleCharacterUpdate]);

const handleCompleteQuest = useCallback(async (questId: string) => {
    if (!baseCharacter) return;
    try {
        const updatedChar = await api.completeQuest(questId);
        setBaseCharacter(updatedChar);
        alert(t('quests.questCompleted'));
    } catch (err: any) {
        alert(err.message);
    }
}, [baseCharacter, t]);

const handleSendTavernMessage = useCallback(async (content: string) => {
    try {
        const newMessage = await api.sendTavernMessage(content);
        setTavernMessages(prev => [...prev, newMessage]);
    } catch (err: any) {
        alert(err.message);
    }
}, []);

// Main data loading and game loop effects
useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (token) {
          const [charData, gameData] = await Promise.all([
            api.getCharacter(),
            api.getGameData()
          ]);
          setGameData(gameData);
          if (charData) {
            setBaseCharacter(charData);
          }
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
    init();
}, [token, handleLogout]);

useEffect(() => {
    if (baseCharacter && gameData) {
        const derived = calculateDerivedStats(baseCharacter, gameData);
        setPlayerCharacter(derived);

        if (derived.activeExpedition && Date.now() >= derived.activeExpedition.finishTime) {
            handleTriggerExpeditionCompletion();
        }
    } else {
        setPlayerCharacter(null);
    }
}, [baseCharacter, gameData, calculateDerivedStats, handleTriggerExpeditionCompletion]);

useEffect(() => {
    if (!token || !playerCharacter) return;

    // Periodic fetches
    const fetchData = () => {
        if (activeTabRef.current === Tab.Ranking) fetchRanking();
        if (activeTabRef.current === Tab.Messages) fetchMessages();
        if (activeTabRef.current === Tab.Trader) fetchTraderInventory();
        if (activeTabRef.current === Tab.Admin) { /* fetch admin data if needed */ }
    };
    fetchData(); // Initial fetch on load
    const interval = setInterval(fetchData, 30000); // Fetch every 30 seconds

    // Heartbeat
    const sendHeartbeat = () => api.sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 60000);

    return () => {
        clearInterval(interval);
        clearInterval(heartbeatInterval);
    };
}, [token, playerCharacter, fetchRanking, fetchMessages, fetchTraderInventory]);

useEffect(() => {
    if (token && playerCharacter) {
        if (tavernIntervalRef.current) clearInterval(tavernIntervalRef.current);
        
        const fetchAndCheckTavern = async () => {
            const newMessages = await api.getTavernMessages();
            setTavernMessages(newMessages);
            const latestMessage = newMessages.length > 0 ? newMessages[newMessages.length - 1] : null;

            if (latestMessage) {
                if (activeTabRef.current === Tab.Tavern) {
                    lastReadTavernMessageIdRef.current = latestMessage.id;
                    setHasNewTavernMessages(false);
                } else {
                    if (lastReadTavernMessageIdRef.current === null) {
                        lastReadTavernMessageIdRef.current = latestMessage.id;
                    } else if (latestMessage.id > lastReadTavernMessageIdRef.current) {
                        setHasNewTavernMessages(true);
                    }
                }
            }
        };

        fetchAndCheckTavern();
        tavernIntervalRef.current = window.setInterval(fetchAndCheckTavern, 5000); // check tavern every 5 seconds
    }
    return () => { if (tavernIntervalRef.current) clearInterval(tavernIntervalRef.current); };
}, [token, playerCharacter]);


useEffect(() => {
    resetInactivityTimer();
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keypress', resetInactivityTimer);
    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('keypress', resetInactivityTimer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
}, [resetInactivityTimer]);


// Content Rendering
const renderContent = () => {
    if (!playerCharacter || !gameData) return <div className="p-6 text-center">{t('loading')}</div>;

    switch (activeTab) {
        case Tab.Statistics:
            return <Statistics character={playerCharacter} baseCharacter={baseCharacter!} onCharacterUpdate={handleCharacterUpdate} calculateDerivedStats={calculateDerivedStats} gameData={gameData} onResetAttributes={handleResetAttributes} onSelectClass={handleSelectClass} />;
        case Tab.Equipment:
            return <Equipment character={playerCharacter} baseCharacter={baseCharacter!} gameData={gameData} onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem} />;
        case Tab.Expedition:
            return <ExpeditionComponent character={playerCharacter} expeditions={gameData.expeditions} enemies={gameData.enemies} currentLocation={currentLocation!} onStartExpedition={handleStartExpedition} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onCompletion={handleTriggerExpeditionCompletion} />;
        case Tab.Camp:
            return <Camp character={playerCharacter} baseCharacter={baseCharacter!} onToggleResting={handleToggleResting} onUpgradeCamp={handleUpgradeCamp} getCampUpgradeCost={(level) => 100 * Math.pow(level, 2)} onCharacterUpdate={handleCharacterUpdate} onHealToFull={handleHealToFull} onUpgradeChest={handleUpgradeChest} onUpgradeBackpack={handleUpgradeBackpack} getChestUpgradeCost={getChestUpgradeCost} getBackpackUpgradeCost={getBackpackUpgradeCost} />;
        case Tab.Location:
            return <LocationComponent playerCharacter={playerCharacter} onCharacterUpdate={handleCharacterUpdate} locations={gameData.locations} />;
        case Tab.Resources:
            return <Resources character={playerCharacter} />;
        case Tab.Ranking:
            return <Ranking ranking={ranking} currentPlayer={playerCharacter} onRefresh={fetchRanking} isLoading={isRankingLoading} onAttack={handlePvpAttack} onComposeMessage={handleComposeMessage} />;
        case Tab.Trader:
            return <Trader character={playerCharacter} baseCharacter={baseCharacter!} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} settings={gameData.settings} traderInventory={traderInventory} traderSpecialOffer={traderSpecialOffer} onBuyItem={handleBuyItem} onSellItems={handleSellItems} onBuyMysteriousItem={handleBuyMysteriousItem} />;
        case Tab.Blacksmith:
            return <Blacksmith character={playerCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onDisenchantItem={handleDisenchantItem} onUpgradeItem={handleUpgradeItem} />;
        case Tab.Messages:
            return <Messages messages={messages} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} currentPlayer={playerCharacter} onDeleteMessage={handleDeleteMessage} onMarkAsRead={handleMarkAsRead} onCompose={handleComposeMessage} onClaimReturn={handleClaimMessageItem} onDeleteBulk={handleBulkDeleteMessages} />;
        case Tab.Quests:
            return <Quests character={playerCharacter} quests={gameData.quests} enemies={gameData.enemies} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onAcceptQuest={handleAcceptQuest} onCompleteQuest={handleCompleteQuest} />;
        case Tab.Tavern:
            return <Tavern character={playerCharacter} messages={tavernMessages} onSendMessage={handleSendTavernMessage} />;
        case Tab.Market:
            return <Market character={playerCharacter} gameData={gameData} onCharacterUpdate={handleCharacterUpdate} />;
        case Tab.Options:
            return <Options character={playerCharacter} onCharacterUpdate={handleCharacterUpdate} />;
        case Tab.Admin:
            return <AdminPanel gameData={gameData} users={users} allCharacters={allCharacters} onGameDataUpdate={(key, data) => api.updateGameData(key, data).then(() => api.getGameData()).then(setGameData)} onSettingsUpdate={(settings) => api.updateGameSettings(settings).then(() => api.getGameData()).then(setGameData)} onDeleteUser={(id) => api.deleteUser(id).then(() => setUsers(u => u.filter(user => user.id !== id)))} onDeleteCharacter={(id) => api.deleteCharacter(id).then(() => setAllCharacters(c => c.filter(char => char.user_id !== id)))} onResetCharacterStats={(id) => api.resetCharacterStats(id)} onHealCharacter={(id) => api.healCharacter(id)} onUpdateCharacterGold={(id, gold) => api.updateCharacterGold(id, gold)} onForceTraderRefresh={() => fetchTraderInventory(true)} onResetAllPvpCooldowns={() => api.resetAllPvpCooldowns().then(() => alert('Cooldowns reset'))} onSendGlobalMessage={api.sendGlobalMessage} onRegenerateCharacterEnergy={api.regenerateCharacterEnergy} onChangeUserPassword={api.changeUserPassword} onInspectCharacter={api.inspectCharacter} onDeleteCharacterItem={api.deleteCharacterItem} />;
        default:
            return <Statistics character={playerCharacter} baseCharacter={baseCharacter!} onCharacterUpdate={handleCharacterUpdate} calculateDerivedStats={calculateDerivedStats} gameData={gameData} onResetAttributes={handleResetAttributes} onSelectClass={handleSelectClass} />;
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">{t('error.title')}</h2>
          <p className="mb-4">{error}</p>
          <p className="text-gray-400 mb-6">{t('error.refresh')}</p>
          <button onClick={handleLogout} className="px-4 py-2 bg-indigo-600 rounded-md">{t('error.logout')}</button>
        </div>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={{ lang: currentLanguage, t }}>
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed" 
        style={{ backgroundImage: `url('${gameData?.settings.gameBackground || 'game_background.png'}')` }}
      >
        {!token ? (
          <Auth onLoginSuccess={(newToken) => { localStorage.setItem('token', newToken); setToken(newToken); }} settings={gameData?.settings} />
        ) : !baseCharacter ? (
          <CharacterCreation onCharacterCreate={async ({ name, race }) => {
            if (gameData) {
              const startLocation = gameData.locations.find(l => l.isStartLocation);
              if (!startLocation) {
                alert("Error: No start location found. Contact administrator.");
                return;
              }
              const newChar = await api.createCharacter(name, race, startLocation.id);
              setBaseCharacter(newChar);
            }
          }} />
        ) : (
          <div className="flex min-h-screen">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} playerCharacter={playerCharacter} currentLocation={currentLocation} onLogout={handleLogout} hasUnreadMessages={hasUnreadMessages} hasNewTavernMessages={hasNewTavernMessages} onOpenNews={handleOpenNews} hasNewNews={hasNewNews} />
            <main className="flex-1 p-6 overflow-y-auto">
              {renderContent()}
            </main>
          </div>
        )}
        {expeditionReport && playerCharacter && gameData && (
          <ExpeditionSummaryModal reward={expeditionReport} onClose={handlePostExpeditionClose} characterName={playerCharacter.name} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} />
        )}
         {pvpReport && playerCharacter && gameData && (
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
            itemTemplates={gameData.itemTemplates}
            affixes={gameData.affixes}
            isPvp={true}
            pvpData={{ attacker: pvpReport.attacker, defender: pvpReport.defender }}
          />
        )}
        {isComposingMessage && (
          <ComposeMessageModal onClose={() => setIsComposingMessage(false)} onSendMessage={handleSendMessage} allCharacterNames={allCharacterNames} initialRecipient={composeInitialData?.recipient} initialSubject={composeInitialData?.subject} />
        )}
         {gameData && (
          <NewsModal isOpen={isNewsModalOpen} onClose={handleCloseNews} content={gameData.settings.newsContent || ''} />
        )}
      </div>
    </LanguageContext.Provider>
  );
};

export default App;
