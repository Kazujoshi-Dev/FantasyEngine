import React, { useState, useEffect, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, Expedition as ExpeditionType, Enemy, Location, ItemTemplate, Affix, ExpeditionRewardSummary, CombatLogEntry, CharacterStats, ItemInstance, PartyMember, EnemyStats } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { ClockIcon } from './icons/ClockIcon';
import { MapIcon } from './icons/MapIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ItemTooltip, rarityStyles } from './shared/ItemSlot';
import { StarIcon } from './icons/StarIcon';

interface ExpeditionProps {
    character: PlayerCharacter;
    expeditions: ExpeditionType[];
    enemies: Enemy[];
    currentLocation: Location;
    onStartExpedition: (expeditionId: string) => Promise<void>;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    onCompletion: () => void;
}

export const Expedition: React.FC<ExpeditionProps> = ({ character, expeditions, currentLocation, onStartExpedition, onCompletion }) => {
    const { t } = useTranslation();
    const activeExpedition = character.activeExpedition;
    
    // Filter expeditions for current location
    const locationExpeditions = expeditions.filter(e => e.locationIds.includes(currentLocation.id));

    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        if (activeExpedition) {
            const interval = setInterval(() => {
                const now = Date.now();
                const diff = activeExpedition.finishTime - now;
                if (diff <= 0) {
                    setTimeLeft("00:00:00");
                    onCompletion();
                    clearInterval(interval);
                } else {
                    const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
                    const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
                    setTimeLeft(`${h}:${m}:${s}`);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [activeExpedition, onCompletion]);

    if (activeExpedition) {
        const exp = expeditions.find(e => e.id === activeExpedition.expeditionId);
        return (
            <ContentPanel title={t('expedition.inProgressTitle')}>
                <div className="text-center p-8 bg-slate-900/40 rounded-xl">
                    <h3 className="text-2xl font-bold text-indigo-400 mb-4">{exp?.name || t('expedition.onExpedition')}</h3>
                    <div className="text-4xl font-mono font-bold text-amber-400 mb-4">{timeLeft}</div>
                    <p className="text-gray-400 animate-pulse">{t('expedition.inProgress')}</p>
                </div>
            </ContentPanel>
        );
    }

    return (
        <ContentPanel title={t('expedition.availableTitle')}>
            {locationExpeditions.length === 0 ? (
                <p className="text-gray-500 text-center">{t('expedition.noExpeditions')}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {locationExpeditions.map(exp => (
                        <div key={exp.id} className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 hover:border-indigo-500/50 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-lg font-bold text-white">{exp.name}</h4>
                                <div className="flex items-center text-xs bg-slate-800 px-2 py-1 rounded">
                                    <ClockIcon className="h-3 w-3 mr-1 text-gray-400"/>
                                    <span>{exp.duration}s</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400 mb-4 min-h-[40px]">{exp.description}</p>
                            
                            <div className="flex justify-between items-center text-sm mb-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs">{t('expedition.cost')}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center text-amber-400 font-mono"><CoinsIcon className="h-3 w-3 mr-1"/> {exp.goldCost}</span>
                                        <span className="flex items-center text-sky-400 font-mono"><BoltIcon className="h-3 w-3 mr-1"/> {exp.energyCost}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 text-right">
                                    <span className="text-gray-500 text-xs">{t('expedition.reward')}</span>
                                    <div className="flex items-center gap-3 justify-end">
                                        <span className="flex items-center text-amber-400 font-mono"><CoinsIcon className="h-3 w-3 mr-1"/> {exp.minBaseGoldReward}-{exp.maxBaseGoldReward}</span>
                                        <span className="flex items-center text-sky-400 font-mono"><StarIcon className="h-3 w-3 mr-1"/> {exp.minBaseExperienceReward}-{exp.maxBaseExperienceReward}</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => onStartExpedition(exp.id)}
                                disabled={character.resources.gold < exp.goldCost || character.stats.currentEnergy < exp.energyCost}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-gray-500 rounded-lg font-semibold transition-colors"
                            >
                                {t('expedition.embark')}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </ContentPanel>
    );
};

interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    messageId?: number;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    isHunting?: boolean;
    huntingMembers?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number }>;
    encounteredEnemies?: Enemy[];
    bossName?: string;
    isPvp?: boolean;
    pvpData?: { attacker: PlayerCharacter; defender: PlayerCharacter };
    isDefenderView?: boolean;
    initialEnemy?: Enemy;
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({ 
    reward, 
    onClose, 
    characterName, 
    itemTemplates, 
    affixes,
    isHunting,
    huntingMembers,
    isPvp,
    pvpData,
    initialEnemy
}) => {
    const { t } = useTranslation();
    // Combat Replay State
    const [combatStep, setCombatStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // State for participants (Stats for UI)
    // PVE (Single)
    const [currentPlayerStats, setCurrentPlayerStats] = useState<CharacterStats | null>(null);
    const [currentEnemy, setCurrentEnemy] = useState<{name: string; stats: EnemyStats; currentHealth: number; currentMana: number; description?: string} | null>(
        initialEnemy ? {
            name: initialEnemy.name,
            stats: initialEnemy.stats,
            description: initialEnemy.description,
            currentHealth: initialEnemy.stats.maxHealth,
            currentMana: initialEnemy.stats.maxMana || 0
        } : null
    );

    // PVE (Hunting Party)
    const [partyMembersState, setPartyMembersState] = useState<PartyMember[]>(huntingMembers || []);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [combatStep]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying && combatStep < reward.combatLog.length) {
            interval = setInterval(() => {
                setCombatStep(prev => {
                    if (prev < reward.combatLog.length) {
                        // Apply state update for the *next* step (which is 'prev' index in array, 0-based)
                        const logEntry = reward.combatLog[prev];
                        updateCombatantState(logEntry);
                        return prev + 1;
                    } else {
                        setIsPlaying(false);
                        return prev;
                    }
                });
            }, 1000); // 1 second per step
        } else if (combatStep >= reward.combatLog.length) {
            setIsPlaying(false);
        }
        return () => clearInterval(interval);
    }, [isPlaying, combatStep, reward.combatLog]);

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
                 // FIX: Update player stats even if full stat object isn't in this specific log entry
                 setCurrentPlayerStats(prev => {
                     if (log.playerStats) {
                         return { ...log.playerStats, currentHealth: log.playerHealth, currentMana: log.playerMana };
                     }
                     return prev ? { ...prev, currentHealth: log.playerHealth, currentMana: log.playerMana } : null;
                 });

                 // Logic to init enemy if missing
                 if (!currentEnemy && log.enemyStats && (reward.encounteredEnemies || []).length <= 1) {
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

    const visibleLog = reward.combatLog.slice(0, combatStep);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <h2 className={`text-2xl font-bold ${reward.isVictory ? 'text-green-400' : 'text-red-400'}`}>
                        {reward.isVictory ? t('expedition.victory') : t('expedition.defeat')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Rewards Section */}
                    {reward.isVictory && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-xl">
                            <div>
                                <h4 className="font-bold text-indigo-300 mb-2">{t('expedition.totalRewards')}</h4>
                                <div className="flex gap-4 mb-2">
                                    <div className="flex items-center text-amber-400 font-mono">
                                        <CoinsIcon className="h-5 w-5 mr-2" /> {reward.totalGold}
                                    </div>
                                    <div className="flex items-center text-sky-400 font-mono">
                                        <StarIcon className="h-5 w-5 mr-2" /> {reward.totalExperience}
                                    </div>
                                </div>
                                {reward.itemsFound.length > 0 && (
                                    <div>
                                        <p className="text-sm text-gray-400 mb-1">{t('expedition.itemsFound')}:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {reward.itemsFound.map((item, idx) => {
                                                const template = itemTemplates.find(t => t.id === item.templateId);
                                                if (!template) return null;
                                                return (
                                                    <div key={idx} className="relative group">
                                                        <span className={`text-sm ${rarityStyles[template.rarity].text} border border-slate-700 px-2 py-1 rounded bg-slate-800 cursor-help`}>
                                                            {template.name}
                                                        </span>
                                                        <ItemTooltip instance={item} template={template} affixes={affixes} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Essence rewards etc... */}
                        </div>
                    )}

                    {/* Combat Visualization (Bars) */}
                    <div className="grid grid-cols-2 gap-8 mb-4">
                        {/* Player / Party Side */}
                        <div>
                            <h4 className="text-center font-bold text-green-400 mb-2">
                                {isHunting ? t('hunting.title') : characterName}
                            </h4>
                            {/* Visualization logic here (simplified for brevity) */}
                            {currentPlayerStats && (
                                <div className="bg-slate-800 p-2 rounded">
                                    <div className="w-full bg-gray-700 h-2 rounded-full mb-1">
                                        <div className="bg-red-500 h-2 rounded-full" style={{width: `${(currentPlayerStats.currentHealth / currentPlayerStats.maxHealth) * 100}%`}}></div>
                                    </div>
                                    <p className="text-xs text-center">{Math.ceil(currentPlayerStats.currentHealth)} / {currentPlayerStats.maxHealth}</p>
                                </div>
                            )}
                        </div>

                        {/* Enemy Side */}
                        <div>
                            <h4 className="text-center font-bold text-red-400 mb-2">
                                {currentEnemy ? currentEnemy.name : (isPvp ? pvpData?.defender.name : 'Enemy')}
                            </h4>
                            {currentEnemy && (
                                <div className="bg-slate-800 p-2 rounded">
                                    <div className="w-full bg-gray-700 h-2 rounded-full mb-1">
                                        <div className="bg-red-500 h-2 rounded-full" style={{width: `${(currentEnemy.currentHealth / currentEnemy.stats.maxHealth) * 100}%`}}></div>
                                    </div>
                                    <p className="text-xs text-center">{Math.ceil(currentEnemy.currentHealth)} / {currentEnemy.stats.maxHealth}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Combat Log */}
                    <div className="bg-black/30 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm border border-slate-700/50" ref={logContainerRef}>
                        {visibleLog.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-slate-800/50 pb-1 last:border-0">
                                <span className="text-gray-500">[{log.turn}]</span>{' '}
                                <span className="text-indigo-300">{log.attacker}</span>{' '}
                                <span className="text-gray-400">{log.action === 'magicAttack' ? t('expedition.casts') : t('expedition.attacks')}</span>{' '}
                                <span className="text-red-300">{log.defender}</span>
                                {log.damage !== undefined && (
                                    <>
                                        {' '}{t('expedition.dealing')} <span className="text-red-400 font-bold">{log.damage}</span>
                                        {log.isCrit && <span className="text-yellow-400 font-bold"> {t('expedition.critical')}</span>}
                                    </>
                                )}
                                {/* ... other log details ... */}
                            </div>
                        ))}
                        {visibleLog.length === 0 && <p className="text-gray-500 text-center pt-4">Przygotowanie do walki...</p>}
                    </div>
                </div>

                <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold">
                        {isPlaying ? "Pauza" : "Odtwórz"}
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded text-white font-bold">
                        {t('expedition.returnToCamp')}
                    </button>
                </div>
            </div>
        </div>
    );
};