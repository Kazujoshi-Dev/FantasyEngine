
import React, { useState } from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';
import { EssenceType, ItemRarity, ExpeditionRewardSummary, ItemTemplate, Affix, ItemInstance } from '../../../types';
import { CoinsIcon } from '../../icons/CoinsIcon';
import { StarIcon } from '../../icons/StarIcon';
import { ShieldIcon } from '../../icons/ShieldIcon';
import { rarityStyles, getGrammaticallyCorrectFullName, ItemDetailsPanel } from '../../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const RaidRewardsPanel: React.FC<{ totalGold: number, essencesFound: Partial<Record<EssenceType, number>> }> = ({ totalGold, essencesFound }) => {
    const { t } = useTranslation();
    const hasLoot = totalGold > 0 || Object.keys(essencesFound).length > 0;

    if (!hasLoot) {
        return (
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mt-4 text-center">
                <h4 className="font-bold text-gray-500 text-lg mb-1">Brak łupów</h4>
                <p className="text-xs text-gray-600">Sparing lub pusty bank przeciwnika.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/80 p-6 rounded-xl border border-amber-600/40 mt-4 shadow-lg relative overflow-hidden group">
             <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-600/10 rounded-full blur-3xl group-hover:bg-amber-600/20 transition-all duration-500"></div>
             <h4 className="font-bold text-xl text-center border-b border-amber-600/30 pb-3 mb-5 text-amber-500 tracking-wider flex items-center justify-center gap-2">
                <CoinsIcon className="h-6 w-6" />
                Zrabowane z Banku Gildii
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {totalGold > 0 && (
                     <div className="flex flex-col items-center justify-center bg-slate-800/80 p-3 rounded-lg border border-amber-500/30 shadow-md col-span-2 md:col-span-1">
                        <span className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">{t('resources.gold')}</span>
                        <span className="font-mono font-bold text-amber-400 flex items-center text-2xl">
                            {totalGold.toLocaleString()}
                        </span>
                     </div>
                )}
                {Object.entries(essencesFound).map(([key, amount]) => {
                    const type = key as EssenceType;
                    const rarity = essenceToRarityMap[type];
                    const style = rarityStyles[rarity];
                    return (
                        <div key={key} className={`flex flex-col items-center justify-center bg-slate-800/60 p-3 rounded-lg border ${style.border} shadow-sm relative overflow-hidden`}>
                             <div className={`absolute inset-0 ${style.bg} opacity-10`}></div>
                             <span className={`${style.text} text-[10px] uppercase tracking-widest mb-1 z-10 text-center`}>{t(`resources.${type}`).replace(' Esencja', '')}</span>
                             <span className="font-mono font-bold text-white text-xl z-10">x{amount}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export const StandardRewardsPanel: React.FC<{ 
    reward: ExpeditionRewardSummary; 
    itemTemplates: ItemTemplate[]; 
    affixes: Affix[];
}> = ({ reward, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const { totalGold, totalExperience, itemsFound, essencesFound } = reward;
    const [hoveredItem, setHoveredItem] = useState<{item: ItemInstance, template: ItemTemplate} | null>(null);

    if (totalGold <= 0 && totalExperience <= 0 && itemsFound.length === 0 && Object.keys(essencesFound).length === 0) return null;

    return (
        <div className="bg-slate-900/80 p-6 rounded-xl border border-green-500/30 mt-4 shadow-lg relative">
             <h4 className="font-bold text-2xl text-center border-b border-green-500/50 pb-3 mb-6 text-green-400 tracking-wider">
                {t('expedition.totalRewards')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col gap-6 justify-center">
                    {totalGold > 0 && (
                        <div className="bg-slate-800/60 p-4 rounded-lg text-center border border-amber-500/20">
                            <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">{t('resources.gold')} i {t('expedition.experience')}</p>
                            <p className="font-mono font-bold text-amber-400 flex justify-center items-center text-2xl mb-1">
                                +{totalGold.toLocaleString()} <CoinsIcon className="h-6 w-6 ml-2"/>
                            </p>
                             {totalExperience > 0 && (
                                <p className="font-mono font-bold text-sky-400 flex justify-center items-center text-2xl">
                                    +{totalExperience.toLocaleString()} <span className="text-sm ml-2">XP</span>
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50">
                    <p className="text-center text-gray-400 text-xs uppercase tracking-widest mb-4">{t('expedition.itemsFound')} ({itemsFound.length})</p>
                    {itemsFound.length === 0 && <p className="text-gray-600 italic text-sm py-4 text-center">Brak</p>}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {itemsFound.map((item, idx) => {
                            const template = itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            const fullName = getGrammaticallyCorrectFullName(item, template, affixes);
                            const rarityColor = rarityStyles[template.rarity].text;
                            const rarityBg = rarityStyles[template.rarity].bg;
                            const rarityBorder = rarityStyles[template.rarity].border;
                            return (
                                <div 
                                    key={idx} 
                                    className={`cursor-help px-3 py-2 rounded-lg border ${rarityBorder} ${rarityBg}/30 hover:${rarityBg}/50 transition-all duration-200`}
                                    onMouseEnter={() => setHoveredItem({ item, template })}
                                    onMouseLeave={() => setHoveredItem(null)}
                                >
                                    <span className={`font-bold text-sm ${rarityColor}`}>{fullName}</span>
                                </div>
                            );
                        })}
                    </div>
                    {reward.itemsLostCount && <p className="text-xs text-red-400 mt-4 text-center font-bold">{t('expedition.itemsLost', { count: reward.itemsLostCount })}</p>}
                </div>
                <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50">
                    <p className="text-center text-gray-400 text-xs uppercase tracking-widest mb-4">{t('expedition.essencesFound')}</p>
                    {Object.keys(essencesFound).length === 0 && <p className="text-gray-600 italic text-sm text-center py-4">Brak</p>}
                    <div className="space-y-2">
                        {Object.entries(essencesFound).map(([key, amount]) => {
                             const type = key as EssenceType;
                             const rarity = essenceToRarityMap[type];
                             return (
                                 <div key={key} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700">
                                      <span className={`${rarityStyles[rarity].text} font-medium text-sm`}>{t(`resources.${type}`)}</span>
                                      <span className="font-mono font-bold text-white">+{amount}</span>
                                 </div>
                             )
                        })}
                    </div>
                </div>
            </div>
            {hoveredItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-auto relative animate-fade-in">
                         <ItemDetailsPanel item={hoveredItem.item} template={hoveredItem.template} affixes={affixes} hideAffixes={false} size="small" />
                    </div>
                </div>
            )}
        </div>
    );
};
