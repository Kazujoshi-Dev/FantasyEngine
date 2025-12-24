
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExpeditionRewardSummary, CombatLogEntry, ItemTemplate, Affix, Enemy, PartyMember, PvpRewardSummary, CombatType, PartyMemberStatus, Race, ItemInstance } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CombatLogRow } from './CombatLog';
import { DamageMeter } from './summary/DamageMeter';
import { EnemyListPanel, PartyMemberList } from './summary/CombatLists';
import { StandardRewardsPanel, RaidRewardsPanel, PvpRewardsPanel } from './summary/RewardPanels';
import { CombatantStatsPanel } from './summary/CombatantStatsPanel';
import { ItemTooltip } from '../shared/ItemSlot';

interface CombatReportModalProps {
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

export const ExpeditionSummaryModal: React.FC<CombatReportModalProps> = ({
    reward, onClose, characterName, itemTemplates, affixes, enemies, 
    messageId, raidId, isHunting, isRaid, huntingMembers, opponents, 
    allRewards, isPvp, pvpData, isDefenderView, initialEnemy, bossName, backgroundImage
}) => {
    const { t } = useTranslation();
    const [currentTurn, setCurrentTurn] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [isAnimationFinished, setIsAnimationFinished] = useState(false);
    const [speed, setSpeed] = useState(1);
    const logEndRef = useRef<HTMLDivElement>(null);
    const [selectedCombatant, setSelectedCombatant] = useState<{ name: string, stats: any, description?: string } | null>(null);
    const [inspectedRewardItem, setInspectedRewardItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);
    const [copyStatus, setCopyStatus] = useState('');

    const log = reward.combatLog || [];

    const pvpOpponentAsEnemy = useMemo(() => {
        if (!isPvp || !pvpData) return null;
        const opp = isDefenderView ? pvpData.attacker : pvpData.defender;
        return {
            id: String(opp.id),
            name: opp.name,
            stats: opp.stats as any,
            description: `Poziom ${opp.level} ${t(`race.${opp.race}`)}`,
            isBoss: false,
            lootTable: [],
            resourceLootTable: [],
            rewards: { minGold: 0, maxGold: 0, minExperience: 0, maxExperience: 0 }
        } as Enemy;
    }, [isPvp, pvpData, isDefenderView, t]);

    const enemiesList = useMemo(() => {
        if (isPvp && pvpOpponentAsEnemy) return [pvpOpponentAsEnemy];
        return reward.encounteredEnemies || (initialEnemy ? [initialEnemy] : []);
    }, [isPvp, pvpOpponentAsEnemy, reward.encounteredEnemies, initialEnemy]);

    useEffect(() => {
        if (isAutoPlaying && currentTurn < log.length) {
            const timer = setTimeout(() => {
                setCurrentTurn(prev => {
                    const next = prev + 1;
                    if (next >= log.length) setIsAnimationFinished(true);
                    return next;
                });
            }, 1000 / speed);
            return () => clearTimeout(timer);
        } else if (currentTurn >= log.length) {
            setIsAnimationFinished(true);
        }
    }, [isAutoPlaying, currentTurn, log.length, speed]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentTurn]);

    const handleSkip = () => {
        setCurrentTurn(log.length);
        setIsAutoPlaying(false);
        setIsAnimationFinished(true);
    };

    const displayedLogs = log.slice(0, currentTurn);
    const lastLog = displayedLogs.length > 0 ? displayedLogs[displayedLogs.length - 1] : log[0];

