import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ExpeditionRewardSummary, CombatLogEntry, ItemTemplate, Affix, Enemy, PartyMember, PvpRewardSummary, EssenceType } from '../../types';
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
    const [hoveredCombatant, setHoveredCombatant] = useState<{ name: string, stats: any, description?: string } | null>(null);

    const log = reward.combatLog || [];

    // Animation Effect
    useEffect(() => {
        if (isAutoPlaying && currentTurn < log.length) {
            const timer = setTimeout(() => {
                setCurrentTurn(prev => prev + 1);
            }, 1000 / speed);
            return () => clearTimeout(timer);
        }
    }, [isAutoPlaying, currentTurn, log.length, speed]);

    // Auto-scroll Effect
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentTurn]);

    const displayedLogs = log.slice(0, currentTurn);

    // Damage Calculation for Meter
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

    const handleHover = (name: string, stats: any, description?: string) => {
        setHoveredCombatant({ name, stats, description });
    };

    const modalBgStyle = backgroundImage 
        ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
        : { backgroundColor: 'var(--window-bg, #0f172a)' };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
            <div 
                className="w-full max-w-6xl h-[90vh] rounded-2xl border-2 border-slate-700 shadow-2xl flex flex-col relative overflow-hidden"
                style={modalBgStyle}
            >
                {/* Header Controls */}
                <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                            {isPvp ? 'Pojedynek PvP' : isRaid ? 'Bitwa Gildii' : isHunting ? `Polowanie: ${bossName || 'Boss'}` : t('expedition.combatReport')}
                        </h2>
                        <p className="text-xs text-gray-400">Postęp: {currentTurn} / {log.length}</p>
                    </div>
                    <div className="flex gap-4 items-center">
                         <div className="flex bg-slate-900 rounded p-1">
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
                    {/* Left: Stats Panel */}
                    <div className="w-1/4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar z-10">
                        {hoveredCombatant ? (
                             <CombatantStatsPanel name={hoveredCombatant.name} stats={hoveredCombatant.stats} description={hoveredCombatant.description} />
                        ) : isPvp && pvpData ? (
                             <CombatantStatsPanel name={isDefenderView ? pvpData.attacker.name : pvpData.defender.name} stats={isDefenderView ? pvpData.attacker.stats : pvpData.defender.stats} />
                        ) : isHunting && initialEnemy ? (
                             <CombatantStatsPanel name={initialEnemy.name} stats={initialEnemy.stats} description={initialEnemy.description} />
                        ) : (
                            <div className="text-gray-500 text-sm italic text-center p-8 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
                                Najedź na ikonę postaci lub wroga, aby zobaczyć jego statystyki.
                            </div>
                        )}
                        
                        <DamageMeter damageData={damageMeterData} title="Statystyki Bojowe" />
                    </div>

                    {/* Middle: Live Combat Log */}
                    <div className="flex-1 bg-black/40 rounded-xl border border-slate-700 p-4 flex flex-col z-10 shadow-inner">
                        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-1">
                            {displayedLogs.map((entry, idx) => (
                                <CombatLogRow 
                                    key={idx} 
                                    log={entry} 
                                    characterName={characterName} 
                                    isHunting={isHunting} 
                                    huntingMembers={huntingMembers} 
                                />
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </div>

                    {/* Right: Participant Lists */}
                    <div className="w-1/4 flex flex-col gap-4 z-10">
                        {isRaid ? (
                            <>
                                <PartyMemberList members={huntingMembers || []} finalPartyHealth={{}} onMemberHover={(m) => handleHover(m.characterName, m.stats)} onMemberLeave={() => setHoveredCombatant(null)} />
                                <PartyMemberList isEnemyTeam members={opponents || []} finalPartyHealth={{}} onMemberHover={(m) => handleHover(m.characterName, m.stats)} onMemberLeave={() => setHoveredCombatant(null)} />
                            </>
                        ) : isHunting ? (
                            <>
                                <PartyMemberList members={huntingMembers || []} finalPartyHealth={{}} onMemberHover={(m) => handleHover(m.characterName, m.stats)} onMemberLeave={() => setHoveredCombatant(null)} />
                                <EnemyListPanel enemies={reward.encounteredEnemies || (initialEnemy ? [initialEnemy] : [])} finalEnemiesHealth={displayedLogs[displayedLogs.length-1]?.allEnemiesHealth} onEnemyHover={(e) => handleHover(e.name, e.stats, e.description)} onEnemyLeave={() => setHoveredCombatant(null)} />
                            </>
                        ) : isPvp && pvpData ? (
                             <CombatantStatsPanel name={isDefenderView ? pvpData.defender.name : pvpData.attacker.name} stats={isDefenderView ? pvpData.defender.stats : pvpData.attacker.stats} />
                        ) : (
                             <EnemyListPanel enemies={reward.encounteredEnemies || (initialEnemy ? [initialEnemy] : [])} finalEnemiesHealth={displayedLogs[displayedLogs.length-1]?.allEnemiesHealth} onEnemyHover={(e) => handleHover(e.name, e.stats, e.description)} onEnemyLeave={() => setHoveredCombatant(null)} />
                        )}
                    </div>
                </div>

                {/* Bottom Section: Rewards & Result */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 z-10 flex-shrink-0">
                    <div className="max-h-48 overflow-y-auto">
                        {isRaid ? (
                            <RaidRewardsPanel 
                                totalGold={reward.totalGold} 
                                essencesFound={reward.essencesFound} 
                                isVictory={reward.isVictory} 
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
