


import React from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, GuildRole, EssenceType } from '../../types';
import { HomeIcon } from '../icons/HomeIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { MapIcon } from '../icons/MapIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { rarityStyles } from '../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

const getBuildingCost = (type: string, level: number) => {
    if (type === 'headquarters') {
        const gold = Math.floor(5000 * Math.pow(1.5, level));
        const essenceTypes = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const typeIndex = Math.min(Math.floor(level / 5), 4);
        const essenceType = essenceTypes[typeIndex];
        const essenceAmount = 5 + (level % 5);
        return { gold, essenceType, essenceAmount };
    }
    if (type === 'armory') {
        const gold = Math.floor(10000 * Math.pow(1.6, level));
        const essenceTypes = [EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const typeIndex = Math.min(Math.floor(level / 3), 2);
        const essenceType = essenceTypes[typeIndex];
        const essenceAmount = 5 + (level % 3) * 2;
        return { gold, essenceType, essenceAmount };
    }
    if (type === 'barracks') {
        const gold = Math.floor(15000 * Math.pow(1.5, level));
        const essenceType = EssenceType.Legendary;
        const essenceAmount = 3 + level;
        return { gold, essenceType, essenceAmount };
    }
    if (type === 'scoutHouse') {
        const gold = Math.floor(35000 * Math.pow(2.5, level));
        const essenceType = EssenceType.Rare;
        const essenceAmount = 5 + (level * 5);
        return { gold, essenceType, essenceAmount };
    }
    // Frontend approximation for Shrine: display base info, but actual check is handled server-side for multiple essences.
    // We return Common here just to render UI structure, but note that Shrine requires ALL essences.
    if (type === 'shrine') {
        const gold = Math.floor(15000 * Math.pow(1.5, level));
        // Return dummy values here to satisfy type, but special rendering logic below handles "all essences"
        return { gold, essenceType: EssenceType.Common, essenceAmount: 1 + level }; 
    }
    return { gold: Infinity, essenceType: EssenceType.Common, essenceAmount: Infinity };
}

// Definition of all available buildings to ensure they are rendered loop-based
const BUILDING_DEFINITIONS = [
    { id: 'headquarters', icon: HomeIcon, color: 'text-amber-400', maxLevel: 999 },
    { id: 'armory', icon: ShieldIcon, color: 'text-indigo-400', maxLevel: 999 },
    { id: 'barracks', icon: SwordsIcon, color: 'text-red-500', maxLevel: 5 },
    { id: 'scoutHouse', icon: MapIcon, color: 'text-green-500', maxLevel: 3 },
    { id: 'shrine', icon: SparklesIcon, color: 'text-purple-400', maxLevel: 5 },
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
                const cost = isMaxLevel ? { gold: 0, essenceType: EssenceType.Common, essenceAmount: 0 } : getBuildingCost(def.id, level);
                const currentGuildGold = guild.resources.gold || 0;
                
                // Standard check for single essence type buildings
                let hasEssence = false;
                if (def.id !== 'shrine') {
                     hasEssence = (guild.resources[cost.essenceType] || 0) >= cost.essenceAmount;
                } else {
                    // Special check for Shrine: requires cost.essenceAmount of ALL types
                    const allEssences = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
                    hasEssence = allEssences.every(et => (guild.resources[et] || 0) >= cost.essenceAmount);
                }

                const hasGold = currentGuildGold >= cost.gold;
                
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

                return (
                    <div key={def.id} className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <Icon className={`h-8 w-8 ${def.color}`} />
                            <div>
                                <h4 className="text-xl font-bold text-white">{t(`guild.buildings.${def.id}` as any)}</h4>
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
                                            <span className={`font-mono font-bold ${hasGold ? 'text-amber-400' : 'text-red-400'}`}>{cost.gold.toLocaleString()}</span>
                                            <span className={`text-xs ml-1 ${hasGold ? 'text-green-500' : 'text-red-500'}`}>({currentGuildGold.toLocaleString()})</span>
                                        </div>
                                    </div>
                                    
                                    {def.id === 'shrine' ? (
                                         <div className="flex justify-between items-center text-sm">
                                            <span className="text-purple-300">Wszystkie Esencje</span>
                                            <div>
                                                <span className={`font-mono font-bold ${hasEssence ? 'text-sky-400' : 'text-red-400'}`}>{cost.essenceAmount}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className={`${essenceToRarityMap[cost.essenceType].text}`}>{t(`resources.${cost.essenceType}`)}</span>
                                            <div>
                                                <span className={`font-mono font-bold ${hasEssence ? 'text-sky-400' : 'text-red-400'}`}>{cost.essenceAmount}</span>
                                                <span className={`text-xs ml-1 ${hasEssence ? 'text-green-500' : 'text-red-500'}`}>({guild.resources[cost.essenceType] || 0})</span>
                                            </div>
                                        </div>
                                    )}
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
                                disabled={!canManage || !hasGold || !hasEssence}
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