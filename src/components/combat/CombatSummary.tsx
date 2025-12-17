
import React, { useState } from 'react';
import { ExpeditionRewardSummary, ItemTemplate, Affix, Enemy, CharacterStats, PartyMember, PvpRewardSummary, ItemInstance, EssenceType, ItemRarity } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles } from '../shared/ItemSlot';
import { CombatLogRow } from './CombatLog';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { TrophyIcon } from '../icons/TrophyIcon';
import { UsersIcon } from '../icons/UsersIcon';

export const CombatantStatsPanel: React.FC<{ name: string, stats: CharacterStats }> = ({ name, stats }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-slate-800/50 p-2 rounded text-xs space-y-1">
            <p className="font-bold text-white border-b border-slate-700 pb-1 mb-1">{name}</p>
            <div className="grid grid-cols-2 gap-x-2">
                <span className="text-gray-400">HP: <span className="text-white">{stats.maxHealth}</span></span>
                <span className="text-gray-400">Mana: <span className="text-white">{stats.maxMana}</span></span>
                <span className="text-gray-400">Dmg: <span className="text-white">{stats.minDamage}-{stats.maxDamage}</span></span>
                <span className="text-gray-400">Mag: <span className="text-white">{stats.magicDamageMin}-{stats.magicDamageMax}</span></span>
                <span className="text-gray-400">Armor: <span className="text-white">{stats.armor}</span></span>
                <span className="text-gray-400">Crit: <span className="text-white">{stats.critChance.toFixed(1)}%</span></span>
            </div>
        </div>
    );
};

interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates?: ItemTemplate[];
    affixes?: Affix[];
    enemies?: Enemy[];
    messageId?: number | null;
    isHunting?: boolean;
    huntingMembers?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number, items?: ItemInstance[], essences?: Partial<Record<EssenceType, number>> }>;
    initialEnemy?: Enemy;
    isPvp?: boolean;
    pvpData?: { attacker: any, defender: any };
    isDefenderView?: boolean;
    bossName?: string;
    isRaid?: boolean;
    raidId?: number;
    opponents?: PartyMember[];
    backgroundImage?: string;
    encounteredEnemies?: Enemy[];
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({ 
    reward, onClose, characterName, itemTemplates = [], affixes = [], enemies = [], messageId, 
    isHunting, huntingMembers, allRewards, initialEnemy, isPvp, pvpData, isDefenderView, bossName, isRaid, opponents, backgroundImage, encounteredEnemies
}) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const mainTitle = isPvp 
        ? t('pvp.duelResult')
        : (isRaid ? 'Raport z Rajdu' : (isHunting ? 'Raport z Polowania' : t('expedition.combatReport')));
    
    const outcomeTitle = reward.isVictory ? t('expedition.victory') : t('expedition.defeat');
    const outcomeColor = reward.isVictory ? 'text-green-400' : 'text-red-500';

    const renderRewards = (gold: number, xp: number, items: ItemInstance[], essences: Partial<Record<EssenceType, number>>) => (
        <div className="flex flex-col gap-2">
            {(gold > 0 || xp > 0) && (
                <div className="flex gap-4 mb-2">
                    {gold > 0 && <span className="flex items-center text-amber-400 font-bold"><CoinsIcon className="h-4 w-4 mr-1"/> {gold}</span>}
                    {xp > 0 && <span className="flex items-center text-sky-400 font-bold"><StarIcon className="h-4 w-4 mr-1"/> {xp} XP</span>}
                </div>
            )}
            
            {/* Essences */}
            {essences && Object.entries(essences).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {Object.entries(essences).map(([key, val]) => (
                         <span key={key} className={`text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 ${rarityStyles[key === EssenceType.Legendary ? ItemRarity.Legendary : key === EssenceType.Epic ? ItemRarity.Epic : key === EssenceType.Rare ? ItemRarity.Rare : key === EssenceType.Uncommon ? ItemRarity.Uncommon : ItemRarity.Common].text}`}>
                            {val}x {t(`resources.${key}`)}
                        </span>
                    ))}
                </div>
            )}

            {items && items.length > 0 && (
                <div className="grid grid-cols-1 gap-1">
                    {items.map((item, idx) => {
                         const template = itemTemplates.find(t => t.id === item.templateId);
                         if (!template) return null;
                         return (
                            <div 
                                key={idx} 
                                className={`text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 flex justify-between items-center cursor-help hover:bg-slate-700 ${rarityStyles[template.rarity].text}`}
                                onMouseEnter={() => setHoveredItem({ item, template })}
                                onMouseLeave={() => setHoveredItem(null)}
                            >
                                <span>{template.name} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}</span>
                            </div>
                         )
                    })}
                </div>
            )}
            
            {gold === 0 && xp === 0 && (!items || items.length === 0) && (!essences || Object.keys(essences).length === 0) && (
                <span className="text-gray-500 italic text-xs">Brak nagród</span>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            
            {/* Tooltip Overlay */}
            {hoveredItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-none relative animate-fade-in backdrop-blur-md">
                         <ItemDetailsPanel item={hoveredItem.item} template={hoveredItem.template} affixes={affixes} hideAffixes={false} size="small" compact={true} />
                    </div>
                </div>
            )}

            <div 
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col relative overflow-hidden" 
                onClick={e => e.stopPropagation()}
                style={{ 
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                }}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700/50 bg-slate-900/80">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{mainTitle}</h2>
                        <p className={`text-xl font-bold ${outcomeColor} mt-1`}>{outcomeTitle}</p>
                        {bossName && <p className="text-sm text-gray-400 mt-1">Przeciwnik: <span className="text-red-400 font-bold">{bossName}</span></p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2">✕</button>
                </div>

                <div className="flex-grow overflow-hidden flex flex-col md:flex-row">
                    
                    {/* LEFT COLUMN: Participants & Rewards */}
                    <div className="w-full md:w-1/3 bg-slate-900/60 border-r border-slate-700/50 flex flex-col min-h-0">
                        <div className="p-4 border-b border-slate-700/50 bg-slate-800/40">
                             <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <TrophyIcon className="h-4 w-4"/> Nagrody
                             </h3>
                             {/* Personal Rewards (for single view) */}
                             {!isRaid && renderRewards(reward.totalGold, reward.totalExperience, reward.itemsFound, reward.essencesFound)}
                        </div>

                        {/* Participants List (Hunting / Raid) */}
                        {(isHunting || isRaid) && huntingMembers && (
                            <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                                <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                   <UsersIcon className="h-4 w-4"/> Uczestnicy
                                </h3>
                                <div className="space-y-4">
                                    {huntingMembers.map(member => {
                                        const rewards = allRewards ? allRewards[member.characterName] : null;
                                        // For raids we might not have detailed rewards per person here in summary
                                        const isMe = member.characterName === characterName;
                                        
                                        return (
                                            <div key={member.userId} className={`bg-slate-800/40 p-3 rounded border ${isMe ? 'border-indigo-500/50 bg-indigo-900/20' : 'border-slate-700/50'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`font-bold ${isMe ? 'text-indigo-300' : 'text-gray-300'}`}>{member.characterName} <span className="text-xs font-normal text-gray-500">(Lvl {member.level})</span></span>
                                                </div>
                                                
                                                {/* Stats Preview if available */}
                                                {member.stats && <CombatantStatsPanel name="" stats={member.stats} />}

                                                {/* Rewards for this member */}
                                                {rewards && (
                                                    <div className="mt-2 pt-2 border-t border-slate-700/30">
                                                        {renderRewards(rewards.gold, rewards.experience, rewards.items || [], rewards.essences || {})}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Opponents for Raid */}
                        {isRaid && opponents && (
                             <div className="flex-grow overflow-y-auto p-4 custom-scrollbar border-t border-slate-700/50">
                                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                   <SwordsIcon className="h-4 w-4"/> Przeciwnicy
                                </h3>
                                <div className="space-y-2">
                                    {opponents.map(opp => (
                                         <div key={opp.userId} className="bg-slate-800/40 p-2 rounded border border-red-900/30">
                                              <div className="flex justify-between items-center">
                                                    <span className="font-bold text-red-300">{opp.characterName} <span className="text-xs text-gray-500">(Lvl {opp.level})</span></span>
                                              </div>
                                              {opp.stats && <div className="mt-1"><CombatantStatsPanel name="" stats={opp.stats} /></div>}
                                         </div>
                                    ))}
                                </div>
                             </div>
                        )}

                        {/* PvP Info */}
                        {isPvp && pvpData && (
                             <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
                                 <div className="mb-4">
                                     <h4 className="text-green-400 font-bold mb-2 border-b border-green-500/30 pb-1">Twój Bohater</h4>
                                     <CombatantStatsPanel name={isDefenderView ? pvpData.defender.name : pvpData.attacker.name} stats={isDefenderView ? pvpData.defender.stats : pvpData.attacker.stats} />
                                 </div>
                                 <div>
                                     <h4 className="text-red-400 font-bold mb-2 border-b border-red-500/30 pb-1">Przeciwnik</h4>
                                     <CombatantStatsPanel name={isDefenderView ? pvpData.attacker.name : pvpData.defender.name} stats={isDefenderView ? pvpData.attacker.stats : pvpData.defender.stats} />
                                 </div>
                             </div>
                        )}
                        
                        {/* Single Enemy Info (Expedition) */}
                        {!isPvp && !isRaid && !isHunting && encounteredEnemies && encounteredEnemies.length > 0 && (
                            <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
                                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">Napotkani Wrogowie</h3>
                                <div className="space-y-2">
                                    {encounteredEnemies.map((e, i) => (
                                         <div key={i} className="bg-slate-800/40 p-2 rounded border border-red-900/30">
                                             <p className="font-bold text-red-300">{e.name}</p>
                                             {e.stats && <CombatantStatsPanel name="" stats={e.stats as any} />}
                                         </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Combat Log */}
                    <div className="w-full md:w-2/3 bg-slate-900/80 p-4 flex flex-col min-h-0">
                        <h3 className="text-lg font-bold text-gray-300 mb-2 sticky top-0 bg-slate-900/90 py-2 z-10 border-b border-slate-700">Przebieg Walki</h3>
                        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-1">
                            {reward.combatLog.map((log, index) => (
                                <CombatLogRow 
                                    key={index} 
                                    log={log} 
                                    characterName={characterName} 
                                    isHunting={isHunting || isRaid} 
                                    huntingMembers={huntingMembers}
                                />
                            ))}
                            {reward.combatLog.length === 0 && <p className="text-gray-500 italic text-center mt-10">Brak logów z walki (Walkower lub błąd).</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
    
// Helper Icon Component for CombatSummary (reused from sidebar but need importing if not available)
function SwordsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
    </svg>
  );
}
