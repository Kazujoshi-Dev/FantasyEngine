import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { 
    ExpeditionRewardSummary, 
    ItemTemplate, 
    Affix, 
    Enemy, 
    CombatLogEntry, 
    PartyMember, 
    Race, 
    PartyMemberStatus 
} from '../../types';
import { CombatLogRow } from './CombatLog';
import { CombatantStatsPanel } from './summary/CombatantStatsPanel';
import { EnemyListPanel, PartyMemberList } from './summary/CombatLists';
import { DamageMeter } from './summary/DamageMeter';
import { StandardRewardsPanel, PvpRewardsPanel, RaidRewardsPanel } from './summary/RewardPanels';

interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    enemies: Enemy[];
    isHunting?: boolean;
    isRaid?: boolean;
    isPvp?: boolean;
    huntingMembers?: PartyMember[];
    opponents?: PartyMember[];
    allRewards?: Record<string, any>;
    initialEnemy?: Enemy;
    bossName?: string;
    messageId?: number | null;
    raidId?: number | null;
    isDefenderView?: boolean;
    backgroundImage?: string;
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({
    reward,
    onClose,
    characterName,
    itemTemplates,
    affixes,
    enemies,
    isHunting,
    isRaid,
    isPvp,
    huntingMembers,
    opponents,
    allRewards,
    initialEnemy,
    bossName,
    messageId,
    raidId,
    isDefenderView,
    backgroundImage
}) => {
    const { t } = useTranslation();
    const [selectedCombatant, setSelectedCombatant] = useState<{ name: string; stats: any; description?: string } | null>(null);
    const [showLog, setShowLog] = useState(false);
    const [animatedLog, setAnimatedLog] = useState<CombatLogEntry[]>([]);
    
    const log = reward.combatLog || [];
    const lastLog = log.length > 0 ? log[log.length - 1] : null;

    useEffect(() => {
        if (!showLog) {
            setAnimatedLog(log);
        }
    }, [showLog, log]);

    const dynamicPartyHealth = useMemo(() => {
        const healthMap: Record<string, { currentHealth: number, maxHealth: number }> = {};
        if (lastLog?.allPlayersHealth) {
            lastLog.allPlayersHealth.forEach(p => {
                healthMap[p.name] = { currentHealth: p.currentHealth, maxHealth: p.maxHealth };
            });
        }
        return healthMap;
    }, [lastLog]);

    // Simple damage meter logic
    const damageMeterData = useMemo(() => {
        const stats: Record<string, number> = {};
        log.forEach(entry => {
            if (entry.damage && entry.attacker) {
                stats[entry.attacker] = (stats[entry.attacker] || 0) + entry.damage;
            }
        });
        const sorted = Object.entries(stats)
            .map(([name, dmg]) => ({ name, dmg }))
            .sort((a, b) => b.dmg - a.dmg);
            
        return { stats, totalDamage: sorted.reduce((s, item) => s + item.dmg, 0), turns: Math.max(1, log.length), sortedMembers: sorted };
    }, [log]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 overflow-y-auto">
            <div 
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col relative overflow-hidden"
                style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            >
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"></div>
                
                {/* Header */}
                <div className="relative z-10 flex justify-between items-center p-6 border-b border-slate-700/50 bg-slate-900/50">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                        {isPvp ? 'Raport z Pojedynku' : isRaid ? 'Raport z Rajdu' : isHunting ? 'Raport z Polowania' : t('expedition.combatReport')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="relative z-10 flex flex-1 min-h-0 overflow-hidden">
                    {/* Left: Stats & Lists */}
                    <div className="w-[300px] flex-shrink-0 flex flex-col gap-4 p-6 overflow-y-auto custom-scrollbar border-r border-slate-700/50">
                        {isRaid ? (
                            <>
                                <PartyMemberList members={huntingMembers || []} finalPartyHealth={dynamicPartyHealth} onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })} />
                                <PartyMemberList isEnemyTeam members={opponents || []} finalPartyHealth={dynamicPartyHealth} onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })} />
                            </>
                        ) : (
                            <>
                                <PartyMemberList members={isHunting ? (huntingMembers || []) : [{ userId: 0, characterName, level: 1, race: Race.Human, status: PartyMemberStatus.Member, stats: log[0]?.playerStats }]} finalPartyHealth={dynamicPartyHealth} onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })} />
                                <EnemyListPanel 
                                    enemies={reward.encounteredEnemies || (initialEnemy ? [initialEnemy] : [])} 
                                    finalEnemiesHealth={lastLog?.allEnemiesHealth} 
                                    globalEnemyHealth={lastLog?.enemyHealth}
                                    onEnemyClick={(e) => setSelectedCombatant({ name: e.name, stats: e.stats, description: e.description })} 
                                />
                            </>
                        )}
                        
                        <DamageMeter damageData={damageMeterData} title={t('expedition.damageMeter.title')} />
                    </div>

                    {/* Middle: Log & Details */}
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar relative">
                        {selectedCombatant ? (
                            <div className="h-full flex flex-col animate-fade-in">
                                <button onClick={() => setSelectedCombatant(null)} className="mb-4 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold">&larr; Wróć do raportu</button>
                                <div className="flex-1">
                                    <CombatantStatsPanel 
                                        name={selectedCombatant.name} 
                                        stats={selectedCombatant.stats} 
                                        description={selectedCombatant.description}
                                        currentHealth={dynamicPartyHealth[selectedCombatant.name]?.currentHealth}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Victory/Defeat & Loot */}
                                {isPvp ? (
                                    <PvpRewardsPanel isVictory={reward.isVictory} gold={reward.totalGold} experience={reward.totalExperience} />
                                ) : isRaid ? (
                                    <RaidRewardsPanel totalGold={reward.totalGold} essencesFound={reward.essencesFound} />
                                ) : (
                                    <StandardRewardsPanel reward={reward} itemTemplates={itemTemplates} affixes={affixes} />
                                )}

                                {/* Combat Log */}
                                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                                        <h4 className="font-bold text-gray-400 uppercase tracking-widest text-xs">Przebieg Walki</h4>
                                    </div>
                                    <div className="space-y-1 font-serif">
                                        {animatedLog.map((entry, idx) => (
                                            <CombatLogRow key={idx} log={entry} characterName={characterName} isHunting={isHunting} huntingMembers={huntingMembers} />
                                        ))}
                                        {animatedLog.length === 0 && <p className="text-center text-gray-600 py-10 italic">Cisza przed burzą...</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="relative z-10 p-6 border-t border-slate-700/50 bg-slate-900/50 flex justify-end gap-4">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all">{t('expedition.returnToCamp')}</button>
                </div>
            </div>
        </div>
    );
};