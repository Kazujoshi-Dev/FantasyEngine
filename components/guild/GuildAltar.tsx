
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

const rituals = [
    {
        id: 1,
        name: 'Okruchy Szczęścia',
        effect: 'Zwiększa szczęście o 20',
        duration: '48 godzin',
        cost: [
            { type: EssenceType.Common, amount: 50 },
            { type: EssenceType.Uncommon, amount: 25 },
            { type: EssenceType.Rare, amount: 15 },
            { type: EssenceType.Epic, amount: 5 },
            { type: EssenceType.Legendary, amount: 1 }
        ]
    },
    { id: 2, name: 'Wtajemniczenie II', effect: 'Dostępne wkrótce', duration: '-', cost: [] },
    { id: 3, name: 'Wtajemniczenie III', effect: 'Dostępne wkrótce', duration: '-', cost: [] },
    { id: 4, name: 'Wtajemniczenie IV', effect: 'Dostępne wkrótce', duration: '-', cost: [] },
    { id: 5, name: 'Wtajemniczenie V', effect: 'Dostępne wkrótce', duration: '-', cost: [] },
];

export const GuildAltar: React.FC<{ guild: Guild }> = ({ guild }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const altarLevel = guild.buildings?.altar || 0;
    const canManage = guild.myRole === GuildRole.LEADER || guild.myRole === GuildRole.OFFICER;

    const handleSacrifice = async (ritualId: number) => {
        if (!confirm('Czy na pewno chcesz dokonać poświęcenia? Surowce zostaną pobrane ze skarbca.')) return;
        setLoading(true);
        try {
            await api.performAltarSacrifice(ritualId);
            // We can trigger a reload here ideally, but for now alert is enough
            alert('Rytuał odprawiony pomyślnie!');
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
                            <div key={idx} className="bg-slate-900/80 px-4 py-2 rounded border border-green-500/20 text-sm flex flex-col items-center">
                                <span className="font-bold text-white">{buff.name}</span>
                                <span className="text-xs text-green-300">Czas: {formatTimeLeft(buff.expiresAt)}</span>
                                {buff.stats.luck && <span className="text-xs text-gray-400">+ {buff.stats.luck} Szczęścia</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Rituals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rituals.map((ritual) => {
                    const isLocked = altarLevel < ritual.id;
                    const isAvailable = !isLocked && ritual.cost.length > 0;
                    const canAfford = !isLocked && ritual.cost.every(c => (guild.resources[c.type] || 0) >= c.amount);

                    return (
                        <div key={ritual.id} className={`relative p-6 rounded-xl border transition-all duration-300 ${isLocked ? 'bg-slate-900/20 border-slate-800 opacity-60 grayscale' : 'bg-slate-800/40 border-purple-900/50 hover:border-purple-500/50 hover:bg-slate-800/60 shadow-lg'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <h4 className={`font-bold text-lg ${isLocked ? 'text-gray-500' : 'text-purple-300'}`}>
                                    Wtajemniczenie {ritual.id}
                                </h4>
                                {isLocked && <span className="text-xs bg-slate-800 px-2 py-1 rounded text-gray-500">Zablokowane</span>}
                            </div>
                            
                            <p className="text-white font-serif text-xl mb-2">{ritual.name}</p>
                            <p className="text-sm text-gray-400 mb-1">Efekt: <span className="text-purple-200">{ritual.effect}</span></p>
                            <p className="text-sm text-gray-400 mb-4">Czas trwania: <span className="text-white">{ritual.duration}</span></p>
                            
                            {!isLocked && ritual.cost.length > 0 && (
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
                            )}
                            
                            {isAvailable ? (
                                <button 
                                    onClick={() => handleSacrifice(ritual.id)}
                                    disabled={!canManage || !canAfford || loading}
                                    className={`w-full py-2 rounded font-bold text-sm transition-all ${canManage && canAfford ? 'bg-purple-700 hover:bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-slate-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    {loading ? 'Odprawianie...' : 'Poświęć'}
                                </button>
                            ) : (
                                <div className="h-8 flex items-center justify-center text-xs text-gray-600 italic">
                                    {isLocked ? `Wymagany Ołtarz poz. ${ritual.id}` : 'Niedostępne'}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
