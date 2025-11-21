
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Auth } from './components/Auth';
import { CharacterCreation } from './components/CharacterCreation';
import { Sidebar, NewsModal } from './components/Sidebar';
import { Statistics } from './components/Statistics';
import { Equipment } from './components/Equipment';
import { Expedition, ExpeditionSummaryModal } from './components/Expedition';
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
import { PublicReportViewer } from './components/PublicReportViewer';
import { api } from './api';
import { PlayerCharacter, GameData, Tab, Race, CharacterClass, Language, ItemTemplate, Affix, RolledAffixStats, CharacterStats, EquipmentSlot, ExpeditionRewardSummary, RankingPlayer, ItemInstance } from './types';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';

const MainApp: React.FC = () => {
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
    const [traderInventory, setTraderInventory] = useState<{ regularItems: ItemInstance[], specialOfferItems: ItemInstance[] }>({ regularItems: [], specialOfferItems: [] });
    
    // Ranking State
    const [ranking, setRanking] = useState<RankingPlayer[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);

    // Loading State
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [showForceLogout, setShowForceLogout] = useState(false);
    const [loadingTime, setLoadingTime] = useState(0);

    // Refs
    const isCompletingExpeditionRef = useRef(false);
    const isLoadingRef = useRef(false); 

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
        
        if (activeTab === Tab.Tavern) {
             api.getTavernMessages().then(data => {
                 setTavernMessages(data.messages);
                 setActiveUsers(data.activeUsers);
             }).catch(console.error);
             
             const tavernInterval = setInterval(() => {
                 api.getTavernMessages().then(data => {
                     setTavernMessages(data.messages);
                     setActiveUsers(data.activeUsers);
                 }).catch(console.error);
             }, 5000);
             return () => clearInterval(tavernInterval);
        }
    }, [activeTab, fetchRanking, fetchTraderInventory]);

    // --- Global Expedition Watcher ---
    const handleExpeditionCompletion = useCallback(async () => {
        if (isCompletingExpeditionRef.current || !character?.activeExpedition) return;
        
        if (Date.now() < character.activeExpedition.finishTime) return;

        isCompletingExpeditionRef.current = true;
        try {
            const result = await api.completeExpedition();
            setCharacter(result.updatedCharacter);
            setExpeditionReport({ summary: result.summary, messageId: result.messageId });
        } catch (e) {
            console.error("Failed to complete expedition automatically", e);
        } finally {
            isCompletingExpeditionRef.current = false;
        }
    }, [character]);

    useEffect(() => {
        if (!character?.activeExpedition) return;
        
        const now = Date.now();
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
            }
        }
    }, [t]);

    const handleResetAttributes = useCallback(async () => {
        if (!character || !gameData) return;

        const baseCharacter = character; 
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

        const totalPointsToRefund = 10 + (baseCharacter.level - 1);

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

    }, [character, gameData, handleCharacterUpdate, t]);

    const calculateDerivedStats = (char: PlayerCharacter, data: GameData | null): PlayerCharacter => {
         if (!data) return char;
         const { itemTemplates, affixes } = data;

        const getMaxValue = (value: number | { min: number; max: number } | undefined): number => {
            if (value === undefined || value === null) return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'object' && 'max' in value) return value.max;
            return 0;
        };
    
        const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
            strength: Number(char.stats.strength) || 0, 
            agility: Number(char.stats.agility) || 0, 
            accuracy: Number(char.stats.accuracy) || 0,
            stamina: Number(char.stats.stamina) || 0, 
            intelligence: Number(char.stats.intelligence) || 0, 
            energy: Number(char.stats.energy) || 0
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
                    const val = Number(source.statsBonus[key]) || 0;
                    totalPrimaryStats[key] = (totalPrimaryStats[key] || 0) + val;
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
            if (itemInstance) {
                const template = itemTemplates.find(t => t.id === itemInstance.templateId);
                const upgradeLevel = itemInstance.upgradeLevel || 0;
                const upgradeBonusFactor = upgradeLevel * 0.1;
    
                if (itemInstance.rolledBaseStats) {
                    const baseStats = itemInstance.rolledBaseStats;
                    const applyUpgrade = (val: number | undefined) => (Number(val) || 0) + Math.round((Number(val) || 0) * upgradeBonusFactor);
                    
                    if (baseStats.statsBonus) {
                        for (const stat in baseStats.statsBonus) {
                            const key = stat as keyof typeof baseStats.statsBonus;
                            const baseBonus = Number(baseStats.statsBonus[key]) || 0;
                            totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                        }
                    }
                    
                    bonusDamageMin += applyUpgrade(baseStats.damageMin);
                    bonusDamageMax += applyUpgrade(baseStats.damageMax);
                    bonusMagicDamageMin += applyUpgrade(baseStats.magicDamageMin);
                    bonusMagicDamageMax += applyUpgrade(baseStats.magicDamageMax);
                    bonusArmor += applyUpgrade(baseStats.armorBonus);
                    bonusMaxHealth += applyUpgrade(baseStats.maxHealthBonus);
                    bonusCritChance += (Number(baseStats.critChanceBonus) || 0) + ((Number(baseStats.critChanceBonus) || 0) * upgradeBonusFactor);
                    
                    bonusCritDamageModifier += Number(baseStats.critDamageModifierBonus) || 0;
                    bonusArmorPenetrationPercent += Number(baseStats.armorPenetrationPercent) || 0;
                    bonusArmorPenetrationFlat += Number(baseStats.armorPenetrationFlat) || 0;
                    bonusLifeStealPercent += Number(baseStats.lifeStealPercent) || 0;
                    bonusLifeStealFlat += Number(baseStats.lifeStealFlat) || 0;
                    bonusManaStealPercent += Number(baseStats.manaStealPercent) || 0;
                    bonusManaStealFlat += Number(baseStats.manaStealFlat) || 0;
    
                } else if (template) {
                     if (template.statsBonus) {
                        for (const stat in template.statsBonus) {
                            const key = stat as keyof typeof template.statsBonus;
                            const bonusValue = template.statsBonus[key];
                            const baseBonus = getMaxValue(bonusValue as any);
                            totalPrimaryStats[key] = (totalPrimaryStats[key] || 0) + baseBonus + Math.round(baseBonus * upgradeBonusFactor);
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
        
        const mainHandItem = char.equipment[EquipmentSlot.MainHand] || char.equipment[EquipmentSlot.TwoHand];
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
        let dodgeChance = totalPrimaryStats.agility * 0.1 + bonusDodgeChance;
    
        let armor = bonusArmor;
        let manaRegen = totalPrimaryStats.intelligence * 2;
    
        if (char.race === Race.Dwarf) armor += 5;
        if (char.race === Race.Elf) manaRegen += 10;
        if (char.race === Race.Gnome) dodgeChance += 10;
        
        const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
        const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
        const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;
    
        const currentHealth = Math.min(char.stats.currentHealth, maxHealth);
        const currentMana = Math.min(char.stats.currentMana, maxMana);
        const currentEnergy = Math.min(char.stats.currentEnergy, maxEnergy);
    
        return {
            ...char,
            stats: {
                ...char.stats, ...totalPrimaryStats,
                maxHealth, maxEnergy, maxMana, minDamage, maxDamage, critChance, armor,
                magicDamageMin, magicDamageMax, attacksPerRound, manaRegen,
                currentHealth, currentMana, currentEnergy,
                critDamageModifier, armorPenetrationPercent, armorPenetrationFlat,
                lifeStealPercent, lifeStealFlat, manaStealPercent, manaStealFlat,
                dodgeChance,
            }
        };
    };

    const derivedCharacter = useMemo(() => character ? calculateDerivedStats(character, gameData) : null, [character, gameData]);

    // --- Render Logic ---

    // 1. Not Logged In
    if (!token) {
        return <LanguageContext.Provider value={{ lang: Language.PL, t: getT(Language.PL) }}>
            <Auth onLoginSuccess={handleLoginSuccess} settings={gameData?.settings} />
        </LanguageContext.Provider>;
    }

    // 2. Initial Loading OR Error during Initial Load
    if (isInitialLoading) {
         return (
             <div className="flex flex-col items-center justify-center h-screen text-white gap-4 bg-gray-900">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                 <p>{loadingMessage || t('loading')}</p>
                 <p className="text-xs text-gray-500">Czas: {loadingTime}s</p>
                 {showForceLogout && (
                     <div className="mt-6 flex flex-col items-center gap-2 animate-fade-in">
                         <p className="text-sm text-gray-400">Ładowanie trwa zbyt długo?</p>
                         <button 
                            onClick={handleForceLogout} 
                            className="px-6 py-2 bg-red-700 rounded-lg hover:bg-red-600 font-semibold text-white shadow-lg transition-colors"
                         >
                            Wyloguj się (Napraw błąd)
                         </button>
                         <p className="text-xs text-gray-500 mt-1">Kliknij, jeśli Twój "bilet" wygasł lub gra się zacięła.</p>
                     </div>
                 )}
             </div>
         );
    }
    
    // 2b. Error State (Loading finished, but has error)
    if (loadingError) {
        return (
             <div className="flex flex-col items-center justify-center h-screen text-white gap-4 bg-gray-900">
                 <div className="text-center">
                     <p className="text-red-400 mb-4 text-lg font-bold">{t('error.title')}: {loadingError}</p>
                     <div className="flex gap-4 justify-center">
                        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 rounded hover:bg-indigo-700 font-semibold">
                            {t('error.refresh')}
                        </button>
                        <button onClick={handleForceLogout} className="px-6 py-2 bg-slate-600 rounded hover:bg-slate-700 font-semibold">
                            {t('error.logout')}
                        </button>
                     </div>
                 </div>
             </div>
        );
    }

    // 3. Missing Critical Data (GameData)
    if (!gameData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-white text-center bg-gray-900">
                <p className="text-lg font-bold mb-2">{t('error.title')}</p>
                <p className="text-sm text-gray-400 mb-4">Nie udało się załadować danych gry.</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700">
                     {t('error.refresh')}
                </button>
            </div>
        );
    }

    // 4. New User (Character creation)
    // If token exists, initial loading is done, but character is null => New User
    if (!character) {
        return <LanguageContext.Provider value={{ lang: Language.PL, t: getT(Language.PL) }}>
            <CharacterCreation onCharacterCreate={async (data) => {
                const newChar = await api.createCharacter(data.name, data.race, gameData.locations.find(l => l.isStartLocation)?.id || '');
                setCharacter(newChar);
            }} />
        </LanguageContext.Provider>;
    }

    // 5. Calculation Fallback (Should technically not happen if character exists, but safe to keep)
    if (!derivedCharacter) {
        return <div className="flex items-center justify-center h-screen text-white bg-gray-900">{t('loading')}... (Obliczanie statystyk)</div>;
    }

    const currentLocation = gameData.locations.find(l => l.id === character.currentLocationId);

    const renderContent = () => {
        switch (activeTab) {
            case Tab.Statistics:
                return <Statistics 
                    character={derivedCharacter} 
                    baseCharacter={character} 
                    onCharacterUpdate={handleCharacterUpdate} 
                    calculateDerivedStats={calculateDerivedStats}
                    gameData={gameData}
                    onResetAttributes={handleResetAttributes}
                    onSelectClass={async (cls) => {
                        const updated = await api.selectClass(cls);
                        setCharacter(updated);
                    }}
                />;
            case Tab.Equipment:
                return <Equipment 
                    character={derivedCharacter} 
                    baseCharacter={character} 
                    gameData={gameData} 
                    onEquipItem={async (item) => {
                         const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                         if(!template) return;
                         
                         let newChar = { ...character };
                         const targetSlot = template.slot;

                         if (targetSlot === 'consumable') {
                             // Consumable logic (use and remove)
                             newChar.inventory = newChar.inventory.filter(i => i.uniqueId !== item.uniqueId);
                             if(item.templateId === 'health_potion') { // Example hardcoded logic
                                 newChar.stats.currentHealth = Math.min(newChar.stats.maxHealth, newChar.stats.currentHealth + 50);
                             }
                             await handleCharacterUpdate(newChar, true);
                             return;
                         }
                         
                         if (targetSlot === 'ring') {
                             if (!newChar.equipment.ring1) {
                                 newChar.equipment.ring1 = item;
                             } else if (!newChar.equipment.ring2) {
                                 newChar.equipment.ring2 = item;
                             } else {
                                 alert(t('equipment.ringSlotsFull'));
                                 return;
                             }
                         } else if (targetSlot === EquipmentSlot.TwoHand) {
                             if (newChar.equipment.mainHand) {
                                 newChar.inventory.push(newChar.equipment.mainHand);
                                 newChar.equipment.mainHand = null;
                             }
                             if (newChar.equipment.offHand) {
                                 newChar.inventory.push(newChar.equipment.offHand);
                                 newChar.equipment.offHand = null;
                             }
                             if (newChar.equipment.twoHand) {
                                 newChar.inventory.push(newChar.equipment.twoHand);
                             }
                             newChar.equipment.twoHand = item;
                         } else if (targetSlot === EquipmentSlot.MainHand || targetSlot === EquipmentSlot.OffHand) {
                             if (newChar.equipment.twoHand) {
                                 newChar.inventory.push(newChar.equipment.twoHand);
                                 newChar.equipment.twoHand = null;
                             }
                             if (newChar.equipment[targetSlot]) {
                                 newChar.inventory.push(newChar.equipment[targetSlot]!);
                             }
                             newChar.equipment[targetSlot] = item;
                         } else {
                             const slot = targetSlot as EquipmentSlot;
                             if (newChar.equipment[slot]) {
                                 newChar.inventory.push(newChar.equipment[slot]!);
                             }
                             newChar.equipment[slot] = item;
                         }

                         newChar.inventory = newChar.inventory.filter(i => i.uniqueId !== item.uniqueId);
                         await handleCharacterUpdate(newChar, true);
                    }}
                    onUnequipItem={async (item, slot) => {
                        const newChar = { ...character };
                        newChar.equipment[slot] = null;
                        newChar.inventory.push(item);
                        await handleCharacterUpdate(newChar, true);
                    }}
                />;
            case Tab.Expedition:
                return <Expedition 
                    character={derivedCharacter} 
                    expeditions={gameData.expeditions} 
                    enemies={gameData.enemies} 
                    currentLocation={currentLocation!} 
                    onStartExpedition={async (expId) => {
                        const expedition = gameData.expeditions.find(e => e.id === expId);
                        if (!expedition) return;

                        if (character.resources.gold < expedition.goldCost || character.stats.currentEnergy < expedition.energyCost) {
                            alert(t('expedition.lackResources'));
                            return;
                        }

                        const updatedChar = { ...character };
                        updatedChar.resources.gold -= expedition.goldCost;
                        updatedChar.stats.currentEnergy -= expedition.energyCost;
                        updatedChar.activeExpedition = {
                            expeditionId: expId,
                            finishTime: Date.now() + expedition.duration * 1000,
                            enemies: [], // Populated on completion
                            combatLog: [],
                            rewards: { gold: 0, experience: 0 }
                        };
                        
                        await handleCharacterUpdate(updatedChar, true);
                    }}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    onCompletion={handleExpeditionCompletion}
                />;
            case Tab.Camp:
                return <Camp 
                    character={derivedCharacter} 
                    baseCharacter={character} 
                    onToggleResting={() => {
                        const now = Date.now();
                        handleCharacterUpdate({ 
                            ...character, 
                            isResting: !character.isResting, 
                            restStartHealth: character.stats.currentHealth,
                            lastRestTime: !character.isResting ? now : undefined // Set timestamp if starting rest
                        }, true);
                    }}
                    onUpgradeCamp={() => {
                        const cost = character.camp.level * 100;
                        if (character.resources.gold >= cost) {
                            const newChar = { ...character, camp: { level: character.camp.level + 1 }, resources: { ...character.resources, gold: character.resources.gold - cost } };
                            handleCharacterUpdate(newChar, true);
                        }
                    }}
                    getCampUpgradeCost={(lvl) => lvl * 100}
                    onCharacterUpdate={handleCharacterUpdate}
                    onHealToFull={async () => { await api.healCharacter(); fetchCharacter(); }}
                    onUpgradeChest={() => {
                        const currentLevel = character.chest.level;
                        const cost = { gold: currentLevel * 100, essences: [] }; // Simple cost for now
                        if (character.resources.gold >= cost.gold) {
                             const newChar = { ...character, chest: { ...character.chest, level: currentLevel + 1 }, resources: { ...character.resources, gold: character.resources.gold - cost.gold } };
                             handleCharacterUpdate(newChar, true);
                        }
                    }}
                    onUpgradeBackpack={() => {
                         const currentLevel = character.backpack?.level || 1;
                         const cost = { gold: currentLevel * 100, essences: [] };
                         if (character.resources.gold >= cost.gold) {
                             const newChar = { ...character, backpack: { level: currentLevel + 1 }, resources: { ...character.resources, gold: character.resources.gold - cost.gold } };
                             handleCharacterUpdate(newChar, true);
                         }
                    }}
                    getChestUpgradeCost={(lvl) => ({ gold: lvl * 100, essences: [] })}
                    getBackpackUpgradeCost={(lvl) => ({ gold: lvl * 100, essences: [] })}
                />;
            case Tab.Location:
                return <Location 
                    playerCharacter={derivedCharacter} 
                    onCharacterUpdate={handleCharacterUpdate} 
                    locations={gameData.locations} 
                />;
            case Tab.Resources:
                return <Resources character={character} />;
            case Tab.Ranking:
                return <Ranking 
                    ranking={ranking} 
                    currentPlayer={character} 
                    onRefresh={fetchRanking} 
                    isLoading={isRankingLoading} 
                    onAttack={async (id) => { await api.attackPlayer(id); fetchCharacter(); }}
                    onComposeMessage={() => {}}
                />;
            case Tab.Messages:
                return <Messages 
                    itemTemplates={gameData.itemTemplates} 
                    affixes={gameData.affixes} 
                    enemies={gameData.enemies}
                    currentPlayer={character} 
                    onCharacterUpdate={handleCharacterUpdate}
                />;
            case Tab.Quests:
                return <Quests 
                    character={character}
                    quests={gameData.quests}
                    enemies={gameData.enemies}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    onAcceptQuest={() => {}}
                    onCompleteQuest={async (id) => { await api.completeQuest(id); fetchCharacter(); }}
                />;
            case Tab.Trader:
                return <Trader 
                    character={derivedCharacter}
                    baseCharacter={character}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    settings={gameData.settings}
                    traderInventory={traderInventory.regularItems}
                    traderSpecialOfferItems={traderInventory.specialOfferItems}
                    onBuyItem={async (item) => { 
                        await api.buyItem(item.uniqueId); 
                        fetchCharacter();
                        fetchTraderInventory();
                    }}
                    onSellItems={async (items) => { 
                        await api.sellItems(items.map(i => i.uniqueId)); 
                        fetchCharacter();
                    }}
                />;
             case Tab.Blacksmith:
                return <Blacksmith 
                    character={character}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    onDisenchantItem={async (item) => { 
                        const { updatedCharacter, result } = await api.disenchantItem(item.uniqueId);
                        setCharacter(updatedCharacter);
                        return result;
                    }}
                    onUpgradeItem={async (item) => { 
                        const { updatedCharacter, result } = await api.upgradeItem(item.uniqueId);
                        setCharacter(updatedCharacter);
                        return result;
                    }}
                />;
            case Tab.Market:
                return <Market 
                    character={character} 
                    gameData={gameData} 
                    onCharacterUpdate={handleCharacterUpdate} 
                />;
            case Tab.Tavern:
                return <Tavern 
                    character={character}
                    messages={tavernMessages}
                    activeUsers={activeUsers}
                    onSendMessage={async (content) => { await api.sendTavernMessage(content); }}
                />;
            case Tab.Options:
                return <Options character={character} onCharacterUpdate={handleCharacterUpdate} />;
            case Tab.University:
                return <University 
                    character={derivedCharacter}
                    gameData={gameData}
                    onLearnSkill={async (id) => { await api.learnSkill(id); fetchCharacter(); }}
                />;
            case Tab.Hunting:
                return <Hunting 
                    character={derivedCharacter}
                    enemies={gameData.enemies}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    gameData={gameData}
                />;
            case Tab.Admin:
                return <AdminPanel 
                    gameData={gameData}
                    onGameDataUpdate={async (key, data) => { await api.updateGameData(key, data); api.getGameData().then(setGameData); }}
                    onSettingsUpdate={async (s) => { await api.updateGameSettings(s); api.getGameData().then(setGameData); }}
                    users={users}
                    onDeleteUser={async (id) => { await api.deleteUser(id); }}
                    allCharacters={allCharacters}
                    onDeleteCharacter={async (id) => { await api.deleteCharacter(id); }}
                    onResetCharacterStats={async (id) => { await api.resetCharacterStats(id); }}
                    onHealCharacter={async (id) => { await api.adminHealCharacter(id); }}
                    onUpdateCharacterGold={async (id, gold) => { await api.updateCharacterGold(id, gold); }}
                    onForceTraderRefresh={handleForceTraderRefresh}
                    onResetAllPvpCooldowns={async () => { await api.resetAllPvpCooldowns(); }}
                    onSendGlobalMessage={async (data) => { await api.sendGlobalMessage(data); }}
                    onRegenerateCharacterEnergy={async (id) => { await api.regenerateCharacterEnergy(id); }}
                    onChangeUserPassword={async (id, pw) => { await api.changeUserPassword(id, pw); }}
                    onInspectCharacter={async (id) => { return await api.inspectCharacter(id); }}
                    onDeleteCharacterItem={async (id, itemId) => { return await api.deleteCharacterItem(id, itemId); }}
                />;
            default:
                return null;
        }
    };

    const backgroundStyle = gameData?.settings?.gameBackground 
        ? { backgroundImage: `url(${gameData.settings.gameBackground})` } 
        : { backgroundImage: `url('/bg_pattern.png')` };

    return (
        <LanguageContext.Provider value={{ lang: character.settings?.language || Language.PL, t }}>
            <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans">
                <Sidebar 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    playerCharacter={derivedCharacter}
                    currentLocation={currentLocation}
                    onLogout={handleLogout}
                    hasUnreadMessages={false} // TODO: Implement check
                    hasNewTavernMessages={false} // TODO: Implement check
                    onOpenNews={() => setIsNewsOpen(true)}
                    hasNewNews={hasNewNews}
                    settings={gameData.settings}
                />
                <main className="flex-1 overflow-y-auto p-6 bg-repeat bg-center" style={backgroundStyle}>
                    <div className="max-w-7xl mx-auto">
                        {renderContent()}
                    </div>
                </main>
                <NewsModal 
                    isOpen={isNewsOpen} 
                    onClose={() => { 
                        setIsNewsOpen(false); 
                        handleCharacterUpdate({ ...character, lastReadNewsTimestamp: Date.now() }, true);
                    }} 
                    content={gameData.settings.newsContent || ''} 
                />
                {/* Global Expedition Report Modal Overlay */}
                {expeditionReport && (
                    <ExpeditionSummaryModal
                        reward={expeditionReport.summary}
                        messageId={expeditionReport.messageId}
                        onClose={() => setExpeditionReport(null)}
                        characterName={character.name}
                        itemTemplates={gameData.itemTemplates}
                        affixes={gameData.affixes}
                        initialEnemy={expeditionReport.summary.combatLog.length > 0 && expeditionReport.summary.combatLog[0].enemyStats ? {
                            id: 'unknown', // Placeholder
                            name: expeditionReport.summary.combatLog[0].defender === character.name ? expeditionReport.summary.combatLog[0].attacker : expeditionReport.summary.combatLog[0].defender,
                            description: expeditionReport.summary.combatLog[0].enemyDescription || '',
                            stats: expeditionReport.summary.combatLog[0].enemyStats,
                            rewards: { minGold: 0, maxGold: 0, minExperience: 0, maxExperience: 0 },
                            lootTable: []
                        } : undefined}
                        bossName={expeditionReport.summary.combatLog.length > 0 && expeditionReport.summary.combatLog[0].enemyStats ? (expeditionReport.summary.combatLog[0].defender === character.name ? expeditionReport.summary.combatLog[0].attacker : expeditionReport.summary.combatLog[0].defender) : undefined}
                    />
                )}
            </div>
        </LanguageContext.Provider>
    );
};

export const App: React.FC = () => {
    const reportMatch = window.location.pathname.match(/^\/report\/(\d+)$/);

    if (reportMatch) {
        const reportId = reportMatch[1];
        return <PublicReportViewer reportId={reportId} />;
    }

    return <MainApp />;
};
