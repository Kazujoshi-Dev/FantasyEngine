


import React from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, GuildRole, EssenceType } from '../../types';
import { HomeIcon } from '../icons/HomeIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
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
    return { gold: Infinity, essenceType: EssenceType.Common, essenceAmount: Infinity };
}

export const GuildBuildings: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
    const canManage = myRole === GuildRole.LEADER || myRole === GuildRole.OFFICER;
    const headquartersLevel = (guild.buildings && guild.buildings['headquarters']) || 0;
    const armoryLevel = (guild.buildings && guild.buildings['armory']) || 0;
    const barracksLevel = (guild.buildings && guild.buildings['barracks']) || 0;
    
    const renderBuilding = (type: 'headquarters' | 'armory' | 'barracks', level: number) => {
        const maxLevel = type === 'barracks' ? 5 : 999;
        const isMaxLevel = level >= maxLevel;
        const cost = isMaxLevel ? { gold: 0, essenceType: EssenceType.Common, essenceAmount: 0 } : getBuildingCost(type, level);
        const currentGuildGold = guild.resources.gold || 0;
        const currentGuildEssence = guild.resources[cost.essenceType] || 0;
        
        const hasGold = currentGuildGold >= cost.gold;
        const hasEssence = currentGuildEssence >= cost.essenceAmount;
        
        const handleUpgrade = async () => {
            try {
                await api.upgradeGuildBuilding(type);
                onUpdate();
            } catch (e: any) {
                alert(e.message);
            }
        }
        
        let icon = <HomeIcon className="h-8 w-8 text-amber-400" />;
        if (type === 'armory') icon = <ShieldIcon className="h-8 w-8 text-indigo-400" />;
        if (type === 'barracks') icon = <SwordsIcon className="h-8 w-8 text-red-500" />;

        let effect = t('guild.buildings.maxMembers', { count: 10 + level });
        if (type === 'armory') effect = `Pojemność: ${10 + level}`;
        if (type === 'barracks') effect = `Bonus obrażeń: +${level * 5}%`;

        return (
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    {icon}
                    <div>
                        <h4 className="text-xl font-bold text-white">{t(`guild.buildings.${type}`)}</h4>
                        <p className="text-xs text-gray-400">{t(`guild.buildings.${type}Desc`)}</p>
                    </div>
                </div>
                
                <div className="flex-grow space-y-4">
                    <div className="bg-slate-900/50 p-3 rounded">
                        <p className="text-sm text-gray-400">{t('guild.buildings.level')}: <span className="text-white font-bold">{level} {maxLevel !== 999 ? `/ ${maxLevel}` : ''}</span></p>
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
                            <div className="flex justify-between items-center text-sm">
                                <span className={`${essenceToRarityMap[cost.essenceType].text}`}>{t(`resources.${cost.essenceType}`)}</span>
                                <div>
                                    <span className={`font-mono font-bold ${hasEssence ? 'text-sky-400' : 'text-red-400'}`}>{cost.essenceAmount}</span>
                                    <span className={`text-xs ml-1 ${hasEssence ? 'text-green-500' : 'text-red-500'}`}>({currentGuildEssence})</span>
                                </div>
                            </div>
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
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderBuilding('headquarters', headquartersLevel)}
            {renderBuilding('armory', armoryLevel)}
            {renderBuilding('barracks', barracksLevel)}
        </div>
    );
};
