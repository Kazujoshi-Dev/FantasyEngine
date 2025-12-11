
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api, getAuthToken } from '../../api';
import { GuildRaid, RaidType, RaidStatus, GuildRole, ItemTemplate, Affix, ExpeditionRewardSummary, PartyMember, Enemy, CombatLogEntry } from '../../types';
import { SwordsIcon } from '../icons/SwordsIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ExpeditionSummaryModal } from '../combat/CombatSummary';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { useCharacter } from '@/contexts/CharacterContext'; // Import hook

// --- Dedicated Timer Component for smooth updates ---
const RaidTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
    const targetTime = new Date(startTime).getTime();
    const calculateTimeLeft = () => Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
    
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        // Update immediately to avoid initial delay
        setTimeLeft(calculateTimeLeft());

        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    if (timeLeft <= 0) {
        return <span>WALKA!</span>;
    }

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <>
            <ClockIcon className="h-4 w-4"/> 
            {`${minutes}m ${seconds.toString().padStart(2, '0')}s`}
        </>
    );
};

interface GuildRaidsProps {
    myGuildId: number;
    myRole?: GuildRole;
    myUserId?: number;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    enemies: Enemy[];
}

export const GuildRaids: React.FC<GuildRaidsProps> = ({ myGuildId, myRole, myUserId, itemTemplates, affixes, enemies }) => {
    const { t } = useTranslation();
    const { updateCharacter } = useCharacter(); // Get updateCharacter from context
    const [incomingRaids, setIncomingRaids] = useState<GuildRaid[]>([]);
    const [outgoingRaids, setOutgoingRaids] = useState<GuildRaid[]>([]);
    const [history, setHistory] = useState<GuildRaid[]>([]);
    const [targets, setTargets] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<number | ''>('');
    const [raidType, setRaidType] = useState<RaidType>(RaidType.RESOURCES);
    const [selectedRaid, setSelectedRaid] = useState<GuildRaid | null>(null);
    const [modalData, setModalData] = useState<{ summary: ExpeditionRewardSummary, opponents: PartyMember[] } | null>(null);
    
    const canDeclare = myRole === GuildRole.LEADER || myRole === GuildRole.OFFICER;

    const fetchData = async () => {
        try {
            const token = getAuthToken();
            const raidsRes = await fetch('/api/guilds/raids', { headers: { 'Authorization': `Bearer ${token}` } });
            if(raidsRes.ok) {
                const data = await raidsRes.json();
                setIncomingRaids(data.incoming);
                setOutgoingRaids(data.outgoing);
                setHistory(data.history || []);
            }

            if(canDeclare) {
                 const targetsRes = await fetch('/api/guilds/targets', { headers: { 'Authorization': `Bearer ${token}` } });
                 if(targetsRes.ok) setTargets(await targetsRes.json());
            }
        } catch(e) { console.error(e); }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [myGuildId]);

    const handleDeclare = async () => {
        if(!selectedTarget) return;
        try {
             const token = getAuthToken();
             const res = await fetch('/api/guilds/raids/create', { 
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                 body: JSON.stringify({ targetGuildId: selectedTarget, raidType })
             });
             if(!res.ok) throw new Error((await res.json()).message);
             alert('Wypowiedziano wojnę!');
             fetchData();
        } catch(e: any) { alert(e.message); }
    };

    const handleJoin = async (raidId: number) => {
        try {
             const token = getAuthToken();
             const res = await fetch('/api/guilds/raids/join', { 
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                 body: JSON.stringify({ raidId })
             });
             if(!res.ok) throw new Error((await res.json()).message);
             fetchData();
        } catch(e: any) { alert(e.message); }
    };
    
    const prepareRaidSummary = (raid: GuildRaid) => {
        const isAttacker = raid.attackerGuildId === myGuildId;
        const didWin = raid.winnerGuildId === myGuildId;
        
        const friendlyTeam = isAttacker ? raid.attackerParticipants : raid.defenderParticipants;
        const opposingTeam = isAttacker ? raid.defenderParticipants : raid.attackerParticipants;
        
        // Safely parse combat log, which might be a string from the DB
        let combatLog: CombatLogEntry[] = [];
        if (typeof raid.combatLog === 'string') {
            try {
                const parsed = JSON.parse(raid.combatLog);
                if (Array.isArray(parsed)) combatLog = parsed;
            } catch (e) { 
                console.error(`Error parsing combat log for raid ${raid.id}:`, e); 
            }
        } else if (Array.isArray(raid.combatLog)) {
            combatLog = raid.combatLog;
        }

        // Extract stats from combat log snapshot (turn 0)
        const initialStatsSnapshot = combatLog.length > 0 ? combatLog[0].partyMemberStats : {};

        // Map participants to PartyMember format with Stats injected
        const mapToPartyMember = (p: any): PartyMember => ({
             userId: p.userId,
             characterName: p.name,
             level: p.level,
             race: p.race,
             characterClass: p.characterClass,
             status: undefined as any, // not needed for display
             stats: initialStatsSnapshot ? initialStatsSnapshot[p.name] : undefined
        });

        const summary: ExpeditionRewardSummary = {
            isVictory: didWin,
            totalGold: (raid.loot?.gold && didWin) ? raid.loot.gold : 0,
            totalExperience: 0, 
            itemsFound: [],
            essencesFound: (raid.loot?.essences && didWin) ? raid.loot.essences : {},
            combatLog: combatLog,
            rewardBreakdown: [],
            encounteredEnemies: [], 
            huntingMembers: friendlyTeam.map(mapToPartyMember)
        };
        
        setModalData({
            summary,
            opponents: opposingTeam.map(mapToPartyMember)
        });
        setSelectedRaid(raid);
    };
    
    const RaidCard: React.FC<{ raid: GuildRaid, type: 'INCOMING' | 'OUTGOING' | 'HISTORY' }> = ({ raid, type }) => {
        const isHistory = type === 'HISTORY';
        const isIncoming = type === 'INCOMING' || (isHistory && raid.defenderGuildId === myGuildId);
        
        const opponentName = isIncoming ? raid.attackerGuildName : raid.defenderGuildName;
        
        const participants = isIncoming ? raid.defenderParticipants : raid.attackerParticipants;
        const opponentsCount = isIncoming ? raid.attackerParticipants.length : raid.defenderParticipants.length;
        
        const isJoined = participants.some(p => p.userId === myUserId);
        
        const won = raid.winnerGuildId === myGuildId;
        const statusColor = isHistory ? (won ? 'bg-green-900/30 border-green-600' : 'bg-red-900/30 border-red-600') : (isIncoming ? 'bg-red-900/30 border-red-600' : 'bg-green-900/30 border-green-600');

        return (
            <div className={`p-4 rounded-lg border ${statusColor} mb-4`}>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-white flex items-center gap-2">
                        {isIncoming ? <ShieldIcon className="h-5 w-5 text-red-400"/> : <SwordsIcon className="h-5 w-5 text-green-400"/>}
                        {isIncoming ? 'Obrona przed:' : 'Atak na:'} <span className="text-amber-400">{opponentName}</span>
                        {isHistory && (won ? <span className="text-green-400 text-sm">(Wygrana)</span> : <span className="text-red-400 text-sm">(Przegrana)</span>)}
                    </h4>
                    <div className="text-sm font-mono text-gray-300 flex items-center gap-1">
                         {!isHistory && <RaidTimer startTime={raid.startTime} />}
                         {isHistory && <span className="text-xs text-gray-500">{new Date(raid.startTime).toLocaleDateString()}</span>}
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                        <p className="text-gray-400">Typ: <span className="text-white font-bold">{raid.type === RaidType.RESOURCES ? 'Grabież' : 'Sparing'}</span></p>
                        {!isHistory && <p className="text-gray-400">Status: <span className="text-white font-bold">{raid.status}</span></p>}
                    </div>
                    <div className="text-right">
                         <p className="text-gray-400">Nasze siły: <span className="text-white font-bold">{participants.length}</span></p>
                         <p className="text-gray-400">Siły wroga: <span className="text-white font-bold">{opponentsCount}</span></p>
                    </div>
                </div>

                {raid.status === RaidStatus.PREPARING && !isHistory && (
                    <button 
                        onClick={() => handleJoin(raid.id)} 
                        disabled={isJoined}
                        className={`w-full py-2 rounded font-bold text-white ${isJoined ? 'bg-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                    >
                        {isJoined ? 'Dołączono' : `Dołącz do ${isIncoming ? 'Obrony' : 'Ataku'}`}
                    </button>
                )}
                
                {isHistory && (
                    <div className="flex justify-between items-center">
                         <div className="text-xs text-gray-400 flex items-center gap-2">
                             {won && raid.loot && raid.loot.gold > 0 && (
                                 <span className="flex items-center text-amber-400"><CoinsIcon className="h-3 w-3 mr-1"/> {raid.loot.gold}</span>
                             )}
                             {won && raid.loot?.essences && Object.keys(raid.loot.essences).length > 0 && (
                                 <span className="flex items-center text-purple-400"><StarIcon className="h-3 w-3 mr-1"/> Esencje</span>
                             )}
                         </div>
                        <button onClick={() => prepareRaidSummary(raid)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600 text-white">
                            Zobacz Raport
                        </button>
                    </div>
                )}
                
                {/* Participants List Preview */}
                {!isHistory && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <p className="text-xs text-gray-500 mb-2">Zapisani gracze:</p>
                        <div className="flex flex-wrap gap-2">
                            {participants.map(p => (
                                <span key={p.userId} className={`text-xs px-2 py-1 rounded border border-slate-600 ${p.userId === myUserId ? 'bg-indigo-900/50 text-indigo-200' : 'bg-slate-800 text-gray-300'}`}>
                                    {p.name} (Lvl {p.level})
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {selectedRaid && modalData && (
                 <ExpeditionSummaryModal 
                    reward={modalData.summary}
                    onClose={() => { 
                        // CRITICAL FIX: Refresh character data after raid report view to sync HP/Mana
                        api.getCharacter().then(updateCharacter);
                        setSelectedRaid(null); 
                        setModalData(null); 
                    }}
                    characterName="" 
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    enemies={enemies}
                    isHunting={true}
                    isRaid={true} 
                    raidId={selectedRaid.id} 
                    huntingMembers={modalData.summary.huntingMembers}
                    opponents={modalData.opponents}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Left: Incoming Attacks (Priority) */}
                <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl border border-red-500/30 flex flex-col min-h-0">
                    <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                        <ShieldIcon className="h-6 w-6"/> Nadchodzące Ataki
                    </h3>
                    <div className="flex-grow overflow-y-auto pr-2">
                        {incomingRaids.length === 0 && <p className="text-gray-500 text-center py-8">Brak zagrożeń.</p>}
                        {incomingRaids.map(r => <RaidCard key={r.id} raid={r} type="INCOMING" />)}
                    </div>
                </div>

                {/* Middle: Outgoing Attacks */}
                <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl border border-green-500/30 flex flex-col min-h-0">
                    <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                        <SwordsIcon className="h-6 w-6"/> Nasze Ataki
                    </h3>
                    <div className="flex-grow overflow-y-auto pr-2">
                        {outgoingRaids.length === 0 && <p className="text-gray-500 text-center py-8">Brak aktywnych ataków.</p>}
                        {outgoingRaids.map(r => <RaidCard key={r.id} raid={r} type="OUTGOING" />)}
                    </div>
                </div>

                {/* Right: Declare War & History */}
                <div className="lg:col-span-1 flex flex-col gap-6 h-full min-h-0">
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col h-fit">
                        <h3 className="text-xl font-bold text-white mb-4">Wypowiedz Wojnę</h3>
                        {canDeclare ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Cel Ataku</label>
                                    <select className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" value={selectedTarget} onChange={e => setSelectedTarget(Number(e.target.value))}>
                                        <option value="">-- Wybierz Gildię --</option>
                                        {targets.map(t => (
                                            <option key={t.id} value={t.id}>[{t.tag}] {t.name} (Członków: {t.member_count})</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Typ Rajdu</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => setRaidType(RaidType.RESOURCES)}
                                            className={`py-2 rounded border ${raidType === RaidType.RESOURCES ? 'bg-amber-700 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-gray-400'}`}
                                        >
                                            Grabież (Zasoby)
                                        </button>
                                        <button 
                                            onClick={() => setRaidType(RaidType.SPARRING)}
                                            className={`py-2 rounded border ${raidType === RaidType.SPARRING ? 'bg-indigo-700 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-gray-400'}`}
                                        >
                                            Sparing (Trening)
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {raidType === RaidType.RESOURCES ? 'Zwycięstwo kradnie 25% złota i esencji z banku wroga.' : 'Walka bez nagród materialnych.'}
                                    </p>
                                </div>

                                <button onClick={handleDeclare} disabled={!selectedTarget} className="w-full py-3 bg-red-700 hover:bg-red-600 rounded font-bold text-white disabled:bg-slate-700 disabled:text-gray-500">
                                    WYPOWIEDZ WOJNĘ
                                </button>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4">Tylko Lider i Oficerowie mogą wypowiadać wojny.</p>
                        )}
                    </div>
                    
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col flex-grow min-h-0">
                        <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-2">Historia Wojen</h3>
                        <div className="flex-grow overflow-y-auto pr-2">
                            {history.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">Brak historii.</p>}
                            {history.map(r => <RaidCard key={r.id} raid={r} type="HISTORY" />)}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
