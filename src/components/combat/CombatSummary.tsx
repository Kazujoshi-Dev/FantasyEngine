
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ExpeditionRewardSummary, CharacterStats, EnemyStats, ItemTemplate, PvpRewardSummary, Affix, ItemInstance, PartyMember, EssenceType, Enemy, PlayerCharacter } from '../../types';
import { useTranslation } from '@/contexts/LanguageContext';
import { CombatLogRow } from './CombatLog';
import { EnemyListPanel, PartyMemberList } from './summary/CombatLists';
import { CombatantStatsPanel } from './summary/CombatantStatsPanel';
import { DamageMeter } from './summary/DamageMeter';
import { RaidRewardsPanel, StandardRewardsPanel } from './summary/RewardPanels';

export interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    enemies: Enemy[];
    isPvp?: boolean;
    pvpData?: { attacker: PlayerCharacter, defender: PlayerCharacter };
    isDefenderView?: boolean;
    isHunting?: boolean;
    isRaid?: boolean;
    huntingMembers?: PartyMember[];
    opponents?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number, items?: ItemInstance[], essences?: Partial<Record<EssenceType, any>> }>;
    initialEnemy?: Enemy;
    encounteredEnemies?: Enemy[];
    bossName?: string;
    messageId?: number | null;
    raidId?: number | null;
    backgroundImage?: string;
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = (props) => {
    const { 
        reward, onClose, characterName, itemTemplates, affixes, enemies,
        isPvp = false, pvpData, isDefenderView = false, 
        isHunting = false, isRaid = false, huntingMembers, opponents, allRewards,
        initialEnemy, encounteredEnemies, bossName, messageId, raidId,
    } = props;
    const { t } = useTranslation();

    const [hoveredCombatant, setHoveredCombatant] = useState<{ type: 'player' | 'enemy' | 'partyMember', data: any, rect: DOMRect } | null>(null);

    const initialPlayerStats = useMemo(() => {
        if (isPvp) return isDefenderView ? pvpData!.defender.stats : pvpData!.attacker.stats;
        return reward.combatLog[0]?.playerStats || reward.combatLog[0]?.partyMemberStats?.[characterName];
    }, [isPvp, isDefenderView, pvpData, reward.combatLog, characterName]);

    const initialEnemyForDisplay = useMemo(() => {
        if (isPvp) {
            const opponent = isDefenderView ? pvpData!.attacker : pvpData!.defender;
            return { name: opponent.name, stats: opponent.stats, description: `Lvl ${opponent.level} ${t(`race.${opponent.race}`)}` };
        }
        if (isHunting && bossName && reward.combatLog[0]?.enemyStats) {
            return { name: bossName, stats: reward.combatLog[0].enemyStats, description: reward.combatLog[0].enemyDescription };
        }
        if (encounteredEnemies && encounteredEnemies.length > 0) {
            return { name: encounteredEnemies[0].name, stats: encounteredEnemies[0].stats, description: encounteredEnemies[0].description };
        }
        if (reward.combatLog.length > 0) {
            const firstLog = reward.combatLog[0];
            return { name: firstLog.defender, stats: firstLog.enemyStats, description: firstLog.enemyDescription };
        }
        return null;
    }, [isPvp, isDefenderView, pvpData, isHunting, bossName, reward.combatLog, encounteredEnemies, t]);

    const finalState = useMemo(() => {
        const lastLog = reward.combatLog.length > 0 ? reward.combatLog[reward.combatLog.length - 1] : null;
        if (!lastLog) {
            return { playerHealth: 0, enemyHealth: 0, partyHealth: {}, enemiesHealth: [] };
        }
        const partyHealth: Record<string, { currentHealth: number, maxHealth: number, currentMana?: number, maxMana?: number }> = {};
        if (lastLog.allPlayersHealth) {
            lastLog.allPlayersHealth.forEach(p => {
                partyHealth[p.name] = { currentHealth: p.currentHealth, maxHealth: p.maxHealth, currentMana: p.currentMana, maxMana: p.maxMana };
            });
        }
        return { playerHealth: lastLog.playerHealth, enemyHealth: lastLog.enemyHealth, partyHealth: partyHealth, enemiesHealth: lastLog.allEnemiesHealth || [] };
    }, [reward.combatLog]);
    
    const calculateDamageData = (membersList: PartyMember[] | undefined) => {
        if (!membersList) return null;
        const stats: Record<string, number> = {};
        let totalDamage = 0;
        const turns = reward.combatLog[reward.combatLog.length - 1]?.turn || 1;

        reward.combatLog.forEach(log => {
            if (log.damage) {
                const isMember = membersList.some(m => m.characterName === log.attacker);
                if (isMember) {
                    stats[log.attacker] = (stats[log.attacker] || 0) + log.damage;
                    totalDamage += log.damage;
                }
            }
        });
        
        const sortedMembers = Object.entries(stats).map(([name, dmg]) => ({ name, dmg })).sort((a, b) => b.dmg - a.dmg);
        return { stats, totalDamage, turns, sortedMembers };
    };

    const friendlyDamageData = useMemo(() => calculateDamageData(huntingMembers), [huntingMembers, reward.combatLog]);
    const opponentDamageData = useMemo(() => calculateDamageData(opponents), [opponents, reward.combatLog]);
    
    const onMemberHover = useCallback((member: PartyMember, rect: DOMRect) => {
        const initialStats = member.stats || reward.combatLog[0]?.partyMemberStats?.[member.characterName];

        if (initialStats) {
            const finalVitals = finalState.partyHealth[member.characterName];
            const statsAsCharacterStats = initialStats as CharacterStats;
            const mergedStats: CharacterStats = {
                ...statsAsCharacterStats,
                currentHealth: finalVitals?.currentHealth ?? statsAsCharacterStats.currentHealth,
                currentMana: finalVitals?.currentMana ?? statsAsCharacterStats.currentMana,
                maxHealth: statsAsCharacterStats.maxHealth,
                maxMana: statsAsCharacterStats.maxMana
            };
            setHoveredCombatant({ type: 'partyMember', data: { name: member.characterName, stats: mergedStats }, rect });
        }
    }, [reward.combatLog, finalState.partyHealth]);
    
    const onEnemyHover = useCallback((enemy: Enemy, rect: DOMRect) => {
        const healthData = finalState.enemiesHealth.find(e => e.uniqueId === enemy.uniqueId);
        const statsToDisplay = { ...enemy.stats, maxHealth: healthData?.maxHealth ?? enemy.stats.maxHealth };
        setHoveredCombatant({ type: 'enemy', data: { name: healthData?.name || enemy.name, stats: statsToDisplay, currentHealth: healthData?.currentHealth ?? (enemy.stats.maxHealth), currentMana: 0 }, rect });
    }, [finalState.enemiesHealth]);

    const onMemberLeave = useCallback(() => {
        setHoveredCombatant(null);
    }, []);

    const onEnemyLeave = useCallback(() => {
        setHoveredCombatant(null);
    }, []);

    const handleCopyLink = useCallback(() => {
        if (!messageId && !raidId) return;
        const url = raidId 
            ? `${window.location.origin}/raid-report/${raidId}`
            : `${window.location.origin}/report/${messageId}`;
            
        navigator.clipboard.writeText(url).then(() => {
            alert('Skopiowano link do schowka!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('Błąd kopiowania linku.');
        });
    }, [messageId, raidId]);

    const backgroundStyle = props.backgroundImage ? { backgroundImage: `url(${props.backgroundImage})` } : {};

    const effectiveEnemies = useMemo(() => {
        if (encounteredEnemies && encounteredEnemies.length > 0) return encounteredEnemies;
        
        if (finalState.enemiesHealth && finalState.enemiesHealth.length > 0) {
             return finalState.enemiesHealth.map(h => {
                 const baseName = h.name.replace(/ \d+$/, '');
                 const template = enemies.find(e => e.name === baseName);

                 return {
                     id: h.uniqueId,
                     uniqueId: h.uniqueId,
                     name: h.name,
                     stats: template ? template.stats : { 
                        maxHealth: h.maxHealth, 
                        minDamage: 0, 
                        maxDamage: 0, 
                        armor: 0,
                        critChance: 0,
                        agility: 0,
                        attacksPerTurn: 1
                     } as EnemyStats, 
                     description: template ? template.description : '',
                     rewards: template ? template.rewards : {} as any,
                     lootTable: template ? template.lootTable : []
                 } as Enemy;
             });
        }
        return [];
    }, [encounteredEnemies, finalState.enemiesHealth, enemies]);

    return (
        <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-40 p-4"
            style={backgroundStyle}
        >
             {/* Inspection Modals */}
            {hoveredCombatant && hoveredCombatant.rect && (
                 <div
                    className="fixed z-[100] pointer-events-none shadow-2xl"
                    style={{
                        top: Math.min(window.innerHeight - 300, Math.max(10, hoveredCombatant.rect.top)), 
                        left: hoveredCombatant.rect.right + 20 > window.innerWidth ? hoveredCombatant.rect.left - 270 : hoveredCombatant.rect.right + 20,
                        width: '250px'
                    }}
                >
                     <CombatantStatsPanel {...hoveredCombatant.data} />
                </div>
            )}

            <div 
                className="w-full max-w-7xl bg-slate-800/95 border border-slate-700 rounded-2xl shadow-2xl p-4 flex flex-col h-[90vh] overflow-hidden relative"
                style={{ "--window-bg": `url(${props.backgroundImage})` } as React.CSSProperties}
            >
                {/* Top Bar with Controls */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-indigo-400">{t(isPvp ? 'pvp.duelResult' : 'expedition.combatReport')}</h2>
                    <div className="flex gap-3">
                        {(messageId || raidId) && (
                            <button onClick={handleCopyLink} className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-sm transition-colors shadow-lg border border-sky-500">
                                Kopiuj Link
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded font-bold text-sm transition-colors shadow-lg border border-red-500">
                            Zamknij
                        </button>
                    </div>
                </div>
                
                {/* Main Content: Grid + Rewards Footer */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    
                    {/* Upper Section: Combat Details */}
                    <div className="flex-1 min-h-0 grid grid-cols-12 gap-6 overflow-hidden">
                        
                        {/* Left Column: Friendly Team / Player Stats */}
                        <div className="col-span-3 h-full overflow-y-auto flex flex-col gap-4 pr-2">
                             {(isHunting && huntingMembers) || (isPvp && pvpData) ? (
                                 <>
                                    {huntingMembers && (
                                        <PartyMemberList 
                                            members={huntingMembers} 
                                            finalPartyHealth={finalState.partyHealth}
                                            onMemberHover={onMemberHover}
                                            onMemberLeave={onMemberLeave}
                                        />
                                    )}
                                    {isPvp && <CombatantStatsPanel name={isDefenderView ? pvpData!.defender.name : pvpData!.attacker.name} stats={initialPlayerStats} currentHealth={finalState.playerHealth} />}
                                    {friendlyDamageData && friendlyDamageData.totalDamage > 0 && (
                                        <DamageMeter damageData={friendlyDamageData} title={t('expedition.damageMeter.title')} />
                                    )}
                                 </>
                             ) : (
                                <CombatantStatsPanel name={characterName} stats={initialPlayerStats} currentHealth={finalState.playerHealth} />
                             )}
                        </div>

                        {/* Middle Column: Combat Log */}
                        <div className="col-span-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col h-full overflow-hidden">
                            <div className="flex-grow overflow-y-auto pr-2 space-y-1.5">
                                {reward.combatLog.map((log, index) => {
                                    const currentTurn = log.turn;
                                    const prevTurn = index > 0 ? reward.combatLog[index - 1].turn : -1;
                                    const isNewTurn = currentTurn !== prevTurn;

                                    return (
                                        <React.Fragment key={index}>
                                            {isNewTurn && (
                                                <div className="flex items-center gap-4 my-4">
                                                    <div className="h-px bg-slate-700 flex-grow"></div>
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                        Runda {currentTurn}
                                                    </span>
                                                    <div className="h-px bg-slate-700 flex-grow"></div>
                                                </div>
                                            )}
                                            <CombatLogRow log={log} characterName={characterName} isHunting={isHunting || isRaid} huntingMembers={huntingMembers || (isRaid ? [...(huntingMembers || []), ...(opponents || [])] : [])} />
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Column: Enemies / Opponents */}
                        <div className="col-span-3 h-full overflow-y-auto flex flex-col gap-4 pl-2">
                            {opponents && opponents.length > 0 ? (
                                <>
                                    <PartyMemberList 
                                        members={opponents} 
                                        finalPartyHealth={finalState.partyHealth}
                                        onMemberHover={onMemberHover}
                                        onMemberLeave={onMemberLeave}
                                        isEnemyTeam={true}
                                    />
                                    {opponentDamageData && opponentDamageData.totalDamage > 0 && (
                                        <DamageMeter 
                                            damageData={opponentDamageData} 
                                            title="Tabela Obrażeń (Wrogowie)" 
                                            barColor="bg-red-600"
                                        />
                                    )}
                                </>
                            ) : isPvp ? (
                                 <CombatantStatsPanel name={isDefenderView ? pvpData!.attacker.name : pvpData!.defender.name} stats={isDefenderView ? pvpData!.attacker.stats : pvpData!.defender.stats} currentHealth={finalState.enemyHealth} />
                            ) : effectiveEnemies.length > 1 ? (
                                 <EnemyListPanel 
                                    enemies={effectiveEnemies} 
                                    finalEnemiesHealth={finalState.enemiesHealth}
                                    onEnemyHover={onEnemyHover}
                                    onEnemyLeave={onEnemyLeave}
                                />
                            ) : (
                                 <CombatantStatsPanel name={initialEnemyForDisplay?.name || ''} description={initialEnemyForDisplay?.description} stats={initialEnemyForDisplay?.stats || null} currentHealth={finalState.enemyHealth} />
                            )}
                        </div>
                    </div>

                    {/* Bottom Section: Rewards */}
                    <div className="mt-4 flex-shrink-0 max-h-[40%] overflow-y-auto">
                        {isRaid ? (
                             <RaidRewardsPanel totalGold={reward.totalGold} essencesFound={reward.essencesFound} />
                        ) : (
                             <StandardRewardsPanel reward={reward} itemTemplates={itemTemplates} affixes={affixes} />
                        )}
                    </div>
                </div>
                 {/* Footer Buttons */}
                 <div className="p-4 bg-slate-900/50 border-t border-slate-700/50 flex justify-end relative z-10">
                    <button onClick={onClose} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">
                        {t('expedition.returnToCamp')}
                    </button>
                </div>
            </div>
        </div>
    );
};
