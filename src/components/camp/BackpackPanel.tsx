
import React, { useState } from 'react';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { useTranslation } from '../../contexts/LanguageContext';
import { useCharacter } from '../../contexts/CharacterContext';
import { api } from '../../api';
import { getBackpackUpgradeCost } from '../../logic/stats';
import { rarityStyles } from '../shared/ItemSlot';
import { EssenceType, ItemRarity } from '../../types';

const getBackpackCapacity = (level: number) => 40 + (level - 1) * 10;

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const BackpackPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [isUpgrading, setIsUpgrading] = useState(false);
    
    if (!character || !baseCharacter) return null;

    const backpackLevel = character.backpack?.level || 1;
    const capacity = getBackpackCapacity(backpackLevel);
    const upgradeCost = getBackpackUpgradeCost(backpackLevel);
    const maxLevel = 10;
    const isMaxLevel = backpackLevel >= maxLevel;
    const canAffordUpgrade = !isMaxLevel && (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const onUpgradeBackpack = async () => {
        setIsUpgrading(true);
        try {
            const updatedChar = await api.upgradeBackpack();
            updateCharacter(updatedChar);
        } catch (e: any) { 
            alert(e.message || t('error.title')); 
        } finally {
            setIsUpgrading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full animate-fade-in">
             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col justify-center items-center border border-slate-700/30">
                <BriefcaseIcon className="h-16 w-16 text-indigo-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">{t('camp.backpackTitle')}</h3>
                <p className="text-lg text-gray-400">{t('camp.backpackLevel')}: <span className="text-white font-bold">{backpackLevel} / {maxLevel}</span></p>
                <p className="text-lg text-gray-400">{t('camp.backpackCapacity')}: <span className="text-white font-bold">{capacity}</span></p>
             </div>

             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30">
                <h3 className="text-xl font-bold text-gray-300 mb-6 flex items-center">
                    {t('camp.upgradeBackpack')}
                </h3>

                {isMaxLevel ? (
                     <div className="flex-grow flex flex-col items-center justify-center text-center">
                         <p className="text-xl font-bold text-amber-400">{t('camp.maxBackpackLevel')}</p>
                         <p className="mt-2 text-gray-500">{t('camp.maxBackpackLevelDesc')}</p>
                     </div>
                ) : (
                    <div className="flex-grow flex flex-col justify-between">
                         <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
                            <p className="text-gray-400 text-sm mb-2">{t('camp.nextCapacity')}: <span className="text-white font-bold text-lg">{getBackpackCapacity(backpackLevel + 1)}</span></p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-6">
                            <h4 className="text-sm font-bold text-gray-300 mb-3 border-b border-slate-700 pb-2">{t('camp.upgradeCost')}</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-300"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400" />{t('resources.gold')}</span>
                                    <span className={`font-mono font-bold ${(baseCharacter.resources.gold || 0) >= upgradeCost.gold ? 'text-green-400' : 'text-red-400'}`}>
                                        {(baseCharacter.resources.gold || 0).toLocaleString()} / {upgradeCost.gold.toLocaleString()}
                                    </span>
                                </div>
                                {upgradeCost.essences.map(e => (
                                    <div key={e.type} className="flex justify-between items-center">
                                        <span className={`${rarityStyles[essenceToRarityMap[e.type]].text} flex items-center`}>
                                            {t(`resources.${e.type}`)}
                                        </span>
                                        <span className={`font-mono font-bold ${(baseCharacter.resources[e.type] || 0) >= e.amount ? 'text-green-400' : 'text-red-400'}`}>
                                            {(baseCharacter.resources[e.type] || 0)} / {e.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={onUpgradeBackpack} disabled={!canAffordUpgrade || isUpgrading} className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white disabled:bg-slate-700 disabled:text-gray-500 transition-colors">
                            {isUpgrading ? 'Ulepszanie...' : t('camp.upgrade')}
                        </button>
                    </div>
                )}
             </div>
        </div>
    );
};
