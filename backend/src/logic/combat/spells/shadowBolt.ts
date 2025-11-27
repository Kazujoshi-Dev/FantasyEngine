
import { SpellContext, SpellResult, SpellLogic } from './types.js';

export const castShadowBolt: SpellLogic = (context) => {
    const { attacker, defender, turn } = context;
    const attackerIsPlayer = 'statPoints' in attacker.stats;
    const logs = [];
    
    // Default multiplier
    let damageMultiplier = 1;

    if (attackerIsPlayer) {
        let currentStacks = attacker.shadowBoltStacks || 0;
        
        // Apply bonus damage based on current stacks
        damageMultiplier = 1 + (currentStacks * 0.05);
        
        // Increment stacks for the NEXT attack (no cap)
        currentStacks++;
        attacker.shadowBoltStacks = currentStacks;
        
        // Push a log message about the stack change
        logs.push({
            turn,
            attacker: attacker.name,
            defender: '',
            action: 'effectApplied',
            effectApplied: 'shadowBoltStack',
            playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0
        });
    }

    return { logs, damageMultiplier };
};
