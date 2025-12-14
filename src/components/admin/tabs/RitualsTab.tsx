
import React, { useState } from 'react';
import { GameData, Ritual } from '../../../types';
import { RitualEditor } from '../editors/RitualEditor';
import { useTranslation } from '../../../contexts/LanguageContext';

interface RitualsTabProps {
    gameData: GameData;
    onGameDataUpdate: (key: string, data: any) => void;
}

export const RitualsTab: React.FC<RitualsTabProps> = ({ gameData, onGameDataUpdate }) => {
    const { t } = useTranslation();
    const [editingRitual, setEditingRitual] = useState<Partial<Ritual> | null>(null);
    const rituals = gameData.rituals || [];

    const handleSave = (ritual: Ritual) => {
        let updatedRituals = [...rituals];
        const index = updatedRituals.findIndex(r => r.id === ritual.id);
        
        if (index > -1) {
            updatedRituals[index] = ritual;
        } else {
            updatedRituals.push(ritual);
        }
        
        onGameDataUpdate('rituals', updatedRituals);
        setEditingRitual(null);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Czy na pewno usunąć ten rytuał?')) {
            const updatedRituals = rituals.filter(r => r.id !== id);
            onGameDataUpdate('rituals', updatedRituals);
        }
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days} dni`;
        if (hours > 0) return `${hours}h`;
        return `${minutes} min`;
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-fuchsia-400">Zarządzanie Ołtarzem Mroku</h3>
                <button 
                    onClick={() => setEditingRitual({})} 
                    className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold shadow-lg"
                >
                    Dodaj Rytuał
                </button>
            </div>

            {editingRitual ? (
                <RitualEditor 
                    ritual={editingRitual} 
                    onSave={handleSave} 
                    onCancel={() => setEditingRitual(null)} 
                    isEditing={!!editingRitual.id} 
                />
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {rituals.length === 0 && <p className="text-gray-500 text-center py-8">Brak zdefiniowanych rytuałów.</p>}
                    
                    {/* Group by Tier */}
                    {[1, 2, 3, 4, 5].map(tier => {
                        const tierRituals = rituals.filter(r => r.tier === tier);
                        if (tierRituals.length === 0) return null;

                        return (
                            <div key={tier} className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                                <h4 className="text-lg font-bold text-gray-400 mb-3 border-b border-slate-700 pb-1">Krąg {tier}</h4>
                                <div className="space-y-2">
                                    {tierRituals.map(ritual => (
                                        <div key={ritual.id} className="flex justify-between items-center bg-slate-800/80 p-3 rounded-lg hover:bg-slate-700/80 transition-colors">
                                            <div>
                                                <div className="font-bold text-fuchsia-300">{ritual.name}</div>
                                                <div className="text-xs text-gray-400 italic">{ritual.description}</div>
                                                <div className="text-xs text-gray-500 mt-1">Czas: {formatDuration(ritual.durationMinutes)} | Koszt: {ritual.cost.length} składników</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingRitual(ritual)} className="px-3 py-1 bg-sky-700 hover:bg-sky-600 rounded text-xs font-bold">Edytuj</button>
                                                <button onClick={() => handleDelete(ritual.id)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs font-bold">Usuń</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
