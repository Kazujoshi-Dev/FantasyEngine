
import React, { useState, useEffect, useCallback, useRef, Component, ReactNode } from 'react';
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
import { Tower } from './components/Tower'; // Import Tower
import { PublicReportViewer } from './components/PublicReportViewer';
import { api } from './api';
import { Tab, Race, Language, ItemInstance, ExpeditionRewardSummary, RankingPlayer, PvpRewardSummary } from './types';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';
import { CharacterProvider, useCharacter } from './contexts/CharacterContext';

// Error Boundary Component to catch crashes and show a readable error instead of white screen
interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6 text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-2">Wystąpił błąd krytyczny</h2>
                    <p className="text-gray-400 mb-4 bg-gray-800 p-4 rounded text-left overflow-auto max-w-2xl">
                        {this.state.error?.toString()}
                    </p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold"
                    >
                        Odśwież stronę
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const AppContent: React.FC = () => {
    const { character, derivedCharacter, setCharacter, gameData, setGameData, updateCharacter } = useCharacter();
    const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
    const [isNewsOpen, setIsNewsOpen] = useState(false);
    const [hasNewNews, setHasNewNews] = useState(false);
    const [activeUsers, setActiveUsers] = useState<string[]>([]);
    const [tavernMessages, setTavernMessages] = useState<any[]>([]);
    const [expeditionReport, setExpeditionReport] = useState<{ summary: ExpeditionRewardSummary; messageId: number; } | null>(null);
    const [pvpReport, setPvpReport] = useState<PvpRewardSummary | null>(null);
    const [traderInventory, setTraderInventory] = useState<{ regularItems: ItemInstance[], specialOfferItems: ItemInstance[] }>({ regularItems: [], specialOfferItems: [] });
    
    const [lastSeenTavernMsgId, setLastSeenTavernMsgId] = useState<number>(0);
    const [hasNewTavernMessages, setHasNewTavernMessages] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    const [ranking, setRanking] = useState<RankingPlayer[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    
    const [pendingComposeRecipient, setPendingComposeRecipient] = useState<string | null>(null);

    const isCompletingExpeditionRef = useRef(false);
    const activeTabRef = useRef<Tab>(Tab.Statistics);

    const t = getT(character?.settings?.language || Language.PL);

    // Moved handleLogout up here so it can be used by data fetchers
    const handleLogout = useCallback(() => {
        const token = api.getAuthToken();
        if (token) api.logout(token);
        localStorage.removeItem('token');
        window.location.reload(); // Force a full reload to clear all state
    }, []);

    // Force redirect to Tower if run is active
    useEffect(() => {
        if (character?.activeTowerRun && activeTab !== Tab.Tower) {
            setActiveTab(Tab.Tower);
        }
    }, [character?.activeTowerRun, activeTab]);

    // --- HEARTBEAT SYSTEM ---
    useEffect(() => {
        if (!api.getAuthToken()) return;

        // Send immediate heartbeat on load
        api.sendHeartbeat().catch(err => console.error("Initial heartbeat failed", err));

        // Send heartbeat every 30 seconds to keep status "Online"
        const heartbeatInterval = setInterval(() => {
            api.sendHeartbeat().catch(err => console.error("Heartbeat failed", err));
        }, 30000);

        return () => clearInterval(heartbeatInterval);
    }, []);
    // ------------------------

    const checkUnreadMessages = useCallback(async () => {
        if (!api.getAuthToken()) return;
        try {
            const hasUnread = await api.getUnreadMessagesStatus();
            setHasUnreadMessages(hasUnread);
        } catch (e: any) {
            if (e.message === 'Invalid token') {
                handleLogout();
            } else {
                console.error("Failed to check unread messages", e);
            }
        }
    }, [handleLogout]);

    useEffect(() => {
        activeTabRef.current = activeTab;
        if (activeTab === Tab.Tavern && tavernMessages.length > 0) {
            const latestId = tavernMessages[tavernMessages.length - 1].id;
            setLastSeenTavernMsgId(latestId);
            setHasNewTavernMessages(false);
        }
        if (api.getAuthToken()) {
            checkUnreadMessages();
        }
    }, [activeTab, tavernMessages, checkUnreadMessages]);

    useEffect(() => {
        if (!api.getAuthToken()) return;
        checkUnreadMessages();
        const msgInterval = setInterval(checkUnreadMessages, 15000);
        return () => clearInterval(msgInterval);
    }, [checkUnreadMessages]);

    const fetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try {
            const data = await api.getRanking();
            setRanking(data);
        } catch (e: any) { 
            if (e.message === 'Invalid token') {
                handleLogout();
            } else {
                console.error("Failed to fetch ranking", e); 
            }
        } finally { 
            setIsRankingLoading(false); 
        }
    }, [handleLogout]);

    const fetchTraderInventory = useCallback(async (force = false) => {
        try {
            const inventory = await api.getTraderInventory(force);
            setTraderInventory(inventory);
        } catch (e: any) { 
            if (e.message === 'Invalid token') {
                handleLogout();
            } else {
                console.error("Failed to fetch trader inventory", e); 
            }
        }
    }, [handleLogout]);

    const fetchTavernData = useCallback(async () => {
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
        } catch (e: any) { 
            if (e.message === 'Invalid token') {
                handleLogout();
            } else {
                console.error("Failed to fetch tavern data", e); 
            }
        }
    }, [handleLogout]);

    useEffect(() => {
        if (activeTab === Tab.Ranking) fetchRanking();
        if (activeTab === Tab.Trader) fetchTraderInventory();
    }, [activeTab, fetchRanking, fetchTraderInventory]);

    useEffect(() => {
        if (!api.getAuthToken()) return;
        fetchTavernData();
        const tavernInterval = setInterval(fetchTavernData, 5000);
        return () => clearInterval(tavernInterval);
    }, [fetchTavernData]);

    const handleExpeditionCompletion = useCallback(async () => {
        if (isCompletingExpeditionRef.current || !character?.activeExpedition) return;
        if (api.getServerTime() < character.activeExpedition.finishTime) return;

        isCompletingExpeditionRef.current = true;
        try {
            const result = await api.completeExpedition();
            setCharacter(result.updatedCharacter);
            setExpeditionReport({ summary: result.summary, messageId: result.messageId });
            checkUnreadMessages();
        } catch (e: any) { 
            if (e.message === 'Invalid token') {
                handleLogout();
            } else {
                console.error("Failed to complete expedition automatically", e); 
            }
        } finally { 
            isCompletingExpeditionRef.current = false; 
        }
    }, [character, setCharacter, checkUnreadMessages, handleLogout]);

    useEffect(() => {
        if (!character?.activeExpedition) return;
        const timeLeft = character.activeExpedition.finishTime - api.getServerTime();
        let timer: ReturnType<typeof setTimeout>;
        if (timeLeft <= 0) {
             handleExpeditionCompletion();
        } else {
             timer = setTimeout(() => handleExpeditionCompletion(), timeLeft);
        }
        return () => clearTimeout(timer);
    }, [character?.activeExpedition, handleExpeditionCompletion]);

    const handleCharacterCreate = async (newCharData: { name: string, race: Race }) => {
        try {
            const startLocationId = gameData?.locations.find(l => l.isStartLocation)?.id || gameData?.locations[0]?.id || 'start';
            const createdChar = await api.createCharacter(newCharData.name, newCharData.race, startLocationId);
            setCharacter(createdChar);
        } catch (err: any) {
            console.error(err);
            if (err.message === 'Invalid token') {
                handleLogout();
            } else {
                alert(err.message || t('error.title'));
            }
        }
    };
    
    // Add handleAttackPlayer to be passed to Ranking component
    const handleAttackPlayer = async (defenderId: number) => {
        try {
            const result = await api.attackPlayer(defenderId);
            setCharacter(result.updatedAttacker);
            setPvpReport(result.summary);
            fetchRanking(); 
        } catch (e: any) { 
            if (e.message === 'Invalid token') {
                handleLogout();
            } else {
                alert(e.message); 
            }
        }
    };
    
    if (!character) {
        return <CharacterCreation onCharacterCreate={handleCharacterCreate} />;
    }
    
    if (!gameData || !derivedCharacter) {
        return null;
    }

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
                    onOpenNews={() => setIsNewsOpen(true)}
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
                     {gameData.settings?.gameBackground && <div className="absolute inset-0 bg-gray-900/70 pointer-events-none"></div>}
                     
                     <div className="relative z-10 h-full flex flex-col">
                        {activeTab === Tab.Statistics && <Statistics />}
                        {activeTab === Tab.Equipment && <Equipment />}
                        {activeTab === Tab.Expedition && <ExpeditionComponent onCompletion={handleExpeditionCompletion} />}
                        {activeTab === Tab.Tower && <Tower />}
                        {activeTab === Tab.Camp && <Camp />}
                        {activeTab === Tab.Location && <Location />}
                        {activeTab === Tab.Resources && <Resources />}
                        {activeTab === Tab.Ranking && (
                            <Ranking
                                ranking={ranking}
                                isLoading={isRankingLoading}
                                onAttack={handleAttackPlayer}
                                onComposeMessage={(name) => { setActiveTab(Tab.Messages); setPendingComposeRecipient(name); }}
                            />
                        )}
                        {activeTab === Tab.Messages && (
                            <Messages
                                initialRecipient={pendingComposeRecipient}
                                onClearInitialRecipient={() => setPendingComposeRecipient(null)}
                            />
                        )}
                        {activeTab === Tab.Quests && <Quests />}
                        {activeTab === Tab.Trader && (
                            <Trader
                                traderInventory={traderInventory.regularItems}
                                traderSpecialOfferItems={traderInventory.specialOfferItems}
                                onItemBought={() => fetchTraderInventory()}
                            />
                        )}
                        {activeTab === Tab.Blacksmith && <Blacksmith />}
                        {activeTab === Tab.Tavern && (
                             <Tavern
                                messages={tavernMessages}
                                activeUsers={activeUsers}
                                onSendMessage={(content) => api.sendTavernMessage(content).then(fetchTavernData)}
                            />
                        )}
                        {activeTab === Tab.Market && <Market />}
                        {activeTab === Tab.Options && <Options />}
                        {activeTab === Tab.University && <University />}
                        {activeTab === Tab.Hunting && <Hunting />}
                        {activeTab === Tab.Guild && <Guild onCharacterUpdate={() => api.getCharacter().then(setCharacter)} />}
                        {activeTab === Tab.Admin && character.username === 'Kazujoshi' && (
                            <AdminPanel
                                gameData={gameData}
                                onGameDataUpdate={(key, data) => {
                                    setGameData(prev => prev ? ({ ...prev, [key]: data }) : null);
                                    api.updateGameData(key, data);
                                }}
                            />
                        )}
                    </div>
                </main>

                {expeditionReport && (
                    <ExpeditionSummaryModal
                        reward={expeditionReport.summary}
                        onClose={() => {
                            api.getCharacter().then(updateCharacter);
                            setExpeditionReport(null);
                        }}
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
                        onClose={() => {
                            api.getCharacter().then(updateCharacter);
                            setPvpReport(null);
                        }}
                        characterName={derivedCharacter.name}
                        itemTemplates={gameData.itemTemplates}
                        affixes={gameData.affixes}
                        enemies={gameData.enemies}
                        isPvp={true}
                        pvpData={{ attacker: pvpReport.attacker, defender: pvpReport.defender }}
                        isDefenderView={pvpReport.defender.id === derivedCharacter.id}
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
}

export const App: React.FC = () => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const handleLoginSuccess = (newToken: string) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setIsInitialLoading(true);
    };
    
    const handleForceLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
    };
    
    if (window.location.pathname.startsWith('/report/') || window.location.pathname.startsWith('/raid-report/')) {
        const parts = window.location.pathname.split('/');
        const reportId = parts[2];
        const type = parts[1] === 'raid-report' ? 'raid' : 'message';
        return <PublicReportViewer reportId={reportId} type={type} />;
    }

    if (!token) {
        // Create default translation instance for Auth screen (defaulting to PL)
        const tAuth = getT(Language.PL);
        
        return (
            <ErrorBoundary>
                <LanguageContext.Provider value={{ lang: Language.PL, t: tAuth }}>
                    <Auth onLoginSuccess={handleLoginSuccess} />
                </LanguageContext.Provider>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <CharacterProvider>
                <AppLoader onLogout={handleForceLogout}>
                    <AppContent />
                </AppLoader>
            </CharacterProvider>
        </ErrorBoundary>
    );
};

