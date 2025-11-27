
import { SpellContext, SpellResult, SpellLogic } from './types.js';

export const castShadowBolt: SpellLogic = (context) => {
    const { attacker, defender, turn } = context;
    const logs = [];
    
    // Default multiplier
    let damageMultiplier = 1;

    // Logic applies to ANY attacker (Player or Enemy)
    let currentStacks = attacker.shadowBoltStacks || 0;
    
    // Apply bonus damage based on current stacks (5% per stack)
    // 0 stacks = 1.0x, 1 stack = 1.05x, 10 stacks = 1.5x, etc. Infinite scaling.
    damageMultiplier = 1 + (currentStacks * 0.05);
    
    // Increment stacks for the NEXT attack (no cap)
    currentStacks++;
    attacker.shadowBoltStacks = currentStacks;
    
    // Push a log message about the stack change
    // We use the 'damage' field in the log to carry the stack count info to the frontend
    logs.push({
        turn,
        attacker: attacker.name,
        defender: '',
        action: 'effectApplied',
        effectApplied: 'shadowBoltStack',
        damage: currentStacks, // Passing stack count here
        playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0
    });

    return { logs, damageMultiplier };
};
