
// Profesjonalny Re-export Scentralizowanej Logiki
import { 
    calculateDerivedStats, 
    getBackpackCapacity, 
    getWarehouseCapacity, 
    getTreasuryCapacity,
    calculateTotalExperience,
    getCampUpgradeCost,
    getTreasuryUpgradeCost,
    getWarehouseUpgradeCost,
    getBackpackUpgradeCost,
    getWorkshopUpgradeCost
} from '../../../src/logic/stats.js';

// Alias dla kompatybilności wstecznej backendu
export const calculateDerivedStatsOnServer = calculateDerivedStats;

export {
    getBackpackCapacity,
    getWarehouseCapacity,
    getTreasuryCapacity,
    calculateTotalExperience,
    getCampUpgradeCost,
    getTreasuryUpgradeCost,
    getWarehouseUpgradeCost,
    getBackpackUpgradeCost,
    getWorkshopUpgradeCost
};
