


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api, getAuthToken } from '../../api';
import { PlayerCharacter, Enemy, HuntingParty, PartyMemberStatus, PartyStatus, GameData } from '../../types';
import { CrossedSwordsIcon } from '../icons/CrossedSwordsIcon';
import { UsersIcon } from '../icons/UsersIcon';

export const GuildHunting: React.FC = () => {
    const { t } = useTranslation();
    const [view, setView] = useState<'DASHBOARD' | 'LOBBY' | 'COMBAT'>('DASHBOARD');
    const [parties, setParties] = useState<any[]>([]);
    const [myParty, setMyParty] = useState<HuntingParty | null>(null);
    const [gameData, setGameData] = useState<GameData | null>(null);
    
    // Form State
    const [selectedBossId, setSelectedBossId] = useState<string>('');
    const [createMembers, setCreateMembers] = useState(3);
    
    const [loading, setLoading] = useState(false);

    const lobbyPollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchGameData = async () => {
        try {
            const data = await api.getGameData();
            setGameData(data);
        } catch(e) { console.error(e); }
    }

    // Filter for GUILD bosses only
    const guildBosses = useMemo(() => {
        if(!gameData) return [];
        return gameData.enemies.filter(e => e.isBoss && e.isGuildBoss);
    }, [gameData]);
    
    // Auto-select first boss
    useEffect(() => {
        if (guildBosses.length > 0 && !selectedBossId) {
            setSelectedBossId(guildBosses[0].id);
        }
    }, [guildBosses, selectedBossId]);

    const fetchParties = async () => {
        setLoading(true);
        try {
            // Use raw fetch to call guild-specific endpoint
            const token = getAuthToken();
            const res = await fetch('/api/hunting/guild-parties', {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            if(res.ok) {
                 const data = await res.json();
                 setParties(data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchMyParty = async () => {
        try {
            const { party } = await api.getMyParty();
            if (party && party.guildId) { // Only if it's a guild party or any party?
                // Actually, we should redirect user to main hunting tab if they are in a global party, 
                // but for now lets assume MyParty returns any party.
                // We just render lobby state.
                setMyParty(party);
                
                if (party.status === PartyStatus.Forming || party.status === PartyStatus.Preparing) {
                    setView('LOBBY');
                } else if (party.status === PartyStatus.Fighting || party.status === PartyStatus.Finished) {
                    setView('COMBAT');
                    // Redirect to main hunting tab for combat view
                    // Or render minimal combat view here?
                    // Better to redirect to main component to reuse logic
                }
            } else {
                setMyParty(null);
                setView('DASHBOARD');
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchGameData();
        fetchMyParty();
        fetchParties();
        
        lobbyPollInterval.current = setInterval(() => {
            fetchMyParty();
            if(view === 'DASHBOARD') fetchParties();
        }, 2000);

        return () => {
            if (lobbyPollInterval.current) clearInterval(lobbyPollInterval.current);
        };
    }, [view]);

    const handleCreate = async () => {
        try {
            const token = getAuthToken();
            const res = await fetch('/api/hunting/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ bossId: selectedBossId, maxMembers: createMembers, isGuildParty: true })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message);
            }
            await fetchMyParty();
        } catch (e: any) { alert(e.message); }
    };

    const handleJoin = async (partyId: number) => {
        try {
            await api.joinParty(partyId);
            await fetchMyParty();
        } catch (e: any) { alert(e.message); }
    };

    // Reuse Logic from Hunting.tsx for lobby view if possible, or minimal implementation
    // Since Combat is complex, if user is in party, show link to Main Hunting Tab

    if (view === 'COMBAT' || (view === 'LOBBY' && myParty)) {
        return (
            <div className="bg-slate-900/40 p-8 rounded-xl text-center h-full flex flex-col items-center justify-center">
                <h3 className="text-2xl font-bold text-indigo-400 mb-4">Jesteś w trakcie polowania!</h3>
                <p className="text-gray-400 mb-6">Przejdź do głównej zakładki "Polowanie" w menu bocznym, aby zarządzać grupą lub walczyć.</p>
                {/* We could add a redirect button if we had navigation context */}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[70vh]">
            
            {/* Column 1: Controls */}
            <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 border border-slate-700">
                <h3 className="text-xl font-bold text-purple-400 mb-6">Stwórz Polowanie Gildyjne</h3>
                
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('hunting.chooseBoss')}</label>
                        <select 
                            value={selectedBossId} 
                            onChange={(e) => setSelectedBossId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {guildBosses.map(boss => (
                                <option key={boss.id} value={boss.id}>{boss.name} (Lvl {boss.stats.maxHealth > 1000 ? 'Boss' : 'Mini'})</option>
                            ))}
                            {guildBosses.length === 0 && <option disabled>Brak dostępnych bossów gildyjnych</option>}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('hunting.partySize')}</label>
                        <select
                            value={createMembers}
                            onChange={(e) => setCreateMembers(parseInt(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value={2}>2 Graczy</option>
                            <option value={3}>3 Graczy</option>
                            <option value={4}>4 Graczy</option>
                            <option value={5}>5 Graczy (Pełna)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">Polowania gildyjne wymagają współpracy (min. 2 graczy).</p>
                    </div>

                    <div className="pt-4">
                        <button 
                            onClick={handleCreate} 
                            disabled={guildBosses.length === 0}
                            className="w-full py-3 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            <UsersIcon className="h-5 w-5"/> Rozpocznij Zbiórkę
                        </button>
                    </div>
                </div>
            </div>

            {/* Column 2: List */}
            <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-indigo-400">Aktywne Zbiórki Gildyjne</h3>
                    <span className="text-xs text-gray-500 bg-slate-800 px-2 py-1 rounded">{parties.length}</span>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                    {parties.length === 0 && (
                        <div className="text-center py-12 text-gray-500 italic">
                            <p>Brak aktywnych zbiórek w gildii.</p>
                        </div>
                    )}
                    {parties.map(party => {
                        const boss = gameData?.enemies.find(e => e.id === party.bossId);
                        return (
                            <div key={party.id} className="bg-slate-800 p-3 rounded-lg border border-purple-900/50 hover:border-purple-500 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center overflow-hidden">
                                            {boss?.image ? <img src={boss.image} className="w-full h-full object-cover"/> : <CrossedSwordsIcon className="h-4 w-4 text-gray-500"/>}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-sm">{boss?.name || 'Unknown'}</h4>
                                            <p className="text-xs text-gray-400">Lider: {party.leaderName}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleJoin(party.id)} 
                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white transition-colors"
                                    >
                                        {t('hunting.join')}
                                    </button>
                                </div>
                                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-2">
                                    <div 
                                        className="bg-green-500 h-full transition-all" 
                                        style={{ width: `${(party.currentMembersCount / party.maxMembers) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Gracze</span>
                                    <span>{party.currentMembersCount} / {party.maxMembers}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
