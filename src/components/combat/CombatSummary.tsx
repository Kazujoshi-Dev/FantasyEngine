
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ExpeditionRewardSummary, CombatLogEntry, ItemTemplate, Affix, Enemy, PartyMember, PvpRewardSummary, EssenceType, PartyMemberStatus } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CombatLogRow } from './CombatLog';
import { DamageMeter } from './summary/DamageMeter';
import { EnemyListPanel, PartyMemberList } from './summary/CombatLists';
import { StandardRewardsPanel, RaidRewardsPanel } from './summary/RewardPanels';
import { CombatantStatsPanel } from './summary/CombatantStatsPanel';

interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    enemies: Enemy[];
    messageId?: number | null;
    raidId?: number | null;
    isHunting?: boolean;
    isRaid?: boolean;
    huntingMembers?: PartyMember[];
    opponents?: any[];
    allRewards?: Record<string, any>;
    isPvp?: boolean;
    pvpData?: { attacker: any, defender: any };
    isDefenderView?: boolean;
    initialEnemy?: Enemy;
    bossName?: string;
    backgroundImage?: string;
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({
    reward, onClose, characterName, itemTemplates, affixes, enemies, 
    messageId, raidId, isHunting, isRaid, huntingMembers, opponents, 
    allRewards, isPvp, pvpData, isDefenderView, initialEnemy, bossName, backgroundImage
}) => {
    const { t } = useTranslation();
    const [currentTurn, setCurrentTurn] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [speed, setSpeed] = useState(1);
    const logEndRef = useRef<HTMLDivElement>(null);
    const [selectedCombatant, setSelectedCombatant] = useState<{ name: string, stats: any, description?: string } | null>(null);
    const [copyStatus, setCopyStatus] = useState('');

    const log = reward.combatLog || [];

    useEffect(() => {
        if (isAutoPlaying && currentTurn < log.length) {
            const timer = setTimeout(() => {
                setCurrentTurn(prev => prev + 1);
            }, 1000 / speed);
            return () => clearTimeout(timer);
        }
    }, [isAutoPlaying, currentTurn, log.length, speed]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentTurn]);

    const displayedLogs = log.slice(0, currentTurn);
    const lastLog = displayedLogs[displayedLogs.length - 1];

    // Grouping logs by round for display
    const logsWithRoundHeaders = useMemo(() => {
        const result: (CombatLogEntry | { isHeader: boolean, round: number })[] = [];
        let lastRound = -1;

        displayedLogs.forEach((entry) => {
            if (entry.turn > 0 && entry.turn !== lastRound) {
                result.push({ isHeader: true, round: entry.turn });
                lastRound = entry.turn;
            }
            result.push(entry);
        });
        return result;
    }, [displayedLogs]);

    const damageMeterData = useMemo(() => {
        const stats: Record<string, number> = {};
        let turns = 0;
        displayedLogs.forEach(entry => {
            if (entry.damage) {
                const attacker = entry.attacker;
                stats[attacker] = (stats[attacker] || 0) + entry.damage;
            }
            if (entry.turn > turns) turns = entry.turn;
        });
        
        const sortedMembers = Object.entries(stats)
            .map(([name, dmg]) => ({ name, dmg }))
            .sort((a, b) => b.dmg - a.dmg);

        return { stats, totalDamage: Object.values(stats).reduce((a, b) => a + b, 0), turns: Math.max(1, turns), sortedMembers };
    }, [displayedLogs]);

    const handleCopyLink = () => {
        const id = messageId || raidId;
        if (!id) return;
        const path = raidId ? 'raid' : 'report';
        const url = `${window.location.origin}/${path}/${id}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopyStatus('Skopiowano!');
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };

    const modalBgStyle = backgroundImage 
        ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
        : { backgroundColor: 'var(--window-bg, #0f172a)' };

    // Dynamic Player Stats for the Right Panel
    const dynamicPartyHealth = useMemo(() => {
        const healthMap: Record<string, { currentHealth: number, maxHealth: number }> = {};
        
        if (lastLog?.allPlayersHealth) {
            lastLog.allPlayersHealth.forEach(p => {
                healthMap[p.name] = { currentHealth: p.currentHealth, maxHealth: p.maxHealth };
            });
        } else if (lastLog) {
            // Single player logic
            const maxHP = log[0]?.playerStats?.maxHealth || 100;
            healthMap[characterName] = { currentHealth: lastLog.playerHealth, maxHealth: maxHP };
        } else if (log.length > 0) {
            // Initial state
            const initial = log[0];
            const maxHP = initial.playerStats?.maxHealth || 100;
            healthMap[characterName] = { currentHealth: initial.playerHealth, maxHealth: maxHP };
        }
        
        return healthMap;
    }, [lastLog, log, characterName]);

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] animate-fade-in backdrop-blur-sm">
            <div 
                className="w-full max-w-[1400px] h-[90vh] rounded-2xl border-2 border-slate-700 shadow-2xl flex flex-col relative overflow-hidden"
                style={modalBgStyle}
            >
                <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                            {isPvp ? 'Pojedynek PvP' : isRaid ? 'Bitwa Gildii' : isHunting ? `Polowanie: ${bossName || 'Boss'}` : t('expedition.combatReport')}
                        </h2>
                        <p className="text-xs text-gray-400">Postęp: {currentTurn} / {log.length}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        {(messageId || raidId) && (
                            <button onClick={handleCopyLink} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md font-bold text-xs transition-colors">
                                {copyStatus || 'Kopiuj Link'}
                            </button>
                        )}
                         <div className="flex bg-slate-900 rounded p-1 mx-2">
                            {[1, 2, 4].map(s => (
                                <button key={s} onClick={() => setSpeed(s)} className={`px-2 py-1 text-xs rounded font-bold ${speed === s ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>{s}x</button>
                            ))}
                        </div>
                        <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className="px-4 py-2 bg-slate-700 rounded-md hover:bg-slate-600 font-bold transition-colors">
                            {isAutoPlaying ? 'Pauza' : 'Graj'}
                        </button>
                        <button onClick={() => setCurrentTurn(log.length)} className="px-4 py-2 bg-slate-700 rounded-md hover:bg-slate-600 font-bold">Pomiń</button>
                        <button onClick={onClose} className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700 font-bold">Zamknij</button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden p-6 gap-6 relative">
                    {/* Left: Stats Panel - Fixed Width */}
                    <div className="w-[300px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar z-10">
                        {selectedCombatant ? (
                             <div className="relative group">
                                <button 
                                    className="absolute -top-2 -right-2 z-[110] bg-red-600 text-white w-6 h-6 rounded-full text-xs font-bold shadow-lg"
                                    onClick={() => setSelectedCombatant(null)}
                                >✕</button>
                                <CombatantStatsPanel 
                                    name={selectedCombatant.name} 
                                    stats={selectedCombatant.stats} 
                                    description={selectedCombatant.description}
                                    currentHealth={dynamicPartyHealth[selectedCombatant.name]?.currentHealth}
                                />
                             </div>
                        ) : isPvp && pvpData ? (
                             <CombatantStatsPanel name={isDefenderView ? pvpData.attacker.name : pvpData.defender.name} stats={isDefenderView ? pvpData.attacker.stats : pvpData.defender.stats} />
                        ) : isHunting && initialEnemy ? (
                             <CombatantStatsPanel name={initialEnemy.name} stats={initialEnemy.stats} description={initialEnemy.description} />
                        ) : (
                            <div className="text-gray-500 text-sm italic text-center p-8 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
                                Kliknij na ikonę postaci, aby zobaczyć szczegóły.
                            </div>
                        )}
                        
                        <DamageMeter damageData={damageMeterData} title="Statystyki Bojowe" />
                    </div>

                    {/* Middle: Live Combat Log - Expanded space */}
                    <div className="flex-1 bg-black/40 rounded-xl border border-slate-700 p-4 flex flex-col z-10 shadow-inner">
                        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-1">
                            {logsWithRoundHeaders.map((entry, idx) => {
                                if ('isHeader' in entry) {
                                    return (
                                        <div key={`round-${entry.round}`} className="flex items-center gap-4 my-4">
                                            <div className="flex-1 h-px bg-slate-700"></div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Runda {entry.round}</span>
                                            <div className="flex-1 h-px bg-slate-700"></div>
                                        </div>
                                    );
                                }
                                return (
                                    <CombatLogRow 
                                        key={idx} 
                                        log={entry} 
                                        characterName={characterName} 
                                        isHunting={isHunting} 
                                        huntingMembers={huntingMembers} 
                                    />
                                );
                            })}
                            <div ref={logEndRef} />
                        </div>
                    </div>

                    {/* Right: Participant Lists - Fixed Width */}
                    <div className="w-[300px] flex-shrink-0 flex flex-col gap-4 z-10">
                        {isRaid ? (
                            <>
                                <PartyMemberList 
                                    members={huntingMembers || []} 
                                    finalPartyHealth={dynamicPartyHealth} 
                                    onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })}
                                    selectedName={selectedCombatant?.name}
                                />
                                <PartyMemberList 
                                    isEnemyTeam 
                                    members={opponents || []} 
                                    finalPartyHealth={dynamicPartyHealth} 
                                    onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })}
                                    selectedName={selectedCombatant?.name}
                                />
                            </>
                        ) : isHunting ? (
                            <>
                                <PartyMemberList 
                                    members={huntingMembers || []} 
                                    finalPartyHealth={dynamicPartyHealth} 
                                    onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })}
                                    selectedName={selectedCombatant?.name}
                                />
                                <EnemyListPanel 
                                    enemies={reward.encounteredEnemies || (initialEnemy ? [initialEnemy] : [])} 
                                    finalEnemiesHealth={lastLog?.allEnemiesHealth} 
                                    onEnemyClick={(e) => setSelectedCombatant({ name: e.name, stats: e.stats, description: e.description })}
                                    selectedName={selectedCombatant?.name}
                                />
                            </>
                        ) : (
                            <>
                                {/* DYNAMIC PLAYER CARD FOR SOLO/PVP */}
                                <PartyMemberList 
                                    members={[{ 
                                        userId: 0, 
                                        characterName: characterName, 
                                        level: 0, 
                                        race: (log[0]?.playerStats as any)?.race || 'Human', 
                                        status: PartyMemberStatus.Member 
                                    }]} 
                                    finalPartyHealth={dynamicPartyHealth} 
                                    onMemberClick={() => setSelectedCombatant({ name: characterName, stats: log[0]?.playerStats })}
                                    selectedName={selectedCombatant?.name}
                                />
                                
                                {isPvp && pvpData ? (
                                     <CombatantStatsPanel name={isDefenderView ? pvpData.defender.name : pvpData.attacker.name} stats={isDefenderView ? pvpData.defender.stats : pvpData.attacker.stats} />
                                ) : (
                                     <EnemyListPanel 
                                        enemies={reward.encounteredEnemies || (initialEnemy ? [initialEnemy] : [])} 
                                        finalEnemiesHealth={lastLog?.allEnemiesHealth} 
                                        onEnemyClick={(e) => setSelectedCombatant({ name: e.name, stats: e.stats, description: e.description })}
                                        selectedName={selectedCombatant?.name}
                                     />
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 bg-slate-800/50 z-10 flex-shrink-0">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {isRaid ? (
                            <RaidRewardsPanel 
                                totalGold={reward.totalGold} 
                                essencesFound={reward.essencesFound} 
                            />
                        ) : (
                            <StandardRewardsPanel reward={reward} itemTemplates={itemTemplates} affixes={affixes} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
