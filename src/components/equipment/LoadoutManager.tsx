
import React, { useState } from 'react';
import { useCharacter } from '../../contexts/CharacterContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { EquipmentLoadout } from '../../types';
import { StarIcon } from '../icons/StarIcon';

export const LoadoutManager: React.FC = () => {
    const { character, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [isProcessing, setIsProcessing] = useState<number | null>(null);

    if (!character) return null;

    const loadouts = character.loadouts || [];

    const handleSave = async (id: number) => {
        const name = prompt("Podaj nazwę zestawu:", loadouts.find(l => l.id === id)?.name || `Zestaw ${id + 1}`);
        if (name === null) return;
        
        setIsProcessing(id);
        try {
            const updated = await api.saveLoadout(id, name);
            updateCharacter(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleLoad = async (id: number) => {
        setIsProcessing(id);
        try {
            const updated = await api.loadLoadout(id);
            updateCharacter(updated);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(null);
        }
    };

    const renderLoadoutSlot = (index: number) => {
        const loadout = loadouts.find(l => l.id === index);
        const isActive = isProcessing === index;

        return (
            <div key={index} className="flex-1 min-w-[120px] bg-slate-800/50 border border-slate-700 rounded-lg p-2 flex flex-col gap-2 transition-all hover:border-slate-500">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Slot {index + 1}</span>
                    {loadout && <StarIcon className="h-3 w-3 text-amber-500 fill-current" />}
                </div>
                
                <div className="flex-grow">
                    <p className="text-xs font-bold text-gray-200 truncate">
                        {loadout ? loadout.name : "Pusty"}
                    </p>
                </div>

                <div className="flex gap-1 mt-1">
                    {loadout ? (
                        <>
                            <button 
                                onClick={() => handleLoad(index)}
                                disabled={isActive}
                                className="flex-1 py-1 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors disabled:bg-slate-700"
                            >
                                {isActive ? "..." : "Wczytaj"}
                            </button>
                            <button 
                                onClick={() => handleSave(index)}
                                disabled={isActive}
                                title="Nadpisz aktualnym"
                                className="px-2 py-1 text-[10px] font-black uppercase bg-slate-700 hover:bg-slate-600 rounded text-gray-300 transition-colors disabled:bg-slate-800"
                            >
                                S
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => handleSave(index)}
                            disabled={isActive}
                            className="w-full py-1 text-[10px] font-black uppercase bg-green-700/30 hover:bg-green-700/50 border border-green-700/50 rounded text-green-400 transition-colors disabled:bg-slate-700"
                        >
                            {isActive ? "..." : "Zapisz"}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="mb-6 p-4 bg-slate-900/40 rounded-2xl border border-white/5 shadow-inner">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 px-1 flex items-center gap-2">
                <StarIcon className="h-3 w-3" /> Zestawy Ekwipunku
            </h3>
            <div className="flex flex-wrap gap-3">
                {[0, 1, 2, 3, 4].map(i => renderLoadoutSlot(i))}
            </div>
            <p className="text-[9px] text-gray-600 mt-2 italic px-1">
                * Nieużywane przedmioty trafią do plecaka lub magazynu (o ile jest w nich miejsce).
            </p>
        </div>
    );
};
