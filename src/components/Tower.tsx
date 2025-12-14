
import React, { useState, useEffect, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { Tower as TowerType, ActiveTowerRun, ItemInstance, EssenceType, CombatLogEntry, ExpeditionRewardSummary, ItemTemplate, Enemy } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { rarityStyles, ItemListItem } from './shared/ItemSlot';
import { ExpeditionSummaryModal } from './combat/CombatSummary';

export const Tower: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const [towers, setTowers] = useState<TowerType[]>([]);
    const [activeRun, setActiveRun] = useState<ActiveTowerRun | null>(null);
    const [activeTower, setActiveTower] = useState<TowerType | null>(null);
    const [loading, setLoading] = useState(true);
    const [combatResult, setCombatResult] = useState<{ victory: boolean, combatLog: CombatLogEntry[], rewards?: any } | null>(null);
    const [reportOpen, setReportOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getTowers();
            if (data.activeRun) {
                setActiveRun(data.activeRun);
                setActiveTower(data.tower);
            } else {
                setTowers(data.towers || []);
                setActiveRun(null);
                setActiveTower(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStart = async (towerId: string) => {
        if (!confirm('Czy na pewno chcesz wejść do Wieży? Pamiętaj: zdrowie się nie regeneruje, a porażka oznacza utratę łupów!')) return;
        try {
            const res = await api.startTower(towerId);
            setActiveRun(res.activeRun);
            setActiveTower(res.tower);
            api.getCharacter().then(updateCharacter); // Sync energy/resources
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleFight = async () => {
        try {
            const res = await api.fightTower();
            setCombatResult(res);
            setReportOpen(true);
            
            if (res.victory) {
                // If victory, update active run state locally or re-fetch
                // We'll re-fetch in handleCloseReport if continue
            } else {
                // Defeat - cleared
                setActiveRun(null);
                setActiveTower(null);
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRetreat = async () => {
        if (!confirm('Czy na pewno chcesz uciec z wieży? Zabierzesz ze sobą wszystkie zgromadzone dotąd łupy.')) return;
        try {
            await api.retreatTower();
            fetchData();
            api.getCharacter().then(updateCharacter);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleContinue = async () => {
        try {
            const res = await api.continueTower();
            setActiveRun(res.activeRun);
            setCombatResult(null); // Clear previous result
        } catch (e: any) {
            alert(e.message);
        }
    };
    
    const handleCloseReport = () => {
        setReportOpen(false);
        if (combatResult?.victory) {
            // Check if completed (currentFloor >= total)
            const isCompleted = activeRun && activeTower && activeRun.currentFloor >= activeTower.totalFloors;
            if (isCompleted) {
                fetchData(); // Reset to lobby
                api.getCharacter().then(updateCharacter);
            } else {
                // Not completed, just refresh run state to see rewards in stash
                fetchData();
                api.getCharacter().then(updateCharacter); // Update HP snapshot
            }
        } else {
             // Defeat - already handled
             fetchData();
             api.getCharacter().then(updateCharacter);
        }
    };

    if (loading) return <ContentPanel title="Wieża Mroku"><p className="text-gray-500">Ładowanie...</p></ContentPanel>;
    if (!character || !gameData) return null;

    // --- Active Run View ---
    if (activeRun && activeTower) {
        const hpPercent = (activeRun.currentHealth / character.stats.maxHealth) * 100;
        const manaPercent = (activeRun.currentMana / character.stats.maxMana) * 100;
        const rewards = activeRun.accumulatedRewards;
        const isFightPending = combatResult === null; // Can fight if no pending result
        
        // Show report modal if open
        if (reportOpen && combatResult) {
             const summary: ExpeditionRewardSummary = {
                isVictory: combatResult.victory,
                totalGold: 0, // In tower, rewards accumulate, this is just for report display
                totalExperience: 0,
                itemsFound: [],
                essencesFound: {},
                combatLog: combatResult.combatLog,
                rewardBreakdown: [],
             };
             
             return (
                 <ExpeditionSummaryModal 
                    reward={summary}
                    onClose={handleCloseReport}
                    characterName={character.name}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    enemies={gameData.enemies}
                    // For tower reports, we might want to show loot gained THIS turn, but backend sends accumulated. 
                    // Let's rely on the combat log for now.
                 />
             );
        }

        return (
            <ContentPanel title={`Wieża Mroku: ${activeTower.name}`}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
                    
                    {/* Left: Status & Progress */}
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-purple-900/50 flex flex-col justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Piętro {activeRun.currentFloor} <span className="text-gray-500 text-lg">/ {activeTower.totalFloors}</span></h3>
                            <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden mb-6 border border-slate-600">
                                <div className="bg-purple-600 h-full transition-all" style={{ width: `${(activeRun.currentFloor / activeTower.totalFloors) * 100}%` }}></div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-300 font-bold">Zdrowie</span>
                                        <span className="text-white">{activeRun.currentHealth} / {character.stats.maxHealth}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                                        <div className="bg-red-600 h-full transition-all" style={{ width: `${hpPercent}%` }}></div>
                                    </div>
                                    <p className="text-xs text-red-400 mt-1 italic">Zdrowie nie regeneruje się automatycznie!</p>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-300 font-bold">Mana</span>
                                        <span className="text-white">{activeRun.currentMana} / {character.stats.maxMana}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                                        <div className="bg-blue-600 h-full transition-all" style={{ width: `${manaPercent}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3 mt-8">
                            <button 
                                onClick={handleFight}
                                className="w-full py-4 bg-red-700 hover:bg-red-600 rounded-lg text-white font-bold text-xl shadow-lg border border-red-500 flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
                            >
                                <SwordsIcon className="h-6 w-6"/> WALCZ
                            </button>
                            {/* Can only continue if combat result exists and victory - handled by modal close logic actually */}
                            
                            <button 
                                onClick={handleRetreat}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-gray-200 font-semibold border border-slate-500"
                            >
                                Uciekaj z Łupami
                            </button>
                        </div>
                    </div>

                    {/* Right: Loot Stash */}
                    <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-amber-900/30 flex flex-col">
                        <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                            <CoinsIcon className="h-6 w-6"/> Zgromadzone Łupy
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Te przedmioty trafią do Ciebie <strong>tylko</strong> jeśli uciekniesz lub ukończysz wieżę. Porażka oznacza ich utratę.
                        </p>
                        
                        <div className="flex gap-4 mb-4 text-lg font-mono bg-slate-800/50 p-3 rounded-lg">
                            <span className="text-amber-400 font-bold flex items-center gap-1">{rewards.gold} <span className="text-xs text-gray-500">Złota</span></span>
                            <span className="text-sky-400 font-bold flex items-center gap-1">{rewards.experience} <span className="text-xs text-gray-500">XP</span></span>
                        </div>

                        <div className="flex-grow overflow-y-auto pr-2 space-y-2 bg-slate-800/30 p-2 rounded-lg border border-slate-700/50">
                            {rewards.items.length === 0 && Object.keys(rewards.essences).length === 0 && <p className="text-gray-500 text-center py-8">Pusty worek.</p>}
                            
                            {/* Essences */}
                            {Object.entries(rewards.essences).map(([key, amount]) => (
                                <div key={key} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-600">
                                    <span className="text-sm text-white">{key}</span>
                                    <span className="font-mono font-bold text-green-400">x{amount as number}</span>
                                </div>
                            ))}

                            {/* Items */}
                            {rewards.items.map((item: ItemInstance) => {
                                const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                                if (!template) return null;
                                return (
                                    <ItemListItem 
                                        key={item.uniqueId} 
                                        item={item} 
                                        template={template} 
                                        affixes={gameData.affixes} 
                                        isSelected={false} 
                                        onClick={()=>{}} 
                                        showPrimaryStat={false} 
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    // --- Lobby View ---
    return (
        <ContentPanel title="Wieża Mroku">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {towers.length === 0 && <p className="text-gray-500 col-span-full text-center py-12">Brak wież w tej lokacji.</p>}
                {towers.map(tower => (
                    <div key={tower.id} className="bg-slate-800/80 border border-purple-500/30 p-6 rounded-xl shadow-lg hover:border-purple-500 transition-colors flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShieldIcon className="h-32 w-32 text-purple-600" />
                        </div>
                        
                        <h3 className="text-xl font-bold text-white mb-2 relative z-10">{tower.name}</h3>
                        <p className="text-sm text-gray-400 mb-4 flex-grow relative z-10">{tower.description}</p>
                        
                        <div className="space-y-2 mb-6 text-sm relative z-10">
                            <p className="flex justify-between"><span className="text-gray-500">Piętra:</span> <span className="text-white font-bold">{tower.totalFloors}</span></p>
                            <p className="flex justify-between"><span className="text-gray-500">Lokacja:</span> <span className="text-indigo-300">{gameData.locations.find(l => l.id === tower.locationId)?.name}</span></p>
                        </div>
                        
                        {tower.grandPrize && (
                             <div className="bg-amber-900/20 p-3 rounded border border-amber-700/30 mb-4 relative z-10">
                                 <p className="text-xs text-amber-500 font-bold uppercase mb-1">Nagroda Główna</p>
                                 <div className="flex gap-4 text-sm font-mono">
                                     <span className="text-amber-300">{tower.grandPrize.gold}g</span>
                                     <span className="text-sky-300">{tower.grandPrize.experience}xp</span>
                                 </div>
                             </div>
                        )}

                        <button 
                            onClick={() => handleStart(tower.id)}
                            className="w-full py-3 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-lg shadow-md transition-all relative z-10"
                        >
                            Wejdź do Wieży
                        </button>
                    </div>
                ))}
            </div>
        </ContentPanel>
    );
};
