
import React, { useState } from 'react';
import { GameData, Tower } from '../../../types';
import { TowerEditor } from '../editors/TowerEditor';

interface TowersTabProps {
    gameData: GameData;
    onGameDataUpdate: (key: string, data: any) => void;
}

export const TowersTab: React.FC<TowersTabProps> = ({ gameData, onGameDataUpdate }) => {
    const [editingTower, setEditingTower] = useState<Partial<Tower> | null>(null);
    const towers = gameData.towers || [];

    const handleSave = (tower: Tower) => {
        let updated = [...towers];
        const index = updated.findIndex(t => t.id === tower.id);
        if (index > -1) {
            updated[index] = tower;
        } else {
            updated.push(tower);
        }
        onGameDataUpdate('towers', updated);
        setEditingTower(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Usunąć wieżę?')) return;
        const updated = towers.filter(t => t.id !== id);
        onGameDataUpdate('towers', updated);
    };

    return (
        <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-purple-400">Zarządzanie Wieżami Mroku</h3>
                <button 
                    onClick={() => setEditingTower({ floors: [], isActive: true })} 
                    className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold shadow-lg"
                >
                    Dodaj Wieżę
                </button>
            </div>

            {editingTower ? (
                <TowerEditor 
                    tower={editingTower} 
                    onSave={handleSave} 
                    onCancel={() => setEditingTower(null)} 
                    gameData={gameData}
                />
            ) : (
                <div className="space-y-4">
                    {towers.map(tower => (
                        <div key={tower.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                            <div>
                                <h4 className="text-lg font-bold text-white">{tower.name}</h4>
                                <p className="text-sm text-gray-400">{tower.totalFloors} Pięter | Lokacja: {gameData.locations.find(l => l.id === tower.locationId)?.name}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingTower(tower)} className="px-3 py-1 bg-sky-700 hover:bg-sky-600 rounded text-sm">Edytuj</button>
                                <button onClick={() => handleDelete(tower.id)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm">Usuń</button>
                            </div>
                        </div>
                    ))}
                    {towers.length === 0 && <p className="text-gray-500 text-center">Brak wież.</p>}
                </div>
            )}
        </div>
    );
};
