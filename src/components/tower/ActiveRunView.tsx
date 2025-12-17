
import React, { useState } from 'react';
import { ActiveTowerRun, Tower, PlayerCharacter, GameData, ItemTemplate, ItemInstance } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { EnemyPreview } from './EnemyPreview';
import { BoltIcon } from '../icons/BoltIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { ItemDetailsPanel } from '../shared/ItemSlot';

interface ActiveRunViewProps {
    activeRun: ActiveTowerRun;
    activeTower: Tower;
    character: PlayerCharacter;
    gameData: GameData;
    onFight: (floorCost: number, durationSeconds: number) => void;
    onRetreat: () => void;
    isMoving: boolean;
    progress: number;
}

export const ActiveRunView: React.FC<ActiveRunViewProps> = ({ 
    activeRun, activeTower, character, gameData, onFight, onRetreat, isMoving, progress 
}) => {
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const currentFloorConfig = activeTower.floors.find(f => f.floorNumber === activeRun.currentFloor);
    const floorCost = currentFloorConfig?.energyCost || 0;
    const canAfford = character.stats.currentEnergy >= floorCost;
    
    // Resolve enemy templates for preview
    const floorEnemies = (currentFloorConfig?.enemies || []).map(e => gameData.enemies.find(en => en.id === e.enemyId)).filter(e => !!e) as any[];

    // Calculate collected rewards so far
    const rewards = activeRun.accumulatedRewards;
    const itemCount = rewards.items.length;
    const essenceCount = Object.values(rewards.essences || {}).reduce((a: number, b: any) => a + (b as number), 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
            
            {/* Tooltip */}
             {hoveredItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 shadow-2xl max-w-sm w-full pointer-events-none relative animate-fade-in">
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

            {/* Left: Status & Progress */}
            <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col gap-4">
                <div className="bg-slate-800 p-4 rounded-lg text-center border border-indigo-500/30">
                    <p className="text-gray-400 uppercase text-xs tracking-widest mb-1">Aktualne Piętro</p>
                    <p className="text-4xl font-extrabold text-white">{activeRun.currentFloor} <span className="text-lg text-gray-500">/ {activeTower.totalFloors}</span></p>
                </div>
                
                <div className="bg-slate-800 p-4 rounded-lg">
                    <h4 className="font-bold text-gray-300 mb-3 border-b border-slate-700 pb-1">Stan Postaci (W Wieży)</h4>
                    <div className="space-y-3">
                         <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Zdrowie</span>
                                <span className="text-white font-bold">{Math.ceil(activeRun.currentHealth)} / {character.stats.maxHealth}</span>
                            </div>
                            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div className="bg-red-600 h-full transition-all duration-500" style={{width: `${Math.min(100, (activeRun.currentHealth / character.stats.maxHealth) * 100)}%`}}></div>
                            </div>
                         </div>
                         <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Mana</span>
                                <span className="text-white font-bold">{Math.ceil(activeRun.currentMana)} / {character.stats.maxMana}</span>
                            </div>
                            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-600 h-full transition-all duration-500" style={{width: `${Math.min(100, (activeRun.currentMana / character.stats.maxMana) * 100)}%`}}></div>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-lg flex-grow overflow-y-auto">
                    <h4 className="font-bold text-amber-400 mb-3 border-b border-slate-700 pb-1">Zgromadzone Łupy</h4>
                    <div className="space-y-1 text-sm">
                        <p className="flex justify-between"><span className="text-gray-400">Złoto:</span> <span className="text-white font-mono">{rewards.gold}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400">XP:</span> <span className="text-white font-mono">{rewards.experience}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400">Przedmioty:</span> <span className="text-white font-mono">{itemCount}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400">Esencje:</span> <span className="text-white font-mono">{essenceCount}</span></p>
                    </div>
                    {itemCount > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-700">
                            <p className="text-xs text-gray-500 mb-2">Ostatnie przedmioty:</p>
                            <div className="flex flex-wrap gap-1">
                                {rewards.items.slice(-5).reverse().map((item, idx) => {
                                    const tmpl = gameData.itemTemplates.find(t => t.id === item.templateId);
                                    if(!tmpl) return null;
                                    return (
                                        <div 
                                            key={idx} 
                                            className="w-8 h-8 bg-slate-700 rounded border border-slate-600 flex items-center justify-center cursor-help"
                                            onMouseEnter={() => setHoveredItem({ item, template: tmpl })}
                                            onMouseLeave={() => setHoveredItem(null)}
                                        >
                                            {tmpl.icon ? <img src={tmpl.icon} className="w-full h-full object-contain" /> : <div className="w-2 h-2 bg-gray-500 rounded-full"></div>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={onRetreat}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-gray-200 font-bold rounded-lg transition-colors border border-slate-600"
                >
                    Ucieczka z Łupami
                </button>
            </div>

            {/* Right: Encounter View */}
            <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col relative overflow-hidden">
                {/* Visual Background */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ 
                    backgroundImage: 'radial-gradient(circle at 50% 50%, #4c1d95 0%, transparent 70%)'
                }}></div>

                <div className="relative z-10 flex-grow flex flex-col justify-center items-center">
                    <EnemyPreview floorNumber={activeRun.currentFloor} enemies={floorEnemies} />
                    
                    <div className="mt-8 w-full max-w-md">
                        {isMoving ? (
                            <div className="text-center">
                                <p className="text-indigo-300 font-bold mb-2 animate-pulse">Eksploracja piętra...</p>
                                <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden border border-indigo-500/50">
                                    <div className="bg-indigo-500 h-full transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => onFight(floorCost, currentFloorConfig?.duration || 0)}
                                disabled={!canAfford}
                                className="w-full py-6 bg-red-700 hover:bg-red-600 text-white text-2xl font-extrabold rounded-xl shadow-lg shadow-red-900/20 transition-all transform hover:scale-105 disabled:bg-slate-700 disabled:text-gray-500 disabled:transform-none flex flex-col items-center justify-center gap-2 group"
                            >
                                <div className="flex items-center gap-3">
                                    <SwordsIcon className="h-8 w-8 group-hover:rotate-12 transition-transform"/>
                                    WALCZ
                                </div>
                                {floorCost > 0 && (
                                    <span className={`text-sm font-mono font-normal flex items-center ${canAfford ? 'text-gray-200' : 'text-red-300'}`}>
                                        Koszt: {floorCost} <BoltIcon className="h-3 w-3 ml-1"/>
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {!isMoving && floorCost > 0 && !canAfford && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                        <p className="text-red-400 font-bold bg-slate-900/80 inline-block px-4 py-2 rounded-full border border-red-500/30">
                            Brak energii na kolejne piętro!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
