
import React, { useState, useEffect, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { Tower as TowerType, ActiveTowerRun, ExpeditionRewardSummary } from '../types';
import { useCharacter } from '@/contexts/CharacterContext';
import { ExpeditionSummaryModal } from './combat/CombatSummary';
import { CoinsIcon } from './icons/CoinsIcon';
import { SwordsIcon } from './icons/SwordsIcon';

export const Tower: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    
    const [towers, setTowers] = useState<TowerType[]>([]);
    const [selectedTower, setSelectedTower] = useState<TowerType | null>(null);
    const [activeRun, setActiveRun] = useState<ActiveTowerRun | null>(null);
    
    const [report, setReport] = useState<ExpeditionRewardSummary | null>(null);
    const [isReportOpen, setIsReportOpen] = useState(false);

    const fetchTowers = useCallback(async () => {
        try {
            const data = await api.getTowers();
            if (data.activeRun) {
                setActiveRun(data.activeRun);
                // The API returns the specific tower object if a run exists
                if (data.tower) setSelectedTower(data.tower);
            } else {
                setTowers(data.towers || []);
                setActiveRun(null);
                // Don't auto-select if we are just browsing list and didn't select one manually yet
                if (!selectedTower && data.towers && data.towers.length > 0) {
                     setSelectedTower(data.towers[0]);
                }
            }
        } catch (e: any) {
            console.error(e);
        }
    }, [selectedTower]);

    useEffect(() => {
        fetchTowers();
    }, [fetchTowers]);

    const handleStart = async () => {
        if (!selectedTower) return;
        try {
            const res = await api.startTower(selectedTower.id);
            setActiveRun(res.activeRun);
            // Refresh character for energy deduction
            const char = await api.getCharacter();
            updateCharacter(char);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleFight = async () => {
        try {
            const res = await api.fightTower();
            // res: { victory, combatLog, rewards, isTowerComplete, currentFloor }
            
            const summary: ExpeditionRewardSummary = {
                isVictory: res.victory,
                totalGold: 0, 
                totalExperience: 0,
                itemsFound: [],
                essencesFound: {},
                combatLog: res.combatLog,
                rewardBreakdown: []
            };

            setReport(summary);
            setIsReportOpen(true);

            if (res.victory) {
                if (res.isTowerComplete) {
                     setActiveRun(null); // Will show list after closing report
                     fetchTowers();
                } else {
                    // Update local active run state
                    setActiveRun(prev => prev ? {
                        ...prev,
                        currentFloor: res.currentFloor,
                        accumulatedRewards: res.rewards,
                    } : null);
                }
            } else {
                setActiveRun(null);
                fetchTowers();
            }
            
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRetreat = async () => {
        if (!confirm('Czy na pewno chcesz się wycofać? Otrzymasz zgromadzone nagrody, ale postęp zostanie zresetowany.')) return;
        try {
            await api.retreatTower();
            setActiveRun(null);
            fetchTowers();
            const char = await api.getCharacter();
            updateCharacter(char);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleCloseReport = async () => {
        setIsReportOpen(false);
        setReport(null);
        const char = await api.getCharacter();
        updateCharacter(char);
        // If run finished (win or loss), we need to refresh the view to show list again
        if (!activeRun || (report && !report.isVictory)) {
            fetchTowers();
        }
    };

    if (!gameData) return null;

    return (
        <ContentPanel title="Wieża Mroku">
            {isReportOpen && report && (
                <ExpeditionSummaryModal 
                    reward={report}
                    onClose={handleCloseReport}
                    characterName={character?.name || ''}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    enemies={gameData.enemies}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
                {/* Left: Tower List (if no active run) OR Run Stats */}
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col min-h-0">
                    {activeRun ? (
                        <>
                            <h3 className="text-xl font-bold text-amber-400 mb-4">Wyprawa w toku</h3>
                            <div className="space-y-4">
                                <div className="bg-slate-800 p-3 rounded">
                                    <p className="text-sm text-gray-400">Piętro</p>
                                    <p className="text-2xl font-bold text-white">{activeRun.currentFloor} <span className="text-sm text-gray-500">/ {selectedTower?.totalFloors}</span></p>
                                </div>
                                <div className="bg-slate-800 p-3 rounded">
                                    <p className="text-sm text-gray-400">Zgromadzone Złoto</p>
                                    <p className="text-xl font-mono text-amber-400">{activeRun.accumulatedRewards?.gold || 0}</p>
                                </div>
                                 <div className="bg-slate-800 p-3 rounded">
                                    <p className="text-sm text-gray-400">Zgromadzone Przedmioty</p>
                                    <p className="text-xl font-mono text-indigo-400">{activeRun.accumulatedRewards?.items?.length || 0}</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="text-xl font-bold text-indigo-400 mb-4">Dostępne Wieże</h3>
                            <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                                {towers.map(tower => (
                                    <button 
                                        key={tower.id}
                                        onClick={() => setSelectedTower(tower)}
                                        className={`w-full text-left p-3 rounded border transition-colors ${selectedTower?.id === tower.id ? 'bg-indigo-900/50 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                                    >
                                        <p className="font-bold text-white">{tower.name}</p>
                                        <p className="text-xs text-gray-400">{tower.totalFloors} Pięter</p>
                                    </button>
                                ))}
                                {towers.length === 0 && <p className="text-gray-500 text-center">Brak dostępnych wież w tej lokacji.</p>}
                            </div>
                        </>
                    )}
                </div>

                {/* Center & Right: Tower Details / Action Area */}
                <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col relative overflow-hidden">
                    {selectedTower ? (
                        <>
                             {/* Background Image Effect */}
                            {selectedTower.image && (
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    <img src={selectedTower.image} alt={selectedTower.name} className="w-full h-full object-cover opacity-20" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
                                </div>
                            )}
                            
                            <div className="relative z-10 flex flex-col h-full">
                                <h2 className="text-3xl font-bold text-white mb-2">{selectedTower.name}</h2>
                                <p className="text-gray-400 italic mb-6">{selectedTower.description}</p>
                                
                                {activeRun ? (
                                    <div className="mt-auto space-y-4">
                                        <div className="p-4 bg-black/40 rounded border border-slate-600 text-center">
                                            <p className="text-lg text-white mb-2">Przygotuj się do walki na piętrze {activeRun.currentFloor}!</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <button onClick={handleRetreat} className="flex-1 py-3 bg-red-900/80 hover:bg-red-800 text-red-100 font-bold rounded border border-red-700">
                                                Wycofaj się
                                            </button>
                                            <button onClick={handleFight} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg shadow-indigo-500/20">
                                                <SwordsIcon className="h-5 w-5 inline-block mr-2" />
                                                Walcz!
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-auto">
                                        <div className="p-4 bg-slate-800/50 rounded mb-4">
                                            <h4 className="font-bold text-amber-400 mb-2">Nagroda Główna</h4>
                                            <div className="flex gap-4 text-sm">
                                                <span className="flex items-center text-amber-300"><CoinsIcon className="h-4 w-4 mr-1"/> {selectedTower.grandPrize?.gold || 0}</span>
                                                <span className="flex items-center text-sky-300">XP {selectedTower.grandPrize?.experience || 0}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleStart} 
                                            disabled={character?.activeExpedition !== null || character?.activeTravel !== null || character?.isResting}
                                            className="w-full py-4 bg-green-700 hover:bg-green-600 text-white font-bold rounded text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Wkrocz do Wieży
                                        </button>
                                        {(character?.activeExpedition || character?.activeTravel || character?.isResting) && (
                                            <p className="text-center text-red-400 text-sm mt-2">Twoja postać jest zajęta.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Wybierz wieżę z listy.
                        </div>
                    )}
                </div>
            </div>
        </ContentPanel>
    );
};
