
import React, { useState } from 'react';
import { Guild, EssenceType, GuildRole } from '../../types';
import { api } from '../../api';
import { rarityStyles } from '../shared/ItemSlot';
import { useTranslation } from '../../contexts/LanguageContext';

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

interface Ritual {
    id: number;
    tier: number; // Wtajemniczenie
    name: string;
    effect: string;
    duration: string;
    cost: { type: EssenceType, amount: number }[];
    isActive?: boolean; // placeholder for future use logic
}

// Hardcoded rituals structure for now. 
// Backend only supports ID 1 currently, so others are placeholders or potential future expansions.
const ALL_RITUALS: Ritual[] = [
    {
        id: 1,
        tier: 1,
        name: 'Okruchy Szczęścia',
        effect: 'Zwiększa szczęście wszystkich członków o 20.',
        duration: '48 godzin',
        cost: [
            { type: EssenceType.Common, amount: 50 },
            { type: EssenceType.Uncommon, amount: 25 },
            { type: EssenceType.Rare, amount: 15 },
            { type: EssenceType.Epic, amount: 5 },
            { type: EssenceType.Legendary, amount: 1 }
        ]
    },
    {
        id: 101, // Placeholder ID
        tier: 1,
        name: 'Małe Błogosławieństwo',
        effect: 'Zwiększa zdobywane doświadczenie o 2%.',
        duration: '24 godziny',
        cost: [{ type: EssenceType.Common, amount: 100 }]
    },
    {
        id: 2,
        tier: 2,
        name: 'Duch Wojownika',
        effect: 'Zwiększa obrażenia fizyczne o 5%.',
        duration: '48 godzin',
        cost: [
             { type: EssenceType.Rare, amount: 50 },
             { type: EssenceType.Epic, amount: 10 }
        ]
    },
     {
        id: 3,
        tier: 3,
        name: 'Mądrość Przodków',
        effect: 'Zwiększa inteligencję i regenerację many o 10%.',
        duration: '72 godziny',
        cost: [
             { type: EssenceType.Epic, amount: 30 },
             { type: EssenceType.Legendary, amount: 5 }
        ]
    },
     {
        id: 4,
        tier: 4,
        name: 'Żelazna Skóra',
        effect: 'Zwiększa pancerz o 50 punktów.',
        duration: '72 godziny',
        cost: [
             { type: EssenceType.Epic, amount: 50 },
             { type: EssenceType.Legendary, amount: 10 }
        ]
    },
     {
        id: 5,
        tier: 5,
        name: 'Gniew Bogów',
        effect: 'Zwiększa wszystkie statystyki o 5% oraz szansę na kryt o 5%.',
        duration: '7 dni',
        cost: [
             { type: EssenceType.Legendary, amount: 50 }
        ]
    }
];

interface GuildAltarProps {
    guild: Guild;
    onCharacterUpdate?: () => void;
}

