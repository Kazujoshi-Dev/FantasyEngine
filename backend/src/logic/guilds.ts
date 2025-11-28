
import { EssenceType, GuildRole } from '../types.js';

// Helper to check roles
export const canManage = (role: GuildRole) => role === GuildRole.LEADER || role === GuildRole.OFFICER;

// Helper for building costs
export const getBuildingCost = (type: string, level: number) => {
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
        // High scaling: Base 35k, 2.5x multiplier per level
        const gold = Math.floor(35000 * Math.pow(2.5, level));
        const essenceType = EssenceType.Rare;
        // 5, 10, 15...
        const essenceAmount = 5 + (level * 5);
        return { gold, essenceType, essenceAmount };
    }
    return { gold: Infinity, essenceType: EssenceType.Common, essenceAmount: Infinity };
};
