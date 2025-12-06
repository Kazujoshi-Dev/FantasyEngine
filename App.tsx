
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Auth } from './components/Auth';
import { CharacterCreation } from './components/CharacterCreation';
import { Sidebar, NewsModal } from './components/Sidebar';
import { Statistics } from './components/Statistics';
import { Equipment } from './components/Equipment';
import { ExpeditionComponent } from './components/Expedition';
import { ExpeditionSummaryModal } from './components/combat/CombatSummary';
import { Camp } from './components/Camp';
import { Location } from './components/Location';
import { Resources } from './components/Resources';
import { Ranking } from './components/Ranking';
import { AdminPanel } from './components/AdminPanel';
import { Trader } from './components/Trader';
import { Blacksmith } from './components/Blacksmith';
import { Messages } from './components/Messages';
import { Quests } from './components/Quests';
import { Tavern } from './components/Tavern';
import { Market } from './components/Market';
import { Options } from './components/Options';
import { University } from './components/University';
import { Hunting } from './components/Hunting';
import { Guild } from './components/Guild';
import { PublicReportViewer } from './components/PublicReportViewer';
import { api } from './api';
import { PlayerCharacter, GameData, Tab, Race, CharacterClass, Language, ItemTemplate, Affix, RolledAffixStats, CharacterStats, EquipmentSlot, ExpeditionRewardSummary, RankingPlayer, ItemInstance, EssenceType, PvpRewardSummary } from './types';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';

// @FIX: Defined missing cost calculation functions to be passed to the Camp component.
const getCampUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 5 && level <= 7) essences.push({ type: EssenceType.Common, amount: (level - 4) * 2 });
    if (level >= 8) essences.push({ type: EssenceType.Common, amount: 6 }, { type: EssenceType.Uncommon, amount: level - 7 });
    return { gold, essences };
};

const getChestUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 6) essences.push({ type: EssenceType.Uncommon, amount: Math.floor((level - 5) / 2) + 1 });
    return { gold, essences };
};

const getBackpackUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 4 && level <= 6) essences.push({ type: EssenceType.Common, amount: (level - 3) * 5 });
    if (level >= 7 && level <= 8) essences.push({ type: EssenceType.Uncommon, amount: (level - 6) * 3 });
    if (level >= 9) essences.push({ type: EssenceType.Rare, amount: level - 8 });
    return { gold, essences };
};

