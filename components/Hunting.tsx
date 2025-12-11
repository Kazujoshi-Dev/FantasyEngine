
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { PlayerCharacter, Enemy, HuntingParty, PartyMemberStatus, PartyStatus, ItemTemplate, Affix, GameData } from '../types';
import { ExpeditionSummaryModal } from './combat/CombatSummary';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { UsersIcon } from './icons/UsersIcon';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { useCharacter } from '@/contexts/CharacterContext';

export const Hunting: React.FC = () => {
    const { character, gameData } = useCharacter();
    const { t } = useTranslation();
    const [view, setView] = useState<'DASHBOARD' | 'LOBBY' | 'COMBAT'>('DASHBOARD');
    const [parties, setParties] = useState<any[]>([]);
    const [myParty, setMyParty] = useState<HuntingParty | null>(null);
    
    // Form State
    const [selectedBossId, setSelectedBossId] = useState<string>('');
    const [createMembers, setCreateMembers] = useState(3);
    
    const [loading, setLoading] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [serverTimeOffset, setServerTimeOffset] = useState(0);

    const lobbyPollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    if (!character || !gameData) return null;
    const { enemies, itemTemplates, affixes } = gameData;

    // Filter for bosses only AND exclude guild bosses
    const bosses = useMemo(() => enemies.filter(e => e.isBoss && !e.isGuildBoss), [enemies]);
    
    // Auto-select first boss
    useEffect(() => {
        if (bosses.length > 0 && !selectedBossId) {
            setSelectedBossId(bosses[0].id);
        }
    }, [bosses, selectedBossId]);

    const fetchParties = async () => {
        setLoading(true);
        try {
            const data = await api.getHuntingParties();
            setParties(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchMyParty = async () => {
        try {
            const { party, serverTime } = await api.getMyParty();
            if (party) {
                setMyParty(party);
                if (serverTime) {
                    setServerTimeOffset(new Date(serverTime).getTime() - Date.now());
                }
                
                if (party.status === PartyStatus.Forming || party.status === PartyStatus.Preparing) {
                    setView('LOBBY');
                } else if (party.status === PartyStatus.Fighting || party.status === PartyStatus.Finished) {
                    setView('COMBAT');
                    // Automatically open report if finished and just loaded
                    if (party.status === PartyStatus.Finished) {
                        setReportModalOpen(true);
                    }
                }
            } else {
                setMyParty(null);
                setView('DASHBOARD');
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchMyParty();
        fetchParties();
        
        // Poll for party status updates
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
            await api.createParty(selectedBossId, createMembers);
            await fetchMyParty();
        } catch (e: any) { alert(e.message); }
    };

    const handleJoin = async (partyId: number) => {
        try {
            await api.joinParty(partyId);
            await fetchMyParty();
        } catch (e: any) { alert(e.message); }
    };

    const handleLeave = async () => {
        if (!confirm(t('hunting.leaveConfirm'))) return;
        try {
            await api.leaveParty();
            await fetchMyParty();
            setView('DASHBOARD');
        } catch (e: any) { alert(e.message); }
    };

    const handleAction = async (userId: number, action: 'accept' | 'reject' | 'kick') => {
        try {
            await api.respondToJoinRequest(userId, action);
            await fetchMyParty();
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
            await fetchMyParty(); // Refresh the party state
        } catch (e: any) {
            alert(e.message);
        }
    };

    const selectedBoss = useMemo(() => bosses.find(b => b.id === selectedBossId), [bosses, selectedBossId]);

    // Calculate Scaled Stats for Display
    const scaledBossStats = useMemo(() => {
        if (!selectedBoss) return null;
        
        // Scaling Logic (Must match backend logic in hunting.ts)
        // 1-2 Players: Base Stats (1.0x)
        // 3+ Players: +70% HP per player > 2, +10% DMG per player > 2
        const healthMult = 1 + Math.max(0, createMembers - 2) * 0.7;
        const damageMult = 1 + Math.max(0, createMembers - 2) * 0.1;

        return {
            maxHealth: Math.floor(selectedBoss.stats.maxHealth * healthMult),
            minDamage: Math.floor(selectedBoss.stats.minDamage * damageMult),
            maxDamage: Math.floor(selectedBoss.stats.maxDamage * damageMult)
        };
    }, [selectedBoss, createMembers]);

    const estimatedRewards = useMemo(() => {
        if (!selectedBoss) return null;
        // Dynamic bonus multiplier based on party size (matches backend logic)
        const bonusMult = 1.0 + (createMembers * 0.3);

        return {
            minGold: Math.floor(selectedBoss.rewards.minGold * bonusMult),
            maxGold: Math.floor(selectedBoss.rewards.maxGold * bonusMult),
            minExp: Math.floor(selectedBoss.rewards.minExperience * bonusMult),
            maxExp: Math.floor(selectedBoss.rewards.maxExperience * bonusMult),
        }
    }, [selectedBoss, createMembers]);

    // Report data preparation
    const reportData = useMemo(() => {
        if (!myParty) return null;
        return {
            combatLog: myParty.combatLog || [],
            isVictory: myParty.victory || false,
            totalGold: myParty.myRewards?.gold || 0,
            totalExperience: myParty.myRewards?.experience || 0,
            rewardBreakdown: [],
            itemsFound: myParty.myRewards?.items || [],
            essencesFound: myParty.myRewards?.essences || {},
            huntingMembers: myParty.members,
            allRewards: myParty.allRewards,
            encounteredEnemies: selectedBoss ? [selectedBoss] : []
        };
    }, [myParty, selectedBoss]);

    // --- RENDER: Combat View ---
    if (view === 'COMBAT' && myParty) {
        return (
            <div className="fixed inset-0 bg-gray-900 z-50 overflow-auto">
                <ExpeditionSummaryModal 
                    reward={reportData!}
                    onClose={() => {
                        if (myParty.status === PartyStatus.Finished) {
                            api.leaveParty().then(() => {
                                setMyParty(null);
                                setView('DASHBOARD');
                            });
                        } else {
                            setReportModalOpen(false);
                        }
                    }}
                    characterName={character.name}
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    enemies={enemies}
                    isHunting={true}
                    huntingMembers={myParty.members}
                    allRewards={myParty.allRewards}
                    initialEnemy={gameData.enemies.find(e => e.id === myParty.bossId)}
                    messageId={myParty.messageId}
                />
            </div>
        );
    }

    // --- RENDER: Lobby View (Inside a party) ---
    if (view === 'LOBBY' && myParty) {
        const isLeader = myParty.leaderId === character.id;
        const boss = gameData.enemies.find(e => e.id === myParty.bossId);
        const acceptedMembers = myParty.members.filter(m => m.status !== PartyMemberStatus.Pending);
        const pendingMembers = myParty.members.filter(m => m.status === PartyMemberStatus.Pending);
        const isFull = acceptedMembers.length >= myParty.maxMembers;
        
        let statusText = t(`hunting.status.${myParty.status}`);
        let timerText = '';

        if (myParty.status === PartyStatus.Preparing && myParty.startTime) {
            const startTimestamp = new Date(myParty.startTime).getTime();
            const prepTime = (boss?.preparationTimeSeconds || 30) * 1000;
            const fightStart = startTimestamp + prepTime;
            const now = Date.now() + serverTimeOffset;
            const diff = Math.ceil((fightStart - now) / 1000);
            
            if (diff > 0) {
                timerText = `${diff}s`;
            } else {
                timerText = '0s';
            }
        }
        
        // Calculate scaled stats for lobby view based on maxMembers of the party
        const lobbyHealthMult = 1 + Math.max(0, myParty.maxMembers - 2) * 0.7;
        const lobbyDamageMult = 1 + Math.max(0, myParty.maxMembers - 2) * 0.1;
        const lobbyMaxHealth = boss ? Math.floor(boss.stats.maxHealth * lobbyHealthMult) : 0;
        const lobbyMinDamage = boss ? Math.floor(boss.stats.minDamage * lobbyDamageMult) : 0;
        const lobbyMaxDamage = boss ? Math.floor(boss.stats.maxDamage * lobbyDamageMult) : 0;

        return (
            <ContentPanel title={t('hunting.title')}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Boss Info */}
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

                    {/* Middle: Members */}
                    <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col md:col-span-2">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-indigo-400">{t('hunting.members')} ({acceptedMembers.length}/{myParty.maxMembers})</h3>
                            <div className="text-right">
                                <p className="text-sm text-gray-400">{t('hunting.statusLabel')}: <span className="text-white font-bold">{statusText}</span></p>
                                {timerText && <p className="text-xl font-mono text-amber-400 animate-pulse">{t('hunting.startsIn')}: {timerText}</p>}
                            </div>
                        </div>

                        <div className="space-y-2 mb-6">
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
                                {isLeader && isFull && myParty.status === PartyStatus.Forming && (
                                    <button onClick={handleStart} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg animate-pulse">
                                        Rozpocznij
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    // --- RENDER: Dashboard View (Main) ---
    return (
        <ContentPanel title={t('hunting.title')}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
                
                {/* Column 1: Controls (Create Party) */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 border border-slate-700">
                    <h3 className="text-xl font-bold text-indigo-400 mb-6">{t('hunting.create')}</h3>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('hunting.chooseBoss')}</label>
                            <select 
                                value={selectedBossId} 
                                onChange={(e) => setSelectedBossId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            >
                                {bosses.map(boss => (
                                    <option key={boss.id} value={boss.id}>{boss.name} (Lvl {boss.stats.maxHealth > 1000 ? 'Boss' : 'Mini'})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('hunting.partySize')}</label>
                            <select
                                value={createMembers}
                                onChange={(e) => setCreateMembers(parseInt(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            >
                                <option value={1}>1 Gracz (Solo)</option>
                                <option value={2}>2 Graczy</option>
                                <option value={3}>3 Graczy</option>
                                <option value={4}>4 Graczy</option>
                                <option value={5}>5 Graczy (Pełna)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-2">Większa drużyna = większe nagrody, ale boss jest silniejszy.</p>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={handleCreate} 
                                disabled={character.stats.currentHealth <= 0}
                                title={character.stats.currentHealth <= 0 ? "Nie możesz stworzyć grupy z 0 HP." : ""}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded text-white font-bold shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:bg-slate-600 disabled:cursor-not-allowed"
                            >
                                <UsersIcon className="h-5 w-5"/> {t('hunting.create')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Column 2: Boss Info & Rewards */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 border border-slate-700">
                    <h3 className="text-xl font-bold text-red-400 mb-4 text-center">Cel Polowania</h3>
                    {selectedBoss && scaledBossStats ? (
                        <div className="flex flex-col h-full">
                            <div className="text-center mb-4">
                                <h4 className="text-lg font-bold text-white mb-2">{selectedBoss.name}</h4>
                                <div className="h-48 w-48 mx-auto bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border-4 border-slate-700 shadow-xl mb-4">
                                    {selectedBoss.image ? (
                                        <img src={selectedBoss.image} className="w-full h-full object-cover" alt={selectedBoss.name} />
                                    ) : (
                                        <CrossedSwordsIcon className="h-20 w-20 text-red-700 opacity-50" />
                                    )}
                                </div>
                                <div className="flex justify-center gap-4 text-sm font-mono text-gray-300 bg-slate-800/50 py-2 rounded-lg mx-4">
                                    <span className="flex items-center gap-1">HP: <span className="text-white">{scaledBossStats.maxHealth}</span></span>
                                    <span className="text-gray-600">|</span>
                                    <span className="flex items-center gap-1">DMG: <span className="text-white">{scaledBossStats.minDamage}-{scaledBossStats.maxDamage}</span></span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 px-4 italic">{selectedBoss.description}</p>
                            </div>

                            {estimatedRewards && (
                                <div className="mt-auto bg-slate-800/80 p-4 rounded-lg border border-slate-700">
                                    <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-3">Szacowane Nagrody (Na Osobę)</p>
                                    <div className="grid grid-cols-2 gap-4 divide-x divide-slate-700">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-amber-400 font-mono font-bold text-lg">
                                                <CoinsIcon className="h-4 w-4" />
                                                <span>{estimatedRewards.minGold}-{estimatedRewards.maxGold}</span>
                                            </div>
                                            <span className="text-xs text-gray-500">Złota</span>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-sky-400 font-mono font-bold text-lg">
                                                <StarIcon className="h-4 w-4" />
                                                <span>{estimatedRewards.minExp}-{estimatedRewards.maxExp}</span>
                                            </div>
                                            <span className="text-xs text-gray-500">XP</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 italic">
                            Wybierz bossa z menu po lewej stronie.
                        </div>
                    )}
                </div>

                {/* Column 3: Party List */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-indigo-400">{t('hunting.availableParties')}</h3>
                        <span className="text-xs text-gray-500 bg-slate-800 px-2 py-1 rounded">{parties.length}</span>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                        {parties.length === 0 && (
                            <div className="text-center py-12 text-gray-500 italic">
                                <p>{t('hunting.noParties')}</p>
                                <p className="text-xs mt-2">Bądź pierwszy i utwórz grupę!</p>
                            </div>
                        )}
                        {parties.map(party => {
                            const boss = gameData.enemies.find(e => e.id === party.bossId);
                            return (
                                <div key={party.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-indigo-500 transition-colors">
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
                                            disabled={character.stats.currentHealth <= 0}
                                            title={character.stats.currentHealth <= 0 ? "Nie możesz dołączyć z 0 HP." : ""}
                                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
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
        </ContentPanel>
    );
};
