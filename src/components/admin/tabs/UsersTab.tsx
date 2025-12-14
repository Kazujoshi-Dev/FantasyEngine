
import React, { useState, useEffect } from 'react';
import { api } from '../../../api';
import { AdminCharacterInfo } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

export const UsersTab: React.FC<{ gameData: any }> = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<AdminCharacterInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await api.getAllCharacters();
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć tego użytkownika i postać? Ta operacja jest nieodwracalna.')) return;
        try {
            await api.deleteCharacter(id); // Effectively deletes user cascade
            fetchUsers();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleUpdateGold = async (id: number) => {
        const amount = prompt('Nowa ilość złota:');
        if (amount === null) return;
        try {
            await api.updateCharacterGold(id, parseInt(amount));
            fetchUsers();
        } catch (e: any) {
            alert(e.message);
        }
    };
    
    const handleHeal = async (id: number) => {
        try {
            await api.adminHealCharacter(id);
            alert('Postać uleczona.');
        } catch (e: any) {
            alert(e.message);
        }
    }

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <input 
                    type="text" 
                    placeholder="Szukaj użytkownika..." 
                    className="bg-slate-800 border border-slate-600 rounded p-2 text-white w-64"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <button onClick={fetchUsers} className="text-sm text-indigo-400 hover:text-indigo-300">Odśwież</button>
            </div>
            
            <div className="flex-grow overflow-auto border border-slate-700 rounded-lg">
                <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-slate-800 text-gray-400 sticky top-0">
                        <tr>
                            <th className="p-3">ID</th>
                            <th className="p-3">Login</th>
                            <th className="p-3">Postać</th>
                            <th className="p-3">Rasa/Klasa</th>
                            <th className="p-3">Poziom</th>
                            <th className="p-3">Złoto</th>
                            <th className="p-3 text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {loading ? <tr><td colSpan={7} className="p-4 text-center">Ładowanie...</td></tr> : 
                         filteredUsers.map(u => (
                            <tr key={u.user_id} className="hover:bg-slate-800/30">
                                <td className="p-3 font-mono text-xs">{u.user_id}</td>
                                <td className="p-3">{u.username}</td>
                                <td className="p-3 font-bold text-white">{u.name}</td>
                                <td className="p-3">{u.race} {u.characterClass ? `/ ${u.characterClass}` : ''}</td>
                                <td className="p-3">{u.level}</td>
                                <td className="p-3 font-mono text-amber-400">{u.gold}</td>
                                <td className="p-3 text-right space-x-2">
                                    <button onClick={() => handleHeal(u.user_id)} className="text-green-400 hover:text-green-300 text-xs px-2 py-1 border border-green-900 rounded">Ulecz</button>
                                    <button onClick={() => handleUpdateGold(u.user_id)} className="text-amber-400 hover:text-amber-300 text-xs px-2 py-1 border border-amber-900 rounded">Złoto</button>
                                    <button onClick={() => handleDelete(u.user_id)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-900 rounded">Usuń</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
