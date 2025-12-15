
import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { Tower as TowerType, ActiveTowerRun, ExpeditionRewardSummary, ItemTemplate, Affix, Enemy } from '../types';
import { useCharacter } from '@/contexts/CharacterContext';
import { ExpeditionSummaryModal } from './combat/CombatSummary';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';

export const Tower: React.FC = () => {
    const { t } = useTranslation();
    const { character, gameData, updateCharacter } = useCharacter();
    const [towers, setTowers] = useState<TowerType[]>([]);
    const [activeRun, setActiveRun] = useState<ActiveTowerRun | null>(null);
    const [currentTower, setCurrentTower] = useState<TowerType | null>(null); // Tower data for active run
    const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null); // For browsing list
    const [combatResult, setCombatResult] = useState<ExpeditionRewardSummary | null>(null);
    const [loading, setLoading] = useState(false);

    // Initial fetch
    useEffect(() => {
        fetchTowerData();
    }, []);

    const fetchTowerData = async () => {
        setLoading(true);
        try {
            const data = await api.getTowers();
            if (data.activeRun) {
                setActiveRun(data.activeRun);
                setCurrentTower(data.tower);
            } else {
                setActiveRun(null);
                setCurrentTower(null);
                setTowers(data.towers || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async (towerId: string) => {
        try {
            const { activeRun: newRun, tower } = await api.startTower(towerId);
            const char = await api.getCharacter();
            updateCharacter(char);
            setActiveRun(newRun);
            setCurrentTower(tower);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleFight = async () => {
        try {
            const result = await api.fightTower();
            setCombatResult({
                isVictory: result.victory,
                totalGold: 0, 
                totalExperience: 0,
                itemsFound: [],
                essencesFound: {},
                combatLog: result.combatLog,
                rewardBreakdown: []
            });
            
            // Update character (health/mana/rewards)
            const char = await api.getCharacter();
            updateCharacter(char);
            
            // Refresh tower state to sync floors
            fetchTowerData();

        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRetreat = async () => {
        if (!confirm('Czy na pewno chcesz się wycofać? Otrzymasz zgromadzone nagrody.')) return;
        try {
            await api.retreatTower();
            const char = await api.getCharacter();
            updateCharacter(char);
            fetchTowerData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (!gameData) return null;

    // View: List of Towers
    if (!activeRun) {
        const selectedTower = towers.find(t => t.id === selectedTowerId);

        return (
            <ContentPanel title="Wieża Mroku">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[75vh]">
                    {/* List */}
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 overflow-y-auto">
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">Dostępne Wieże</h3>
                        <div className="space-y-2">
                            {towers.map(tower => (
                                <div 
                                    key={tower.id} 
                                    onClick={() => setSelectedTowerId(tower.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTowerId === tower.id ? 'bg-indigo-900/40 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <h4 className="font-bold text-white">{tower.name}</h4>
                                    <p className="text-xs text-gray-400">{tower.totalFloors} Pięter</p>
                                </div>
                            ))}
                            {towers.length === 0 && <p className="text-gray-500 text-center">Brak dostępnych wież w tej lokacji.</p>}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="md:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col relative overflow-hidden">
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
                                    <p className="text-gray-300 italic mb-6">{selectedTower.description}</p>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600">
                                            <p className="text-xs text-gray-400 uppercase tracking-widest">Piętra</p>
                                            <p className="text-2xl font-bold text-white">{selectedTower.totalFloors}</p>
                                        </div>
                                        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600">
                                            <p className="text-xs text-gray-400 uppercase tracking-widest">Główna Nagroda</p>
                                            <div className="flex items-center gap-2">
                                                {selectedTower.grandPrize.gold > 0 && <span className="text-amber-400 font-bold flex items-center"><CoinsIcon className="h-4 w-4 mr-1"/> {selectedTower.grandPrize.gold}</span>}
                                                {selectedTower.grandPrize.items.length > 0 && <span className="text-purple-400 font-bold flex items-center"><StarIcon className="h-4 w-4 mr-1"/> Przedmioty</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <button 
                                            onClick={() => handleStart(selectedTower.id)}
                                            className="w-full py-4 bg-red-700 hover:bg-red-600 text-white font-bold text-xl rounded-lg shadow-lg shadow-red-900/20 transition-all transform hover:scale-[1.02]"
                                        >
                                            Wejdź do Wieży
                                        </button>
                                        <p className="text-center text-xs text-gray-500 mt-2">Wymaga energii. Postęp jest zapisywany co piętro.</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                Wybierz wieżę, aby zobaczyć szczegóły.
                            </div>
                        )}
                    </div>
                </div>
            </ContentPanel>
        );
    }

    // View: Active Run
    if (activeRun && currentTower) {
        const floorConfig = currentTower.floors.find(f => f.floorNumber === activeRun.currentFloor);
        const progressPercent = ((activeRun.currentFloor - 1) / currentTower.totalFloors) * 100;
        
        return (
            <ContentPanel title={`Wieża: ${currentTower.name}`}>
                {combatResult && (
                    <ExpeditionSummaryModal 
                        reward={combatResult} 
                        onClose={() => setCombatResult(null)} 
                        characterName={character?.name || ''}
                        itemTemplates={gameData.itemTemplates}
                        affixes={gameData.affixes}
                        enemies={gameData.enemies}
                        isHunting={true} 
                    />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
                    {/* Left: Status */}
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col gap-6">
                        <div>
                            <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Postęp</p>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-3xl font-bold text-white">Piętro {activeRun.currentFloor}</span>
                                <span className="text-lg text-gray-500">/ {currentTower.totalFloors}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                                <div className="bg-purple-600 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-600">
                                <p className="text-xs text-gray-400 mb-1">Twoje Zdrowie (w Wieży)</p>
                                <p className="text-xl font-bold text-green-400">{activeRun.currentHealth} HP</p>
                                <p className="text-xs text-gray-500 mt-1">Obrażenia są trwałe pomiędzy piętrami.</p>
                            </div>
                            
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-600">
                                <p className="text-xs text-gray-400 mb-1">Zgromadzone Nagrody</p>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-300">Złoto:</span>
                                        <span className="text-amber-400 font-mono">{activeRun.accumulatedRewards.gold}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-300">XP:</span>
                                        <span className="text-sky-400 font-mono">{activeRun.accumulatedRewards.experience}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-300">Przedmioty:</span>
                                        <span className="text-white font-mono">{activeRun.accumulatedRewards.items.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button 
                                onClick={handleRetreat}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-gray-200 font-bold rounded-lg transition-colors border border-slate-500"
                            >
                                Wycofaj się (Zabierz nagrody)
                            </button>
                        </div>
                    </div>

                    {/* Right: Action */}
                    <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-purple-900/30 flex flex-col relative overflow-hidden">
                         {currentTower.image && (
                            <div className="absolute inset-0 z-0 pointer-events-none opacity-10">
                                <img src={currentTower.image} className="w-full h-full object-cover" alt="Tower Background" />
                            </div>
                        )}

                        <div className="relative z-10 flex flex-col h-full justify-center items-center text-center">
                            <CrossedSwordsIcon className="h-24 w-24 text-red-500 mb-6 opacity-80" />
                            
                            <h3 className="text-3xl font-bold text-white mb-2">Piętro {activeRun.currentFloor}</h3>
                            {floorConfig?.enemies && floorConfig.enemies.length > 0 && (
                                <p className="text-gray-400 mb-8">
                                    Przeciwnicy: <span className="text-red-400 font-bold">{floorConfig.enemies.length}</span> (Szansa na Bossa: {floorConfig.enemies.some(e => {
                                        const en = gameData.enemies.find(x => x.id === e.enemyId);
                                        return en?.isBoss;
                                    }) ? 'Wysoka' : 'Niska'})
                                </p>
                            )}

                            <button 
                                onClick={handleFight}
                                disabled={(character?.stats?.currentEnergy || 0) < (floorConfig?.energyCost || 0)}
                                className="px-12 py-4 bg-red-700 hover:bg-red-600 text-white font-bold text-2xl rounded-full shadow-xl shadow-red-900/40 transition-transform transform hover:scale-105 disabled:bg-slate-700 disabled:shadow-none disabled:transform-none"
                            >
                                WALCZ
                            </button>
                            
                            {floorConfig?.energyCost && floorConfig.energyCost > 0 && (
                                <p className="mt-4 text-sky-400 font-bold flex items-center justify-center gap-2">
                                    Koszt: {floorConfig.energyCost} Energii
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    return null;
};