export const App: React.FC = () => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [character, setCharacter] = useState<PlayerCharacter | null>(null);
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
    const [isNewsOpen, setIsNewsOpen] = useState(false);
    const [hasNewNews, setHasNewNews] = useState(false);
    const [activeUsers, setActiveUsers] = useState<string[]>([]);
    const [tavernMessages, setTavernMessages] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [allCharacters, setAllCharacters] = useState<any[]>([]);
    const [expeditionReport, setExpeditionReport] = useState<{ summary: ExpeditionRewardSummary; messageId: number; } | null>(null);
    const [pvpReport, setPvpReport] = useState<PvpRewardSummary | null>(null);
    const [traderInventory, setTraderInventory] = useState<{ regularItems: ItemInstance[], specialOfferItems: ItemInstance[] }>({ regularItems: [], specialOfferItems: [] });
    
    // Notifications State
    const [lastSeenTavernMsgId, setLastSeenTavernMsgId] = useState<number>(0);
    const [hasNewTavernMessages, setHasNewTavernMessages] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    // Ranking State
    const [ranking, setRanking] = useState<RankingPlayer[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);

    // Loading State
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [showForceLogout, setShowForceLogout] = useState(false);
    const [loadingTime, setLoadingTime] = useState(0);

    // Messaging State (Cross-tab communication)
    const [pendingComposeRecipient, setPendingComposeRecipient] = useState<string | null>(null);

    // Refs
    const isCompletingExpeditionRef = useRef(false);
    const isLoadingRef = useRef(false); 
    // Ref to track active tab inside intervals/callbacks without dependency loops
    const activeTabRef = useRef<Tab>(Tab.Statistics);

    const t = getT(character?.settings?.language || Language.PL);

    // Force logout handler - Clean state without reload to avoid loops
    const handleForceLogout = () => {
        console.log("Force logout triggered");
        localStorage.removeItem('token');
        setToken(null);
        setCharacter(null);
        setGameData(null);
        setIsInitialLoading(false);
        setLoadingError(null);
        // window.location.reload(); // Disabled to prevent refresh loops
    };
    
    const checkUnreadMessages = useCallback(async () => {
        if (!token) return;
        try {
            const hasUnread = await api.getUnreadMessagesStatus();
            setHasUnreadMessages(hasUnread);
        } catch (e) {
            console.error("Failed to check unread messages", e);
        }
    }, [token]);

    // Update ref when activeTab changes
    useEffect(() => {
        activeTabRef.current = activeTab;
        
        // Clear tavern notification if we switch to tavern
        if (activeTab === Tab.Tavern && tavernMessages.length > 0) {
            const latestId = tavernMessages[tavernMessages.length - 1].id;
            setLastSeenTavernMsgId(latestId);
            setHasNewTavernMessages(false);
        }
        
        // Check messages when switching tabs (user might have read them)
        if (token) {
            checkUnreadMessages();
        }
    }, [activeTab, tavernMessages, token, checkUnreadMessages]);

    // Loading Timer Effect
    useEffect(() => {
        let timer: any;
        if (isInitialLoading) {
            timer = setInterval(() => {
                setLoadingTime(t => {
                    // Show force logout faster (after 2 seconds)
                    if (t >= 2) setShowForceLogout(true);
                    return t + 1;
                });
            }, 1000);
        } else {
            setLoadingTime(0);
            setShowForceLogout(false);
        }
        return () => clearInterval(timer);
    }, [isInitialLoading]);

    // Heartbeat Effect - keeps the player "Online" in ranking
    useEffect(() => {
        if (!token) return;

        const doHeartbeat = () => {
            api.sendHeartbeat().catch(e => console.error("Heartbeat failed", e));
        };

        doHeartbeat(); // Send one immediately
        const interval = setInterval(doHeartbeat, 60000); // Then every minute

        return () => clearInterval(interval);
    }, [token]);

    // Main Data Loading Effect
    useEffect(() => {
        if (!token) {
            setIsInitialLoading(false);
            return;
        }

        let isMounted = true;
        isLoadingRef.current = true;
        setIsInitialLoading(true);
        setLoadingError(null);
        setShowForceLogout(false);

        const loadData = async () => {
            try {
                // 0. Sync Time
                await api.synchronizeTime();

                // 1. Game Data
                setLoadingMessage(t('loading') + " (Pobieranie konfiguracji...)");
                const data = await api.getGameData();
                
                if (!isMounted) return;
                
                // More robust check - allow empty object but check if call actually succeeded/returned JSON
                if (!data) {
                    throw new Error("Nieprawidłowe dane gry (pusta odpowiedź). Serwer może być niedostępny.");
                }
                setGameData(data);

                // 2. Character
                setLoadingMessage(t('loading') + " (Wczytywanie postaci...)");
                const char = await api.getCharacter();
                
                if (!isMounted) return;

                setCharacter(char);
                
                // News check logic
                if (char && char.lastReadNewsTimestamp && data.settings?.newsLastUpdatedAt) {
                    setHasNewNews(char.lastReadNewsTimestamp < data.settings.newsLastUpdatedAt);
                } else if (data.settings?.newsContent) {
                     if(char && !char.lastReadNewsTimestamp) setHasNewNews(true);
                }
                
                setIsInitialLoading(false);
                isLoadingRef.current = false;

            } catch (e) {
                if (!isMounted) return;
                console.error("Initial load error:", e);
                const errorMessage = (e as Error).message;
                
                // If token is invalid, logout immediately.
                if (errorMessage === 'Invalid token' || errorMessage === 'Invalid username or password.') {
                     handleForceLogout();
                } else {
                     setLoadingError(errorMessage || "Wystąpił nieznany błąd podczas ładowania.");
                     setIsInitialLoading(false);
                     isLoadingRef.current = false;
                }
            }
        };

        loadData();
        
        // Safety timeout: if loading takes > 8s (aligned with API timeout), assume failure
        const failTimer = setTimeout(() => {
            if (isMounted && isLoadingRef.current) {
                setLoadingError("Przekroczono limit czasu. Serwer nie odpowiada.");
                setIsInitialLoading(false);
                isLoadingRef.current = false;
            }
        }, 8000);

        const interval = setInterval(async () => {
            if (!token || isLoadingRef.current) return;
            try {
                const char = await api.getCharacter();
                if (isMounted) setCharacter(char);
            } catch (e) {
                if ((e as Error).message === 'Invalid token') {
                    handleForceLogout();
                }
            }
        }, 10000);

        return () => {
            isMounted = false;
            clearTimeout(failTimer);
            clearInterval(interval);
        };
    }, [token]); 

    // Poll for Unread Messages
    useEffect(() => {
        if (!token) return;
        checkUnreadMessages(); // Initial check
        const msgInterval = setInterval(checkUnreadMessages, 15000); // Every 15 seconds
        return () => clearInterval(msgInterval);
    }, [token, checkUnreadMessages]);

    // ... rest of existing functions ...
    const fetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try {
            const data = await api.getRanking();
            setRanking(data);
        } catch (e) {
            console.error("Failed to fetch ranking", e);
        } finally {
            setIsRankingLoading(false);
        }
    }, []);

    const fetchTraderInventory = useCallback(async (force = false) => {
        try {
            const inventory = await api.getTraderInventory(force);
            setTraderInventory(inventory);
        } catch (e) {
            console.error("Failed to fetch trader inventory", e);
        }
    }, []);

    const handleForceTraderRefresh = useCallback(async () => {
        try {
            await fetchTraderInventory(true);
            alert("Oferta handlarza została odświeżona.");
        } catch (e) {
            console.error("Failed to refresh trader", e);
            alert("Wystąpił błąd podczas odświeżania handlarza.");
        }
    }, [fetchTraderInventory]);

    const fetchTavernData = useCallback(async () => {
        try {
            const data = await api.getTavernMessages();
            setTavernMessages(data.messages);
            setActiveUsers(data.activeUsers);

            // Handle Notifications
            if (data.messages.length > 0) {
                const latestMsg = data.messages[data.messages.length - 1];
                const latestId = latestMsg.id;

                setLastSeenTavernMsgId(prevLastSeen => {
                    // Initial load or first fetch
                    if (prevLastSeen === 0) {
                        return latestId;
                    }
                    
                    // If we are currently in Tavern, update seen ID
                    if (activeTabRef.current === Tab.Tavern) {
                        return latestId;
                    } 
                    
                    // If we are NOT in Tavern and there is a newer message
                    if (latestId > prevLastSeen) {
                        setHasNewTavernMessages(true);
                        return prevLastSeen; // Keep old seen ID until user visits
                    }

                    return prevLastSeen;
                });
            }
        } catch (e) {
            console.error("Failed to fetch tavern data", e);
        }
    }, []);

    useEffect(() => {
        if (activeTab === Tab.Ranking) {
            fetchRanking();
        }
        
        if (activeTab === Tab.Trader) {
            fetchTraderInventory();
        }

        if (activeTab === Tab.Admin) {
             api.getUsers().then(setUsers).catch(console.error);
             api.getAllCharacters().then(setAllCharacters).catch(console.error);
        }
    }, [activeTab, fetchRanking, fetchTraderInventory]);

    // Independent polling for Tavern messages to enable notifications even when tab is closed
    useEffect(() => {
        if (!token) return;
        
        fetchTavernData(); // Initial fetch
        const tavernInterval = setInterval(fetchTavernData, 5000);
        return () => clearInterval(tavernInterval);
    }, [token, fetchTavernData]);

    // --- Global Expedition Watcher ---
    const handleExpeditionCompletion = useCallback(async () => {
        if (isCompletingExpeditionRef.current || !character?.activeExpedition) return;
        
        // Use synchronized time
        if (api.getServerTime() < character.activeExpedition.finishTime) return;

        isCompletingExpeditionRef.current = true;
        try {
            const result = await api.completeExpedition();
            setCharacter(result.updatedCharacter);
            setExpeditionReport({ summary: result.summary, messageId: result.messageId });
            // Update messages status as a new report has arrived
            checkUnreadMessages();
        } catch (e) {
            console.error("Failed to complete expedition automatically", e);
        } finally {
            isCompletingExpeditionRef.current = false;
        }
    }, [character, checkUnreadMessages]);

    const handleCancelExpedition = async () => {
        if (window.confirm("Czy na pewno chcesz anulować wyprawę? Zasoby zostaną zwrócone.")) {
            try {
                const updatedChar = await api.cancelExpedition();
                setCharacter(updatedChar);
            } catch (e: any) {
                alert(e.message || t('error.title'));
            }
        }
    };

    useEffect(() => {
        if (!character?.activeExpedition) return;
        
        const now = api.getServerTime(); // Use synced time
        const finishTime = character.activeExpedition.finishTime;
        const timeLeft = finishTime - now;

        let timer: ReturnType<typeof setTimeout>;

        if (timeLeft <= 0) {
             handleExpeditionCompletion();
        } else {
             timer = setTimeout(() => {
                 handleExpeditionCompletion();
             }, timeLeft);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [character?.activeExpedition, handleExpeditionCompletion]);
    // ---------------------------------

    const handleLoginSuccess = (newToken: string) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    };

    const handleLogout = () => {
        if (token) api.logout(token);
        handleForceLogout();
    };
    
    const fetchCharacter = async () => {
        const char = await api.getCharacter();
        setCharacter(char);
    }

    const handleCharacterUpdate = useCallback(async (updatedCharacter: PlayerCharacter, immediate = false) => {
        setCharacter(updatedCharacter); // Optimistic update
        if (immediate) {
            try {
                const syncedChar = await api.updateCharacter(updatedCharacter);
                setCharacter(syncedChar);
            } catch (e) {
                console.error("Failed to sync character", e);
                alert(t('error.title'));
                fetchCharacter(); // Revert on error
            }
        }
    }, [t]);

    const handleResetAttributes = useCallback(async () => {
        // Logic moved to Statistics.tsx component calling API directly
    }, []);

    const calculateDerivedStats = (char: PlayerCharacter, data: GameData | null): PlayerCharacter => {
         if (!data || !char.equipment) return char;
         // FIX: Default to empty arrays to prevent crash if DB is empty/corrupted
         const itemTemplates = data.itemTemplates || [];
         const affixes = data.affixes || [];
         const skills = data.skills || [];

        const getMaxValue = (value: number | { min: number; max: number } | undefined): number => {
            if (value === undefined || value === null) return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'object' && 'max' in value) return value.max;
            return 0;
        };
    
        const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy' | 'luck'> = {
            strength: Number(char.stats.strength) || 0, 
            agility: Number(char.stats.agility) || 0, 
            accuracy: Number(char.stats.accuracy) || 0,
            stamina: Number(char.stats.stamina) || 0, 
            intelligence: Number(char.stats.intelligence) || 0, 
            energy: Number(char.stats.energy) || 0,
            luck: Number(char.stats.luck) || 0
        };

        // Client-side Application of Guild Bonuses
        const guildShrineLevel = char.guildShrineLevel || 0;
        if (guildShrineLevel > 0) {
            totalPrimaryStats.luck += (guildShrineLevel * 5);
        }
        
        // Apply Guild Altar Buffs on Client Side to match Server Side calc
        if (char.activeGuildBuffs) {
            char.activeGuildBuffs.forEach(buff => {
                if (buff.expiresAt > Date.now()) {
                     for (const key in buff.stats) {
                         const statKey = key as keyof typeof totalPrimaryStats;
                         if (totalPrimaryStats[statKey] !== undefined) {
                             totalPrimaryStats[statKey] += (Number(buff.stats[statKey as keyof CharacterStats]) || 0);
                         }
                     }
                }
            });
        }
    
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
                    const val = Number(source.statsBonus[key]) || 0;
                    (totalPrimaryStats as any)[key] = ((totalPrimaryStats as any)[key] || 0) + val;
                }
            }
            bonusDamageMin += Number(source.damageMin) || 0;
            bonusDamageMax += Number(source.damageMax) || 0;
            bonusMagicDamageMin += Number(source.magicDamageMin) || 0;
            bonusMagicDamageMax += Number(source.magicDamageMax) || 0;
            bonusArmor += Number(source.armorBonus) || 0;
            bonusCritChance += Number(source.critChanceBonus) || 0;
            bonusMaxHealth += Number(source.maxHealthBonus) || 0;
            bonusCritDamageModifier += Number(source.critDamageModifierBonus) || 0;
            bonusArmorPenetrationPercent += Number(source.armorPenetrationPercent) || 0;
            bonusArmorPenetrationFlat += Number(source.armorPenetrationFlat) || 0;
            bonusLifeStealPercent += Number(source.lifeStealPercent) || 0;
            bonusLifeStealFlat += Number(source.lifeStealFlat) || 0;
            bonusManaStealPercent += Number(source.manaStealPercent) || 0;
            bonusManaStealFlat += Number(source.manaStealFlat) || 0;
            bonusAttacksPerRound += Number(source.attacksPerRoundBonus) || 0;
            bonusDodgeChance += Number(source.dodgeChanceBonus) || 0;
        };
    
        for (const slot in char.equipment) {
            const itemInstance = char.equipment[slot as EquipmentSlot];
            if (itemInstance && typeof itemInstance === 'object') {
                const template = itemTemplates.find(t => t.id === itemInstance.templateId);
                if (!template) continue;
    
                const upgradeLevel = itemInstance.upgradeLevel || 0;
                const upgradeBonusFactor = upgradeLevel * 0.1;
    
                if (itemInstance.rolledBaseStats) {
                    const baseStats = itemInstance.rolledBaseStats;
                    const applyUpgrade = (val: number | undefined) => (Number(val) || 0) + Math.round((Number(val) || 0) * upgradeBonusFactor);
                    
                    if (baseStats.statsBonus) {
                        for (const stat in baseStats.statsBonus) {
                            const key = stat as keyof typeof baseStats.statsBonus;
                            const baseBonus = Number(baseStats.statsBonus[key]) || 0;
                            (totalPrimaryStats as any)[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                        }
                    }
                    
                    bonusDamageMin += applyUpgrade(baseStats.damageMin);
                    bonusDamageMax += applyUpgrade(baseStats.damageMax);
                    bonusMagicDamageMin += applyUpgrade(baseStats.magicDamageMin);
                    bonusMagicDamageMax += applyUpgrade(baseStats.magicDamageMax);
                    bonusArmor += applyUpgrade(baseStats.armorBonus);
                    bonusMaxHealth += applyUpgrade(baseStats.maxHealthBonus);
                    bonusCritChance += (Number(baseStats.critChanceBonus) || 0) + ((Number(baseStats.critChanceBonus) || 0) * upgradeBonusFactor);
                    
                    bonusCritDamageModifier += applyUpgrade(baseStats.critDamageModifierBonus);
                    bonusArmorPenetrationFlat += applyUpgrade(baseStats.armorPenetrationFlat);
                    bonusLifeStealFlat += applyUpgrade(baseStats.lifeStealFlat);
                    bonusManaStealFlat += applyUpgrade(baseStats.manaStealFlat);
    
                    bonusArmorPenetrationPercent += Number(baseStats.armorPenetrationPercent) || 0;
                    bonusLifeStealPercent += Number(baseStats.lifeStealPercent) || 0;
                    bonusManaStealPercent += Number(baseStats.manaStealPercent) || 0;
    
                } else if (template) {
                     // Fallback
                     if (template.statsBonus) {
                        for (const stat in template.statsBonus) {
                            const key = stat as keyof typeof template.statsBonus;
                            const bonusValue = template.statsBonus[key];
                            const baseBonus = getMaxValue(bonusValue as any);
                            (totalPrimaryStats as any)[key] = ((totalPrimaryStats as any)[key] || 0) + baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                        }
                    }
                    const getBaseAndUpgrade = (prop: any) => {
                        const base = getMaxValue(prop);
                        return base + Math.round(base * upgradeBonusFactor);
                    }
                    bonusDamageMin += getBaseAndUpgrade(template.damageMin);
                    bonusDamageMax += getBaseAndUpgrade(template.damageMax);
                    bonusMagicDamageMin += getBaseAndUpgrade(template.magicDamageMin);
                    bonusMagicDamageMax += getBaseAndUpgrade(template.magicDamageMax);
                    bonusArmor += getBaseAndUpgrade(template.armorBonus);
                    bonusMaxHealth += getBaseAndUpgrade(template.maxHealthBonus);
                    bonusCritChance += getMaxValue(template.critChanceBonus as any) + (getMaxValue(template.critChanceBonus as any) * upgradeBonusFactor);
                    
                    bonusCritDamageModifier += getBaseAndUpgrade(template.critDamageModifierBonus);
                    bonusArmorPenetrationFlat += getBaseAndUpgrade(template.armorPenetrationFlat);
                    bonusLifeStealFlat += getBaseAndUpgrade(template.lifeStealFlat);
                    bonusManaStealFlat += getBaseAndUpgrade(template.manaStealFlat);
                    
                    bonusArmorPenetrationPercent += getMaxValue(template.armorPenetrationPercent as any);
                    bonusLifeStealPercent += getMaxValue(template.lifeStealPercent as any);
                    bonusManaStealPercent += getMaxValue(template.manaStealPercent as any);
                }
    
                if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
                if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
            }
        }
        
        const mainHandItem = char.equipment[EquipmentSlot.MainHand] || char.equipment[EquipmentSlot.TwoHand];
        const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
        
        const baseAttacksPerRound = Number(mainHandTemplate?.attacksPerRound) || 1;
        const calculatedAPR = baseAttacksPerRound + bonusAttacksPerRound;
        const attacksPerRound = !isNaN(calculatedAPR) ? parseFloat(calculatedAPR.toFixed(2)) : 1;
    
        const baseHealth = 50, baseEnergy = 10, baseMana = 20, baseMinDamage = 1, baseMaxDamage = 2;
    
        let maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
        if (isNaN(maxHealth) || maxHealth < 1) maxHealth = 50;
    
        const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
        let maxMana = baseMana + totalPrimaryStats.intelligence * 10;

        // Apply Mana Maintenance Costs from Active Skills (Client Side Calc)
        if (char.activeSkills && char.activeSkills.length > 0) {
            char.activeSkills.forEach(skillId => {
                const skill = skills.find(s => s.id === skillId);
                if (skill && skill.manaMaintenanceCost) {
                    maxMana -= skill.manaMaintenanceCost;
                }
            });
        }
        maxMana = Math.max(0, maxMana);
        
        let minDamage, maxDamage;
        if (mainHandTemplate?.isMagical) {
            minDamage = baseMinDamage + bonusDamageMin;
            maxDamage = baseMaxDamage + bonusDamageMax;
        } else if (mainHandTemplate?.isRanged) {
            minDamage = baseMinDamage + (totalPrimaryStats.agility * 1) + bonusDamageMin;
            maxDamage = baseMaxDamage + (totalPrimaryStats.agility * 2) + bonusDamageMax;
        } else {
            minDamage = baseMinDamage + (totalPrimaryStats.strength * 1) + bonusDamageMin;
            maxDamage = baseMaxDamage + (totalPrimaryStats.strength * 2) + bonusDamageMax;
        }
        
        const critChance = totalPrimaryStats.accuracy * 0.5 + bonusCritChance;
        const critDamageModifier = 200 + bonusCritDamageModifier;
        let dodgeChance = totalPrimaryStats.agility * 0.1 + bonusDodgeChance;
    
        let armor = bonusArmor;
        let manaRegen = totalPrimaryStats.intelligence * 2;
    
        if (char.race === Race.Dwarf) armor += 5;
        if (char.race === Race.Elf) manaRegen += 10;
        if (char.race === Race.Gnome) dodgeChance += 10;
        
        const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
        const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
        const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

        // Client-side Guild Barracks Bonus
        const guildBarracksLevel = char.guildBarracksLevel || 0;
        let finalMagicDamageMin = magicDamageMin;
        let finalMagicDamageMax = magicDamageMax;

        if (guildBarracksLevel > 0) {
            const damageMultiplier = 1 + (guildBarracksLevel * 0.05);
            minDamage = Math.floor(minDamage * damageMultiplier);
            maxDamage = Math.floor(maxDamage * damageMultiplier);
            
            finalMagicDamageMin = Math.floor(magicDamageMin * damageMultiplier);
            finalMagicDamageMax = Math.floor(magicDamageMax * damageMultiplier);
        }
        
        const valOrMax = (val: any, max: number) => {
            const num = Number(val);
            if (val === undefined || val === null || isNaN(num)) return max;
            return num;
        }
    
        const currentHealth = Math.min(valOrMax(char.stats.currentHealth, maxHealth), maxHealth);
        const currentMana = Math.min(valOrMax(char.stats.currentMana, maxMana), maxMana);
        const currentEnergy = Math.min(valOrMax(char.stats.currentEnergy, maxEnergy), maxEnergy);
    
        return {
            ...char,
            stats: {
                ...char.stats, ...totalPrimaryStats,
                maxHealth, maxEnergy, maxMana, 
                minDamage, maxDamage, 
                critChance, armor,
                magicDamageMin: finalMagicDamageMin, 
                magicDamageMax: finalMagicDamageMax, 
                attacksPerRound, manaRegen,
                currentHealth, currentMana, currentEnergy,
                critDamageModifier,
                armorPenetrationPercent: bonusArmorPenetrationPercent,
                armorPenetrationFlat: bonusArmorPenetrationFlat,
                lifeStealPercent: bonusLifeStealPercent,
                lifeStealFlat: bonusLifeStealFlat,
                manaStealPercent: bonusManaStealPercent,
                manaStealFlat: bonusManaStealFlat,
                dodgeChance
            }
        };
    };

    const handleCharacterCreate = async (newCharData: { name: string, race: Race }) => {
        try {
            // Create via API
            const startLocationId = gameData?.locations.find(l => l.isStartLocation)?.id || gameData?.locations[0]?.id || 'start';
            const createdChar = await api.createCharacter(newCharData.name, newCharData.race, startLocationId);
            setCharacter(createdChar);
        } catch (err: any) {
            console.error(err);
            alert(err.message || t('error.title'));
        }
    };
    
    const handleSelectClass = async (characterClass: CharacterClass) => {
        try {
            const updatedChar = await api.selectClass(characterClass);
            setCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };
    
    const handleLearnSkill = async (skillId: string) => {
        try {
            const updatedChar = await api.learnSkill(skillId);
            setCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleAcceptQuest = async (questId: string) => {
        try {
            const updatedChar = await api.acceptQuest(questId);
            setCharacter(updatedChar);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleCompleteQuest = async (questId: string) => {
        try {
            const updatedChar = await api.completeQuest(questId);
            setCharacter(updatedChar);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleAttack = async (defenderId: number) => {
        setIsRankingLoading(true);
        try {
            const result = await api.attackPlayer(defenderId);
            setPvpReport(result.summary);
            setCharacter(result.updatedAttacker);
            // Refresh ranking to show updated wins/losses
            fetchRanking();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsRankingLoading(false);
        }
    };

    const handleResetAllPvpCooldowns = async () => {
        try {
            await api.resetAllPvpCooldowns();
            alert('Cooldowny zresetowane.');
            fetchRanking();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSendGlobalMessage = async (data: { subject: string; content: string }) => {
        await api.sendGlobalMessage(data);
    };
    
    const handleComposeMessage = (recipientName: string) => {
        setActiveTab(Tab.Messages);
        setPendingComposeRecipient(recipientName);
    };

    const handleClearInitialRecipient = () => {
        setPendingComposeRecipient(null);
    };
    
    const onOpenNews = () => {
        setIsNewsOpen(true);
        if (hasNewNews) {
            setHasNewNews(false);
            if (character) {
                api.updateCharacter({ lastReadNewsTimestamp: Date.now() });
            }
        }
    };

    // Check URL for report ID (Public View)
    if (window.location.pathname.startsWith('/report/')) {
        const reportId = window.location.pathname.split('/')[2];
        return <PublicReportViewer reportId={reportId} type="message" />;
    }
    
    // Check URL for raid report ID (Public View)
    if (window.location.pathname.startsWith('/raid-report/')) {
        const reportId = window.location.pathname.split('/')[2];
        return <PublicReportViewer reportId={reportId} type="raid" />;
    }

    if (isInitialLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white space-y-4">
                <div className="text-xl font-semibold animate-pulse">{loadingMessage || t('loading')}</div>
                {showForceLogout && (
                    <button
                        onClick={handleForceLogout}
                        className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm font-bold transition-colors"
                    >
                        {t('error.logout')} (Wymuś reset)
                    </button>
                )}
            </div>
        );
    }
    
    if (loadingError) {
        return (
             <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white space-y-4 p-6 text-center">
                <h2 className="text-2xl font-bold text-red-500">{t('error.title')}</h2>
                <p className="text-gray-300">{loadingError}</p>
                <div className="flex gap-4 mt-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold"
                    >
                        {t('error.refresh')}
                    </button>
                    <button
                        onClick={handleForceLogout}
                        className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg font-bold"
                    >
                         {t('error.logout')}
                    </button>
                </div>
            </div>
        );
    }

    if (!token) {
        return <Auth onLoginSuccess={handleLoginSuccess} />;
    }

    if (!character) {
        return <CharacterCreation onCharacterCreate={handleCharacterCreate} />;
    }
    
    if (!gameData) {
        // Should be caught by loading state, but just in case
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Błąd danych gry.</div>;
    }

    const derivedCharacter = calculateDerivedStats(character, gameData);
    
    const windowBackground = character.windowBackgroundUrl || gameData.settings?.windowBackgroundUrl 
        ? `url(${character.windowBackgroundUrl || gameData.settings?.windowBackgroundUrl})` 
        : undefined;

    return (
        <LanguageContext.Provider value={{ lang: character.settings?.language || Language.PL, t }}>
            <div 
                className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden"
                style={{ "--window-bg": windowBackground } as React.CSSProperties}
            >
                <Sidebar
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    playerCharacter={derivedCharacter}
                    currentLocation={gameData.locations.find(l => l.id === derivedCharacter.currentLocationId)}
                    onLogout={handleLogout}
                    hasUnreadMessages={hasUnreadMessages}
                    hasNewTavernMessages={hasNewTavernMessages}
                    onOpenNews={onOpenNews}
                    hasNewNews={hasNewNews}
                    settings={gameData.settings}
                />
                <main className="flex-1 p-6 overflow-hidden relative" 
                     style={
                        gameData.settings?.gameBackground 
                        ? { backgroundImage: `url(${gameData.settings.gameBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
                        : undefined
                     }
                >
                     {/* Dark overlay for game background to ensure text readability if bg is bright */}
                     {gameData.settings?.gameBackground && (
                        <div className="absolute inset-0 bg-gray-900/70 pointer-events-none"></div>
                     )}
                     
                     <div className="relative z-10 h-full flex flex-col">
                        {activeTab === Tab.Statistics && (
                            <Statistics
                                character={derivedCharacter}
                                baseCharacter={character}
                                onCharacterUpdate={handleCharacterUpdate}
                                calculateDerivedStats={calculateDerivedStats}
                                gameData={gameData}
                                onSelectClass={handleSelectClass}
                            />
                        )}
                        {activeTab === Tab.Equipment && (
                            <Equipment
                                character={derivedCharacter}
                                baseCharacter={character}
                                gameData={gameData}
                                onEquipItem={(updated) => setCharacter(updated)}
                                onUnequipItem={(updated) => setCharacter(updated)}
                            />
                        )}
                        {activeTab === Tab.Expedition && (
                            <ExpeditionComponent
                                character={derivedCharacter}
                                expeditions={gameData.expeditions}
                                enemies={gameData.enemies}
                                currentLocation={gameData.locations.find(l => l.id === derivedCharacter.currentLocationId)!}
                                onStartExpedition={(expeditionId) => api.startExpedition(expeditionId).then(updated => setCharacter(updated))}
                                itemTemplates={gameData.itemTemplates}
                                affixes={gameData.affixes}
                                onCompletion={handleExpeditionCompletion}
                                onCancelExpedition={handleCancelExpedition}
                            />
                        )}
                        {activeTab === Tab.Camp && (
                            <Camp
                                character={derivedCharacter}
                                baseCharacter={character}
                                onToggleResting={() => {
                                    const newRestingState = !character.isResting;
                                    // Optimistic update for UI responsiveness
                                    const optimisticChar = { ...character, isResting: newRestingState };
                                    setCharacter(optimisticChar);
                                    api.updateCharacter({ isResting: newRestingState }).then(updated => setCharacter(updated));
                                }}
                                // @FIX: Add missing onUpgradeCamp, onUpgradeChest, and onUpgradeBackpack props to the Camp component.
                                onUpgradeCamp={async () => {
                                    try {
                                        const updatedChar = await api.upgradeCamp();
                                        setCharacter(updatedChar);
                                    } catch (e: any) {
                                        alert(e.message || t('error.title'));
                                    }
                                }}
                                onUpgradeChest={async () => {
                                    try {
                                        const updatedChar = await api.upgradeChest();
                                        setCharacter(updatedChar);
                                    } catch (e: any) {
                                        alert(e.message || t('error.title'));
                                    }
                                }}
                                onUpgradeBackpack={async () => {
                                    try {
                                        const updatedChar = await api.upgradeBackpack();
                                        setCharacter(updatedChar);
                                    } catch (e: any) {
                                        alert(e.message || t('error.title'));
                                    }
                                }}
                                getCampUpgradeCost={getCampUpgradeCost}
                                onCharacterUpdate={handleCharacterUpdate}
                                onHealToFull={() => api.healCharacter().then(updated => {
                                    if (updated) setCharacter(updated as PlayerCharacter);
                                })}
                                getChestUpgradeCost={getChestUpgradeCost}
                                getBackpackUpgradeCost={getBackpackUpgradeCost}
                            />
                        )}
                        {activeTab === Tab.Location && (
                            <Location
                                playerCharacter={derivedCharacter}
                                baseCharacter={character}
                                onCharacterUpdate={handleCharacterUpdate}
                                locations={gameData.locations}
                            />
                        )}
                        {activeTab === Tab.Resources && <Resources character={derivedCharacter} />}
                        {activeTab === Tab.Ranking && (
                            <Ranking
                                ranking={ranking}
                                currentPlayer={derivedCharacter}
                                isLoading={isRankingLoading}
                                onAttack={handleAttack}
                                onComposeMessage={handleComposeMessage}
                            />
                        )}
                        {activeTab === Tab.Messages && (
                            <Messages
                                itemTemplates={gameData.itemTemplates}
                                affixes={gameData.affixes}
                                enemies={gameData.enemies}
                                currentPlayer={derivedCharacter}
                                onCharacterUpdate={handleCharacterUpdate}
                                initialRecipient={pendingComposeRecipient}
                                onClearInitialRecipient={handleClearInitialRecipient}
                            />
                        )}
                        {activeTab === Tab.Quests && (
                            <Quests
                                character={derivedCharacter}
                                quests={gameData.quests}
                                enemies={gameData.enemies}
                                itemTemplates={gameData.itemTemplates}
                                affixes={gameData.affixes}
                                onAcceptQuest={handleAcceptQuest}
                                onCompleteQuest={handleCompleteQuest}
                            />
                        )}
                        {activeTab === Tab.Trader && (
                            <Trader
                                character={derivedCharacter}
                                baseCharacter={character}
                                itemTemplates={gameData.itemTemplates}
                                affixes={gameData.affixes}
                                settings={gameData.settings}
                                traderInventory={traderInventory.regularItems}
                                traderSpecialOfferItems={traderInventory.specialOfferItems}
                                onBuyItem={async (item) => {
                                    try {
                                        const updated = await api.buyItem(item.uniqueId);
                                        setCharacter(updated);
                                        fetchTraderInventory();
                                    } catch (e: any) {
                                        alert(e.message);
                                    }
                                }}
                                onSellItems={async (items) => {
                                     try {
                                        const updated = await api.sellItems(items.map(i => i.uniqueId));
                                        setCharacter(updated);
                                    } catch (e: any) {
                                        alert(e.message);
                                    }
                                }}
                            />
                        )}
                        {activeTab === Tab.Blacksmith && (
                            <Blacksmith
                                character={derivedCharacter}
                                baseCharacter={character}
                                itemTemplates={gameData.itemTemplates}
                                affixes={gameData.affixes}
                                onDisenchantItem={async (item) => {
                                    try {
                                        const res = await api.disenchantItem(item.uniqueId);
                                        setCharacter(res.updatedCharacter);
                                        return res.result;
                                    } catch (e: any) {
                                        alert(e.message);
                                        return { success: false };
                                    }
                                }}
                                onUpgradeItem={async (item) => {
                                    try {
                                        const res = await api.upgradeItem(item.uniqueId);
                                        setCharacter(res.updatedCharacter);
                                        return res.result;
                                    } catch (e: any) {
                                        alert(e.message);
                                        return { success: false, messageKey: 'error.title' };
                                    }
                                }}
                            />
                        )}
                        {activeTab === Tab.Tavern && (
                             <Tavern
                                character={derivedCharacter}
                                messages={tavernMessages}
                                activeUsers={activeUsers}
                                onSendMessage={(content) => api.sendTavernMessage(content).then(() => fetchTavernData())}
                            />
                        )}
                        {activeTab === Tab.Market && (
                             <Market
                                character={derivedCharacter}
                                gameData={gameData}
                                onCharacterUpdate={handleCharacterUpdate}
                             />
                        )}
                        {activeTab === Tab.Options && (
                             <Options
                                character={character}
                                onCharacterUpdate={handleCharacterUpdate}
                             />
                        )}
                        {activeTab === Tab.University && (
                             <University
                                character={derivedCharacter}
                                gameData={gameData}
                                onLearnSkill={handleLearnSkill}
                             />
                        )}
                        {activeTab === Tab.Hunting && (
                             <Hunting
                                character={derivedCharacter}
                                enemies={gameData.enemies}
                                itemTemplates={gameData.itemTemplates}
                                affixes={gameData.affixes}
                                gameData={gameData}
                             />
                        )}
                        {activeTab === Tab.Guild && (
                             <Guild onCharacterUpdate={fetchCharacter} />
                        )}
                        {activeTab === Tab.Admin && character.username === 'Kazujoshi' && (
                            <AdminPanel
                                gameData={gameData}
                                onGameDataUpdate={(key, data) => {
                                    setGameData(prev => prev ? ({ ...prev, [key]: data }) : null);
                                    api.updateGameData(key, data);
                                }}
                                onSettingsUpdate={(settings) => {
                                    setGameData(prev => prev ? ({ ...prev, settings }) : null);
                                    api.updateGameSettings(settings);
                                }}
                                users={users}
                                onDeleteUser={(id) => api.deleteUser(id).then(() => {
                                    setUsers(prev => prev.filter(u => u.id !== id));
                                    api.getAllCharacters().then(setAllCharacters);
                                })}
                                allCharacters={allCharacters}
                                onDeleteCharacter={(id) => api.deleteCharacter(id).then(() => setAllCharacters(prev => prev.filter(c => c.user_id !== id)))}
                                onResetCharacterStats={(id) => api.resetCharacterStats(id)}
                                onResetCharacterProgress={(id) => api.resetCharacterProgress(id)}
                                onHealCharacter={(id) => api.adminHealCharacter(id)}
                                onUpdateCharacterGold={(id, gold) => api.updateCharacterGold(id, gold)}
                                onForceTraderRefresh={handleForceTraderRefresh}
                                onResetAllPvpCooldowns={handleResetAllPvpCooldowns}
                                onSendGlobalMessage={handleSendGlobalMessage}
                                onRegenerateCharacterEnergy={(id) => api.regenerateCharacterEnergy(id)}
                                onChangeUserPassword={(id, pass) => api.changeUserPassword(id, pass)}
                                onInspectCharacter={(id) => api.inspectCharacter(id)}
                                onDeleteCharacterItem={(id, itemId) => api.deleteCharacterItem(id, itemId)}
                            />
                        )}
                    </div>
                </main>

                {expeditionReport && (
                    <ExpeditionSummaryModal
                        reward={expeditionReport.summary}
                        onClose={() => setExpeditionReport(null)}
                        characterName={derivedCharacter.name}
                        itemTemplates={gameData.itemTemplates}
                        affixes={gameData.affixes}
                        enemies={gameData.enemies}
                        messageId={expeditionReport.messageId}
                        backgroundImage={gameData.settings?.reportBackgroundUrl}
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
                        characterName={derivedCharacter.name}
                        itemTemplates={gameData.itemTemplates}
                        affixes={gameData.affixes}
                        enemies={gameData.enemies}
                        isPvp={true}
                        pvpData={{ attacker: pvpReport.attacker, defender: pvpReport.defender }}
                        backgroundImage={gameData.settings?.reportBackgroundUrl}
                    />
                )}

                <NewsModal 
                    isOpen={isNewsOpen} 
                    onClose={() => setIsNewsOpen(false)} 
                    content={gameData.settings?.newsContent || ''}
                />
            </div>
        </LanguageContext.Provider>
    );
};
