
import React, { useState, useEffect, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { PlayerCharacter, Enemy, ItemTemplate, Affix, GameData, HuntingParty, PartyStatus, PartyMemberStatus, PartyMember } from '../types';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { UsersIcon } from './icons/UsersIcon';
import { ClockIcon } from './icons/ClockIcon';

interface HuntingProps {
    character: PlayerCharacter;
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    gameData: GameData;
}

export const Hunting: React.FC<HuntingProps> = ({ character, enemies, itemTemplates, affixes, gameData }) => {
    const { t } = useTranslation();
    const [myParty, setMyParty] = useState<HuntingParty | null>(null);
    const [loading, setLoading] = useState(true);
    const [parties, setParties] = useState<any[]>([]); // active lobbies
    const [view, setView] = useState<'LOBBY' | 'CREATE'>('LOBBY');
    const [selectedBossId, setSelectedBossId] = useState<string>('');
    const [partySize, setPartySize] = useState<number>(3);

    // Polling for party status
    const fetchMyParty = useCallback(async () => {
        try {
            const res = await api.getMyParty();
            setMyParty(res.party);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMyParty();
        const interval = setInterval(fetchMyParty, 5000);
        return () => clearInterval(interval);
    }, [fetchMyParty]);

    // Fetch lobbies if not in party
    useEffect(() => {
        if (!myParty && view === 'LOBBY') {
            api.getHuntingParties().then(setParties).catch(console.error);
            const interval = setInterval(() => {
                if(!myParty) api.getHuntingParties().then(setParties).catch(console.error);
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [myParty, view]);

    const handleCreate = async () => {
        if (!selectedBossId) return;
        try {
            await api.createParty(selectedBossId, partySize);
            setView('LOBBY');
            fetchMyParty();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleJoin = async (partyId: number) => {
        try {
            await api.joinParty(partyId);
            fetchMyParty();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleLeave = async () => {
        if (!confirm(t('hunting.leaveConfirm'))) return;
        try {
            await api.leaveParty();
            setMyParty(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRespond = async (userId: number, action: 'accept' | 'reject' | 'kick') => {
        try {
            await api.respondToJoinRequest(userId, action);
            fetchMyParty();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleStart = async () => {
        try {
            await api.startParty();
            fetchMyParty();
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (loading) return <ContentPanel title={t('hunting.title')}><p>{t('loading')}</p></ContentPanel>;

    // ------------------ MY PARTY VIEW ------------------
    if (myParty) {
        const boss = enemies.find(e => e.id === myParty.bossId);
        const isLeader = myParty.leaderId === character.id;
        const pendingMembers = myParty.members.filter(m => m.status === PartyMemberStatus.Pending);
        const activeMembers = myParty.members.filter(m => m.status !== PartyMemberStatus.Pending);

        return (
            <ContentPanel title={t('hunting.title')}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Boss Info */}
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-red-900/30">
                        <h3 className="text-xl font-bold text-red-400 mb-2">{boss?.name}</h3>
                        <div className="h-64 bg-slate-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-slate-700">
                             {boss?.image ? <img src={boss.image} className="w-full h-full object-contain" /> : <CrossedSwordsIcon className="h-16 w-16 text-red-700 opacity-50" />}
                        </div>
                        <p className="text-sm text-gray-400 italic mb-4">{boss?.description}</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>HP:</span> <span className="font-mono text-white">{boss?.stats.maxHealth}</span></div>
                            <div className="flex justify-between"><span>DMG:</span> <span className="font-mono text-white">{boss?.stats.minDamage}-{boss?.stats.maxDamage}</span></div>
                        </div>
                    </div>

                    {/* Middle: Party Status & Members */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                            <div>
                                <p className="text-gray-400 text-sm">{t('hunting.statusLabel')}</p>
                                <p className="text-xl font-bold text-white uppercase tracking-wider">{t(`hunting.status.${myParty.status}` as any)}</p>
                            </div>
                            {myParty.status === PartyStatus.Preparing && myParty.startTime && (
                                <div className="text-right">
                                    <p className="text-gray-400 text-sm">{t('hunting.startsIn')}</p>
                                    <p className="text-2xl font-mono text-amber-400 animate-pulse">
                                        <Countdown target={myParty.startTime} offset={30000} /> {/* Assuming 30s prep time */}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900/40 p-4 rounded-xl">
                            <h4 className="text-lg font-bold text-indigo-400 mb-4">{t('hunting.members')} ({activeMembers.length}/{myParty.maxMembers})</h4>
                            <div className="space-y-2">
                                {activeMembers.map(m => (
                                    <div key={m.userId} className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                        <div>
                                            <span className="font-bold text-white">{m.characterName}</span>
                                            <span className="text-xs text-gray-400 ml-2">Lvl {m.level} {t(`class.${m.characterClass}`)}</span>
                                            {m.status === PartyMemberStatus.Leader && <span className="text-xs text-amber-400 ml-2">[{t('hunting.memberStatus.LEADER')}]</span>}
                                        </div>
                                        {isLeader && m.userId !== character.id && (
                                            <button onClick={() => handleRespond(m.userId, 'kick')} className="text-red-400 hover:text-red-300 text-xs">Wyrzuć</button>
                                        )}
                                    </div>
                                ))}
                                {Array.from({ length: myParty.maxMembers - activeMembers.length }).map((_, i) => (
                                    <div key={`empty-${i}`} className="bg-slate-800/30 p-2 rounded border border-dashed border-slate-700 text-center text-gray-500 text-sm">
                                        {t('hunting.emptySlot')}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pending Requests (Leader Only) */}
                        {isLeader && pendingMembers.length > 0 && (
                            <div className="bg-slate-900/40 p-4 rounded-xl border border-yellow-900/30">
                                <h4 className="text-lg font-bold text-amber-400 mb-4">Oczekujący ({pendingMembers.length})</h4>
                                <div className="space-y-2">
                                    {pendingMembers.map(m => (
                                        <div key={m.userId} className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                            <div>
                                                <span className="font-bold text-white">{m.characterName}</span>
                                                <span className="text-xs text-gray-400 ml-2">Lvl {m.level}</span>
                                            </div>
                                            <div className="space-x-2">
                                                <button onClick={() => handleRespond(m.userId, 'accept')} className="text-green-400 hover:text-green-300 text-xs font-bold">Akceptuj</button>
                                                <button onClick={() => handleRespond(m.userId, 'reject')} className="text-red-400 hover:text-red-300 text-xs">Odrzuć</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-4">
                            <button onClick={handleLeave} className="px-4 py-2 rounded bg-red-900 hover:bg-red-800 text-white font-bold">
                                {isLeader ? t('hunting.disband') : t('hunting.leave')}
                            </button>
                            {isLeader && myParty.status === PartyStatus.Forming && activeMembers.length === myParty.maxMembers && (
                                <button onClick={handleStart} className="px-6 py-2 rounded bg-green-700 hover:bg-green-600 text-white font-bold animate-pulse">
                                    Rozpocznij Polowanie
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    // ------------------ CREATE VIEW ------------------
    if (view === 'CREATE') {
        const availableBosses = enemies.filter(e => e.isBoss);
        return (
            <ContentPanel title={t('hunting.create')}>
                <div className="max-w-md mx-auto space-y-6">
                    <div>
                        <label className="block text-gray-300 mb-2">{t('hunting.chooseBoss')}</label>
                        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                            {availableBosses.map(boss => (
                                <div 
                                    key={boss.id} 
                                    onClick={() => setSelectedBossId(boss.id)}
                                    className={`p-3 rounded-lg cursor-pointer border ${selectedBossId === boss.id ? 'bg-indigo-900 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                                >
                                    <div className="font-bold text-white">{boss.name}</div>
                                    <div className="text-xs text-gray-400">Lvl Rec: 10+</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-300 mb-2">{t('hunting.partySize')}</label>
                        <select value={partySize} onChange={e => setPartySize(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white">
                            <option value={1}>1 (Solo - Wymaga "Samotny Wilk")</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                            <option value={5}>5</option>
                        </select>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setView('LOBBY')} className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">Anuluj</button>
                        <button onClick={handleCreate} disabled={!selectedBossId} className="flex-1 py-2 rounded bg-green-700 hover:bg-green-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed">Stwórz</button>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    // ------------------ LOBBY VIEW ------------------
    return (
        <ContentPanel title={t('hunting.title')}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-indigo-400">{t('hunting.availableParties')}</h3>
                <button onClick={() => setView('CREATE')} className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-white font-bold flex items-center gap-2">
                    <CrossedSwordsIcon className="h-4 w-4" /> {t('hunting.create')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {parties.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">{t('hunting.noParties')}</p>}
                {parties.map(p => {
                    const boss = enemies.find(e => e.id === p.bossId);
                    return (
                        <div key={p.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl hover:border-indigo-500 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-red-400">{boss?.name || 'Unknown Boss'}</span>
                                <span className="text-xs bg-slate-700 px-2 py-1 rounded text-white">{p.currentMembersCount}/{p.maxMembers}</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-4">Lider: {p.leaderName}</p>
                            <button 
                                onClick={() => handleJoin(p.id)} 
                                disabled={p.currentMembersCount >= p.maxMembers}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-bold disabled:bg-slate-700 disabled:text-gray-500"
                            >
                                {t('hunting.join')}
                            </button>
                        </div>
                    );
                })}
            </div>
        </ContentPanel>
    );
};

const Countdown: React.FC<{ target: string, offset: number }> = ({ target, offset }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const end = new Date(target).getTime() + offset; // offset is prep time in ms
            const diff = Math.max(0, Math.floor((end - now) / 1000));
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            setTimeLeft(`${m}:${s}`);
            if (diff <= 0) clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
    }, [target, offset]);

    return <span>{timeLeft}</span>;
}
