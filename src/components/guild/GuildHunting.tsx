
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { HuntingParty } from '../../types';
import { useCharacter } from '@/contexts/CharacterContext';

export const GuildHunting: React.FC = () => {
    const { character, gameData } = useCharacter();
    const [parties, setParties] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchParties = async () => {
        setLoading(true);
        try {
            const token = api.getAuthToken();
            const res = await fetch('/api/hunting/guild-parties', { headers: { 'Authorization': `Bearer ${token}` } });
            if(res.ok) setParties(await res.json());
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchParties();
        const interval = setInterval(fetchParties, 5000);
        return () => clearInterval(interval);
    }, []);

    const joinParty = async (id: number) => {
        try {
            await api.joinParty(id);
            alert('Dołączyłeś do grupy! Przejdź do zakładki Polowanie, aby zarządzać.');
        } catch(e: any) { alert(e.message); }
    };

    if(!gameData) return null;

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-purple-400 mb-4">Gildyjne Polowania</h3>
            <p className="text-sm text-gray-400 mb-6">Tutaj widoczne są tylko polowania utworzone przez członków Twojej gildii.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {parties.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">Brak aktywnych polowań w gildii.</p>}
                {parties.map(p => {
                    const boss = gameData.enemies.find(e => e.id === p.bossId);
                    return (
                        <div key={p.id} className="bg-slate-800 p-4 rounded-lg border border-purple-500/30 hover:border-purple-500 transition-colors">
                            <h4 className="font-bold text-white">{boss?.name}</h4>
                            <p className="text-xs text-gray-400 mb-2">Lider: {p.leaderName}</p>
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                                <div className="bg-purple-500 h-full" style={{width: `${(p.currentMembersCount / p.maxMembers) * 100}%`}}></div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-300">{p.currentMembersCount}/{p.maxMembers} graczy</span>
                                <button onClick={() => joinParty(p.id)} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white">Dołącz</button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-8 pt-4 border-t border-slate-700 text-center">
                <p className="text-sm text-gray-400">Aby utworzyć polowanie gildyjne, przejdź do głównej zakładki <strong>Polowanie</strong> i zaznacz opcję "Gildyjne".</p>
            </div>
        </div>
    );
};