export const GuildAltar: React.FC<GuildAltarProps> = ({ guild, onCharacterUpdate }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [activeTier, setActiveTier] = useState<number>(1);
    
    const altarLevel = guild.buildings?.altar || 0;
    const canManage = guild.myRole === GuildRole.LEADER || guild.myRole === GuildRole.OFFICER;

    const handleSacrifice = async (ritualId: number) => {
        // Temporary check: Only ID 1 is implemented on backend fully
        if (ritualId !== 1) {
            alert('Ten rytuał nie jest jeszcze dostępny (Wkrótce).');
            return;
        }

        if (!confirm('Czy na pewno chcesz dokonać poświęcenia? Surowce zostaną pobrane ze skarbca.')) return;
        setLoading(true);
        try {
            await api.performAltarSacrifice(ritualId);
            alert('Rytuał odprawiony pomyślnie!');
            
            // Refresh character data to show new buffs immediately
            if (onCharacterUpdate) {
                onCharacterUpdate();
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const formatTimeLeft = (expiresAt: number) => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) return 'Wygasło';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    const displayedRituals = ALL_RITUALS.filter(r => r.tier === activeTier);
    const isTierLocked = altarLevel < activeTier;

    return (
        <div className="h-[70vh] overflow-y-auto pr-2 animate-fade-in flex flex-col gap-6">
            {/* Flavor Text Section */}
            <div className="bg-slate-900/40 p-8 rounded-xl border border-purple-900/30 flex flex-col items-center text-center gap-6 justify-center relative overflow-hidden shrink-0">
                <h3 className="text-3xl font-bold text-purple-500 tracking-wider uppercase border-b border-purple-900/50 pb-4 px-12 drop-shadow-lg relative z-10">
                    Ołtarz Mroku (Poziom {altarLevel})
                </h3>
                
                <div className="max-w-3xl bg-slate-950/80 p-6 rounded-lg border border-purple-500/30 shadow-[0_0_40px_rgba(88,28,135,0.15)] relative overflow-hidden group backdrop-blur-sm z-10">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-600 to-transparent opacity-70"></div>
                    <p className="text-md text-purple-100/90 italic leading-loose font-serif">
                        "Ołtarz Mroku, wyrzeźbiony z czarnego jak noc obsydianu, pulsuje tępym, nieludzkim światłem. 
                        Gdy członkowie gildii składają na nim esencje w ofierze, kamień wchłania je niczym wygłodniała bestia. 
                        W zamian Ołtarz uwalnia w eter ciężką, lepką energię, która spowija wybranych niczym cień o własnej woli."
                    </p>
                     <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-900 to-transparent opacity-70"></div>
                </div>
                
                {/* Decorative background FX */}
                <div className="absolute -left-10 -top-10 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-900/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>
            
            {/* Active Buffs */}
             {guild.activeBuffs && guild.activeBuffs.length > 0 && (
                <div className="bg-slate-800/60 p-4 rounded-xl border border-green-500/30">
                    <h4 className="text-green-400 font-bold mb-2 uppercase tracking-wider text-sm">Aktywne Błogosławieństwa</h4>
                    <div className="flex gap-4 flex-wrap">
                        {guild.activeBuffs.map((buff, idx) => (
                            <div key={idx} className="bg-slate-900/80 px-4 py-2 rounded border border-green-500/20 text-sm flex flex-col items-center shadow-lg">
                                <span className="font-bold text-white">{buff.name}</span>
                                <span className="text-xs text-green-300 mt-1">Czas: {formatTimeLeft(buff.expiresAt)}</span>
                                <div className="text-xs text-gray-400 mt-1 flex flex-col items-center">
                                     {buff.stats.luck && <span>+ {buff.stats.luck} Szczęścia</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-700 gap-2 overflow-x-auto">
                {[1, 2, 3, 4, 5].map(tier => (
                    <button
                        key={tier}
                        onClick={() => setActiveTier(tier)}
                        className={`px-6 py-3 text-sm font-medium transition-all relative ${
                            activeTier === tier 
                            ? 'text-white border-b-2 border-purple-500 bg-purple-900/20' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
                        }`}
                    >
                        Wtajemniczenie {tier}
                        {altarLevel < tier && <span className="ml-2 text-[10px] text-red-500 font-bold">(Zablokowane)</span>}
                    </button>
                ))}
            </div>

            {/* Rituals Content */}
            {isTierLocked ? (
                <div className="flex flex-col items-center justify-center py-16 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
                    <span className="text-4xl mb-4">🔒</span>
                    <h4 className="text-xl font-bold text-gray-400 mb-2">Wtajemniczenie {activeTier} jest zablokowane</h4>
                    <p className="text-gray-500">Wymagany poziom Ołtarza Mroku: <span className="text-white font-bold">{activeTier}</span></p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {displayedRituals.map((ritual) => {
                        const isBackendImplemented = ritual.id === 1; // Only ID 1 works on backend currently
                        const canAfford = ritual.cost.every(c => (guild.resources[c.type] || 0) >= c.amount);

                        return (
                            <div key={ritual.id} className={`relative p-6 rounded-xl border transition-all duration-300 bg-slate-800/40 border-purple-900/50 hover:border-purple-500/50 hover:bg-slate-800/60 shadow-lg flex flex-col`}>
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-bold text-lg text-purple-300">
                                        {ritual.name}
                                    </h4>
                                    {!isBackendImplemented && <span className="text-xs bg-slate-800 px-2 py-1 rounded text-gray-500 border border-slate-600">Wkrótce</span>}
                                </div>
                                
                                <p className="text-sm text-gray-300 mb-2 flex-grow">{ritual.effect}</p>
                                <p className="text-xs text-gray-400 mb-4">Czas trwania: <span className="text-white">{ritual.duration}</span></p>
                                
                                <div className="bg-slate-950/50 p-3 rounded mb-4 space-y-1">
                                    <p className="text-xs text-gray-500 uppercase mb-1">Wymagana ofiara:</p>
                                    {ritual.cost.map((c, idx) => {
                                        const has = (guild.resources[c.type] || 0);
                                        const enough = has >= c.amount;
                                        return (
                                            <div key={idx} className="flex justify-between text-xs">
                                                <span className={essenceToRarityMap[c.type].text}>{t(`resources.${c.type}`)}</span>
                                                <span className={enough ? 'text-green-400' : 'text-red-400'}>
                                                    {has}/{c.amount}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                                
                                <button 
                                    onClick={() => handleSacrifice(ritual.id)}
                                    disabled={!canManage || !canAfford || loading || !isBackendImplemented}
                                    className={`w-full py-2 rounded font-bold text-sm transition-all mt-auto 
                                        ${canManage && canAfford && isBackendImplemented 
                                            ? 'bg-purple-700 hover:bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                                            : 'bg-slate-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    {loading ? 'Odprawianie...' : 'Poświęć'}
                                </button>
                            </div>
                        );
                    })}
                    {displayedRituals.length === 0 && (
                         <p className="col-span-full text-center text-gray-500 italic py-8">Brak dostępnych rytuałów na tym poziomie wtajemniczenia.</p>
                    )}
                </div>
            )}
        </div>
    );
};
