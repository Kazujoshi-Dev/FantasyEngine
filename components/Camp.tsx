
import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { HomeIcon } from './icons/HomeIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface CampProps {
    character: PlayerCharacter;
    onToggleResting: () => void;
    onUpgradeCamp: () => void;
    getUpgradeCost: (level: number) => number;
}

const REGEN_INTERVAL_SECONDS = 5;

export const Camp: React.FC<CampProps> = ({ character, onToggleResting, onUpgradeCamp, getUpgradeCost }) => {
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
            </div>
        </ContentPanel>
    );
};
