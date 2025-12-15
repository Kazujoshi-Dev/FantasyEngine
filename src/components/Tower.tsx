
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { Tower as TowerType, ActiveTowerRun, ItemInstance, EssenceType, ItemTemplate, Enemy, ItemRarity, ExpeditionRewardSummary } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { StarIcon } from './icons/StarIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon';
import { rarityStyles, ItemListItem, ItemDetailsPanel, getGrammaticallyCorrectFullName } from './shared/ItemSlot';
import { useTranslation } from '../contexts/LanguageContext';
import { ExpeditionSummaryModal } from './combat/CombatSummary';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

// --- Sub-component: Tower Summary View (End Game) ---
interface TowerSummaryProps {
    outcome: 'VICTORY' | 'DEFEAT' | 'RETREAT';
    rewards: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
    };
    onClose: () => void;
    itemTemplates: ItemTemplate[];
    affixes: any[];
}

const TowerSummaryView: React.FC<TowerSummaryProps> = ({ outcome, rewards, onClose, itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const title = outcome === 'VICTORY' ? 'Wieża Ukończona!' : outcome === 'RETREAT' ? 'Ucieczka z Wieży' : 'Porażka';
    const titleColor = outcome === 'VICTORY' ? 'text-green-400' : outcome === 'RETREAT' ? 'text-amber-400' : 'text-red-500';
    const subTitle = outcome === 'DEFEAT' 
        ? 'Twoja wyprawa kończy się tutaj. Straciłeś wszystkie zgromadzone łupy.'
        : 'Oto łupy, które udało Ci się wynieść z Wieży Mroku.';

    return (
        <div className="flex flex-col h-full items-center justify-center animate-fade-in p-4 relative z-10">
             {/* Tooltip Overlay */}
             {hoveredItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-auto relative animate-fade-in">
                         <ItemDetailsPanel 
                            item={hoveredItem.item} 
                            template={hoveredItem.template} 
                            affixes={affixes} 
                            size="small"
                            compact={true}
                         />
                    </div>
                </div>
            )}

            <div className="bg-slate-900/90 border border-slate-700 p-8 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col items-center backdrop-blur-md">
                <h2 className={`text-4xl font-extrabold ${titleColor} mb-2 uppercase tracking-wider`}>{title}</h2>
                <p className="text-gray-400 mb-8 text-center">{subTitle}</p>

                {outcome !== 'DEFEAT' && (
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {/* Resources Column */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                                <StarIcon className="h-5 w-5 text-yellow-400"/> Zasoby
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded">
                                    <span className="text-gray-400 font-bold">{t('resources.gold')}</span>
                                    <span className="text-amber-400 font-mono text-xl">{rewards.gold.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded">
                                    <span className="text-gray-400 font-bold">Doświadczenie</span>
                                    <span className="text-sky-400 font-mono text-xl">{rewards.experience.toLocaleString()} XP</span>
                                </div>
                                {Object.entries(rewards.essences).map(([key, amount]) => {
                                     const type = key as EssenceType;
                                     const rarity = essenceToRarityMap[type];
                                     const style = rarityStyles[rarity];
                                     return (
                                        <div key={key} className={`flex justify-between items-center bg-slate-900/50 p-3 rounded border-l-4 ${style.border}`}>
                                            <span className={`${style.text} font-bold text-sm`}>{t(`resources.${type}`)}</span>
                                            <span className="text-white font-mono font-bold">x{amount as number}</span>
                                        </div>
                                     )
                                })}
                            </div>
                        </div>

                        {/* Items Column */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 flex flex-col">
                            <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                                <ShieldIcon className="h-5 w-5 text-indigo-400"/> Przedmioty ({rewards.items.length})
                            </h3>
                            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                                {rewards.items.length === 0 ? (
                                    <p className="text-gray-500 italic text-center py-10">Brak przedmiotów.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {rewards.items.map((item) => {
                                            const template = itemTemplates.find(t => t.id === item.templateId);
                                            if (!template) return null;
                                            return (
                                                <div 
                                                    key={item.uniqueId} 
                                                    className="relative group cursor-help bg-slate-900/80 p-1 rounded hover:bg-slate-800 transition-colors"
                                                    onMouseEnter={() => setHoveredItem({ item, template })}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                >
                                                    <ItemListItem 
                                                        item={item} 
                                                        template={template} 
                                                        affixes={affixes} 
                                                        isSelected={false} 
                                                        onClick={()=>{}} 
                                                        showPrimaryStat={false} 
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
                >
                    Wróć do Miasta
                </button>
            </div>
        </div>
    );
};


// --- Helper Component: Enemy Preview ---
const EnemyPreview: React.FC<{ floorNumber: number, enemies: Enemy[] }> = ({ floorNumber, enemies }) => {
    return (
        <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-700 mb-4">
            <h5 className="text-sm font-bold text-gray-400 mb-3 border-b border-slate-700 pb-1 flex justify-between">
                <span>Piętro {floorNumber}</span>
                <span className="text-xs text-gray-500">{enemies.length} Przeciwników</span>
            </h5>
            
            {enemies.length === 0 ? (
                 <p className="text-gray-500 italic text-xs text-center py-2">Brak danych o wrogach (Losowe spotkanie)</p>
            ) : (
                <div className="flex flex-wrap gap-3 justify-center">
                    {enemies.map((e, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1 group relative">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-2 overflow-hidden bg-slate-800 ${e.isBoss ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-slate-600'}`}>
                                {e.image ? (
                                    <img src={e.image} className="w-full h-full object-cover" alt={e.name} />
                                ) : (
                                    <span className="text-xs font-bold text-gray-500">?</span>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold max-w-[80px] truncate text-center ${e.isBoss ? 'text-red-400' : 'text-gray-300'}`}>
                                {e.name}
                            </span>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full mb-2 bg-black/90 text-white text-xs p-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-slate-600">
                                <p className="font-bold text-amber-400">{e.name}</p>
                                <p>HP: {e.stats.maxHealth}</p>
                                <p>Dmg: {e.stats.minDamage}-{e.stats.maxDamage}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const Tower: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [towers, setTowers] = useState<TowerType[]>([]);
    const [activeRun, setActiveRun] = useState<ActiveTowerRun | null>(null);
    const [activeTower, setActiveTower] = useState<TowerType | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
    
    // Duration simulation state
    const [isMoving, setIsMoving] = useState(false);
    const [progress, setProgress] = useState(0);

    // State for End Game Summary (Victory/Defeat/Retreat - Final Screen)
    const [endGameSummary, setEndGameSummary] = useState<{
        outcome: 'VICTORY' | 'DEFEAT' | 'RETREAT';
        rewards: { gold: number, experience: number, items: ItemInstance[], essences: any };
    } | null>(null);

    // Queue for final game state (Victory or Defeat) to show AFTER combat log
    const [pendingFinalVictory, setPendingFinalVictory] = useState<{
        outcome: 'VICTORY' | 'DEFEAT';
        rewards: { gold: number, experience: number, items: ItemInstance[], essences: any };
    } | null>(null);

    // State for Intermediate Floor Report (Combat Log for current floor)
    const [floorReport, setFloorReport] = useState<ExpeditionRewardSummary | null>(null);
    
    // Tooltip State for Active Run view
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const fetchData = useCallback(async () => {
        // Block fetching if any modal is open to prevent state jump, UNLESS we just closed it (managed by handlers)
        if (endGameSummary || floorReport || pendingFinalVictory) return;

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
    }, [endGameSummary, floorReport, pendingFinalVictory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (towers.length > 0 && !selectedTowerId) {
            setSelectedTowerId(towers[0].id);
        }
    }, [towers, selectedTowerId]);

    const handleStart = async (towerId: string, floorOneCost: number) => {
        if (!confirm('Czy na pewno chcesz wejść do Wieży? Pamiętaj: zdrowie się nie regeneruje, a porażka oznacza utratę łupów!')) return;
        
        if (character!.stats.currentEnergy < floorOneCost) {
            alert('Brak energii.');
            return;
        }

        try {
            const res = await api.startTower(towerId);
            setActiveRun(res.activeRun);
            setActiveTower(res.tower);
            api.getCharacter().then(updateCharacter); 
        } catch (e: any) {
            alert(e.message);
        }
    };

    const performFight = async () => {
        try {
            const res = await api.fightTower();
            
            if (res.victory) {
                // Update local state to reflect new floor/hp immediately behind the modal
                if (activeRun) {
                    const newFloor = res.currentFloor || activeRun.currentFloor + (res.isTowerComplete ? 0 : 1);
                    setActiveRun({
                        ...activeRun,
                        currentFloor: newFloor,
                        currentHealth: Math.max(0, res.combatLog[res.combatLog.length - 1].playerHealth),
                        currentMana: Math.max(0, res.combatLog[res.combatLog.length - 1].playerMana),
                        accumulatedRewards: res.rewards // Update pending rewards
                    });
                    api.getCharacter().then(updateCharacter);
                }

                if (res.isTowerComplete) {
                    setPendingFinalVictory({
                        outcome: 'VICTORY',
                        rewards: res.rewards || { gold: 0, experience: 0, items: [], essences: {} }
                    });
                    
                    setFloorReport({
                        isVictory: true,
                        totalGold: 0, 
                        totalExperience: 0,
                        itemsFound: [], 
                        essencesFound: {},
                        combatLog: res.combatLog,
                        rewardBreakdown: [{ source: `Finałowa Walka: ${activeTower?.name}`, gold: 0, experience: 0 }]
                    });

                } else {
                    setFloorReport({
                        isVictory: true,
                        totalGold: 0, 
                        totalExperience: 0,
                        itemsFound: [], 
                        essencesFound: {},
                        combatLog: res.combatLog,
                        rewardBreakdown: [{ source: `Ukończono Piętro ${activeRun?.currentFloor}`, gold: 0, experience: 0 }]
                    });
                }
            } else {
                setPendingFinalVictory({
                    outcome: 'DEFEAT',
                    rewards: { gold: 0, experience: 0, items: [], essences: {} }
                });

                setFloorReport({
                    isVictory: false,
                    totalGold: 0,
                    totalExperience: 0,
                    itemsFound: [],
                    essencesFound: {},
                    combatLog: res.combatLog,
                    rewardBreakdown: [] 
                });
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsMoving(false);
            setProgress(0);
        }
    };

    const handleFightClick = (floorCost: number, durationSeconds: number) => {
        if (character!.stats.currentEnergy < floorCost) {
            alert('Brak energii.');
            return;
        }

        if (durationSeconds > 0) {
            setIsMoving(true);
            const interval = 100; // ms
            const steps = (durationSeconds * 1000) / interval;
            let currentStep = 0;

            const timer = setInterval(() => {
                currentStep++;
                const newProgress = Math.min((currentStep / steps) * 100, 100);
                setProgress(newProgress);

                if (currentStep >= steps) {
                    clearInterval(timer);
                    performFight();
                }
            }, interval);
        } else {
            performFight();
        }
    };

    const handleRetreat = async () => {
        if (!confirm('Czy na pewno chcesz uciec z wieży? Zabierzesz ze sobą wszystkie zgromadzone dotąd łupy.')) return;
        try {
            const res = await api.retreatTower();
            // Important: Set Summary first, then clear active run to switch view mode
            setEndGameSummary({
                outcome: 'RETREAT',
                rewards: res.rewards || { gold: 0, experience: 0, items: [], essences: {} }
            });
            setActiveRun(null);
            api.getCharacter().then(updateCharacter);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleCloseFloorReport = () => {
        setFloorReport(null);
        
        // If we have a pending summary (Victory or Defeat), show it now
        if (pendingFinalVictory) {
            setEndGameSummary(pendingFinalVictory);
            setPendingFinalVictory(null);
            setActiveRun(null); // Clear run state now that we are showing summary
        }
    };

    const handleCloseSummary = () => {
        setEndGameSummary(null);
        // Full refresh after end game
        setLoading(true);
        api.getTowers().then(data => {
             if (data.activeRun) {
                setActiveRun(data.activeRun);
                setActiveTower(data.tower);
            } else {
                setTowers(data.towers || []);
                setActiveRun(null);
                setActiveTower(null);
            }
            setLoading(false);
            api.getCharacter().then(updateCharacter);
        });
    };

    const getFloorEnemies = useCallback((floorNum: number) => {
        if (!activeTower || !gameData) return [];
        const floor = activeTower.floors.find(f => f.floorNumber === floorNum);
        if (!floor) return [];
        return floor.enemies.map(fe => gameData.enemies.find(e => e.id === fe.enemyId)).filter(e => !!e) as Enemy[];
    }, [activeTower, gameData]);


    // --- MAIN RENDER ---

    // 1. END GAME SUMMARY (Highest Priority)
    // Render this BEFORE loading check to prevent "Loading..." flash when processing retreat/victory
    if (endGameSummary && !floorReport) {
        return (
            <ContentPanel title={endGameSummary.outcome === 'VICTORY' ? 'Zwycięstwo!' : 'Koniec Wyprawy'}>
                <TowerSummaryView 
                    outcome={endGameSummary.outcome}
                    rewards={endGameSummary.rewards}
                    onClose={handleCloseSummary}
                    itemTemplates={gameData?.itemTemplates || []}
                    affixes={gameData?.affixes || []}
                />
            </ContentPanel>
        );
    }
    
    if (loading && !floorReport && !pendingFinalVictory) return <ContentPanel title="Wieża Mroku"><p className="text-gray-500">Ładowanie...</p></ContentPanel>;
    if (!character || !gameData) return null;


    // 2. ACTIVE RUN VIEW (With potential Floor Report Modal)
    if (activeRun && activeTower) {
        const hpPercent = (activeRun.currentHealth / character.stats.maxHealth) * 100;
        const manaPercent = (activeRun.currentMana / character.stats.maxMana) * 100;
        const rewards = activeRun.accumulatedRewards;
        
        const currentFloorConfig = activeTower.floors.find(f => f.floorNumber === activeRun.currentFloor);
        const currentFloorEnemies = getFloorEnemies(activeRun.currentFloor);
        const nextFloorEnemies = getFloorEnemies(activeRun.currentFloor + 1);
        
        const floorCost = currentFloorConfig?.energyCost || 0;
        const floorDuration = currentFloorConfig?.duration || 0;
        const canAfford = character.stats.currentEnergy >= floorCost;

        return (
            <ContentPanel title={`Wieża Mroku: ${activeTower.name}`}>
                {/* Tooltip */}
                {hoveredItem && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                        <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-auto relative animate-fade-in">
                             <ItemDetailsPanel 
                                item={hoveredItem.item} 
                                template={hoveredItem.template} 
                                affixes={gameData.affixes} 
                                size="small"
                                compact={true}
                             />
                        </div>
                    </div>
                )}
                
                {/* Floor Report Modal - Uses specific close handler now */}
                {floorReport && (
                     <ExpeditionSummaryModal 
                        reward={floorReport}
                        onClose={handleCloseFloorReport}
                        characterName={character.name}
                        itemTemplates={gameData.itemTemplates}
                        affixes={gameData.affixes}
                        enemies={gameData.enemies}
                        isHunting={false}
                    />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
                    
                    {/* Left: Status & Progress */}
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-purple-900/50 flex flex-col justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Piętro {activeRun.currentFloor} <span className="text-gray-500 text-lg">/ {activeTower.totalFloors}</span></h3>
                            <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden mb-6 border border-slate-600">
                                <div className="bg-purple-600 h-full transition-all" style={{ width: `${(activeRun.currentFloor / activeTower.totalFloors) * 100}%` }}></div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-300 font-bold">Zdrowie</span>
                                        <span className="text-white">{Math.ceil(activeRun.currentHealth)} / {character.stats.maxHealth}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                                        <div className="bg-red-600 h-full transition-all" style={{ width: `${hpPercent}%` }}></div>
                                    </div>
                                    <p className="text-xs text-red-400 mt-1 italic">Zdrowie nie regeneruje się automatycznie!</p>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-300 font-bold">Mana</span>
                                        <span className="text-white">{Math.ceil(activeRun.currentMana)} / {character.stats.maxMana}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                                        <div className="bg-blue-600 h-full transition-all" style={{ width: `${manaPercent}%` }}></div>
                                    </div>
                                </div>
                                 <div className="bg-slate-800/50 p-2 rounded flex justify-between items-center text-sm border border-slate-700/50">
                                    <span className="text-gray-400 flex items-center gap-1"><BoltIcon className="h-4 w-4 text-sky-400"/> Twoja Energia</span>
                                    <span className={`font-mono font-bold ${canAfford ? 'text-white' : 'text-red-500'}`}>{character.stats.currentEnergy}</span>
                                </div>
                            </div>
                            
                            {/* Enemy Preview - RESTORED HERE for better visibility */}
                            <div className="mb-4">
                                <EnemyPreview floorNumber={activeRun.currentFloor} enemies={currentFloorEnemies} />
                                {nextFloorEnemies.length > 0 && (
                                     <div className="mt-2 opacity-60 scale-90 origin-left">
                                         <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Następne Piętro</p>
                                         <EnemyPreview floorNumber={activeRun.currentFloor + 1} enemies={nextFloorEnemies} />
                                     </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3 mt-4">
                            {isMoving ? (
                                <div className="w-full py-4 bg-slate-800 rounded-lg border border-slate-600 relative overflow-hidden h-20 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-slate-700/50 flex items-center justify-center text-gray-300 text-sm font-bold z-10">
                                        PRZECHODZENIE... {Math.round(progress)}%
                                    </div>
                                    <div className="absolute inset-0 h-full bg-indigo-900 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
                                </div>
                            ) : (
                                 <button 
                                    onClick={() => handleFightClick(floorCost, floorDuration)}
                                    disabled={!canAfford}
                                    className="w-full py-4 bg-red-700 hover:bg-red-600 rounded-lg text-white font-bold text-xl shadow-lg border border-red-500 flex flex-col items-center justify-center gap-1 transition-transform hover:scale-[1.02] disabled:bg-slate-700 disabled:border-slate-600 disabled:text-gray-500"
                                >
                                    <div className="flex items-center gap-2"><SwordsIcon className="h-6 w-6"/> WALCZ</div>
                                    <div className="text-xs font-normal opacity-80 flex gap-3">
                                        <span>Koszt: {floorCost} En</span>
                                        {floorDuration > 0 && <span>Czas: {floorDuration}s</span>}
                                    </div>
                                </button>
                            )}
                            
                            <button 
                                onClick={handleRetreat}
                                disabled={isMoving}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-gray-200 font-semibold border border-slate-500 disabled:opacity-50"
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
                            {Object.entries(rewards.essences).map(([key, amount]) => {
                                const type = key as EssenceType;
                                const rarity = essenceToRarityMap[type];
                                const style = rarityStyles[rarity];
                                return (
                                    <div key={key} className={`flex justify-between items-center bg-slate-800 p-2 rounded border ${style.border}`}>
                                        <span className={`text-sm ${style.text} font-bold`}>{t(`resources.${type}`)}</span>
                                        <span className={`font-mono font-bold ${style.text}`}>x{amount as number}</span>
                                    </div>
                                );
                            })}

                            {/* Items */}
                            {rewards.items.map((item: ItemInstance) => {
                                const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                                if (!template) return null;
                                return (
                                    <div 
                                        key={item.uniqueId} 
                                        className="relative group cursor-help"
                                        onMouseEnter={() => setHoveredItem({ item, template })}
                                        onMouseLeave={() => setHoveredItem(null)}
                                    >
                                        <ItemListItem 
                                            item={item} 
                                            template={template} 
                                            affixes={gameData.affixes} 
                                            isSelected={false} 
                                            onClick={()=>{}} 
                                            showPrimaryStat={false} 
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    // 3. LOBBY VIEW (Master-Detail Selection)
    const selectedTower = towers.find(t => t.id === selectedTowerId);

    return (
        <ContentPanel title="Wieża Mroku">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
                
                {/* Left Column: Tower List */}
                <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col min-h-0">
                    <h3 className="text-xl font-bold text-gray-300 mb-4 px-2">Dostępne Wieże</h3>
                    
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {towers.length === 0 && <p className="text-gray-500 text-center py-8">Brak wież w tej lokacji.</p>}
                        {towers.map(tower => {
                            const isSelected = selectedTowerId === tower.id;
                            const floor1Cost = tower.floors.find(f => f.floorNumber === 1)?.energyCost || 0;
                            return (
                                <button
                                    key={tower.id}
                                    onClick={() => setSelectedTowerId(tower.id)}
                                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 flex justify-between items-center ${isSelected ? 'bg-indigo-900/50 border-indigo-500 shadow-md' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'}`}
                                >
                                    <div>
                                        <h4 className={`font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>{tower.name}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{tower.totalFloors} Pięter</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-sm font-mono font-bold ${character.stats.currentEnergy >= floor1Cost ? 'text-sky-400' : 'text-red-500'}`}>
                                            {floor1Cost} <BoltIcon className="h-3 w-3 inline"/>
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Details & Actions */}
                <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col min-h-0 relative overflow-hidden">
                    {selectedTower ? (
                        <>
                            {/* Background Image Effect */}
                            {selectedTower.image && (
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    <img src={selectedTower.image} alt={selectedTower.name} className="w-full h-full object-cover mix-blend-overlay opacity-10" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/10 to-transparent"></div>
                                </div>
                            )}

                            {/* Header Section */}
                            <div className="relative z-10 mb-6 text-center">
                                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2 drop-shadow-sm">
                                    {selectedTower.name}
                                </h2>
                                <p className="text-gray-400 italic max-w-2xl mx-auto">{selectedTower.description}</p>
                            </div>

                            {/* Info Grid */}
                            <div className="relative z-10 grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Poziom Trudności</p>
                                    <p className="text-white font-bold">{selectedTower.totalFloors} Pięter</p>
                                </div>
                                <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Lokacja</p>
                                    <p className="text-indigo-300 font-bold">{gameData.locations.find(l => l.id === selectedTower.locationId)?.name}</p>
                                </div>
                                <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Koszt Wejścia</p>
                                    <p className="text-sky-400 font-bold font-mono flex items-center justify-center gap-1">
                                        {(selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0)} <BoltIcon className="h-4 w-4"/>
                                    </p>
                                </div>
                            </div>

                            {/* Rewards Box */}
                            {selectedTower.grandPrize && (
                                <div className="relative z-10 bg-amber-900/10 p-5 rounded-xl border border-amber-700/30 mb-auto backdrop-blur-sm">
                                    <h4 className="text-sm font-bold text-amber-500 uppercase mb-3 flex items-center gap-2">
                                        <StarIcon className="h-4 w-4"/> Nagroda Główna (za ukończenie)
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex gap-4 text-sm font-mono mb-2">
                                                <span className="text-amber-300 font-bold">{selectedTower.grandPrize.gold} <span className="text-xs font-sans text-gray-500">Złota</span></span>
                                                <span className="text-sky-300 font-bold">{selectedTower.grandPrize.experience} <span className="text-xs font-sans text-gray-500">XP</span></span>
                                            </div>
                                            {selectedTower.grandPrize.essences && (
                                                 <div className="text-xs space-y-1">
                                                     {Object.entries(selectedTower.grandPrize.essences).map(([key, amount]) => (
                                                         <div key={key} className="flex gap-2">
                                                             <span className={`${rarityStyles[essenceToRarityMap[key as EssenceType]].text}`}>{t(`resources.${key}`)}</span>
                                                             <span className="font-bold text-white">x{amount as number}</span>
                                                         </div>
                                                     ))}
                                                 </div>
                                             )}
                                        </div>
                                        <div className="space-y-1 text-sm text-right">
                                             {selectedTower.grandPrize.items && selectedTower.grandPrize.items.map((item, idx) => {
                                                 const tmpl = gameData.itemTemplates.find(t => t.id === item.templateId);
                                                 if (!tmpl) return null;
                                                 return <p key={idx} className={`${rarityStyles[tmpl.rarity].text} font-bold`}>{tmpl.name} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}</p>
                                             })}
                                             {selectedTower.grandPrize.randomItemRewards && selectedTower.grandPrize.randomItemRewards.map((reward, idx) => (
                                                  <p key={idx} className={`${rarityStyles[reward.rarity].text} italic opacity-80`}>
                                                      Losowy {t(`rarity.${reward.rarity}`)} przedmiot x{reward.amount}
                                                  </p>
                                              ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <div className="relative z-10 mt-6 pt-6 border-t border-slate-700/50">
                                <button 
                                    onClick={() => handleStart(selectedTower.id, (selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0))}
                                    disabled={character.stats.currentEnergy < (selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0)}
                                    className="w-full py-4 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.01] disabled:bg-slate-700 disabled:text-gray-500 disabled:transform-none flex items-center justify-center gap-3 text-lg"
                                >
                                    <SwordsIcon className="h-6 w-6"/>
                                    {character.stats.currentEnergy < (selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0) ? 'Brak Energii' : 'Wejdź do Wieży'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <ShieldIcon className="h-24 w-24 mb-4 opacity-20" />
                            <p className="text-lg">Wybierz wieżę z listy po lewej stronie, aby zobaczyć szczegóły.</p>
                        </div>
                    )}
                </div>
            </div>
        </ContentPanel>
    );
};
