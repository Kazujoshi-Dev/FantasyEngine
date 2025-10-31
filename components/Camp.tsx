



import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, CharacterChest, EssenceType, ItemRarity } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ChestIcon } from './icons/ChestIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { rarityStyles } from './shared/ItemSlot';

interface CampProps {
    character: PlayerCharacter;
    baseCharacter: PlayerCharacter;
    onToggleResting: () => void;
    onUpgradeCamp: () => void;
    getUpgradeCost: (level: number) => number;
    onCharacterUpdate: (character: PlayerCharacter) => void;
    onHealToFull: () => void;
}

const REGEN_INTERVAL_SECONDS = 5;

// --- Chest Calculation Helpers ---
const getChestCapacity = (level: number) => Math.floor(500 * Math.pow(level, 1.8));

const getChestUpgradeCost = (level: number): { gold: number; essences: { type: EssenceType; amount: number }[] } => {
    const gold = Math.floor(500 * Math.pow(level, 2.1));
    const essences: { type: EssenceType; amount: number }[] = [];

    if (level <= 10) {
        essences.push({ type: EssenceType.Common, amount: level * 5 });
    } else if (level <= 20) {
        essences.push({ type: EssenceType.Common, amount: 50 });
        essences.push({ type: EssenceType.Uncommon, amount: (level - 10) * 2 });
    } else if (level <= 30) {
        essences.push({ type: EssenceType.Uncommon, amount: 20 });
        essences.push({ type: EssenceType.Rare, amount: (level - 20) * 1 });
    } else if (level <= 40) {
        essences.push({ type: EssenceType.Rare, amount: 10 });
        essences.push({ type: EssenceType.Epic, amount: Math.ceil((level - 30) / 2) });
    } else {
        essences.push({ type: EssenceType.Epic, amount: 5 });
        essences.push({ type: EssenceType.Legendary, amount: Math.ceil((level - 40) / 5) });
    }
    
    return { gold, essences };
};


