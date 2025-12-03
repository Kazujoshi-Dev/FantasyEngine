


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
    if (type === 'shrine') {
        // Base 15k, moderate scaling 1.5x
        const gold = Math.floor(15000 * Math.pow(1.5, level));
        // Costs 1 of EACH essence per level + 1 base. 
        // The current function structure returns a single essenceType.
        // To support "1 of each essence", we need a special handling in the route or update the function signature.
        // However, keeping it simple for now compatible with frontend logic:
        // Let's make it expensive in Rare/Epic/Legendary essence instead of "all".
        // OR we hack it to return a "special" type, but the frontend expects specific types.
        
        // Revised Requirement: "po 1 każdej esencji" (1 of each essence).
        // Since getBuildingCost returns {gold, essenceType, essenceAmount}, it implies single type cost.
        // We will modify the route handler to handle 'shrine' specifically for multi-essence cost,
        // OR we approximate it here. 
        // Let's return a special indicator or just use Legendary as the primary bottleneck here to fit the type signature,
        // BUT the prompt explicitly said "1 of each essence".
        // The route handler `backend/src/routes/guilds.ts` consumes this.
        // We should modify `getBuildingCost` return type to support multiple costs if we want to do it cleanly,
        // or handle `shrine` as a special case in the route.
        
        // Let's return a dummy here and handle the actual complex cost in the route for 'shrine'.
        // We will mark essenceAmount as 0 here to skip standard check in route, then add custom check there.
        return { gold, essenceType: EssenceType.Common, essenceAmount: 0 }; 
    }
    return { gold: Infinity, essenceType: EssenceType.Common, essenceAmount: Infinity };
};