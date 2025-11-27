
import { SpellContext, SpellResult, SpellLogic } from './types.js';

export const castFireball: SpellLogic = (context) => {
    const { attacker, defender, turn } = context;
    const logs = [];
    
    if (Math.random() * 100 < 25) {
        defender.statusEffects.push({ type: 'burning', duration: 2 });
        logs.push({ 
            turn, 
            attacker: attacker.name, 
            defender: defender.name, 
            action: 'effectApplied', 
            effectApplied: 'burning',
            playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0 // Core fills this
        });
    }
    return { logs };
};

export const castLightningStrike: SpellLogic = (context) => {
    const { attacker, defender, turn } = context;
    const logs = [];

    if (Math.random() * 100 < 15) {
        defender.statusEffects.push({ type: 'reduced_attacks', duration: 3, amount: 1 }); // Updated duration
        logs.push({ 
            turn, 
            attacker: attacker.name, 
            defender: defender.name, 
            action: 'effectApplied', 
            effectApplied: 'reduced_attacks',
            playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0 
        });
    }
    return { logs };
};

export const castFrostWave: SpellLogic = (context) => {
    const { attacker, defender, turn } = context;
    const logs = [];

    if (Math.random() * 100 < 20) {
        defender.statusEffects.push({ type: 'frozen_no_dodge', duration: 2 });
        logs.push({ 
            turn, 
            attacker: attacker.name, 
            defender: defender.name, 
            action: 'effectApplied', 
            effectApplied: 'frozen_no_dodge',
            playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0 
        });
    }
    return { logs };
};

export const castIceLance: SpellLogic = (context) => {
    const { attacker, defender, turn } = context;
    const logs = [];

    if (Math.random() * 100 < 10) {
        defender.statusEffects.push({ type: 'frozen_no_attack', duration: 2 });
        logs.push({ 
            turn, 
            attacker: attacker.name, 
            defender: defender.name, 
            action: 'effectApplied', 
            effectApplied: 'frozen',
            playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0 
        });
    }
    return { logs };
};