
import React, { useState, useMemo, useEffect } from 'react';
import { GameData, PlayerRank, AdminCharacterInfo } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';

export const PlayerRanksTab: React.FC<{
  gameData: GameData;
  onGameDataUpdate: (key: string, data: any) => void;
}> = ({ gameData, onGameDataUpdate }) => {
    const { t } = useTranslation();
    const [editingRank, setEditingRank] = useState<Partial<PlayerRank> | null>(null);
    const [grantingRankId, setGrantingRankId] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    const [users, setUsers] = useState<AdminCharacterInfo[]>([]);

    const ranks = gameData.playerRanks || [];

    useEffect(() => {
        api.getAllCharacters().then(setUsers).catch(console.error);
    }, []);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRank?.name) return;

        const rankToSave = {
            ...editingRank,
            id: editingRank.id || crypto.randomUUID(),
            bonus: editingRank.bonus || {}
        } as PlayerRank;

        const updated = [...ranks];
        const idx = updated.findIndex(r => r.id === rankToSave.id);
        if (idx > -1) updated[idx] = rankToSave;
        else updated.push(rankToSave);

        onGameDataUpdate('playerRanks', updated);
        setEditingRank(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Usunąć rangę?')) return;
        onGameDataUpdate('playerRanks', ranks.filter(r => r.id !== id));
    };

    const handleGrant = async () => {
        if (!grantingRankId || !selectedUserId) return;
        try {
            await api.adminGrantRank(Number(selectedUserId), grantingRankId);
            alert('Ranga przyznana!');
            setGrantingRankId(null);
        } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">System Rang</h3>
                <button onClick={() => setEditingRank({ name: '', backgroundColor: '#1e293b', textColor: '#ffffff', bonus: {} })} className="px-4 py-2 bg-green-700 rounded text-white font-bold">Dodaj Rangę</button>
            </div>

            {editingRank ? (
                <form onSubmit={handleSave} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400">Nazwa Rangi</label>
                            <input className="w-full bg-slate-700 p-2 rounded" value={editingRank.name} onChange={e => setEditingRank({...editingRank, name: e.target.value})} required />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="block text-sm text-gray-400">Kolor Tła</label>
                                <input type="color" className="w-full h-10 p-1 bg-slate-700 rounded" value={editingRank.backgroundColor} onChange={e => setEditingRank({...editingRank, backgroundColor: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400">Kolor Tekstu</label>
                                <input type="color" className="w-full h-10 p-1 bg-slate-700 rounded" value={editingRank.textColor} onChange={e => setEditingRank({...editingRank, textColor: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-slate-900 rounded border border-slate-700">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-2">Bonus (Podgląd: Atrybuty przedmiotów)</p>
                        <div className="grid grid-cols-3 gap-2">
                             {/* Simplified stat input for 1 bonus as requested */}
                             <select 
                                className="bg-slate-700 p-1 rounded text-sm"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingRank({...editingRank, bonus: { [val]: 1 }});
                                }}
                             >
                                 <option value="">-- Wybierz Bonus --</option>
                                 <option value="strength">Siła</option>
                                 <option value="agility">Zręczność</option>
                                 <option value="stamina">Wytrzymałość</option>
                                 <option value="intelligence">Inteligencja</option>
                                 <option value="luck">Szczęście</option>
                                 <option value="accuracy">Celność</option>
                                 <option value="damageMin">Obrażenia Min</option>
                                 <option value="damageMax">Obrażenia Max</option>
                                 <option value="armorBonus">Pancerz</option>
                             </select>
                             <input 
                                type="number" 
                                placeholder="Wartość"
                                className="bg-slate-700 p-1 rounded text-sm"
                                value={Object.values(editingRank.bonus || {})[0] || ''}
                                onChange={(e) => {
                                    const key = Object.keys(editingRank.bonus || {})[0];
                                    if(key) setEditingRank({...editingRank, bonus: { [key]: parseInt(e.target.value) || 0 }});
                                }}
                             />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingRank(null)} className="px-4 py-2 bg-slate-600 rounded">Anuluj</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 rounded text-white font-bold">Zapisz</button>
                    </div>
                </form>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ranks.map(rank => (
                        <div key={rank.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span 
                                    className="px-2 py-0.5 rounded text-xs font-bold shadow-sm"
                                    style={{ backgroundColor: rank.backgroundColor, color: rank.textColor }}
                                >
                                    {rank.name}
                                </span>
                                <div className="text-xs text-gray-400">
                                    {Object.entries(rank.bonus || {}).map(([k,v]) => `${k}: +${v}`).join(', ')}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setGrantingRankId(rank.id)} className="px-2 py-1 bg-amber-600 rounded text-[10px] font-bold">Przyznaj</button>
                                <button onClick={() => setEditingRank(rank)} className="px-2 py-1 bg-sky-700 rounded text-[10px]">Edytuj</button>
                                <button onClick={() => handleDelete(rank.id)} className="px-2 py-1 bg-red-800 rounded text-[10px]">Usuń</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {grantingRankId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm w-full">
                        <h4 className="text-lg font-bold mb-4 text-white">Przyznaj Rangę</h4>
                        <select 
                            className="w-full bg-slate-700 p-2 rounded mb-4"
                            value={selectedUserId}
                            onChange={e => setSelectedUserId(Number(e.target.value))}
                        >
                            <option value="">-- Wybierz Gracza --</option>
                            {users.map(u => <option key={u.user_id} value={u.user_id}>{u.name} (Lvl {u.level})</option>)}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setGrantingRankId(null)} className="px-4 py-2 bg-slate-700 rounded">Zamknij</button>
                            <button onClick={handleGrant} disabled={!selectedUserId} className="px-4 py-2 bg-indigo-600 rounded text-white font-bold">Przyznaj</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
