
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { PlayerCharacter, Enemy, HuntingParty, PartyMember, PartyStatus, PartyMemberStatus, ItemTemplate, Affix, GameData } from '../types';
import { ExpeditionSummaryModal } from './Expedition';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { ClockIcon } from './icons/ClockIcon';
import { UsersIcon } from './icons/UsersIcon';

interface HuntingProps {
    character: PlayerCharacter;
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    gameData: GameData;
}

export const Hunting: React.FC<HuntingProps> = ({ character, enemies, itemTemplates, affixes, gameData }) => {
    const { t } = useTranslation();
    const [view, setView] = useState<'LIST' | 'CREATE' | 'LOBBY' | 'COMBAT'>('LIST');
    const [parties, setParties] = useState<any[]>([]);
    const [myParty, setMyParty] = useState<HuntingParty | null>(null);
    const [selectedBossId, setSelectedBossId] = useState<string>('');
    const [createMembers, setCreateMembers] = useState(3);
    const [loading, setLoading] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [serverTimeOffset, setServerTimeOffset] = useState(0);

    const lobbyPollInterval = useRef<NodeJS.Timeout | null>(null);

    // Filter for bosses only
    const bosses = useMemo(() => enemies.filter(e => e.isBoss), [enemies]);
    
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
                if (view !== 'CREATE') setView('LIST');
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchMyParty();
        fetchParties();
        
        // Poll for party status updates
        lobbyPollInterval.current = setInterval(() => {
            fetchMyParty();
            if(view === 'LIST') fetchParties();
        }, 2000);

        return () => {
            if (lobbyPollInterval.current) clearInterval(lobbyPollInterval.current);
        };
    }, []);

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
            setView('LIST');
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

    const selectedBoss = useMemo(() => bosses.find(b => b.id === selectedBossId), [bosses, selectedBossId]);

    const estimatedRewards = useMemo(() => {
        if (!selectedBoss) return null;
        // Dynamic bonus multiplier based on party size (matches backend logic)
        // 1 Player: 1.3x, 5 Players: 2.5x
        const bonusMult = 1.0 + (createMembers * 0.3);

        return {
            minGold: Math.floor(selectedBoss.rewards.minGold * bonusMult),
            maxGold: Math.floor(selectedBoss.rewards.maxGold * bonusMult),
            minExp: Math.floor(selectedBoss.rewards.minExperience * bonusMult),
            maxExp: Math.floor(selectedBoss.rewards.maxExperience * bonusMult),
        }
    }, [selectedBoss, createMembers]);

    // Use the "frozen" report data if it exists; otherwise, fall back to the live party state.
    // This makes the report modal immutable once the hunt finishes.
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

    // Render Logic
    
    if (view === 'COMBAT' && myParty) {
        return (
            <div className="fixed inset-0 bg-gray-900 z-50 overflow-auto">
                <ExpeditionSummaryModal 
                    reward={reportData!}
                    onClose={() => {
                        if (myParty.status === PartyStatus.Finished) {
                            // Leave party on close
                            api.leaveParty().then(() => {
                                setMyParty(null);
                                setView('LIST');
                            });
                        } else {
                            // Just close modal if inspecting history, but usually this is full screen
                            setReportModalOpen(false);
                        }
                    }}
                    characterName={character.name}
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    isHunting={true}
                    huntingMembers={myParty.members}
                    allRewards={myParty.allRewards}
                    initialEnemy={gameData.enemies.find(e => e.id === myParty.bossId)}
                    messageId={myParty.messageId}
                />
            </div>
        );
    }

    // Lobby View
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

        return (
            <ContentPanel title={t('hunting.title')}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Boss Info */}
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-red-900/30">
                        <h3 className="text-xl font-bold text-red-400 mb-2">{boss?.name}</h3>
                        <div className="h-40 bg-slate-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                             {boss?.image ? <img src={boss.image} className="w-full h-full object-cover" /> : <CrossedSwordsIcon className="h-16 w-16 text-red-700 opacity-50" />}
                        </div>
                        <p className="text-sm text-gray-400 italic mb-4">{boss?.description}</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>HP:</span> <span className="font-mono text-white">{boss?.stats.maxHealth}</span></div>
                            <div className="flex justify-between"><span>DMG:</span> <span className="font-mono text-white">{boss?.stats.minDamage}-{boss?.stats.maxDamage}</span></div>
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
                                        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold">
                                            {m.characterName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className={`font-bold ${m.userId === myParty.leaderId ? 'text-amber-400' : 'text-white'}`}>{m.characterName}</p>
                                            <p className="text-xs text-gray-400">Lvl {m.level} {t(`race.${m.race}`)} {m.characterClass ? t(`class.${m.characterClass}`) : ''}</p>
                                        </div>
                                    </div>
                                    {isLeader && m.userId !== character.id && (
                                        <button onClick={() => handleAction(m.userId, 'kick')} className="text-red-400 hover:text-red-300 text-xs">Wyrzuć</button>
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
                                            <span className="text-sm">{m.characterName} (Lvl {m.level})</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAction(m.userId, 'accept')} className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs">Akceptuj</button>
                                                <button onClick={() => handleAction(m.userId, 'reject')} className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs">Odrzuć</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-auto flex justify-between pt-4 border-t border-slate-700">
                            <button onClick={handleLeave} className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 rounded border border-red-800">
                                {isLeader ? t('hunting.disband') : t('hunting.leave')}
                            </button>
                            {isLeader && isFull && myParty.status === PartyStatus.Forming && (
                                <button onClick={handleStart} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg animate-pulse">
                                    Rozpocznij
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    // List/Create View
    return (
        <ContentPanel title={t('hunting.title')}>
            {view === 'LIST' ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-indigo-400">{t('hunting.availableParties')}</h3>
                        <button 
                            onClick={() => setView('CREATE')} 
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold flex items-center gap-2"
                        >
                            <UsersIcon className="h-5 w-5"/> {t('hunting.create')}
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {parties.length === 0 && <p className="text-gray-500 col-span-2 text-center py-8">{t('hunting.noParties')}</p>}
                        {parties.map(party => {
                            const boss = gameData.enemies.find(e => e.id === party.bossId);
                            return (
                                <div key={party.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 hover:border-indigo-500 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-white">{boss?.name || 'Unknown Boss'}</h4>
                                        <span className="text-xs bg-indigo-900 px-2 py-1 rounded text-indigo-200">Lider: {party.leaderName}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-4">
                                        <div className="text-sm text-gray-400">
                                            Członkowie: <span className="text-white font-mono">{party.currentMembersCount}/{party.maxMembers}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleJoin(party.id)} 
                                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold"
                                        >
                                            {t('hunting.join')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="max-w-2xl mx-auto bg-slate-900/40 p-6 rounded-xl">
                    <h3 className="text-xl font-bold text-indigo-400 mb-6">{t('hunting.create')}</h3>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('hunting.chooseBoss')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2">
                                {bosses.map(boss => (
                                    <div 
                                        key={boss.id} 
                                        onClick={() => setSelectedBossId(boss.id)}
                                        className={`p-3 rounded border cursor-pointer flex items-center gap-3 transition-all ${selectedBossId === boss.id ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                                    >
                                        <div className="w-10 h-10 bg-slate-900 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                                            {boss.image ? <img src={boss.image} className="w-full h-full object-cover"/> : <CrossedSwordsIcon className="h-6 w-6 text-gray-500"/>}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-sm truncate">{boss.name}</p>
                                            <p className="text-xs text-gray-400 truncate">HP: {boss.stats.maxHealth}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('hunting.partySize')}: {createMembers}</label>
                            <input 
                                type="range" 
                                min="1" // Lone Wolf allows 1, else 2. Backend validates.
                                max="5" 
                                value={createMembers} 
                                onChange={e => setCreateMembers(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>1 (Solo)</span>
                                <span>5 (Full)</span>
                            </div>
                        </div>

                        {estimatedRewards && (
                            <div className="bg-slate-800/50 p-4 rounded text-sm border border-slate-700">
                                <p className="text-gray-400 mb-2 font-semibold">Szacowane nagrody na osobę:</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center text-amber-400">
                                        <span className="font-mono">{estimatedRewards.minGold}-{estimatedRewards.maxGold}</span>
                                        <span className="ml-1 text-xs">Złota</span>
                                    </div>
                                    <div className="flex items-center text-sky-400">
                                        <span className="font-mono">{estimatedRewards.minExp}-{estimatedRewards.maxExp}</span>
                                        <span className="ml-1 text-xs">XP</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 italic">* Nagrody skalują się z wielkością grupy.</p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <button onClick={() => setView('LIST')} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-bold">Anuluj</button>
                            <button onClick={handleCreate} className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold">Utwórz</button>
                        </div>
                    </div>
                </div>
            )}
        </ContentPanel>
    );
};
