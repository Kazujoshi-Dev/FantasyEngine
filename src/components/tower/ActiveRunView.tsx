
import React, { useState } from 'react';
import { ActiveTowerRun, Tower, PlayerCharacter, GameData, ItemInstance, ItemTemplate } from '../../types';
import { BoltIcon } from '../icons/BoltIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { ItemDetailsPanel } from '../shared/ItemSlot';
import { EnemyPreview } from './EnemyPreview';

interface ActiveRunViewProps {
    activeRun: ActiveTowerRun;
    activeTower: Tower;
    character: PlayerCharacter;
    gameData: GameData;
    onFight: (floorCost: number, duration: number) => void;
    onRetreat: () => void;
    isMoving: boolean;
    progress: number;
}

export const ActiveRunView: React.FC<ActiveRunViewProps> = ({ 
    activeRun, activeTower, character, gameData, onFight, onRetreat, isMoving, progress 
}) => {
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const currentFloorConfig = activeTower.floors.find(f => f.floorNumber === activeRun.currentFloor);
    const floorEnemies = currentFloorConfig?.enemies.map(e => gameData.enemies.find(en => en.id === e.enemyId)).filter(Boolean) as any[] || [];
    
    // For Floor 1, energy is paid at entry. For others, it's paid now.
    const energyCost = activeRun.currentFloor === 1 ? 0 : (currentFloorConfig?.energyCost || 0);
    const hasEnergy = character.stats.currentEnergy >= energyCost;

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
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{activeTower.name}</h3>
                    <p className="text-purple-400 font-bold text-lg mb-6">Piętro {activeRun.currentFloor} / {activeTower.totalFloors}</p>

                    <div className="space-y-4 mb-6">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                            <p className="text-gray-400 text-sm mb-1">Twoje Zdrowie</p>
                            <p className="text-2xl font-bold text-white mb-2">{activeRun.currentHealth} / {character.stats.maxHealth}</p>
                            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                                <div 
                                    className="bg-red-600 h-full transition-all duration-500" 
                                    style={{width: `${(activeRun.currentHealth / character.stats.maxHealth) * 100}%`}}
                                ></div>
                            </div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                            <p className="text-gray-400 text-sm mb-1">Twoja Mana</p>
                            <p className="text-2xl font-bold text-white mb-2">{activeRun.currentMana} / {character.stats.maxMana}</p>
                            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-full transition-all duration-500" 
                                    style={{width: `${(activeRun.currentMana / character.stats.maxMana) * 100}%`}}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={onRetreat}
                    disabled={isMoving}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-gray-200 font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                    Ucieczka (Zachowaj Łupy)
                </button>
            </div>

            {/* Middle: Action / Combat */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
                {isMoving ? (
                    <div className="text-center z-10 w-full px-8">
                        <SwordsIcon className="h-16 w-16 text-red-500 animate-pulse mx-auto mb-4"/>
                        <h3 className="text-2xl font-bold text-white mb-4">Walka w toku...</h3>
                        <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden border border-slate-600">
                            <div 
                                className="bg-red-600 h-full transition-all duration-100 ease-linear"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center z-10">
                        <EnemyPreview floorNumber={activeRun.currentFloor} enemies={floorEnemies} />
                        
                        <button 
                            onClick={() => onFight(energyCost, currentFloorConfig?.duration || 0)}
                            disabled={!hasEnergy}
                            className={`
                                px-10 py-5 rounded-2xl font-extrabold text-xl shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3
                                ${hasEnergy ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-slate-700 text-gray-500 cursor-not-allowed'}
                            `}
                        >
                            <SwordsIcon className="h-8 w-8"/>
                            WALCZ
                        </button>
                        {energyCost > 0 && (
                            <p className={`mt-3 text-sm font-bold ${hasEnergy ? 'text-sky-400' : 'text-red-500'}`}>
                                Koszt: {energyCost} <BoltIcon className="h-4 w-4 inline"/>
                            </p>
                        )}
                    </div>
                )}
                
                {/* Background Decoration */}
                <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
                    <ShieldIcon className="h-64 w-64 text-white"/>
                </div>
            </div>

            {/* Right: Accumulated Rewards */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col">
                <h3 className="text-lg font-bold text-amber-400 mb-4 border-b border-slate-700 pb-2">Zgromadzone Łupy</h3>
                <div className="space-y-4 flex-grow overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded">
                        <span className="text-gray-300">Złoto</span>
                        <span className="font-mono font-bold text-amber-400">+{activeRun.accumulatedRewards.gold}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded">
                        <span className="text-gray-300">XP</span>
                        <span className="font-mono font-bold text-sky-400">+{activeRun.accumulatedRewards.experience}</span>
                    </div>
                    
                    {activeRun.accumulatedRewards.items.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold mb-2 mt-4">Przedmioty ({activeRun.accumulatedRewards.items.length})</p>
                            <div className="space-y-1">
                                {activeRun.accumulatedRewards.items.map((item, idx) => {
                                    const tmpl = gameData.itemTemplates.find(t => t.id === item.templateId);
                                    if (!tmpl) return null;
                                    return (
                                        <div 
                                            key={idx} 
                                            className="text-sm bg-slate-800/30 p-2 rounded cursor-help hover:bg-slate-800 transition-colors"
                                            onMouseEnter={() => setHoveredItem({ item, template: tmpl })}
                                            onMouseLeave={() => setHoveredItem(null)}
                                        >
                                            <span className="text-white">{tmpl.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
