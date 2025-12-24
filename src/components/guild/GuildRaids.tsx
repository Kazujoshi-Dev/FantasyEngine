
import React, { useState, useEffect, useMemo } from 'react';
import { GuildRaid, RaidType, RaidStatus, RaidParticipant, ExpeditionRewardSummary, CombatLogEntry, PartyMember, PartyMemberStatus, ItemTemplate, Affix, Enemy } from '../../types';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ExpeditionSummaryModal } from '../combat/CombatSummary';

const RaidCountdown: React.FC<{ startTime: string; onFinish: () => void }> = ({ startTime, onFinish }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculate = () => {
            const now = Date.now();
            const start = new Date(startTime).getTime();
            const diff = start - now;

            if (diff <= 0) {
                setTimeLeft('STARTUJĘ...');
                onFinish();
                return false;
            }

            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`);
            return true;
        };

        const active = calculate();
        if (!active) return;

        const interval = setInterval(() => {
            if (!calculate()) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, onFinish]);

    return <span className="font-mono text-amber-500 font-bold">{timeLeft}</span>;
};

interface GuildRaidsProps {
    myGuildId: number;
    myRole?: string;
    myUserId?: number;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    enemies: Enemy[];
}

export const GuildRaids: React.FC<GuildRaidsProps> = ({ myGuildId, myRole, myUserId, itemTemplates, affixes, enemies }) => {
    const { t } = useTranslation();
    const [raids, setRaids] = useState<{ active: GuildRaid[], history: GuildRaid[] }>({ active: [], history: [] });
    const [targets, setTargets] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<number | ''>('');
    const [raidType, setRaidType] = useState<RaidType>(RaidType.RESOURCES);
    const [isLoading, setIsLoading] = useState(false);
    
    const [selectedRaid, setSelectedRaid] = useState<GuildRaid | null>(null);
    const [modalData, setModalData] = useState<{ summary: ExpeditionRewardSummary, opponents: any[] } | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [raidData, targetList] = await Promise.all([
                api.getRaids(),
                api.getGuildTargets()
            ]);
            setRaids(raidData);
            setTargets(targetList);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleCreate = async () => {
        if (!selectedTarget) return;
        try {
            await api.createRaid(Number(selectedTarget), raidType);
            fetchData();
            setSelectedTarget('');
            alert('Wojna wypowiedziana! Mobilizacja rozpoczęta.');
        } catch (e: any) { alert(e.message); }
    };

    const handleJoin = async (raidId: number) => {
        try {
            await api.joinRaid(raidId);
            fetchData();
        } catch (e: any) { alert(e.message); }
    };

    const prepareRaidSummary = (raid: GuildRaid) => {
        const isAttacker = Number(raid.attackerGuildId) === Number(myGuildId);
        const didWin = Number(raid.winnerGuildId) === Number(myGuildId);
        
        const friendlyTeam = isAttacker ? raid.attackerParticipants : raid.defenderParticipants;
        const opposingTeam = isAttacker ? raid.defenderParticipants : raid.attackerParticipants;
        
        let combatLog: CombatLogEntry[] = [];
        if (typeof raid.combatLog === 'string') {
            try {
                combatLog = JSON.parse(raid.combatLog);
            } catch (e) { console.error(e); }
        } else if (Array.isArray(raid.combatLog)) {
            combatLog = raid.combatLog;
        }

        const initialStatsSnapshot = combatLog.length > 0 ? combatLog[0].partyMemberStats : {};

        const mapToPartyMember = (p: any): PartyMember => ({
             userId: p.userId,
             characterName: p.name,
             level: p.level,
             race: p.race,
             characterClass: p.characterClass,
             status: PartyMemberStatus.Member,
             stats: initialStatsSnapshot ? initialStatsSnapshot[p.name] : undefined
        });

        const summary: ExpeditionRewardSummary = {
            isVictory: didWin,
            totalGold: raid.loot?.gold || 0,
            totalExperience: 0, 
            itemsFound: [],
            essencesFound: raid.loot?.essences || {},
            combatLog: combatLog,
            rewardBreakdown: [],
            encounteredEnemies: [], 
            huntingMembers: friendlyTeam.map(mapToPartyMember)
        };
        
        setModalData({ summary, opponents: opposingTeam.map(mapToPartyMember) });
        setSelectedRaid(raid);
    };

    const canManage = myRole === 'LEADER' || myRole === 'OFFICER';

    return (
        <div className="space-y-6">
            {modalData && selectedRaid && (
                <ExpeditionSummaryModal 
                    reward={modalData.summary}
                    onClose={() => { setSelectedRaid(null); setModalData(null); }}
                    characterName=""
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    enemies={enemies}
                    isHunting={true}
                    isRaid={true}
                    huntingMembers={modalData.summary.huntingMembers}
                    opponents={modalData.opponents}
                    raidId={selectedRaid.id}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Panel Lewy: Inicjacja wojny */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-red-900/30 flex flex-col h-full">
                    <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2"><SwordsIcon className="h-5 w-5"/> Wypowiedz Wojnę</h3>
                    {canManage ? (
                        <div className="space-y-4">
                            <select className="w-full bg-slate-800 p-2 rounded border border-slate-600 text-white" value={selectedTarget} onChange={e => setSelectedTarget(e.target.value as any)}>
                                <option value="">Wybierz Gildię...</option>
                                {targets.map(t => <option key={t.id} value={t.id}>[{t.tag}] {t.name} (Lvl: {t.totalLevel})</option>)}
                            </select>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                                    <input type="radio" checked={raidType === RaidType.RESOURCES} onChange={() => setRaidType(RaidType.RESOURCES)} /> Wojna o Zasoby
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                                    <input type="radio" checked={raidType === RaidType.SPARRING} onChange={() => setRaidType(RaidType.SPARRING)} /> Sparing
                                </label>
                            </div>
                            <button onClick={handleCreate} disabled={!selectedTarget || isLoading} className="w-full py-2 bg-red-700 hover:bg-red-600 rounded font-bold text-white shadow-lg disabled:bg-slate-700 transition-all">WYPOWIEDZ WOJNĘ</button>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic text-sm">Tylko liderzy i oficerowie mogą inicjować operacje wojenne.</p>
                    )}
                </div>

                {/* Panel Prawy: Aktywne Bitwy */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-indigo-900/30 flex flex-col h-full">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2"><ShieldIcon className="h-5 w-5"/> Aktywne Bitwy</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                        {raids.active.length === 0 && <p className="text-gray-500 text-center py-6 italic text-sm">Brak aktywnych bitew.</p>}
                        {raids.active.map(raid => {
                            const isAttacker = Number(raid.attackerGuildId) === Number(myGuildId);
                            const opposingName = isAttacker ? raid.defenderGuildName : raid.attackerGuildName;
                            const myTeam = isAttacker ? raid.attackerParticipants : raid.defenderParticipants;
                            const alreadyJoined = myTeam.some(p => p.userId === myUserId);
                            
                            return (
                                <div key={raid.id} className="bg-slate-800 p-4 rounded border border-slate-700 hover:border-slate-500 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">{raid.type === 'RESOURCES' ? 'Wojna o Zasoby' : 'Sparing'}</span>
                                            <h4 className="font-bold text-white text-lg">vs {opposingName}</h4>
                                        </div>
                                        {!alreadyJoined && raid.status === 'PREPARING' && (
                                            <button onClick={() => handleJoin(raid.id)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold transition-all shadow-lg animate-pulse">DOŁĄCZ</button>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
                                        <span>Zmobilizowani: <span className="text-white font-bold">{raid.attackerParticipants?.length || 0} vs {raid.defenderParticipants?.length || 0}</span></span>
                                        <div className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                                            <ClockIcon className="h-3 w-3 text-gray-500" />
                                            <RaidCountdown startTime={raid.startTime} onFinish={fetchData} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* SEKCJA: Historia Bitew */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800">
                <h3 className="text-xl font-bold text-gray-400 mb-6 border-b border-slate-800 pb-2">Ostatnie Bitwy (Historia)</h3>
                <div className="space-y-2">
                    {raids.history.length === 0 && <p className="text-gray-600 text-center py-10 italic">Wasza gildia nie brała jeszcze udziału w żadnej wojnie.</p>}
                    {raids.history.slice(0, 10).map(raid => {
                        const isAttacker = Number(raid.attackerGuildId) === Number(myGuildId);
                        const didWin = Number(raid.winnerGuildId) === Number(myGuildId);
                        const opposingName = isAttacker ? raid.defenderGuildName : raid.attackerGuildName;
                        const date = new Date(raid.createdAt).toLocaleDateString();

                        return (
                            <div key={raid.id} className={`flex flex-col md:flex-row justify-between items-center bg-slate-800/40 p-4 rounded-lg border transition-colors ${didWin ? 'border-green-900/30 hover:bg-green-900/10' : 'border-red-900/30 hover:bg-red-900/10'}`}>
                                <div className="flex items-center gap-4 mb-4 md:mb-0">
                                    <div className={`p-2 rounded-full ${didWin ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-500'}`}>
                                        {didWin ? <ShieldIcon className="h-6 w-6"/> : <SwordsIcon className="h-6 w-6"/>}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-md">
                                            {didWin ? 'Zwycięstwo' : 'Porażka'} przeciwko <span className="text-indigo-400">{opposingName}</span>
                                        </h4>
                                        <p className="text-xs text-gray-500">
                                            {date} • {raid.type === 'RESOURCES' ? 'Wojna o Zasoby' : 'Sparing'} 
                                            {raid.loot?.gold ? <span className="text-amber-500 ml-2"> • +{raid.loot.gold}g</span> : ''}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => prepareRaidSummary(raid)}
                                    className="px-6 py-2 bg-slate-700 hover:bg-indigo-600 rounded text-xs font-black uppercase tracking-widest text-white transition-all shadow-md"
                                >
                                    Zobacz Raport
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
