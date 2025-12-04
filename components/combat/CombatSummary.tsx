
import React, { useState, useMemo, useCallback } from 'react';
import { ExpeditionRewardSummary, CharacterStats, EnemyStats, ItemTemplate, PvpRewardSummary, Affix, ItemInstance, PartyMember, EssenceType, ItemRarity, Enemy, PlayerCharacter } from '../../types';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { useTranslation } from '../../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles, getGrammaticallyCorrectFullName, ItemTooltip } from '../shared/ItemSlot';
import { CombatLogRow } from './CombatLog';

export interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    isPvp?: boolean;
    pvpData?: { attacker: PlayerCharacter, defender: PlayerCharacter };
    isDefenderView?: boolean;
    isHunting?: boolean;
    isRaid?: boolean; // NEW PROP
    huntingMembers?: PartyMember[];
    opponents?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number, items?: ItemInstance[], essences?: Partial<Record<EssenceType, any>> }>;
    initialEnemy?: Enemy;
    encounteredEnemies?: Enemy[];
    bossName?: string;
    messageId?: number | null;
    backgroundImage?: string;
}

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const EnemyListPanel: React.FC<{
    enemies: Enemy[];
    finalEnemiesHealth: { uniqueId: string; name: string; currentHealth: number; maxHealth: number }[] | undefined;
    onEnemyHover: (enemy: Enemy, rect: DOMRect) => void;
    onEnemyLeave: () => void;
}> = ({ enemies, finalEnemiesHealth, onEnemyHover, onEnemyLeave }) => {
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-red-500/50 h-full overflow-y-auto">
             <h4 className="font-bold text-xl text-center border-b border-red-500/50 pb-2 mb-2 text-red-400">
                Wrogowie
            </h4>
            <div className="space-y-3">
                {enemies.map(enemy => {
                    const healthData = finalEnemiesHealth?.find(h => h.uniqueId === enemy.uniqueId);
                    const currentHealth = healthData ? healthData.currentHealth : 0; // Assume dead if not found in final log (rare but safe) or handle pre-fight state elsewhere
                    const maxHealth = healthData?.maxHealth ?? enemy.stats.maxHealth;
                    const hpPercent = (Math.max(0, currentHealth) / maxHealth) * 100;
                    const isDead = currentHealth <= 0;
                    const enemyName = healthData?.name || enemy.name;

                    return (
                        <div 
                            key={enemy.uniqueId} 
                            className={`p-2 rounded bg-slate-800 ${isDead ? 'opacity-75 grayscale' : ''} cursor-help border border-transparent hover:border-slate-500`}
                            onMouseEnter={(e) => onEnemyHover(enemy, e.currentTarget.getBoundingClientRect())}
                            onMouseLeave={onEnemyLeave}
                        >
                            <p className={`font-bold text-sm text-white ${isDead ? 'line-through text-red-500' : ''}`}>
                                {enemyName}
                            </p>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className="bg-red-500 h-1.5 transition-all" style={{width: `${hpPercent}%`}}></div>
                            </div>
                            <p className="text-xs text-right text-gray-400 font-mono mt-0.5">{Math.max(0, Math.ceil(currentHealth))} / {maxHealth}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


export const CombatantStatsPanel: React.FC<{
  name: string;
  description?: string;
  stats: CharacterStats | EnemyStats | null;
  currentHealth?: number;
  currentMana?: number;
}> = ({ name, description, stats, currentHealth, currentMana }) => {
  const { t } = useTranslation();
  if (!stats) {
    return <div className="w-full bg-slate-900 p-4 rounded-lg border border-slate-700 h-full text-gray-500 flex items-center justify-center">Brak danych</div>;
  }

  const isPlayer = 'strength' in stats;
  const borderColor = isPlayer ? 'border-sky-500' : 'border-red-500';
  const textColor = isPlayer ? 'text-sky-400' : 'text-red-400';

  // Ensure HP/Mana display 0 instead of negative or undefined
  const hpDisplay = currentHealth !== undefined ? `${Math.max(0, currentHealth).toFixed(0)} / ${stats.maxHealth}` : stats.maxHealth;
  const manaDisplay = stats.maxMana !== undefined && stats.maxMana > 0
    ? (currentMana !== undefined ? `${Math.max(0, currentMana).toFixed(0)} / ${stats.maxMana}` : stats.maxMana)
    : null;

  const magicDamageDisplay = (stats.magicDamageMin !== undefined && stats.magicDamageMin > 0) || (stats.magicDamageMax !== undefined && stats.magicDamageMax > 0)
    ? `${stats.magicDamageMin || 0} - ${stats.magicDamageMax || 0}`
    : null;

  const manaRegenDisplay = stats.manaRegen !== undefined && stats.manaRegen > 0 ? stats.manaRegen : null;


  return (
    <div className={`bg-slate-900 p-4 rounded-lg border-2 ${borderColor} h-full shadow-2xl relative z-[100]`}>
      <h4 className={`font-bold text-xl text-center border-b pb-2 mb-2 ${borderColor} ${textColor}`}>
        {name}
      </h4>
      {description && <p className="text-xs italic text-gray-400 mb-2 text-center">{description}</p>}
      <div className="text-left text-sm space-y-1 text-gray-200">
        <p className="flex justify-between"><strong>HP:</strong> <span className="font-mono">{hpDisplay}</span></p>
        {manaDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.mana')}:</strong> <span className="font-mono">{manaDisplay}</span></p>
        )}
        {manaRegenDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.manaRegen')}:</strong> <span className="font-mono">{manaRegenDisplay}</span></p>
        )}
        <div className="border-t border-slate-700 my-2"></div>
        
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
        
        <div className="border-t border-slate-700 my-2"></div>
        
        <p className="flex justify-between"><strong>{isPlayer ? t('statistics.physicalDamage') : t('statistics.damage')}:</strong> <span className="font-mono">{stats.minDamage} - {stats.maxDamage}</span></p>
        {magicDamageDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.magicDamage')}:</strong> <span className="font-mono">{magicDamageDisplay}</span></p>
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

export const PartyMemberList: React.FC<{ 
    members: PartyMember[]; 
    finalPartyHealth: Record<string, { currentHealth: number, maxHealth: number }>;
    onMemberHover: (member: PartyMember, rect: DOMRect) => void;
    onMemberLeave: () => void;
    isEnemyTeam?: boolean;
}> = ({ members, finalPartyHealth, onMemberHover, onMemberLeave, isEnemyTeam }) => {
    const { t } = useTranslation();
    const titleColor = isEnemyTeam ? 'text-red-400' : 'text-sky-400';
    const borderColor = isEnemyTeam ? 'border-red-500/50' : 'border-sky-500/50';
    const barColor = isEnemyTeam ? 'bg-red-600' : 'bg-green-500';
    
    return (
        <div className={`bg-slate-900/50 p-4 rounded-lg border ${borderColor} h-full overflow-y-auto overflow-visible`}>
             <h4 className={`font-bold text-xl text-center border-b ${borderColor} pb-2 mb-2 ${titleColor}`}>
                {isEnemyTeam ? 'Przeciwnicy' : t('hunting.members')}
            </h4>
            <div className="space-y-2">
                {members.map((member, idx) => {
                    const healthData = finalPartyHealth[member.characterName];
                    const currentHP = healthData?.currentHealth ?? 0; // Assume 0 if unknown
                    const maxHP = healthData?.maxHealth ?? 1;
                    const hpPercent = Math.min(100, Math.max(0, (currentHP / maxHP) * 100));
                    const isDead = currentHP <= 0;

                    return (
                        <div 
                            key={idx} 
                            className={`p-2 rounded bg-slate-800 relative group cursor-help hover:bg-slate-700 ${isDead ? 'opacity-75' : ''}`}
                            onMouseEnter={(e) => onMemberHover(member, e.currentTarget.getBoundingClientRect())}
                            onMouseLeave={onMemberLeave}
                        >
                            <p className={`font-bold text-sm ${isDead ? 'text-red-500 line-through' : 'text-white'}`}>
                                {member.characterName}
                            </p>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className={`${barColor} h-1.5 transition-all`} style={{width: `${hpPercent}%`}}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const DamageMeter: React.FC<{
    damageData: {
        stats: Record<string, number>;
        totalDamage: number;
        turns: number;
        sortedMembers: { name: string, dmg: number }[];
    } | null;
    title: string;
    barColor?: string;
}> = ({ damageData, title, barColor = 'bg-amber-600' }) => {
    const { t } = useTranslation();

    if (!damageData || damageData.totalDamage === 0) return null;

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex-shrink-0 overflow-y-auto max-h-[300px]">
            <h4 className="font-bold text-center border-b border-slate-700 pb-2 mb-2 text-amber-400">
                {title}
            </h4>
            <div className="space-y-3 text-xs">
                {damageData.sortedMembers.map(({name, dmg}) => {
                    const percent = (dmg / damageData.totalDamage) * 100;
                    const dpt = dmg / damageData.turns;
                    return (
                        <div key={name} className="relative">
                            <div className="flex justify-between items-center z-10 relative mb-1">
                                <span className="font-bold text-white">{name}</span>
                                <span className="text-gray-300">{dmg.toLocaleString()} ({percent.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`${barColor} h-full`} style={{ width: `${percent}%` }}></div>
                            </div>
                            <div className="text-right text-[10px] text-gray-500 mt-0.5">
                                {t('expedition.damageMeter.dpt')}: {dpt.toFixed(0)}
                            </div>
                        </div>
                    )
                })}
                <div className="border-t border-slate-700 pt-2 mt-2 text-center">
                    <span className="text-gray-400">{t('expedition.damageMeter.total')}: </span>
                    <span className="font-mono text-white font-bold">{damageData.totalDamage.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------------
//                                  REWARD PANELS
// ---------------------------------------------------------------------------------

// 1. Raid Rewards Panel (List view, resources focused)
const RaidRewardsPanel: React.FC<{ totalGold: number, essencesFound: Partial<Record<EssenceType, number>> }> = ({ totalGold, essencesFound }) => {
    const { t } = useTranslation();
    
    if (totalGold <= 0 && Object.keys(essencesFound).length === 0) return null;

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-amber-500/30 h-full overflow-y-auto">
             <h4 className="font-bold text-xl text-center border-b border-amber-500/50 pb-2 mb-2 text-amber-400">
                Łupy Wojenne
            </h4>
            <div className="space-y-2 text-sm">
                {totalGold > 0 && (
                     <div className="flex justify-between items-center bg-slate-800 p-2 rounded">
                        <span className="text-gray-300">{t('resources.gold')}</span>
                        <span className="font-mono font-bold text-amber-400 flex items-center">
                            {totalGold.toLocaleString()} <CoinsIcon className="h-4 w-4 ml-1"/>
                        </span>
                     </div>
                )}
                {Object.entries(essencesFound).map(([key, amount]) => {
                    const type = key as EssenceType;
                    const rarity = essenceToRarityMap[type];
                    return (
                        <div key={key} className="flex justify-between items-center bg-slate-800 p-2 rounded">
                             <span className={`${rarityStyles[rarity].text}`}>{t(`resources.${type}`)}</span>
                             <span className="font-mono font-bold text-white">x{amount}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

// 2. Standard Rewards Panel (Grid view, includes items and XP)
const StandardRewardsPanel: React.FC<{ 
    reward: ExpeditionRewardSummary; 
    itemTemplates: ItemTemplate[]; 
    affixes: Affix[];
}> = ({ reward, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const { totalGold, totalExperience, itemsFound, essencesFound } = reward;

    if (totalGold <= 0 && totalExperience <= 0 && itemsFound.length === 0 && Object.keys(essencesFound).length === 0) return null;

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-green-500/30 h-full overflow-y-auto">
             <h4 className="font-bold text-xl text-center border-b border-green-500/50 pb-2 mb-2 text-green-400">
                {t('expedition.totalRewards')}
            </h4>
            
            {/* Gold & XP */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {totalGold > 0 && (
                    <div className="bg-slate-800 p-3 rounded text-center">
                        <p className="text-gray-400 text-xs uppercase">{t('resources.gold')}</p>
                        <p className="font-mono font-bold text-amber-400 flex justify-center items-center text-lg">
                            {totalGold.toLocaleString()} <CoinsIcon className="h-5 w-5 ml-1"/>
                        </p>
                    </div>
                )}
                {totalExperience > 0 && (
                     <div className="bg-slate-800 p-3 rounded text-center">
                        <p className="text-gray-400 text-xs uppercase">{t('expedition.experience')}</p>
                        <p className="font-mono font-bold text-sky-400 flex justify-center items-center text-lg">
                            {totalExperience.toLocaleString()} <StarIcon className="h-5 w-5 ml-1"/>
                        </p>
                    </div>
                )}
            </div>

            {/* Items Grid */}
            {itemsFound.length > 0 && (
                <div className="mb-4">
                    <p className="text-sm font-bold text-gray-300 mb-2">{t('expedition.itemsFound')}:</p>
                    <div className="grid grid-cols-4 gap-2">
                        {itemsFound.map((item, idx) => {
                            const template = itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            return (
                                <div key={idx} className="relative group">
                                    <div className={`w-12 h-12 rounded bg-slate-800 border ${rarityStyles[template.rarity].border} flex items-center justify-center cursor-help`}>
                                        {template.icon ? <img src={template.icon} className="w-10 h-10 object-contain" /> : <span className="text-xs">{template.name[0]}</span>}
                                    </div>
                                    <ItemTooltip instance={item} template={template} affixes={affixes} />
                                </div>
                            )
                        })}
                    </div>
                    {reward.itemsLostCount && <p className="text-xs text-red-400 mt-2">{t('expedition.itemsLost', { count: reward.itemsLostCount })}</p>}
                </div>
            )}

            {/* Essences List */}
            {Object.keys(essencesFound).length > 0 && (
                 <div>
                    <p className="text-sm font-bold text-gray-300 mb-2">{t('expedition.essencesFound')}:</p>
                    <div className="space-y-1">
                        {Object.entries(essencesFound).map(([key, amount]) => {
                             const type = key as EssenceType;
                             const rarity = essenceToRarityMap[type];
                             return (
                                 <div key={key} className="flex justify-between items-center bg-slate-800 p-2 rounded text-xs">
                                      <span className={`${rarityStyles[rarity].text}`}>{t(`resources.${type}`)}</span>
                                      <span className="font-mono font-bold text-white">x{amount}</span>
                                 </div>
                             )
                        })}
                    </div>
                 </div>
            )}
        </div>
    );
};


export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = (props) => {
    const { 
        reward, onClose, characterName, itemTemplates, affixes, 
        isPvp = false, pvpData, isDefenderView = false, 
        isHunting = false, isRaid = false, huntingMembers, opponents, allRewards,
        initialEnemy, encounteredEnemies, bossName, messageId
    } = props;
    const { t } = useTranslation();

    const [inspectingItem, setInspectingItem] = useState<{ item: ItemInstance; template: ItemTemplate } | null>(null);
    const [hoveredReward, setHoveredReward] = useState<{ item: ItemInstance; template: ItemTemplate } | null>(null);

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
                partyHealth[p.name] = {
                    currentHealth: p.currentHealth,
                    maxHealth: p.maxHealth,
                    currentMana: p.currentMana,
                    maxMana: p.maxMana
                };
            });
        }
        
        // Ensure we have valid HP data even for enemies that died earlier
        // We need to reconstruct this from the log history if 'allEnemiesHealth' only shows living ones (implementation specific)
        // Assuming allEnemiesHealth snapshots everyone.
    
        return {
            playerHealth: lastLog.playerHealth,
            enemyHealth: lastLog.enemyHealth,
            partyHealth: partyHealth,
            enemiesHealth: lastLog.allEnemiesHealth || []
        };
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
        
        const sortedMembers = Object.entries(stats)
            .map(([name, dmg]) => ({ name, dmg }))
            .sort((a, b) => b.dmg - a.dmg);

        return { stats, totalDamage, turns, sortedMembers };
    };

    const friendlyDamageData = useMemo(() => calculateDamageData(huntingMembers), [huntingMembers, reward.combatLog]);
    const opponentDamageData = useMemo(() => calculateDamageData(opponents), [opponents, reward.combatLog]);
    
    const [hoveredCombatant, setHoveredCombatant] = useState<{ type: 'player' | 'enemy' | 'partyMember', data: any, rect: DOMRect } | null>(null);

    const onMemberHover = useCallback((member: PartyMember, rect: DOMRect) => {
        const initialStats = reward.combatLog[0]?.partyMemberStats?.[member.characterName];
        if (initialStats) {
            const finalVitals = finalState.partyHealth[member.characterName];
            const mergedStats: CharacterStats = {
                ...initialStats,
                currentHealth: finalVitals?.currentHealth ?? initialStats.currentHealth,
                currentMana: finalVitals?.currentMana ?? initialStats.currentMana,
                maxHealth: initialStats.maxHealth,
                maxMana: initialStats.maxMana
            };
            setHoveredCombatant({ type: 'partyMember', data: { name: member.characterName, stats: mergedStats }, rect });
        }
    }, [reward.combatLog, finalState.partyHealth]);
    
    // Explicit Enemy Hover Handler to fetch stats from log if available
    const onEnemyHover = useCallback((enemy: Enemy, rect: DOMRect) => {
        // Try to find enemy stats from log if possible, otherwise fallback to template stats
        // Note: Enemy templates often have ranges, logs have instances.
        // For dead enemies, currentHealth is 0.
        const healthData = finalState.enemiesHealth.find(e => e.uniqueId === enemy.uniqueId);
        const statsToDisplay = {
            ...enemy.stats,
            maxHealth: healthData?.maxHealth ?? enemy.stats.maxHealth
        };
        
        setHoveredCombatant({ 
            type: 'enemy', 
            data: { 
                name: healthData?.name || enemy.name, 
                stats: statsToDisplay,
                currentHealth: healthData?.currentHealth ?? (enemy.stats.maxHealth), // Fallback
                currentMana: 0 // Enemies usually don't track mana in simple array unless expanded
            }, 
            rect 
        });
    }, [finalState.enemiesHealth]);

    const onMemberLeave = useCallback(() => {
        setHoveredCombatant(null);
    }, []);

    const handleCopyLink = useCallback(() => {
        if (!messageId) return;
        const url = `${window.location.origin}/report/${messageId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Skopiowano link do schowka!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('Błąd kopiowania linku.');
        });
    }, [messageId]);

    const backgroundStyle = props.backgroundImage ? { backgroundImage: `url(${props.backgroundImage})` } : {};

    return (
        <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-40 p-4"
            style={backgroundStyle}
        >
             {/* Tooltip & Inspection Modals */}
             {inspectingItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setInspectingItem(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={() => setInspectingItem(null)}>✕</button>
                        <ItemDetailsPanel item={inspectingItem.item} template={inspectingItem.template} affixes={affixes} />
                    </div>
                </div>
            )}
            {hoveredCombatant && hoveredCombatant.rect && (
                 <div
                    className="fixed z-[100] pointer-events-none shadow-2xl"
                    style={{
                        // Simple positioning logic: stay within viewport
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
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold text-indigo-400">{t(isPvp ? 'pvp.duelResult' : 'expedition.combatReport')}</h2>
                    <div className="flex gap-3">
                        {messageId && (
                            <button onClick={handleCopyLink} className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-sm transition-colors shadow-lg border border-sky-500">
                                Kopiuj Link
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded font-bold text-sm transition-colors shadow-lg border border-red-500">
                            Zamknij
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
                    <div className="col-span-3 h-full overflow-y-auto flex flex-col gap-4">
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
                                
                                {/* Conditional Reward Panel */}
                                {isRaid ? (
                                    <RaidRewardsPanel totalGold={reward.totalGold} essencesFound={reward.essencesFound} />
                                ) : (
                                    <StandardRewardsPanel reward={reward} itemTemplates={itemTemplates} affixes={affixes} />
                                )}
                             </>
                         ) : (
                             <>
                                <CombatantStatsPanel name={characterName} stats={initialPlayerStats} currentHealth={finalState.playerHealth} />
                                {/* Standard Expedition/Solo */}
                                <StandardRewardsPanel reward={reward} itemTemplates={itemTemplates} affixes={affixes} />
                             </>
                         )}
                    </div>

                    <div className="col-span-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col h-full overflow-hidden">
                        <div className="flex-grow overflow-y-auto pr-2 space-y-1.5">
                            {reward.combatLog.map((log, index) => {
                                const isNewTurn = index > 0 && reward.combatLog[index - 1].turn !== log.turn;
                                return (
                                    <React.Fragment key={index}>
                                        {isNewTurn && <div className="border-t border-slate-600/30 my-2"></div>}
                                        <CombatLogRow log={log} characterName={characterName} isHunting={isHunting} huntingMembers={huntingMembers} />
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    <div className="col-span-3 h-full overflow-y-auto flex flex-col gap-4">
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
                        ) : encounteredEnemies && encounteredEnemies.length > 1 ? (
                             <EnemyListPanel 
                                enemies={encounteredEnemies} 
                                finalEnemiesHealth={finalState.enemiesHealth}
                                onEnemyHover={onEnemyHover}
                                onEnemyLeave={onMemberLeave}
                            />
                        ) : (
                             <CombatantStatsPanel name={initialEnemyForDisplay?.name || ''} description={initialEnemyForDisplay?.description} stats={initialEnemyForDisplay?.stats || null} currentHealth={finalState.enemyHealth} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
