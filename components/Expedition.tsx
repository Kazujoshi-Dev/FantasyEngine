import React, { useState, useEffect, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Expedition as ExpeditionType, Location, Enemy, ExpeditionRewardSummary, CombatLogEntry, CharacterStats, EnemyStats, ItemTemplate, PvpRewardSummary, Affix } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { StarIcon } from './icons/StarIcon';
import { ClockIcon } from './icons/ClockIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemTooltip, rarityStyles, getGrammaticallyCorrectFullName } from './shared/ItemSlot';

interface ExpeditionProps {
    character: PlayerCharacter;
    expeditions: ExpeditionType[];
    enemies: Enemy[];
    currentLocation: Location;
    onStartExpedition: (expeditionId: string) => void;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    onCompletion: () => void;
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

const CombatLogRow: React.FC<{ log: CombatLogEntry; characterName: string; }> = ({ log, characterName }) => {
    const { t } = useTranslation();

    if (log.action === 'starts a fight with') {
        return (
            <div className="text-center my-3 py-2 border-y border-slate-700/50">
                <p className="font-bold text-lg text-gray-300">
                    <span className="text-sky-400">{log.attacker}</span>
                    <span className="text-gray-400 mx-2">{t('expedition.versus')}</span>
                    <span className="text-red-400">{log.defender}</span>
                </p>
            </div>
        )
    }

    if (log.action === 'manaRegen') {
        return (
             <p className="text-sm text-cyan-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                <span className="font-semibold">{log.attacker}</span>
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
                <span className="font-semibold">{log.defender}</span>
                <span> {t('expedition.dodge')}</span>
            </p>
        );
    }


    const isPlayerAttacker = log.attacker === characterName;
    const textColor = isPlayerAttacker ? 'text-sky-400' : 'text-red-400';
    const critText = log.isCrit ? <span className="font-bold text-amber-400">{t('expedition.critical')}</span> : '';
    const damageReducedText = log.damageReduced ? <span className="text-xs text-green-500 ml-1">{t('expedition.damageReduced', { amount: log.damageReduced })}</span> : '';
    const enemyName = isPlayerAttacker ? log.defender : log.attacker;
    
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
        <p className={`text-sm ${isPlayerAttacker ? 'text-gray-300' : 'text-gray-400'}`}>
            <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
            <span className={`${textColor} font-semibold`}>{log.attacker}</span>
            <span> {attackVerb} </span>
            <span className={`${isPlayerAttacker ? 'text-red-400' : 'text-sky-400'} font-semibold`}>{log.defender}</span>
            {log.weaponName && <span className="text-gray-500 ml-1">({log.weaponName})</span>}
            <span> {t('expedition.dealing')} </span>
            <span className="font-bold text-white">{log.damage}</span>
            <span> {t('expedition.damage')}. {critText} {damageReducedText}</span>
            {stealText}
            <span className="text-xs text-gray-500 ml-2">
                ({characterName}: {log.playerHealth.toFixed(0)} HP, {log.playerMana.toFixed(0)} Mana, {enemyName}: {log.enemyHealth.toFixed(0)} HP, {log.enemyMana.toFixed(0)} Mana)
            </span>
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
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({ 
    reward, 
    onClose, 
    characterName, 
    itemTemplates,
    affixes,
    isPvp = false,
    pvpData,
    isDefenderView = false
}) => {
    const { t } = useTranslation();
    const [displayedLogs, setDisplayedLogs] = useState<CombatLogEntry[]>([]);
    const [isAnimationComplete, setIsAnimationComplete] = useState(false);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [currentPlayerStats, setCurrentPlayerStats] = useState<CharacterStats | null>(null);
    const [currentEnemy, setCurrentEnemy] = useState<{name: string, description?: string, stats: EnemyStats | CharacterStats, currentHealth: number, currentMana: number} | null>(null);
    // FIX: Changed type of animationTimerRef to `any` to avoid Node/browser type conflicts with `setTimeout`.
    const animationTimerRef = useRef<number | null>(null);
    
    // In PvP, isVictory from backend is always from attacker's perspective.
    // For defender view (from messages), we need to flip it.
    const finalVictoryStatus = isDefenderView ? !reward.isVictory : reward.isVictory;

    const handleSkipAnimation = () => {
        if (animationTimerRef.current) {
            clearTimeout(animationTimerRef.current);
        }
        
        setDisplayedLogs(reward.combatLog);
    
        const firstLog = reward.combatLog.length > 0 ? reward.combatLog[0] : null;
        const lastLog = reward.combatLog.length > 0 ? reward.combatLog[reward.combatLog.length - 1] : null;
    
        if (firstLog && lastLog) {
            if (isPvp && pvpData) {
                setCurrentPlayerStats({ ...pvpData.attacker.stats, currentHealth: lastLog.playerHealth, currentMana: lastLog.playerMana });
                setCurrentEnemy({ name: pvpData.defender.name, stats: pvpData.defender.stats, currentHealth: lastLog.enemyHealth, currentMana: lastLog.enemyMana });
            } else { // Standard PvE
                if (firstLog.playerStats) {
                    setCurrentPlayerStats({ ...firstLog.playerStats, currentHealth: lastLog.playerHealth, currentMana: lastLog.playerMana });
                }
                if (firstLog.enemyStats) {
                    setCurrentEnemy({ name: firstLog.defender, description: firstLog.enemyDescription, stats: firstLog.enemyStats, currentHealth: lastLog.enemyHealth, currentMana: lastLog.enemyMana });
                }
            }
        }
        
        setIsAnimationComplete(true);
    };

    useEffect(() => {
        animationTimerRef.current = window.setTimeout(() => {
            if (displayedLogs.length < reward.combatLog.length) {
                const nextLog = reward.combatLog[displayedLogs.length];

                // On the first log entry, initialize combatant states
                if (displayedLogs.length === 0) {
                    if (isPvp && pvpData) {
                        setCurrentPlayerStats({ ...pvpData.attacker.stats, currentHealth: nextLog.playerHealth, currentMana: nextLog.playerMana });
                        setCurrentEnemy({
                            name: pvpData.defender.name,
                            stats: pvpData.defender.stats,
                            currentHealth: nextLog.enemyHealth,
                            currentMana: nextLog.enemyMana,
                        });
                    } else { // Standard PvE
                        if (nextLog.playerStats) {
                            setCurrentPlayerStats({ ...nextLog.playerStats, currentHealth: nextLog.playerHealth, currentMana: nextLog.playerMana });
                        }
                        if (nextLog.enemyStats) {
                            setCurrentEnemy({
                                name: nextLog.defender,
                                description: nextLog.enemyDescription,
                                stats: nextLog.enemyStats,
                                currentHealth: nextLog.enemyHealth,
                                currentMana: nextLog.enemyMana,
                            });
                        }
                    }
                } else {
                    // On subsequent logs, just update health/mana
                     setCurrentPlayerStats(prev => prev ? { ...prev, currentHealth: nextLog.playerHealth, currentMana: nextLog.playerMana } : null);
                     setCurrentEnemy(prev => prev ? { ...prev, currentHealth: nextLog.enemyHealth, currentMana: nextLog.enemyMana } : null);
                }
                
                setDisplayedLogs(prev => [...prev, nextLog]);
            } else {
                setIsAnimationComplete(true);
            }
        }, 1000);
        return () => {
            if(animationTimerRef.current) clearTimeout(animationTimerRef.current);
        };
    }, [displayedLogs, reward.combatLog, isPvp, pvpData]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [displayedLogs]);

    const combatant1Name = isPvp && pvpData ? pvpData.attacker.name : characterName;
    const combatant2Name = isPvp && pvpData ? pvpData.defender.name : (currentEnemy?.name || '');


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
                    <div className="flex gap-4 mb-6 min-h-[300px]">
                        <div className="w-1/4 flex-shrink-0">
                            <CombatantStatsPanel 
                                name={combatant1Name} 
                                stats={currentPlayerStats} 
                                currentHealth={currentPlayerStats?.currentHealth}
                                currentMana={currentPlayerStats?.currentMana}
                            />
                        </div>
                        
                        <div ref={logContainerRef} className="bg-slate-900/50 p-4 rounded-lg flex-grow overflow-y-auto">
                            <div className="space-y-2 text-left">
                                {displayedLogs.map((log, index) => {
                                    const prevLog = index > 0 ? displayedLogs[index - 1] : null;
                                    const isNewTurn = prevLog && log.turn !== prevLog.turn;
                                    return (
                                        <React.Fragment key={index}>
                                            {isNewTurn && <div className="my-2 border-t border-slate-700/50"></div>}
                                            <CombatLogRow log={log} characterName={characterName} />
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
                                    <div className="space-y-2">
                                        {reward.rewardBreakdown.map((item, index) => (
                                            <div key={index} className="flex justify-between items-center text-sm py-1 px-2 rounded hover:bg-slate-800/50">
                                                <span className="text-gray-300">{item.source}</span>
                                                <div className="flex items-center space-x-4 font-mono">
                                                    <span className="text-amber-400 flex items-center gap-1">
                                                        <CoinsIcon className="h-4 w-4" /> +{item.gold}
                                                    </span>
                                                    <span className="text-sky-400 flex items-center gap-1">
                                                        <StarIcon className="h-4 w-4" /> +{item.experience}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-slate-700 my-3"></div>
                                    <div className="flex justify-between items-center font-bold text-md px-2">
                                        <span className="text-white">{t('expedition.totalRewards')}</span>
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
                                                        <div key={itemInstance.uniqueId} className="relative group">
                                                            <span className={`bg-slate-800/60 px-2 py-1 rounded text-sm font-semibold cursor-help ${colorClass}`}>
                                                                {fullName}
                                                            </span>
                                                            <ItemTooltip instance={itemInstance} template={template} affixes={affixes} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
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
                                    {reward.itemsLostCount && reward.itemsLostCount > 0 && (
                                        <div className="border-t border-slate-700 my-3 pt-3">
                                            <p className="font-bold text-lg text-red-500">
                                                {t('expedition.itemsLost', { count: reward.itemsLostCount })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    disabled={!isAnimationComplete}
                    className="mt-4 w-full bg-indigo-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-indigo-700 transition-colors duration-200 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed flex-shrink-0"
                >
                    {isAnimationComplete ? (finalVictoryStatus ? t('expedition.excellent') : t('expedition.returnToCamp')) : t('expedition.combatInProgress')}
                </button>
            </div>
        </div>
    )
};


const ActiveExpeditionPanel: React.FC<{
    character: PlayerCharacter;
    expeditions: ExpeditionType[];
    onCompletion: () => void;
}> = ({ character, expeditions, onCompletion }) => {
    const { t } = useTranslation();
    const activeExpeditionDetails = expeditions.find(e => e.id === character.activeExpedition?.expeditionId);
    const [timeLeft, setTimeLeft] = useState(0);
    const completionCalledRef = useRef(false);

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

    return (
        <div className="bg-slate-900/40 p-8 rounded-xl text-center">
            <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('expedition.onExpedition')}</h3>
            <p className="text-4xl font-extrabold text-white mb-4">{activeExpeditionDetails.name}</p>
            <p className="text-lg text-gray-400 mb-6">{isFinished ? t('expedition.finalizing') : t('expedition.endsIn')}</p>
            <div className="text-6xl font-mono font-bold text-amber-400 mb-8">{formatTimeLeft(timeLeft)}</div>
            {/* The button is removed, and a status message is shown instead when finished */}
            {isFinished ? (
                 <div className="mt-8 h-14 flex items-center justify-center"> {/* Set a fixed height to prevent layout shift from the removed button */}
                    <p className="text-lg text-gray-300 animate-pulse">{t('expedition.generatingReport')}</p>
                </div>
            ) : (
                <div className="mt-8 h-14"></div> // Placeholder to keep layout consistent
            )}
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
              const canAfford = character.resources.gold >= exp.goldCost && character.stats.currentEnergy >= exp.energyCost;
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
        {content}
    </>
  );
};