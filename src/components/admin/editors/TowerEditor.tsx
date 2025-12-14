
import React, { useState } from 'react';
import { Tower, GameData, TowerFloor, EssenceType, LootDrop } from '../../../types';
import { PlusCircleIcon } from '../../icons/PlusCircleIcon';
import { MinusCircleIcon } from '../../icons/MinusCircleIcon';

interface TowerEditorProps {
    tower: Partial<Tower>;
    onSave: (tower: Tower) => void;
    onCancel: () => void;
    gameData: GameData;
}

export const TowerEditor: React.FC<TowerEditorProps> = ({ tower, onSave, onCancel, gameData }) => {
    const [formData, setFormData] = useState<Partial<Tower>>({
        id: crypto.randomUUID(),
        name: '',
        description: '',
        locationId: '',
        totalFloors: 0,
        floors: [],
        grandPrize: { gold: 0, experience: 0 },
        isActive: true,
        ...tower
    });
    
    // State for managing floors locally before save
    // We want to ensure totalFloors matches floors array length
    
    const addFloor = () => {
        setFormData(prev => ({
            ...prev,
            floors: [...(prev.floors || []), { 
                floorNumber: (prev.floors?.length || 0) + 1, 
                enemies: [],
                guaranteedReward: { gold: 0, experience: 0 },
                lootTable: [],
                resourceLootTable: []
            }],
            totalFloors: (prev.floors?.length || 0) + 1
        }));
    };

    const removeFloor = (index: number) => {
        setFormData(prev => {
            const newFloors = prev.floors?.filter((_, i) => i !== index).map((f, i) => ({ ...f, floorNumber: i + 1 })) || [];
            return {
                ...prev,
                floors: newFloors,
                totalFloors: newFloors.length
            };
        });
    };

    const updateFloor = (index: number, updates: Partial<TowerFloor>) => {
        setFormData(prev => {
            const newFloors = [...(prev.floors || [])];
            newFloors[index] = { ...newFloors[index], ...updates };
            return { ...prev, floors: newFloors };
        });
    };
    
    const addEnemyToFloor = (floorIndex: number) => {
        const floor = formData.floors![floorIndex];
        const newEnemies = [...floor.enemies, { enemyId: gameData.enemies[0]?.id || '', spawnChance: 100 }];
        updateFloor(floorIndex, { enemies: newEnemies });
    };

    const removeEnemyFromFloor = (floorIndex: number, enemyIndex: number) => {
        const floor = formData.floors![floorIndex];
        const newEnemies = floor.enemies.filter((_, i) => i !== enemyIndex);
        updateFloor(floorIndex, { enemies: newEnemies });
    };
    
    const updateEnemyInFloor = (floorIndex: number, enemyIndex: number, key: 'enemyId' | 'spawnChance', value: any) => {
         const floor = formData.floors![floorIndex];
         const newEnemies = [...floor.enemies];
         (newEnemies[enemyIndex] as any)[key] = value;
         updateFloor(floorIndex, { enemies: newEnemies });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.locationId) {
            alert('Nazwa i lokalizacja są wymagane');
            return;
        }
        onSave(formData as Tower);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl space-y-6">
            <h3 className="text-xl font-bold text-purple-400">Edytor Wieży</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm text-gray-400">Nazwa</label>
                    <input className="w-full bg-slate-700 p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                    <label className="block text-sm text-gray-400">Lokacja</label>
                    <select className="w-full bg-slate-700 p-2 rounded" value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})}>
                        <option value="">Wybierz...</option>
                        {gameData.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-sm text-gray-400">Opis</label>
                    <textarea className="w-full bg-slate-700 p-2 rounded" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                
                {/* Grand Prize */}
                <div className="col-span-2 bg-slate-800/50 p-3 rounded border border-amber-600/30">
                     <p className="text-amber-400 font-bold text-sm mb-2">Nagroda Główna (za ukończenie)</p>
                     <div className="flex gap-4">
                         <label>Złoto: <input type="number" className="w-24 bg-slate-700 p-1 rounded" value={formData.grandPrize?.gold} onChange={e => setFormData({...formData, grandPrize: {...formData.grandPrize, gold: parseInt(e.target.value)||0}} as any)} /></label>
                         <label>XP: <input type="number" className="w-24 bg-slate-700 p-1 rounded" value={formData.grandPrize?.experience} onChange={e => setFormData({...formData, grandPrize: {...formData.grandPrize, experience: parseInt(e.target.value)||0}} as any)} /></label>
                     </div>
                </div>
            </div>

            {/* Floors Editor */}
            <div className="space-y-4">
                <h4 className="font-bold text-white border-b border-slate-700 pb-2 flex justify-between items-center">
                    Piętra ({formData.floors?.length})
                    <button type="button" onClick={addFloor} className="px-3 py-1 bg-green-700 rounded text-xs hover:bg-green-600">+ Piętro</button>
                </h4>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {formData.floors?.map((floor, idx) => (
                        <div key={idx} className="bg-slate-800/50 p-4 rounded border border-slate-700">
                            <div className="flex justify-between items-center mb-3">
                                <h5 className="font-bold text-gray-300">Piętro {floor.floorNumber}</h5>
                                <button type="button" onClick={() => removeFloor(idx)} className="text-red-400 text-xs">Usuń Piętro</button>
                            </div>
                            
                            {/* Enemies */}
                            <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">Przeciwnicy (Suma szans nie musi być 100%, losowanie wagowe)</p>
                                {floor.enemies.map((enemy, eIdx) => (
                                    <div key={eIdx} className="flex gap-2 mb-1">
                                        <select 
                                            value={enemy.enemyId} 
                                            onChange={e => updateEnemyInFloor(idx, eIdx, 'enemyId', e.target.value)}
                                            className="flex-grow bg-slate-900 p-1 rounded text-sm"
                                        >
                                            {gameData.enemies.map(en => <option key={en.id} value={en.id}>{en.name} (Lvl {en.stats.maxHealth > 500 ? 'Boss' : 'Mob'})</option>)}
                                        </select>
                                        <input 
                                            type="number" 
                                            value={enemy.spawnChance} 
                                            onChange={e => updateEnemyInFloor(idx, eIdx, 'spawnChance', parseInt(e.target.value))}
                                            className="w-20 bg-slate-900 p-1 rounded text-sm"
                                            placeholder="Szansa"
                                        />
                                        <button type="button" onClick={() => removeEnemyFromFloor(idx, eIdx)} className="text-red-500">X</button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addEnemyToFloor(idx)} className="text-xs text-green-400">+ Przeciwnik</button>
                            </div>
                            
                            {/* Floor Rewards */}
                            <div className="flex gap-4 text-sm">
                                 <label>Gwarantowane Złoto: <input type="number" className="w-20 bg-slate-900 p-1 rounded" value={floor.guaranteedReward?.gold} onChange={e => updateFloor(idx, { guaranteedReward: { ...floor.guaranteedReward, gold: parseInt(e.target.value)||0 } as any })} /></label>
                                 <label>Gwarantowane XP: <input type="number" className="w-20 bg-slate-900 p-1 rounded" value={floor.guaranteedReward?.experience} onChange={e => updateFloor(idx, { guaranteedReward: { ...floor.guaranteedReward, experience: parseInt(e.target.value)||0 } as any })} /></label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-700 rounded text-white">Anuluj</button>
                <button type="submit" className="px-6 py-2 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold">Zapisz Wieżę</button>
            </div>
        </form>
    );
};
