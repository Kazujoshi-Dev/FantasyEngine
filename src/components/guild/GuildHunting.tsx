
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';
import { HuntingParty, PartyStatus, PartyMemberStatus } from '../../types';
import { useCharacter } from '@/contexts/CharacterContext';
import { UsersIcon } from '../icons/UsersIcon';
import { CrossedSwordsIcon } from '../icons/CrossedSwordsIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { ExpeditionSummaryModal } from '../combat/CombatSummary';

export const GuildHunting: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [parties, setParties] = useState<any[]>([]);
    const [myParty, setMyParty] = useState<HuntingParty | null>(null);
    const [loading, setLoading] = useState(false);
    const [serverTimeOffset, setServerTimeOffset] = useState(0);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    
    // Creation State
    const [selectedBossId, setSelectedBossId] = useState<string>('');
    const [createMembers, setCreateMembers] = useState(3);
    const [autoJoin, setAutoJoin] = useState(false);

    const { enemies, itemTemplates, affixes } = gameData || { enemies: [], itemTemplates: [], affixes: [] };
    const lobbyPollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const guildBosses = useMemo(() => {
        return enemies.filter(e => e.isBoss && e.isGuildBoss);
    }, [enemies]);

    useEffect(() => {
        if (guildBosses.length > 0 && (!selectedBossId || !guildBosses.find(b => b.id === selectedBossId))) {
            setSelectedBossId(guildBosses[0].id);
        }
    }, [guildBosses, selectedBossId]);

    const fetchParties = async () => {
        setLoading(true);
        try {
            const token = api.getAuthToken();
            const res = await fetch('/api/hunting/guild-parties', { headers: { 'Authorization': `Bearer ${token}` } });
            if(res.ok) setParties(await res.json());
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchMyParty = async () => {
        try {
            const { party, serverTime } = await api.getMyParty();
            if (party) {
                if (party.guildId) {
                    setMyParty(party);
                    if (serverTime) {
                        setServerTimeOffset(new Date(serverTime).getTime() - Date.now());
                    }
                    if (party.status === PartyStatus.Finished && !reportModalOpen) {
                        setReportModalOpen(true);
                    }
                } else {
                    setMyParty(null);
                }
            } else {
                setMyParty(null);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchParties();
        fetchMyParty();
        
        lobbyPollInterval.current = setInterval(() => {
            fetchMyParty();
            if (!myParty) fetchParties();
        }, 3000);

        return () => {
            if (lobbyPollInterval.current) clearInterval(lobbyPollInterval.current);
        };
    }, [myParty?.id]);

    const joinParty = async (id: number) => {
        try {
            await api.joinParty(id);
            await fetchMyParty();
        } catch(e: any) { alert(e.message); }
    };
    
    const handleCreate = async () => {
        if (!character) return;
        try {
            await api.createParty(selectedBossId, createMembers, true, autoJoin);
            await fetchMyParty();
            fetchParties();
        } catch (e: any) { alert(e.message); }
    };

    const handleLeave = async () => {
        if (!confirm(t('hunting.leaveConfirm'))) return;
        try {
            await api.leaveParty();
            setMyParty(null);
            fetchParties();
        } catch (e: any) { alert(e.message); }
    };

    const handleStart = async () => {
        try {
            await api.startParty();
            await fetchMyParty();
        } catch (e: any) { alert(e.message); }
    };

    const handleCancel = async () => {
        try {
            await api.cancelParty();
            await fetchMyParty();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleAction = async (userId: number, action: 'accept' | 'reject' | 'kick') => {
        try {
            await api.respondToJoinRequest(userId, action);
            await fetchMyParty();
        } catch (e: any) { alert(e.message); }
    };

    const disbandParty = async () => {
        if(!confirm('Czy na pewno chcesz rozwiązać grupę?')) return;
        try {
            await api.leaveParty();
            alert('Grupa rozwiązana.');
            fetchParties();
        } catch(e: any) { alert(e.message); }
    };

    const selectedBoss = useMemo(() => guildBosses.find(b => b.id === selectedBossId), [guildBosses, selectedBossId]);
    
    const scaledBossStatsCreation = useMemo(() => {
        if (!selectedBoss) return null;
        const healthMult = 1 + Math.max(0, createMembers - 2) * 0.7;
        const damageMult = 1 + Math.max(0, createMembers - 2) * 0.1;
        return {
            maxHealth: Math.floor(selectedBoss.stats.maxHealth * healthMult),
            minDamage: Math.floor(selectedBoss.stats.minDamage * damageMult),
            maxDamage: Math.floor(selectedBoss.stats.maxDamage * damageMult)
        };
    }, [selectedBoss, createMembers]);

    const estimatedRewardsCreation = useMemo(() => {
        if (!selectedBoss) return null;
        const bonusMult = 1.0 + (createMembers * 0.3);
        return {
            minGold: Math.floor(selectedBoss.rewards.minGold * bonusMult),
            maxGold: Math.floor(selectedBoss.rewards.maxGold * bonusMult),
            minExp: Math.floor(selectedBoss.rewards.minExperience * bonusMult),
            maxExp: Math.floor(selectedBoss.rewards.maxExperience * bonusMult),
        }
    }, [selectedBoss, createMembers]);

    const reportData = useMemo(() => {
        if (!myParty) return null;
        
        // VITAL FIX: Extract stats from Turn 0 snapshot
        const logStats = myParty.combatLog?.[0]?.partyMemberStats || {};
        const enrichedMembers = myParty.members.map(m => ({
            ...m,
            stats: m.stats || logStats[m.characterName]
        }));

        return {
            combatLog: myParty.combatLog || [],
            isVictory: myParty.victory || false,
            totalGold: myParty.myRewards?.gold || 0,
            totalExperience: myParty.myRewards?.experience || 0,
            rewardBreakdown: [],
            itemsFound: myParty.myRewards?.items || [],
            essencesFound: myParty.myRewards?.essences || {},
            huntingMembers: enrichedMembers,
            allRewards: myParty.allRewards,
            encounteredEnemies: [] 
        };
    }, [myParty]);

    if(!gameData || !character) return null;

    if (myParty && (myParty.status === PartyStatus.Finished || reportModalOpen)) {
         return (
             <div className="h-[75vh] flex items-center justify-center">
                 <button onClick={() => setReportModalOpen(true)} className="px-6 py-3 bg-indigo-600 rounded text-white font-bold shadow-lg animate-pulse">
                     Zobacz Wynik Walki
                 </button>
                 {reportModalOpen && reportData && (
                     <div className="fixed inset-0 bg-gray-900 z-50 overflow-auto">
                        <ExpeditionSummaryModal 
                            reward={reportData}
                            onClose={() => {
                                api.getCharacter().then(updateCharacter);
                                api.leaveParty().then(() => {
                                    setMyParty(null);
                                    setReportModalOpen(false);
                                });
                            }}
                            characterName={character.name}
                            itemTemplates={itemTemplates}
                            affixes={affixes}
                            enemies={enemies}
                            isHunting={true}
                            huntingMembers={reportData.huntingMembers}
                            allRewards={myParty.allRewards}
                            initialEnemy={gameData.enemies.find(e => e.id === myParty.bossId)}
                            messageId={myParty.messageId}
                            backgroundImage={gameData.settings?.reportBackgroundUrl}
                        />
                     </div>
                 )}
             </div>
         );
    }

    if (myParty) {
        const isLeader = myParty.leaderId === character.id;
        const boss = enemies.find(e => e.id === myParty.bossId);
        const acceptedMembers = myParty.members.filter(m => m.status !== PartyMemberStatus.Pending);
        const pendingMembers = myParty.members.filter(m => m.status === PartyMemberStatus.Pending);
        
        let statusText = t(`hunting.status.${myParty.status}`);
        let timerText = '';

        if (myParty.status === PartyStatus.Preparing && myParty.startTime) {
            const startTimestamp = new Date(myParty.startTime).getTime();
            const prepTime = (boss?.preparationTimeSeconds || 30) * 1000;
            const fightStart = startTimestamp + prepTime;
            const now = Date.now() + serverTimeOffset;
            const diff = Math.ceil((fightStart - now) / 1000);
            
            if (diff > 0) timerText = `${diff}s`;
            else timerText = '0s';
        }

        const lobbyHealthMult = 1 + Math.max(0, myParty.maxMembers - 2) * 0.7;
        const lobbyDamageMult = 1 + Math.max(0, myParty.maxMembers - 2) * 0.1;
        const lobbyMaxHealth = boss ? Math.floor(boss.stats.maxHealth * lobbyHealthMult) : 0;
        const lobbyMinDamage = boss ? Math.floor(boss.stats.minDamage * lobbyDamageMult) : 0;
        const lobbyMaxDamage = boss ? Math.floor(boss.stats.maxDamage * lobbyDamageMult) : 0;

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[75vh]">
                <div className="bg-slate-900/40 p-4 rounded-xl border border-red-900/30">
                    <h3 className="text-xl font-bold text-red-400 mb-2">{boss?.name}</h3>
                    <div className="h-64 bg-slate-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-slate-700">
                            {boss?.image ? <img src={boss.image} className="w-full h-full object-contain" /> : <CrossedSwordsIcon className="h-16 w-16 text-red-700 opacity-50" />}
                    </div>
                    <p className="text-sm text-gray-400 italic mb-4">{boss?.description}</p>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>HP:</span> <span className="font-mono text-white">{lobbyMaxHealth}</span></div>
                        <div className="flex justify-between"><span>DMG:</span> <span className="font-mono text-white">{lobbyMinDamage}-{lobbyMaxDamage}</span></div>
                    </div>
                </div>

                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col md:col-span-2 border border-slate-700">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-400">{t('hunting.members')} ({acceptedMembers.length}/{myParty.maxMembers})</h3>
                            {myParty.autoJoin && <span className="text-xs text-green-400 font-bold uppercase border border-green-600 px-1 rounded">Otwarta Rekrutacja</span>}
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-400">{t('hunting.statusLabel')}: <span className="text-white font-bold">{statusText}</span></p>
                            {timerText && <p className="text-xl font-mono text-amber-400 animate-pulse">{t('hunting.startsIn')}: {timerText}</p>}
                        </div>
                    </div>

                    <div className="space-y-2 mb-6 overflow-y-auto max-h-60 pr-2">
                        {acceptedMembers.map((m, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold text-white border border-slate-600">
                                        {m.characterName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className={`font-bold ${m.userId === myParty.leaderId ? 'text-amber-400' : 'text-white'}`}>{m.characterName}</p>
                                        <p className="text-xs text-gray-400">Lvl {m.level} {t(`race.${m.race}`)} {m.characterClass ? t(`class.${m.characterClass}`) : ''}</p>
                                    </div>
                                </div>
                                {isLeader && m.userId !== character.id && (
                                    <button onClick={() => handleAction(m.userId, 'kick')} className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1">Wyrzuć</button>
                                )}
                            </div>
                        ))}
                        {Array.from({ length: myParty.maxMembers - acceptedMembers.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="flex items-center justify-center bg-slate-800/30 p-3 rounded border border-slate-800 border-dashed text-gray-600">
                                {t('hunting.emptySlot')}
                            </div>
                        ))}
                    </div>

                    {isLeader && pendingMembers.length > 0 && (
                        <div className="mb-4 pt-4 border-t border-slate-700">
                            <h4 className="text-sm font-bold text-gray-400 mb-2">Oczekujący</h4>
                            <div className="space-y-2">
                                {pendingMembers.map(m => (
                                    <div key={m.userId} className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                                        <span className="text-sm text-gray-300">{m.characterName} (Lvl {m.level})</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleAction(m.userId, 'accept')} className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs text-white">Akceptuj</button>
                                            <button onClick={() => handleAction(m.userId, 'reject')} className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white">Odrzuć</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-700">
                        <button onClick={handleLeave} className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 rounded border border-red-800">
                            {isLeader ? t('hunting.disband') : t('hunting.leave')}
                        </button>
                        <div className="flex gap-4">
                            {isLeader && myParty.status === PartyStatus.Preparing && (
                                <button onClick={handleCancel} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded shadow-lg">
                                    Anuluj Wyprawę
                                </button>
                            )}
                            {isLeader && acceptedMembers.length >= 2 && myParty.status === PartyStatus.Forming && (
                                <button onClick={handleStart} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg animate-pulse">
                                    Rozpocznij
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-fade-in">
            <div className="flex flex-col gap-6">
                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-xl font-bold text-purple-400 mb-6 flex items-center gap-2">
                        <ShieldIcon className="h-6 w-6"/> Utwórz Polowanie Gildyjne
                    </h3>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Wybierz Bossa Gildyjnego</label>
                            <select 
                                value={selectedBossId} 
                                onChange={(e) => setSelectedBossId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                {guildBosses.map(boss => (
                                    <option key={boss.id} value={boss.id}>{boss.name}</option>
                                ))}
                                {guildBosses.length === 0 && <option value="" disabled>Brak bossów gildyjnych</option>}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Rozmiar Grupy</label>
                            <select
                                value={createMembers}
                                onChange={(e) => setCreateMembers(parseInt(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                <option value={2}>2 Graczy (Minimum)</option>
                                <option value={3}>3 Graczy</option>
                                <option value={4}>4 Graczy</option>
                                <option value={5}>5 Graczy (Pełna)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-2">Większa drużyna = trudniejsza walka i lepsze nagrody.</p>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded border border-slate-700">
                             <input 
                                type="checkbox" 
                                id="autoJoin" 
                                checked={autoJoin} 
                                onChange={(e) => setAutoJoin(e.target.checked)}
                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <div className="flex flex-col">
                                <label htmlFor="autoJoin" className="text-sm font-bold text-white cursor-pointer">Otwarta rekrutacja</label>
                                <span className="text-xs text-gray-400">Członkowie gildii dołączają automatycznie bez akceptacji lidera.</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleCreate} 
                            disabled={character.stats.currentHealth <= 0 || !selectedBossId}
                            className="w-full py-3 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            <UsersIcon className="h-5 w-5"/> Utwórz Grupę
                        </button>
                    </div>
                </div>

                {selectedBoss && scaledBossStatsCreation && (
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-red-900/30 flex-grow">
                        <h4 className="text-lg font-bold text-red-400 mb-4 text-center border-b border-red-900/30 pb-2">Podgląd Celu</h4>
                        <div className="flex flex-col items-center">
                            <div className="h-32 w-32 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border-4 border-slate-700 shadow-xl mb-4">
                                {selectedBoss.image ? (
                                    <img src={selectedBoss.image} className="w-full h-full object-cover" alt={selectedBoss.name} />
                                ) : (
                                    <CrossedSwordsIcon className="h-16 w-16 text-red-700 opacity-50" />
                                )}
                            </div>
                            <h5 className="font-bold text-white text-lg">{selectedBoss.name}</h5>
                            <p className="text-sm text-gray-400 italic text-center mb-4">{selectedBoss.description}</p>
                            
                            <div className="grid grid-cols-2 gap-4 w-full text-sm font-mono text-gray-300 bg-slate-800/50 p-3 rounded-lg mb-4">
                                <div className="text-center">HP: <span className="text-white font-bold">{scaledBossStatsCreation.maxHealth}</span></div>
                                <div className="text-center">DMG: <span className="text-white font-bold">{scaledBossStatsCreation.minDamage}-{scaledBossStatsCreation.maxDamage}</span></div>
                            </div>

                            {estimatedRewardsCreation && (
                                <div className="w-full bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                    <p className="text-gray-500 text-[10px] uppercase tracking-widest text-center mb-2">Nagrody (Os.)</p>
                                    <div className="flex justify-around items-center">
                                        <div className="text-amber-400 font-bold flex items-center gap-1"><CoinsIcon className="h-4 w-4"/> {estimatedRewardsCreation.minGold}-{estimatedRewardsCreation.maxGold}</div>
                                        <div className="text-sky-400 font-bold flex items-center gap-1"><StarIcon className="h-4 w-4"/> {estimatedRewardsCreation.minExp}-{estimatedRewardsCreation.maxExp}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col h-[70vh]">
                <h3 className="text-xl font-bold text-purple-400 mb-4 flex justify-between items-center">
                    <span>Aktywne Polowania</span>
                    <span className="text-xs bg-slate-800 text-gray-400 px-2 py-1 rounded">{parties.length}</span>
                </h3>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {parties.length === 0 && <p className="text-gray-500 text-center py-12 italic">Brak aktywnych polowań w gildii.</p>}
                    {parties.map(p => {
                        const boss = gameData.enemies.find(e => e.id === p.bossId);
                        const isLeader = character.id === p.leaderId;
                        
                        return (
                            <div key={p.id} className="bg-slate-800 p-4 rounded-lg border border-purple-500/30 hover:border-purple-500 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            {boss?.name} 
                                            <span className="text-[10px] bg-purple-900 text-purple-200 px-1.5 rounded border border-purple-700 uppercase">Gildia</span>
                                            {p.autoJoin && <span className="text-[10px] bg-green-900 text-green-200 px-1.5 rounded border border-green-700 uppercase">Otwarta</span>}
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">Lider: {p.leaderName}</p>
                                    </div>
                                    
                                    {isLeader ? (
                                        <button 
                                            onClick={disbandParty}
                                            className="px-4 py-1.5 bg-red-800 hover:bg-red-700 rounded text-xs font-bold text-white shadow transition-colors"
                                        >
                                            Rozwiąż
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => joinParty(p.id)} 
                                            disabled={character.stats.currentHealth <= 0}
                                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white shadow transition-colors disabled:bg-slate-600"
                                        >
                                            Dołącz
                                        </button>
                                    )}
                                </div>
                                
                                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                                    <div className="bg-purple-500 h-full transition-all" style={{width: `${(p.currentMembersCount / p.maxMembers) * 100}%`}}></div>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-400">
                                    <span>Gracze</span>
                                    <span className="text-white font-mono">{p.currentMembersCount} / {p.maxMembers}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
