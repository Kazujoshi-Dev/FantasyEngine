
import React, { useState, useEffect } from 'react';
import { ExpeditionRewardSummary, PvpRewardSummary, CharacterStats, EnemyStats, ItemTemplate, Affix, Enemy, ItemInstance, PartyMember, EquipmentSlot } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { ItemDetailsPanel, rarityStyles, ItemListItem } from '../shared/ItemSlot';
import { CombatLogRow } from './CombatLog';
import { api } from '../../api';

interface CombatSummaryProps {
    reward: ExpeditionRewardSummary | PvpRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates?: ItemTemplate[];
    affixes?: Affix[];
    enemies?: Enemy[];
    isHunting?: boolean;
    isRaid?: boolean;
    isPvp?: boolean;
    pvpData?: { attacker: any, defender: any };
    isDefenderView?: boolean;
    huntingMembers?: PartyMember[];
    opponents?: PartyMember[];
    allRewards?: any;
    initialEnemy?: Enemy;
    messageId?: number;
    bossName?: string;
    raidId?: number;
    backgroundImage?: string;
}

export const CombatantStatsPanel: React.FC<{ name: string; stats: CharacterStats | EnemyStats }> = ({ name, stats }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="font-bold text-gray-300 mb-2 border-b border-slate-600 pb-1">{name}</h4>
            <div className="text-xs space-y-1 text-gray-400">
                <div className="flex justify-between"><span>{t('statistics.health')}:</span> <span className="text-white">{stats.maxHealth}</span></div>
                <div className="flex justify-between"><span>{t('statistics.damage')}:</span> <span className="text-white">{stats.minDamage}-{stats.maxDamage}</span></div>
                <div className="flex justify-between"><span>{t('statistics.armor')}:</span> <span className="text-white">{stats.armor}</span></div>
                <div className="flex justify-between"><span>{t('statistics.critChance')}:</span> <span className="text-white">{stats.critChance.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span>{t('statistics.dodgeChance')}:</span> <span className="text-white">{(stats.dodgeChance || 0).toFixed(1)}%</span></div>
                {stats.magicDamageMax > 0 && <div className="flex justify-between"><span>{t('statistics.magicDamage')}:</span> <span className="text-purple-300">{stats.magicDamageMin}-{stats.magicDamageMax}</span></div>}
            </div>
        </div>
    );
};

