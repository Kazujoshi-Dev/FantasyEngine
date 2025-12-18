
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

    const { expeditions, enemies, locations } = gameData;

    const onStartExpedition = async (expeditionId: string) => {
        try {
            const updatedChar = await api.startExpedition(expeditionId);
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const onCancelExpedition = async () => {
        if (!window.confirm("Czy na pewno chcesz anulować wyprawę? Odzyskasz zużyte zasoby.")) return;
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-fade-in">
                    
                    {/* LEWA SEKJA: Kontrolki i Odliczanie */}
                    <div className="bg-slate-900/40 p-8 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center text-center shadow-xl">
                        <span className="px-4 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border border-indigo-500/30">
                            {t('expedition.onExpedition')}
                        </span>
                        <h3 className="text-4xl font-black text-white mb-8 drop-shadow-md">
                            {expedition?.name}
                        </h3>
                        
                        <div className="mb-10">
                            <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">{t('expedition.endsIn')}</p>
                            <div className="text-7xl font-mono font-bold text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                                {formatTimeLeft(timeLeft)}
                            </div>
                        </div>

                        <div className="flex flex-col w-full max-w-sm gap-4">
                            <button 
                                onClick={onCompletion} 
                                disabled={timeLeft > 0} 
                                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl transition-all duration-300 disabled:bg-slate-700 disabled:text-gray-500 shadow-lg shadow-indigo-900/20 active:scale-95"
                            >
                                {timeLeft > 0 ? t('expedition.inProgress') : t('expedition.finish')}
                            </button>
                            <button
                                onClick={onCancelExpedition}
                                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-red-900/40 text-gray-400 hover:text-red-300 font-bold transition-all duration-300 border border-slate-700 hover:border-red-900/50"
                            >
                                Anuluj Wyprawę
                            </button>
                        </div>
                    </div>

                    {/* PRAWA SEKJA: Grafika i Fabuła */}
                    <div className="relative group">
                        <div className="h-full flex flex-col bg-slate-900/60 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl">
                            {/* Grafika wyprawy */}
                            <div className="relative h-2/3 overflow-hidden">
                                {expedition?.image ? (
                                    <img 
                                        src={expedition.image} 
                                        alt={expedition.name} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                    />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                        <BoltIcon className="w-20 h-20 text-slate-700 opacity-20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                            </div>

                            {/* Opis w klimatycznej ramie */}
                            <div className="flex-1 p-6 relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <div className="w-12 h-1 bg-amber-500/50 rounded-full"></div>
                                </div>
                                <div className="h-full bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 shadow-inner overflow-y-auto custom-scrollbar">
                                    <h4 className="text-xs font-bold text-amber-500/70 uppercase tracking-widest mb-2 text-center">Kroniki Wydarzeń</h4>
                                    <p className="text-gray-300 italic leading-relaxed text-center">
                                        {expedition?.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Ozdobne narożniki ramy */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-slate-700 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-slate-700 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-slate-700 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-slate-700 rounded-br-lg"></div>
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
