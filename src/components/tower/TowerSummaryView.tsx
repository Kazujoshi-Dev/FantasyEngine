
import React, { useState } from 'react';
import { ItemInstance, EssenceType, ItemTemplate, Affix, ItemRarity } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles } from '../shared/ItemSlot';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';

interface TowerSummaryViewProps {
    outcome: 'VICTORY' | 'DEFEAT' | 'RETREAT';
    rewards: { gold: number, experience: number, items: ItemInstance[], essences: any };
    onClose: () => void;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
}

export const TowerSummaryView: React.FC<TowerSummaryViewProps> = ({ outcome, rewards, onClose, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const isVictory = outcome === 'VICTORY';
    const isRetreat = outcome === 'RETREAT';
    
    const title = isVictory ? 'Zwycięstwo!' : isRetreat ? 'Ucieczka z Wieży' : 'Porażka!';
    const titleColor = isVictory ? 'text-amber-400' : isRetreat ? 'text-indigo-400' : 'text-red-500';
    const desc = isVictory 
        ? 'Ukończyłeś Wieżę Mroku i zdobyłeś wszystkie nagrody!' 
        : isRetreat 
            ? 'Udało Ci się uciec z łupami.'
            : 'Zostałeś pokonany i straciłeś wszystkie łupy z tej wyprawy.';

    const essenceToRarityMap: Record<EssenceType, any> = {
        [EssenceType.Common]: rarityStyles['Common'],
        [EssenceType.Uncommon]: rarityStyles['Uncommon'],
        [EssenceType.Rare]: rarityStyles['Rare'],
        [EssenceType.Epic]: rarityStyles['Epic'],
        [EssenceType.Legendary]: rarityStyles['Legendary'],
    };

    return (
        <div className="flex flex-col h-full items-center justify-center animate-fade-in p-4 relative z-10">
             {/* Tooltip Overlay */}
             {hoveredItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-none relative animate-fade-in">
                         <ItemDetailsPanel 
                            item={hoveredItem.item} 
                            template={hoveredItem.template} 
                            affixes={affixes} 
                            size="small"
                            compact={true}
                         />
                    </div>
                </div>
            )}

            <div className="bg-slate-900/90 border border-slate-700 p-8 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col items-center backdrop-blur-md">
                <h2 className={`text-4xl font-extrabold ${titleColor} mb-4 uppercase tracking-widest drop-shadow-lg`}>{title}</h2>
                <p className="text-gray-300 text-lg mb-8 text-center">{desc}</p>
                
                {(isVictory || isRetreat) && (
                    <div className="w-full bg-slate-800/50 rounded-xl p-6 border border-slate-600/50 mb-8">
                        <h3 className="text-xl font-bold text-white mb-4 text-center border-b border-slate-600 pb-2">Zdobyte Nagrody</h3>
                        
                        <div className="flex justify-center gap-8 mb-6">
                            <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-sm uppercase tracking-wider mb-1">Złoto</span>
                                <span className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                                    {rewards.gold.toLocaleString()} <CoinsIcon className="h-6 w-6"/>
                                </span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-400 text-sm uppercase tracking-wider mb-1">Doświadczenie</span>
                                <span className="text-2xl font-bold text-sky-400 flex items-center gap-2">
                                    {rewards.experience.toLocaleString()} <StarIcon className="h-6 w-6"/>
                                </span>
                            </div>
                        </div>

                        {/* Essences */}
                        {rewards.essences && Object.keys(rewards.essences).length > 0 && (
                             <div className="flex flex-wrap justify-center gap-3 mb-6">
                                 {Object.entries(rewards.essences).map(([key, val]) => (
                                     <span key={key} className={`px-3 py-1 rounded bg-slate-900 border border-slate-700 ${essenceToRarityMap[key as EssenceType]?.text}`}>
                                         {val as number}x {t(`resources.${key}`)}
                                     </span>
                                 ))}
                             </div>
                        )}

                        {/* Items */}
                        {rewards.items.length > 0 && (
                            <div>
                                <p className="text-center text-gray-500 text-sm uppercase tracking-wider mb-3">Przedmioty</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-2">
                                    {rewards.items.map((item, idx) => {
                                        const template = itemTemplates.find(t => t.id === item.templateId);
                                        if (!template) return null;
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`bg-slate-900 p-2 rounded border cursor-help hover:bg-slate-800 transition-colors ${rarityStyles[template.rarity].border}`}
                                                onMouseEnter={() => setHoveredItem({ item, template })}
                                                onMouseLeave={() => setHoveredItem(null)}
                                            >
                                                <p className={`font-bold text-sm truncate ${rarityStyles[template.rarity].text}`}>
                                                    {template.name} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}
                                                </p>
                                                <p className="text-xs text-gray-500">{t(`item.slot.${template.slot}`)}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                <button 
                    onClick={onClose} 
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold text-lg shadow-lg transition-transform hover:scale-105"
                >
                    Powrót do Obozu
                </button>
            </div>
        </div>
    );
};
