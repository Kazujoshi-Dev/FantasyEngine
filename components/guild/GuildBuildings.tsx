
import React from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, GuildRole, EssenceType } from '../../types';
import { HomeIcon } from '../icons/HomeIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { MapIcon } from '../icons/MapIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { StarIcon } from '../icons/StarIcon'; // Using StarIcon as placeholder for Altar if no specific icon
import { rarityStyles } from '../shared/ItemSlot';

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
    return { gold: Infinity, costs: [{ type: EssenceType.Common, amount: Infinity }] };
}

// Definition of all available buildings to ensure they are rendered loop-based
const BUILDING_DEFINITIONS = [
    { id: 'headquarters', icon: HomeIcon, color: 'text-amber-400', maxLevel: 999 },
    { id: 'armory', icon: ShieldIcon, color: 'text-indigo-400', maxLevel: 999 },
    { id: 'barracks', icon: SwordsIcon, color: 'text-red-500', maxLevel: 5 },
    { id: 'scoutHouse', icon: MapIcon, color: 'text-green-500', maxLevel: 3 },
    { id: 'shrine', icon: SparklesIcon, color: 'text-purple-400', maxLevel: 5 },
    { id: 'altar', icon: StarIcon, color: 'text-fuchsia-500', maxLevel: 5 },
];

export const GuildBuildings: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
    const canManage = myRole === GuildRole.LEADER || myRole === GuildRole.OFFICER;
    
    // Fallback to empty object if buildings is undefined
    const buildingsData = guild.buildings || {};

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
                    } catch (e: any) {
                        alert(e.message);
                    }
                }
                
                const Icon = def.icon;

                let effectKey = `guild.buildings.${def.id}Effect`; // Generic key fallback
                let effect = '';
                
                // Specific effect descriptions based on ID
                if (def.id === 'headquarters') effect = t('guild.buildings.maxMembers', { count: 10 + level });
                else if (def.id === 'armory') effect = `Pojemność: ${10 + level}`;
                else if (def.id === 'barracks') effect = `Bonus obrażeń: +${level * 5}%`;
                else if (def.id === 'scoutHouse') effect = `Bonusowe przedmioty: +${level}`;
                else if (def.id === 'shrine') effect = `Bonus szczęścia: +${level * 5}`;
                else if (def.id === 'altar') effect = level > 0 ? `Odblokowuje Wtajemniczenie poziomu ${level}` : 'Brak efektu';

                return (
                    <div key={def.id} className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <Icon className={`h-8 w-8 ${def.color}`} />
                            <div>
                                <h4 className="text-xl font-bold text-white">{t(`guild.buildings.${def.id}` as any) || def.id}</h4>
                                <p className="text-xs text-gray-400">{t(`guild.buildings.${def.id}Desc` as any)}</p>
                            </div>
                        </div>
                        
                        <div className="flex-grow space-y-4">
                            <div className="bg-slate-900/50 p-3 rounded">
                                <p className="text-sm text-gray-400">{t('guild.buildings.level')}: <span className="text-white font-bold">{level} {def.maxLevel !== 999 ? `/ ${def.maxLevel}` : ''}</span></p>
                                <p className="text-sm text-gray-400">{t('guild.buildings.currentEffect')}: <span className="text-green-400 font-bold">{effect}</span></p>
                            </div>
                            
                            {!isMaxLevel ? (
                                <div className="border-t border-slate-700 pt-4">
                                    <p className="text-sm font-bold text-gray-300 mb-2">{t('guild.buildings.upgradeCost')}:</p>
                                    <div className="flex justify-between items-center text-sm mb-1">
                                        <span className="text-gray-400">Złoto</span>
                                        <div>
                                            <span className={`font-mono font-bold ${hasGold ? 'text-amber-400' : 'text-red-400'}`}>{gold.toLocaleString()}</span>
                                            <span className={`text-xs ml-1 ${hasGold ? 'text-green-500' : 'text-red-500'}`}>({currentGuildGold.toLocaleString()})</span>
                                        </div>
                                    </div>
                                    
                                    {costs.map((costItem, idx) => {
                                        const hasThisEssence = (guild.resources[costItem.type] || 0) >= costItem.amount;
                                        return (
                                            <div key={idx} className="flex justify-between items-center text-sm">
                                                <span className={`${essenceToRarityMap[costItem.type].text}`}>{t(`resources.${costItem.type}`)}</span>
                                                <div>
                                                    <span className={`font-mono font-bold ${hasThisEssence ? 'text-sky-400' : 'text-red-400'}`}>{costItem.amount}</span>
                                                    <span className={`text-xs ml-1 ${hasThisEssence ? 'text-green-500' : 'text-red-500'}`}>({guild.resources[costItem.type] || 0})</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="border-t border-slate-700 pt-4">
                                    <p className="text-center text-amber-400 font-bold text-sm">Maksymalny Poziom</p>
                                </div>
                            )}
                        </div>

                        {!isMaxLevel && (
                            <button 
                                onClick={handleUpgrade} 
                                disabled={!canManage || !hasGold || !hasAllEssences}
                                className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white disabled:bg-slate-700 disabled:text-gray-500"
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
