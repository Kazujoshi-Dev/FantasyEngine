
import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { Expedition as ExpeditionType, Enemy } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { StarIcon } from './icons/StarIcon';
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
                             <div className="aspect-video relative">
                                {expedition?.image ? (
                                    <img src={expedition.image} alt={expedition.name} className="w-full h-full object-cover object-center" />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                        <BoltIcon className="w-20 h-20 text-slate-700 opacity-20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                                <div className="absolute bottom-4 left-0 right-0 text-center">
                                     <span className="px-4 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg border border-indigo-400/30">
                                        Eksploracja Świata
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col items-center">
                            <h3 className="text-xl font-bold text-white mb-6 text-center">{expedition?.name}</h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">{t('expedition.endsIn')}</p>
                            <div className="text-5xl font-mono font-bold text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)] mb-8">
                                {formatTimeLeft(timeLeft)}
                            </div>
                            <button 
                                onClick={onCompletion} 
                                disabled={timeLeft > 0} 
                                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl transition-all disabled:bg-slate-700 disabled:text-gray-500 active:scale-95 mb-4 shadow-lg shadow-indigo-900/20"
                            >
                                {timeLeft > 0 ? t('expedition.inProgress') : t('expedition.finish')}
                            </button>
                            <button onClick={onCancelExpedition} className="text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-widest transition-colors opacity-60 hover:opacity-100">
                                Przerwij Wyprawę
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-slate-900/20 p-8 rounded-2xl border border-slate-800/50 backdrop-blur-sm overflow-y-auto">
                        <div className="max-w-2xl mx-auto space-y-8">
                            <section>
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                    <ShieldIcon className="h-4 w-4" /> Raport Terenowy
                                </h4>
                                <div className="text-gray-300 italic leading-relaxed text-lg text-center bg-slate-800/30 p-8 rounded-2xl border border-slate-700/30 shadow-inner">
                                    "{expedition?.description}"
                                </div>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Potencjalne Zagrożenia</h5>
                                    <div className="space-y-3">
                                        {expedition?.enemies.map(e => {
                                            const enemy = enemies.find(en => en.id === e.enemyId);
                                            return (
                                                <div key={e.enemyId} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                                    <span className="text-gray-300 font-bold">{enemy?.name}</span>
                                                    <span className="text-red-400/80 font-mono text-[10px] bg-red-950/30 px-2 py-0.5 rounded">{e.spawnChance}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                                    <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] mb-4">Zakontraktowane Łupy</h5>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <CoinsIcon className="h-6 w-6 text-amber-500" />
                                                <span className="text-gray-400 text-xs font-bold uppercase tracking-tighter">Złoto</span>
                                            </div>
                                            <span className="text-white font-mono font-bold">{expedition?.minBaseGoldReward}-{expedition?.maxBaseBaseGoldReward}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <StarIcon className="h-6 w-6 text-sky-400" />
                                                <span className="text-gray-400 text-xs font-bold uppercase tracking-tighter">Doświadczenie</span>
                                            </div>
                                            <span className="text-white font-mono font-bold">{expedition?.minBaseExperienceReward}-{expedition?.maxBaseExperienceReward} XP</span>
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
                    <div className="flex-1 bg-slate-900/40 rounded-3xl border border-slate-700/50 flex flex-col lg:flex-row overflow-hidden animate-fade-in shadow-2xl">
                        {/* Lewa strona detali: Obrazek w proporcji Portrait Card */}
                        <div className="w-full lg:w-[420px] bg-slate-950 flex flex-col border-r border-slate-800/50">
                            <div className="aspect-[4/5] w-full relative overflow-hidden group shadow-[inset_0_-100px_80px_-20px_rgba(2,6,23,0.9)]">
                                {selectedExpedition.image ? (
                                    <img src={selectedExpedition.image} alt={selectedExpedition.name} className="w-full h-full object-cover object-center transition-transform duration-1000 group-hover:scale-110" />
                                ) : (
                                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                        <MapIcon className="w-24 h-24 text-slate-800" />
                                    </div>
                                )}
                                {/* Vignette overlays to avoid "cut" look */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
                                <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.4)]"></div>
                            </div>
                            <div className="p-8 flex-grow flex flex-col justify-center bg-slate-950">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4 text-center">Cel Operacji</h4>
                                <p className="text-gray-300 italic text-sm leading-relaxed text-center px-4">
                                    "{selectedExpedition.description}"
                                </p>
                            </div>
                        </div>

                        {/* Prawa strona detali: Statystyki i Przycisk */}
                        <div className="flex-1 p-10 flex flex-col bg-gradient-to-br from-slate-900/60 to-slate-950/60">
                            <div className="mb-10 border-b border-white/5 pb-6">
                                <h3 className="text-4xl font-black text-white mb-3 tracking-tight">{selectedExpedition.name}</h3>
                                <div className="flex gap-4">
                                    <span className="flex items-center text-[10px] text-gray-400 font-black uppercase tracking-widest bg-slate-950/50 px-4 py-1.5 rounded-full border border-slate-800 shadow-inner">
                                        <ClockIcon className="h-3 w-3 mr-2 text-indigo-400" /> Czas podróży: {formatDuration(selectedExpedition.duration)}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                {/* Wymagania */}
                                <section>
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                                        <ShieldIcon className="h-4 w-4" /> Inwestycja (Koszt)
                                    </h4>
                                    <div className="space-y-4">
                                        <div className={`flex justify-between items-center p-4 rounded-2xl border-2 transition-all ${character.resources.gold >= selectedExpedition.goldCost ? 'bg-slate-800/40 border-slate-700/50' : 'bg-red-900/10 border-red-900/30'}`}>
                                            <div className="flex items-center gap-3">
                                                <CoinsIcon className={`h-6 w-6 ${character.resources.gold >= selectedExpedition.goldCost ? 'text-amber-400' : 'text-red-500'}`} />
                                                <span className="text-gray-300 font-black text-xs uppercase tracking-tight">{t('resources.gold')}</span>
                                            </div>
                                            <span className={`font-mono text-xl font-bold ${character.resources.gold >= selectedExpedition.goldCost ? 'text-white' : 'text-red-500'}`}>
                                                {selectedExpedition.goldCost.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className={`flex justify-between items-center p-4 rounded-2xl border-2 transition-all ${character.stats.currentEnergy >= selectedExpedition.energyCost ? 'bg-slate-800/40 border-slate-700/50' : 'bg-red-900/10 border-red-900/30'}`}>
                                            <div className="flex items-center gap-3">
                                                <BoltIcon className={`h-6 w-6 ${character.stats.currentEnergy >= selectedExpedition.energyCost ? 'text-sky-400' : 'text-red-500'}`} />
                                                <span className="text-gray-300 font-black text-xs uppercase tracking-tight">Energia</span>
                                            </div>
                                            <span className={`font-mono text-xl font-bold ${character.stats.currentEnergy >= selectedExpedition.energyCost ? 'text-white' : 'text-red-500'}`}>
                                                {selectedExpedition.energyCost}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                {/* Nagrody */}
                                <section>
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                                        <StarIcon className="h-4 w-4" /> Nagroda (Estymacja)
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="bg-amber-900/10 border-2 border-amber-600/20 p-4 rounded-2xl flex justify-between items-center shadow-inner">
                                            <span className="text-amber-500/80 text-[10px] font-black uppercase tracking-widest">Skarby</span>
                                            <span className="text-white font-mono font-bold text-xl">{selectedExpedition.minBaseGoldReward}-{selectedExpedition.maxBaseGoldReward}</span>
                                        </div>
                                        <div className="bg-sky-900/10 border-2 border-sky-600/20 p-4 rounded-2xl flex justify-between items-center shadow-inner">
                                            <span className="text-sky-400/80 text-[10px] font-black uppercase tracking-widest">Wiedza</span>
                                            <span className="text-white font-mono font-bold text-xl">{selectedExpedition.minBaseExperienceReward}-{selectedExpedition.maxBaseExperienceReward}</span>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <section className="bg-slate-800/20 p-6 rounded-2xl border border-slate-700/50 mb-10 shadow-inner">
                                <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-5 text-center">Możliwi Przeciwnicy</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {selectedExpedition.enemies.map(e => {
                                        const enemy = enemies.find(en => en.id === e.enemyId);
                                        return (
                                            <div key={e.enemyId} className="flex flex-col items-center p-3 rounded-xl bg-slate-950/40 border border-slate-800 shadow-sm transition-transform hover:scale-105">
                                                <span className="text-gray-300 text-xs font-black uppercase tracking-tighter text-center truncate w-full">{enemy?.name}</span>
                                                <span className="text-red-500/60 font-mono text-[9px] mt-1.5 font-bold">{e.spawnChance}% Szans</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <button 
                                onClick={() => handleEmbark(selectedExpedition.id)} 
                                disabled={character.resources.gold < selectedExpedition.goldCost || character.stats.currentEnergy < selectedExpedition.energyCost}
                                className="mt-auto w-full py-6 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black text-2xl uppercase tracking-[0.1em] transition-all duration-300 shadow-2xl shadow-green-950/40 active:scale-[0.98] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed group border-t border-white/20"
                            >
                                <span className="flex items-center justify-center gap-4">
                                    <SwordsIcon className="h-7 w-7 transition-transform group-hover:rotate-12" />
                                    {t('expedition.embark')}
                                </span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 h-full">
                        <MapIcon className="w-40 h-40 mb-6 text-indigo-400" />
                        <p className="text-2xl font-black uppercase tracking-[0.4em] text-white">Wybierz cel podróży</p>
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