const ChestPanel: React.FC<{ character: PlayerCharacter; baseCharacter: PlayerCharacter; onCharacterUpdate: (character: PlayerCharacter) => void; }> = ({ character, baseCharacter, onCharacterUpdate }) => {
    const { t } = useTranslation();
    const { chest, resources: displayResources } = character; // Use derived character for UI display
    const [amount, setAmount] = useState<string>('');
    
    const capacity = getChestCapacity(chest.level);
    const upgradeCost = getChestUpgradeCost(chest.level);
    
    // Use baseCharacter for all logic to ensure source of truth
    const canAffordUpgrade = baseCharacter.resources.gold >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const handleDeposit = (value: number | 'all') => {
        const depositAmount = value === 'all' ? baseCharacter.resources.gold : Math.min(baseCharacter.resources.gold, Number(value));
        if (isNaN(depositAmount) || depositAmount <= 0) return;

        const newChestGold = Math.min(capacity, baseCharacter.chest.gold + depositAmount);
        const actualDeposit = newChestGold - baseCharacter.chest.gold;

        if(actualDeposit > 0) {
            const newChar = JSON.parse(JSON.stringify(baseCharacter));
            newChar.resources.gold -= actualDeposit;
            newChar.chest.gold = newChestGold;
            onCharacterUpdate(newChar);
        }
        setAmount('');
    };

    const handleWithdraw = (value: number | 'all') => {
        const withdrawAmount = value === 'all' ? baseCharacter.chest.gold : Math.min(baseCharacter.chest.gold, Number(value));
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) return;

        const newChar = JSON.parse(JSON.stringify(baseCharacter));
        newChar.chest.gold -= withdrawAmount;
        newChar.resources.gold += withdrawAmount;
        onCharacterUpdate(newChar);
        setAmount('');
    };
    
    const handleUpgrade = () => {
        if (!canAffordUpgrade) return;
        const newChar = JSON.parse(JSON.stringify(baseCharacter));
        newChar.resources.gold -= upgradeCost.gold;
        upgradeCost.essences.forEach(e => {
            newChar.resources[e.type] -= e.amount;
        });
        newChar.chest.level += 1;
        onCharacterUpdate(newChar);
    };

    const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
        [EssenceType.Common]: ItemRarity.Common,
        [EssenceType.Uncommon]: ItemRarity.Uncommon,
        [EssenceType.Rare]: ItemRarity.Rare,
        [EssenceType.Epic]: ItemRarity.Epic,
        [EssenceType.Legendary]: ItemRarity.Legendary,
    };

    return (
         <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col justify-between h-full">
            <div>
                <h3 className="text-2xl font-bold text-indigo-400 mb-4 flex items-center">
                    <ChestIcon className="h-6 w-6 mr-2" />
                    {t('camp.chestTitle')}
                </h3>
                <div className="space-y-2 text-lg mb-4">
                    <p className="flex justify-between"><span className="text-gray-300">{t('camp.chestLevel')}:</span> <span className="font-bold text-white">{chest.level}</span></p>
                    <p className="flex justify-between"><span className="text-gray-300">{t('camp.chestCapacity')}:</span> <span className="font-mono font-bold text-amber-400">{capacity.toLocaleString()}</span></p>
                </div>
                 <div className="w-full bg-slate-700 rounded-full h-4 relative my-4">
                    <div className="bg-amber-600 h-4 rounded-full" style={{ width: `${(chest.gold / capacity) * 100}%` }}></div>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{chest.gold.toLocaleString()} / {capacity.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                    <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('camp.amount') || 'Amount'} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-center" />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <button onClick={() => handleDeposit(Number(amount))} className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 font-bold">{t('camp.deposit')}</button>
                        <button onClick={() => handleWithdraw(Number(amount))} className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 font-bold">{t('camp.withdraw')}</button>
                        <button onClick={() => handleDeposit('all')} className="w-full py-2 rounded-lg bg-green-800 hover:bg-green-700">{t('camp.depositAll')}</button>
                        <button onClick={() => handleWithdraw('all')} className="w-full py-2 rounded-lg bg-amber-800 hover:bg-amber-700">{t('camp.withdrawAll')}</button>
                    </div>
                </div>
            </div>
            <div className="border-t border-slate-700/50 mt-6 pt-4">
                <h4 className="text-lg font-bold text-gray-300 mb-2">{t('camp.upgradeChest')} (Lvl {chest.level + 1})</h4>
                 <div className="space-y-1 text-sm">
                    <p className="flex justify-between items-center">
                        <span className="flex items-center"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400" />{t('resources.gold')}:</span>
                        <span className={`font-mono ${displayResources.gold >= upgradeCost.gold ? 'text-green-400' : 'text-red-400'}`}>
                            {displayResources.gold.toLocaleString()} / {upgradeCost.gold.toLocaleString()}
                        </span>
                    </p>
                    {upgradeCost.essences.map(e => {
                         const rarity = essenceToRarityMap[e.type];
                         return (
                            <p key={e.type} className="flex justify-between items-center">
                                <span className={rarityStyles[rarity].text}>{t(`resources.${e.type}`)}:</span>
                                <span className={`font-mono ${(displayResources[e.type] || 0) >= e.amount ? 'text-green-400' : 'text-red-400'}`}>
                                    {(displayResources[e.type] || 0)} / {e.amount}
                                </span>
                            </p>
                        )
                    })}
                </div>
                <button onClick={handleUpgrade} disabled={!canAffordUpgrade} className="w-full mt-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold disabled:bg-slate-600 disabled:cursor-not-allowed">{t('camp.upgrade')}</button>
            </div>
        </div>
    );
}


