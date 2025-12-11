
import { SpellContext, SpellResult, SpellLogic } from './types.js';

export const castLifeDrain: SpellLogic = (context) => {
    const { baseDamage, attacker } = context;
    const drained = Math.floor(baseDamage * 0.25);
    
    // We update health immediately here as per original logic, 
    // but the core handles `healthGained` display if returned.
    const newHealth = Math.min(attacker.stats.maxHealth, attacker.currentHealth + drained);
    const actualHealed = newHealth - attacker.currentHealth;
    attacker.currentHealth = newHealth;

    return {
        logs: [],
        healthGained: actualHealed
    };
};

export const castMeteorSwarm: SpellLogic = (context) => {
    const { baseDamage } = context;
    return {
        logs: [],
        aoeData: { type: 'meteor_swarm', baseDamage }
    };
};

export const castEarthquake: SpellLogic = (context) => {
    const { baseDamage } = context;
    return {
        logs: [],
        aoeData: { type: 'earthquake', baseDamage, splashPercent: 0.20 }
    };
};