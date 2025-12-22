
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
        if (!window.confirm("Czy na pewno chcesz przerwać tę misję? Odzyskasz zużyte zasoby, ale Twoja postać wróci do obozu.")) return;
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
        }
    }, [availableExpeditions, selectedExpedition]);

    const handleEmbark = (expId: string) => {
        if (character.stats.currentHealth < character.stats.maxHealth * 0.15) {
            if (window.confirm("Twoje zdrowie jest niebezpiecznie niskie. Wyruszenie na wyprawę w tym stanie to niemal pewna śmierć. Czy na pewno chcesz podjąć ryzyko?")) {
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
            <ContentPanel title="Wyprawa w toku">
                <div className="flex flex-col gap-6 h-full animate-fade-in max-w-5xl mx-auto">
                    {/* Panoramiczny podgląd trwającej misji */}
                    <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-indigo-500/30 shadow-2xl">
                         {expedition?.image ? (
                            <img src={expedition.image} alt={expedition.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                <MapIcon className="w-20 h-20 text-slate-800" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-end">
                            <div>
                                <h3 className="text-4xl font-black text-white mb-2 tracking-tight">{expedition?.name}</h3>
                                <p className="text-indigo-300 font-bold uppercase tracking-widest text-sm">Status: Przemierzanie nieznanego</p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-400 text-xs font-black uppercase mb-1">Pozostały czas</p>
                                <p className="text-5xl font-mono font-bold text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]">
                                    {formatTimeLeft(timeLeft)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                             <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Cel i opis</h4>
                             <p className="text-gray-300 italic leading-relaxed">"{expedition?.description}"</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={onCompletion} 
                                disabled={timeLeft > 0} 
                                className="w-full py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-2xl transition-all disabled:grayscale disabled:opacity-30 shadow-xl shadow-indigo-900/20 active:scale-95"
                            >
                                {timeLeft > 0 ? "Wyprawa trwa..." : "Zakończ i odbierz łupy"}
                            </button>
                            <button onClick={onCancelExpedition} className="py-3 text-red-400 hover:text-red-300 font-bold uppercase tracking-tighter transition-colors">
                                Przerwij ekspedycję i wróć
                            </button>
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    return (
        <ContentPanel title="Dostępne Wyprawy">
            <div className="flex flex-col lg:flex-row gap-8 h-full">
                {/* LISTA WYPRAW (Lewy Panel) */}
                <div className="w-full lg:w-72 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
                    {availableExpeditions.length === 0 ? (
                        <p className="text-gray-500 italic text-center py-10">Brak dostępnych wypraw w tej lokacji.</p>
                    ) : (
                        availableExpeditions.map(exp => (
                            <button 
                                key={exp.id}
                                onClick={() => setSelectedExpedition(exp)}
                                className={`group flex flex-col p-4 rounded-xl border-2 transition-all text-left ${selectedExpedition?.id === exp.id ? 'bg-indigo-600/10 border-indigo-500 shadow-lg' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}
                            >
                                <p className={`font-bold text-sm ${selectedExpedition?.id === exp.id ? 'text-white' : 'text-gray-400'}`}>{exp.name}</p>
                                <div className="flex items-center gap-3 mt-2 text-[10px] font-bold opacity-60">
                                     <span className="flex items-center text-amber-500"><CoinsIcon className="h-3 w-3 mr-1"/> {exp.goldCost}</span>
                                     <span className="flex items-center text-sky-400"><BoltIcon className="h-3 w-3 mr-1"/> {exp.energyCost}</span>
                                     <span className="flex items-center text-gray-300"><ClockIcon className="h-3 w-3 mr-1"/> {formatDuration(exp.duration)}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* SZCZEGÓŁY (Prawy Panel - Układ Pionowy: Image Top, Info Bottom) */}
                {selectedExpedition ? (
                    <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                        
                        {/* 1. SEKCJA GÓRNA: GRAFIKA */}
                        <div className="relative aspect-video w-full rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl group">
                            {selectedExpedition.image ? (
                                <img src={selectedExpedition.image} alt={selectedExpedition.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                            ) : (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                    <MapIcon className="w-32 h-32 text-slate-800 opacity-20" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                            <div className="absolute bottom-6 left-8">
                                <h3 className="text-5xl font-black text-white tracking-tighter drop-shadow-2xl">{selectedExpedition.name}</h3>
                                <p className="text-indigo-400 font-bold uppercase tracking-[0.2em] text-xs mt-2">Miejsce przeznaczenia</p>
                            </div>
                        </div>

                        {/* 2. SEKCJA DOLNA: INFORMACJE */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* Koszty i Czas */}
                            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col gap-4">
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <ClockIcon className="h-4 w-4" /> Wymagania i Czas
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-xl">
                                        <span className="text-gray-400 text-sm font-medium">Czas trwania</span>
                                        <span className="text-white font-bold">{formatDuration(selectedExpedition.duration)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-xl">
                                        <span className="text-gray-400 text-sm font-medium">Złoto (Koszt)</span>
                                        <span className={`font-bold ${character.resources.gold >= selectedExpedition.goldCost ? 'text-white' : 'text-red-500'}`}>{selectedExpedition.goldCost}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-xl">
                                        <span className="text-gray-400 text-sm font-medium">Energia (Koszt)</span>
                                        <span className={`font-bold ${character.stats.currentEnergy >= selectedExpedition.energyCost ? 'text-white' : 'text-red-500'}`}>{selectedExpedition.energyCost}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Potencjalne Nagrody */}
                            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col gap-4">
                                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                    <StarIcon className="h-4 w-4" /> Możliwe Łupy
                                </h4>
                                <div className="space-y-3">
                                    <div className="p-4 bg-amber-900/10 border border-amber-600/20 rounded-xl flex flex-col gap-1">
                                        <span className="text-amber-500/80 text-[10px] font-black uppercase">Złoto</span>
                                        <span className="text-2xl font-mono font-bold text-white">{selectedExpedition.minBaseGoldReward} - {selectedExpedition.maxBaseGoldReward}</span>
                                    </div>
                                    <div className="p-4 bg-sky-900/10 border border-sky-600/20 rounded-xl flex flex-col gap-1">
                                        <span className="text-sky-400/80 text-[10px] font-black uppercase">Doświadczenie</span>
                                        <span className="text-2xl font-mono font-bold text-white">{selectedExpedition.minBaseExperienceReward} - {selectedExpedition.maxBaseExperienceReward}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Analiza Zagrożeń */}
                            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col gap-4">
                                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldIcon className="h-4 w-4" /> Wywiad (Wrogowie)
                                </h4>
                                <div className="flex-grow overflow-y-auto max-h-[160px] pr-2 space-y-2 custom-scrollbar">
                                    {selectedExpedition.enemies.map(e => {
                                        const enemy = enemies.find(en => en.id === e.enemyId);
                                        return (
                                            <div key={e.enemyId} className="flex justify-between items-center p-2 bg-slate-950/30 rounded-lg border border-white/5">
                                                <span className="text-gray-300 text-sm font-bold truncate pr-2">{enemy?.name}</span>
                                                <span className="text-red-500/70 font-mono text-[10px] whitespace-nowrap">{e.spawnChance}% szans</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>

                        {/* PRZYCISK AKCJI */}
                        <button 
                            onClick={() => handleEmbark(selectedExpedition.id)} 
                            disabled={character.resources.gold < selectedExpedition.goldCost || character.stats.currentEnergy < selectedExpedition.energyCost}
                            className="w-full py-8 rounded-3xl bg-green-600 hover:bg-green-500 text-white font-black text-3xl uppercase tracking-widest transition-all duration-300 shadow-2xl shadow-green-950/40 active:scale-[0.98] disabled:grayscale disabled:opacity-20 disabled:cursor-not-allowed group"
                        >
                            <span className="flex items-center justify-center gap-4">
                                <SwordsIcon className="h-8 w-8 transition-transform group-hover:rotate-12" />
                                Wyrusz na wyprawę
                            </span>
                        </button>

                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 grayscale">
                        <MapIcon className="w-48 h-48 mb-6" />
                        <p className="text-3xl font-black uppercase tracking-[0.3em]">Wybierz cel podróży</p>
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
