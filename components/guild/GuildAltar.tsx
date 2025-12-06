
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
    isActive?: boolean; 
}

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
        id: 101,
        tier: 1,
        name: 'Małe Błogosławieństwo',
        effect: 'Zwiększa zdobywane doświadczenie o 5%.',
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
        // ID 1 (Luck) and 101 (Exp) are implemented
        if (ritualId !== 1 && ritualId !== 101) {
            alert('Ten rytuał nie jest jeszcze dostępny (Wkrótce).');
            return;
        }

        if (!confirm('Czy na pewno chcesz dokonać poświęcenia? Surowce zostaną pobrane ze skarbca.')) return;
        setLoading(true);
        try {
            await api.performAltarSacrifice(ritualId);
            alert('Rytuał odprawiony pomyślnie!');
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
        <div className="h-[70vh] flex flex-col gap-4 animate-fade-in">
            
            {/* 1. Header Section (Fixed/Sticky) */}
            <div className="shrink-0 space-y-4 pr-2">
                {/* Active Buffs Bar */}
                <div className="bg-slate-800/60 p-3 rounded-xl border border-green-500/30 flex items-center gap-4 min-h-[60px]">
                    <h4 className="text-green-400 font-bold uppercase tracking-wider text-xs shrink-0">
                        Aktywne Błogosławieństwa:
                    </h4>
                    {guild.activeBuffs && guild.activeBuffs.length > 0 ? (
                        <div className="flex gap-3 overflow-x-auto pb-1">
                            {guild.activeBuffs.map((buff, idx) => (
                                <div key={idx} className="bg-slate-900/90 px-3 py-1 rounded border border-green-500/20 text-xs flex items-center gap-2 shadow-sm whitespace-nowrap">
                                    <span className="font-bold text-white">{buff.name}</span>
                                    <span className="text-gray-500">|</span>
                                    <span className="text-green-300">{formatTimeLeft(buff.expiresAt)}</span>
                                    {/* Display specific bonuses if known */}
                                    {(buff.stats as any).expBonus && <span className="text-sky-300 ml-1">(+{(buff.stats as any).expBonus}% XP)</span>}
                                    {buff.stats.luck && <span className="text-amber-300 ml-1">(+{buff.stats.luck} Szczęścia)</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-gray-500 text-xs italic">Brak aktywnych efektów. Złóż ofiarę poniżej.</span>
                    )}
                </div>

                {/* Tier Navigation Tabs */}
                <div className="bg-slate-900/40 p-1 rounded-lg flex gap-1 overflow-x-auto border border-slate-700/50">
                    {[1, 2, 3, 4, 5].map(tier => (
                        <button
                            key={tier}
                            onClick={() => setActiveTier(tier)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-1 ${
                                activeTier === tier 
                                ? 'bg-purple-600 text-white shadow-lg' 
                                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
                            }`}
                        >
                            Krąg {tier}
                            {altarLevel < tier && <span className="ml-2 text-xs opacity-50">🔒</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Scrollable Content Area */}
            <div className="flex-grow overflow-y-auto pr-2 pb-2">
                {isTierLocked ? (
                    <div className="flex flex-col items-center justify-center h-full bg-slate-900/30 rounded-xl border-2 border-slate-800 border-dashed opacity-70">
                        <span className="text-5xl mb-4 grayscale">🔒</span>
                        <h4 className="text-xl font-bold text-gray-400 mb-2">Wtajemniczenie {activeTier} jest zablokowane</h4>
                        <p className="text-gray-500">Wymagany poziom budynku Ołtarza Mroku: <span className="text-white font-bold">{activeTier}</span></p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {displayedRituals.map((ritual) => {
                            const isBackendImplemented = ritual.id === 1 || ritual.id === 101;
                            const canAfford = ritual.cost.every(c => (guild.resources[c.type] || 0) >= c.amount);
                            const isAlreadyActive = guild.activeBuffs?.some(b => b.name === ritual.name && b.expiresAt > Date.now());

                            return (
                                <div key={ritual.id} className={`flex flex-col h-full min-h-[280px] p-5 rounded-xl border transition-all duration-300 shadow-lg relative overflow-hidden
                                    ${isAlreadyActive 
                                        ? 'bg-slate-900/80 border-green-500/50 ring-1 ring-green-500/20' 
                                        : 'bg-slate-800/60 border-purple-900/50 hover:border-purple-500/50 hover:bg-slate-800'
                                    }`}>
                                    
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className={`font-bold text-lg ${isAlreadyActive ? 'text-green-400' : 'text-purple-300'}`}>
                                            {ritual.name}
                                        </h4>
                                        {isAlreadyActive && <span className="text-[10px] bg-green-900/80 px-2 py-0.5 rounded text-green-200 border border-green-700">AKTYWNY</span>}
                                        {!isBackendImplemented && !isAlreadyActive && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-gray-400">WKRÓTCE</span>}
                                    </div>
                                    
                                    {/* Description */}
                                    <div className="flex-grow">
                                        <p className="text-sm text-gray-300 leading-relaxed mb-2">{ritual.effect}</p>
                                        <p className="text-xs text-gray-500">Czas trwania: <span className="text-gray-300">{ritual.duration}</span></p>
                                    </div>
                                    
                                    {/* Cost Grid - Compact */}
                                    <div className="bg-slate-950/50 p-3 rounded-lg mt-4 border border-slate-800">
                                        <p className="text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-wider">Wymagana Ofiara:</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            {ritual.cost.map((c, idx) => {
                                                const has = (guild.resources[c.type] || 0);
                                                const enough = has >= c.amount;
                                                return (
                                                    <div key={idx} className="flex justify-between items-center text-xs">
                                                        <span className={`${essenceToRarityMap[c.type].text} truncate mr-1`}>{t(`resources.${c.type}`).split(' ')[0]}</span>
                                                        <span className={`font-mono ${enough ? 'text-green-400' : 'text-red-400 font-bold'}`}>
                                                            {has}/{c.amount}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    
                                    {/* Action Button */}
                                    <button 
                                        onClick={() => handleSacrifice(ritual.id)}
                                        disabled={!canManage || !canAfford || loading || !isBackendImplemented || isAlreadyActive}
                                        className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all mt-4
                                            ${isAlreadyActive 
                                                ? 'bg-slate-700 text-green-400 border border-green-900 cursor-default opacity-80' 
                                                : canManage && canAfford && isBackendImplemented 
                                                    ? 'bg-purple-700 hover:bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.2)]' 
                                                    : 'bg-slate-700 text-gray-500 cursor-not-allowed opacity-50'}`}
                                    >
                                        {isAlreadyActive ? 'Rytuał Trwa' : (loading ? 'Odprawianie...' : 'Złóż Ofiarę')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {!isTierLocked && displayedRituals.length === 0 && (
                     <p className="text-center text-gray-500 italic py-12">Brak dostępnych rytuałów na tym poziomie wtajemniczenia.</p>
                )}
            </div>
        </div>
    );
};
