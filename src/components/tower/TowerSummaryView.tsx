
import React, { useState } from 'react';
import { ItemInstance, ItemTemplate, Affix, EssenceType } from '../../types';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { ItemDetailsPanel, ItemListItem, rarityStyles } from '../shared/ItemSlot';
import { useTranslation } from '../../contexts/LanguageContext';

interface TowerSummaryViewProps {
    outcome: 'VICTORY' | 'DEFEAT' | 'RETREAT';
    rewards: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
    };
    onClose: () => void;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
}

export const TowerSummaryView: React.FC<TowerSummaryViewProps> = ({ outcome, rewards, onClose, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const titleColor = outcome === 'VICTORY' ? 'text-green-400' : outcome === 'DEFEAT' ? 'text-red-500' : 'text-amber-400';
    const titleText = outcome === 'VICTORY' ? 'Wieża Ukończona!' : outcome === 'DEFEAT' ? 'Porażka!' : 'Ucieczka z Wieży';
    const descText = outcome === 'VICTORY' ? 'Gratulacje! Przetrwałeś wszystkie piętra i zdobyłeś główną nagrodę.' 
                 : outcome === 'DEFEAT' ? 'Zostałeś pokonany. Wszystkie zdobyte łupy przepadły.' 
                 : 'Zdecydowałeś się uciec, zachowując dotychczasowe łupy.';

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
                <h2 className={`text-4xl font-extrabold mb-2 ${titleColor} drop-shadow-md`}>{titleText}</h2>
                <p className="text-gray-400 mb-8 text-center">{descText}</p>

                {outcome !== 'DEFEAT' && (
                    <div className="w-full space-y-6">
                        {/* Currency Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-amber-500/20 rounded-lg"><CoinsIcon className="h-6 w-6 text-amber-400" /></div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-widest">{t('resources.gold')}</p>
                                        <p className="text-2xl font-mono font-bold text-white">+{rewards.gold.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-sky-500/20 rounded-lg"><StarIcon className="h-6 w-6 text-sky-400" /></div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-widest">{t('expedition.experience')}</p>
                                        <p className="text-2xl font-mono font-bold text-white">+{rewards.experience.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items & Essences */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 h-64 flex flex-col">
                                <h4 className="text-sm font-bold text-gray-300 uppercase mb-3 border-b border-slate-700 pb-2">{t('expedition.itemsFound')} ({rewards.items.length})</h4>
                                <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {rewards.items.length === 0 && <p className="text-gray-500 text-sm italic py-2">Brak przedmiotów.</p>}
                                    {rewards.items.map((item, index) => {
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
                                </div>
                            </div>

                            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 h-64 flex flex-col">
                                <h4 className="text-sm font-bold text-gray-300 uppercase mb-3 border-b border-slate-700 pb-2">{t('expedition.essencesFound')}</h4>
                                <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {Object.entries(rewards.essences).length === 0 && <p className="text-gray-500 text-sm italic py-2">Brak esencji.</p>}
                                        {Object.entries(rewards.essences).map(([type, amount]) => (
                                            <div key={type} className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                                                <span className="text-gray-300 text-sm">{t(`resources.${type}`)}</span>
                                                <span className="font-mono font-bold text-white">+{amount}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <button 
                    onClick={onClose} 
                    className="mt-8 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all transform hover:scale-105"
                >
                    Powrót do Obozu
                </button>
            </div>
        </div>
    );
};
