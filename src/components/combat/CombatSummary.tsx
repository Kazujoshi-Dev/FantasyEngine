
import React, { useState } from 'react';
import { ExpeditionRewardSummary, ItemTemplate, Affix, Enemy, PartyMember, CharacterStats, ItemInstance, EssenceType, PvpRewardSummary, PlayerCharacter } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CombatLogRow } from './CombatLog';
import { ItemDetailsPanel, rarityStyles } from '../shared/ItemSlot';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';

interface CombatantStatsPanelProps {
    name: string;
    stats: CharacterStats;
    isLeft?: boolean;
}

export const CombatantStatsPanel: React.FC<CombatantStatsPanelProps> = ({ name, stats, isLeft }) => {
    const { t } = useTranslation();
    return (
        <div className={`p-4 bg-slate-800/50 rounded-lg border border-slate-700 ${isLeft ? 'text-left' : 'text-right'}`}>
            <h4 className="font-bold text-white mb-2 text-lg">{name}</h4>
            <div className="space-y-1 text-sm text-gray-300">
                <p>{t('statistics.health')}: <span className="text-white font-mono">{Math.ceil(stats.currentHealth)}/{stats.maxHealth}</span></p>
                <p>{t('statistics.armor')}: <span className="text-white font-mono">{stats.armor}</span></p>
                <p>{t('statistics.physicalDamage')}: <span className="text-white font-mono">{stats.minDamage}-{stats.maxDamage}</span></p>
                <p>{t('statistics.critChance')}: <span className="text-white font-mono">{stats.critChance.toFixed(1)}%</span></p>
                <p>{t('statistics.dodgeChance')}: <span className="text-white font-mono">{stats.dodgeChance.toFixed(1)}%</span></p>
            </div>
        </div>
    );
};

interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    enemies: Enemy[];
    messageId?: number | null;
    raidId?: number | null;
    backgroundImage?: string;
    isHunting?: boolean;
    isRaid?: boolean;
    huntingMembers?: PartyMember[];
    opponents?: PartyMember[];
    allRewards?: Record<string, any>;
    bossName?: string;
    initialEnemy?: Enemy;
    encounteredEnemies?: Enemy[];
    isPvp?: boolean;
    pvpData?: { attacker: PlayerCharacter, defender: PlayerCharacter };
    isDefenderView?: boolean;
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({
    reward, onClose, characterName, itemTemplates, affixes, enemies,
    isHunting, isRaid, huntingMembers, opponents, allRewards, bossName, initialEnemy, encounteredEnemies,
    isPvp, pvpData, isDefenderView, backgroundImage
}) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'log'>('summary');

    const isVictory = reward.isVictory;
    const title = isVictory ? t('expedition.victory') : t('expedition.defeat');
    const titleColor = isVictory ? 'text-amber-400' : 'text-red-500';

    // Essence Rendering Helper
    const essenceToRarityMap: Record<EssenceType, any> = {
        [EssenceType.Common]: rarityStyles['Common'],
        [EssenceType.Uncommon]: rarityStyles['Uncommon'],
        [EssenceType.Rare]: rarityStyles['Rare'],
        [EssenceType.Epic]: rarityStyles['Epic'],
        [EssenceType.Legendary]: rarityStyles['Legendary'],
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
            {/* Hover Item Tooltip - pointer-events-none added to prevent flickering */}
            {hoveredItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-none relative animate-fade-in">
                         <ItemDetailsPanel item={hoveredItem.item} template={hoveredItem.template} affixes={affixes} hideAffixes={false} size="small" compact={true} />
                    </div>
                </div>
            )}

            <div 
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col relative overflow-hidden max-h-[90vh]"
                style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundBlendMode: 'multiply' } : undefined}
            >
                {/* Header */}
                <div className="p-6 text-center border-b border-slate-700 bg-slate-900/80">
                    <h2 className={`text-4xl font-extrabold mb-2 uppercase tracking-widest ${titleColor} drop-shadow-lg`}>{title}</h2>
                    <div className="flex justify-center gap-4 text-sm font-medium">
                        <button 
                            onClick={() => setActiveTab('summary')}
                            className={`px-4 py-2 rounded-full transition-colors ${activeTab === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-gray-400 hover:text-white'}`}
                        >
                            Podsumowanie
                        </button>
                        <button 
                            onClick={() => setActiveTab('log')}
                            className={`px-4 py-2 rounded-full transition-colors ${activeTab === 'log' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-gray-400 hover:text-white'}`}
                        >
                            Log Walki
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 bg-slate-900/60 custom-scrollbar">
                    
                    {/* SUMMARY TAB */}
                    {activeTab === 'summary' && (
                        <div className="space-y-8 animate-fade-in">
                            
                            {/* PvP Header */}
                            {isPvp && pvpData && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-6">
                                    <CombatantStatsPanel name={pvpData.attacker.name} stats={pvpData.attacker.stats} isLeft={true} />
                                    <div className="text-center">
                                        <SwordsIcon className="h-12 w-12 text-red-500 mx-auto mb-2" />
                                        <p className="text-gray-400 font-bold text-sm">VS</p>
                                    </div>
                                    <CombatantStatsPanel name={pvpData.defender.name} stats={pvpData.defender.stats} isLeft={false} />
                                </div>
                            )}

                            {/* Rewards Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <h4 className="text-lg font-bold text-indigo-300 mb-4 flex items-center gap-2">
                                        <CoinsIcon className="h-5 w-5" /> {t('expedition.totalRewards')}
                                    </h4>
                                    
                                    <div className="space-y-2">
                                        {reward.totalGold > 0 && (
                                            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                                                <span className="text-gray-300">{t('resources.gold')}</span>
                                                <span className="font-mono font-bold text-amber-400">+{reward.totalGold}</span>
                                            </div>
                                        )}
                                        {reward.totalExperience > 0 && (
                                            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                                                <span className="text-gray-300">{t('expedition.experience')}</span>
                                                <span className="font-mono font-bold text-sky-400">+{reward.totalExperience}</span>
                                            </div>
                                        )}
                                        {Object.entries(reward.essencesFound).map(([key, val]) => {
                                            if (!val) return null;
                                            const rarityStyle = essenceToRarityMap[key as EssenceType];
                                            return (
                                                <div key={key} className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                                                    <span className={`${rarityStyle.text}`}>{t(`resources.${key}`)}</span>
                                                    <span className="font-mono font-bold text-white">+{val}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <h4 className="text-lg font-bold text-indigo-300 mb-4 flex items-center gap-2">
                                        <ShieldIcon className="h-5 w-5" /> {t('expedition.itemsFound')}
                                    </h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {reward.itemsFound.length === 0 && <p className="text-gray-500 italic text-sm text-center py-4">Brak przedmiotów</p>}
                                        {reward.itemsFound.map((item, idx) => {
                                            const template = itemTemplates.find(t => t.id === item.templateId);
                                            if (!template) return null;
                                            const style = rarityStyles[template.rarity];
                                            
                                            return (
                                                <div 
                                                    key={idx}
                                                    onMouseEnter={() => setHoveredItem({ item, template })}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                    className={`p-2 rounded bg-slate-900/50 border border-slate-700 hover:border-slate-500 cursor-help flex items-center gap-3 transition-colors`}
                                                >
                                                    {template.icon && <img src={template.icon} className="w-8 h-8 bg-slate-800 rounded object-contain" />}
                                                    <div>
                                                        <p className={`font-bold text-sm ${style.text}`}>{template.name} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}</p>
                                                        <p className="text-[10px] text-gray-500">{t(`rarity.${template.rarity}`)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Party Results (Raid/Hunting) */}
                            {(isHunting || isRaid) && huntingMembers && (
                                <div className="mt-6">
                                    <h4 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Wyniki Drużyny</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {huntingMembers.map(member => {
                                            const memberRewards = allRewards?.[member.characterName];
                                            return (
                                                <div key={member.userId} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                                                    <div>
                                                        <span className="font-bold text-white">{member.characterName}</span>
                                                        <span className="text-xs text-gray-400 ml-2">Lvl {member.level}</span>
                                                    </div>
                                                    {memberRewards && (
                                                        <div className="text-right text-xs">
                                                            <div className="text-amber-400">{memberRewards.gold} Gold</div>
                                                            <div className="text-sky-400">{memberRewards.experience} XP</div>
                                                            {memberRewards.items && memberRewards.items.length > 0 && (
                                                                <div className="text-purple-400">{memberRewards.items.length} Przedmiotów</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {/* LOG TAB */}
                    {activeTab === 'log' && (
                        <div className="bg-black/40 p-4 rounded-lg font-mono text-sm h-full overflow-y-auto custom-scrollbar border border-slate-700 shadow-inner">
                            {reward.combatLog.map((log, index) => (
                                <div key={index} className="mb-1 border-b border-white/5 pb-1 last:border-0">
                                    <CombatLogRow 
                                        log={log} 
                                        characterName={characterName} 
                                        isHunting={isHunting}
                                        huntingMembers={huntingMembers}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-900/80 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        Zamknij
                    </button>
                </div>
            </div>
        </div>
    );
};
