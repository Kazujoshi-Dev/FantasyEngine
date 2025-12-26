
import React, { useMemo } from 'react';
import { Guild, Ritual, EssenceType } from '../../types';
import { api } from '../../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { StarIcon } from '../icons/StarIcon';
import { rarityStyles } from '../shared/ItemSlot';
import { useTranslation } from '../../contexts/LanguageContext';

export const GuildAltar: React.FC<{ guild: Guild, onUpdate: () => void }> = ({ guild, onUpdate }) => {
    const { t } = useTranslation();
    const { gameData } = useCharacter();
    if (!gameData) return null;
    
    const rituals: Ritual[] = gameData.rituals || [];
    const altarLevel = guild.buildings?.altar || 0;
    
    const activeBuffs = useMemo(() => {
        const now = Date.now();
        // Używamy activeBuffs (mapowane na backendzie)
        return [...(guild.activeBuffs || [])]
            .filter(b => b.expiresAt > now)
            .sort((a, b) => a.expiresAt - b.expiresAt);
    }, [guild.activeBuffs]);

    const handleSacrifice = async (ritualId: string) => {
        if (!confirm('Czy na pewno chcesz wykonać ten rytuał? Koszt zostanie pobrany ze skarbca gildii.')) return;
        try {
            await api.performAltarSacrifice(ritualId);
            // Wywołujemy onUpdate, który w Guild.tsx odpala fetchGuild i aktualizuje stan
            onUpdate();
        } catch(e: any) { alert(e.message); }
    };

    const formatDuration = (totalMinutes: number) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
        return `${minutes}m`;
    };

    const formatStatName = (key: string) => {
        const cleanKey = key.replace('statistics.', '');
        if (cleanKey === 'expBonus') return 'Bonus Doświadczenia (%)';
        const translated = t(`statistics.${cleanKey}`);
        return translated !== `statistics.${cleanKey}` ? translated : cleanKey;
    };

    const getCostLabel = (type: string) => {
        if (type === 'gold') return t('resources.gold');
        if (Object.values(EssenceType).includes(type as EssenceType)) return t(`resources.${type}`);
        return type;
    };

    const essenceToRarityMap: Record<EssenceType, any> = {
        [EssenceType.Common]: rarityStyles['Common'],
        [EssenceType.Uncommon]: rarityStyles['Uncommon'],
        [EssenceType.Rare]: rarityStyles['Rare'],
        [EssenceType.Epic]: rarityStyles['Epic'],
        [EssenceType.Legendary]: rarityStyles['Legendary'],
    };

    const ritualsByTier = useMemo(() => {
        const grouped: Record<number, Ritual[]> = {};
        rituals.forEach(r => {
            if (!grouped[r.tier]) grouped[r.tier] = [];
            grouped[r.tier].push(r);
        });
        return grouped;
    }, [rituals]);

    const availableTiers = Object.keys(ritualsByTier).map(Number).sort((a, b) => a - b);

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl border border-purple-900/50 h-[70vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl font-bold text-purple-400 mb-2 flex items-center gap-2">
                <StarIcon className="h-6 w-6"/> Ołtarz Mroku (Poziom {altarLevel})
            </h3>
            <p className="text-gray-400 mb-6">Wykonuj rytuały, aby zapewnić całej gildii potężne błogosławieństwa.</p>

            <div className="mb-8 bg-slate-800/30 p-4 rounded-xl border border-purple-900/30">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Aktywne Błogosławieństwa
                </h4>
                {activeBuffs.length === 0 && <p className="text-gray-500 italic text-sm text-center py-4">Brak aktywnych efektów.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeBuffs.map((buff, idx) => {
                        const minutesLeft = Math.max(0, Math.ceil((buff.expiresAt - Date.now()) / 60000));
                        const originalRitual = rituals.find(r => r.name === buff.name);
                        return (
                            <div key={idx} className="bg-purple-900/20 border border-purple-500/50 rounded-lg flex items-stretch shadow-lg overflow-hidden h-24">
                                {originalRitual?.image && (
                                    <div className="w-20 flex-shrink-0 border-r border-purple-500/30">
                                        <img src={originalRitual.image} className="w-full h-full object-cover" alt="buff" />
                                    </div>
                                )}
                                <div className="p-3 flex-grow flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-purple-300 text-base leading-tight">{buff.name}</p>
                                        <p className="text-[10px] text-purple-400 uppercase mt-1">Czas: <span className="font-mono font-bold text-white">{formatDuration(minutesLeft)}</span></p>
                                    </div>
                                    <div className="text-right text-[10px] text-gray-300 font-bold uppercase space-y-0.5">
                                        {Object.entries(buff.stats).map(([k,v]) => (
                                            <div key={k} className="flex gap-2 justify-end">
                                                <span className="text-gray-500">{formatStatName(k)}:</span>
                                                <span className="text-green-400 font-mono">+{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <h4 className="text-xl font-bold text-white mb-4 border-b border-slate-700 pb-2">Dostępne Rytuały</h4>
            
            <div className="space-y-8">
                {availableTiers.map(tier => (
                    <div key={tier} className="animate-fade-in">
                        <h5 className="text-md font-bold text-indigo-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                            Krąg {tier}
                            {altarLevel < tier && <span className="text-xs text-red-500 normal-case bg-red-900/20 px-2 py-0.5 rounded border border-red-900/50">Wymagany Ołtarz Lvl {tier}</span>}
                        </h5>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {ritualsByTier[tier].map(ritual => {
                                const isUnlocked = altarLevel >= ritual.tier;
                                const isActive = activeBuffs.some(b => b.name === ritual.name);
                                
                                return (
                                    <div key={ritual.id} className={`rounded-xl border transition-all duration-300 flex flex-col overflow-hidden ${isUnlocked ? 'bg-slate-800/60 border-slate-600 hover:border-purple-500/50' : 'bg-slate-900/50 border-slate-800 opacity-60'} relative group`}>
                                        
                                        {!isUnlocked && <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-[1px]"></div>}

                                        <div className="h-32 relative bg-slate-900 border-b border-slate-700">
                                            {ritual.image ? (
                                                <img src={ritual.image} className="w-full h-full object-cover" alt={ritual.name} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-purple-900"><StarIcon className="h-12 w-12" /></div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                                            <div className="absolute bottom-2 left-3">
                                                <h5 className="text-lg font-black text-white uppercase tracking-tight">{ritual.name}</h5>
                                                <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">{formatDuration(ritual.durationMinutes)}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="p-4 flex-grow flex flex-col">
                                            <p className="text-xs text-gray-400 mb-4 h-8 line-clamp-2">{ritual.description}</p>
                                            
                                            <div className="mb-4 p-2 bg-purple-950/20 rounded border border-purple-500/10">
                                                {Object.entries(ritual.stats).map(([k,v]) => (
                                                     <div key={k} className="text-[10px] flex justify-between text-purple-200/80 uppercase font-bold">
                                                         <span>{formatStatName(k)}</span>
                                                         <span className="text-green-400">+{v}</span>
                                                     </div>
                                                ))}
                                            </div>

                                            <div className="bg-slate-950/50 p-3 rounded mb-4 border border-white/5">
                                                <p className="text-[9px] font-black text-gray-500 uppercase mb-2 tracking-widest">Koszt Rytuału</p>
                                                <div className="space-y-1">
                                                    {ritual.cost.map((c, i) => (
                                                        <div key={i} className="flex justify-between text-xs">
                                                            <span className={c.type === 'gold' ? 'text-amber-400' : essenceToRarityMap[c.type as EssenceType]?.text}>
                                                                {getCostLabel(c.type)}
                                                            </span>
                                                            <span className={`font-mono font-bold ${(guild.resources[c.type as keyof typeof guild.resources] || 0) >= c.amount ? 'text-green-400' : 'text-red-400'}`}>
                                                                {c.amount}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => handleSacrifice(ritual.id)}
                                                disabled={!isUnlocked || isActive}
                                                className={`w-full py-3 rounded-lg font-black text-xs uppercase tracking-widest transition-all shadow-lg
                                                    ${isActive 
                                                        ? 'bg-green-900/50 text-green-400 cursor-default border border-green-700/50' 
                                                        : 'bg-purple-700 hover:bg-purple-600 text-white'}
                                                `}
                                            >
                                                {isActive ? 'Aktywny' : 'Rozpocznij Rytuał'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
