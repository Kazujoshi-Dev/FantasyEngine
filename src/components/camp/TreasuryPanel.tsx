
import React, { useState } from 'react';
import { ChestIcon } from '../icons/ChestIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { useTranslation } from '../../contexts/LanguageContext';
import { useCharacter } from '../../contexts/CharacterContext';
import { api } from '../../api';
import { getChestUpgradeCost } from '../../logic/stats';
import { rarityStyles } from '../shared/ItemSlot';
import { EssenceType, ItemRarity } from '../../types';

const getChestCapacity = (level: number) => Math.floor(500 * Math.pow(level, 1.8));

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const TreasuryPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [amount, setAmount] = useState<string>('');
    const [isUpgrading, setIsUpgrading] = useState(false);

    if (!character || !baseCharacter) return null;

    const treasury = character.treasury || character.chest || { level: 1, gold: 0 };
    const chestLevel = treasury.level;
    const chestGold = treasury.gold;
    const capacity = getChestCapacity(chestLevel);
    const upgradeCost = getChestUpgradeCost(chestLevel);
    
    const canAffordUpgrade = (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const handleDeposit = async (value: number | 'all') => {
        const depositAmount = value === 'all' ? (baseCharacter.resources?.gold || 0) : Math.min((baseCharacter.resources?.gold || 0), Number(value));
        if (isNaN(depositAmount) || depositAmount <= 0) return;
        try {
            const updatedChar = await api.chestDeposit(depositAmount);
            updateCharacter(updatedChar);
            setAmount('');
        } catch (e: any) { alert(e.message || 'Błąd wpłaty'); }
    };

    const handleWithdraw = async (value: number | 'all') => {
        const currentStored = treasury.gold;
        const withdrawAmount = value === 'all' ? currentStored : Math.min(currentStored, Number(value));
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) return;
        try {
            const updatedChar = await api.chestWithdraw(withdrawAmount);
            updateCharacter(updatedChar);
            setAmount('');
        } catch (e: any) { alert(e.message || 'Błąd wypłaty'); }
    };

    const onUpgradeChest = async () => {
        setIsUpgrading(true);
        try {
            const updatedChar = await api.upgradeChest();
            updateCharacter(updatedChar);
        } catch (e: any) { 
            alert(e.message || t('error.title')); 
        } finally {
            setIsUpgrading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full animate-fade-in">
             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30">
                <h3 className="text-xl font-bold text-amber-400 mb-6 flex items-center">
                    <ChestIcon className="h-6 w-6 mr-2" />
                    {t('camp.chestTitle')}
                </h3>

                <div className="flex-grow">
                    <div className="bg-slate-800/50 p-4 rounded-lg mb-6 text-center">
                         <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Złoto w Skarbcu</p>
                         <p className="text-4xl font-mono font-bold text-amber-400 mb-2">{chestGold.toLocaleString()}</p>
                         <div className="w-full bg-slate-700 rounded-full h-3 relative">
                            <div className="bg-amber-500 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (chestGold / capacity) * 100)}%` }}></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-right">{t('camp.chestCapacity')}: {capacity.toLocaleString()}</p>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <label className="block text-sm text-gray-400 mb-2">{t('camp.amount')}</label>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="number" 
                                min="1" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                placeholder={t('camp.amount')} 
                                className="flex-grow bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" 
                            />
                            <div className="flex items-center text-amber-400 font-bold bg-slate-900/50 px-3 rounded-lg border border-slate-700">
                                <CoinsIcon className="h-5 w-5 mr-1" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleDeposit(Number(amount))} className="py-2 bg-green-700 hover:bg-green-600 rounded text-white font-bold transition-colors">{t('camp.deposit')}</button>
                            <button onClick={() => handleWithdraw(Number(amount))} className="py-2 bg-amber-700 hover:bg-amber-600 rounded text-white font-bold transition-colors">{t('camp.withdraw')}</button>
                            <button onClick={() => handleDeposit('all')} className="py-2 bg-green-900/60 hover:bg-green-800/60 border border-green-700 rounded text-green-200 text-sm">{t('camp.depositAll')}</button>
                            <button onClick={() => handleWithdraw('all')} className="py-2 bg-amber-900/60 hover:bg-amber-800/60 border border-amber-700 rounded text-amber-200 text-sm">{t('camp.withdrawAll')}</button>
                        </div>
                    </div>
                </div>
             </div>

             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30">
                <h3 className="text-xl font-bold text-gray-300 mb-6 flex items-center">
                    {t('camp.upgradeChest')}
                </h3>
                
                <div className="bg-slate-800/50 p-4 rounded-lg flex-grow">
                    <div className="mb-6">
                        <p className="text-gray-400 text-sm mb-2">{t('camp.chestLevel')}: <span className="text-white font-bold text-lg">{chestLevel}</span></p>
                        <p className="text-gray-400 text-sm">{t('camp.nextCapacity')}: <span className="text-green-400 font-bold text-lg">{getChestCapacity(chestLevel + 1).toLocaleString()}</span></p>
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
                    
                    <button 
                        onClick={onUpgradeChest} 
                        disabled={!canAffordUpgrade || isUpgrading} 
                        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        {isUpgrading ? 'Ulepszanie...' : t('camp.upgrade')}
                    </button>
                </div>
             </div>
        </div>
    );
};
