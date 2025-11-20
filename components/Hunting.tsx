import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, HuntingParty, Enemy, PartyStatus, PartyMemberStatus, GameData, ItemTemplate, Affix, EnemyStats } from '../types';
import { api } from '../api';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { ExpeditionSummaryModal } from './Expedition';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';

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

const BossStatsPanel: React.FC<{ stats: EnemyStats; baseStats?: EnemyStats }> = ({ stats, baseStats }) => {
    const { t } = useTranslation();
    
    // Helper to show increase if scaled
    const renderScaledValue = (current: number, base: number) => {
        if (current > base) {
            return (
                <span>
                    <span className="text-white font-bold">{current}</span>
                    <span className="text-xs text-amber-500 ml-1">(x{(current/base).toFixed(1)})</span>
                </span>
            );
        }
        return <span className="text-white font-bold">{current}</span>;
    };

    return (
        <div className="space-y-2 text-sm text-gray-300 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <p className="flex justify-between items-center">
                <span>HP:</span> 
                <span className="font-mono">
                    {baseStats ? renderScaledValue(stats.maxHealth, baseStats.maxHealth) : <span className="text-white font-bold">{stats.maxHealth}</span>}
                </span>
            </p>
            <p className="flex justify-between items-center">
                <span>Obrażenia:</span> 
                <span className="font-mono text-white">
                    {stats.minDamage}-{stats.maxDamage}
                    {baseStats && stats.minDamage > baseStats.minDamage && <span className="text-xs text-amber-500 ml-1">↑</span>}
                </span>
            </p>
            <p className="flex justify-between"><span>Pancerz:</span> <span className="font-mono text-white">{stats.armor}</span></p>
            <p className="flex justify-between"><span>Ataki/tura:</span> <span className="font-mono text-white">{stats.attacksPerTurn || 1}</span></p>
             <div className="border-t border-slate-700/50 my-2"></div>
             {stats.maxMana ? <p className="flex justify-between text-purple-300"><span>Mana:</span> <span className="font-mono">{stats.maxMana}</span></p> : null}
             {stats.magicDamageMin ? (
                <p className="flex justify-between text-purple-300">
                    <span>Mag. DMG:</span> 
                    <span className="font-mono">
                        {stats.magicDamageMin}-{stats.magicDamageMax}
                        {baseStats && baseStats.magicDamageMin && stats.magicDamageMin > baseStats.magicDamageMin && <span className="text-xs text-amber-500 ml-1">↑</span>}
                    </span>
                </p>
             ) : null}
        </div>
    );
};

const getImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http') || url.startsWith('/api/uploads/')) return url;
    const uploadsIndex = url.indexOf('uploads/');
    if (uploadsIndex > -1) {
        return `/api/${url.substring(uploadsIndex)}`;
    }
    return url;
};

