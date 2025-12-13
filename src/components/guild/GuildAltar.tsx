
import React from 'react';
import { Guild, Ritual, EssenceType } from '../../types';
import { api } from '../../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { StarIcon } from '../icons/StarIcon';
import { rarityStyles } from '../shared/ItemSlot';

export const GuildAltar: React.FC<{ guild: Guild, onUpdate: () => void }> = ({ guild, onUpdate }) => {
    const { gameData } = useCharacter();
    if (!gameData) return null;
    
    const rituals: Ritual[] = gameData.rituals || [];
    const altarLevel = guild.buildings?.altar || 0;
    const activeBuffs = guild.activeBuffs || [];

    const handleSacrifice = async (ritualId: number) => {
        if (!confirm('Czy na pewno chcesz wykonać ten rytuał? Koszt zostanie pobrany ze skarbca gildii.')) return;
        try {
            await api.performAltarSacrifice(ritualId);
            onUpdate();
        } catch(e: any) { alert(e.message); }
    };

    // Helper for rarity styles map reuse
    const essenceToRarityMap: Record<EssenceType, any> = {
        [EssenceType.Common]: rarityStyles['Common'],
        [EssenceType.Uncommon]: rarityStyles['Uncommon'],
        [EssenceType.Rare]: rarityStyles['Rare'],
        [EssenceType.Epic]: rarityStyles['Epic'],
        [EssenceType.Legendary]: rarityStyles['Legendary'],
    };

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl border border-purple-900/50 h-[70vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-purple-400 mb-2 flex items-center gap-2">
                <StarIcon className="h-6 w-6"/> Ołtarz Mroku (Poziom {altarLevel})
            </h3>
            <p className="text-gray-400 mb-6">Wykonuj rytuały, aby zapewnić całej gildii potężne błogosławieństwa.</p>

            <div className="mb-8">
                <h4 className="text-lg font-bold text-white mb-4">Aktywne Błogosławieństwa</h4>
                {activeBuffs.length === 0 && <p className="text-gray-500 italic">Brak aktywnych efektów.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeBuffs.map((buff, idx) => {
                        const timeLeft = Math.max(0, Math.ceil((buff.expiresAt - Date.now()) / 60000));
                        return (
                            <div key={idx} className="bg-purple-900/20 border border-purple-500/50 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-purple-300">{buff.name}</p>
                                    <p className="text-xs text-purple-200">Pozostało: {timeLeft} min</p>
                                </div>
                                <div className="text-right text-xs text-gray-300">
                                    {Object.entries(buff.stats).map(([k,v]) => <div key={k}>{k}: +{v}</div>)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <h4 className="text-lg font-bold text-white mb-4">Dostępne Rytuały</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {rituals.map(ritual => {
                    const isUnlocked = altarLevel >= ritual.tier;
                    const isActive = activeBuffs.some(b => b.name === ritual.name);
                    
                    return (
                        <div key={ritual.id} className={`p-4 rounded-xl border ${isUnlocked ? 'bg-slate-800/60 border-slate-600' : 'bg-slate-900/50 border-slate-800 opacity-60'} relative overflow-hidden`}>
                            {!isUnlocked && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                    <span className="text-red-500 font-bold bg-black/80 px-3 py-1 rounded border border-red-900">Wymagany Ołtarz Lvl {ritual.tier}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-start mb-2">
                                <h5 className="text-lg font-bold text-white">{ritual.name}</h5>
                                <span className="text-xs text-gray-400">{ritual.durationMinutes} min</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-4 h-10">{ritual.description}</p>
                            
                            <div className="bg-slate-900/50 p-3 rounded mb-4">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Koszt</p>
                                <div className="space-y-1">
                                    {ritual.cost.map((c, i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                            <span className={c.type === 'gold' ? 'text-amber-400' : essenceToRarityMap[c.type as EssenceType]?.text}>{c.type === 'gold' ? 'Złoto' : c.type}</span>
                                            <span className={`font-mono font-bold ${(guild.resources[c.type as keyof typeof guild.resources] || 0) >= c.amount ? 'text-green-400' : 'text-red-400'}`}>
                                                {c.amount}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={() => handleSacrifice(Number(ritual.id))} // Assuming ID matches index or logic
                                disabled={!isUnlocked || isActive}
                                className={`w-full py-2 rounded font-bold transition-colors ${isActive ? 'bg-green-900/50 text-green-400 cursor-default' : 'bg-purple-700 hover:bg-purple-600 text-white'}`}
                            >
                                {isActive ? 'Aktywny' : 'Rozpocznij Rytuał'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
