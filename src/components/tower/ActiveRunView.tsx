
import React, { useState, useMemo } from 'react';
import { ActiveTowerRun, Tower as TowerType, PlayerCharacter, GameData, ItemInstance, ItemTemplate, EssenceType, ItemRarity, Enemy } from '../../types';
import { BoltIcon } from '../icons/BoltIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { ItemDetailsPanel, ItemListItem, rarityStyles, ItemTooltip } from '../shared/ItemSlot';
import { useTranslation } from '../../contexts/LanguageContext';
import { EnemyPreview } from './EnemyPreview';

interface ActiveRunViewProps {
    activeRun: ActiveTowerRun;
    activeTower: TowerType;
    character: PlayerCharacter;
    gameData: GameData;
    onFight: (floorCost: number, durationSeconds: number) => void;
    onRetreat: () => void;
    isMoving: boolean;
    progress: number;
}

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const ActiveRunView: React.FC<ActiveRunViewProps> = ({ 
    activeRun, activeTower, character, gameData, onFight, onRetreat, isMoving, progress 
}) => {
    const { t } = useTranslation();
    const [hoveredItemData, setHoveredItemData] = useState<{ item: ItemInstance, template: ItemTemplate, x: number, y: number } | null>(null);

    // Wyliczanie wrogów dla obecnego piętra
    const currentFloorEnemies = useMemo(() => {
        if (!activeTower || !gameData || !activeRun) return [];
        const floor = activeTower.floors.find(f => Number(f.floorNumber) === Number(activeRun.currentFloor));
        if (!floor) return [];
        return floor.enemies
            .map(fe => gameData.enemies.find(e => e.id === fe.enemyId))
            .filter((e): e is Enemy => !!e);
    }, [activeTower, gameData, activeRun.currentFloor]);

    // Wyliczanie wrogów dla następnego piętra
    const nextFloorEnemies = useMemo(() => {
        if (!activeTower || !gameData || !activeRun) return [];
        const floor = activeTower.floors.find(f => Number(f.floorNumber) === Number(activeRun.currentFloor) + 1);
        if (!floor) return [];
        return floor.enemies
            .map(fe => gameData.enemies.find(e => e.id === fe.enemyId))
            .filter((e): e is Enemy => !!e);
    }, [activeTower, gameData, activeRun.currentFloor]);

    const curH = Number(activeRun.currentHealth) || 0;
    const maxH = Number(character.stats.maxHealth) || 1;
    const curM = Number(activeRun.currentMana) || 0;
    const maxM = Number(character.stats.maxMana) || 1;

    const hpPercent = Math.max(0, Math.min(100, (curH / maxH) * 100));
    const manaPercent = Math.max(0, Math.min(100, (curM / maxM) * 100));
    const rewards = activeRun.accumulatedRewards;
    
    const currentFloorConfig = activeTower.floors.find(f => Number(f.floorNumber) === Number(activeRun.currentFloor));
    
    const floorCost = currentFloorConfig?.energyCost || 0;
    const floorDuration = currentFloorConfig?.duration || 0;
    const canAfford = character.stats.currentEnergy >= floorCost;

    const handleItemMouseEnter = (item: ItemInstance, template: ItemTemplate, e: React.MouseEvent) => {
        setHoveredItemData({ item, template, x: e.clientX, y: e.clientY });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
            
            {/* Standardowy Tooltip zapobiegający migotaniu */}
             {hoveredItemData && (
                <ItemTooltip 
                    instance={hoveredItemData.item}
                    template={hoveredItemData.template}
                    affixes={gameData.affixes}
                    itemTemplates={gameData.itemTemplates}
                    x={hoveredItemData.x}
                    y={hoveredItemData.y}
                    onMouseLeave={() => setHoveredItemData(null)}
                />
            )}

            {/* Left: Status & Progress */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-purple-900/50 flex flex-col justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Piętro {activeRun.currentFloor} <span className="text-gray-500 text-lg">/ {activeTower.totalFloors}</span></h3>
                    <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden mb-6 border border-slate-600">
                        <div className="bg-purple-600 h-full transition-all duration-700" style={{ width: `${(activeRun.currentFloor / activeTower.totalFloors) * 100}%` }}></div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300 font-bold">Zdrowie</span>
                                <span className="text-white font-mono">{Math.ceil(curH)} / {maxH}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                                <div className="bg-red-600 h-full transition-all duration-500" style={{ width: `${hpPercent}%` }}></div>
                            </div>
                            <p className="text-xs text-red-400 mt-1 italic">Zdrowie nie regeneruje się automatycznie!</p>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300 font-bold">Mana</span>
                                <span className="text-white font-mono">{Math.ceil(curM)} / {maxM}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                                <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${manaPercent}%` }}></div>
                            </div>
                        </div>
                         <div className="bg-slate-800/50 p-2 rounded flex justify-between items-center text-sm border border-slate-700/50">
                            <span className="text-gray-400 flex items-center gap-1"><BoltIcon className="h-4 w-4 text-sky-400"/> Twoja Energia</span>
                            <span className={`font-mono font-bold ${canAfford ? 'text-white' : 'text-red-500'}`}>{character.stats.currentEnergy}</span>
                        </div>
                    </div>
                    
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
                            onClick={() => onFight(floorCost, floorDuration)}
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
                        onClick={onRetreat}
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
                                onMouseEnter={(e) => handleItemMouseEnter(item, template, e)}
                                onMouseLeave={() => setHoveredItemData(null)}
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
    );
};
