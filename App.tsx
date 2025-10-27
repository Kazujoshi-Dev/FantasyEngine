

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
import { Tab, PlayerCharacter, Location, Expedition, Enemy, ExpeditionRewardSummary, CombatLogEntry, Race, RankingPlayer, Language, GameSettings, User, AdminCharacterInfo, RewardSource, EquipmentSlot, ItemTemplate, ItemInstance, CharacterStats, ItemRarity, EssenceType, MagicAttackType, Message, PvpRewardSummary, Quest, QuestType, PlayerQuestProgress, LootDrop, TavernMessage } from './types';
import { api } from './api';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';

const generateTraderInventory = (itemTemplates: ItemTemplate[], settings: GameSettings): ItemInstance[] => {
    const INVENTORY_SIZE = 12;
    const inventory: ItemInstance[] = [];
    
    const defaultChances = {
        [ItemRarity.Common]: 60,
        [ItemRarity.Uncommon]: 30,
        [ItemRarity.Rare]: 10,
    };
    
    const chances = settings.traderSettings?.rarityChances || defaultChances;
    
    const eligibleTemplates = itemTemplates.filter(t => 
        t.rarity === ItemRarity.Common ||
        t.rarity === ItemRarity.Uncommon ||
        t.rarity === ItemRarity.Rare
    );

    if (eligibleTemplates.length === 0) return [];
    
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const rand = Math.random() * 100;
        let selectedRarity: ItemRarity;

        if (rand < chances.Common) {
            selectedRarity = ItemRarity.Common;
        } else if (rand < chances.Common + chances.Uncommon) {
            selectedRarity = ItemRarity.Uncommon;
        } else {
            selectedRarity = ItemRarity.Rare;
        }

        const templatesOfRarity = eligibleTemplates.filter(t => t.rarity === selectedRarity);
        if (templatesOfRarity.length > 0) {
            const randomTemplate = templatesOfRarity[Math.floor(Math.random() * templatesOfRarity.length)];
            inventory.push({
                uniqueId: crypto.randomUUID(),
                templateId: randomTemplate.id
            });
        }
    }
    
    return inventory;
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
  const [playerCharacter, setPlayerCharacter] = useState<PlayerCharacter | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allCharacters, setAllCharacters] = useState<AdminCharacterInfo[]>([]);
  const [allCharacterNames, setAllCharacterNames] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tavernMessages, setTavernMessages] = useState<TavernMessage[]>([]);
  const [language, setLanguage] = useState<Language>(Language.PL);
  const [gameSettings, setGameSettings] = useState<GameSettings>({ language: Language.PL });
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [lastExpeditionReward, setLastExpeditionReward] = useState<ExpeditionRewardSummary | null>(null);
  const [activePvpResult, setActivePvpResult] = useState<PvpRewardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [traderInventory, setTraderInventory] = useState<ItemInstance[]>([]);
  const traderLastRefreshHour = useRef(new Date().getHours());
  const [isComposing, setIsComposing] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState<{ recipientName: string; subject: string } | null>(null);
  
  const t = useMemo(() => getT(language), [language]);
  
  const handleLogout = useCallback(async () => {
    if (token) {
        await api.logout(token).catch(console.error);
    }
    setToken(null);
    setPlayerCharacter(null);
    setActiveTab(Tab.Statistics);
    setRanking([]);
    setUsers([]);
    setMessages([]);
    localStorage.removeItem('token');
  }, [token]);
  
  const fetchRanking = useCallback(async () => {
        try {
            setIsRankingLoading(true);
            const rankingData = await api.getRanking();
            setRanking(rankingData);
        } catch (e: any) {
             console.error("Failed to load ranking:", e);
        } finally {
            setIsRankingLoading(false);
        }
    }, []);

  const calculateDerivedStats = useCallback((character: PlayerCharacter): PlayerCharacter => {
    // This function is idempotent. It assumes the incoming `character.stats` object contains BASE primary stats.
    
    // 1. Create a temporary object for total stats, initialized with base stats.
    const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
        strength: character.stats.strength,
        agility: character.stats.agility,
        accuracy: character.stats.accuracy,
        stamina: character.stats.stamina,
        intelligence: character.stats.intelligence,
        energy: character.stats.energy,
    };
    
    let bonusDamageMin = 0;
    let bonusDamageMax = 0;
    let bonusMagicDamageMin = 0;
    let bonusMagicDamageMax = 0;
    let bonusArmor = 0;
    let bonusCritChance = 0;
    let bonusMaxHealth = 0;
    let bonusCritDamageModifier = 0;
    let bonusArmorPenetrationPercent = 0;
    let bonusArmorPenetrationFlat = 0;
    let bonusLifeStealPercent = 0;
    let bonusLifeStealFlat = 0;
    let bonusManaStealPercent = 0;
    let bonusManaStealFlat = 0;
    
    // 2. Sum up all bonuses from currently equipped items.
    for (const slot in character.equipment) {
        const itemInstance = character.equipment[slot as EquipmentSlot];
        if (itemInstance) {
            const template = itemTemplates.find(t => t.id === itemInstance.templateId);
            if (template) {
                const upgradeLevel = itemInstance.upgradeLevel || 0;
                const upgradeBonusFactor = upgradeLevel * 0.1;

                for (const stat in template.statsBonus) {
                    const key = stat as keyof typeof template.statsBonus;
                    const baseBonus = template.statsBonus[key] || 0;
                    totalPrimaryStats[key] += baseBonus * (1 + upgradeBonusFactor);
                }

                const baseDamageMin = template.damageMin || 0;
                const baseDamageMax = template.damageMax || 0;
                const baseMagicDamageMin = template.magicDamageMin || 0;
                const baseMagicDamageMax = template.magicDamageMax || 0;
                const baseArmor = template.armorBonus || 0;
                const baseCritChance = template.critChanceBonus || 0;
                const baseMaxHealth = template.maxHealthBonus || 0;
                
                bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeBonusFactor);
                bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeBonusFactor);
                bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeBonusFactor);
                bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeBonusFactor);
                bonusArmor += baseArmor * (1 + upgradeBonusFactor);
                bonusCritChance += baseCritChance * (1 + upgradeBonusFactor);
                bonusMaxHealth += baseMaxHealth * (1 + upgradeBonusFactor);

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
    
    // Round the accumulated float bonuses before using them to calculate final stats.
    totalPrimaryStats.strength = Math.round(totalPrimaryStats.strength);
    totalPrimaryStats.agility = Math.round(totalPrimaryStats.agility);
    totalPrimaryStats.accuracy = Math.round(totalPrimaryStats.accuracy);
    totalPrimaryStats.stamina = Math.round(totalPrimaryStats.stamina);
    totalPrimaryStats.intelligence = Math.round(totalPrimaryStats.intelligence);
    totalPrimaryStats.energy = Math.round(totalPrimaryStats.energy);
    
    bonusArmor = Math.round(bonusArmor);
    bonusMaxHealth = Math.round(bonusMaxHealth);

    // Identify equipped weapon to determine how to calculate physical damage
    const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    const attacksPerRound = mainHandTemplate?.attacksPerRound || 1;

    // 3. Recalculate all derived stats from the new total primary stats.
    const baseHealth = 50;
    const baseEnergy = 10;
    const baseMana = 20;
    const baseMinDamage = 1;
    const baseMaxDamage = 2;

    const maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
    const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
    const maxMana = baseMana + totalPrimaryStats.intelligence * 10;

    let minDamage;
    let maxDamage;
    if (mainHandTemplate?.isMagical) {
        // For magical weapons, physical damage is just the item's bonus (base damage), not influenced by strength.
        minDamage = baseMinDamage + bonusDamageMin;
        maxDamage = baseMaxDamage + bonusDamageMax;
    } else {
        // For physical weapons, add strength bonus.
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

    // --- APPLY RACIAL BONUSES ---
    if (character.race === Race.Dwarf) {
        armor += 5;
    }
    if (character.race === Race.Elf) {
        manaRegen += 10;
    }
    // Other racial bonuses are applied during combat or reward calculation.
    // --- END RACIAL BONUSES ---
    
    const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
    const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
    const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

    const currentHealth = character.stats.currentHealth === 0 ? maxHealth : Math.min(character.stats.currentHealth, maxHealth);
    const currentEnergy = character.stats.currentEnergy === 0 ? maxEnergy : Math.min(character.stats.currentEnergy, maxEnergy);
    const currentMana = character.stats.currentMana === undefined ? maxMana : Math.min(character.stats.currentMana, maxMana);

    
    // 4. Return a new character object with fully calculated stats for display.
    // The original base primary stats from the input `character` object are preserved,
    // and then overwritten with the total values for display purposes.
    return {
      ...character,
      stats: {
        ...character.stats,
        ...totalPrimaryStats, // Overwrite primary stats with their TOTAL values
        maxHealth,
        maxEnergy,
        maxMana,
        minDamage,
        maxDamage,
        critChance,
        critDamageModifier,
        armor,
        armorPenetrationPercent,
        armorPenetrationFlat,
        lifeStealPercent,
        lifeStealFlat,
        manaStealPercent,
        manaStealFlat,
        magicDamageMin,
        magicDamageMax,
        attacksPerRound,
        manaRegen,
        currentHealth,
        currentEnergy,
        currentMana,
      }
    };
  }, [itemTemplates]);

  // Create a memoized version of the character with derived stats for display
  const displayedCharacter = useMemo(() => {
    if (!playerCharacter) return null;
    return calculateDerivedStats(playerCharacter);
  }, [playerCharacter, calculateDerivedStats]);
  
  // Helper function to update character on the server
  const updateCharacterOnServer = useCallback(async (character: PlayerCharacter) => {
    try {
        const updatedChar = await api.updateCharacter(character);
        return updatedChar;
    } catch (e: any) {
        console.error(e);
        if (e.message.includes('Invalid token')) handleLogout();
        alert('An error occurred while saving progress. Please try refreshing the page.');
        return null;
    }
  }, [handleLogout]);

  const handleCharacterUpdate = useCallback(async (character: PlayerCharacter) => {
    // This function now receives a character with BASE stats.
    // It performs logic on these base stats, saves them, and then updates the local state.

    // 1. Create a mutable copy for modifications.
    let characterToSave = { ...character };

    // 2. Perform level-up logic if necessary.
    while (characterToSave.experience >= characterToSave.experienceToNextLevel) {
        characterToSave.level += 1;
        characterToSave.experience -= characterToSave.experienceToNextLevel;
        characterToSave.stats.statPoints += 1;
        characterToSave.experienceToNextLevel = Math.floor(100 * Math.pow(characterToSave.level, 1.3));

        // When leveling up, fully heal. Calculate derived stats temporarily to find max health.
        const tempDerived = calculateDerivedStats(characterToSave);
        characterToSave.stats.currentHealth = tempDerived.stats.maxHealth;
        characterToSave.stats.currentEnergy = tempDerived.stats.maxEnergy;
        characterToSave.stats.currentMana = tempDerived.stats.maxMana;
    }
    
    // 3. Save the clean, base-stat character to the server.
    await updateCharacterOnServer(characterToSave);
    
    // 4. Update the local (base) state, which will trigger the useMemo to update displayedCharacter.
    setPlayerCharacter(characterToSave);
  }, [calculateDerivedStats, updateCharacterOnServer]);

  useEffect(() => {
    const loadGameData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setLocationError(false);
        
        // Always load public data first, regardless of token status.
        // This ensures settings like language are available for the Auth screen.
        const gameData = await api.getGameData();
        const templates = gameData.itemTemplates || [];
        const settings = gameData.settings || { language: Language.EN };
        
        setLocations(gameData.locations || []);
        setExpeditions(gameData.expeditions || []);
        setEnemies(gameData.enemies || []);
        setItemTemplates(templates);
        setQuests(gameData.quests || []);
        setGameSettings(settings);
        setLanguage(settings.language);
        
        // --- TRADER INVENTORY LOGIC ---
        const now = new Date();
        const currentHour = now.getHours();
        let initialTraderInventory: ItemInstance[] = [];

        try {
            const storedTraderDataJSON = localStorage.getItem('traderInventory');
            if (storedTraderDataJSON) {
                const storedTraderData = JSON.parse(storedTraderDataJSON);
                if (storedTraderData.refreshHour === currentHour && Array.isArray(storedTraderData.inventory)) {
                    console.log('Loading trader inventory from localStorage for the current hour.');
                    initialTraderInventory = storedTraderData.inventory;
                }
            }
        } catch (e) {
            console.error("Failed to load trader inventory from localStorage", e);
            localStorage.removeItem('traderInventory'); // Clear corrupted data
        }

        if (initialTraderInventory.length === 0) {
            console.log('Generating new trader inventory for the hour.');
            const newInventory = generateTraderInventory(templates, settings);
            initialTraderInventory = newInventory;
            try {
                localStorage.setItem('traderInventory', JSON.stringify({
                    inventory: newInventory,
                    refreshHour: currentHour,
                }));
            } catch (e) {
                console.error("Failed to save trader inventory to localStorage", e);
            }
        }
        setTraderInventory(initialTraderInventory);
        traderLastRefreshHour.current = currentHour;
        // --- END TRADER INVENTORY LOGIC ---

        // If a token exists, load user-specific authenticated data.
        if (token) {
            const usersData = await api.getUsers();
            setUsers(usersData);
            
            const allCharsData = await api.getAllCharacters();
            setAllCharacters(allCharsData);
            
            const charNames = await api.getCharacterNames();
            setAllCharacterNames(charNames);
            
            const messagesData = await api.getMessages();
            setMessages(messagesData);

            fetchRanking();

            try {
                const character = await api.getCharacter();
                
                // SANITIZE/MIGRATE CHARACTER DATA to prevent blank screen crash
                if (!character.stats) character.stats = {} as CharacterStats;
                if (character.stats.critDamageModifier === undefined) character.stats.critDamageModifier = 200;
                if (character.stats.armorPenetrationPercent === undefined) character.stats.armorPenetrationPercent = 0;
                if (character.stats.lifeStealPercent === undefined) character.stats.lifeStealPercent = 0;
                if (character.stats.manaStealPercent === undefined) character.stats.manaStealPercent = 0;
                if (character.stats.armorPenetrationFlat === undefined) character.stats.armorPenetrationFlat = 0;
                if (character.stats.lifeStealFlat === undefined) character.stats.lifeStealFlat = 0;
                if (character.stats.manaStealFlat === undefined) character.stats.manaStealFlat = 0;
                
                if (!character.equipment) {
                    character.equipment = {
                        [EquipmentSlot.Head]: null, [EquipmentSlot.Chest]: null, [EquipmentSlot.Legs]: null,
                        [EquipmentSlot.Feet]: null, [EquipmentSlot.Hands]: null, [EquipmentSlot.Waist]: null,
                        [EquipmentSlot.Neck]: null, [EquipmentSlot.Ring1]: null, [EquipmentSlot.Ring2]: null,
                        [EquipmentSlot.MainHand]: null, [EquipmentSlot.OffHand]: null, [EquipmentSlot.TwoHand]: null,
                    };
                }
                if (!character.inventory) {
                    character.inventory = [];
                }
                if (!character.questProgress) {
                    character.questProgress = [];
                }
                if (!character.acceptedQuests) {
                    character.acceptedQuests = [];
                }
                
                // The character from the API has base stats. We store this pure object in state.
                setPlayerCharacter(character);

                const currentLoc = gameData.locations.find(l => l.id === character.currentLocationId);
                if (!currentLoc) {
                    console.error("CRITICAL: Character's location ID is invalid!");
                    setLocationError(true);
                }

            } catch (charError: any) {
                if (charError.message.includes('Character not found')) {
                     setPlayerCharacter(null);
                } else {
                    throw charError;
                }
            }
        }
      } catch (e: any) {
        if (e.message.includes('Invalid token')) {
            handleLogout();
        } else {
            setError(e.message || 'An unknown error occurred while loading the game.');
            console.error(e);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadGameData();
  }, [token, handleLogout, fetchRanking]);
  
    // Automatic hourly ranking refresh
    useEffect(() => {
        let intervalId: number | undefined;

        const startHourlyRefresh = () => {
            console.log("Refreshing ranking on the hour...");
            fetchRanking();
            intervalId = window.setInterval(fetchRanking, 60 * 60 * 1000); // every hour
        };

        const now = new Date();
        const minutesUntilNextHour = 60 - now.getMinutes();
        const secondsUntilNextHour = 60 - now.getSeconds();
        const msUntilNextHour = (minutesUntilNextHour * 60 + secondsUntilNextHour) * 1000 - now.getMilliseconds();

        const timeoutId = setTimeout(startHourlyRefresh, msUntilNextHour);

        return () => {
            clearTimeout(timeoutId);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [fetchRanking]);

    // Hourly Trader Refresh
    useEffect(() => {
        const timerId = setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();

            if (currentHour !== traderLastRefreshHour.current) {
                console.log("New hour detected, refreshing trader inventory.");
                traderLastRefreshHour.current = currentHour;
                const newInventory = generateTraderInventory(itemTemplates, gameSettings);
                setTraderInventory(newInventory);
                try {
                    localStorage.setItem('traderInventory', JSON.stringify({
                        inventory: newInventory,
                        refreshHour: currentHour,
                    }));
                } catch (e) {
                    console.error("Failed to save refreshed trader inventory to localStorage", e);
                }
            }
        }, 60 * 1000); // Check every minute

        return () => clearInterval(timerId);
    }, [itemTemplates, gameSettings]);

  // Health regeneration during rest
  useEffect(() => {
    if (!displayedCharacter?.isResting) return;

    const REGEN_INTERVAL = 5000; // 5 seconds

    const intervalId = setInterval(() => {
      setPlayerCharacter(prevChar => {
        if (!prevChar || !prevChar.isResting) {
            return prevChar;
        }

        // We must calculate derived stats on the fly to get the correct maxHealth for regen calc
        const currentDerivedStats = calculateDerivedStats(prevChar).stats;

        // If already full, stop resting. This also handles starting resting with full health.
        if (prevChar.stats.currentHealth >= currentDerivedStats.maxHealth) {
            const updatedCharacter = { ...prevChar, isResting: false };
            updateCharacterOnServer(updatedCharacter);
            return updatedCharacter;
        }

        const regenPerMinute = prevChar.camp.level; // 1% per level
        const regenPerTick = (regenPerMinute / 100) * currentDerivedStats.maxHealth / (60 / 5);
        
        const newHealth = prevChar.stats.currentHealth + regenPerTick;
        
        // If health becomes full after this tick, update to max, and stop resting.
        if (newHealth >= currentDerivedStats.maxHealth) {
            const finalChar = {
              ...prevChar,
              stats: {
                ...prevChar.stats,
                currentHealth: currentDerivedStats.maxHealth,
              },
              isResting: false,
            };
            updateCharacterOnServer(finalChar);
            return finalChar;
        }
        
        // Otherwise, just update health and continue resting.
        return {
          ...prevChar,
          stats: {
            ...prevChar.stats,
            currentHealth: newHealth,
          }
        };
      });
    }, REGEN_INTERVAL);

    return () => clearInterval(intervalId);
  }, [displayedCharacter?.isResting, calculateDerivedStats, updateCharacterOnServer]);
  
  // Poll for new messages periodically
  useEffect(() => {
    if (!token || !playerCharacter) {
      return; // Don't poll if not logged in
    }

    const POLLING_INTERVAL = 5000; // 5 seconds

    const pollMessages = async () => {
      try {
        const latestMessages = await api.getMessages();
        // Update messages state. React's diffing will prevent re-renders if data is the same.
        setMessages(latestMessages); 
      } catch (e: any) {
        console.error("Polling for messages failed:", e);
        // If token becomes invalid during polling, handle logout.
        if (e.message.includes('Invalid token')) {
            handleLogout();
        }
      }
    };

    const intervalId = setInterval(pollMessages, POLLING_INTERVAL);

    // Cleanup function to stop polling when component unmounts or user logs out.
    return () => clearInterval(intervalId);
  }, [token, playerCharacter, handleLogout]); // Dependencies ensure polling starts/stops correctly.

  // Energy regeneration while online
  useEffect(() => {
    if (!playerCharacter) return;

    const intervalId = setInterval(async () => {
      const now = Date.now();
      const lastUpdateTimestamp = playerCharacter.lastEnergyUpdateTime;

      // If more than an hour has passed since the last update timestamp, check in with the server.
      if (now - lastUpdateTimestamp > 60 * 60 * 1000) {
        console.log("Hourly check: Fetching character data for potential energy regeneration.");
        try {
          const character = await api.getCharacter();
          // The fetched character will have updated energy and lastEnergyUpdateTime
          setPlayerCharacter(character);
        } catch (e: any) {
          console.error("Polling for character energy failed:", e);
          if (e.message.includes('Invalid token')) {
            handleLogout();
          }
        }
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(intervalId);
  }, [playerCharacter, handleLogout]);

  // Poll for new tavern messages periodically
  useEffect(() => {
    if (!token || !playerCharacter) return;

    const POLLING_INTERVAL = 3000; // 3 seconds

    const pollTavernMessages = async () => {
      try {
        const latestMessages = await api.getTavernMessages();
        setTavernMessages(latestMessages);
      } catch (e: any) {
        console.error("Polling for tavern messages failed:", e);
        if (e.message.includes('Invalid token')) {
            handleLogout();
        }
      }
    };

    const intervalId = setInterval(pollTavernMessages, POLLING_INTERVAL);
    pollTavernMessages(); // Initial fetch

    return () => clearInterval(intervalId);
  }, [token, playerCharacter, handleLogout]);

  const handleSendTavernMessage = async (content: string) => {
    try {
        const newMessage = await api.sendTavernMessage(content);
        setTavernMessages(prev => [...prev, newMessage]);
    } catch (e: any) {
        console.error("Failed to send tavern message:", e);
        alert(`Error: ${e.message}`);
    }
  };

  const handleOpenCompose = (recipientName = '', subject = '') => {
      setComposeInitialData({ recipientName, subject });
      setIsComposing(true);
  };

  const handleCloseCompose = () => {
      setIsComposing(false);
      setComposeInitialData(null);
  };

  const handleSendMessage = async (data: { recipientName: string; subject: string; content: string }): Promise<void> => {
      await api.sendMessage(data);
  };


  const handleCharacterCreation = async (character: { name: string, race: Race }) => {
    const gameData = await api.getGameData(); // Ensure we have latest game data
    const startLocation = gameData.locations.find(l => l.isStartLocation);
    if (!startLocation) {
        const errorMsg = "Critical Error: Start location not found. Please contact an administrator.";
        console.error(errorMsg);
        alert(errorMsg);
        throw new Error(errorMsg);
    }

    try {
        const newCharacter = await api.createCharacter(character.name, character.race, startLocation.id);
        setPlayerCharacter(newCharacter);
    } catch (e: any) {
        console.error(e);
        if (e.message.includes('Invalid token')) handleLogout();
        alert(`Failed to create character: ${e.message}. Please try again.`);
        throw e; // Re-throw error so the UI can update
    }
  };
  
  const handleLoginSuccess = (newToken: string) => {
      localStorage.setItem('token', newToken);
      setToken(newToken);
  };
  
  const handleResetLocation = useCallback(async () => {
    if (!playerCharacter) return;

    const startLocation = locations.find(l => l.isStartLocation);
    if (!startLocation) {
        alert("CRITICAL ERROR: No start location found in game data. Cannot reset location.");
        return;
    }

    const updatedCharacter = {
        ...playerCharacter,
        currentLocationId: startLocation.id
    };

    // Use handleCharacterUpdate to save and update state
    await handleCharacterUpdate(updatedCharacter);
    setLocationError(false); // Clear the error state
}, [playerCharacter, locations, handleCharacterUpdate]);

  const updateGameDataOnServer = async (key: 'locations' | 'expeditions' | 'enemies' | 'itemTemplates' | 'quests', data: any) => {
      try {
          await api.updateGameData(key, data);
      } catch (e: any) {
          console.error(e);
          if (e.message.includes('Invalid token')) handleLogout();
          alert(`An error occurred while saving ${key}.`);
      }
  };

  const handleLocationsUpdate = (updatedLocations: Location[]) => {
    setLocations(updatedLocations);
    updateGameDataOnServer('locations', updatedLocations);
  }
  
  const handleExpeditionsUpdate = (updatedExpeditions: Expedition[]) => {
    setExpeditions(updatedExpeditions);
    updateGameDataOnServer('expeditions', updatedExpeditions);
  };

  const handleEnemiesUpdate = (updatedEnemies: Enemy[]) => {
    setEnemies(updatedEnemies);
    updateGameDataOnServer('enemies', updatedEnemies);
  };
  
  const handleItemTemplatesUpdate = (updatedItemTemplates: ItemTemplate[]) => {
    setItemTemplates(updatedItemTemplates);
    updateGameDataOnServer('itemTemplates', updatedItemTemplates);
  };
  
  const handleQuestsUpdate = (updatedQuests: Quest[]) => {
    setQuests(updatedQuests);
    updateGameDataOnServer('quests', updatedQuests);
  };


  const handleDeleteUser = async (userId: number) => {
    if (window.confirm(t('admin.deleteConfirm'))) {
        try {
            await api.deleteUser(userId);
            setUsers(currentUsers => currentUsers.filter(u => u.id !== userId));
            // Also refresh ranking as the deleted user might be on it
            fetchRanking();
        } catch (e: any) {
            console.error("Failed to delete user:", e);
            alert(`Error: ${e.message}`);
            if (e.message.includes('Invalid token')) handleLogout();
        }
    }
  };

  const handleDeleteCharacter = async (userId: number) => {
    if (window.confirm(t('admin.deleteCharacterConfirm'))) {
        try {
            await api.deleteCharacter(userId);
            setAllCharacters(currentChars => currentChars.filter(c => c.user_id !== userId));
            // Also refresh ranking as the deleted character will be removed
            fetchRanking();
        } catch (e: any) {
            console.error("Failed to delete character:", e);
            alert(`Error: ${e.message}`);
            if (e.message.includes('Invalid token')) handleLogout();
        }
    }
  };

  const handleResetCharacterStats = async (userId: number) => {
    try {
        await api.resetCharacterStats(userId);
        alert(t('admin.resetStatsSuccess'));
    } catch (e: any) {
        console.error("Failed to reset character stats:", e);
        alert(`Error: ${e.message}`);
        if (e.message.includes('Invalid token')) handleLogout();
    }
  };

  const handleHealCharacter = async (userId: number) => {
    try {
        await api.healCharacter(userId);
        alert(t('admin.healSuccess'));
    } catch (e: any) {
        console.error("Failed to heal character:", e);
        alert(`Error: ${e.message}`);
        if (e.message.includes('Invalid token')) handleLogout();
    }
  };

  const handleSettingsUpdate = async (updatedSettings: GameSettings) => {
      try {
          await api.updateGameSettings(updatedSettings);
          setGameSettings(updatedSettings);
          setLanguage(updatedSettings.language);
      } catch(e: any) {
          console.error(e);
          if (e.message.includes('Invalid token')) handleLogout();
          alert('An error occurred while saving settings.');
      }
  };

    const handleResetAllPvpCooldowns = async () => {
        if (window.confirm(t('admin.pvp.resetCooldownsConfirm'))) {
            try {
                await api.resetAllPvpCooldowns();
                alert(t('admin.pvp.resetCooldownsSuccess'));
                fetchRanking();
            } catch (e: any) {
                console.error("Failed to reset PvP cooldowns:", e);
                alert(`Error: ${e.message}`);
            }
        }
    };

  const handleStartExpedition = (expeditionId: string) => {
    if (!playerCharacter || !displayedCharacter || displayedCharacter.activeExpedition) return;

    const expedition = expeditions.find(e => e.id === expeditionId);
    if (!expedition) return;

    const hasEnoughGold = playerCharacter.resources.gold >= expedition.goldCost;
    const hasEnoughEnergy = displayedCharacter.stats.currentEnergy >= expedition.energyCost;

    if (hasEnoughGold && hasEnoughEnergy) {
      const successfulSpawns: Enemy[] = [];
      expedition.enemies.forEach(expEnemy => {
          const enemyTemplate = enemies.find(e => e.id === expEnemy.enemyId);
          if (enemyTemplate && Math.random() * 100 < expEnemy.spawnChance) {
              // FIX: Assign a uniqueId instead of overwriting the template id
              successfulSpawns.push({ ...enemyTemplate, uniqueId: crypto.randomUUID() });
          }
      });

      let finalEnemies: Enemy[] = successfulSpawns;
      const maxEnemies = expedition.maxEnemies;

      if (maxEnemies && maxEnemies > 0 && successfulSpawns.length > maxEnemies) {
          // Fisher-Yates shuffle to randomly pick from the spawned enemies
          for (let i = successfulSpawns.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [successfulSpawns[i], successfulSpawns[j]] = [successfulSpawns[j], successfulSpawns[i]];
          }
          finalEnemies = successfulSpawns.slice(0, maxEnemies);
      }


      const updatedCharacter = {
        ...playerCharacter,
        resources: {
          ...playerCharacter.resources,
          gold: playerCharacter.resources.gold - expedition.goldCost,
        },
        stats: {
          ...playerCharacter.stats,
          currentEnergy: displayedCharacter.stats.currentEnergy - expedition.energyCost,
        },
        activeExpedition: {
          expeditionId: expedition.id,
          finishTime: Date.now() + expedition.duration * 1000,
          enemies: finalEnemies,
          combatLog: [],
          rewards: { gold: 0, experience: 0 },
        },
      };
      handleCharacterUpdate(updatedCharacter);
    } else {
        alert(t('expedition.lackResources'));
    }
  };

  const handleClaimExpeditionRewards = () => {
    if (!playerCharacter || !displayedCharacter || !displayedCharacter.activeExpedition || displayedCharacter.activeExpedition.finishTime > Date.now()) return;

    const { activeExpedition } = displayedCharacter;
    const expeditionDetails = expeditions.find(e => e.id === activeExpedition.expeditionId);
    if (!expeditionDetails) return;

    const combatLog: CombatLogEntry[] = [];
    let turn = 1;
    let totalGoldGained = 0;
    let totalExpGained = 0;
    let playerHealth = displayedCharacter.stats.currentHealth;
    let playerMana = displayedCharacter.stats.currentMana;
    let isVictory = true;
    const rewardBreakdown: RewardSource[] = [];
    const foundItems: ItemInstance[] = [];
    const essencesGained: Partial<Record<EssenceType, number>> = {};
    const enemiesDefeated: Record<string, number> = {};

    // Check for multi-attack weapon
    const mainHandItem = displayedCharacter.equipment[EquipmentSlot.MainHand] || displayedCharacter.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    const attacksPerRound = mainHandTemplate?.attacksPerRound || 1;

    for (const enemy of activeExpedition.enemies) {
      let enemyHealth = enemy.stats.maxHealth;
      let enemyMana = enemy.stats.maxMana || 0;
      let roundInThisFight = 1;

      combatLog.push({
          turn,
          attacker: displayedCharacter.name,
          defender: enemy.name,
          action: 'starts a fight with',
          playerHealth,
          playerMana,
          enemyHealth,
          enemyMana,
          playerStats: { ...displayedCharacter.stats, currentHealth: playerHealth, currentMana: playerMana },
          enemyStats: { ...enemy.stats },
          enemyDescription: enemy.description,
      });
      
      const playerAgility = displayedCharacter.stats.agility;
      const enemyAgility = enemy.stats.agility || 0;
      const agilityDifference = playerAgility - enemyAgility;
      const firstStrikeChance = 50 + agilityDifference * 2; // +2% chance for each point of agi advantage
      const clampedFirstStrikeChance = Math.max(10, Math.min(90, firstStrikeChance));

      const playerAttack = () => {
        for (let i = 0; i < attacksPerRound; i++) {
            if (enemyHealth <= 0) break;

            const manaCost = mainHandTemplate?.manaCost || 0;
            const hasEnoughMana = playerMana >= manaCost;
            const isMagicAttack = mainHandTemplate?.isMagical && hasEnoughMana;
            
            let playerDamage;
            let isPlayerCrit;
            let magicAttackType;

            if (isMagicAttack && mainHandTemplate) {
                playerMana -= manaCost;
                playerDamage = Math.floor(Math.random() * (displayedCharacter.stats.magicDamageMax - displayedCharacter.stats.magicDamageMin + 1)) + displayedCharacter.stats.magicDamageMin;
                magicAttackType = mainHandTemplate.magicAttackType;

            } else {
                 if (mainHandTemplate?.isMagical && !hasEnoughMana) {
                    combatLog.push({ turn, attacker: displayedCharacter.name, defender: enemy.name, action: 'notEnoughMana', playerHealth, playerMana, enemyHealth, enemyMana });
                    const baseDamageMin = mainHandTemplate.damageMin || 0;
                    const baseDamageMax = mainHandTemplate.damageMax || 0;
                    playerDamage = Math.floor(Math.random() * (baseDamageMax - baseDamageMin + 1)) + baseDamageMin;
                } else {
                    playerDamage = Math.floor(Math.random() * (displayedCharacter.stats.maxDamage - displayedCharacter.stats.minDamage + 1)) + displayedCharacter.stats.minDamage;
                }
            }

            isPlayerCrit = Math.random() * 100 < displayedCharacter.stats.critChance;
            if (isPlayerCrit) {
                playerDamage = Math.floor(playerDamage * (displayedCharacter.stats.critDamageModifier / 100));
            }
            
            if (displayedCharacter.race === Race.Orc && playerHealth < displayedCharacter.stats.maxHealth * 0.25) {
                playerDamage = Math.floor(playerDamage * 1.25);
            }

            let finalDamageDealt;
            if (isMagicAttack) {
                finalDamageDealt = playerDamage; // Magic damage ignores armor
            } else {
                const armorAfterPen = Math.max(0, enemy.stats.armor * (1 - (displayedCharacter.stats.armorPenetrationPercent / 100)) - displayedCharacter.stats.armorPenetrationFlat);
                finalDamageDealt = Math.max(0, playerDamage - armorAfterPen);
            }
            
            const newEnemyHealth = Math.max(0, enemyHealth - finalDamageDealt);
            const actualDamageDealt = enemyHealth - newEnemyHealth;

            // Life Steal & Mana Steal
            const healthGained = Math.min(displayedCharacter.stats.maxHealth - playerHealth, Math.floor(actualDamageDealt * (displayedCharacter.stats.lifeStealPercent / 100)) + displayedCharacter.stats.lifeStealFlat);
            if (healthGained > 0) playerHealth += healthGained;

            const manaGained = Math.min(displayedCharacter.stats.maxMana - playerMana, Math.floor(actualDamageDealt * (displayedCharacter.stats.manaStealPercent / 100)) + displayedCharacter.stats.manaStealFlat);
            if (manaGained > 0) playerMana += manaGained;
            
            combatLog.push({ turn, attacker: displayedCharacter.name, defender: enemy.name, damage: actualDamageDealt, playerHealth, playerMana, enemyHealth: newEnemyHealth, enemyMana, isCrit: isPlayerCrit, action: 'attacks', magicAttackType, weaponName: mainHandTemplate?.name, healthGained, manaGained });
            enemyHealth = newEnemyHealth;
        }
      };
      
      const enemyAttack = () => {
          const enemyAttacksPerTurn = enemy.stats.attacksPerTurn || 1;
          for (let i = 0; i < enemyAttacksPerTurn; i++) {
              if (playerHealth <= 0) break;
            
                let enemyDamage;
                let isEnemyCrit = false;
                let enemyMagicAttackType: MagicAttackType | undefined = undefined;
                let damageReducedAmount = 0;

                const attemptsMagicAttack = Math.random() * 100 < (enemy.stats.magicAttackChance || 0);
                const manaCost = enemy.stats.magicAttackManaCost || 0;
                const hasEnoughMana = enemyMana >= manaCost;

                if (displayedCharacter.race === Race.Gnome && Math.random() < 0.1) {
                    combatLog.push({ turn, attacker: enemy.name, defender: displayedCharacter.name, action: 'dodge', playerHealth, playerMana, enemyHealth, enemyMana, isDodge: true });
                    continue; // Skips the rest of the attack logic for this iteration
                }

                if (attemptsMagicAttack && hasEnoughMana && enemy.stats.magicAttackType) {
                    enemyMagicAttackType = enemy.stats.magicAttackType;
                    enemyMana -= manaCost;
                    const minDmg = enemy.stats.magicDamageMin || 0;
                    const maxDmg = enemy.stats.magicDamageMax || minDmg;
                    enemyDamage = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;
                    isEnemyCrit = Math.random() * 100 < enemy.stats.critChance;
                    if (isEnemyCrit) enemyDamage = Math.floor(enemyDamage * 2);

                    if (displayedCharacter.race === Race.Dwarf && playerHealth < displayedCharacter.stats.maxHealth * 0.5) {
                        const originalDamage = enemyDamage;
                        enemyDamage = Math.floor(enemyDamage * 0.8);
                        damageReducedAmount = originalDamage - enemyDamage;
                    }
                    
                    const newPlayerHealth = Math.max(0, playerHealth - enemyDamage);
                    combatLog.push({ turn, attacker: enemy.name, defender: displayedCharacter.name, damage: enemyDamage, playerHealth: newPlayerHealth, playerMana, enemyHealth, enemyMana, isCrit: isEnemyCrit, action: 'attacks', magicAttackType: enemyMagicAttackType, damageReduced: damageReducedAmount > 0 ? damageReducedAmount : undefined });
                    playerHealth = newPlayerHealth;

                } else {
                    enemyDamage = Math.floor(Math.random() * (enemy.stats.maxDamage - enemy.stats.minDamage + 1)) + enemy.stats.minDamage;
                    isEnemyCrit = Math.random() * 100 < enemy.stats.critChance;
                    if (isEnemyCrit) enemyDamage = Math.floor(enemyDamage * 2);

                    let damageAfterReduction = enemyDamage;
                    if (displayedCharacter.race === Race.Dwarf && playerHealth < displayedCharacter.stats.maxHealth * 0.5) {
                        damageAfterReduction = Math.floor(enemyDamage * 0.8);
                        damageReducedAmount = enemyDamage - damageAfterReduction;
                    }
                    
                    const finalDamageTaken = Math.max(0, damageAfterReduction - displayedCharacter.stats.armor);
                    const newPlayerHealth = Math.max(0, playerHealth - finalDamageTaken);
                    combatLog.push({ turn, attacker: enemy.name, defender: displayedCharacter.name, damage: finalDamageTaken, playerHealth: newPlayerHealth, playerMana, enemyHealth, enemyMana, isCrit: isEnemyCrit, action: 'attacks', damageReduced: damageReducedAmount > 0 ? damageReducedAmount : undefined });
                    playerHealth = newPlayerHealth;
                }
            }
      };


      while(playerHealth > 0 && enemyHealth > 0) {
        // --- Mana Regeneration Phase ---
        const playerManaRegained = displayedCharacter.stats.manaRegen;
        const oldPlayerMana = playerMana;
        playerMana = Math.min(displayedCharacter.stats.maxMana, playerMana + playerManaRegained);

        if (playerManaRegained > 0) {
            const actualManaGained = playerMana - oldPlayerMana;
            if (actualManaGained > 0) {
                combatLog.push({
                    turn,
                    attacker: displayedCharacter.name,
                    defender: '',
                    action: 'manaRegen',
                    manaGained: actualManaGained,
                    playerHealth,
                    playerMana,
                    enemyHealth,
                    enemyMana,
                });
            }
        }
        
        const enemyManaRegained = enemy.stats.manaRegen || 0;
        if (enemyManaRegained > 0) {
            enemyMana = Math.min(enemy.stats.maxMana || 0, enemyMana + enemyManaRegained);
        }

        // --- Attack Phase ---
        const playerGoesFirst = (displayedCharacter.race === Race.Elf && roundInThisFight === 1) || Math.random() * 100 < clampedFirstStrikeChance;
        
        if (playerGoesFirst) {
          playerAttack();
          if (enemyHealth > 0) {
            enemyAttack();
          }
        } else {
           enemyAttack();
          if (playerHealth > 0) {
            playerAttack();
          }
        }
        turn++;
        roundInThisFight++;
      }

      if (playerHealth <= 0) {
        isVictory = false;
        break;
      } else {
        // --- Process Enemy Rewards ---
        // FIX: Use enemy.id (template ID) for tracking defeated enemies for quests.
        enemiesDefeated[enemy.id] = (enemiesDefeated[enemy.id] || 0) + 1;
        let goldFromEnemy = Math.floor(Math.random() * (enemy.rewards.maxGold - enemy.rewards.minGold + 1)) + enemy.rewards.minGold;
        if (displayedCharacter.race === Race.Gnome) {
            goldFromEnemy = Math.floor(goldFromEnemy * 1.2);
        }
        totalGoldGained += goldFromEnemy;
        
        const minExp = enemy.rewards.minExperience ?? (enemy.rewards as any).experience ?? 0;
        const maxExp = enemy.rewards.maxExperience ?? (enemy.rewards as any).experience ?? 0;
        const finalMaxExp = Math.max(minExp, maxExp);
        let expFromEnemy = Math.floor(Math.random() * (finalMaxExp - minExp + 1)) + minExp;
        if (displayedCharacter.race === Race.Human) {
            expFromEnemy = Math.floor(expFromEnemy * 1.1);
        }
        totalExpGained += expFromEnemy;
        
        rewardBreakdown.push({
            source: t('expedition.enemyDefeated', { enemyName: enemy.name }),
            gold: goldFromEnemy,
            experience: expFromEnemy,
        });

        // --- Process Enemy Loot Table ---
        if (enemy.lootTable) {
            enemy.lootTable.forEach(drop => {
                if (Math.random() * 100 < drop.chance) {
                    foundItems.push({
                        uniqueId: crypto.randomUUID(),
                        templateId: drop.templateId,
                    });
                }
            });
        }

        // --- Process Enemy Resource Loot Table ---
        if (enemy.resourceLootTable) {
            enemy.resourceLootTable.forEach(drop => {
                if (Math.random() * 100 < drop.chance) {
                    const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    essencesGained[drop.resource] = (essencesGained[drop.resource] || 0) + amount;
                }
            });
        }
      }
    }
    
    // Process Quest Progress
    const updatedQuestProgress: PlayerQuestProgress[] = JSON.parse(JSON.stringify(playerCharacter.questProgress));
    if (isVictory) {
        for (const enemyId in enemiesDefeated) { // enemyId is now the template ID
            const killCount = enemiesDefeated[enemyId];
            const relevantQuests = quests.filter(q => 
                playerCharacter.acceptedQuests.includes(q.id) &&
                q.objective.type === QuestType.Kill && 
                q.objective.targetId === enemyId &&
                q.locationIds.includes(playerCharacter.currentLocationId)
            );

            for (const quest of relevantQuests) {
                let progress = updatedQuestProgress.find(p => p.questId === quest.id);
                if (!progress) {
                    progress = { questId: quest.id, progress: 0, completions: 0 };
                    updatedQuestProgress.push(progress);
                }

                if (quest.repeatable === 0 || progress.completions < quest.repeatable) {
                    progress.progress = Math.min(quest.objective.amount, progress.progress + killCount);
                }
            }
        }
    }
    
    if (isVictory) {
        // --- Process Expedition Rewards ---
        const minBaseGold = expeditionDetails.minBaseGoldReward ?? (expeditionDetails as any).baseGoldReward ?? 0;
        const maxBaseGold = expeditionDetails.maxBaseGoldReward ?? minBaseGold;
        const finalMaxBaseGold = Math.max(minBaseGold, maxBaseGold);
        let baseGold = Math.floor(Math.random() * (finalMaxBaseGold - minBaseGold + 1)) + minBaseGold;
        if (displayedCharacter.race === Race.Gnome) {
            baseGold = Math.floor(baseGold * 1.2);
        }
        totalGoldGained += baseGold;

        const minBaseExp = expeditionDetails.minBaseExperienceReward ?? (expeditionDetails as any).baseExperienceReward ?? 0;
        const maxBaseExp = expeditionDetails.maxBaseExperienceReward ?? (expeditionDetails as any).baseExperienceReward ?? 0;
        const finalMaxBaseExp = Math.max(minBaseExp, maxBaseExp);
        let baseExp = Math.floor(Math.random() * (finalMaxBaseExp - minBaseExp + 1)) + minBaseExp;
        if (displayedCharacter.race === Race.Human) {
            baseExp = Math.floor(baseExp * 1.1);
        }
        totalExpGained += baseExp;

        if (baseGold > 0 || baseExp > 0) {
            rewardBreakdown.push({
                source: t('expedition.baseReward'),
                gold: baseGold,
                experience: baseExp,
            });
        }
        
        // --- Process Expedition Loot Table ---
        if (expeditionDetails.lootTable) {
            expeditionDetails.lootTable.forEach(drop => {
                if (Math.random() * 100 < drop.chance) {
                    foundItems.push({
                        uniqueId: crypto.randomUUID(),
                        templateId: drop.templateId,
                    });
                }
            });
        }
        
         // --- Process Expedition Resource Loot Table ---
        if (expeditionDetails.resourceLootTable) {
            expeditionDetails.resourceLootTable.forEach(drop => {
                if (Math.random() * 100 < drop.chance) {
                    const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    essencesGained[drop.resource] = (essencesGained[drop.resource] || 0) + amount;
                }
            });
        }
    }

    const updatedResources = { ...playerCharacter.resources };
    updatedResources.gold += totalGoldGained;
    for (const key in essencesGained) {
        const essenceKey = key as EssenceType;
        updatedResources[essenceKey] = (updatedResources[essenceKey] || 0) + (essencesGained[essenceKey] || 0);
    }

    const updatedCharacter = {
      ...playerCharacter,
      resources: updatedResources,
      stats: {
        ...playerCharacter.stats,
        currentHealth: isVictory ? playerHealth : 1,
        currentMana: displayedCharacter.stats.maxMana,
      },
      experience: playerCharacter.experience + totalExpGained,
      inventory: [...playerCharacter.inventory, ...foundItems],
      activeExpedition: null,
      questProgress: updatedQuestProgress,
    };
    handleCharacterUpdate(updatedCharacter);
    setLastExpeditionReward({ 
        rewardBreakdown, 
        totalGold: totalGoldGained, 
        totalExperience: totalExpGained, 
        combatLog, 
        isVictory,
        itemsFound: foundItems,
        essencesFound: essencesGained,
    });
  };
  
  const handleClearLastExpeditionReward = () => {
    setLastExpeditionReward(null);
  };
  
  const handleToggleResting = () => {
    if (!playerCharacter) return;
    const isNowResting = !playerCharacter.isResting;
    
    const updatedCharacter = {
        ...playerCharacter,
        isResting: isNowResting,
        restStartHealth: isNowResting ? displayedCharacter!.stats.currentHealth : playerCharacter.restStartHealth,
    };
    
    // Set local state immediately for responsiveness
    setPlayerCharacter(updatedCharacter);
    
    // Only save to the server when resting stops to avoid frequent writes.
    if (!isNowResting) {
        updateCharacterOnServer(updatedCharacter);
    }
  };

    // Travel completion logic
    useEffect(() => {
        if (!playerCharacter?.activeTravel) return;

        const finishTravel = () => {
            // Operate on the most recent version of the base character
            setPlayerCharacter(currentChar => {
                if (!currentChar?.activeTravel) return currentChar;

                const updatedChar = {
                    ...currentChar,
                    currentLocationId: currentChar.activeTravel.destinationLocationId,
                    activeTravel: null,
                };
                handleCharacterUpdate(updatedChar);
                return updatedChar;
            });
        };

        const timeLeft = playerCharacter.activeTravel.finishTime - Date.now();

        if (timeLeft <= 0) {
            finishTravel();
        } else {
            const timerId = setTimeout(finishTravel, timeLeft);
            return () => clearTimeout(timerId);
        }
    }, [playerCharacter?.activeTravel, handleCharacterUpdate]);


  const calculateCampUpgradeCost = (currentLevel: number): number => {
    if (currentLevel >= 10) return Infinity;
    const baseCost = 500;
    const factor = 1.8;
    return Math.floor(baseCost * Math.pow(factor, currentLevel - 1));
  };

  const handleUpgradeCamp = () => {
    if (!playerCharacter || playerCharacter.camp.level >= 10) return;
    const cost = calculateCampUpgradeCost(playerCharacter.camp.level);

    if (playerCharacter.resources.gold >= cost) {
      const updatedCharacter = {
        ...playerCharacter,
        resources: {
          ...playerCharacter.resources,
          gold: playerCharacter.resources.gold - cost,
        },
        camp: {
          ...playerCharacter.camp,
          level: playerCharacter.camp.level + 1,
        }
      };
      handleCharacterUpdate(updatedCharacter);
    } else {
      alert(t('camp.notEnoughGold'));
    }
  };
  
  const handleEquipItem = (itemInstance: ItemInstance) => {
    if (!playerCharacter) return;
    const template = itemTemplates.find(t => t.id === itemInstance.templateId);
    if (!template || template.slot === 'consumable') return;

    if (playerCharacter.level < template.requiredLevel) {
        alert(t('equipment.levelTooLow'));
        return;
    }
    
    const mainHandItem = playerCharacter.equipment[EquipmentSlot.MainHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    if (template.slot === EquipmentSlot.OffHand && mainHandTemplate?.slot === EquipmentSlot.TwoHand) {
        alert(t('equipment.twoHandedWeaponEquipped'));
        return;
    }

    let newInventory = playerCharacter.inventory.filter(i => i.uniqueId !== itemInstance.uniqueId);
    let newEquipment = { ...playerCharacter.equipment };

    if (template.slot === 'ring') {
        if (newEquipment[EquipmentSlot.Ring1] === null) {
            newEquipment[EquipmentSlot.Ring1] = itemInstance;
        } else if (newEquipment[EquipmentSlot.Ring2] === null) {
            newEquipment[EquipmentSlot.Ring2] = itemInstance;
        } else {
            alert(t('equipment.ringSlotsFull'));
            return; // Abort equipping
        }
    } else if (template.slot === EquipmentSlot.TwoHand) {
        const mainHand = newEquipment[EquipmentSlot.MainHand];
        const offHand = newEquipment[EquipmentSlot.OffHand];
        if (mainHand) newInventory.push(mainHand);
        if (offHand) newInventory.push(offHand);

        newEquipment[EquipmentSlot.MainHand] = null;
        newEquipment[EquipmentSlot.OffHand] = null;
        newEquipment[EquipmentSlot.TwoHand] = itemInstance;
    } else {
        const slotToEquip = template.slot as EquipmentSlot;
        
        if (slotToEquip === EquipmentSlot.MainHand || slotToEquip === EquipmentSlot.OffHand) {
            const twoHanded = newEquipment[EquipmentSlot.TwoHand];
            if (twoHanded) {
                newInventory.push(twoHanded);
                newEquipment[EquipmentSlot.TwoHand] = null;
            }
        }
        
        const currentlyEquipped = newEquipment[slotToEquip];
        if (currentlyEquipped) {
            newInventory.push(currentlyEquipped);
        }
        newEquipment[slotToEquip] = itemInstance;
    }
    
    handleCharacterUpdate({ ...playerCharacter, equipment: newEquipment, inventory: newInventory });
};


  const handleUnequipItem = (itemInstance: ItemInstance, fromSlot: EquipmentSlot) => {
    if (!playerCharacter) return;
    
    const MAX_INVENTORY_SIZE = 40;
    if (playerCharacter.inventory.length >= MAX_INVENTORY_SIZE) {
        alert(t('equipment.backpackFull'));
        return;
    }
    
    const newEquipment = { ...playerCharacter.equipment, [fromSlot]: null };
    const newInventory = [...playerCharacter.inventory, itemInstance];
    
    handleCharacterUpdate({ ...playerCharacter, equipment: newEquipment, inventory: newInventory });
  };
  
    const handleBuyItem = (item: ItemInstance, cost: number) => {
        if (!playerCharacter) return;
        
        const MAX_INVENTORY_SIZE = 40;
        if (playerCharacter.inventory.length >= MAX_INVENTORY_SIZE) {
            alert(t('trader.inventoryFull'));
            return;
        }

        if (playerCharacter.resources.gold < cost) {
            alert(t('trader.notEnoughGold'));
            return;
        }

        const updatedCharacter = {
            ...playerCharacter,
            resources: {
                ...playerCharacter.resources,
                gold: playerCharacter.resources.gold - cost,
            },
            inventory: [...playerCharacter.inventory, item],
        };

        handleCharacterUpdate(updatedCharacter);

        const newTraderInventory = traderInventory.filter(i => i.uniqueId !== item.uniqueId);
        setTraderInventory(newTraderInventory);

        try {
            localStorage.setItem('traderInventory', JSON.stringify({
                inventory: newTraderInventory,
                refreshHour: traderLastRefreshHour.current,
            }));
        } catch (e) {
            console.error("Failed to save updated trader inventory to localStorage after purchase", e);
        }
    };

    const handleSellItem = (item: ItemInstance, value: number) => {
        if (!playerCharacter) return;
        
        const updatedCharacter = {
            ...playerCharacter,
            resources: {
                ...playerCharacter.resources,
                gold: playerCharacter.resources.gold + value,
            },
            inventory: playerCharacter.inventory.filter(i => i.uniqueId !== item.uniqueId),
        };
        
        handleCharacterUpdate(updatedCharacter);
    };

    const handleForceTraderRefresh = useCallback(() => {
        if (window.confirm(t('admin.traderRefreshConfirm'))) {
            console.log("Forcing trader inventory refresh via admin panel...");
            const newInventory = generateTraderInventory(itemTemplates, gameSettings);
            const currentHour = new Date().getHours();
            
            setTraderInventory(newInventory);
            traderLastRefreshHour.current = currentHour; // Sync the ref
            
            try {
                localStorage.setItem('traderInventory', JSON.stringify({
                    inventory: newInventory,
                    refreshHour: currentHour,
                }));
            } catch (e) {
                console.error("Failed to save force-refreshed trader inventory to localStorage", e);
            }
            alert(t('admin.traderRefreshSuccess'));
        }
    }, [itemTemplates, gameSettings, t]);

    const handleDisenchantItem = (item: ItemInstance): { success: boolean; amount?: number; essenceType?: EssenceType } => {
        if (!playerCharacter) return { success: false };

        const template = itemTemplates.find(t => t.id === item.templateId);
        if (!template) return { success: false };

        const cost = Math.round(template.value * 0.1);
        if (playerCharacter.resources.gold < cost) {
            alert(t('blacksmith.notEnoughGold'));
            return { success: false };
        }

        let essenceType: EssenceType;
        let amount = 0;

        switch (template.rarity) {
            case ItemRarity.Common:
                essenceType = EssenceType.Common;
                amount = Math.floor(Math.random() * 4) + 1; // 1-4
                break;
            case ItemRarity.Uncommon:
                essenceType = EssenceType.Uncommon;
                amount = Math.floor(Math.random() * 2) + 1; // 1-2
                break;
            case ItemRarity.Rare:
                essenceType = EssenceType.Rare;
                amount = Math.floor(Math.random() * 2) + 1; // 1-2
                break;
            case ItemRarity.Epic:
                essenceType = EssenceType.Epic;
                amount = 1;
                break;
            case ItemRarity.Legendary:
                essenceType = EssenceType.Legendary;
                amount = Math.random() < 0.5 ? 1 : 0;
                break;
            default:
                return { success: false };
        }

        const updatedCharacter = { ...playerCharacter };
        updatedCharacter.resources = { ...updatedCharacter.resources };
        updatedCharacter.resources.gold -= cost;
        if(amount > 0) {
            updatedCharacter.resources[essenceType] = (updatedCharacter.resources[essenceType] || 0) + amount;
        }
        updatedCharacter.inventory = updatedCharacter.inventory.filter(i => i.uniqueId !== item.uniqueId);

        handleCharacterUpdate(updatedCharacter);

        if (amount > 0) {
            return { success: true, amount, essenceType };
        } else {
            return { success: false };
        }
    };
    
    const handleUpgradeItem = (item: ItemInstance): { success: boolean; messageKey: string; level?: number } => {
        if (!playerCharacter) return { success: false, messageKey: '' };

        const template = itemTemplates.find(t => t.id === item.templateId);
        if (!template) return { success: false, messageKey: '' };
        
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
        const essenceCost = 1;
        
        let essenceType: EssenceType;
        switch (template.rarity) {
            case ItemRarity.Common: essenceType = EssenceType.Common; break;
            case ItemRarity.Uncommon: essenceType = EssenceType.Uncommon; break;
            case ItemRarity.Rare: essenceType = EssenceType.Rare; break;
            case ItemRarity.Epic: essenceType = EssenceType.Epic; break;
            case ItemRarity.Legendary: essenceType = EssenceType.Legendary; break;
            default: return { success: false, messageKey: '' };
        }

        if (playerCharacter.resources.gold < goldCost) {
            return { success: false, messageKey: 'blacksmith.notEnoughGold' };
        }
        if ((playerCharacter.resources[essenceType] || 0) < essenceCost) {
            return { success: false, messageKey: 'blacksmith.notEnoughEssence' };
        }
        
        const successChance = Math.max(10, 100 - (currentLevel * 10));
        const isSuccess = Math.random() * 100 < successChance;
        
        let updatedCharacter = { ...playerCharacter };
        updatedCharacter.resources = { ...updatedCharacter.resources };
        
        updatedCharacter.resources.gold -= goldCost;
        updatedCharacter.resources[essenceType] -= essenceCost;
        
        if (isSuccess) {
            const findAndUpgrade = (i: ItemInstance) => i.uniqueId === item.uniqueId ? { ...i, upgradeLevel: nextLevel } : i;
            updatedCharacter.inventory = updatedCharacter.inventory.map(findAndUpgrade);
            // FIX: Replaced a problematic `Object.entries().reduce()` with a type-safe `for...in` loop to avoid TypeScript inference issues with equipped items.
            const newEquipment = { ...updatedCharacter.equipment };
            for (const key in newEquipment) {
                const slot = key as EquipmentSlot;
                const equippedItem = newEquipment[slot];
                if (equippedItem && equippedItem.uniqueId === item.uniqueId) {
                    newEquipment[slot] = findAndUpgrade(equippedItem);
                }
            }
            updatedCharacter.equipment = newEquipment;
        } else {
            // Destroy the item
            updatedCharacter.inventory = updatedCharacter.inventory.filter(i => i.uniqueId !== item.uniqueId);
            // FIX: Replaced a problematic `Object.entries().reduce()` with a type-safe `for...in` loop to avoid TypeScript inference issues when checking the destroyed item.
            const newEquipment = { ...updatedCharacter.equipment };
            for (const key in newEquipment) {
                const slot = key as EquipmentSlot;
                const equippedItem = newEquipment[slot];
                if (equippedItem?.uniqueId === item.uniqueId) {
                    newEquipment[slot] = null;
                }
            }
            updatedCharacter.equipment = newEquipment;
        }

        handleCharacterUpdate(updatedCharacter);
        
        if (isSuccess) {
            return { success: true, messageKey: 'blacksmith.upgrade.upgradeSuccess', level: nextLevel };
        } else {
            return { success: false, messageKey: 'blacksmith.upgrade.upgradeFailure' };
        }
    };
    
    const handleAttackPlayer = async (defenderId: number) => {
        if (!playerCharacter) return;

        const defender = ranking.find(p => p.id === defenderId);
        if (!defender) return;
        
        if (!window.confirm(t('pvp.attacking', { playerName: defender.name }))) {
            return;
        }
        
        try {
            const result = await api.attackPlayer(defenderId);
            setActivePvpResult(result);
            
            // Optimistically update player character
            setPlayerCharacter(currentChar => {
                if (!currentChar) return null;
                const updatedChar = { ...currentChar };
                updatedChar.stats.currentEnergy -= 3;
                if (result.isVictory) {
                    updatedChar.resources.gold += result.gold;
                    updatedChar.experience += result.experience;
                    updatedChar.pvpWins = (updatedChar.pvpWins || 0) + 1;
                } else {
                    updatedChar.resources.gold -= result.gold;
                    updatedChar.pvpLosses = (updatedChar.pvpLosses || 0) + 1;
                }
                return updatedChar;
            });
            
            fetchRanking(); // Refresh ranking to show new stats and protection
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDeleteMessage = async (messageId: number) => {
        try {
            await api.deleteMessage(messageId);
            setMessages(currentMessages => currentMessages.filter(m => m.id !== messageId));
        } catch (e: any) {
            console.error("Failed to delete message:", e);
            alert(`Error: ${e.message}`);
        }
    };

    const handleMarkMessageAsRead = async (messageId: number) => {
        try {
            await api.markMessageAsRead(messageId);
            setMessages(currentMessages => currentMessages.map(m => 
                m.id === messageId ? { ...m, is_read: true } : m
            ));
        } catch (e: any) {
            console.error("Failed to mark message as read:", e);
        }
    };

    const handleAcceptQuest = (questId: string) => {
        if (!playerCharacter) return;
        if (playerCharacter.acceptedQuests.includes(questId)) return;

        const updatedChar = {
            ...playerCharacter,
            acceptedQuests: [...playerCharacter.acceptedQuests, questId]
        };
        handleCharacterUpdate(updatedChar);
    };

    const handleCompleteQuest = (questId: string) => {
        if (!playerCharacter) return;
        
        const quest = quests.find(q => q.id === questId);
        if (!quest) return;

        let updatedChar = { ...playerCharacter };
        
        // 1. Deduct costs
        if (quest.objective.type === QuestType.Gather) {
            let itemsToRemove = quest.objective.amount;
            updatedChar.inventory = updatedChar.inventory.filter(item => {
                if (item.templateId === quest.objective.targetId && itemsToRemove > 0) {
                    itemsToRemove--;
                    return false;
                }
                return true;
            });
        } else if (quest.objective.type === QuestType.PayGold) {
            updatedChar.resources.gold -= quest.objective.amount;
        } else if (quest.objective.type === QuestType.GatherResource && quest.objective.targetId) {
            const resourceKey = quest.objective.targetId as EssenceType;
            updatedChar.resources[resourceKey] = (updatedChar.resources[resourceKey] || 0) - quest.objective.amount;
        }

        // 2. Add rewards
        updatedChar.resources.gold += quest.rewards.gold;
        updatedChar.experience += quest.rewards.experience;
        
        if (quest.rewards.itemRewards) {
            quest.rewards.itemRewards.forEach(reward => {
                for (let i = 0; i < reward.quantity; i++) {
                    updatedChar.inventory.push({
                        uniqueId: crypto.randomUUID(),
                        templateId: reward.templateId,
                    });
                }
            });
        }
        // FIX: Add processing for chance-based loot tables from quests.
        if (quest.rewards.lootTable) {
            quest.rewards.lootTable.forEach(drop => {
                if (Math.random() * 100 < drop.chance) {
                    updatedChar.inventory.push({
                        uniqueId: crypto.randomUUID(),
                        templateId: drop.templateId,
                    });
                }
            });
        }
        if (quest.rewards.resourceRewards) {
            quest.rewards.resourceRewards.forEach(reward => {
                const resourceKey = reward.resource as EssenceType;
                updatedChar.resources[resourceKey] = (updatedChar.resources[resourceKey] || 0) + reward.quantity;
            });
        }
        
        // 3. Update quest progress
        let progress = updatedChar.questProgress.find(p => p.questId === questId);
        if (progress) {
            progress.completions += 1;
            if (quest.repeatable === 0 || progress.completions < quest.repeatable) {
                progress.progress = 0; // Reset for next completion
            } else {
                updatedChar.acceptedQuests = updatedChar.acceptedQuests.filter(id => id !== questId);
            }
        } else {
             const newProgress = { questId: questId, progress: 0, completions: 1 };
             updatedChar.questProgress.push(newProgress);
             if (quest.repeatable !== 0 && newProgress.completions >= quest.repeatable) {
                updatedChar.acceptedQuests = updatedChar.acceptedQuests.filter(id => id !== questId);
             }
        }
        
        alert(t('quests.questCompleted'));
        handleCharacterUpdate(updatedChar);
    };


  const currentLocation = locations.find(l => l.id === playerCharacter?.currentLocationId);
  
  const renderTabContent = () => {
    if (!displayedCharacter || !currentLocation) {
        return (
            <div className="flex justify-center items-center h-full">
                <p className="text-xl text-gray-500">{t('loading')}</p>
            </div>
        );
    }

    switch (activeTab) {
      case Tab.Statistics:
        return <Statistics 
                    character={displayedCharacter} 
                    baseCharacter={playerCharacter!} 
                    onCharacterUpdate={handleCharacterUpdate}
                    calculateDerivedStats={calculateDerivedStats}
                />;
      case Tab.Equipment:
        return <Equipment 
                    character={displayedCharacter} 
                    itemTemplates={itemTemplates}
                    onEquipItem={handleEquipItem}
                    onUnequipItem={handleUnequipItem}
                />;
      case Tab.Expedition:
        return <ExpeditionComponent 
                    character={displayedCharacter}
                    onCharacterUpdate={handleCharacterUpdate}
                    expeditions={expeditions}
                    enemies={enemies}
                    currentLocation={currentLocation}
                    onStartExpedition={handleStartExpedition}
                    onClaimRewards={handleClaimExpeditionRewards}
                    lastReward={lastExpeditionReward}
                    onClearLastReward={handleClearLastExpeditionReward}
                    itemTemplates={itemTemplates}
                />;
       case Tab.Trader:
        return <Trader
                    character={displayedCharacter}
                    itemTemplates={itemTemplates}
                    settings={gameSettings}
                    traderInventory={traderInventory}
                    onBuyItem={handleBuyItem}
                    onSellItem={handleSellItem}
                />;
      case Tab.Blacksmith:
        return <Blacksmith
                    character={displayedCharacter}
                    itemTemplates={itemTemplates}
                    onDisenchantItem={handleDisenchantItem}
                    onUpgradeItem={handleUpgradeItem}
                />;
      case Tab.Camp:
        return <Camp 
                  character={displayedCharacter}
                  onToggleResting={handleToggleResting}
                  onUpgradeCamp={handleUpgradeCamp}
                  getUpgradeCost={calculateCampUpgradeCost}
               />;
      case Tab.Location:
        return <LocationComponent 
                    playerCharacter={displayedCharacter} 
                    onCharacterUpdate={handleCharacterUpdate}
                    locations={locations}
                />;
      case Tab.Quests:
        return <Quests
                    character={displayedCharacter}
                    quests={quests}
                    enemies={enemies}
                    itemTemplates={itemTemplates}
                    onAcceptQuest={handleAcceptQuest}
                    onCompleteQuest={handleCompleteQuest}
                />;
      case Tab.Resources:
        return <Resources character={displayedCharacter} />;
      case Tab.Ranking:
        return <Ranking
                    ranking={ranking}
                    currentPlayer={displayedCharacter}
                    onRefresh={fetchRanking}
                    isLoading={isRankingLoading}
                    onAttack={handleAttackPlayer}
                    onComposeMessage={handleOpenCompose}
               />;
      case Tab.Messages:
          return <Messages
                    messages={messages}
                    onDeleteMessage={handleDeleteMessage}
                    onMarkAsRead={handleMarkMessageAsRead}
                    onCompose={handleOpenCompose}
                    itemTemplates={itemTemplates}
                    currentPlayer={displayedCharacter}
                  />;
      case Tab.Tavern:
        return <Tavern
                    character={displayedCharacter}
                    messages={tavernMessages}
                    onSendMessage={handleSendTavernMessage}
                />;
      case Tab.Admin:
        return <AdminPanel 
                    locations={locations} 
                    onLocationsUpdate={handleLocationsUpdate}
                    expeditions={expeditions}
                    onExpeditionsUpdate={handleExpeditionsUpdate}
                    enemies={enemies}
                    onEnemiesUpdate={handleEnemiesUpdate}
                    itemTemplates={itemTemplates}
                    onItemTemplatesUpdate={handleItemTemplatesUpdate}
                    quests={quests}
                    onQuestsUpdate={handleQuestsUpdate}
                    settings={gameSettings}
                    onSettingsUpdate={handleSettingsUpdate}
                    users={users}
                    onDeleteUser={handleDeleteUser}
                    allCharacters={allCharacters}
                    onDeleteCharacter={handleDeleteCharacter}
                    onResetCharacterStats={handleResetCharacterStats}
                    onHealCharacter={handleHealCharacter}
                    onForceTraderRefresh={handleForceTraderRefresh}
                    onResetAllPvpCooldowns={handleResetAllPvpCooldowns}
                />;
      default:
        return <Statistics 
                    character={displayedCharacter} 
                    baseCharacter={playerCharacter!} 
                    onCharacterUpdate={handleCharacterUpdate}
                    calculateDerivedStats={calculateDerivedStats}
               />;
    }
  };
  
  const renderAppContent = () => {
    if (isLoading) {
        return (
            <div className="flex min-h-screen justify-center items-center">
                <p className="text-2xl text-white animate-pulse">{t('loading')}</p>
            </div>
        );
    }

    if (!token) {
        return <Auth onLoginSuccess={handleLoginSuccess} />;
    }

    if (error) {
        return (
            <div className="flex min-h-screen justify-center items-center text-center">
                <div>
                    <h2 className="text-3xl text-red-500 font-bold mb-4">{t('error.title')}</h2>
                    <p className="text-lg text-gray-300">{error}</p>
                    <p className="text-gray-400 mt-2">{t('error.refresh')}</p>
                    <button onClick={() => handleLogout()} className="mt-4 px-4 py-2 bg-indigo-600 rounded">{t('error.logout')}</button>
                </div>
            </div>
        );
    }

    if (locationError) {
        return (
            <div className="flex min-h-screen justify-center items-center text-center">
                <div>
                    <h2 className="text-3xl text-red-500 font-bold mb-4">Błąd Lokacji</h2>
                    <p className="text-lg text-gray-300">Twoja postać znajduje się w nieprawidłowej lub niedostępnej lokacji.</p>
                    <button onClick={handleResetLocation} className="mt-4 px-4 py-2 bg-indigo-600 rounded">Powrót do Lokacji Startowej</button>
                </div>
            </div>
        );
    }

    if (!playerCharacter || !displayedCharacter) {
        return <CharacterCreation onCharacterCreate={handleCharacterCreation} />;
    }
    
    const hasUnreadMessages = messages.some(m => !m.is_read);
    
    return (
      <div className="flex min-h-screen font-sans">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          playerCharacter={displayedCharacter}
          currentLocation={currentLocation}
          onLogout={handleLogout}
          hasUnreadMessages={hasUnreadMessages}
        />
        <main className="flex-1 p-8 lg:p-12 overflow-y-auto">
          {renderTabContent()}
        </main>
        {activePvpResult && (
             <ExpeditionSummaryModal
                reward={{
                    combatLog: activePvpResult.combatLog,
                    isVictory: activePvpResult.isVictory,
                    totalGold: activePvpResult.gold,
                    totalExperience: activePvpResult.experience,
                    rewardBreakdown: [],
                    itemsFound: [],
                    essencesFound: {}
                }}
                onClose={() => setActivePvpResult(null)}
                characterName={activePvpResult.attacker.name}
                itemTemplates={itemTemplates}
                isPvp={true}
                pvpData={{
                    attacker: activePvpResult.attacker,
                    defender: activePvpResult.defender,
                }}
            />
        )}
        {isComposing && (
            <ComposeMessageModal
                allCharacterNames={allCharacterNames}
                onClose={handleCloseCompose}
                onSendMessage={handleSendMessage}
                initialRecipient={composeInitialData?.recipientName}
                initialSubject={composeInitialData?.subject}
            />
        )}
      </div>
    );
  };
  
  return (
    <LanguageContext.Provider value={{ lang: language, t }}>
        {renderAppContent()}
    </LanguageContext.Provider>
  );
};

export default App;
