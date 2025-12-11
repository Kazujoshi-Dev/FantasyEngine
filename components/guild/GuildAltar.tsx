
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, Ritual, EssenceType, ItemRarity } from '../../types';
import { StarIcon } from '../icons/StarIcon';
import { rarityStyles } from '../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

interface GuildAltarProps {
    guild: GuildType;
    onUpdate?: () => void; // Used to refresh guild state (resources, buffs)
}

const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "0m";
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

const formatDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
};

export const GuildAltar: React.FC<GuildAltarProps> = ({ guild, onUpdate }) => {
    const { t } = useTranslation();
    const [rituals, setRituals] = useState<Ritual[]>([]);
    const [loading, setLoading] = useState(true);
    // State to trigger re-renders for timers
    const [, setTick] = useState(0);

    useEffect(() => {
        const fetchRituals = async () => {
            try {
                const gameData = await api.getGameData();
                if (gameData.rituals) {
                    setRituals(gameData.rituals);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchRituals();
        
        // Interval to update UI timers and enable/disable buttons based on expiration
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleSacrifice = async (ritualId: string) => {
        if (!confirm('Czy na pewno chcesz przeprowadzić ten rytuał? Koszt zostanie pobrany ze skarbca gildii.')) return;
        try {
            await api.performAltarSacrifice(ritualId as any); 
            // Important: Call onUpdate immediately to refresh guild data in parent
            if (onUpdate) onUpdate();
            alert('Rytuał rozpoczęty! Bogowie Mroku są zadowoleni.');
        } catch (e: any) {
            alert(e.message);
        }
    };

    const getStatLabel = (key: string) => {
        switch (key) {
            case 'expBonus': return 'Bonus Doświadczenia';
            case 'minDamage': return t('item.damageMin');
            case 'maxDamage': return t('item.damageMax');
            default: return t(`statistics.${key}` as any);
        }
    };

    const activeBuffs = guild.activeBuffs || [];
    const serverTime = api.getServerTime();

    return (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[70vh]">
            {/* Rituals List */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-fuchsia-900/50 flex flex-col min-h-0">
                <h3 className="text-xl font-bold text-fuchsia-400 mb-4 flex items-center gap-2">
                    <StarIcon className="h-6 w-6"/> Dostępne Rytuały
                </h3>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {loading && <p className="text-gray-500">Ładowanie księgi rytuałów...</p>}
                    {!loading && rituals.length === 0 && <p className="text-gray-500">Brak znanych rytuałów.</p>}
                    
                    {[1, 2, 3, 4, 5].map(tier => {
                        const tierRituals = rituals.filter(r => r.tier === tier);
                        if (tierRituals.length === 0) return null;
                        
                        const altarLevel = guild.buildings?.altar || 0;
                        const isUnlocked = altarLevel >= tier;

                        // Jeśli poziom budynku jest za niski, ukrywamy ten krąg całkowicie
                        if (!isUnlocked) return null;

                        return (
                            <div key={tier} className="mb-4">
                                <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest border-b border-slate-700 pb-1">
                                    Krąg {tier}
                                </h4>
                                <div className="space-y-2">
                                    {tierRituals.map(ritual => {
                                         // Use server time for precise check
                                         const isActive = activeBuffs.some(b => b.name === ritual.name && b.expiresAt > serverTime);
                                         
                                         // Check costs
                                         const canAfford = ritual.cost.every(c => {
                                             const type = c.type;
                                             const has = (type === 'gold' ? guild.resources.gold : guild.resources[type as EssenceType]) || 0;
                                             return has >= c.amount;
                                         });

                                        return (
                                            <div key={ritual.id} className={`bg-slate-800/80 p-3 rounded-lg border border-slate-700 transition-colors ${isActive ? 'border-green-500/50' : 'hover:border-fuchsia-500/50'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-bold text-fuchsia-300">{ritual.name}</p>
                                                        <p className="text-xs text-gray-400 italic">{ritual.description}</p>
                                                    </div>
                                                    {isActive && <span className="text-xs font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded">AKTYWNY</span>}
                                                </div>

                                                {/* Bonus Stats Display */}
                                                <div className="mb-3 flex flex-wrap gap-2">
                                                    {Object.entries(ritual.stats).map(([key, val]) => (
                                                        <div key={key} className="text-xs bg-slate-900/60 px-2 py-1 rounded border border-green-900/30 text-green-400 flex items-center">
                                                            <span className="text-gray-400 mr-1">
                                                                {getStatLabel(key)}:
                                                            </span>
                                                            <span className="font-bold">+{val}{key === 'expBonus' ? '%' : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {/* Cost Grid - Compact */}
                                                <div className="bg-slate-950/50 p-2 rounded border border-slate-800 mb-2">
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                        {ritual.cost.map((c, idx) => {
                                                            const type = c.type;
                                                            const has = (type === 'gold' ? guild.resources.gold : guild.resources[type as EssenceType]) || 0;
                                                            const enough = has >= c.amount;
                                                            const label = type === 'gold' ? t('resources.gold') : t(`resources.${type}`);
                                                            const style = type === 'gold' ? { text: 'text-amber-400' } : essenceToRarityMap[type as EssenceType];
                                                            
                                                            return (
                                                                <div key={idx} className="flex justify-between items-center text-xs">
                                                                    <span className={`${style?.text} truncate mr-1`} title={label}>{label}</span>
                                                                    <span className={`font-mono ${enough ? 'text-gray-300' : 'text-red-400 font-bold'}`}>
                                                                        {has}/{c.amount}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500">Czas trwania: {formatDuration(ritual.durationMinutes)}</span>
                                                    <button 
                                                        onClick={() => handleSacrifice(ritual.id)}
                                                        disabled={!isUnlocked || !canAfford || isActive}
                                                        className={`px-3 py-1 text-xs font-bold rounded shadow-lg transition-colors
                                                            ${isActive 
                                                                ? 'bg-slate-700 text-gray-500 cursor-not-allowed' 
                                                                : (!isUnlocked || !canAfford)
                                                                    ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                                                                    : 'bg-fuchsia-700 hover:bg-fuchsia-600 text-white'
                                                            }
                                                        `}
                                                    >
                                                        {isActive ? 'Aktywny' : 'Złóż Ofiarę'}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Active Effects */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col min-h-0">
                <h3 className="text-xl font-bold text-white mb-4">Aktywne Błogosławieństwa</h3>
                <div className="flex-grow overflow-y-auto space-y-2">
                    {/* Only show buffs that are not expired based on synced server time */}
                    {activeBuffs.filter(b => b.expiresAt > serverTime).length === 0 && <p className="text-gray-500 italic text-center py-8">Ołtarz milczy. Złóż ofiarę, aby uzyskać błogosławieństwo.</p>}
                    
                    {activeBuffs.filter(b => b.expiresAt > serverTime).map(buff => {
                        const timeLeftStr = formatTimeRemaining(buff.expiresAt - serverTime);
                        return (
                            <div key={buff.id} className="bg-slate-800/80 p-4 rounded-lg border border-green-500/30 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <StarIcon className="h-16 w-16 text-green-400" />
                                </div>
                                <div className="relative z-10">
                                    <h4 className="font-bold text-lg text-green-400 mb-1">{buff.name}</h4>
                                    <p className="text-sm text-white mb-2">
                                        Pozostało: <span className="font-mono text-amber-400">{timeLeftStr}</span>
                                    </p>
                                    <div className="text-xs text-gray-300 space-y-1">
                                        {Object.entries(buff.stats).map(([key, val]) => (
                                            <p key={key}>
                                                {getStatLabel(key)}: <span className="text-green-400 font-bold">+{val}{key === 'expBonus' ? '%' : ''}</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};
