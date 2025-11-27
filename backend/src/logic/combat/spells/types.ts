
import { AttackerState, DefenderState } from '../core.js';
import { CombatLogEntry, MagicAttackType } from '../../../types.js';

export interface SpellContext {
    attacker: AttackerState;
    defender: DefenderState;
    turn: number;
    baseDamage: number;
    allEnemies: DefenderState[]; // For AoE/Chain logic
}

export interface SpellResult {
    logs: CombatLogEntry[];
    bonusDamage?: number;
    healthGained?: number;
    damageMultiplier?: number; // e.g. for Shadow Bolt scaling
    aoeData?: any;
    chainData?: any;
    // Status effects are usually applied directly to defender in context, 
    // but we can return them if we want pure functions later.
    // For now, we stick to mutating context.defender.statusEffects for consistency with existing core.
}

export type SpellLogic = (context: SpellContext) => SpellResult;
