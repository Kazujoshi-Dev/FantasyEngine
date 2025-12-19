
import React from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';
import { ExpeditionRewardSummary, EssenceType, ItemRarity, ItemTemplate, Affix, ItemInstance } from '../../../types';
import { CoinsIcon } from '../../icons/CoinsIcon';
import { StarIcon } from '../../icons/StarIcon';
import { rarityStyles, getGrammaticallyCorrectFullName } from '../../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const PvpRewardsPanel: React.FC<{ isVictory: boolean, gold: number, experience: number }> = ({ isVictory, gold, experience }) => {
    const { t } = useTranslation();
    return (
        <div className={`p-4 rounded-xl border ${isVictory ? 'bg-green-900/30 border-green-500/50' : 'bg-red-900/30 border-red-500/50'} text-center`}>
            <h4 className={`text-xl font-bold mb-2 ${isVictory ? 'text-green-400' : 'text-red-400'}`}>
                {isVictory ? t('expedition.victory') : t('expedition.defeat')}
            </h4>
            <div className="flex justify-center gap-8">
                <div className="flex items-center gap-2">
                    <CoinsIcon className="h-5 w-5 text-amber-400" />
                    <span className="font-mono text-lg font-bold text-amber-400">{gold.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                    <StarIcon className="h-5 w-5 text-sky-400" />
                    <span className="font-mono text-lg font-bold text-sky-400">{experience.toLocaleString()} XP</span>
                </div>
            </div>
        </div>
    );
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
        <div className="bg-slate-900/80 p-4 rounded-xl border border-amber-600/30 mt-4 shadow-lg relative overflow-hidden group">
             <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-600/10 rounded-full blur-3xl group-hover:opacity-50 transition-all duration-500"></div>
             <h4 className="font-bold text-amber-500 text-sm text-center border-b border-amber-600/30 pb-2 mb-3 tracking-wider flex items-center justify-center gap-2">
                <CoinsIcon className="h-5 w-5" />
                Zrabowane z Banku Gildii
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {totalGold > 0 && (
                     <div className="flex flex-col items-center justify-center bg-slate-800/80 p-2 rounded-lg border border-amber-500/30 shadow-md col-span-2 md:col-span-1">
                        <span className="text-gray-400 text-[9px] uppercase tracking-widest mb-1">{t('resources.gold')}</span>
                        <span className="font-mono font-bold text-amber-400 flex items-center text-lg">
                            {totalGold.toLocaleString()}
                        </span>
                     </div>
                )}
                {Object.entries(essencesFound).map(([key, amount]) => {
                    const type = key as EssenceType;
                    const rarity = essenceToRarityMap[type];
                    const style = rarityStyles[rarity];
                    return (
                        <div key={key} className={`flex flex-col items-center justify-center bg-slate-800/60 p-2 rounded-lg border ${style.border} shadow-sm relative overflow-hidden`}>
                             <div className={`absolute inset-0 ${style.bg} opacity-10`}></div>
                             <span className={`${style.text} text-[9px] uppercase tracking-widest mb-1 z-10 text-center`}>{t(`resources.${type}`).replace(' Esencja', '')}</span>
                             <span className="font-mono font-bold text-white text-base z-10">x{amount}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export const StandardRewardsPanel: React.FC<{ 
    reward: ExpeditionRewardSummary, 
    itemTemplates: ItemTemplate[], 
    affixes: Affix[],
    onInspectItem: (data: { item: ItemInstance, template: ItemTemplate }) => void
}> = ({ reward, itemTemplates, affixes, onInspectItem }) => {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
            <div>
                <h3 className="text-base font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <StarIcon className="h-4 w-4 text-yellow-400"/> {t('expedition.totalRewards')}
                </h3>
                <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                        <span className="text-gray-400 font-bold text-xs">{t('expedition.goldGained')}</span>
                        <span className="text-amber-400 font-mono text-lg">{reward.totalGold.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                        <span className="text-gray-400 font-bold text-xs">{t('expedition.experience')}</span>
                        <span className="text-sky-400 font-mono text-lg">{reward.totalExperience.toLocaleString()} XP</span>
                    </div>
                    {Object.entries(reward.essencesFound).map(([key, amount]) => {
                        const type = key as EssenceType;
                        const rarity = essenceToRarityMap[type];
                        const style = rarityStyles[rarity];
                        return (
                            <div key={key} className={`flex justify-between items-center bg-slate-800/50 p-2 rounded border-l-2 ${style.border}`}>
                                <span className={`${style.text} font-bold text-[11px]`}>{t(`resources.${type}`)}</span>
                                <span className="text-white font-mono font-bold text-xs">x{amount}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div>
                <h3 className="text-base font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <CoinsIcon className="h-4 w-4 text-indigo-400"/> {t('expedition.itemsFound')}
                </h3>
                <div className="bg-slate-800/30 rounded-lg p-1.5 min-h-[80px] border border-slate-700/50">
                    {reward.itemsFound.length === 0 ? (
                        <p className="text-gray-600 text-center py-6 italic text-xs">{t('expedition.noEnemies')}</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {reward.itemsFound.map((item, idx) => {
                                const template = itemTemplates.find(t => t.id === item.templateId);
                                if (!template) return null;
                                const fullName = getGrammaticallyCorrectFullName(item, template, affixes);
                                const style = rarityStyles[template.rarity];
                                
                                return (
                                    <div 
                                        key={idx} 
                                        className="flex items-center gap-2 p-1 bg-slate-800/80 rounded border border-slate-700 hover:border-indigo-500 transition-colors cursor-pointer group"
                                        onClick={() => onInspectItem({ item, template })}
                                    >
                                        <div className={`w-8 h-8 rounded border ${style.border} ${style.bg} flex-shrink-0 flex items-center justify-center shadow-sm`}>
                                            {template.icon ? (
                                                <img src={template.icon} alt={template.name} className="w-6 h-6 object-contain" />
                                            ) : (
                                                <span className="text-[9px] font-bold text-white">?</span>
                                            )}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className={`text-[11px] font-bold truncate ${style.text}`}>{fullName}</p>
                                            <p className="text-[8px] text-gray-500 uppercase leading-none">{t(`equipment.slot.${template.slot}`)}</p>
                                        </div>
                                        <div className="text-[9px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            INFO
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