    const logsWithRoundHeaders = useMemo(() => {
        const result: (CombatLogEntry | { isHeader: boolean, round: number })[] = [];
        let lastRound = -1;
        let headerAddedForThisRound = false;

        displayedLogs.forEach((entry) => {
            if (entry.turn !== lastRound) {
                lastRound = entry.turn;
                headerAddedForThisRound = false;
            }
            if (entry.action !== 'starts a fight with' && !headerAddedForThisRound) {
                result.push({ isHeader: true, round: entry.turn });
                headerAddedForThisRound = true;
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
        const sortedMembers = Object.entries(stats).map(([name, dmg]) => ({ name, dmg })).sort((a, b) => b.dmg - a.dmg);
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

    const dynamicPartyStatus = useMemo(() => {
        const statusMap: Record<string, { currentHealth: number, maxHealth: number, currentMana?: number, maxMana?: number }> = {};
        if (lastLog?.allPlayersHealth) {
            lastLog.allPlayersHealth.forEach(p => {
                statusMap[p.name] = { 
                    currentHealth: p.currentHealth, 
                    maxHealth: p.maxHealth,
                    currentMana: p.currentMana,
                    maxMana: p.maxMana
                };
            });
        } else if (lastLog) {
            const maxHP = log[0]?.playerStats?.maxHealth || 100;
            const maxMP = log[0]?.playerStats?.maxMana || 0;
            statusMap[characterName] = { 
                currentHealth: lastLog.playerHealth, 
                maxHealth: maxHP,
                currentMana: lastLog.playerMana,
                maxMana: maxMP
            };
        }
        return statusMap;
    }, [lastLog, log, characterName]);

    const renderRewardsSection = () => {
        if (!isAnimationFinished) return null;
        if (isPvp && pvpData) return <PvpRewardsPanel isVictory={reward.isVictory} gold={reward.totalGold} experience={reward.totalExperience} />;
        if (isRaid) return <RaidRewardsPanel totalGold={reward.totalGold} essencesFound={reward.essencesFound} />;
        return <StandardRewardsPanel reward={reward} itemTemplates={itemTemplates} affixes={affixes} onInspectItem={setInspectedRewardItem} />;
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[9999] animate-fade-in backdrop-blur-sm overflow-hidden">
            {inspectedRewardItem && (
                <ItemTooltip 
                    instance={inspectedRewardItem.item} 
                    template={inspectedRewardItem.template} 
                    affixes={affixes} 
                    itemTemplates={itemTemplates} 
                    isCentered={true} 
                    onClose={() => setInspectedRewardItem(null)} 
                />
            )}
            <div className="w-full max-w-[1400px] h-full max-h-[90vh] rounded-2xl border-2 border-slate-700 shadow-2xl flex flex-col relative overflow-y-auto custom-scrollbar" 
                 style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover' } : { backgroundColor: 'var(--window-bg, #0f172a)' }}>
                
                <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center z-[110] sticky top-0 backdrop-blur-md">
                    <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                            {isPvp ? 'Pojedynek PvP' : isRaid ? 'Bitwa Gildii' : isHunting ? `Polowanie: ${bossName || 'Boss'}` : t('expedition.combatReport')}
                        </h2>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button onClick={handleCopyLink} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md font-bold text-xs transition-colors">{copyStatus || 'Kopiuj Link'}</button>
                        {!isAnimationFinished && <button onClick={handleSkip} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-md font-bold text-xs transition-colors uppercase tracking-tight">Pomiń animację</button>}
                        <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md font-bold text-xs transition-colors">{isAutoPlaying ? 'Pauza' : 'Graj'}</button>
                        <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md font-bold text-xs transition-colors">Zamknij</button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row p-6 gap-6 min-h-fit">
                    <div className="w-full lg:w-[300px] flex-shrink-0 flex flex-col gap-4">
                        {selectedCombatant ? (
                             <CombatantStatsPanel 
                                name={selectedCombatant.name} 
                                stats={selectedCombatant.stats} 
                                description={selectedCombatant.description} 
                                currentHealth={dynamicPartyStatus[selectedCombatant.name]?.currentHealth}
                                currentMana={dynamicPartyStatus[selectedCombatant.name]?.currentMana}
                             />
                        ) : isPvp && pvpData ? (
                             <CombatantStatsPanel 
                                name={isDefenderView ? pvpData.attacker.name : pvpData.defender.name} 
                                stats={isDefenderView ? pvpData.attacker.stats : pvpData.defender.stats} 
                                currentHealth={isDefenderView ? lastLog.enemyHealth : lastLog.playerHealth}
                                currentMana={isDefenderView ? lastLog.enemyMana : lastLog.playerMana}
                             />
                        ) : (
                            <DamageMeter damageData={damageMeterData} title=" Damage Meter" />
                        )}
                    </div>

                    <div className="flex-1 bg-black/40 rounded-xl border border-slate-700 p-4 flex flex-col shadow-inner min-h-[400px]">
                        <div className="space-y-1">
                            {logsWithRoundHeaders.map((entry, idx) => (
                                'isHeader' in entry ? 
                                <div key={idx} className="text-center text-slate-500 text-[10px] my-4 uppercase font-bold border-b border-slate-800 pb-1">Runda {entry.round === 0 ? '0 (Atak z dystansu)' : entry.round}</div> :
                                <CombatLogRow key={idx} log={entry} characterName={characterName} isHunting={isHunting} huntingMembers={huntingMembers} />
                            ))}
                            <div ref={logEndRef} className="h-4" />
                        </div>
                    </div>

                    <div className="w-full lg:w-[300px] flex-shrink-0 flex flex-col gap-4">
                        {isRaid ? (
                            <>
                                <PartyMemberList members={huntingMembers || []} finalPartyStatus={dynamicPartyStatus} onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })} />
                                <PartyMemberList isEnemyTeam members={opponents || []} finalPartyStatus={dynamicPartyStatus} onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })} />
                            </>
                        ) : (
                            <>
                                <PartyMemberList members={isHunting ? (huntingMembers || []) : [{ userId: 0, characterName, level: 1, race: Race.Human, status: PartyMemberStatus.Member, stats: log[0]?.playerStats }]} finalPartyStatus={dynamicPartyStatus} onMemberClick={(m) => setSelectedCombatant({ name: m.characterName, stats: m.stats })} />
                                <EnemyListPanel enemies={enemiesList} finalEnemiesHealth={lastLog?.allEnemiesHealth} globalEnemyHealth={lastLog?.enemyHealth} onEnemyClick={(e) => setSelectedCombatant({ name: e.name, stats: e.stats, description: e.description })} />
                            </>
                        )}
                    </div>
                </div>

                {isAnimationFinished && (
                    <div className="p-6 border-t border-slate-700 bg-slate-800/80 mt-auto animate-fade-in">
                        {renderRewardsSection()}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
