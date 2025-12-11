
import { SpellContext, SpellResult, SpellLogic } from './types.js';

export const castChainLightning: SpellLogic = (context) => {
    const { baseDamage } = context;
    
    // Return the data structure needed for the frontend/logger to process the chain
    // The core logic will handle the iteration based on this data, or we could move iteration here.
    // Based on previous refactor, we return chainData and let core log it properly.
    
    return {
        logs: [], // Main log is handled by core
        chainData: { 
            type: 'chain_lightning', 
            chance: 25, 
            maxJumps: 2, 
            damage: baseDamage 
        }
    };
};