export const Camp: React.FC<CampProps> = ({ character, baseCharacter, onToggleResting, onUpgradeCamp, getUpgradeCost, onCharacterUpdate, onHealToFull }) => {
    const { t } = useTranslation();
    const { camp, isResting, resources, stats, restStartHealth, activeTravel, activeExpedition } = character;
    const isTraveling = activeTravel !== null;
    const maxLevel = 10;
    const isMaxLevel = camp.level >= maxLevel;
    const upgradeCost = isMaxLevel ? Infinity : getUpgradeCost(camp.level);
    const canAffordUpgrade = resources.gold >= upgradeCost;
    const [countdown, setCountdown] = useState(REGEN_INTERVAL_SECONDS);

    useEffect(() => {
        if (!isResting) {
            setCountdown(REGEN_INTERVAL_SECONDS);
            return;
        }

        const timerId = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? REGEN_INTERVAL_SECONDS : prev - 1));
        }, 1000);

        return () => clearInterval(timerId);
    }, [isResting]);
    
    const regeneratedHealth = isResting ? stats.currentHealth - restStartHealth : 0;
    const healthPercentage = (stats.currentHealth / stats.maxHealth) * 100;

    return (
        <ContentPanel title={t('camp.title')}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Status and Resting Panel */}
                <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-indigo-400 mb-4 flex items-center">
                            <HomeIcon className="h-6 w-6 mr-2" />
                            {t('camp.statusTitle')}
                        </h3>
                        <div className="space-y-2 text-lg">
                            <p className="flex justify-between">
                                <span className="text-gray-300">{t('camp.level')}:</span>
                                <span className="font-bold text-white">{camp.level} / {maxLevel}</span>
                            </p>
                             <p className="flex justify-between">
                                <span className="text-gray-300">{t('camp.regeneration')}:</span>
                                <span className="font-bold text-green-400">{camp.level}% HP / min</span>
                            </p>
                        </div>
                        <div className="mt-6">
                            <h4 className="text-lg text-gray-300 mb-2">{t('camp.yourHealth')}</h4>
                            <div className="w-full bg-slate-700 rounded-full h-4 relative">
                                <div
                                    className="bg-red-600 h-4 rounded-full transition-all duration-500"
                                    style={{ width: `${healthPercentage}%` }}>
                                </div>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                                    {stats.currentHealth.toFixed(1)} / {stats.maxHealth}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <button
                            onClick={onToggleResting}
                            disabled={activeExpedition !== null || isTraveling}
                            className={`w-full mt-6 py-3 rounded-lg font-bold text-lg transition-colors duration-200 shadow-lg
                                ${isResting
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }
                                disabled:bg-slate-600 disabled:cursor-not-allowed
                            `}
                        >
                            {isResting ? t('camp.stopResting') : t('camp.startResting')}
                        </button>
                        <button
                            onClick={onHealToFull}
                            disabled={activeExpedition !== null || isTraveling || isResting || stats.currentHealth >= stats.maxHealth}
                            className={`w-full mt-2 py-2 rounded-lg font-bold text-sm transition-colors duration-200 shadow-md
                                bg-emerald-600 hover:bg-emerald-700 text-white
                                disabled:bg-slate-600 disabled:cursor-not-allowed
                            `}
                            title={stats.currentHealth >= stats.maxHealth ? "You are already at full health." : ""}
                        >
                            {t('camp.healToFull')}
                        </button>
                        {isResting && (
                             <div className="text-center mt-4 bg-slate-800/50 p-4 rounded-lg">
                                <p className="text-sm text-green-400 animate-pulse mb-2">{t('camp.restingMessage')}</p>
                                <p className="text-gray-300">
                                    {t('camp.regenerated')}: <span className="font-bold text-white">+{regeneratedHealth.toFixed(1)}</span> HP
                                </p>
                                <p className="text-gray-400 text-sm mt-1">
                                    {t('camp.nextRegenIn')}: <span className="font-mono font-bold text-white">{countdown}s</span>
                                </p>
                            </div>
                        )}
                        {activeExpedition !== null && <p className="text-center mt-2 text-sm text-red-400">{t('camp.cannotRest')}</p>}
                         {isTraveling && <p className="text-center mt-2 text-sm text-red-400">{t('camp.unavailableDuringTravel')}</p>}
                    </div>
                </div>

                {/* Upgrade Panel */}
                <div className="bg-slate-900/40 p-6 rounded-xl">
                    <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('camp.upgradeTitle')}</h3>
                    {isMaxLevel ? (
                        <div className="text-center text-gray-300 bg-slate-800/50 p-6 rounded-lg">
                            <p className="text-xl font-bold text-amber-400">{t('camp.maxLevel')}</p>
                            <p className="mt-2">{t('camp.maxLevelDesc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <p className="text-lg text-gray-300">{t('camp.nextLevel')}: <span className="font-bold text-white">{camp.level + 1}</span></p>
                                <p className="text-lg text-gray-300">{t('camp.newRegeneration')}: <span className="font-bold text-green-400">{camp.level + 1}% HP / min</span></p>
                            </div>
                            <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-lg">
                                <span className="text-lg text-gray-300 flex items-center">
                                    <CoinsIcon className="h-5 w-5 mr-2 text-amber-400" />
                                    {t('camp.upgradeCost')}:
                                </span>
                                <span className="font-mono text-xl font-bold text-amber-400">{upgradeCost.toLocaleString()}</span>
                            </div>
                             <p className="text-sm text-gray-500">
                                {t('camp.yourGold')}: {resources.gold.toLocaleString()}
                            </p>
                            <button
                                onClick={onUpgradeCamp}
                                disabled={!canAffordUpgrade || isResting || isTraveling}
                                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                            >
                                {t('camp.upgrade')}
                            </button>
                            {!canAffordUpgrade && <p className="text-center text-sm text-red-400 mt-2">{t('camp.notEnoughGold')}</p>}
                            {isResting && <p className="text-center text-sm text-amber-400 mt-2">{t('camp.mustStopResting')}</p>}
                            {isTraveling && <p className="text-center text-sm text-red-400 mt-2">{t('camp.unavailableDuringTravel')}</p>}
                        </div>
                    )}
                </div>
                
                {/* Chest Panel */}
                <ChestPanel character={character} baseCharacter={baseCharacter} onCharacterUpdate={onCharacterUpdate} />

            </div>
        </ContentPanel>
    );
};
