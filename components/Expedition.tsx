import React, { useState, useEffect, useRef, useMemo } from 'react';
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
                    : (stats as EnemyStats).attacksPerTurn || 1
                }
            </span>
        </p>
        <p className="flex justify-between"><strong>{t('statistics.armor')}:</strong> <span>{stats.armor}</span></p>
        <p className="flex justify-between"><strong>{t('statistics.critChance')}:</strong> <span>{stats.critChance}%</span></p>
      </div>
    </div>
  );
};

interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary | PvpRewardSummary;
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

// FIX: Export ExpeditionSummaryModal to be used in other components.
export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({ reward, onClose, characterName, itemTemplates, affixes, isPvp, pvpData, isDefenderView }) => {
    const { t } = useTranslation();
    const [visibleLogs, setVisibleLogs] = useState(1);
    const [animationFinished, setAnimationFinished] = useState(false);
    const combatLogRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<number>();

    // FIX: Use type guard to correctly access properties from the union type.
    const totalGold = 'totalGold' in reward ? reward.totalGold : (reward as PvpRewardSummary).gold;
    const totalExperience = 'totalExperience' in reward ? reward.totalExperience : (reward as PvpRewardSummary).experience;

    const isExpeditionReward = 'rewardBreakdown' in reward;
    const isVictory = isPvp && pvpData ? (isDefenderView ? !reward.isVictory : reward.isVictory) : reward.isVictory;

    useEffect(() => {
        if (reward.combatLog.length === 0) {
            setAnimationFinished(true);
            return;
        }

        timerRef.current = window.setInterval(() => {
            setVisibleLogs(prev => {
                const next = prev + 1;
                if (next > reward.combatLog.length) {
                    clearInterval(timerRef.current);
                    setAnimationFinished(true);
                    return prev;
                }
                return next;
            });
        }, 500);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [reward.combatLog]);

    useEffect(() => {
        if (combatLogRef.current) {
            combatLogRef.current.scrollTop = combatLogRef.current.scrollHeight;
        }
    }, [visibleLogs]);

    const skipAnimation = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setVisibleLogs(reward.combatLog.length);
        setAnimationFinished(true);
    };

    const currentFightData = useMemo(() => {
        if (!reward.combatLog.length) return null;
        
        let playerStats: CharacterStats | undefined;
        let currentEnemyLog: CombatLogEntry | undefined;

        // Find the most recent 'start fight' log based on the currently visible logs
        const visibleLogSlice = reward.combatLog.slice(0, visibleLogs);
        for (let i = visibleLogSlice.length - 1; i >= 0; i--) {
            if (visibleLogSlice[i].action === 'starts a fight with') {
                currentEnemyLog = visibleLogSlice[i];
                playerStats = visibleLogSlice[i].playerStats;
                break;
            }
        }
        
        // Fallback to the first log if no fight start has been found yet
        if (!currentEnemyLog) {
            currentEnemyLog = reward.combatLog[0];
            playerStats = reward.combatLog[0]?.playerStats;
        }

        return {
            playerStats,
            enemyStats: currentEnemyLog?.enemyStats,
            enemyName: currentEnemyLog?.defender,
            enemyDescription: currentEnemyLog?.enemyDescription
        };
    }, [visibleLogs, reward.combatLog]);

    const currentLogEntry = visibleLogs > 0 ? reward.combatLog[visibleLogs - 1] : null;

    const getRewardSourceText = (source: string) => {
        if (source === 'Expedition Reward') {
// FIX: The `t` function expects an optional second argument for interpolation. Provide an empty object to satisfy the type checker. This might be a workaround for a toolchain issue.
            return t('expedition.baseReward', {});
        }
        const match = source.match(/^Defeated (.+)$/);
        if (match) {
            const enemyName = match[1];
            return t('expedition.enemyDefeated', { enemyName: enemyName });
        }
        return source;
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-7xl w-full">
                <div className="text-center mb-4">
                    <h2 className={`text-5xl font-extrabold ${isVictory ? 'text-green-400' : 'text-red-500'}`}>
                        {isPvp ? t('pvp.duelResult') : (isVictory ? t('expedition.victory') : t('expedition.defeat'))}
                    </h2>
                </div>
                
                <div className="flex flex-col h-[70vh]">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">
                        {/* Player Stats */}
                        <CombatantStatsPanel 
                            name={isPvp && pvpData ? pvpData.attacker.name : characterName} 
                            stats={isPvp && pvpData ? pvpData.attacker.stats : currentFightData?.playerStats || null}
                            currentHealth={currentLogEntry?.playerHealth}
                            currentMana={currentLogEntry?.playerMana}
                        />

                        {/* Combat Log */}
                        <div className="bg-slate-900/50 p-4 rounded-lg flex flex-col">
                            <h3 className="text-xl font-bold text-indigo-400 mb-2">{isPvp ? t('pvp.duelResult') : t('expedition.combatReport')}</h3>
                            <div ref={combatLogRef} className="flex-grow bg-black/30 p-3 rounded-md overflow-y-auto space-y-1 font-mono text-sm">
                                {reward.combatLog.slice(0, visibleLogs).map((log, index) => (
                                    <CombatLogRow key={index} log={log} characterName={isPvp && pvpData ? pvpData.attacker.name : characterName} />
                                ))}
                                {!animationFinished && (
                                    <p className="text-gray-500 animate-pulse">{t('expedition.combatInProgress')}</p>
                                )}
                            </div>
                            {!animationFinished && (
                                <button onClick={skipAnimation} className="mt-2 text-xs text-gray-400 hover:text-white">{t('expedition.skipAnimation')}</button>
                            )}
                        </div>

                        {/* Opponent Stats */}
                        <CombatantStatsPanel 
                            name={isPvp && pvpData ? pvpData.defender.name : currentFightData?.enemyName || ''}
                            description={isPvp ? undefined : currentFightData?.enemyDescription}
                            stats={isPvp && pvpData ? pvpData.defender.stats : currentFightData?.enemyStats || null}
                            currentHealth={currentLogEntry?.enemyHealth}
                            currentMana={currentLogEntry?.enemyMana}
                        />
                    </div>

                    {animationFinished && (
                         <div className="flex-shrink-0 pt-4 mt-4 border-t border-slate-700/50 overflow-y-auto">
                             <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-xl font-bold text-indigo-400 mb-2">{t('expedition.totalRewards')}</h3>
                                    <div className="space-y-2 text-lg bg-slate-900/50 p-3 rounded-md">
                                        {isPvp ? (
                                            <>
                                                <p className="flex justify-between items-center">
                                                    <span className="flex items-center"><CoinsIcon className="h-5 w-5 mr-2 text-amber-400"/> {isDefenderView ? t('pvp.goldLost') : t('pvp.goldGained')}</span>
                                                    <span className={`font-mono font-bold ${isVictory ? 'text-green-400' : 'text-red-400'}`}>{isVictory ? '+' : '-'}{totalGold.toLocaleString()}</span>
                                                </p>
                                                <p className="flex justify-between items-center">
                                                    <span className="flex items-center"><StarIcon className="h-5 w-5 mr-2 text-sky-400"/> {isDefenderView ? t('pvp.xpLost') : t('pvp.xpGained')}</span>
                                                    <span className="font-mono font-bold text-green-400">+{totalExperience.toLocaleString()}</span>
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="flex justify-between items-center">
                                                    <span className="flex items-center"><CoinsIcon className="h-5 w-5 mr-2 text-amber-400"/> {t('expedition.goldGained')}</span>
                                                    <span className="font-mono font-bold text-green-400">+{totalGold.toLocaleString()}</span>
                                                </p>
                                                <p className="flex justify-between items-center">
                                                    <span className="flex items-center"><StarIcon className="h-5 w-5 mr-2 text-sky-400"/> {t('expedition.experience')}</span>
                                                    <span className="font-mono font-bold text-green-400">+{totalExperience.toLocaleString()}</span>
                                                </p>
                                            </>
                                        )}
                                    </div>
                                     {isExpeditionReward && reward.rewardBreakdown.length > 0 && (
                                        <div className="text-xs space-y-1 mt-2 bg-slate-900/50 p-2 rounded-md">
                                            {reward.rewardBreakdown.map((source, index) => (
                                                <div key={index} className="grid grid-cols-3 gap-2 text-gray-400">
                                                    <span className="col-span-1 truncate">{getRewardSourceText(source.source)}</span>
                                                    <span className="col-span-1 text-right text-amber-500 font-mono">+{source.gold}</span>
                                                    <span className="col-span-1 text-right text-sky-500 font-mono">+{source.experience}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {isExpeditionReward && (reward.itemsFound.length > 0 || Object.keys(reward.essencesFound).length > 0) && (
                                    <div>
                                        {reward.itemsFound.length > 0 &&
                                            <div>
                                                <h4 className="font-semibold text-indigo-400 mb-2">{t('expedition.itemsFound')}</h4>
                                                <div className="max-h-24 overflow-y-auto pr-2 space-y-1 bg-slate-900/50 p-2 rounded-md">
                                                    {reward.itemsFound.map((item, index) => {
                                                        const template = itemTemplates.find(t => t.id === item.templateId);
                                                        if (!template) return null;
                                                        return (
                                                            <div key={index} className="relative group text-sm p-1 rounded-md hover:bg-slate-700/50">
                                                                <p className={rarityStyles[template.rarity].text}>{getGrammaticallyCorrectFullName(item, template, affixes)}</p>
                                                                <ItemTooltip instance={item} template={template} affixes={affixes} />
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                {reward.itemsLostCount && reward.itemsLostCount > 0 && (
                                                    <p className="text-xs text-red-500 mt-2">{t('expedition.itemsLost', { count: reward.itemsLostCount })}</p>
                                                )}
                                            </div>
                                        }
                                         {Object.keys(reward.essencesFound).length > 0 && (
                                            <div className="mt-2">
                                                <h4 className="font-semibold text-indigo-400 mb-2">{t('expedition.essencesFound')}</h4>
                                                <div className="space-y-1 text-sm bg-slate-900/50 p-2 rounded-md">
                                                    {Object.entries(reward.essencesFound).map(([essence, amount]) => {
                                                        if (!amount) return null;
                                                        return <p key={essence}>{t(`resources.${essence}`)}: +{amount}</p>
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                             </div>
                         </div>
                    )}
                </div>
                <div className="text-center mt-4">
                    <button onClick={onClose} className="w-full max-w-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-lg transition-colors">
                        {t('expedition.excellent')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Expedition: React.FC<ExpeditionProps> = ({ character, expeditions, enemies, currentLocation, onStartExpedition, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const { activeExpedition } = character;
    const [timeLeft, setTimeLeft] = useState(0);

    const currentExpedition = useMemo(() => activeExpedition ? expeditions.find(e => e.id === activeExpedition.expeditionId) : null, [activeExpedition, expeditions]);

    useEffect(() => {
        if (activeExpedition) {
            const updateTimer = () => {
                const remaining = Math.max(0, Math.floor((activeExpedition.finishTime - Date.now()) / 1000));
                setTimeLeft(remaining);
            };

            updateTimer();
            const intervalId = setInterval(updateTimer, 1000);
            return () => clearInterval(intervalId);
        }
    }, [activeExpedition]);

    if (activeExpedition && currentExpedition) {
        return (
            <ContentPanel title={t('expedition.inProgressTitle')}>
                <div className="bg-slate-900/40 p-8 rounded-xl text-center">
                    <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('expedition.onExpedition')}</h3>
                    <p className="text-4xl font-extrabold text-white mb-4">{currentExpedition.name}</p>
                    {currentExpedition.image && <img src={currentExpedition.image} alt={currentExpedition.name} className="w-full h-48 object-cover rounded-lg my-4 border border-slate-700/50" />}
                    <p className="text-lg text-gray-400 mb-6">{t('expedition.endsIn')}</p>
                    <div className="text-6xl font-mono font-bold text-amber-400 mb-8">{formatTimeLeft(timeLeft)}</div>
                    <button 
                        onClick={() => {}} 
                        className="w-full max-w-sm mx-auto py-3 rounded-lg bg-slate-600 text-white font-bold text-lg cursor-not-allowed"
                        disabled
                    >
                        {t('expedition.inProgress')}
                    </button>
                </div>
            </ContentPanel>
        );
    }
    
    const availableExpeditions = expeditions.filter(exp => exp.locationIds.includes(currentLocation.id));

    return (
        <ContentPanel title={t('expedition.availableTitle')}>
            <div className="space-y-6">
                {availableExpeditions.length > 0 ? availableExpeditions.map(exp => {
                    const canAfford = character.resources.gold >= exp.goldCost && character.stats.currentEnergy >= exp.energyCost;
                    const expeditionEnemies = (exp.enemies || [])
                        .map(ee => {
                            const enemy = enemies.find(e => e.id === ee.enemyId);
                            if (!enemy) return null;
                            return {
                                ...enemy,
                                spawnChance: ee.spawnChance
                            };
                        })
                        .filter((e): e is Enemy & { spawnChance: number } => e !== null);
                    
                    return (
                        <div key={exp.id} className="bg-slate-900/40 p-6 rounded-xl flex flex-col md:flex-row gap-6">
                           {exp.image && <img src={exp.image} alt={exp.name} className="w-full md:w-48 h-48 object-cover rounded-lg flex-shrink-0" />}
                            <div className="flex-grow">
                                <h3 className="text-2xl font-bold text-indigo-400 mb-2">{exp.name}</h3>
                                <p className="text-gray-400 mb-4 text-sm italic">{exp.description}</p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-center">
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <p className="text-xs text-gray-400">{t('expedition.cost')}</p>
                                        <div className="flex justify-center items-center gap-4 mt-1">
                                            <p className={`flex items-center text-sm ${character.resources.gold < exp.goldCost ? 'text-red-400' : 'text-amber-400'}`}><CoinsIcon className="h-4 w-4 mr-1"/>{exp.goldCost}</p>
                                            <p className={`flex items-center text-sm ${character.stats.currentEnergy < exp.energyCost ? 'text-red-400' : 'text-sky-400'}`}><BoltIcon className="h-4 w-4 mr-1"/>{exp.energyCost}</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <p className="text-xs text-gray-400">{t('expedition.duration')}</p>
                                        <p className="flex justify-center items-center text-sm mt-1 text-gray-300"><ClockIcon className="h-4 w-4 mr-1"/>{formatDuration(exp.duration)}</p>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                        <p className="text-xs text-gray-400">{t('expedition.reward')}</p>
                                         <div className="flex justify-center items-center gap-4 mt-1">
                                            <p className="flex items-center text-sm text-green-400"><CoinsIcon className="h-4 w-4 mr-1"/>{exp.minBaseGoldReward}-{exp.maxBaseGoldReward}</p>
                                            <p className="flex items-center text-sm text-green-400"><StarIcon className="h-4 w-4 mr-1"/>{exp.minBaseExperienceReward}-{exp.maxBaseExperienceReward}</p>
                                        </div>
                                    </div>
                                </div>
                                {expeditionEnemies.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-1">{t('expedition.potentialEnemies')}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {expeditionEnemies.map(enemy => enemy.name && (
                                                <span key={enemy.id} className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded-full">{enemy.name} ({enemy.spawnChance}%)</span>
                                            ))}
                                        </div>
                                        {exp.maxEnemies && <p className="text-xs text-gray-500 mt-2">{t('expedition.maxEnemiesNote', { count: exp.maxEnemies })}</p>}
                                    </div>
                                )}
                            </div>
                            <div className="flex-shrink-0 flex flex-col justify-center items-center md:ml-6">
                                <button
                                    onClick={() => onStartExpedition(exp.id)}
                                    disabled={!canAfford}
                                    className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed"
                                >
                                    {t('expedition.embark')}
                                </button>
                                {!canAfford && <p className="text-red-400 text-xs mt-2">{t('expedition.lackResources')}</p>}
                            </div>
                        </div>
                    )
                }) : (
                    <p className="text-center text-gray-500 py-8">{t('expedition.noExpeditions')}</p>
                )}
            </div>
        </ContentPanel>
    );
};