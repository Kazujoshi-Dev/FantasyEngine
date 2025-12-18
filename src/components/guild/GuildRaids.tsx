import React, { useState, useEffect } from 'react';
import { GuildRaid, RaidType, RaidStatus, RaidParticipant, ExpeditionRewardSummary, CombatLogEntry, PartyMember, PartyMemberStatus, ItemTemplate, Affix, Enemy } from '../../types';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { ExpeditionSummaryModal } from '../combat/CombatSummary';

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
            const data = await api.getRaids();
            setRaids(data);
            const targetList = await api.getGuildTargets();
            setTargets(targetList);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async () => {
        if (!selectedTarget) return;
        try {
            await api.createRaid(Number(selectedTarget), raidType);
            fetchData();
            setSelectedTarget('');
        } catch (e: any) { alert(e.message); }
    };

    const handleJoin = async (raidId: number) => {
        try {
            await api.joinRaid(raidId);
            fetchData();
        } catch (e: any) { alert(e.message); }
    };

    const prepareRaidSummary = (raid: GuildRaid) => {
        const isAttacker = raid.attackerGuildId === myGuildId;
        const didWin = raid.winnerGuildId === myGuildId;
        
        const friendlyTeam = isAttacker ? raid.attackerParticipants : raid.defenderParticipants;
        const opposingTeam = isAttacker ? raid.defenderParticipants : raid.attackerParticipants;
        
        let combatLog: CombatLogEntry[] = [];
        if (typeof raid.combatLog === 'string') {
            try {
                const parsed = JSON.parse(raid.combatLog);
                if (Array.isArray(parsed)) combatLog = parsed;
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
                {/* Create Raid Section */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-red-900/30">
                    <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2"><SwordsIcon className="h-5 w-5"/> Wypowiedz Wojnę</h3>
                    {canManage ? (
                        <div className="space-y-4">
                            <select className="w-full bg-slate-800 p-2 rounded border border-slate-600 text-white" value={selectedTarget} onChange={e => setSelectedTarget(e.target.value as any)}>
                                <option value="">Wybierz Gildię...</option>
                                {targets.map(t => <option key={t.id} value={t.id}>[{t.tag}] {t.name} (Członków: {t.member_count})</option>)}
                            </select>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                                    <input type="radio" checked={raidType === RaidType.RESOURCES} onChange={() => setRaidType(RaidType.RESOURCES)} /> Wojna o Zasoby
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                                    <input type="radio" checked={raidType === RaidType.SPARRING} onChange={() => setRaidType(RaidType.SPARRING)} /> Sparing
                                </label>
                            </div>
                            <button onClick={handleCreate} disabled={!selectedTarget} className="w-full py-2 bg-red-700 hover:bg-red-600 rounded font-bold text-white shadow-lg disabled:bg-slate-700">WYPOWIEDZ WOJNĘ</button>
                            <p className="text-xs text-gray-500 italic">* Wojna rozpocznie się za 30 minut od ogłoszenia. Członkowie obu gildii muszą dołączyć do rajdu przed tym czasem.</p>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic text-sm">Tylko liderzy i oficerowie mogą inicjować operacje wojenne.</p>
                    )}
                </div>

                {/* Active Raids List */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-indigo-900/30">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2"><ShieldIcon className="h-5 w-5"/> Aktywne Bitwy</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {raids.active.length === 0 && <p className="text-gray-500 text-center py-6 italic text-sm">Brak aktywnych bitew.</p>}
                        {raids.active.map(raid => {
                            const isAttacker = raid.attackerGuildId === myGuildId;
                            const opposingName = isAttacker ? raid.defenderGuildName : raid.attackerGuildName;
                            const myTeam = isAttacker ? raid.attackerParticipants : raid.defenderParticipants;
                            const alreadyJoined = myTeam.some(p => p.userId === myUserId);
                            
                            return (
                                <div key={raid.id} className="bg-slate-800 p-4 rounded border border-slate-700 hover:border-slate-500 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">{raid.raid_type === 'RESOURCES' ? 'Wojna o Zasoby' : 'Sparing'}</span>
                                            <h4 className="font-bold text-white text-lg">vs {opposingName}</h4>
                                        </div>
                                        {!alreadyJoined && raid.status === 'PREPARING' && (
                                            <button onClick={() => handleJoin(raid.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold transition-all">DOŁĄCZ</button>
                                        )}
                                        {alreadyJoined && <span className="text-green-400 text-xs font-bold border border-green-600 px-2 py-0.5 rounded">GOTOWY</span>}
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                                        <span>Zmobilizowani: {raid.attacker_participants?.length || 0} vs {raid.defender_participants?.length || 0}</span>
                                        <span className="font-mono text-amber-500">T-30m</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-gray-300 mb-4">Ostatnie Bitwy</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {raids.history.length === 0 && <p className="text-gray-500 text-center py-6 italic text-sm">Twoja gildia nie brała jeszcze udziału w bitwach.</p>}
                    {raids.history.map(raid => {
                        const won = raid.winnerGuildId === myGuildId;
                        return (
                            <div key={raid.id} onClick={() => prepareRaidSummary(raid)} className="bg-slate-800/60 p-3 rounded flex justify-between items-center cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-500">
                                <div>
                                    <span className={`font-bold uppercase text-xs ${won ? 'text-green-400' : 'text-red-400'}`}>{won ? 'Wygrana' : 'Przegrana'}</span>
                                    <span className="text-gray-400 ml-2 text-sm">vs {raid.attackerGuildId === myGuildId ? raid.defenderGuildName : raid.attackerGuildName}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-gray-500">{new Date(raid.createdAt).toLocaleDateString()}</span>
                                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">{raid.raid_type}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
