
import { EssenceType, GuildRole } from '../types.js';

// Helper to check roles
export const canManage = (role: GuildRole) => role === GuildRole.LEADER || role === GuildRole.OFFICER;

// Helper for building costs
export const getBuildingCost = (type: string, level: number): { gold: number, costs: { type: EssenceType, amount: number }[] } => {
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
        // Base: 5 Legendary. Each level increases it.
        const essenceAmount = 5 + level;
        return { gold, costs: [{ type: EssenceType.Legendary, amount: essenceAmount }] };
    }

    if (type === 'spyHideout') {
        if (level === 0) { // Upgrade to Level 1
            return {
                gold: 15000,
                costs: [
                    { type: EssenceType.Common, amount: 25 },
                    { type: EssenceType.Rare, amount: 20 }
                ]
            };
        } else if (level === 1) { // Upgrade to Level 2
            return {
                gold: 30000,
                costs: [
                    { type: EssenceType.Common, amount: 25 },
                    { type: EssenceType.Rare, amount: 20 },
                    { type: EssenceType.Epic, amount: 10 }
                ]
            };
        } else if (level === 2) { // Upgrade to Level 3
            return {
                gold: 50000,
                costs: [
                    { type: EssenceType.Common, amount: 25 },
                    { type: EssenceType.Rare, amount: 20 },
                    { type: EssenceType.Epic, amount: 10 },
                    { type: EssenceType.Legendary, amount: 5 }
                ]
            };
        }
        return { gold: Infinity, costs: [{ type: EssenceType.Common, amount: Infinity }] };
    }
    
    // Default fallback
    return { gold: Infinity, costs: [{ type: EssenceType.Common, amount: Infinity }] };
};
