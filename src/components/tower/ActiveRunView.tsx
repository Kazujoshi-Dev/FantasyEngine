
import React, { useState } from 'react';
import { ActiveTowerRun, Tower, PlayerCharacter, GameData, ItemInstance, ItemTemplate } from '../../types';
import { EnemyPreview } from './EnemyPreview';
import { ItemDetailsPanel, ItemListItem, rarityStyles } from '../shared/ItemSlot';
import { useTranslation } from '../../contexts/LanguageContext';
import { BoltIcon } from '../icons/BoltIcon';
import { SwordsIcon } from '../icons/SwordsIcon';

interface ActiveRunViewProps {
    activeRun: ActiveTowerRun;
    activeTower: Tower;
    character: PlayerCharacter;
    gameData: GameData;
    onFight: (cost: number, duration: number) => void;
    onRetreat: () => void;
    isMoving: boolean;
    progress: number;
}

export const ActiveRunView: React.FC<ActiveRunViewProps> = ({ 
    activeRun, activeTower, character, gameData, onFight, onRetreat, isMoving, progress 
}) => {
    const { t } = useTranslation();
    const currentFloor = activeRun.currentFloor;
    const floorConfig = activeTower.floors.find(f => f.floorNumber === currentFloor);
    const enemies = floorConfig?.enemies.map(fe => gameData.enemies.find(e => e.id === fe.enemyId)).filter(e => e) as any[] || [];
    
    // Check energy for next floor (except first floor which is paid on start)
    const energyCost = currentFloor > 1 ? (floorConfig?.energyCost || 0) : 0;
    const hasEnergy = character.stats.currentEnergy >= energyCost;

    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);

    const rewards = activeRun.accumulatedRewards;
    const itemCount = rewards.items.length;
    const essenceCount = Object.values(rewards.essences).reduce((a: any, b: any) => a + b, 0);

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
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col min-h-0">
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-white mb-1">{activeTower.name}</h3>
                    <p className="text-lg text-purple-400 font-bold">Piętro {currentFloor} / {activeTower.totalFloors}</p>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
                    <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Status Postaci</h4>
                    
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">Zdrowie (Brak regeneracji)</span>
                                <span className="text-white font-mono">{activeRun.currentHealth} / {character.stats.maxHealth}</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                <div className="bg-red-600 h-full transition-all" style={{ width: `${(activeRun.currentHealth / character.stats.maxHealth) * 100}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">Mana</span>
                                <span className="text-white font-mono">{activeRun.currentMana} / {character.stats.maxMana}</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                <div className="bg-blue-600 h-full transition-all" style={{ width: `${(activeRun.currentMana / character.stats.maxMana) * 100}%` }}></div>
                            </div>
                        </div>
                         <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">Energia</span>
                                <span className={`${hasEnergy ? 'text-white' : 'text-red-500'} font-mono`}>{character.stats.currentEnergy} / {character.stats.maxEnergy}</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                <div className="bg-yellow-600 h-full transition-all" style={{ width: `${(character.stats.currentEnergy / character.stats.maxEnergy) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-lg text-center mb-4">
                        <p className="text-xs text-indigo-300 font-bold uppercase mb-1">Zgromadzone Łupy</p>
                        <p className="text-sm text-gray-300">
                            Złoto: <span className="text-amber-400 font-mono">{rewards.gold}</span> | 
                            XP: <span className="text-sky-400 font-mono">{rewards.experience}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Przedmioty: {itemCount} | Esencje: {essenceCount}</p>
                    </div>

                    <button 
                        onClick={onRetreat} 
                        disabled={isMoving}
                        className="w-full py-3 border border-red-800 text-red-400 hover:bg-red-900/30 rounded font-bold transition-colors disabled:opacity-50"
                    >
                        Uciekaj z wieży (Zachowaj łupy)
                    </button>
                </div>
            </div>

            {/* Middle: Encounter & Action */}
            <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col relative overflow-hidden">
                {isMoving && (
                    <div className="absolute inset-0 z-20 bg-slate-900/80 flex flex-col items-center justify-center backdrop-blur-sm">
                        <h3 className="text-2xl font-bold text-white mb-4 animate-pulse">Eksploracja Piętra...</h3>
                        <div className="w-64 h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-600">
                            <div className="h-full bg-indigo-500 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                )}

                <div className="flex-grow flex flex-col items-center justify-center">
                    <h4 className="text-xl font-bold text-red-400 mb-6 border-b border-red-500/30 pb-2 px-8">Przeciwnicy</h4>
                    
                    <div className="w-full max-w-lg mb-8">
                        <EnemyPreview floorNumber={currentFloor} enemies={enemies} />
                    </div>

                    {floorConfig?.duration && floorConfig.duration > 0 && (
                        <p className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                             Czas eksploracji: <span className="text-white font-mono">{floorConfig.duration}s</span>
                        </p>
                    )}
                    
                    {energyCost > 0 && (
                         <p className={`text-sm mb-6 flex items-center gap-2 font-bold ${hasEnergy ? 'text-sky-400' : 'text-red-500'}`}>
                             Koszt: {energyCost} <BoltIcon className="h-4 w-4"/>
                        </p>
                    )}

                    <button 
                        onClick={() => onFight(energyCost, floorConfig?.duration || 0)}
                        disabled={!hasEnergy || isMoving}
                        className="px-12 py-5 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-extrabold text-2xl rounded-xl shadow-lg shadow-red-900/30 transform transition-all hover:scale-105 disabled:grayscale disabled:cursor-not-allowed disabled:transform-none flex items-center gap-3"
                    >
                        <SwordsIcon className="h-8 w-8"/> WALCZ
                    </button>
                </div>

                {/* Recent Loot Preview (Bottom) */}
                {rewards.items.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-700">
                         <p className="text-xs text-gray-500 uppercase font-bold mb-2">Ostatnio znalezione przedmioty</p>
                         <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                             {rewards.items.slice(-5).reverse().map((item, idx) => {
                                 const tmpl = gameData.itemTemplates.find(t => t.id === item.templateId);
                                 if (!tmpl) return null;
                                 return (
                                    <div 
                                        key={idx} 
                                        className={`flex-shrink-0 w-12 h-12 bg-slate-800 rounded border ${rarityStyles[tmpl.rarity].border} relative group cursor-help`}
                                        onMouseEnter={() => setHoveredItem({ item, template: tmpl })}
                                        onMouseLeave={() => setHoveredItem(null)}
                                    >
                                        {tmpl.icon && <img src={tmpl.icon} className="w-full h-full object-contain p-1" />}
                                    </div>
                                 )
                             })}
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};
