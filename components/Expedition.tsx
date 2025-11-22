import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Expedition as ExpeditionType, Location, Enemy, ExpeditionRewardSummary, CombatLogEntry, CharacterStats, EnemyStats, ItemTemplate, PvpRewardSummary, Affix, ItemInstance, PartyMember } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { StarIcon } from './icons/StarIcon';
import { ClockIcon } from './icons/ClockIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles, getGrammaticallyCorrectFullName } from './shared/ItemSlot';

interface ExpeditionProps {
    character: PlayerCharacter;
    expeditions: ExpeditionType[];
    enemies: Enemy[];
    currentLocation: Location;
    onStartExpedition: (expeditionId: string) => void;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    onCompletion: () => Promise<void>; // Updated signature to allow async promise handling
}

const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds > 0 ? `${remainingSeconds}s` : ''}`.trim();
};

const formatTimeLeft = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const CombatLogRow: React.FC<{ log: CombatLogEntry; characterName: string; bossName?: string; isParty?: boolean }> = ({ log, characterName, bossName, isParty }) => {
    const { t } = useTranslation();

    const getCombatantColor = (name: string) => {
        if (bossName && name === bossName) return 'text-red-400';
        // Default to blue for all players/allies if not the boss
        return 'text-sky-400';
    };

    const getHpForEntity = (name: string) => {
        if (isParty) {
             if (bossName && name === bossName) return log.enemyHealth;
             return log.playerHealth;
        } else {
             if (name === characterName) return log.playerHealth;
             return log.enemyHealth;
        }
    };

    const renderName = (name: string) => {
        const color = getCombatantColor(name);
        if(name === 'Team') return <span className={`font-semibold ${color}`}>{name}</span>;
        
        const hp = Math.max(0, Math.ceil(getHpForEntity(name)));
        
        return (
            <>
                <span className={`font-semibold ${color}`}>{name}</span>
                <span className="text-xs text-gray-500 font-normal ml-1">({hp} HP)</span>
            </>
        );
    };

    if (log.action === 'starts a fight with') {
        return (
            <div className="text-center my-3 py-2 border-y border-slate-700/50">
                <p className="font-bold text-lg text-gray-300">
                    {renderName(log.attacker)}
                    <span className="text-gray-400 mx-2">{t('expedition.versus')}</span>
                    {renderName(log.defender)}
                </p>
            </div>
        )
    }
    
    if (log.action === 'death') {
        return (
             <div className="text-center my-2 py-1 bg-red-900/20 rounded border border-red-900/50">
                <p className="font-bold text-sm text-red-500">
                    Gracz {renderName(log.defender)} poległ od ciosu przeciwnika {renderName(log.attacker)}!
                </p>
            </div>
        );
    }

    if (log.action === 'shaman_power') {
        return (
            <p className="text-sm text-purple-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)}
                <span> {t('expedition.shamanPower')} </span>
                {renderName(log.defender)}
                <span> {t('expedition.dealing')} </span>
                <span className="font-bold text-white">{log.damage}</span>
                <span> {t('expedition.damage')}.</span>
            </p>
        );
    }

    if (log.action === 'manaRegen') {
        return (
             <p className="text-sm text-cyan-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)}
                <span> {t('expedition.manaGained')} </span>
                <span className="font-bold text-white">+{log.manaGained?.toFixed(0)}</span>
                <span> {t('expedition.manaPoints')}.</span>
            </p>
        );
    }
    
    if (log.action === 'notEnoughMana') {
         return (
             <p className="text-sm text-amber-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                <span>{t('expedition.notEnoughMana')}</span>
            </p>
         );
    }

    if (log.isDodge) {
        return (
            <p className="text-sm text-green-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.defender)}
                <span> {t('expedition.dodge')} </span>
                {renderName(log.attacker)}
                <span>!</span>
            </p>
        );
    }

    const critText = log.isCrit ? <span className="font-bold text-amber-400">{t('expedition.critical')}</span> : '';
    const damageReducedText = log.damageReduced ? <span className="text-xs text-green-500 ml-1">{t('expedition.damageReduced', { amount: log.damageReduced })}</span> : '';
    
    const attackVerb = log.magicAttackType 
        ? <>{t('expedition.casts')} <span className="font-bold text-purple-400">{t(`item.magic.${log.magicAttackType}`)}</span> {t('expedition.on')}</>
        : t('expedition.attacks');
        
    const stealText = [];
    if (log.action === 'attacks' && log.healthGained && log.healthGained > 0) {
        stealText.push(<span key="heal"> {t('expedition.healed')} <span className="font-bold text-green-400">{log.healthGained.toFixed(0)}</span> {t('expedition.healthPoints')}</span>);
    }
    if (log.action === 'attacks' && log.manaGained && log.manaGained > 0) {
        stealText.push(<span key="mana"> {t('expedition.manaStolen')} <span className="font-bold text-cyan-400">{log.manaGained.toFixed(0)}</span> {t('expedition.manaPoints')}</span>);
    }

    return (
        <p className={`text-sm text-gray-300`}>
            <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
            {renderName(log.attacker)}
            <span> {attackVerb} </span>
            {log.weaponName && <span className="text-gray-500 mx-1">({log.weaponName})</span>}
            {renderName(log.defender)}
            <span> {t('expedition.dealing')} </span>
            <span className="font-bold text-white">{log.damage}</span>
            <span> {t('expedition.damage')}. {critText} {damageReducedText}</span>
            {stealText}
        </p>
    );
};

const CombatantStatsPanel: React.FC<{
  name: string;
  description?: string;
  stats: CharacterStats | EnemyStats | null;
  currentHealth?: number;
  currentMana?: number;
}> = ({ name, description, stats, currentHealth, currentMana }) => {
  const { t } = useTranslation();
  if (!stats) {
    return <div className="w-full bg-slate-900/50 p-4 rounded-lg border border-transparent h-full"></div>;
  }

  const isPlayer = 'strength' in stats;
  const borderColor = isPlayer ? 'border-sky-500/50' : 'border-red-500/50';
  const textColor = isPlayer ? 'text-sky-400' : 'text-red-400';

  const hpDisplay = currentHealth !== undefined ? `${currentHealth.toFixed(0)} / ${stats.maxHealth}` : stats.maxHealth;
  const manaDisplay = stats.maxMana !== undefined && stats.maxMana > 0
    ? (currentMana !== undefined ? `${currentMana.toFixed(0)} / ${stats.maxMana}` : stats.maxMana)
    : null;

  const magicDamageDisplay = (stats.magicDamageMin !== undefined && stats.magicDamageMin > 0) || (stats.magicDamageMax !== undefined && stats.magicDamageMax > 0)
    ? `${stats.magicDamageMin || 0} - ${stats.magicDamageMax || 0}`
    : null;

  const manaRegenDisplay = stats.manaRegen !== undefined && stats.manaRegen > 0 ? stats.manaRegen : null;


  return (
    <div className={`bg-slate-900/50 p-4 rounded-lg border ${borderColor} h-full`}>
      <h4 className={`font-bold text-xl text-center border-b pb-2 mb-2 ${borderColor} ${textColor}`}>
        {name}
      </h4>
      {description && <p className="text-xs italic text-gray-400 mb-2 text-center">{description}</p>}
      <div className="text-left text-sm space-y-1 text-gray-300">
        <p className="flex justify-between"><strong>HP:</strong> <span>{hpDisplay}</span></p>
        {manaDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.mana')}:</strong> <span>{manaDisplay}</span></p>
        )}
        {manaRegenDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.manaRegen')}:</strong> <span>{manaRegenDisplay}</span></p>
        )}
        <div className="border-t border-slate-700/50 my-2"></div>
        
        {isPlayer && (
            <>
                <p className="flex justify-between"><strong>{t('statistics.strength')}:</strong> <span>{(stats as CharacterStats).strength}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.accuracy')}:</strong> <span>{(stats as CharacterStats).accuracy}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.stamina')}:</strong> <span>{(stats as CharacterStats).stamina}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.intelligence')}:</strong> <span>{(stats as CharacterStats).intelligence}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.energy')}:</strong> <span>{(stats as CharacterStats).energy}</span></p>
            </>
        )}
        
        <p className="flex justify-between"><strong>{t('statistics.agility')}:</strong> <span>{stats.agility}</span></p>
        
        <div className="border-t border-slate-700/50 my-2"></div>
        
        <p className="flex justify-between"><strong>{isPlayer ? t('statistics.physicalDamage') : t('statistics.damage')}:</strong> <span>{stats.minDamage} - {stats.maxDamage}</span></p>
        {magicDamageDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.magicDamage')}:</strong> <span>{magicDamageDisplay}</span></p>
        )}

        <p className="flex justify-between">
            <strong>{t('statistics.attacksPerTurn')}:</strong> 
            <span>
                {isPlayer 
                    ? (stats as CharacterStats).attacksPerRound 
                    : ((stats as EnemyStats).attacksPerTurn || 1)
                }
            </span>
        </p>

        <p className="flex justify-between"><strong>{t('statistics.armor')}:</strong> <span>{stats.armor}</span></p>
        <p className="flex justify-between"><strong>{t('statistics.critChance')}:</strong> <span>{stats.critChance.toFixed(1)}%</span></p>
        {isPlayer && 'critDamageModifier' in stats && (
             <p className="flex justify-between"><strong>{t('statistics.critDamageModifier')}:</strong> <span>{(stats as CharacterStats).critDamageModifier}%</span></p>
        )}
      </div>
    </div>
  );
};

const PartyMemberList: React.FC<{ 
    members: PartyMember[]; 
    currentTurnActor?: string;
    onMemberHover: (member: PartyMember, rect: DOMRect) => void;
    onMemberLeave: () => void;
}> = ({ members, currentTurnActor, onMemberHover, onMemberLeave }) => {
    const { t } = useTranslation();
    
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-sky-500/50 h-full overflow-y-auto overflow-visible">
             <h4 className="font-bold text-xl text-center border-b border-sky-500/50 pb-2 mb-2 text-sky-400">
                {t('hunting.members')}
            </h4>
            <div className="space-y-2">
                {members.map((member, idx) => {
                    const isActive = member.characterName === currentTurnActor;
                    const currentHP = member.stats?.currentHealth ?? 0;
                    const maxHP = member.stats?.maxHealth ?? 1;
                    const hpPercent = Math.min(100, Math.max(0, (currentHP / maxHP) * 100));

                    return (
                        <div 
                            key={idx} 
                            className={`p-2 rounded bg-slate-800 relative group ${isActive ? 'ring-2 ring-sky-500' : ''}`}
                            onMouseEnter={(e) => onMemberHover(member, e.currentTarget.getBoundingClientRect())}
                            onMouseLeave={onMemberLeave}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-sm">{member.characterName}</span>
                                <span className="text-xs text-gray-400">Lvl {member.level}</span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-1.5 transition-all" style={{width: `${hpPercent}%`}}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}

export interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    isPvp?: boolean;
    pvpData?: {
        attacker: PlayerCharacter;
        defender: PlayerCharacter;
    };
    isDefenderView?: boolean;
    // New Props for Hunting
    isHunting?: boolean;
    huntingMembers?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number }>;
    initialEnemy?: Enemy;
    bossName?: string;
    messageId?: number | null;
    // Fix: Add encounteredEnemies prop to match usage in App.tsx and PublicReportViewer.tsx
    encounteredEnemies?: Enemy[];
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({ 
    reward, 
    onClose, 
    characterName, 
    itemTemplates,
    affixes,
    isPvp = false,
    pvpData,
    isDefenderView = false,
    isHunting = false,
    huntingMembers = [],
    allRewards,
    initialEnemy,
    bossName,
    messageId
}) => {
    const { t } = useTranslation();
    const [displayedLogs, setDisplayedLogs] = useState<CombatLogEntry[]>([]);
    const [isAnimationComplete, setIsAnimationComplete] = useState(false);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [copyStatus, setCopyStatus] = useState('');
    
    const [currentPlayerStats, setCurrentPlayerStats] = useState<CharacterStats | null>(null);
    const [partyMembersState, setPartyMembersState] = useState<PartyMember[]>([]);

    const [currentEnemy, setCurrentEnemy] = useState<{name: string, description?: string, stats: EnemyStats | CharacterStats, currentHealth: number, currentMana: number} | null>(() => {
        // Prioritize log data for stats initialization (scaled values)
        const startLog = reward.combatLog && reward.combatLog.length > 0 ? reward.combatLog[0] : null;

        if (initialEnemy) {
             // If we have a start log with enemy stats, use those (they are the scaled ones from the server)
             // Otherwise fall back to the template stats
             const effectiveStats = (startLog && startLog.enemyStats) ? startLog.enemyStats : initialEnemy.stats;

             return {
                 name: initialEnemy.name,
                 description: initialEnemy.description,
                 stats: effectiveStats,
                 currentHealth: startLog ? startLog.enemyHealth : initialEnemy.stats.maxHealth,
                 currentMana: startLog ? startLog.enemyMana : (initialEnemy.stats.maxMana || 0)
             };
        }
        return null;
    });

    useEffect(() => {
        // If this is a hunt report and the members from props don't have stats,
        // it means we are viewing a saved report (from Messages). We need to reconstruct the stats
        // from the combat log to ensure tooltips work correctly.
        if (isHunting && huntingMembers.length > 0 && !huntingMembers[0].stats) {
            const statsMap = new Map<string, CharacterStats>();
            // Find the first instance of each player's stats in the log
            for (const log of reward.combatLog) {
                if (log.playerStats && log.attacker && !statsMap.has(log.attacker)) {
                    statsMap.set(log.attacker, log.playerStats);
                }
            }
            // Rebuild the members array with their reconstructed stats
            setPartyMembersState(huntingMembers.map(member => ({
                ...member,
                stats: statsMap.get(member.characterName)
            })));
        } else {
            // Otherwise (live view from Hunting tab), the stats are already present.
            setPartyMembersState(huntingMembers);
        }
    }, [isHunting, huntingMembers, reward.combatLog]);

    const animationTimerRef = useRef<number | null>(null);
    const [tooltipData, setTooltipData] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);
    const tooltipTimeoutRef = useRef<number | null>(null);
    
    // Member tooltip state
    const [hoveredMember, setHoveredMember] = useState<{ data: PartyMember, rect: DOMRect } | null>(null);

    const handleCopyLink = () => {
        if (!messageId) return;
        const url = `${window.location.origin}/report/${messageId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopyStatus('Skopiowano link!');
            setTimeout(() => setCopyStatus(''), 2000);
        }, (err) => {
            setCopyStatus('Błąd kopiowania');
            console.error('Could not copy text: ', err);
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };

    const handleItemMouseEnter = (itemInstance: ItemInstance) => {
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        const template = itemTemplates.find(t => t.id === itemInstance.templateId);
        if (template) {
            setTooltipData({ item: itemInstance, template });
        }
    };

    const handleItemMouseLeave = () => {
        tooltipTimeoutRef.current = window.setTimeout(() => {
            setTooltipData(null);
        }, 200);
    };
    
    const finalVictoryStatus = isDefenderView ? !reward.isVictory : reward.isVictory;

    const updateCombatantState = (log: CombatLogEntry) => {
         if (isHunting) {
             setPartyMembersState(prev => prev.map(m => {
                 // Only update if stats object exists to avoid errors.
                 if (!m.stats) return m; 
                 
                 if (m.characterName === log.attacker || m.characterName === log.defender) {
                      return { ...m, stats: { ...m.stats, currentHealth: log.playerHealth, currentMana: log.playerMana } };
                 }
                 return m;
             }));
         } else {
             // Standard PvE / PvP logic
             if (isPvp && pvpData) {
                 setCurrentPlayerStats({ ...pvpData.attacker.stats, currentHealth: log.playerHealth, currentMana: log.playerMana });
                 setCurrentEnemy({ name: pvpData.defender.name, stats: pvpData.defender.stats, currentHealth: log.enemyHealth, currentMana: log.enemyMana });
             } else {
                 if (log.playerStats) setCurrentPlayerStats({ ...log.playerStats, currentHealth: log.playerHealth, currentMana: log.playerMana });
                 // Logic to init enemy if missing
                 if (!currentEnemy && log.enemyStats) {
                      setCurrentEnemy({
                        name: log.defender,
                        description: log.enemyDescription,
                        stats: log.enemyStats,
                        currentHealth: log.enemyHealth,
                        currentMana: log.enemyMana,
                    });
                 } else if (currentEnemy) {
                     setCurrentEnemy(prev => prev ? { ...prev, currentHealth: log.enemyHealth, currentMana: log.enemyMana } : null);
                 }
             }
         }
    };

    const handleSkipAnimation = () => {
        if (animationTimerRef.current) {
            clearTimeout(animationTimerRef.current);
        }
        setDisplayedLogs(reward.combatLog);
        // Set final state based on last log
        const lastLog = reward.combatLog[reward.combatLog.length - 1];
        if (lastLog) updateCombatantState(lastLog);
        setIsAnimationComplete(true);
    };

    useEffect(() => {
        if (!reward.combatLog || reward.combatLog.length === 0) {
            setIsAnimationComplete(true);
            return;
        }

        // Start animation loop
        const playAnimation = () => {
             if (displayedLogs.length < reward.combatLog.length) {
                const nextLog = reward.combatLog[displayedLogs.length];
                updateCombatantState(nextLog);
                setDisplayedLogs(prev => [...prev, nextLog]);
                
                animationTimerRef.current = window.setTimeout(playAnimation, isHunting ? 500 : 800);
            } else {
                setIsAnimationComplete(true);
            }
        };

        // Only start the timeout if not already completed and if not currently scheduled
        if (!isAnimationComplete && !animationTimerRef.current) {
             playAnimation();
        }

        return () => {
            if(animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
                animationTimerRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayedLogs.length, reward.combatLog.length, isAnimationComplete]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [displayedLogs]);

    const combatant1Name = isPvp && pvpData ? pvpData.attacker.name : characterName;
    const combatant2Name = isPvp && pvpData ? pvpData.defender.name : (currentEnemy?.name || (isHunting ? 'Boss' : ''));

    // Current actor for highlighting
    const currentActor = displayedLogs.length > 0 ? displayedLogs[displayedLogs.length - 1].attacker : '';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-7xl w-full flex flex-col" style={{maxHeight: '90vh'}}>
                <div className="relative mb-6 flex-shrink-0">
                    <h2 className="text-3xl font-bold text-indigo-400 text-center">
                        {isPvp ? t('pvp.duelResult') : t('expedition.combatReport')}
                    </h2>
                    {!isAnimationComplete && (
                        <button
                            onClick={handleSkipAnimation}
                            className="absolute top-1/2 -translate-y-1/2 right-0 px-4 py-2 text-sm rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors"
                        >
                            {t('expedition.skipAnimation')}
                        </button>
                    )}
                </div>
                
                <div className="flex-grow overflow-y-auto min-h-0">
                    {reward.combatLog && reward.combatLog.length > 0 ? (
                        <div className="flex gap-4 mb-6 min-h-[300px]">
                            <div className="w-1/4 flex-shrink-0">
                                {isHunting ? (
                                    <PartyMemberList 
                                        members={partyMembersState} 
                                        currentTurnActor={currentActor} 
                                        onMemberHover={(data, rect) => setHoveredMember({ data, rect })}
                                        onMemberLeave={() => setHoveredMember(null)}
                                    />
                                ) : (
                                    <CombatantStatsPanel 
                                        name={combatant1Name} 
                                        stats={currentPlayerStats} 
                                        currentHealth={currentPlayerStats?.currentHealth}
                                        currentMana={currentPlayerStats?.currentMana}
                                    />
                                )}
                            </div>
                            
                            <div ref={logContainerRef} className="bg-slate-900/50 p-4 rounded-lg flex-grow overflow-y-auto font-mono">
                                <div className="space-y-1 text-left">
                                    {displayedLogs.map((log, index) => {
                                        const prevLog = index > 0 ? displayedLogs[index - 1] : null;
                                        const isNewTurn = prevLog && log.turn !== prevLog.turn;
                                        return (
                                            <React.Fragment key={index}>
                                                {isNewTurn && <div className="my-2 border-t border-slate-700/50"></div>}
                                                <CombatLogRow 
                                                    log={log} 
                                                    characterName={characterName} 
                                                    bossName={bossName || currentEnemy?.name}
                                                    isParty={isHunting} 
                                                />
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="w-1/4 flex-shrink-0">
                                <CombatantStatsPanel 
                                    name={combatant2Name}
                                    description={isPvp ? undefined : currentEnemy?.description}
                                    stats={currentEnemy?.stats || null}
                                    currentHealth={currentEnemy?.currentHealth}
                                    currentMana={currentEnemy?.currentMana}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center min-h-[300px] bg-slate-900/50 p-4 rounded-lg mb-6">
                            <p className="text-gray-400 italic">{t('expedition.noEnemiesEncountered')}</p>
                        </div>
                    )}


                    {isAnimationComplete && (
                        <div className="animate-fade-in text-center">
                            <h3 className={`text-2xl font-bold mb-4 ${finalVictoryStatus ? 'text-green-400' : 'text-red-500'}`}>
                                {finalVictoryStatus ? t('expedition.victory') : t('expedition.defeat')}
                            </h3>
                            
                            {isPvp && (
                                <div className="bg-slate-900/50 p-4 rounded-lg mb-6">
                                    <div className="flex justify-center items-center space-x-8 font-bold text-md px-2">
                                        <span className={finalVictoryStatus ? 'text-amber-300' : 'text-red-400'}>
                                            {finalVictoryStatus ? t('pvp.goldStolen', { amount: reward.totalGold }) : t('pvp.goldLost', { amount: reward.totalGold })}
                                        </span>
                                        <span className="text-sky-300">
                                            {finalVictoryStatus ? t('pvp.xpGained', { amount: reward.totalExperience }) : t('pvp.xpLost', { amount: reward.totalExperience })}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!isPvp && reward.isVictory && (
                                <div className="bg-slate-900/50 p-4 rounded-lg mb-6">
                                    {/* Hunting Rewards Table */}
                                    {isHunting && allRewards && (
                                        <div className="mb-4">
                                            <h4 className="font-bold text-white mb-2">Nagrody Drużynowe</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-gray-400 bg-slate-800">
                                                        <tr>
                                                            <th className="px-3 py-2">Gracz</th>
                                                            <th className="px-3 py-2 text-right">Złoto</th>
                                                            <th className="px-3 py-2 text-right">Doświadczenie</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(allRewards).map(([name, rew], idx) => (
                                                            <tr key={idx} className="border-b border-slate-700/50">
                                                                <td className="px-3 py-2 font-medium text-white">{name}</td>
                                                                <td className="px-3 py-2 text-right text-amber-400">{rew.gold}</td>
                                                                <td className="px-3 py-2 text-right text-sky-400">{rew.experience}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="border-t border-slate-700 my-3"></div>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-center font-bold text-md px-2">
                                        <span className="text-white">{t('expedition.totalRewards')} (Ty)</span>
                                        <div className="flex items-center space-x-4 font-mono">
                                            <span className="text-amber-300 flex items-center gap-1">
                                                <CoinsIcon className="h-5 w-5" /> +{reward.totalGold}
                                            </span>
                                            <span className="text-sky-300 flex items-center gap-1">
                                                <StarIcon className="h-5 w-5" /> +{reward.totalExperience}
                                            </span>
                                        </div>
                                    </div>
                                    {reward.itemsFound.length > 0 && (
                                        <div className="border-t border-slate-700 my-3 pt-3">
                                            <h4 className="font-bold text-md text-white mb-2">{t('expedition.itemsFound')}:</h4>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {reward.itemsFound.map(itemInstance => {
                                                    const template = itemTemplates.find(t => t.id === itemInstance.templateId);
                                                    if (!template) return null;
                                                    const colorClass = rarityStyles[template.rarity]?.text || 'text-gray-300';
                                                    const fullName = getGrammaticallyCorrectFullName(itemInstance, template, affixes);
                                                    return (
                                                        <div 
                                                            key={itemInstance.uniqueId}
                                                            onMouseEnter={() => handleItemMouseEnter(itemInstance)}
                                                            onMouseLeave={handleItemMouseLeave}
                                                        >
                                                            <span className={`bg-slate-800/60 px-2 py-1 rounded text-sm font-semibold cursor-help ${colorClass}`}>
                                                                {fullName}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {reward.itemsLostCount && reward.itemsLostCount > 0 && (
                                        <p className="text-sm italic text-red-400 mt-2">
                                            {t('expedition.itemsLost', { count: reward.itemsLostCount })}
                                        </p>
                                    )}
                                    {Object.keys(reward.essencesFound).length > 0 && (
                                        <div className="border-t border-slate-700 my-3 pt-3">
                                            <h4 className="font-bold text-md text-white mb-2">{t('expedition.essencesFound')}:</h4>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {Object.entries(reward.essencesFound).map(([essenceType, amount]) => (
                                                    <span key={essenceType} className="bg-slate-800/60 px-2 py-1 rounded text-sm font-semibold">
                                                    {amount}x {t(`resources.${essenceType}`)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 mt-4 flex-shrink-0">
                    <button
                        onClick={async () => {
                            // Simple click handler to close normally
                            onClose();
                        }}
                        disabled={!isAnimationComplete}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-indigo-700 transition-colors duration-200 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        {isAnimationComplete ? (finalVictoryStatus ? t('expedition.excellent') : t('expedition.returnToCamp')) : t('expedition.combatInProgress')}
                    </button>
                     {isAnimationComplete && messageId && (
                        // Fix: The function handleCopyLink does not take any arguments.
                        <button onClick={() => handleCopyLink()} className="flex-shrink-0 px-4 py-3 rounded-lg bg-slate-600 hover:bg-slate-500 font-semibold text-sm">
                            {copyStatus || 'Kopiuj Link'}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Hovered Member Tooltip - Rendered outside of the overflow container using fixed positioning */}
            {hoveredMember && hoveredMember.data && (
                <div 
                    className="fixed z-[70] p-3 bg-slate-900 border border-slate-700 rounded shadow-xl pointer-events-none animate-fade-in w-64"
                    style={{
                        top: Math.max(10, hoveredMember.rect.top),
                        left: hoveredMember.rect.right + 10
                    }}
                >
                     <p className="font-bold border-b border-slate-700 pb-1 mb-2 text-white text-center">{hoveredMember.data.characterName}</p>
                     <div className="space-y-1 text-xs text-gray-300">
                         {/* Add safe navigation checks (?.) and defaults (|| 0) for all stats */}
                        <p className="flex justify-between"><span>HP:</span> <span className="font-mono text-white">{hoveredMember.data.stats?.currentHealth?.toFixed(0) || 0} / {hoveredMember.data.stats?.maxHealth || 1}</span></p>
                        <p className="flex justify-between"><span>Mana:</span> <span className="font-mono text-white">{hoveredMember.data.stats?.currentMana?.toFixed(0) || 0} / {hoveredMember.data.stats?.maxMana || 0}</span></p>
                        <div className="border-t border-slate-700/50 my-1"></div>
                        <p className="flex justify-between"><span>{t('statistics.strength')}:</span> <span>{hoveredMember.data.stats?.strength || 0}</span></p>
                        <p className="flex justify-between"><span>{t('statistics.agility')}:</span> <span>{hoveredMember.data.stats?.agility || 0}</span></p>
                        <p className="flex justify-between"><span>{t('statistics.accuracy')}:</span> <span>{hoveredMember.data.stats?.accuracy || 0}</span></p>
                         <p className="flex justify-between"><span>{t('statistics.stamina')}:</span> <span>{hoveredMember.data.stats?.stamina || 0}</span></p>
                        <p className="flex justify-between"><span>{t('statistics.intelligence')}:</span> <span>{hoveredMember.data.stats?.intelligence || 0}</span></p>
                        <div className="border-t border-slate-700/50 my-1"></div>
                        <p className="flex justify-between"><span>Fiz. DMG:</span> <span className="font-mono">{hoveredMember.data.stats?.minDamage || 0}-{hoveredMember.data.stats?.maxDamage || 0}</span></p>
                        {((hoveredMember.data.stats?.magicDamageMin || 0) > 0 || (hoveredMember.data.stats?.magicDamageMax || 0) > 0) && (
                             <p className="flex justify-between text-purple-300"><span>Mag. DMG:</span> <span className="font-mono">{hoveredMember.data.stats?.magicDamageMin || 0}-{hoveredMember.data.stats?.magicDamageMax || 0}</span></p>
                        )}
                        <p className="flex justify-between"><span>Pancerz:</span> <span>{hoveredMember.data.stats?.armor || 0}</span></p>
                        <p className="flex justify-between"><span>Kryt:</span> <span>{(hoveredMember.data.stats?.critChance || 0).toFixed(1)}% (x{hoveredMember.data.stats?.critDamageModifier || 200}%)</span></p>
                         <p className="flex justify-between"><span>Unik:</span> <span>{(hoveredMember.data.stats?.dodgeChance || 0).toFixed(1)}%</span></p>
                        <p className="flex justify-between"><span>Ataki/tura:</span> <span>{hoveredMember.data.stats?.attacksPerRound || 1}</span></p>
                        {(hoveredMember.data.stats?.lifeStealPercent || 0) > 0 && <p className="flex justify-between text-green-400"><span>Kradzież Życia:</span> <span>{hoveredMember.data.stats?.lifeStealPercent}%</span></p>}
                        {(hoveredMember.data.stats?.manaStealPercent || 0) > 0 && <p className="flex justify-between text-cyan-400"><span>Kradzież Many:</span> <span>{hoveredMember.data.stats?.manaStealPercent}%</span></p>}
                    </div>
                </div>
            )}

            {tooltipData && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
                    onMouseEnter={() => { if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); }}
                    onMouseLeave={handleItemMouseLeave}
                >
                    <div className="w-72 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl p-3 animate-fade-in pointer-events-auto">
                        <ItemDetailsPanel 
                            item={tooltipData.item} 
                            template={tooltipData.template} 
                            affixes={affixes} 
                            size="small" 
                        />
                    </div>
                </div>
            )}
        </div>
    )
};


const ActiveExpeditionPanel: React.FC<{
    character: PlayerCharacter;
    expeditions: ExpeditionType[];
    onCompletion: () => Promise<void>;
}> = ({ character, expeditions, onCompletion }) => {
    const { t } = useTranslation();
    const activeExpeditionDetails = expeditions.find(e => e.id === character.activeExpedition?.expeditionId);
    const [timeLeft, setTimeLeft] = useState(0);
    const completionCalledRef = useRef(false);
    const [isForceClaiming, setIsForceClaiming] = useState(false);

    useEffect(() => {
        if (character.activeExpedition) {
            completionCalledRef.current = false; // Reset on new expedition
            const updateTimer = () => {
                const remaining = Math.max(0, Math.floor((character.activeExpedition!.finishTime - Date.now()) / 1000));
                setTimeLeft(remaining);

                if (remaining <= 0 && !completionCalledRef.current) {
                    completionCalledRef.current = true;
                    onCompletion();
                }
            };

            updateTimer();
            const intervalId = setInterval(updateTimer, 1000);
            return () => clearInterval(intervalId);
        }
    }, [character.activeExpedition, onCompletion]);

    if (!activeExpeditionDetails) return null;

    const isFinished = timeLeft <= 0;

    const handleForceClaim = async () => {
        if (isForceClaiming) return;
        setIsForceClaiming(true);
        try {
            await onCompletion();
        } finally {
            setIsForceClaiming(false);
        }
    }

    return (
        <div className="bg-slate-900/40 p-8 rounded-xl text-center">
            <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('expedition.onExpedition')}</h3>
            <p className="text-4xl font-extrabold text-white mb-4">{activeExpeditionDetails.name}</p>
            <p className="text-lg text-gray-400 mb-6">{isFinished ? t('expedition.finalizing') : t('expedition.endsIn')}</p>
            <div className="text-6xl font-mono font-bold text-amber-400 mb-8">{formatTimeLeft(timeLeft)}</div>
            
            {/* Fallback button for when automation fails */}
            {isFinished && (
                 <div className="mt-8 flex flex-col items-center justify-center gap-4">
                    <p className="text-lg text-gray-300 animate-pulse">{t('expedition.generatingReport')}</p>
                    <button 
                        onClick={handleForceClaim}
                        disabled={isForceClaiming}
                        className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg transition-colors ${isForceClaiming ? 'bg-slate-600 cursor-not-allowed' : 'bg-green-700 hover:bg-green-600'}`}
                    >
                        {isForceClaiming ? "Przetwarzanie..." : "Odbierz Raport (Wymuś)"}
                    </button>
                    <p className="text-xs text-gray-500">Kliknij, jeśli raport nie pojawi się automatycznie.</p>
                </div>
            )}
            
            {!isFinished && <div className="mt-8 h-14"></div>}
        </div>
    );
};

export const Expedition: React.FC<ExpeditionProps> = ({ character, expeditions, enemies, currentLocation, onStartExpedition, itemTemplates, onCompletion, affixes }) => {
  const { t } = useTranslation();
  const availableExpeditions = expeditions.filter(exp => exp.locationIds.includes(currentLocation.id));

  const content = character.activeExpedition ? (
      <ContentPanel title={t('expedition.inProgressTitle')}>
          <ActiveExpeditionPanel 
            character={character}
            expeditions={expeditions}
            onCompletion={onCompletion}
          />
      </ContentPanel>
  ) : (
    <ContentPanel title={t('expedition.availableTitle')}>
        <div className="flex justify-end items-center mb-4 -mt-4">
            <div className="flex items-center space-x-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700/50">
                <BoltIcon className="h-5 w-5 text-sky-400" />
                <span className="font-semibold text-gray-300">{t('statistics.energyLabel')}:</span>
                <span className="font-mono text-lg font-bold text-white">{character.stats.currentEnergy} / {character.stats.maxEnergy}</span>
            </div>
        </div>
      {availableExpeditions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {availableExpeditions.map(exp => {
              // fix: Use Number() to ensure values are treated as numbers
              const canAfford = (Number(character.resources.gold) || 0) >= exp.goldCost && (Number(character.stats.currentEnergy) || 0) >= exp.energyCost;
              const potentialEnemies = exp.enemies
                .map(expEnemy => enemies.find(e => e.id === expEnemy.enemyId))
                .filter((e): e is Enemy => e !== undefined);
                
              const minExp = exp.minBaseExperienceReward ?? (exp as any).baseExperienceReward ?? 0;
              const maxExp = exp.maxBaseExperienceReward ?? minExp;
              const expDisplay = minExp === maxExp ? minExp : `${minExp} - ${maxExp}`;

              const minGold = exp.minBaseGoldReward ?? (exp as any).baseGoldReward ?? 0;
              const maxGold = exp.maxBaseGoldReward ?? minGold;
              const goldDisplay = minGold === maxGold ? minGold : `${minGold} - ${maxGold}`;

              return (
                <div key={exp.id} className="bg-slate-900/40 p-6 rounded-xl flex flex-col justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-indigo-400 mb-2">{exp.name}</h3>
                        {exp.image && <img src={exp.image} alt={exp.name} className="w-full h-32 object-cover rounded-lg mb-4 mt-2" />}
                        <p className="text-gray-400 mb-4 text-sm italic">{exp.description}</p>
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm border-t border-b border-slate-700/50 py-4">
                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2 flex items-center"><SwordsIcon className="h-4 w-4 mr-2"/>{t('expedition.potentialEnemies')}</h4>
                                {potentialEnemies.length > 0 ? (
                                    <ul className="text-gray-400 list-disc list-inside">
                                        {potentialEnemies.map(e => <li key={e.id}>{e.name}</li>)}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500">{t('expedition.noEnemies')}</p>
                                )}
                                {exp.maxEnemies && exp.maxEnemies > 0 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        {t('expedition.maxEnemiesNote', { count: exp.maxEnemies })}
                                    </p>
                                )}
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2">{t('expedition.reqsAndRewards')}</h4>
                                <div className="flex items-center text-gray-400 space-x-2">
                                    <CoinsIcon className="h-4 w-4" /> <span>{t('expedition.cost')}: {exp.goldCost}</span>
                                </div>
                                <div className="flex items-center text-gray-400 space-x-2 mt-1">
                                    <BoltIcon className="h-4 w-4" /> <span>{t('expedition.cost')}: {exp.energyCost}</span>
                                </div>
                                <div className="flex items-center text-gray-400 space-x-2 mt-1">
                                    <ClockIcon className="h-4 w-4" /> <span>{t('expedition.duration')}: {formatDuration(exp.duration)}</span>
                                </div>
                                <div className="border-t border-slate-800 my-2"></div>
                                <div className="flex items-center text-amber-400 space-x-2">
                                    <CoinsIcon className="h-4 w-4" /> <span>{t('expedition.reward')}: {goldDisplay}</span>
                                </div>
                                <div className="flex items-center text-sky-400 space-x-2 mt-1">
                                    <StarIcon className="h-4 w-4" /> <span>{t('expedition.reward')}: {expDisplay} XP</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => onStartExpedition(exp.id)}
                        disabled={!canAfford || character.isResting || !!character.activeTravel}
                        className="w-full mt-2 bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                        {t('expedition.embark')}
                    </button>
                </div>
            )})}
        </div>
      ) : (
        <p className="text-gray-400">{t('expedition.noExpeditions')}</p>
      )}
    </ContentPanel>
  );

  return (
    <>
        {/* ExpeditionSummaryModal is now handled globally in App.tsx */}
        {content}
    </>
  );
};