export const Hunting: React.FC<HuntingProps> = ({ character, enemies, itemTemplates, affixes, gameData }) => {
    const { t } = useTranslation();
    const [myParty, setMyParty] = useState<HuntingParty | null>(null);
    const [availableParties, setAvailableParties] = useState<any[]>([]);
    const [createBossId, setCreateBossId] = useState('');
    const [createMembers, setCreateMembers] = useState(4);
    const [isLoading, setIsLoading] = useState(false);

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
    const selectedBoss = bosses.find(b => b.id === createBossId);
    const durationMinutes = gameData.settings?.huntingDurationMinutes || 5;

    // Calculate Scaled Stats for Preview
    const scaledBossStats = useMemo(() => {
        if (!selectedBoss) return null;
        const count = createMembers;
        // Scaling logic matching backend
        const healthMult = 1 + (count - 1) * 0.7;
        const damageMult = 1 + (count - 1) * 0.1;

        return {
            maxHealth: Math.floor(selectedBoss.stats.maxHealth * healthMult),
            minDamage: Math.floor(selectedBoss.stats.minDamage * damageMult),
            maxDamage: Math.floor(selectedBoss.stats.maxDamage * damageMult),
            magicDamageMin: selectedBoss.stats.magicDamageMin ? Math.floor(selectedBoss.stats.magicDamageMin * damageMult) : 0,
            magicDamageMax: selectedBoss.stats.magicDamageMax ? Math.floor(selectedBoss.stats.magicDamageMax * damageMult) : 0,
            armor: selectedBoss.stats.armor,
            attacksPerTurn: selectedBoss.stats.attacksPerTurn,
            maxMana: selectedBoss.stats.maxMana,
            manaRegen: selectedBoss.stats.manaRegen
        };
    }, [selectedBoss, createMembers]);

    const estimatedRewards = useMemo(() => {
        if (!selectedBoss) return null;
        // Backend logic: TotalPool = Base * Players * 1.5
        // Split per Player = TotalPool / Players = Base * 1.5
        const bonusMult = 1.5;

        return {
            minGold: Math.floor(selectedBoss.rewards.minGold * bonusMult),
            maxGold: Math.floor(selectedBoss.rewards.maxGold * bonusMult),
            minExp: Math.floor(selectedBoss.rewards.minExperience * bonusMult),
            maxExp: Math.floor(selectedBoss.rewards.maxExperience * bonusMult),
        }
    }, [selectedBoss]);


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
                    initialEnemy={boss}
                    bossName={boss?.name}
                />
            );
        }

        return (
            <ContentPanel title={t('hunting.title')}>
                <div className="bg-slate-900/40 p-6 rounded-xl text-center">
                    <h3 className="text-2xl font-bold text-amber-400 mb-2">{boss?.name || 'Unknown Boss'}</h3>
                    
                     {/* Boss Portrait if available */}
                    {boss?.image && (
                        <div className="flex justify-center mb-4">
                             <img src={getImageUrl(boss.image)} alt={boss.name} className="w-48 h-48 object-cover rounded-lg border-2 border-amber-600 shadow-lg" />
                        </div>
                    )}

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

    // View for Browser / Create - 3 Columns
    return (
        <ContentPanel title={t('hunting.title')}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[70vh]">
                
                {/* Column 1: Create / Select Boss (approx 33%) */}
                <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col min-h-0 lg:col-span-4">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 text-center">{t('hunting.chooseBoss')}</h3>
                    
                    <div className="mb-4">
                         <select 
                            value={createBossId} 
                            onChange={e => setCreateBossId(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">-- Wybierz Cel --</option>
                            {bosses.map(b => <option key={b.id} value={b.id}>{b.name} (Lvl 10+)</option>)}
                        </select>
                    </div>

                    <div className="flex-grow flex flex-col items-center justify-center mb-4 bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
                        {selectedBoss ? (
                             selectedBoss.image ? (
                                <img src={getImageUrl(selectedBoss.image)} alt={selectedBoss.name} className="max-w-full max-h-48 object-contain rounded-lg shadow-lg border border-amber-700/50" />
                             ) : (
                                 <div className="w-32 h-32 bg-slate-700 rounded-full flex items-center justify-center text-gray-500">
                                     <CrossedSwordsIcon className="h-16 w-16 opacity-20" />
                                 </div>
                             )
                        ) : (
                            <div className="text-gray-500 italic text-sm text-center">Wybierz bossa z listy, aby zobaczyć szczegóły.</div>
                        )}
                    </div>

                    {selectedBoss && (
                        <div className="space-y-4 mt-auto">
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
                                className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-slate-600 shadow-lg"
                            >
                                {t('hunting.create')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Column 2: Boss Stats (approx 25% - reduced width) */}
                <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col min-h-0 lg:col-span-3">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 text-center">Informacje o Celu</h3>
                    {selectedBoss && scaledBossStats && estimatedRewards ? (
                        <div className="flex flex-col h-full">
                            <div className="mb-4 text-center">
                                <p className="text-lg font-bold text-white">{selectedBoss.name}</p>
                                <p className="text-sm text-gray-400 italic">{selectedBoss.description}</p>
                            </div>
                            <div className="flex-grow">
                                <BossStatsPanel stats={scaledBossStats as EnemyStats} baseStats={selectedBoss.stats} />
                                <div className="mt-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                    <p className="font-semibold text-center text-green-400 mb-2 text-sm">Szacowane Nagrody (na osobę)</p>
                                    <div className="flex justify-around items-center">
                                         <div className="flex items-center text-amber-400 font-mono">
                                            <CoinsIcon className="h-4 w-4 mr-1" />
                                            {estimatedRewards.minGold}-{estimatedRewards.maxGold}
                                        </div>
                                         <div className="flex items-center text-sky-400 font-mono">
                                            <StarIcon className="h-4 w-4 mr-1" />
                                            {estimatedRewards.minExp}-{estimatedRewards.maxExp}
                                        </div>
                                    </div>
                                     <p className="text-[10px] text-gray-500 text-center mt-1 italic">Zawiera bonus grupowy</p>
                                </div>
                            </div>
                            <div className="mt-4 text-xs text-gray-500 text-center mt-auto">
                                * Statystyki i nagrody są skalowane w zależności od liczby graczy w grupie.
                            </div>
                        </div>
                    ) : (
                         <div className="flex items-center justify-center h-full text-gray-500">
                            Brak wybranego celu.
                        </div>
                    )}
                </div>

                {/* Column 3: Available Groups (approx 42% - increased width) */}
                <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col min-h-0 lg:col-span-5">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('hunting.availableParties')}</h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {availableParties.length === 0 && <p className="text-gray-500 text-center py-4">{t('hunting.noParties')}</p>}
                        {availableParties.map(party => {
                            const boss = enemies.find(e => e.id === party.bossId);
                            return (
                                <div key={party.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center hover:bg-slate-800 transition-colors border border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        {boss?.image && <img src={getImageUrl(boss.image)} alt="" className="w-10 h-10 rounded object-cover bg-slate-900" />}
                                        <div>
                                            <p className="font-bold text-amber-400 text-sm">{boss?.name}</p>
                                            <p className="text-xs text-gray-400">{party.currentMembersCount} / {party.maxMembers} graczy</p>
                                            {party.leaderName && <p className="text-[10px] text-gray-500">Lider: {party.leaderName}</p>}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleJoin(party.id)}
                                        disabled={isLoading}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white text-xs font-semibold transition-colors disabled:bg-slate-600"
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