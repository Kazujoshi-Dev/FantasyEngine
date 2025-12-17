
import React, { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { ItemInstance, EssenceType, ItemTemplate, ItemRarity } from '../../types';
import { StarIcon } from '../icons/StarIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { rarityStyles, ItemListItem, ItemDetailsPanel } from '../shared/ItemSlot';

interface TowerSummaryProps {
    outcome: 'VICTORY' | 'DEFEAT' | 'RETREAT';
    rewards: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
    };
    onClose: () => void;
    itemTemplates: ItemTemplate[];
    affixes: any[];
}

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const TowerSummaryView: React.FC<TowerSummaryProps> = ({ outcome, rewards, onClose, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const title = outcome === 'VICTORY' ? 'Wieża Ukończona!' : outcome === 'RETREAT' ? 'Ucieczka z Wieży' : 'Porażka';
    const titleColor = outcome === 'VICTORY' ? 'text-green-400' : outcome === 'RETREAT' ? 'text-amber-400' : 'text-red-500';
    const subTitle = outcome === 'DEFEAT' 
        ? 'Twoja wyprawa kończy się tutaj. Straciłeś wszystkie zgromadzone łupy.'
        : 'Oto łupy, które udało Ci się wynieść z Wieży Mroku.';

    return (
        <div className="flex flex-col h-full items-center justify-center animate-fade-in p-4 relative z-10">
             {/* Tooltip Overlay */}
             {hoveredItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-auto relative animate-fade-in">
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
                <h2 className={`text-4xl font-extrabold ${titleColor} mb-2 uppercase tracking-wider`}>{title}</h2>
                <p className="text-gray-400 mb-8 text-center">{subTitle}</p>

                {outcome !== 'DEFEAT' && (
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {/* Resources Column */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                                <StarIcon className="h-5 w-5 text-yellow-400"/> Zasoby
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded">
                                    <span className="text-gray-400 font-bold">{t('resources.gold')}</span>
                                    <span className="text-amber-400 font-mono text-xl">{rewards.gold.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded">
                                    <span className="text-gray-400 font-bold">Doświadczenie</span>
                                    <span className="text-sky-400 font-mono text-xl">{rewards.experience.toLocaleString()} XP</span>
                                </div>
                                {Object.entries(rewards.essences).map(([key, amount]) => {
                                     const type = key as EssenceType;
                                     const rarity = essenceToRarityMap[type];
                                     const style = rarityStyles[rarity];
                                     return (
                                        <div key={key} className={`flex justify-between items-center bg-slate-900/50 p-3 rounded border-l-4 ${style.border}`}>
                                            <span className={`${style.text} font-bold text-sm`}>{t(`resources.${type}`)}</span>
                                            <span className="text-white font-mono font-bold">x{amount as number}</span>
                                        </div>
                                     )
                                })}
                            </div>
                        </div>

                        {/* Items Column */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 flex flex-col">
                            <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                                <ShieldIcon className="h-5 w-5 text-indigo-400"/> Przedmioty ({rewards.items.length})
                            </h3>
                            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                                {rewards.items.length === 0 ? (
                                    <p className="text-gray-500 italic text-center py-10">Brak przedmiotów.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {rewards.items.map((item) => {
                                            const template = itemTemplates.find(t => t.id === item.templateId);
                                            if (!template) return null;
                                            return (
                                                <div 
                                                    key={item.uniqueId} 
                                                    className="relative group cursor-help bg-slate-900/80 p-1 rounded hover:bg-slate-800 transition-colors"
                                                    onMouseEnter={() => setHoveredItem({ item, template })}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                >
                                                    <ItemListItem 
                                                        item={item} 
                                                        template={template} 
                                                        affixes={affixes} 
                                                        isSelected={false} 
                                                        onClick={()=>{}} 
                                                        showPrimaryStat={false} 
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
                >
                    Wróć do Miasta
                </button>
            </div>
        </div>
    );
};
