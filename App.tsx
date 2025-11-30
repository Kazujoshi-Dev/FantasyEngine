
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Auth } from './components/Auth';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterSelection } from './components/CharacterSelection';
import { Sidebar, NewsModal } from './components/Sidebar';
import { Statistics } from './components/Statistics';
import { Equipment } from './components/Equipment';
import { ExpeditionComponent, ExpeditionSummaryModal } from './components/Expedition';
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
import { PlayerCharacter, GameData, Tab, Race, CharacterClass, Language, ItemTemplate, Affix, RolledAffixStats, CharacterStats, EquipmentSlot, ExpeditionRewardSummary, RankingPlayer, ItemInstance, EssenceType, PvpRewardSummary, PublicCharacterProfile } from './types';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';

const MainApp: React.FC = () => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [character, setCharacter] = useState<PlayerCharacter | null>(null);
    const [charactersList, setCharactersList] = useState<PublicCharacterProfile[]>([]);
    
    // New View State Logic
    const [view, setView] = useState<'loading' | 'auth' | 'char-select' | 'char-create' | 'game'>('loading');
    
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
    const [loadingMessage, setLoadingMessage] = useState('');
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [showForceLogout, setShowForceLogout] = useState(false);
    const [loadingTime, setLoadingTime] = useState(0);

    // Refs
    const isCompletingExpeditionRef = useRef(false);
    const isLoadingRef = useRef(false); 
    const activeTabRef = useRef<Tab>(Tab.Statistics);

    const t = getT(character?.settings?.language || Language.PL);

    // Force logout handler
    const handleForceLogout = () => {
        console.log("Force logout triggered");
        localStorage.removeItem('token');
        setToken(null);
        setCharacter(null);
        setGameData(null);
        setCharactersList([]);
        setView('auth');
        setLoadingError(null);
    };
    
    const checkUnreadMessages = useCallback(async () => {
        if (!token || view !== 'game') return;
        try {
            const hasUnread = await api.getUnreadMessagesStatus();
            setHasUnreadMessages(hasUnread);
        } catch (e) {
            console.error("Failed to check unread messages", e);
        }
    }, [token, view]);

    // Update ref when activeTab changes
    useEffect(() => {
        activeTabRef.current = activeTab;
        
        if (activeTab === Tab.Tavern && tavernMessages.length > 0) {
            const latestId = tavernMessages[tavernMessages.length - 1].id;
            setLastSeenTavernMsgId(latestId);
            setHasNewTavernMessages(false);
        }
        
        if (token && view === 'game') {
            checkUnreadMessages();
        }
    }, [activeTab, tavernMessages, token, view, checkUnreadMessages]);

    // Loading Timer Effect
    useEffect(() => {
        let timer: any;
        if (view === 'loading') {
            timer = setInterval(() => {
                setLoadingTime(t => {
                    if (t >= 2) setShowForceLogout(true);
                    return t + 1;
                });
            }, 1000);
        } else {
            setLoadingTime(0);
            setShowForceLogout(false);
        }
        return () => clearInterval(timer);
    }, [view]);

    // Heartbeat Effect
    useEffect(() => {
        if (!token || view !== 'game') return;

        const doHeartbeat = () => {
            api.sendHeartbeat().catch(e => console.error("Heartbeat failed", e));
        };

        doHeartbeat();
        const interval = setInterval(doHeartbeat, 60000);

        return () => clearInterval(interval);
    }, [token, view]);

    // Initial Auth Check and Character List Fetch
    useEffect(() => {
        const init = async () => {
            if (!token) {
                setView('auth');
                return;
            }

            // If we are already in game or selecting, don't reset
            // But on first load (when view is loading/auth), fetch list.
            if (view !== 'loading' && view !== 'auth') return;

            setView('loading');
            setLoadingMessage("Pobieranie listy postaci...");
            
            try {
                const chars = await api.getCharactersList();
                setCharactersList(chars);
                
                // If user has no characters, go to creation
                if (chars.length === 0) {
                    setView('char-create');
                } else {
                    // If user has characters, go to selection
                    setView('char-select');
                }
            } catch (e: any) {
                console.error("Init error:", e);
                // If token is invalid, logout
                if (e.message === 'Invalid token' || e.message.includes('403')) {
                    handleForceLogout();
                } else {
                    setLoadingError(e.message);
                }
            }
        };

        init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Game Data Loading (triggered after character selection)
    const loadGameDataAndCharacter = async () => {
        if (!token) return;
        
        isLoadingRef.current = true;
        setView('loading');
        setLoadingMessage(t('loading') + " (Wczytywanie świata...)");
        setLoadingError(null);
        
        try {
            await api.synchronizeTime();
            const data = await api.getGameData();
            if (!data) throw new Error("Nieprawidłowe dane gry.");
            setGameData(data);

            setLoadingMessage(t('loading') + " (Wczytywanie postaci...)");
            const char = await api.getCharacter();
            setCharacter(char);

            if (char && char.lastReadNewsTimestamp && data.settings?.newsLastUpdatedAt) {
                setHasNewNews(char.lastReadNewsTimestamp < data.settings.newsLastUpdatedAt);
            } else if (data.settings?.newsContent) {
                 if(char && !char.lastReadNewsTimestamp) setHasNewNews(true);
            }

            setView('game');
            isLoadingRef.current = false;
        } catch (e: any) {
             console.error("Game load error:", e);
             if (e.message === 'Invalid token' || e.message.includes('403')) {
                 handleForceLogout();
             } else {
                 setLoadingError(e.message || "Wystąpił błąd.");
                 isLoadingRef.current = false;
             }
        }
    };

    // --- Handlers for Selection/Creation ---

    const handleSelectCharacter = async (characterId: number) => {
        try {
            await api.selectCharacter(characterId);
            await loadGameDataAndCharacter();
        } catch (e: any) {
            alert("Błąd wyboru postaci: " + e.message);
        }
    };

    const handleCreateCharacter = async (data: { name: string, race: Race }) => {
        try {
            // We need gameData to get start location. If not loaded, fetch it briefly
            let currentGameData = gameData;
            if (!currentGameData) {
                 currentGameData = await api.getGameData();
                 setGameData(currentGameData);
            }
            
            const startLocationId = currentGameData?.locations.find(l => l.isStartLocation)?.id || '';
            
            const newChar = await api.createCharacter(data.name, data.race, startLocationId);
            
            // Once created, it should implicitly be active or we need to select it?
            // Usually create returns the new char but doesn't select it in session automatically unless backend does.
            // Let's assume we need to select it or refresh list.
            // Best flow: Refresh list, go to selection (or select automatically).
            
            const chars = await api.getCharactersList();
            setCharactersList(chars);
            
            // Auto-select if possible
            // Note: createCharacter returns PlayerCharacter. The ID returned in response is user_id for compatibility 
            // but for listing it returns actual ID. 
            // Actually, we updated api.createCharacter to return the full character object. 
            // The create endpoint returns `newChar` which has `id` as the character ID now (based on `backend/src/routes/character.ts`).
            
            if (newChar && (newChar as any).id) {
                 await handleSelectCharacter((newChar as any).id);
            } else {
                setView('char-select');
            }
        } catch (e: any) {
            alert(e.message);
        }
    };
    
    // --- Polling for Character Updates ---
    useEffect(() => {
        if (view !== 'game' || !token) return;
        
        const interval = setInterval(async () => {
            if (isLoadingRef.current) return;
            try {
                const char = await api.getCharacter();
                setCharacter(char);
            } catch (e: any) {
                if (e.message === 'Invalid token') handleForceLogout();
            }
        }, 10000);
        
        return () => clearInterval(interval);
    }, [view, token]);


    const fetchRanking = useCallback(async () => {
        if (view !== 'game') return;
        setIsRankingLoading(true);
        try {
            const data = await api.getRanking();
            setRanking(data);
        } catch (e) {
            console.error("Failed to fetch ranking", e);
        } finally {
            setIsRankingLoading(false);
        }
    }, [view]);

    const fetchTraderInventory = useCallback(async (force = false) => {
        if (view !== 'game') return;
        try {
            const inventory = await api.getTraderInventory(force);
            setTraderInventory(inventory);
        } catch (e) {
            console.error("Failed to fetch trader inventory", e);
        }
    }, [view]);

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
        if (view !== 'game') return;
        try {
            const data = await api.getTavernMessages();
            setTavernMessages(data.messages);
            setActiveUsers(data.activeUsers);

            if (data.messages.length > 0) {
                const latestMsg = data.messages[data.messages.length - 1];
                const latestId = latestMsg.id;

                setLastSeenTavernMsgId(prevLastSeen => {
                    if (prevLastSeen === 0) return latestId;
                    if (activeTabRef.current === Tab.Tavern) return latestId;
                    if (latestId > prevLastSeen) {
                        setHasNewTavernMessages(true);
                        return prevLastSeen;
                    }
                    return prevLastSeen;
                });
            }
        } catch (e) {
            console.error("Failed to fetch tavern data", e);
        }
    }, [view]);

    useEffect(() => {
        if (activeTab === Tab.Ranking) fetchRanking();
        if (activeTab === Tab.Trader) fetchTraderInventory();
        if (activeTab === Tab.Admin) {
             api.getUsers().then(setUsers).catch(console.error);
             api.getAllCharacters().then(setAllCharacters).catch(console.error);
        }
    }, [activeTab, fetchRanking, fetchTraderInventory]);

    useEffect(() => {
        if (!token || view !== 'game') return;
        fetchTavernData();
        const tavernInterval = setInterval(fetchTavernData, 5000);
        return () => clearInterval(tavernInterval);
    }, [token, view, fetchTavernData]);

    const handleExpeditionCompletion = useCallback(async () => {
        if (isCompletingExpeditionRef.current || !character?.activeExpedition) return;
        if (api.getServerTime() < character.activeExpedition.finishTime) return;

        isCompletingExpeditionRef.current = true;
        try {
            const result = await api.completeExpedition();
            setCharacter(result.updatedCharacter);
            setExpeditionReport({ summary: result.summary, messageId: result.messageId });
            checkUnreadMessages();
        } catch (e) {
            console.error("Failed to complete expedition automatically", e);
        } finally {
            isCompletingExpeditionRef.current = false;
        }
    }, [character, checkUnreadMessages]);

    useEffect(() => {
        if (!character?.activeExpedition) return;
        const now = api.getServerTime();
        const timeLeft = character.activeExpedition.finishTime - now;
        let timer: ReturnType<typeof setTimeout>;
        if (timeLeft <= 0) {
             handleExpeditionCompletion();
        } else {
             timer = setTimeout(handleExpeditionCompletion, timeLeft);
        }
        return () => { if (timer) clearTimeout(timer); };
    }, [character?.activeExpedition, handleExpeditionCompletion]);


    // --- Render Logic ---
    const handleLoginSuccess = (newToken: string) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        // Effect will trigger init
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
        setCharacter(updatedCharacter);
        if (immediate) {
            try {
                const syncedChar = await api.updateCharacter(updatedCharacter);
                setCharacter(syncedChar);
            } catch (e) {
                console.error("Failed to sync character", e);
                alert(t('error.title'));
                fetchCharacter();
            }
        }
    }, [t]);

    // --- View Switching ---

    if (view === 'auth' || !token) {
        return <LanguageContext.Provider value={{ lang: Language.PL, t: getT(Language.PL) }}>
            <Auth onLoginSuccess={handleLoginSuccess} />
        </LanguageContext.Provider>;
    }

    if (view === 'loading') {
        return (
             <div className="flex flex-col items-center justify-center h-screen text-white gap-4 bg-gray-900">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                 <p>{loadingMessage}</p>
                 {showForceLogout && (
                     <button onClick={handleForceLogout} className="mt-4 px-6 py-2 bg-red-700 rounded-lg text-white">Wyloguj się</button>
                 )}
                 {loadingError && (
                    <div className="text-center">
                         <p className="text-red-400 mb-2">{loadingError}</p>
                         <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-700 rounded">Odśwież</button>
                    </div>
                 )}
             </div>
        );
    }

    if (view === 'char-select') {
        return (
            <LanguageContext.Provider value={{ lang: Language.PL, t: getT(Language.PL) }}>
                <CharacterSelection 
                    characters={charactersList} 
                    onSelect={handleSelectCharacter} 
                    onCreateNew={() => setView('char-create')} 
                    onLogout={handleLogout}
                />
            </LanguageContext.Provider>
        );
    }

    if (view === 'char-create') {
        return (
            <LanguageContext.Provider value={{ lang: Language.PL, t: getT(Language.PL) }}>
                <div className="relative">
                    <button onClick={() => setView('char-select')} className="absolute top-4 left-4 px-4 py-2 bg-slate-700 text-white rounded z-50 hover:bg-slate-600">
                        &larr; Powrót
                    </button>
                    <CharacterCreation onCharacterCreate={handleCreateCharacter} />
                </div>
            </LanguageContext.Provider>
        );
    }

    // VIEW === 'game'
    if (!character || !gameData) return <div className="bg-gray-900 h-screen text-white flex items-center justify-center">Błąd danych...</div>;

    const currentLocation = gameData.locations.find(l => l.id === character.currentLocationId);

    const renderContent = () => {
        switch (activeTab) {
            case Tab.Statistics:
                return <Statistics 
                    character={character} 
                    baseCharacter={character} 
                    onCharacterUpdate={handleCharacterUpdate} 
                    calculateDerivedStats={(c) => c} // No-op as backend handles stats now
                    gameData={gameData}
                    onResetAttributes={() => {}} 
                    onSelectClass={async (cls) => {
                        const updated = await api.selectClass(cls);
                        setCharacter(updated);
                    }}
                />;
            case Tab.Equipment:
                return <Equipment 
                    character={character} 
                    baseCharacter={character} 
                    gameData={gameData} 
                    onEquipItem={async (item) => { await api.equipItem(item.uniqueId); fetchCharacter(); }}
                    onUnequipItem={async (item, slot) => { await api.unequipItem(slot); fetchCharacter(); }}
                />;
            case Tab.Expedition:
                return <ExpeditionComponent 
                    character={character} 
                    expeditions={gameData.expeditions} 
                    enemies={gameData.enemies} 
                    currentLocation={currentLocation!} 
                    onStartExpedition={async (expId) => {
                        try {
                            const updatedChar = await api.startExpedition(expId);
                            setCharacter(updatedChar);
                        } catch(e: any) {
                            alert(e.message || t('error.title'));
                        }
                    }}
                    itemTemplates={gameData.itemTemplates || []}
                    affixes={gameData.affixes || []}
                    onCompletion={handleExpeditionCompletion}
                />;
            case Tab.Camp:
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

                return <Camp 
                    character={character} baseCharacter={character}
                    onToggleResting={() => {
                         handleCharacterUpdate({ ...character, isResting: !character.isResting }, true);
                    }}
                    onUpgradeCamp={async () => { await api.upgradeCamp(); fetchCharacter(); }}
                    getCampUpgradeCost={getCampUpgradeCost}
                    onCharacterUpdate={handleCharacterUpdate}
                    onHealToFull={async () => { await api.healCharacter(); fetchCharacter(); }}
                    onUpgradeChest={async () => { await api.upgradeChest(); fetchCharacter(); }}
                    onUpgradeBackpack={async () => { await api.upgradeBackpack(); fetchCharacter(); }}
                    getChestUpgradeCost={getChestUpgradeCost}
                    getBackpackUpgradeCost={getBackpackUpgradeCost}
                />;
             case Tab.Location:
                return <Location 
                    playerCharacter={character} 
                    baseCharacter={character}
                    onCharacterUpdate={handleCharacterUpdate} 
                    locations={gameData.locations} 
                />;
            case Tab.Resources:
                return <Resources character={character} />;
            case Tab.Ranking:
                return <Ranking 
                    ranking={ranking} 
                    currentPlayer={character} 
                    isLoading={isRankingLoading} 
                    onAttack={async (id) => {
                        try {
                            const { summary, updatedAttacker } = await api.attackPlayer(id);
                            setCharacter(updatedAttacker); 
                            setPvpReport(summary);
                            checkUnreadMessages();
                            fetchCharacter(); 
                        } catch(e: any) {
                            alert(e.message || t('error.title'));
                        }
                    }}
                    onComposeMessage={() => {}}
                />;
             case Tab.Messages:
                return <Messages 
                    itemTemplates={gameData.itemTemplates || []} 
                    affixes={gameData.affixes || []} 
                    enemies={gameData.enemies}
                    currentPlayer={character} 
                    onCharacterUpdate={handleCharacterUpdate}
                />;
            case Tab.Quests:
                return <Quests 
                    character={character}
                    quests={gameData.quests}
                    enemies={gameData.enemies}
                    itemTemplates={gameData.itemTemplates || []}
                    affixes={gameData.affixes || []}
                    onAcceptQuest={async (id) => { await api.acceptQuest(id); fetchCharacter(); }}
                    onCompleteQuest={async (id) => { await api.completeQuest(id); fetchCharacter(); }}
                />;
            case Tab.Trader:
                return <Trader 
                    character={character}
                    baseCharacter={character}
                    itemTemplates={gameData.itemTemplates || []}
                    affixes={gameData.affixes || []}
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
                    baseCharacter={character} 
                    itemTemplates={gameData.itemTemplates || []}
                    affixes={gameData.affixes || []}
                    onDisenchantItem={async (item) => { 
                        try {
                            const { updatedCharacter, result } = await api.disenchantItem(item.uniqueId);
                            setCharacter(updatedCharacter);
                            return result;
                        } catch (e: any) {
                            alert((e as Error).message);
                            return { success: false };
                        }
                    }}
                    onUpgradeItem={async (item) => { 
                        try {
                            const { updatedCharacter, result } = await api.upgradeItem(item.uniqueId);
                            setCharacter(updatedCharacter);
                            return result;
                        } catch (e: any) {
                            alert((e as Error).message);
                            return { success: false, messageKey: 'error.title' };
                        }
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
                    onSendMessage={async (content) => { 
                        await api.sendTavernMessage(content); 
                        fetchTavernData();
                    }}
                />;
            case Tab.Options:
                return <Options character={character} onCharacterUpdate={handleCharacterUpdate} />;
            case Tab.University:
                return <University 
                    character={character}
                    gameData={gameData}
                    onLearnSkill={async (id) => { await api.learnSkill(id); fetchCharacter(); }}
                />;
            case Tab.Hunting:
                return <Hunting 
                    character={character}
                    enemies={gameData.enemies}
                    itemTemplates={gameData.itemTemplates || []}
                    affixes={gameData.affixes || []}
                    gameData={gameData}
                />;
            case Tab.Guild:
                return <Guild />;
            case Tab.Admin:
                return <AdminPanel 
                    gameData={gameData}
                    onGameDataUpdate={async (key, data) => {
                        try {
                            await api.updateGameData(key, data);
                            const refreshedData = await api.getGameData();
                            setGameData(refreshedData);
                        } catch (e) { console.error(e); }
                    }}
                    onSettingsUpdate={async (s) => {
                        try {
                            await api.updateGameSettings(s);
                            const refreshedData = await api.getGameData();
                            setGameData(refreshedData);
                        } catch (e) { console.error(e); }
                    }}
                    users={users}
                    onDeleteUser={async (id) => { await api.deleteUser(id); }}
                    allCharacters={allCharacters}
                    onDeleteCharacter={async (id) => { await api.deleteCharacter(id); }}
                    onResetCharacterStats={async (id) => { await api.resetCharacterStats(id); }}
                    onResetCharacterProgress={async (id) => { await api.resetCharacterProgress(id); }}
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

    const windowBackground = gameData?.settings?.windowBackgroundUrl 
        ? `url(${gameData.settings.windowBackgroundUrl})` 
        : undefined;

    return (
        <LanguageContext.Provider value={{ lang: character.settings?.language || Language.PL, t }}>
            <div 
                className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans"
                style={{ "--window-bg": windowBackground } as React.CSSProperties}
            >
                <Sidebar 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    playerCharacter={character}
                    currentLocation={currentLocation}
                    onLogout={() => { setView('char-select'); }}
                    hasUnreadMessages={hasUnreadMessages}
                    hasNewTavernMessages={hasNewTavernMessages}
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
                {/* Modals... */}
                {expeditionReport && (
                    <ExpeditionSummaryModal
                        reward={expeditionReport.summary}
                        messageId={expeditionReport.messageId}
                        onClose={() => setExpeditionReport(null)}
                        characterName={character.name}
                        itemTemplates={gameData.itemTemplates || []}
                        affixes={gameData.affixes || []}
                        encounteredEnemies={expeditionReport.summary.encounteredEnemies}
                        bossName={expeditionReport.summary.combatLog.length > 0 && expeditionReport.summary.combatLog[0].enemyStats ? (expeditionReport.summary.combatLog[0].defender === character.name ? expeditionReport.summary.combatLog[0].attacker : expeditionReport.summary.combatLog[0].defender) : undefined}
                        backgroundImage={gameData.settings.reportBackgroundUrl}
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
                        itemTemplates={gameData.itemTemplates || []}
                        affixes={gameData.affixes || []}
                        isPvp={true}
                        pvpData={{ attacker: pvpReport.attacker, defender: pvpReport.defender }}
                        backgroundImage={gameData.settings.reportBackgroundUrl}
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
