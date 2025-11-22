
import React from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, EssenceType, ItemRarity } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { rarityStyles } from './shared/ItemSlot';

interface ResourcesProps {
  character: PlayerCharacter;
}

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const Resources: React.FC<ResourcesProps> = ({ character }) => {
  const { t } = useTranslation();
  
  const essenceOrder = Object.values(EssenceType);

  return (
    <ContentPanel title={t('resources.title')}>
      <div className="bg-slate-900/40 p-6 rounded-xl space-y-4">
         <div className="flex items-center justify-between py-2 px-4">
            <div className="flex items-center space-x-4">
                <CoinsIcon className="h-8 w-8 text-amber-400" />
                <span className="text-xl font-semibold text-gray-300">{t('resources.gold')}</span>
            </div>
            <span className="font-mono text-2xl font-bold text-amber-400">
                {(character.resources?.gold || 0).toLocaleString()}
            </span>
         </div>

         <div className="border-t border-slate-700/50 pt-4">
            <h3 className="text-xl font-semibold text-gray-300 px-4 mb-2">{t('resources.essences')}</h3>
            <div className="space-y-1">
                 {essenceOrder.map(essenceKey => {
                     const rarity = essenceToRarityMap[essenceKey];
                     const colorClass = rarityStyles[rarity]?.text || 'text-gray-300';
                     return (
                         <div key={essenceKey} className="flex items-center justify-between py-2 px-4 rounded-lg hover:bg-slate-800/50">
                            <span className={`text-lg font-semibold ${colorClass}`}>{t(`resources.${essenceKey}`)}</span>
                            <span className="font-mono text-xl font-bold text-white">
                                {(character.resources?.[essenceKey] || 0).toLocaleString()}
                            </span>
                         </div>
                     )
                 })}
            </div>
         </div>
      </div>
    </ContentPanel>
  );
};