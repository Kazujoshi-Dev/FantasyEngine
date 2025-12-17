
import React, { useState, useEffect } from 'react';
import { HomeIcon } from '../icons/HomeIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { useTranslation } from '../../contexts/LanguageContext';
import { useCharacter } from '../../contexts/CharacterContext';
import { api } from '../../api';
import { getCampUpgradeCost } from '../../logic/stats';
import { rarityStyles } from '../shared/ItemSlot';
import { EssenceType, ItemRarity } from '../../types';

const REGEN_INTERVAL_SECONDS = 10;

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const OverviewPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [countdown, setCountdown] = useState(REGEN_INTERVAL_SECONDS);
    const [isHealing, setIsHealing] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);

    if (!character || !baseCharacter) return null;

    const { camp, isResting, stats, restStartHealth, activeTravel, activeExpedition } = character;
    const isTraveling = activeTravel !== null;
    const campLevel = camp?.level || 1;
    const maxLevel = 10;
    const isMaxLevel = campLevel >= maxLevel;

    const upgradeCost = isMaxLevel ? { gold: Infinity, essences: [] } : getCampUpgradeCost(campLevel);
    const canAffordUpgrade = !isMaxLevel && (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    useEffect(() => {
        if (!isResting) { setCountdown(REGEN_INTERVAL_SECONDS); return; }
        const timerId = setInterval(() => { setCountdown(prev => (prev <= 1 ? REGEN_INTERVAL_SECONDS : prev - 1)); }, 1000);
        return () => clearInterval(timerId);
    }, [isResting]);

    const currentHealth = stats?.currentHealth || 0;
    const maxHealth = stats?.maxHealth || 1;
    const regeneratedHealth = isResting ? Math.max(0, currentHealth - restStartHealth) : 0;
    const healthPercentage = (currentHealth / maxHealth) * 100;

    const onToggleResting = () => api.updateCharacter({ isResting: !isResting }).then(updateCharacter);
    
    const onUpgradeCamp = async () => { 
        setIsUpgrading(true);
        try { 
            const updated = await api.upgradeCamp();
            updateCharacter(updated); 
        } catch(e:any) { 
            alert(e.message); 
        } finally {
            setIsUpgrading(false);
        }
    };
    
    const onHealToFull = async () => { 
        setIsHealing(true);
        try { 
            const updated = await api.healCharacter();
            updateCharacter(updated); 
        } catch(e:any) { 
            alert(e.message); 
        } finally {
            setIsHealing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full animate-fade-in">
            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30 h-full">
                <h3 className="text-xl font-bold text-indigo-400 mb-6 flex items-center">
                    <HomeIcon className="h-6 w-6 mr-2" />
                    {t('camp.statusTitle')}
                </h3>
                
                <div className="space-y-4 flex-grow">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-400">{t('camp.yourHealth')}</span>
                            <span className="text-white font-bold">{currentHealth.toFixed(0)} / {maxHealth}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden border border-slate-600">
                            <div className="bg-red-600 h-full transition-all duration-500 relative" style={{ width: `${healthPercentage}%` }}>
                                <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{t('camp.level')}</p>
                            <p className="text-2xl font-bold text-white">{campLevel}</p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{t('camp.regeneration')}</p>
                            <p className="text-xl font-bold text-green-400">{campLevel}% / min</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    <button 
                        onClick={onToggleResting} 
                        disabled={activeExpedition !== null || isTraveling} 
                        className={`w-full py-3 rounded-lg font-bold text-lg transition-colors duration-200 shadow-lg ${isResting ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'} text-white disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed`}
                    >
                        {isResting ? t('camp.stopResting') : t('camp.startResting')}
                    </button>
                    
                    <button 
                        onClick={onHealToFull} 
                        disabled={activeExpedition !== null || isTraveling || isResting || currentHealth >= maxHealth || isHealing} 
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-colors duration-200 shadow-md bg-emerald-700 hover:bg-emerald-600 text-white disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed border border-emerald-500/30`}
                    >
                        {isHealing ? 'Leczenie...' : t('camp.healToFull')}
                    </button>

                    {isResting && (
                        <div className="text-center bg-slate-800/80 p-3 rounded-lg border border-green-500/30">
                            <p className="text-sm text-green-400 animate-pulse mb-1">{t('camp.restingMessage')}</p>
                            <p className="text-gray-400 text-xs">
                                {t('camp.regenerated')}: <span className="font-bold text-white">+{regeneratedHealth.toFixed(1)}</span> HP
                            </p>
                            <p className="text-gray-500 text-[10px] mt-1">
                                {t('camp.nextRegenIn')}: <span className="font-mono font-bold text-white">{countdown}s</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30 h-full">
                <h3 className="text-xl font-bold text-amber-400 mb-6 flex items-center">
                    <CoinsIcon className="h-6 w-6 mr-2" />
                    Rozbudowa Obozu
                </h3>

                {isMaxLevel ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-slate-800/30 rounded-lg border border-amber-500/20">
                        <HomeIcon className="h-16 w-16 text-amber-500 mb-4 opacity-50" />
                        <p className="text-xl font-bold text-amber-400">{t('camp.maxLevel')}</p>
                        <p className="mt-2 text-gray-400">{t('camp.maxLevelDesc')}</p>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col justify-between">
                        <div>
                            <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
                                <p className="text-gray-400 text-sm mb-2">{t('camp.nextLevel')}: <span className="text-white font-bold text-lg">{campLevel + 1}</span></p>
                                <p className="text-gray-400 text-sm">{t('camp.newRegeneration')}: <span className="text-green-400 font-bold text-lg">{campLevel + 1}% / min</span></p>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-lg">
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
                        </div>

                        <div className="mt-6">
                            <button 
                                onClick={onUpgradeCamp} 
                                disabled={!canAffordUpgrade || isResting || isTraveling || isUpgrading} 
                                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                {isUpgrading ? 'Ulepszanie...' : t('camp.upgrade')}
                            </button>
                            {isResting && <p className="text-center text-xs text-amber-400 mt-2">{t('camp.mustStopResting')}</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
