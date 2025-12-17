
import React, { useState, useEffect, useCallback, useRef, Component, ReactNode } from 'react';
import { Auth } from './components/Auth';
import { CharacterCreation } from './components/CharacterCreation';
import { Sidebar } from './components/Sidebar';
import { Statistics } from './components/Statistics';
import { Equipment } from './components/Equipment';
import { ExpeditionComponent } from './components/Expedition';
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
import { Tower } from './components/Tower';
import { PublicReportViewer } from './components/PublicReportViewer';
import { ModalManager } from './components/layout/ModalManager';
import { api } from './api';
import { Tab, Race, Language, ItemInstance, ExpeditionRewardSummary, RankingPlayer, PvpRewardSummary } from './types';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';
import { CharacterProvider, useCharacter } from './contexts/CharacterContext';

class ErrorBoundary extends Component<{children?: ReactNode}, {hasError: boolean, error: Error | null}> {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6 text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-2">Błąd krytyczny</h2>
                    <p className="text-gray-400 mb-4">{this.state.error?.toString()}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-indigo-600 rounded-lg">Odśwież</button>
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
    const [activeUsers, setActiveUsers] = useState<string[]>([]);
    const [tavernMessages, setTavernMessages] = useState<any[]>([]);
    const [expeditionReport, setExpeditionReport] = useState<{ summary: ExpeditionRewardSummary; messageId: number; } | null>(null);
    const [pvpReport, setPvpReport] = useState<PvpRewardSummary | null>(null);
    const [traderInventory, setTraderInventory] = useState({ regularItems: [], specialOfferItems: [] });
    const [hasNewTavernMessages, setHasNewTavernMessages] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    const [ranking, setRanking] = useState<RankingPlayer[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    const [pendingComposeRecipient, setPendingComposeRecipient] = useState<string | null>(null);
    const isCompletingExpeditionRef = useRef(false);

    const t = getT(character?.settings?.language || Language.PL);

    const handleLogout = useCallback(() => {
        const token = api.getAuthToken();
        if (token) api.logout(token);
        localStorage.removeItem('token');
        window.location.reload();
    }, []);

    useEffect(() => {
        if (character?.activeTowerRun) {
            const allowedTabs = [Tab.Tower, Tab.Options];
            if (!allowedTabs.includes(activeTab)) setActiveTab(Tab.Tower);
        }
    }, [character?.activeTowerRun, activeTab]);

    const checkUpdates = useCallback(async () => {
        if (!api.getAuthToken()) return;
        try {
            const [unread, tavern] = await Promise.all([api.getUnreadMessagesStatus(), api.getTavernMessages()]);
            setHasUnreadMessages(unread);
            setTavernMessages(tavern.messages);
            setActiveUsers(tavern.activeUsers);
        } catch (e: any) { if (e.message === 'Invalid token') handleLogout(); }
    }, [handleLogout]);

    useEffect(() => {
        if (!api.getAuthToken()) return;
        checkUpdates();
        const interval = setInterval(checkUpdates, 15000);
        return () => clearInterval(interval);
    }, [checkUpdates]);

    const fetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try { setRanking(await api.getRanking()); } catch (e: any) { if (e.message === 'Invalid token') handleLogout(); }
        finally { setIsRankingLoading(false); }
    }, [handleLogout]);

    const fetchTrader = useCallback(async (force = false) => {
        try { setTraderInventory(await api.getTraderInventory(force)); } catch (e: any) { if (e.message === 'Invalid token') handleLogout(); }
    }, [handleLogout]);

    useEffect(() => {
        if (activeTab === Tab.Ranking) fetchRanking();
        if (activeTab === Tab.Trader) fetchTrader();
    }, [activeTab, fetchRanking, fetchTrader]);

    const handleExpeditionCompletion = useCallback(async () => {
        if (isCompletingExpeditionRef.current || !character?.activeExpedition) return;
        if (api.getServerTime() < character.activeExpedition.finishTime) return;
        isCompletingExpeditionRef.current = true;
        try {
            const result = await api.completeExpedition();
            setCharacter(result.updatedCharacter);
            setExpeditionReport({ summary: result.summary, messageId: result.messageId });
            checkUpdates();
        } catch (e) { console.error(e); }
        finally { isCompletingExpeditionRef.current = false; }
    }, [character, setCharacter, checkUpdates]);

    useEffect(() => {
        if (!character?.activeExpedition) return;
        const timeLeft = character.activeExpedition.finishTime - api.getServerTime();
        const timer = setTimeout(() => handleExpeditionCompletion(), Math.max(0, timeLeft));
        return () => clearTimeout(timer);
    }, [character?.activeExpedition, handleExpeditionCompletion]);

    if (!character) return <CharacterCreation onCharacterCreate={async (d) => setCharacter(await api.createCharacter(d.name, d.race, gameData?.locations.find(l => l.isStartLocation)?.id || 'start'))} />;
    if (!gameData || !derivedCharacter) return null;

    return (
        <LanguageContext.Provider value={{ lang: character.settings?.language || Language.PL, t }}>
            <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
                <Sidebar
                    activeTab={activeTab} setActiveTab={setActiveTab}
                    playerCharacter={derivedCharacter} onLogout={handleLogout}
                    hasUnreadMessages={hasUnreadMessages} hasNewTavernMessages={hasNewTavernMessages}
                    onOpenNews={() => setIsNewsOpen(true)} hasNewNews={false}
                    settings={gameData.settings}
                />
                <main className="flex-1 p-6 relative overflow-hidden" style={gameData.settings?.gameBackground ? { backgroundImage: `url(${gameData.settings.gameBackground})`, backgroundSize: 'cover' } : undefined}>
                     <div className="relative z-10 h-full">
                        {activeTab === Tab.Statistics && <Statistics />}
                        {activeTab === Tab.Equipment && <Equipment />}
                        {activeTab === Tab.Expedition && <ExpeditionComponent onCompletion={handleExpeditionCompletion} />}
                        {activeTab === Tab.Tower && <Tower />}
                        {activeTab === Tab.Camp && <Camp />}
                        {activeTab === Tab.Location && <Location />}
                        {activeTab === Tab.Resources && <Resources />}
                        {activeTab === Tab.Ranking && <Ranking ranking={ranking} isLoading={isRankingLoading} onAttack={async (id) => { const r = await api.attackPlayer(id); setCharacter(r.updatedAttacker); setPvpReport(r.summary); fetchRanking(); }} onComposeMessage={(n) => { setActiveTab(Tab.Messages); setPendingComposeRecipient(n); }} />}
                        {activeTab === Tab.Messages && <Messages initialRecipient={pendingComposeRecipient} onClearInitialRecipient={() => setPendingComposeRecipient(null)} />}
                        {activeTab === Tab.Quests && <Quests />}
                        {activeTab === Tab.Trader && <Trader traderInventory={traderInventory.regularItems} traderSpecialOfferItems={traderInventory.specialOfferItems} onItemBought={() => fetchTrader()} />}
                        {activeTab === Tab.Blacksmith && <Blacksmith />}
                        {activeTab === Tab.Tavern && <Tavern messages={tavernMessages} activeUsers={activeUsers} onSendMessage={(c) => api.sendTavernMessage(c).then(checkUpdates)} />}
                        {activeTab === Tab.Market && <Market />}
                        {activeTab === Tab.Options && <Options />}
                        {activeTab === Tab.University && <University />}
                        {activeTab === Tab.Hunting && <Hunting />}
                        {activeTab === Tab.Guild && <Guild onCharacterUpdate={() => api.getCharacter().then(setCharacter)} />}
                        {activeTab === Tab.Admin && <AdminPanel gameData={gameData} onGameDataUpdate={(k, d) => { setGameData(p => p ? ({ ...p, [k]: d }) : null); api.updateGameData(k, d); }} />}
                    </div>
                </main>

                <ModalManager 
                    expeditionReport={expeditionReport} pvpReport={pvpReport}
                    news={{ open: isNewsOpen, content: gameData.settings?.newsContent || '' }}
                    gameData={gameData} character={derivedCharacter}
                    onCloseExpedition={() => { api.getCharacter().then(updateCharacter); setExpeditionReport(null); }}
                    onClosePvp={() => { api.getCharacter().then(updateCharacter); setPvpReport(null); }}
                    onCloseNews={() => setIsNewsOpen(false)}
                />
            </div>
        </LanguageContext.Provider>
    );
}

export const App: React.FC = () => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    if (window.location.pathname.includes('/report/')) {
        const id = window.location.pathname.split('/').pop()!;
        return <PublicReportViewer reportId={id} />;
    }
    if (!token) return <LanguageContext.Provider value={{ lang: Language.PL, t: getT(Language.PL) }}><Auth onLoginSuccess={(t) => { localStorage.setItem('token', t); setToken(t); }} /></LanguageContext.Provider>;
    return <ErrorBoundary><CharacterProvider><AppContent /></CharacterProvider></ErrorBoundary>;
};
