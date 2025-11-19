
import React, { useState, useEffect, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, HuntingParty, Enemy, PartyStatus, PartyMemberStatus, GameData, ItemTemplate, Affix } from '../types';
import { api } from '../api';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { ExpeditionSummaryModal } from './Expedition';

interface HuntingProps {
    character: PlayerCharacter;
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    gameData: GameData;
}

const CountdownTimer: React.FC<{ targetDate: string, durationMinutes: number, onZero: () => void }> = ({ targetDate, durationMinutes, onZero }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            const diff = new Date(new Date(targetDate).getTime() + durationMinutes * 60 * 1000).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft('00:00');
                clearInterval(interval);
                onZero();
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [targetDate, durationMinutes, onZero]);

    return <span className="font-mono text-2xl text-amber-400 font-bold">{timeLeft}</span>;
};

export const Hunting: React.FC<HuntingProps> = ({ character, enemies, itemTemplates, affixes, gameData }) => {
    const { t } = useTranslation();
    const [myParty, setMyParty] = useState<HuntingParty | null>(null);
    const [availableParties, setAvailableParties] = useState<any[]>([]);
    const [createBossId, setCreateBossId] = useState('');
    const [createMembers, setCreateMembers] = useState(4);
    const [isLoading, setIsLoading] = useState(false);
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

    const fetchMyParty = useCallback(async () => {
        try {
            const party = await api.getMyParty();
            setMyParty(party);
        } catch (err) {
            console.error(err);
        }
    }, []);

    const fetchParties = useCallback(async () => {
        try {
            const parties = await api.getHuntingParties();
            setAvailableParties(parties);
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        fetchMyParty();
        fetchParties();
        const interval = setInterval(() => {
            if(document.visibilityState === 'visible') {
                fetchMyParty();
                // Only refresh list if not in party
                if (!myParty) fetchParties();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchMyParty, fetchParties, myParty]);

    const handleCreate = async () => {
        if (!createBossId) return;
        setIsLoading(true);
        try {
            await api.createParty(createBossId, createMembers);
            await fetchMyParty();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async (partyId: number) => {
        setIsLoading(true);
        try {
            await api.joinParty(partyId);
            await fetchMyParty();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeave = async () => {
        if (!window.confirm(t('hunting.leaveConfirm'))) return;
        setIsLoading(true);
        try {
            await api.leaveParty();
            setMyParty(null);
            await fetchParties();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRespond = async (userId: number, action: 'accept' | 'reject' | 'kick') => {
        try {
            await api.respondToJoinRequest(userId, action);
            await fetchMyParty();
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Boss List
    const bosses = enemies.filter(e => e.isBoss);
    const durationMinutes = gameData.settings?.huntingDurationMinutes || 5;

    if (myParty) {
        // View for Inside a Party
        const isLeader = myParty.leaderId === character.id;
        const boss = enemies.find(e => e.id === myParty.bossId);
        
        if (myParty.status === PartyStatus.Finished && myParty.combatLog) {
            return (
                <ExpeditionSummaryModal 
                    reward={{
                        rewardBreakdown: [],
                        totalGold: myParty.myRewards?.gold || 0,
                        totalExperience: myParty.myRewards?.experience || 0,
                        combatLog: myParty.combatLog,
                        isVictory: myParty.victory || false,
                        itemsFound: myParty.myRewards?.items || [],
                        essencesFound: myParty.myRewards?.essences || {}
                    }}
                    onClose={handleLeave}
                    characterName={character.name}
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    isHunting={true}
                    huntingMembers={myParty.members}
                    allRewards={myParty.allRewards}
                />
            );
        }

        return (
            <ContentPanel title={t('hunting.title')}>
                <div className="bg-slate-900/40 p-6 rounded-xl text-center">
                    <h3 className="text-2xl font-bold text-amber-400 mb-2">{boss?.name || 'Unknown Boss'}</h3>
                    <p className="text-gray-400 mb-6">{t('hunting.statusLabel')}: <span className="text-white font-bold">{t(`hunting.status.${myParty.status}`)}</span></p>
                    
                    {myParty.status === PartyStatus.Preparing && myParty.startTime && (
                        <div className="mb-6">
                            <p className="text-sm text-gray-400 mb-1">{t('hunting.startsIn')}</p>
                            <CountdownTimer targetDate={myParty.startTime} durationMinutes={durationMinutes} onZero={fetchMyParty} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left max-w-4xl mx-auto">
                        {myParty.members.map(member => (
                            <div key={member.userId} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-white">{member.characterName} <span className="text-xs text-gray-400">(Lvl {member.level})</span></p>
                                    <p className="text-xs text-gray-500">{t(`race.${member.race}`)} {member.characterClass ? t(`class.${member.characterClass}`) : ''}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        member.status === PartyMemberStatus.Leader ? 'bg-amber-900 text-amber-200' :
                                        member.status === PartyMemberStatus.Member ? 'bg-green-900 text-green-200' :
                                        'bg-slate-700 text-gray-300'
                                    }`}>
                                        {t(`hunting.memberStatus.${member.status}`)}
                                    </span>
                                    {isLeader && member.userId !== character.id && (
                                        <>
                                            {member.status === PartyMemberStatus.Pending && (
                                                <>
                                                    <button onClick={() => handleRespond(member.userId, 'accept')} className="p-1 bg-green-700 rounded hover:bg-green-600 text-xs">✓</button>
                                                    <button onClick={() => handleRespond(member.userId, 'reject')} className="p-1 bg-red-700 rounded hover:bg-red-600 text-xs">✕</button>
                                                </>
                                            )}
                                            {member.status === PartyMemberStatus.Member && (
                                                <button onClick={() => handleRespond(member.userId, 'kick')} className="p-1 bg-red-900 rounded hover:bg-red-800 text-xs text-red-200">Kick</button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {Array.from({ length: myParty.maxMembers - myParty.members.length }).map((_, i) => (
                             <div key={`empty-${i}`} className="bg-slate-800/30 p-3 rounded-lg border border-slate-700 border-dashed flex justify-center items-center text-gray-500 text-sm">
                                {t('hunting.emptySlot')}
                            </div>
                        ))}
                    </div>

                    <button onClick={handleLeave} className="px-6 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-white font-bold transition-colors">
                        {isLeader ? t('hunting.disband') : t('hunting.leave')}
                    </button>
                </div>
            </ContentPanel>
        );
    }

    // View for Browser / Create
    return (
        <ContentPanel title={t('hunting.title')}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Create Party */}
                <div className="bg-slate-900/40 p-6 rounded-xl">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('hunting.createParty')}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">{t('hunting.chooseBoss')}</label>
                            <select 
                                value={createBossId} 
                                onChange={e => setCreateBossId(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">-- {t('admin.select')} --</option>
                                {bosses.map(b => <option key={b.id} value={b.id}>{b.name} (Lvl req: 10+)</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">{t('hunting.partySize')}</label>
                            <select 
                                value={createMembers} 
                                onChange={e => setCreateMembers(parseInt(e.target.value))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                            >
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                                <option value={5}>5</option>
                            </select>
                        </div>
                        <button 
                            onClick={handleCreate}
                            disabled={!createBossId || isLoading}
                            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition-colors disabled:bg-slate-600"
                        >
                            {t('hunting.create')}
                        </button>
                    </div>
                </div>

                {/* Party Browser */}
                <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('hunting.availableParties')}</h3>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {availableParties.length === 0 && <p className="text-gray-500 text-center py-4">{t('hunting.noParties')}</p>}
                        {availableParties.map(party => {
                            const boss = enemies.find(e => e.id === party.bossId);
                            return (
                                <div key={party.id} className="bg-slate-800/50 p-4 rounded-lg flex justify-between items-center hover:bg-slate-800 transition-colors">
                                    <div>
                                        <p className="font-bold text-amber-400 text-lg">{boss?.name}</p>
                                        <p className="text-sm text-gray-400">{t('hunting.members')}: <span className="text-white">{party.currentMembersCount} / {party.maxMembers}</span></p>
                                        {party.leaderName && <p className="text-xs text-gray-500 mt-1">Lider: {party.leaderName}</p>}
                                    </div>
                                    <button 
                                        onClick={() => handleJoin(party.id)}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white font-semibold transition-colors disabled:bg-slate-600"
                                    >
                                        {t('hunting.join')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </ContentPanel>
    );
};
