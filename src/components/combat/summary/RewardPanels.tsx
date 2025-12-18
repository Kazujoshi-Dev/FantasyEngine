import React from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';
import { ExpeditionRewardSummary, EssenceType, ItemRarity, ItemTemplate, Affix } from '../../../types';
import { CoinsIcon } from '../../icons/CoinsIcon';
import { StarIcon } from '../../icons/StarIcon';
import { rarityStyles, ItemTooltip } from '../../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const RaidRewardsPanel: React.FC<{ totalGold: number, essencesFound: Partial<Record<EssenceType, number>>, isVictory?: boolean }> = ({ totalGold, essencesFound, isVictory = true }) => {
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

    const headerColor = isVictory ? 'text-amber-500' : 'text-red-500';
    const borderColor = isVictory ? 'border-amber-600/30' : 'border-red-600/40';

    return (
        <div className={`bg-slate-900/80 p-6 rounded-xl border ${borderColor} mt-4 shadow-lg relative overflow-hidden group`}>
             <div className={`absolute -right-10 -top-10 w-32 h-32 ${isVictory ? 'bg-amber-600/10' : 'bg-red-600/10'} rounded-full blur-3xl group-hover:opacity-50 transition-all duration-500`}></div>
             <h4 className={`font-bold text-xl text-center border-b ${borderColor} pb-3 mb-5 ${headerColor} tracking-wider flex items-center justify-center gap-2`}>
                <CoinsIcon className="h-6 w-6" />
                {isVictory ? 'Zrabowane z Banku Gildii' : 'Utracone z Banku Gildii'}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {totalGold > 0 && (
                     <div className={`flex flex-col items-center justify-center bg-slate-800/80 p-3 rounded-lg border ${isVictory ? 'border-amber-500/30' : 'border-red-500/30'} shadow-md col-span-2 md:col-span-1`}>
                        <span className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">{t('resources.gold')}</span>
                        <span className={`font-mono font-bold ${isVictory ? 'text-amber-400' : 'text-red-400'} flex items-center text-2xl`}>
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
                             <span className={`font-mono font-bold ${isVictory ? 'text-white' : 'text-red-400'} text-xl z-10`}>x{amount}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export const StandardRewardsPanel: React.FC<{ reward: ExpeditionRewardSummary, itemTemplates: ItemTemplate[], affixes: Affix[] }> = ({ reward, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-900/60 p-6 rounded-xl border border-slate-700/50">
            <div>
                <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                    <StarIcon className="h-5 w-5 text-yellow-400"/> {t('expedition.totalRewards')}
                </h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded">
                        <span className="text-gray-400 font-bold">{t('expedition.goldGained')}</span>
                        <span className="text-amber-400 font-mono text-xl">{reward.totalGold.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded">
                        <span className="text-gray-400 font-bold">{t('expedition.experience')}</span>
                        <span className="text-sky-400 font-mono text-xl">{reward.totalExperience.toLocaleString()} XP</span>
                    </div>
                    {Object.entries(reward.essencesFound).map(([key, amount]) => {
                        const type = key as EssenceType;
                        const rarity = essenceToRarityMap[type];
                        const style = rarityStyles[rarity];
                        return (
                            <div key={key} className={`flex justify-between items-center bg-slate-800/50 p-3 rounded border-l-4 ${style.border}`}>
                                <span className={`${style.text} font-bold text-sm`}>{t(`resources.${type}`)}</span>
                                <span className="text-white font-mono font-bold">x{amount}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                    <CoinsIcon className="h-5 w-5 text-indigo-400"/> {t('expedition.itemsFound')}
                </h3>
                <div className="bg-slate-800/30 rounded-lg p-2 min-h-[100px] border border-slate-700/50">
                    {reward.itemsFound.length === 0 ? (
                        <p className="text-gray-600 text-center py-8 italic text-sm">{t('expedition.noEnemies')}</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {reward.itemsFound.map((item, idx) => {
                                const template = itemTemplates.find(t => t.id === item.templateId);
                                if (!template) return null;
                                return (
                                    <div key={idx} className="relative group cursor-help">
                                        <div className={`w-12 h-12 rounded border-2 ${rarityStyles[template.rarity].border} ${rarityStyles[template.rarity].bg} flex items-center justify-center shadow-lg transition-transform hover:scale-110`}>
                                            {template.icon ? (
                                                <img src={template.icon} alt={template.name} className="w-10 h-10 object-contain" />
                                            ) : (
                                                <span className="text-xs font-bold text-white">?</span>
                                            )}
                                        </div>
                                        <ItemTooltip instance={item} template={template} affixes={affixes} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {reward.itemsLostCount && (
                        <p className="text-red-400 text-xs mt-3 font-bold px-2">{t('expedition.itemsLost', { count: reward.itemsLostCount })}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
