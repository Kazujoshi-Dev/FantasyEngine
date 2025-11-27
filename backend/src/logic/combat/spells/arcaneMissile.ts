
import { SpellContext, SpellResult, SpellLogic } from './types.js';
import { CharacterStats } from '../../../types.js';

export const castArcaneMissile: SpellLogic = (context) => {
    const { attacker } = context;
    const attackerIsPlayer = 'statPoints' in attacker.stats;
    let bonusDamage = 0;

    if (attackerIsPlayer) {
        // 50% of max mana as bonus damage
        bonusDamage = Math.floor((attacker.stats as CharacterStats).maxMana * 0.5);
    }

    return {
        logs: [], // Main log handles the entry
        bonusDamage: bonusDamage
    };
};
