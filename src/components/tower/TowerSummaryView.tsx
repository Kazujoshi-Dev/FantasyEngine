
import React, { useState } from 'react';
import { ItemInstance, ItemTemplate, Affix, EssenceType } from '../../types';
import { ItemDetailsPanel, rarityStyles } from '../shared/ItemSlot';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { useTranslation } from '../../contexts/LanguageContext';

interface TowerSummaryViewProps {
    outcome: 'VICTORY' | 'DEFEAT' | 'RETREAT';
    rewards: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: any;
    };
    onClose: () => void;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
}

export const TowerSummaryView: React.FC<TowerSummaryViewProps> = ({ outcome, rewards, onClose, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const title = outcome === 'VICTORY' ? 'Zwycięstwo!' : outcome === 'RETREAT' ? 'Ucieczka z Wieży' : 'Porażka';
    const titleColor = outcome === 'VICTORY' ? 'text-amber-400' : outcome === 'RETREAT' ? 'text-sky-400' : 'text-red-500';
    const message = outcome === 'VICTORY' 
        ? 'Gratulacje! Ukończyłeś Wieżę Mroku i zdobyłeś wspaniałe nagrody.' 
        : outcome === 'RETREAT'
        ? 'Udało Ci się uciec z łupami, zanim było za późno.'
        : 'Zostałeś pokonany. Wszystkie zgromadzone łupy przepadły.';

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
                <h2 className={`text-4xl font-extrabold mb-4 uppercase tracking-widest ${titleColor} drop-shadow-md text-center`}>{title}</h2>
                <p className="text-gray-300 text-center mb-8 max-w-lg">{message}</p>
                
                {outcome !== 'DEFEAT' && (
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {/* Resources */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex flex-col justify-center">
                            <h3 className="text-xl font-bold text-gray-200 mb-4 border-b border-slate-700 pb-2">Zasoby</h3>
                            <div className="space-y-3">
                                {rewards.gold > 0 && (
                                    <div className="flex justify-between items-center text-lg">
                                        <span className="text-gray-400">{t('resources.gold')}</span>
                                        <span className="font-mono font-bold text-amber-400 flex items-center gap-2">+{rewards.gold} <CoinsIcon className="h-5 w-5"/></span>
                                    </div>
                                )}
                                {rewards.experience > 0 && (
                                    <div className="flex justify-between items-center text-lg">
                                        <span className="text-gray-400">{t('expedition.experience')}</span>
                                        <span className="font-mono font-bold text-sky-400 flex items-center gap-2">+{rewards.experience} <StarIcon className="h-5 w-5"/></span>
                                    </div>
                                )}
                                {Object.entries(rewards.essences || {}).map(([key, val]) => {
                                    if (!val) return null;
                                    const style = essenceToRarityMap[key as EssenceType];
                                    return (
                                        <div key={key} className="flex justify-between items-center text-sm">
                                            <span className={style.text}>{t(`resources.${key}`)}</span>
                                            <span className="font-mono font-bold text-white">+{val as number}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Items */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                             <h3 className="text-xl font-bold text-gray-200 mb-4 border-b border-slate-700 pb-2">Przedmioty ({rewards.items.length})</h3>
                             <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                 {rewards.items.length === 0 && <p className="text-gray-500 italic text-center py-4">Brak przedmiotów.</p>}
                                 {rewards.items.map((item, idx) => {
                                     const template = itemTemplates.find(t => t.id === item.templateId);
                                     if (!template) return null;
                                     const style = rarityStyles[template.rarity];
                                     return (
                                         <div 
                                            key={idx}
                                            onMouseEnter={() => setHoveredItem({ item, template })}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className="flex items-center gap-3 p-2 rounded bg-slate-900/50 border border-slate-700 hover:border-slate-500 transition-colors cursor-help"
                                        >
                                             {template.icon && <img src={template.icon} className="w-8 h-8 rounded bg-slate-800 object-contain" />}
                                             <div className="overflow-hidden">
                                                 <p className={`font-bold text-sm truncate ${style.text}`}>{template.name} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}</p>
                                                 <p className="text-[10px] text-gray-500">{t(`rarity.${template.rarity}`)}</p>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                        </div>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl shadow-xl transition-transform hover:scale-105"
                >
                    {t('expedition.returnToCamp')}
                </button>
            </div>
        </div>
    );
};
