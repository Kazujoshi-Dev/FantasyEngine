
import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { Expedition as ExpeditionType, Enemy } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { StarIcon } from './icons/StarIcon';
/* Add missing MapIcon import */
import { MapIcon } from './icons/MapIcon';
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
                <div className="flex flex-col lg:flex-row gap-8 h-full animate-fade-in">
                    <div className="w-full lg:w-1/3 flex flex-col gap-4">
                        <div className="bg-slate-900/60 rounded-2xl border border-indigo-500/30 overflow-hidden shadow-2xl">
                             <div className="aspect-square relative">
                                {expedition?.image ? (
                                    <img src={expedition.image} alt={expedition.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                        <BoltIcon className="w-20 h-20 text-slate-700 opacity-20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                                <div className="absolute bottom-4 left-0 right-0 text-center">
                                     <span className="px-4 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                                        Trwająca Wyprawa
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col items-center">
                            <h3 className="text-xl font-bold text-white mb-6 text-center">{expedition?.name}</h3>
                            <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">{t('expedition.endsIn')}</p>
                            <div className="text-5xl font-mono font-bold text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)] mb-8">
                                {formatTimeLeft(timeLeft)}
                            </div>
                            <button 
                                onClick={onCompletion} 
                                disabled={timeLeft > 0} 
                                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl transition-all disabled:bg-slate-700 disabled:text-gray-500 active:scale-95 mb-4 shadow-lg"
                            >
                                {timeLeft > 0 ? t('expedition.inProgress') : t('expedition.finish')}
                            </button>
                            <button onClick={onCancelExpedition} className="text-red-400 hover:text-red-300 text-sm font-bold uppercase tracking-tight transition-colors">
                                Anuluj Wyprawę
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-slate-900/20 p-8 rounded-2xl border border-slate-800/50 backdrop-blur-sm overflow-y-auto">
                        <div className="max-w-2xl mx-auto space-y-8">
                            <section>
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <ShieldIcon className="h-4 w-4" /> Dziennik Podróży
                                </h4>
                                <p className="text-gray-300 italic leading-relaxed text-lg text-center bg-slate-800/30 p-6 rounded-xl border border-slate-700/30">
                                    "{expedition?.description}"
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50">
                                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Ryzyko</h5>
                                    <div className="space-y-2">
                                        {expedition?.enemies.map(e => {
                                            const enemy = enemies.find(en => en.id === e.enemyId);
                                            return (
                                                <div key={e.enemyId} className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-300">{enemy?.name}</span>
                                                    <span className="text-red-400/80 font-mono text-xs">{e.spawnChance}% szans</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50">
                                    <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3">Obiecane Łupy</h5>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <CoinsIcon className="h-5 w-5 text-amber-500" />
                                            <span className="text-white font-mono">{expedition?.minBaseGoldReward}-{expedition?.maxBaseGoldReward}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <StarIcon className="h-5 w-5 text-sky-400" />
                                            <span className="text-white font-mono">{expedition?.minBaseExperienceReward}-{expedition?.maxBaseExperienceReward} XP</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    return (
        <ContentPanel title={t('expedition.availableTitle')}>
            <div className="flex flex-col lg:flex-row gap-8 h-full">
                {/* LISTA WYPRAW */}
                <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
                    {availableExpeditions.length === 0 ? (
                        <p className="text-gray-500 italic text-center py-10">{t('expedition.noExpeditions')}</p>
                    ) : (
                        availableExpeditions.map(exp => (
                            <button 
                                key={exp.id}
                                onClick={() => setSelectedExpedition(exp)}
                                className={`group flex flex-col p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden ${selectedExpedition?.id === exp.id ? 'bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl' : 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-900/60'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <p className={`font-bold text-base transition-colors ${selectedExpedition?.id === exp.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>{exp.name}</p>
                                    <span className="text-[10px] font-mono text-gray-500 bg-slate-950/50 px-2 py-0.5 rounded">{formatDuration(exp.duration)}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                     <div className="flex items-center text-[10px] text-amber-500/80 font-bold">
                                        <CoinsIcon className="h-3 w-3 mr-1" /> {exp.goldCost}
                                     </div>
                                     <div className="flex items-center text-[10px] text-sky-400/80 font-bold">
                                        <BoltIcon className="h-3 w-3 mr-1" /> {exp.energyCost}
                                     </div>
                                </div>
                                {selectedExpedition?.id === exp.id && <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                            </button>
                        ))
                    )}
                </div>

                {/* SZCZEGÓŁY WYPRAWY */}
                {selectedExpedition ? (
                    <div className="flex-1 bg-slate-900/40 rounded-2xl border border-slate-700/50 flex flex-col lg:flex-row overflow-hidden animate-fade-in shadow-2xl">
                        {/* Lewa strona detali: Obrazek */}
                        <div className="w-full lg:w-[450px] bg-slate-950 flex flex-col">
                            <div className="aspect-square w-full relative overflow-hidden group">
                                {selectedExpedition.image ? (
                                    <img src={selectedExpedition.image} alt={selectedExpedition.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                                ) : (
                                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                        <MapIcon className="w-24 h-24 text-slate-800" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60"></div>
                            </div>
                            <div className="p-6 flex-grow flex flex-col justify-center">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mb-3">Opis Ekspedycji</h4>
                                <p className="text-gray-400 italic text-sm leading-relaxed">
                                    {selectedExpedition.description}
                                </p>
                            </div>
                        </div>

                        {/* Prawa strona detali: Statystyki i Przycisk */}
                        <div className="flex-1 p-8 flex flex-col">
                            <div className="mb-8 border-b border-white/5 pb-4">
                                <h3 className="text-3xl font-black text-white mb-2">{selectedExpedition.name}</h3>
                                <div className="flex gap-4">
                                    <span className="flex items-center text-xs text-gray-500 font-bold uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                        <ClockIcon className="h-3 w-3 mr-2 text-indigo-400" /> {formatDuration(selectedExpedition.duration)}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                {/* Inwestycja */}
                                <section>
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <ShieldIcon className="h-4 w-4" /> Wymagania (Koszt)
                                    </h4>
                                    <div className="space-y-3">
                                        <div className={`flex justify-between items-center p-3 rounded-xl border transition-all ${character.resources.gold >= selectedExpedition.goldCost ? 'bg-slate-800/40 border-slate-700' : 'bg-red-900/10 border-red-900/50'}`}>
                                            <div className="flex items-center gap-3">
                                                <CoinsIcon className={`h-6 w-6 ${character.resources.gold >= selectedExpedition.goldCost ? 'text-amber-400' : 'text-red-400'}`} />
                                                <span className="text-gray-300 font-bold">{t('resources.gold')}</span>
                                            </div>
                                            <span className={`font-mono text-lg font-bold ${character.resources.gold >= selectedExpedition.goldCost ? 'text-white' : 'text-red-400'}`}>
                                                {selectedExpedition.goldCost.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className={`flex justify-between items-center p-3 rounded-xl border transition-all ${character.stats.currentEnergy >= selectedExpedition.energyCost ? 'bg-slate-800/40 border-slate-700' : 'bg-red-900/10 border-red-900/50'}`}>
                                            <div className="flex items-center gap-3">
                                                <BoltIcon className={`h-6 w-6 ${character.stats.currentEnergy >= selectedExpedition.energyCost ? 'text-sky-400' : 'text-red-400'}`} />
                                                <span className="text-gray-300 font-bold">{t('statistics.energyLabel')}</span>
                                            </div>
                                            <span className={`font-mono text-lg font-bold ${character.stats.currentEnergy >= selectedExpedition.energyCost ? 'text-white' : 'text-red-400'}`}>
                                                {selectedExpedition.energyCost}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                {/* Nagrody */}
                                <section>
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <StarIcon className="h-4 w-4" /> Potencjalna Nagroda
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="bg-amber-900/10 border border-amber-600/30 p-3 rounded-xl flex justify-between items-center">
                                            <span className="text-amber-400 text-sm font-bold uppercase">Złoto (Min-Max)</span>
                                            <span className="text-white font-mono font-bold text-lg">{selectedExpedition.minBaseGoldReward}-{selectedExpedition.maxBaseGoldReward}</span>
                                        </div>
                                        <div className="bg-sky-900/10 border border-sky-600/30 p-3 rounded-xl flex justify-between items-center">
                                            <span className="text-sky-400 text-sm font-bold uppercase">Doświadczenie</span>
                                            <span className="text-white font-mono font-bold text-lg">{selectedExpedition.minBaseExperienceReward}-{selectedExpedition.maxBaseExperienceReward}</span>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <section className="bg-slate-800/20 p-6 rounded-2xl border border-slate-700/50 mb-8">
                                <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4 text-center">Analiza Zagrożeń</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {selectedExpedition.enemies.map(e => {
                                        const enemy = enemies.find(en => en.id === e.enemyId);
                                        return (
                                            <div key={e.enemyId} className="flex flex-col items-center p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                                                <span className="text-gray-300 text-xs font-bold text-center truncate w-full">{enemy?.name}</span>
                                                <span className="text-red-500/70 font-mono text-[10px] mt-1">{e.spawnChance}% spawn</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <button 
                                onClick={() => handleEmbark(selectedExpedition.id)} 
                                disabled={character.resources.gold < selectedExpedition.goldCost || character.stats.currentEnergy < selectedExpedition.energyCost}
                                className="mt-auto w-full py-5 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black text-2xl uppercase tracking-widest transition-all duration-300 shadow-xl shadow-green-900/20 active:scale-95 disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <span className="flex items-center justify-center gap-3">
                                    <SwordsIcon className="h-6 w-6 transition-transform group-hover:rotate-12" />
                                    {t('expedition.embark')}
                                </span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <MapIcon className="w-32 h-32 mb-4" />
                        <p className="text-xl font-bold uppercase tracking-widest">Wybierz cel podróży</p>
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