export const ExpeditionSummaryModal: React.FC<CombatSummaryProps> = ({
    reward, onClose, characterName, itemTemplates = [], affixes = [], enemies = [],
    isHunting, isRaid, isPvp, pvpData, isDefenderView, huntingMembers, opponents, allRewards, initialEnemy, messageId, bossName, raidId, backgroundImage
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'rewards' | 'log' | 'stats'>('rewards');
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const {
        isVictory, totalGold, totalExperience, itemsFound, essencesFound, combatLog,
        rewardBreakdown = [], itemsLostCount, encounteredEnemies = []
    } = reward as ExpeditionRewardSummary; // Safe cast for shared props

    // Determine Title
    let title = isVictory ? t('expedition.victory') : t('expedition.defeat');
    if (isPvp) {
        title = t('pvp.duelResult');
    }

    // Determine Enemies involved for display
    const uniqueEnemies = encounteredEnemies.length > 0 ? encounteredEnemies : (initialEnemy ? [initialEnemy] : []);
    
    // Stats Tab Logic
    const renderStatsTab = () => {
        if (isPvp && pvpData) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CombatantStatsPanel name={pvpData.attacker.name} stats={pvpData.attacker.stats} />
                    <CombatantStatsPanel name={pvpData.defender.name} stats={pvpData.defender.stats} />
                </div>
            );
        }
        if (isHunting || isRaid) {
             return (
                 <div className="space-y-4">
                     {huntingMembers && (
                         <div>
                             <h4 className="text-green-400 font-bold mb-2">Twoja Drużyna</h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                 {huntingMembers.map((m, idx) => m.stats ? <CombatantStatsPanel key={idx} name={m.characterName} stats={m.stats} /> : null)}
                             </div>
                         </div>
                     )}
                     {opponents && (
                         <div>
                             <h4 className="text-red-400 font-bold mb-2">Przeciwnicy</h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                 {opponents.map((m, idx) => m.stats ? <CombatantStatsPanel key={idx} name={m.characterName} stats={m.stats} /> : null)}
                             </div>
                         </div>
                     )}
                     {!opponents && uniqueEnemies.length > 0 && (
                          <div>
                             <h4 className="text-red-400 font-bold mb-2">Przeciwnicy</h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                 {uniqueEnemies.map((e, idx) => <CombatantStatsPanel key={idx} name={e.name} stats={e.stats} />)}
                             </div>
                         </div>
                     )}
                 </div>
             )
        }
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="text-center text-gray-500 italic col-span-2">Statystyki szczegółowe dostępne w trybie PvP i Polowań.</div>
            </div>
        );
    };

    const modalStyle = backgroundImage 
        ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
        : {};

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative" 
                onClick={e => e.stopPropagation()}
                style={modalStyle}
            >
                {/* Overlay for readability */}
                <div className="absolute inset-0 bg-slate-900/90 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
                        <div>
                            <h2 className={`text-3xl font-extrabold ${isVictory ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'text-red-500'}`}>
                                {title}
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                {isPvp ? (
                                    <>
                                        {isVictory ? (isDefenderView ? t('pvp.defenseWon') : t('pvp.attackWon')) : (isDefenderView ? t('pvp.defenseLost') : t('pvp.attackLost'))}
                                    </>
                                ) : (
                                    bossName ? `Boss: ${bossName}` : t('expedition.combatReport')
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2">
                             {/* Tabs */}
                            <div className="flex bg-slate-800/80 rounded-lg p-1 mr-4">
                                <button onClick={() => setActiveTab('rewards')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'rewards' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Nagrody</button>
                                <button onClick={() => setActiveTab('log')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'log' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Log Walki</button>
                                <button onClick={() => setActiveTab('stats')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Statystyki</button>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-full">
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-6 custom-scrollbar relative">
                        {activeTab === 'rewards' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-amber-500/20 rounded-lg"><CoinsIcon className="h-6 w-6 text-amber-400" /></div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-widest">{t('resources.gold')}</p>
                                                <p className="text-2xl font-mono font-bold text-white">+{totalGold.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-sky-500/20 rounded-lg"><StarIcon className="h-6 w-6 text-sky-400" /></div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-widest">{t('expedition.experience')}</p>
                                                <p className="text-2xl font-mono font-bold text-white">+{totalExperience.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Items & Essences */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                                        <h4 className="text-sm font-bold text-gray-300 uppercase mb-3 border-b border-slate-700 pb-2">{t('expedition.itemsFound')}</h4>
                                        <div className="space-y-2">
                                            {itemsFound.length === 0 && <p className="text-gray-500 text-sm italic py-2">Brak przedmiotów.</p>}
                                            {itemsFound.map((item, index) => {
                                                const template = itemTemplates.find(t => t.id === item.templateId);
                                                if (!template) return null;
                                                return (
                                                    <div 
                                                        key={index} 
                                                        onMouseEnter={() => setHoveredItem({ item, template })}
                                                        onMouseLeave={() => setHoveredItem(null)}
                                                        className="relative"
                                                    >
                                                        <ItemListItem 
                                                            item={item} 
                                                            template={template} 
                                                            affixes={affixes} 
                                                            isSelected={false} 
                                                            onClick={() => {}} 
                                                            showPrimaryStat={false}
                                                            className="hover:bg-slate-700/50 cursor-help"
                                                        />
                                                    </div>
                                                );
                                            })}
                                            {itemsLostCount && itemsLostCount > 0 && (
                                                <p className="text-xs text-red-400 mt-2 bg-red-900/20 p-2 rounded border border-red-900/30">
                                                    {t('expedition.itemsLost', { count: itemsLostCount })}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                                        <h4 className="text-sm font-bold text-gray-300 uppercase mb-3 border-b border-slate-700 pb-2">{t('expedition.essencesFound')}</h4>
                                        <div className="space-y-2">
                                             {Object.entries(essencesFound).length === 0 && <p className="text-gray-500 text-sm italic py-2">Brak esencji.</p>}
                                             {Object.entries(essencesFound).map(([type, amount]) => (
                                                 <div key={type} className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                                                     <span className="text-gray-300 text-sm">{t(`resources.${type}`)}</span>
                                                     <span className="font-mono font-bold text-white">+{amount}</span>
                                                 </div>
                                             ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {allRewards && (
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <h4 className="text-sm font-bold text-gray-400 mb-2">Nagrody Pozostałych Graczy</h4>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            {Object.entries(allRewards).map(([name, rew]: [string, any]) => {
                                                if (name === characterName) return null;
                                                return (
                                                    <div key={name} className="flex justify-between">
                                                        <span>{name}</span>
                                                        <span>{rew.gold}g, {rew.experience}xp, {rew.items?.length || 0} it., {Object.values(rew.essences || {}).reduce((a:number,b:any)=>a+b, 0) as number} es.</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'log' && (
                            <div className="space-y-1 font-mono text-sm bg-black/30 p-4 rounded-lg animate-fade-in h-full overflow-y-auto custom-scrollbar">
                                {combatLog.map((log, index) => (
                                    <CombatLogRow key={index} log={log} characterName={characterName} isHunting={isHunting} huntingMembers={huntingMembers} />
                                ))}
                                {combatLog.length === 0 && <p className="text-gray-500 text-center">Brak wpisów w logu.</p>}
                            </div>
                        )}
                        
                        {activeTab === 'stats' && (
                            <div className="animate-fade-in">
                                {renderStatsTab()}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-700 bg-slate-900/50 backdrop-blur-md flex justify-end">
                        <button 
                            onClick={onClose} 
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105"
                        >
                            Zamknij Raport
                        </button>
                    </div>
                </div>
            </div>

            {/* Hover Item Tooltip */}
            {hoveredItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-none relative animate-fade-in">
                         <ItemDetailsPanel item={hoveredItem.item} template={hoveredItem.template} affixes={affixes} hideAffixes={false} size="small" compact={true} />
                    </div>
                </div>
            )}
        </div>
    );
};
