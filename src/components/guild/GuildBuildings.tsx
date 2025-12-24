
import React from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, GuildRole, EssenceType } from '../../types';
import { HomeIcon } from '../icons/HomeIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { MapIcon } from '../icons/MapIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { StarIcon } from '../icons/StarIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { rarityStyles } from '../shared/ItemSlot';
import { useCharacter } from '@/contexts/CharacterContext';

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

const getBuildingCost = (type: string, level: number): { gold: number, costs: { type: EssenceType, amount: number }[] } => {
    if (type === 'headquarters') {
        const gold = Math.floor(5000 * Math.pow(1.5, level));
        const essenceTypes = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const typeIndex = Math.min(Math.floor(level / 5), 4);
        const essenceType = essenceTypes[typeIndex];
        const essenceAmount = 5 + (level % 5);
        return { gold, costs: [{ type: essenceType, amount: essenceAmount }] };
    }
    if (type === 'armory') {
        const gold = Math.floor(10000 * Math.pow(1.6, level));
        const essenceTypes = [EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const typeIndex = Math.min(Math.floor(level / 3), 2);
        const essenceType = essenceTypes[typeIndex];
        const essenceAmount = 5 + (level % 3) * 2;
        return { gold, costs: [{ type: essenceType, amount: essenceAmount }] };
    }
    if (type === 'barracks') {
        const gold = Math.floor(15000 * Math.pow(1.5, level));
        const essenceType = EssenceType.Legendary;
        const essenceAmount = 3 + level;
        return { gold, costs: [{ type: essenceType, amount: essenceAmount }] };
    }
    if (type === 'scoutHouse') {
        const gold = Math.floor(35000 * Math.pow(2.5, level));
        const essenceType = EssenceType.Rare;
        const essenceAmount = 5 + (level * 5);
        return { gold, costs: [{ type: essenceType, amount: essenceAmount }] };
    }
    if (type === 'shrine') {
        const gold = Math.floor(15000 * Math.pow(1.5, level));
        const baseAmount = 1 + level;
        const costs = [
            { type: EssenceType.Common, amount: baseAmount * 5 },
            { type: EssenceType.Uncommon, amount: baseAmount * 4 },
            { type: EssenceType.Rare, amount: baseAmount * 3 },
            { type: EssenceType.Epic, amount: baseAmount * 2 },
            { type: EssenceType.Legendary, amount: baseAmount * 1 },
        ];
        return { gold, costs };
    }
    if (type === 'altar') {
        const gold = Math.floor(100000 * Math.pow(1.5, level));
        const essenceAmount = 5 + level;
        return { gold, costs: [{ type: EssenceType.Legendary, amount: essenceAmount }] };
    }
    if (type === 'spyHideout') {
        if (level === 0) return { gold: 15000, costs: [{ type: EssenceType.Common, amount: 25 }, { type: EssenceType.Rare, amount: 20 }] };
        else if (level === 1) return { gold: 30000, costs: [{ type: EssenceType.Common, amount: 25 }, { type: EssenceType.Rare, amount: 20 }, { type: EssenceType.Epic, amount: 10 }] };
        else if (level === 2) return { gold: 50000, costs: [{ type: EssenceType.Common, amount: 25 }, { type: EssenceType.Rare, amount: 20 }, { type: EssenceType.Epic, amount: 10 }, { type: EssenceType.Legendary, amount: 5 }] };
        return { gold: Infinity, costs: [{ type: EssenceType.Common, amount: Infinity }] };
    }
    if (type === 'stables') {
        if (level === 0) return { gold: 50000, costs: [{ type: EssenceType.Common, amount: 100 }, { type: EssenceType.Uncommon, amount: 50 }, { type: EssenceType.Rare, amount: 25 }] };
        else if (level === 1) return { gold: 75000, costs: [{ type: EssenceType.Common, amount: 75 }, { type: EssenceType.Uncommon, amount: 75 }, { type: EssenceType.Rare, amount: 30 }] };
        else if (level === 2) return { gold: 100000, costs: [{ type: EssenceType.Common, amount: 50 }, { type: EssenceType.Uncommon, amount: 75 }, { type: EssenceType.Rare, amount: 40 }] };
    }
    return { gold: Infinity, costs: [{ type: EssenceType.Common, amount: Infinity }] };
}

const BUILDING_DEFINITIONS = [
    { id: 'headquarters', icon: HomeIcon, color: 'text-amber-400', maxLevel: 999 },
    { id: 'armory', icon: ShieldIcon, color: 'text-indigo-400', maxLevel: 999 },
    { id: 'barracks', icon: SwordsIcon, color: 'text-red-500', maxLevel: 5 },
    { id: 'scoutHouse', icon: MapIcon, color: 'text-green-500', maxLevel: 3 },
    { id: 'shrine', icon: SparklesIcon, color: 'text-purple-400', maxLevel: 5 },
    { id: 'altar', icon: StarIcon, color: 'text-fuchsia-500', maxLevel: 5 },
    { id: 'spyHideout', icon: EyeIcon, color: 'text-emerald-400', maxLevel: 3 },
    { id: 'stables', icon: MapIcon, color: 'text-amber-600', maxLevel: 3 },
];

export const GuildBuildings: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
    const { gameData } = useCharacter();
    const canManage = myRole === GuildRole.LEADER || myRole === GuildRole.OFFICER;
    const buildingsData = guild.buildings || {};
    const customImages = gameData?.settings?.guildBuildingImages || {};

    const getEffectString = (id: string, level: number) => {
        if (id === 'headquarters') return `Maksymalna liczba członków: ${10 + level}`;
        if (id === 'armory') return `Pojemność zbrojowni: ${10 + level} przedmiotów`;
        if (id === 'barracks') return `Bonus do obrażeń: +${level * 5}%`;
        if (id === 'scoutHouse') return `Bonusowe przedmioty: +${level}`;
        if (id === 'shrine') return `Bonus szczęścia: +${level * 5}`;
        if (id === 'altar') return level > 0 ? `Odblokowany Krąg Wtajemniczenia: ${level}` : 'Brak odblokowanych rytuałów';
        if (id === 'spyHideout') return `Dostępni szpiedzy: ${level}`;
        if (id === 'stables') return `Skrócenie czasu wypraw: ${level * 10}%`;
        return '';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BUILDING_DEFINITIONS.map((def) => {
                const level = buildingsData[def.id] || 0;
                const isMaxLevel = level >= def.maxLevel;
                const { gold, costs } = isMaxLevel ? { gold: 0, costs: [] } : getBuildingCost(def.id, level);
                const currentGuildGold = guild.resources.gold || 0;
                const hasGold = currentGuildGold >= gold;
                const hasAllEssences = costs.every(c => (guild.resources[c.type] || 0) >= c.amount);

                const handleUpgrade = async () => {
                    try {
                        await api.upgradeGuildBuilding(def.id);
                        onUpdate();
                    } catch (e: any) { alert(e.message); }
                }
                
                const Icon = def.icon;
                const customImage = customImages[def.id];

                return (
                    <div key={def.id} className="bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-lg group">
                        {/* SEKCJA GRAFIKI / IKONY */}
                        <div className="h-40 relative overflow-hidden bg-slate-900 flex items-center justify-center border-b border-slate-700">
                            {customImage ? (
                                <img src={customImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={def.id} />
                            ) : (
                                <Icon className={`h-16 w-16 ${def.color} opacity-40`} />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
                            <div className="absolute bottom-3 left-4 flex flex-col">
                                <h4 className="text-xl font-black text-white uppercase tracking-tighter">{t(`guild.buildings.${def.id}` as any) || def.id}</h4>
                                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Poziom {level}</span>
                            </div>
                        </div>

                        <div className="p-5 flex-grow space-y-4">
                            <p className="text-xs text-gray-400 italic">{t(`guild.buildings.${def.id}Desc` as any)}</p>
                            
                            <div className="space-y-2">
                                <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{t('guild.buildings.currentEffect')}</p>
                                    <p className="text-sm text-green-400 font-bold">{getEffectString(def.id, level)}</p>
                                </div>
                                
                                {!isMaxLevel && (
                                    <div className="bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10">
                                        <p className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest mb-1">{t('guild.buildings.nextEffect')}</p>
                                        <p className="text-sm text-indigo-300 font-bold">{getEffectString(def.id, level + 1)}</p>
                                    </div>
                                )}
                            </div>
                            
                            {!isMaxLevel ? (
                                <div className="space-y-2 pt-2 border-t border-slate-700">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('guild.buildings.upgradeCost')}</p>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-400 flex items-center gap-1"><CoinsIcon className="h-3 w-3" /> Złoto</span>
                                        <span className={`font-mono font-bold ${hasGold ? 'text-amber-400' : 'text-red-400'}`}>{gold.toLocaleString()}</span>
                                    </div>
                                    {costs.map((costItem, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs">
                                            <span className={`${essenceToRarityMap[costItem.type].text} flex items-center gap-1`}><StarIcon className="h-3 w-3" /> {t(`resources.${costItem.type}`).replace(' Esencja', '')}</span>
                                            <span className={`font-mono font-bold ${(guild.resources[costItem.type] || 0) >= costItem.amount ? 'text-sky-400' : 'text-red-400'}`}>{costItem.amount}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 bg-amber-400/5 rounded-lg border border-amber-400/10">
                                    <p className="text-amber-400 font-black uppercase text-xs tracking-tighter">Maksymalny Poziom Osiągnięty</p>
                                </div>
                            )}
                        </div>

                        {!isMaxLevel && (
                            <button 
                                onClick={handleUpgrade} 
                                disabled={!canManage || !hasGold || !hasAllEssences}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-none font-black text-white text-xs uppercase tracking-[0.2em] disabled:bg-slate-700 disabled:text-gray-500 transition-all shadow-inner"
                            >
                                {t('guild.buildings.upgrade')}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
