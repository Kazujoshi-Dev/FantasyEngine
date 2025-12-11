
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { Expedition as ExpeditionType, Location } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';

export interface ExpeditionProps {
    onCompletion: () => Promise<void>;
}

const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds > 0 ? `${remainingSeconds}s` : ''}`.trim();
};

const formatTimeLeft = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

export const ExpeditionComponent: React.FC<ExpeditionProps> = ({ onCompletion }) => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [selectedExpedition, setSelectedExpedition] = useState<ExpeditionType | null>(null);

    if (!character || !gameData) return null;

    const { expeditions, enemies } = gameData;

    const onStartExpedition = async (expeditionId: string) => {
        try {
            const updatedChar = await api.startExpedition(expeditionId);
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const onCancelExpedition = async () => {
        if (!window.confirm("Are you sure you want to cancel the expedition? You will get your resources back.")) return;
        try {
            const updatedChar = await api.cancelExpedition();
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const availableExpeditions = useMemo(() => 
        (expeditions || []).filter(exp => (exp.locationIds || []).includes(character.currentLocationId)),
        [expeditions, character.currentLocationId]
    );

    useEffect(() => {
        if (!selectedExpedition && availableExpeditions.length > 0) {
            setSelectedExpedition(availableExpeditions[0]);
        } else if (availableExpeditions.length > 0 && selectedExpedition && !availableExpeditions.some(e => e.id === selectedExpedition.id)) {
            // Reselect if current selection is no longer available
            setSelectedExpedition(availableExpeditions[0]);
        } else if (availableExpeditions.length === 0) {
            setSelectedExpedition(null);
        }
    }, [availableExpeditions, selectedExpedition]);

    const handleEmbark = (expId: string) => {
        if (character.stats.currentHealth < character.stats.maxHealth * 0.15) {
            if (window.confirm(t('expedition.lowHealthWarning'))) {
                onStartExpedition(expId);
            }
        } else {
            onStartExpedition(expId);
        }
    };
    
    const [timeLeft, setTimeLeft] = useState(0);
    useEffect(() => {
        if (character.activeExpedition) {
            const updateTimer = () => {
                const remaining = Math.max(0, Math.floor((character.activeExpedition!.finishTime - api.getServerTime()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    onCompletion();
                }
            };

            updateTimer();
            const intervalId = setInterval(updateTimer, 1000);
            return () => clearInterval(intervalId);
        }
    }, [character.activeExpedition, onCompletion]);

    if (character.activeExpedition) {
        const expedition = expeditions.find(e => e.id === character.activeExpedition!.expeditionId);
        return (
            <ContentPanel title={t('expedition.inProgressTitle')}>
                <div className="bg-slate-900/40 p-8 rounded-xl text-center">
                    <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('expedition.onExpedition')}</h3>
                    <p className="text-4xl font-extrabold text-white mb-4">{expedition?.name}</p>
                    {expedition?.image && <img src={expedition.image} alt={expedition.name} className="w-full h-48 object-cover rounded-lg my-4 border border-slate-700/50" />}
                    <p className="text-lg text-gray-400 mb-6">{t('expedition.endsIn')}</p>
                    <div className="text-6xl font-mono font-bold text-amber-400 mb-8">{formatTimeLeft(timeLeft)}</div>
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={onCompletion} 
                            disabled={timeLeft > 0} 
                            className="px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed shadow-lg"
                        >
                            {timeLeft > 0 ? t('expedition.inProgress') : t('expedition.finish')}
                        </button>
                        <button
                            onClick={onCancelExpedition}
                            className="px-6 py-3 rounded-lg bg-red-800 hover:bg-red-700 text-white font-semibold transition-colors duration-200"
                        >
                            Anuluj Wyprawę
                        </button>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    return (
        <ContentPanel title={t('expedition.availableTitle')}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl">
                    {availableExpeditions.length === 0 ? (
                        <p className="text-gray-500">{t('expedition.noExpeditions')}</p>
                    ) : (
                        <ul className="space-y-2">
                            {availableExpeditions.map(exp => (
                                <li key={exp.id}>
                                    <button 
                                        onClick={() => setSelectedExpedition(exp)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${selectedExpedition?.id === exp.id ? 'bg-indigo-600/50' : 'hover:bg-slate-700/50'}`}
                                    >
                                        <p className="font-semibold text-white">{exp.name}</p>
                                        <p className="text-xs text-gray-400">{exp.description}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {selectedExpedition && (
                    <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl">
                        <h3 className="text-2xl font-bold text-indigo-400 mb-2">{selectedExpedition.name}</h3>
                        {selectedExpedition.image && <img src={selectedExpedition.image} alt={selectedExpedition.name} className="w-full h-40 object-cover rounded-lg my-4 border border-slate-700/50" />}
                        <p className="text-gray-400 mb-6 italic">{selectedExpedition.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* ... Rest of the details ... */}
                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2">{t('expedition.potentialEnemies')}</h4>
                                 <div className="bg-slate-800/50 p-3 rounded-lg text-sm space-y-2">
                                    {selectedExpedition.enemies.length === 0 && <p className="text-gray-500">{t('expedition.noEnemies')}</p>}
                                    {selectedExpedition.enemies.map(e => {
                                        const enemy = enemies.find(en => en.id === e.enemyId);
                                        return <p key={e.enemyId}>{enemy?.name} ({e.spawnChance}%)</p>;
                                    })}
                                     {selectedExpedition.maxEnemies && <p className="text-xs text-gray-500 mt-2">{t('expedition.maxEnemiesNote', { count: selectedExpedition.maxEnemies })}</p>}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2">{t('expedition.reqsAndRewards')}</h4>
                                <div className="bg-slate-800/50 p-3 rounded-lg text-sm space-y-2">
                                    <p className="flex justify-between"><span>{t('expedition.cost')}:</span> <span className="font-mono flex items-center">{selectedExpedition.goldCost} <CoinsIcon className="h-4 w-4 ml-1 text-amber-400"/> / {selectedExpedition.energyCost} <BoltIcon className="h-4 w-4 ml-1 text-sky-400"/></span></p>
                                    <p className="flex justify-between"><span>{t('expedition.duration')}:</span> <span className="font-mono">{formatDuration(selectedExpedition.duration)}</span></p>
                                    <p className="flex justify-between"><span>{t('expedition.reward')} (Złoto):</span> <span className="font-mono">{selectedExpedition.minBaseGoldReward} - {selectedExpedition.maxBaseGoldReward}</span></p>
                                    <p className="flex justify-between"><span>{t('expedition.reward')} (XP):</span> <span className="font-mono">{selectedExpedition.minBaseExperienceReward} - {selectedExpedition.maxBaseExperienceReward}</span></p>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => handleEmbark(selectedExpedition.id)} 
                            disabled={character.resources.gold < selectedExpedition.goldCost || character.stats.currentEnergy < selectedExpedition.energyCost}
                            className="w-full mt-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-lg transition-colors duration-200 disabled:bg-slate-600"
                        >
                            {t('expedition.embark')}
                        </button>
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
