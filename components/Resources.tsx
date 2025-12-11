
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, EssenceType, ItemRarity } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { rarityStyles } from './shared/ItemSlot';
import { SparklesIcon } from './icons/SparklesIcon';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

const conversionCosts: Record<EssenceType, number> = {
    [EssenceType.Common]: 100,
    [EssenceType.Uncommon]: 250,
    [EssenceType.Rare]: 500,
    [EssenceType.Epic]: 1000,
    [EssenceType.Legendary]: 0
};

export const Resources: React.FC = () => {
  const { character, updateCharacter } = useCharacter();
  const { t } = useTranslation();
  const [isConverting, setIsConverting] = useState(false);

  if (!character) return null;

  const essenceOrder = Object.values(EssenceType) as EssenceType[];
  const hasAlchemySkill = (character.learnedSkills || []).includes('podstawy-alchemii');

  const handleConvert = async (fromType: EssenceType) => {
      if (isConverting) return;
      
      const cost = conversionCosts[fromType];
      if ((character.resources[fromType] || 0) < 5) {
          alert('Potrzebujesz 5 esencji tego typu, aby dokonać konwersji.');
          return;
      }
      if (character.resources.gold < cost) {
          alert('Brak złota.');
          return;
      }

      setIsConverting(true);
      try {
          const updatedChar = await api.convertEssence(fromType);
          updateCharacter(updatedChar);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsConverting(false);
      }
  };

  return (
    <ContentPanel title={t('resources.title')}>
      <div className="bg-slate-900/40 p-6 rounded-xl space-y-4 animate-fade-in">
         <div className="flex items-center justify-between py-4 px-6 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center space-x-4">
                <CoinsIcon className="h-10 w-10 text-amber-400" />
                <span className="text-xl font-semibold text-gray-300">{t('resources.gold')}</span>
            </div>
            <span className="font-mono text-3xl font-bold text-amber-400 text-shadow-sm">
                {(character.resources?.gold || 0).toLocaleString()}
            </span>
         </div>

         <div className="border-t border-slate-700/50 pt-4">
            <div className="flex justify-between items-center px-4 mb-4">
                <h3 className="text-xl font-semibold text-gray-300">{t('resources.essences')}</h3>
                {hasAlchemySkill && (
                    <span className="px-3 py-1 bg-fuchsia-900/30 border border-fuchsia-500/30 rounded-full text-xs text-fuchsia-300 flex items-center gap-2 font-bold shadow-[0_0_10px_rgba(232,121,249,0.2)]">
                        <SparklesIcon className="h-4 w-4"/> {t('resources.alchemyActive')}
                    </span>
                )}
            </div>
            
            <div className="space-y-2">
                 {essenceOrder.map(essenceKey => {
                     const rarity = essenceToRarityMap[essenceKey];
                     const colorClass = rarityStyles[rarity]?.text || 'text-gray-300';
                     const canConvert = hasAlchemySkill && essenceKey !== EssenceType.Legendary;
                     const cost = conversionCosts[essenceKey];
                     
                     // Check affordability for visual feedback
                     const canAfford = (character.resources[essenceKey] || 0) >= 5 && character.resources.gold >= cost;

                     return (
                         <div key={essenceKey} className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700">
                            <span className={`text-lg font-semibold ${colorClass}`}>{t(`resources.${essenceKey}`)}</span>
                            
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-xl font-bold text-white">
                                    {(character.resources?.[essenceKey] || 0).toLocaleString()}
                                </span>
                                
                                {canConvert && (
                                    <button
                                        onClick={() => handleConvert(essenceKey)}
                                        disabled={isConverting || !canAfford}
                                        className={`p-2 rounded transition-all duration-200 flex items-center justify-center
                                            ${canAfford 
                                                ? 'bg-slate-700 hover:bg-fuchsia-700 text-fuchsia-300 hover:text-white shadow-lg hover:shadow-fuchsia-500/20' 
                                                : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                            }
                                        `}
                                        title={canAfford 
                                            ? `Konwertuj 5x ${t(`resources.${essenceKey}`)} na 1x wyższą (Koszt: ${cost} złota)` 
                                            : `Wymagane: 5x ${t(`resources.${essenceKey}`)} + ${cost} złota`
                                        }
                                    >
                                        <SparklesIcon className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                         </div>
                     )
                 })}
            </div>

            {hasAlchemySkill && (
                <div className="mt-8 bg-slate-800/80 p-4 rounded-lg border border-fuchsia-900/30 shadow-inner">
                    <p className="text-sm text-fuchsia-300 font-bold mb-3 flex items-center gap-2 border-b border-fuchsia-900/30 pb-2">
                        <SparklesIcon className="h-4 w-4"/> Legenda Transmutacji (Ratio 5:1)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
                        <div className="flex justify-between bg-slate-900/50 p-2 rounded">
                            <span>Zwykła &rarr; Niezwykła</span>
                            <span className="text-amber-400 font-mono">100g</span>
                        </div>
                        <div className="flex justify-between bg-slate-900/50 p-2 rounded">
                            <span>Niezwykła &rarr; Rzadka</span>
                            <span className="text-amber-400 font-mono">250g</span>
                        </div>
                        <div className="flex justify-between bg-slate-900/50 p-2 rounded">
                            <span>Rzadka &rarr; Epicka</span>
                            <span className="text-amber-400 font-mono">500g</span>
                        </div>
                        <div className="flex justify-between bg-slate-900/50 p-2 rounded">
                            <span>Epicka &rarr; Legendarna</span>
                            <span className="text-amber-400 font-mono">1000g</span>
                        </div>
                    </div>
                </div>
            )}
         </div>
      </div>
    </ContentPanel>
  );
};
