
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';
import { HuntingParty, Enemy } from '../../types';
import { useCharacter } from '@/contexts/CharacterContext';
import { UsersIcon } from '../icons/UsersIcon';
import { CrossedSwordsIcon } from '../icons/CrossedSwordsIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { ShieldIcon } from '../icons/ShieldIcon';

export const GuildHunting: React.FC = () => {
    const { character, gameData } = useCharacter();
    const { t } = useTranslation();
    const [parties, setParties] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Creation State
    const [selectedBossId, setSelectedBossId] = useState<string>('');
    const [createMembers, setCreateMembers] = useState(3);
    const [autoJoin, setAutoJoin] = useState(false);

    const { enemies } = gameData || { enemies: [] };

    // Filter for GUILD BOSSES only
    const guildBosses = useMemo(() => {
        return enemies.filter(e => e.isBoss && e.isGuildBoss);
    }, [enemies]);

    // Auto-select first boss
    useEffect(() => {
        if (guildBosses.length > 0 && (!selectedBossId || !guildBosses.find(b => b.id === selectedBossId))) {
            setSelectedBossId(guildBosses[0].id);
        }
    }, [guildBosses, selectedBossId]);

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
            alert('Dołączyłeś do grupy! Przejdź do zakładki Polowanie (w głównym menu), aby zarządzać.');
        } catch(e: any) { alert(e.message); }
    };
    
    const handleCreate = async () => {
        if (!character) return;
        try {
            // isGuildParty = true
            await api.createParty(selectedBossId, createMembers, true, autoJoin);
            alert('Utworzono polowanie gildyjne! Przejdź do zakładki Polowanie, aby zarządzać.');
            fetchParties();
        } catch (e: any) { alert(e.message); }
    };

    const selectedBoss = useMemo(() => guildBosses.find(b => b.id === selectedBossId), [guildBosses, selectedBossId]);

    // Calculate Scaled Stats for Display
    const scaledBossStats = useMemo(() => {
        if (!selectedBoss) return null;
        const healthMult = 1 + Math.max(0, createMembers - 2) * 0.7;
        const damageMult = 1 + Math.max(0, createMembers - 2) * 0.1;

        return {
            maxHealth: Math.floor(selectedBoss.stats.maxHealth * healthMult),
            minDamage: Math.floor(selectedBoss.stats.minDamage * damageMult),
            maxDamage: Math.floor(selectedBoss.stats.maxDamage * damageMult)
        };
    }, [selectedBoss, createMembers]);

    const estimatedRewards = useMemo(() => {
        if (!selectedBoss) return null;
        const bonusMult = 1.0 + (createMembers * 0.3);
        return {
            minGold: Math.floor(selectedBoss.rewards.minGold * bonusMult),
            maxGold: Math.floor(selectedBoss.rewards.maxGold * bonusMult),
            minExp: Math.floor(selectedBoss.rewards.minExperience * bonusMult),
            maxExp: Math.floor(selectedBoss.rewards.maxExperience * bonusMult),
        }
    }, [selectedBoss, createMembers]);

    if(!gameData || !character) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-fade-in">
            {/* Left Column: Create & Info */}
            <div className="flex flex-col gap-6">
                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-xl font-bold text-purple-400 mb-6 flex items-center gap-2">
                        <ShieldIcon className="h-6 w-6"/> Utwórz Polowanie Gildyjne
                    </h3>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Wybierz Bossa Gildyjnego</label>
                            <select 
                                value={selectedBossId} 
                                onChange={(e) => setSelectedBossId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                {guildBosses.map(boss => (
                                    <option key={boss.id} value={boss.id}>{boss.name}</option>
                                ))}
                                {guildBosses.length === 0 && <option value="" disabled>Brak bossów gildyjnych</option>}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Rozmiar Grupy</label>
                            <select
                                value={createMembers}
                                onChange={(e) => setCreateMembers(parseInt(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                <option value={2}>2 Graczy (Minimum)</option>
                                <option value={3}>3 Graczy</option>
                                <option value={4}>4 Graczy</option>
                                <option value={5}>5 Graczy (Pełna)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-2">Większa drużyna = trudniejsza walka i lepsze nagrody.</p>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded border border-slate-700">
                             <input 
                                type="checkbox" 
                                id="autoJoin" 
                                checked={autoJoin} 
                                onChange={(e) => setAutoJoin(e.target.checked)}
                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <div className="flex flex-col">
                                <label htmlFor="autoJoin" className="text-sm font-bold text-white cursor-pointer">Otwarta rekrutacja</label>
                                <span className="text-xs text-gray-400">Członkowie gildii dołączają automatycznie bez akceptacji lidera.</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleCreate} 
                            disabled={character.stats.currentHealth <= 0 || !selectedBossId}
                            className="w-full py-3 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            <UsersIcon className="h-5 w-5"/> Utwórz Grupę
                        </button>
                    </div>
                </div>

                {/* Boss Info Preview */}
                {selectedBoss && scaledBossStats && (
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-red-900/30 flex-grow">
                        <h4 className="text-lg font-bold text-red-400 mb-4 text-center border-b border-red-900/30 pb-2">Podgląd Celu</h4>
                        <div className="flex flex-col items-center">
                            <div className="h-32 w-32 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border-4 border-slate-700 shadow-xl mb-4">
                                {selectedBoss.image ? (
                                    <img src={selectedBoss.image} className="w-full h-full object-cover" alt={selectedBoss.name} />
                                ) : (
                                    <CrossedSwordsIcon className="h-16 w-16 text-red-700 opacity-50" />
                                )}
                            </div>
                            <h5 className="font-bold text-white text-lg">{selectedBoss.name}</h5>
                            <p className="text-sm text-gray-400 italic text-center mb-4">{selectedBoss.description}</p>
                            
                            <div className="grid grid-cols-2 gap-4 w-full text-sm font-mono text-gray-300 bg-slate-800/50 p-3 rounded-lg mb-4">
                                <div className="text-center">HP: <span className="text-white font-bold">{scaledBossStats.maxHealth}</span></div>
                                <div className="text-center">DMG: <span className="text-white font-bold">{scaledBossStats.minDamage}-{scaledBossStats.maxDamage}</span></div>
                            </div>

                            {estimatedRewards && (
                                <div className="w-full bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                    <p className="text-gray-500 text-[10px] uppercase tracking-widest text-center mb-2">Nagrody (Os.)</p>
                                    <div className="flex justify-around items-center">
                                        <div className="text-amber-400 font-bold flex items-center gap-1"><CoinsIcon className="h-4 w-4"/> {estimatedRewards.minGold}-{estimatedRewards.maxGold}</div>
                                        <div className="text-sky-400 font-bold flex items-center gap-1"><StarIcon className="h-4 w-4"/> {estimatedRewards.minExp}-{estimatedRewards.maxExp}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column: Active Parties */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col h-[70vh]">
                <h3 className="text-xl font-bold text-purple-400 mb-4 flex justify-between items-center">
                    <span>Aktywne Polowania</span>
                    <span className="text-xs bg-slate-800 text-gray-400 px-2 py-1 rounded">{parties.length}</span>
                </h3>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {parties.length === 0 && <p className="text-gray-500 text-center py-12 italic">Brak aktywnych polowań w gildii.</p>}
                    {parties.map(p => {
                        const boss = gameData.enemies.find(e => e.id === p.bossId);
                        return (
                            <div key={p.id} className="bg-slate-800 p-4 rounded-lg border border-purple-500/30 hover:border-purple-500 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            {boss?.name} 
                                            <span className="text-[10px] bg-purple-900 text-purple-200 px-1.5 rounded border border-purple-700 uppercase">Gildia</span>
                                            {p.autoJoin && <span className="text-[10px] bg-green-900 text-green-200 px-1.5 rounded border border-green-700 uppercase">Otwarta</span>}
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">Lider: {p.leaderName}</p>
                                    </div>
                                    <button 
                                        onClick={() => joinParty(p.id)} 
                                        disabled={character.stats.currentHealth <= 0}
                                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white shadow transition-colors disabled:bg-slate-600"
                                    >
                                        Dołącz
                                    </button>
                                </div>
                                
                                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                                    <div className="bg-purple-500 h-full transition-all" style={{width: `${(p.currentMembersCount / p.maxMembers) * 100}%`}}></div>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-400">
                                    <span>Gracze</span>
                                    <span className="text-white font-mono">{p.currentMembersCount} / {p.maxMembers}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
