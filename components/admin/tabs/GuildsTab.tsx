
import React, { useState, useEffect } from 'react';
import { api } from '../../../api';
import { useTranslation } from '../../../contexts/LanguageContext';

interface AdminGuild {
    id: number;
    name: string;
    tag: string;
    leader_name: string;
    buildings: Record<string, number>;
}

const BUILDING_TYPES = [
    { key: 'headquarters', label: 'Siedziba (Limit członków)' },
    { key: 'armory', label: 'Zbrojownia' },
    { key: 'barracks', label: 'Koszary (Bonus DMG)' },
    { key: 'scoutHouse', label: 'Dom Zwiadowcy (Loot)' },
    { key: 'shrine', label: 'Kapliczka (Szczęście)' },
    { key: 'altar', label: 'Ołtarz Mroku (Rytuały)' },
];

export const GuildsTab: React.FC = () => {
    const { t } = useTranslation();
    const [guilds, setGuilds] = useState<AdminGuild[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingGuild, setEditingGuild] = useState<AdminGuild | null>(null);
    const [editBuildings, setEditBuildings] = useState<Record<string, number>>({});

    const fetchGuilds = async () => {
        setIsLoading(true);
        try {
            const data = await api.adminGetGuilds();
            setGuilds(data);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGuilds();
    }, []);

    const handleEditClick = (guild: AdminGuild) => {
        setEditingGuild(guild);
        // Initialize with existing buildings or 0 if missing
        const currentBuildings = guild.buildings || {};
        const initialEditState: Record<string, number> = {};
        BUILDING_TYPES.forEach(b => {
            initialEditState[b.key] = currentBuildings[b.key] || 0;
        });
        setEditBuildings(initialEditState);
    };

    const handleBuildingChange = (key: string, value: string) => {
        const numValue = parseInt(value, 10);
        setEditBuildings(prev => ({
            ...prev,
            [key]: isNaN(numValue) ? 0 : Math.max(0, numValue)
        }));
    };

    const handleSave = async () => {
        if (!editingGuild) return;
        
        try {
            await api.adminUpdateGuildBuildings(editingGuild.id, editBuildings);
            alert('Budynki zaktualizowane pomyślnie.');
            setEditingGuild(null);
            fetchGuilds();
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="animate-fade-in">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">Zarządzanie Gildiami</h3>
            
            {editingGuild ? (
                <div className="bg-slate-800/80 p-6 rounded-xl border border-slate-600 max-w-2xl">
                    <h4 className="text-xl font-bold text-white mb-4">
                        Edycja budynków: <span className="text-amber-400">[{editingGuild.tag}] {editingGuild.name}</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {BUILDING_TYPES.map(b => (
                            <div key={b.key} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                <label className="block text-sm font-medium text-gray-300 mb-1">{b.label}</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={editBuildings[b.key]} 
                                    onChange={(e) => handleBuildingChange(b.key, e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <button 
                            onClick={() => setEditingGuild(null)}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-bold"
                        >
                            Anuluj
                        </button>
                        <button 
                            onClick={handleSave}
                            className="px-6 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-bold shadow-lg"
                        >
                            Zapisz Zmiany
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <button onClick={fetchGuilds} className="mb-4 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">Odśwież listę</button>
                    
                    {isLoading ? <p>Ładowanie...</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-800/50 text-gray-400">
                                    <tr>
                                        <th className="p-3">ID</th>
                                        <th className="p-3">Tag</th>
                                        <th className="p-3">Nazwa</th>
                                        <th className="p-3">Lider</th>
                                        <th className="p-3">Budynki (Suma poziomów)</th>
                                        <th className="p-3 text-right">Akcje</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {guilds.map(guild => {
                                        const totalLevels = Object.values(guild.buildings || {}).reduce((a: number, b: number) => a + b, 0);
                                        return (
                                            <tr key={guild.id} className="hover:bg-slate-800/30">
                                                <td className="p-3 text-gray-500">{guild.id}</td>
                                                <td className="p-3 font-mono text-amber-400">[{guild.tag}]</td>
                                                <td className="p-3 font-bold text-white">{guild.name}</td>
                                                <td className="p-3 text-gray-300">{guild.leader_name}</td>
                                                <td className="p-3 text-sky-400 font-bold">{totalLevels}</td>
                                                <td className="p-3 text-right">
                                                    <button 
                                                        onClick={() => handleEditClick(guild)}
                                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white"
                                                    >
                                                        Edytuj Budynki
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {guilds.length === 0 && <p className="text-center py-8 text-gray-500">Brak gildii w bazie danych.</p>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