const AppLoader: React.FC<{children: React.ReactNode, onLogout: () => void}> = ({ children, onLogout }) => {
    const { setCharacter, setGameData } = useCharacter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const t = getT(Language.PL);

    useEffect(() => {
        const loadData = async () => {
            try {
                await api.synchronizeTime();
                const [gameData, charData] = await Promise.all([
                    api.getGameData(),
                    api.getCharacter()
                ]);
                
                if (!gameData || !charData) {
                    if (!charData) {
                        setGameData(gameData);
                        setIsLoading(false);
                        return;
                    }
                    throw new Error("Invalid initial data from server.");
                }
                
                setGameData(gameData);
                setCharacter(charData);
                setIsLoading(false);

            } catch (e: any) {
                if (e.message === 'Invalid token') {
                    onLogout();
                } else {
                    setError(e.message || "Unknown error during loading.");
                    setIsLoading(false);
                }
            }
        };

        loadData();
    }, [setCharacter, setGameData, onLogout]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">{t('loading')}</div>;
    }
    
    if (error) {
        return (
             <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6 text-center">
                <h2 className="text-2xl font-bold text-red-500">{t('error.title')}</h2>
                <p className="text-gray-300 my-4">{error}</p>
                <button onClick={onLogout} className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg font-bold">
                    {t('error.logout')}
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
