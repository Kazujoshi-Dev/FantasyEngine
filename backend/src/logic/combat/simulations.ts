import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData, SpecialAttackType, BossSpecialAttack } from '../../types.js';
import { performAttack, AttackerState, DefenderState, getFullWeaponName, StatusEffect } from './core.js';
import { randomUUID } from 'crypto';

export interface TeamCombatPlayerState {
  data: PlayerCharacter;
  currentHealth: number;
  currentMana: number;
  isDead: boolean;
  statusEffects: StatusEffect[];
  hardSkinTriggered?: boolean;
  manaSurgeUsed?: boolean;
  shadowBoltStacks?: number;
}

const defaultEnemyStats: EnemyStats = {
    maxHealth: 1,
    minDamage: 1,
    maxDamage: 1,
    armor: 0,
    critChance: 0,
    agility: 1,
    attacksPerTurn: 1,
    critDamageModifier: 150,
    dodgeChance: 0,
    magicAttackChance: 0,
    magicAttackManaCost: 0,
    magicDamageMax: 0,
    magicDamageMin: 0,
    manaRegen: 0,
    maxMana: 0,
};


// ==========================================================================================
//                                   1 vs 1 COMBAT
// ==========================================================================================
export const simulate1v1Combat = (playerData: PlayerCharacter, enemyData: Enemy, gameData: GameData): CombatLogEntry[] => {
    
    // Initialize State Objects
    // NOTE: We maintain these specific object references throughout the entire combat.
    // We must NOT reassign 'playerState' or 'enemyState' variables to new objects returned by performAttack.
    // Instead, we will update their properties.
    let playerState: AttackerState & {data: PlayerCharacter} = {
        data: playerData,
        stats: playerData.stats,
        currentHealth: playerData.stats.currentHealth,
        currentMana: playerData.stats.currentMana,
        name: playerData.name,
        hardSkinTriggered: false,
        manaSurgeUsed: false,
        shadowBoltStacks: 0,
        statusEffects: [],
    };
    
    const effectiveEnemyStats = { ...defaultEnemyStats, ...(enemyData.stats || {}) };

    let enemyState: AttackerState & {description?: string} = {
        stats: effectiveEnemyStats,
        currentHealth: effectiveEnemyStats.maxHealth,
        currentMana: effectiveEnemyStats.maxMana || 0,
        name: enemyData.name,
        description: enemyData.description,
        hardSkinTriggered: false,
        shadowBoltStacks: 0,
        statusEffects: [],
    };

    const log: CombatLogEntry[] = [];
    let turn = 0;

    log.push({
        turn, attacker: playerState.name, defender: enemyState.name, action: 'starts a fight with',
        playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
        enemyHealth: enemyState.currentHealth, enemyMana: enemyState.currentMana,
        playerStats: playerState.stats as CharacterStats, enemyStats: enemyState.stats, enemyDescription: enemyState.description
    });
    
    // Helper to safely update state from performAttack result
    const applyCombatResult = (
        source: AttackerState | DefenderState, 
        target: AttackerState | DefenderState
    ) => {
        // We find which state object matches the name and update its mutable props
        const update = (state: AttackerState | DefenderState) => {
            if (state.name === playerState.name) {
                playerState.currentHealth = state.currentHealth;
                playerState.currentMana = state.currentMana;
                playerState.statusEffects = state.statusEffects;
                // Preserve specific player flags if passed back (though core usually returns base types)
                if ((state as any).manaSurgeUsed !== undefined) playerState.manaSurgeUsed = (state as any).manaSurgeUsed;
                if ((state as any).shadowBoltStacks !== undefined) playerState.shadowBoltStacks = (state as any).shadowBoltStacks;
            } else if (state.name === enemyState.name) {
                enemyState.currentHealth = state.currentHealth;
                enemyState.currentMana = state.currentMana;
                enemyState.statusEffects = state.statusEffects;
                if ((state as any).shadowBoltStacks !== undefined) enemyState.shadowBoltStacks = (state as any).shadowBoltStacks;
            }
        };
        update(source);
        update(target);
    };

    // --- Turn 0: Ranged Weapons Logic ---
    const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
    const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

    if (template?.isRanged && enemyState.currentHealth > 0) {
        // 1. Standard Ranged Attack (Everyone with ranged weapon)
        const { logs: attackLogs, attackerState, defenderState } = performAttack(playerState, enemyState, 0, gameData, []);
        log.push(...attackLogs);
        applyCombatResult(attackerState, defenderState);

        // 2. Hunter Bonus Attack (Only Hunters, 50% damage)
        if (playerData.characterClass === CharacterClass.Hunter && enemyState.currentHealth > 0) {
             const { logs: hunterLogs, attackerState: hAttacker, defenderState: hDefender } = performAttack(playerState, enemyState, 0, gameData, []);
             
             // Apply 50% damage reduction logic manually to the log and state
             const lastLog = hunterLogs[hunterLogs.length - 1];
             if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                const originalDamage = lastLog.damage;
                const reducedDamage = Math.floor(originalDamage * 0.5);
                const diff = originalDamage - reducedDamage;
                
                // Correct the log
                lastLog.damage = reducedDamage;
                // Correct the actual health state (heal back the difference)
                hDefender.currentHealth += diff;
                lastLog.enemyHealth = hDefender.currentHealth; // Update log entry
             }
             log.push(...hunterLogs);
             applyCombatResult(hAttacker, hDefender);
        }
    }

    let playerAttacksFirst = (playerData.race === Race.Elf) || (playerState.stats.agility >= enemyState.stats.agility);

    while (playerState.currentHealth > 0 && enemyState.currentHealth > 0 && turn < 100) {
        turn++;
        
        const getHealthState = () => ({
            playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
            enemyHealth: enemyState.currentHealth, enemyMana: enemyState.currentMana
        });

        // --- Shaman Class Power ---
        if (playerData.characterClass === CharacterClass.Shaman && turn > 0) {
            const damage = Math.floor(playerState.currentMana);
            if (damage > 0) {
                enemyState.currentHealth = Math.max(0, enemyState.currentHealth - damage);
                log.push({
                    turn,
                    attacker: playerState.name,
                    defender: enemyState.name,
                    action: 'shaman_power',
                    damage,
                    ...getHealthState()
                });
                if (enemyState.currentHealth <= 0) {
                    log.push({ turn, attacker: playerState.name, defender: enemyState.name, action: 'enemy_death', ...getHealthState() });
                    break; 
                }
            }
        }
        
        // --- Turn Start Effects & Mana Regen ---
        // We iterate over the actual state objects
        const combatants = [playerState, enemyState];
        
        for(const combatant of combatants) {
            // Mana Regen
            const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0) {
                const newMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
                const manaGained = newMana - combatant.currentMana;
                if(manaGained > 0) {
                    combatant.currentMana = newMana;
                    log.push({ turn, attacker: combatant.name, defender: '', action: 'manaRegen', manaGained, ...getHealthState() });
                }
            }
            // Burning Effect
            const burningEffect = combatant.statusEffects.find(e => e.type === 'burning');
            if (burningEffect) {
                const burnDamage = Math.floor(combatant.stats.maxHealth * 0.05);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - burnDamage);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burningTarget', damage: burnDamage, ...getHealthState() });
            }
            // Decrement status effect durations
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        // Determine who is attacker and who is defender for the FIRST phase
        const firstAttacker = playerAttacksFirst ? playerState : enemyState;
        const firstDefender = playerAttacksFirst ? enemyState : playerState;

        // --- Attacker's Turn ---
        if (firstAttacker.currentHealth > 0) {
            const isPlayerAttacking = firstAttacker === playerState;
            const attacks = isPlayerAttacking ? (firstAttacker.stats as CharacterStats).attacksPerRound : (firstAttacker.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = firstAttacker.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);
            
            if (firstAttacker.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: firstAttacker.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
            } else {
                 for (let i = 0; i < finalAttacks && firstDefender.currentHealth > 0; i++) {
                    // Warrior Bonus Check: First attack is Auto-Crit and Undodgeable
                    let currentAttackerObj = firstAttacker;
                    let attackOptions = {};

                    if (isPlayerAttacking && i === 0 && playerData.characterClass === CharacterClass.Warrior) {
                         // Temporarily boost crit chance to 100% for this call. 
                         // Create shallow copy to avoid persistent stat modification.
                         currentAttackerObj = { ...firstAttacker, stats: { ...firstAttacker.stats, critChance: 100 } };
                         attackOptions = { ignoreDodge: true };
                    }

                    const { logs: attackLogs, attackerState, defenderState } = performAttack(currentAttackerObj, firstDefender, turn, gameData, [], false, attackOptions);
                    log.push(...attackLogs);
                    
                    // Update real states
                    applyCombatResult(attackerState, defenderState);
                }

                // --- Berserker Bonus Attack (Player Only) ---
                if (isPlayerAttacking && firstDefender.currentHealth > 0 && playerData.characterClass === CharacterClass.Berserker) {
                    if (playerState.currentHealth < playerState.stats.maxHealth * 0.3) {
                        log.push({
                            turn, attacker: playerState.name, defender: firstDefender.name, action: 'berserker_frenzy',
                            ...getHealthState()
                        });
                        const { logs: bonusLogs, attackerState, defenderState } = performAttack(playerState, firstDefender, turn, gameData, []);
                        log.push(...bonusLogs);
                        applyCombatResult(attackerState, defenderState);
                    }
                }
            }
        }
        
        // --- Defender's Turn (Counter-attack) ---
        if (firstDefender.currentHealth > 0) {
            const isPlayerDefending = firstDefender === playerState;
            const attacks = isPlayerDefending ? (firstDefender.stats as CharacterStats).attacksPerRound : (firstDefender.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = firstDefender.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);

             if (firstDefender.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: firstDefender.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
            } else {
                for (let i = 0; i < finalAttacks && firstAttacker.currentHealth > 0; i++) {
                    // Warrior Bonus Check for Defender's turn (counter-attack)
                    let currentCounterAttacker = firstDefender;
                    let attackOptions = {};

                    if (isPlayerDefending && i === 0 && playerData.characterClass === CharacterClass.Warrior) {
                         currentCounterAttacker = { ...firstDefender, stats: { ...firstDefender.stats, critChance: 100 } };
                         attackOptions = { ignoreDodge: true };
                    }

                    // NOTE: Attacker here is 'firstDefender' (Counter-Attacking), Defender is 'firstAttacker'
                    const { logs: attackLogs, attackerState, defenderState } = performAttack(currentCounterAttacker, firstAttacker, turn, gameData, [], false, attackOptions);
                    log.push(...attackLogs);
                    
                    applyCombatResult(attackerState, defenderState);
                }

                // --- Berserker Bonus Attack (Player as Defender/Counter-Attacker) ---
                if (isPlayerDefending && firstAttacker.currentHealth > 0 && playerData.characterClass === CharacterClass.Berserker) {
                    if (playerState.currentHealth < playerState.stats.maxHealth * 0.3) {
                        log.push({
                            turn, attacker: playerState.name, defender: firstAttacker.name, action: 'berserker_frenzy',
                            ...getHealthState()
                        });
                        const { logs: bonusLogs, attackerState, defenderState } = performAttack(playerState, firstAttacker, turn, gameData, []);
                        log.push(...bonusLogs);
                        applyCombatResult(attackerState, defenderState);
                    }
                }
            }
        }

        playerAttacksFirst = playerState.stats.agility >= enemyState.stats.agility;
    }
    
    // Final death check
    const healthState = {
        playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
        enemyHealth: enemyState.currentHealth, enemyMana: enemyState.currentMana
    };
    
    if (enemyState.currentHealth <= 0 && !log.some(l => l.action === 'enemy_death')) {
         log.push({ turn, attacker: playerState.name, defender: enemyState.name, action: 'enemy_death', ...healthState });
    } else if (playerState.currentHealth <= 0 && !log.some(l => l.action === 'death')) {
         log.push({ turn, attacker: enemyState.name, defender: playerState.name, action: 'death', ...healthState });
    }
    
    return log;
};

// ==========================================================================================
//                                   1 vs MANY COMBAT
// ==========================================================================================
export const simulate1vManyCombat = (
    playerData: PlayerCharacter,
    enemiesData: Enemy[],
    gameData: GameData
): CombatLogEntry[] => {
    
    let playerState: AttackerState & {data: PlayerCharacter} = {
        data: playerData,
        stats: playerData.stats,
        currentHealth: playerData.stats.currentHealth,
        currentMana: playerData.stats.currentMana,
        name: playerData.name,
        hardSkinTriggered: false,
        manaSurgeUsed: false,
        shadowBoltStacks: 0,
        statusEffects: [],
    };

    // --- Numbering Logic ---
    const nameCounts: Record<string, number> = {};
    enemiesData.forEach(e => {
        nameCounts[e.name] = (nameCounts[e.name] || 0) + 1;
    });
    
    const nameIterators: Record<string, number> = {};

    // Convert Enemy[] to array of combat states with unique IDs and numbered names
    const enemiesState = enemiesData.map(e => {
        let displayName = e.name;
        if (nameCounts[e.name] > 1) {
            nameIterators[e.name] = (nameIterators[e.name] || 0) + 1;
            displayName = `${e.name} ${nameIterators[e.name]}`;
        }

        return {
            uniqueId: e.uniqueId || randomUUID(),
            stats: { ...defaultEnemyStats, ...(e.stats || {}) },
            currentHealth: e.stats.maxHealth,
            currentMana: e.stats.maxMana || 0,
            name: displayName,
            hardSkinTriggered: false,
            shadowBoltStacks: 0,
            statusEffects: [],
            data: undefined // Not a player
        } as AttackerState & { uniqueId: string };
    });

    const log: CombatLogEntry[] = [];
    let turn = 0;

    const getHealthState = () => ({
        playerHealth: playerState.currentHealth,
        playerMana: playerState.currentMana,
        enemyHealth: 0, 
        enemyMana: 0,
        allEnemiesHealth: enemiesState.map(e => ({ 
            uniqueId: e.uniqueId, 
            name: e.name, 
            currentHealth: e.currentHealth, 
            maxHealth: e.stats.maxHealth 
        }))
    });

    log.push({
        turn, attacker: playerState.name, defender: 'Grupa Wrogów', action: 'starts a fight with',
        ...getHealthState(),
        playerStats: playerState.stats as CharacterStats, 
        enemyStats: enemiesState[0].stats as EnemyStats // Just take first for generic stat display
    });

    // --- Turn 0: Ranged Weapons Logic (Player only) ---
    const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
    const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

    if (template?.isRanged) {
        const target = enemiesState.find(e => e.currentHealth > 0);
        if (target) {
            // 1. Standard Ranged Attack
            const { logs: attackLogs, defenderState } = performAttack(playerState, target, 0, gameData, enemiesState);
            
            // Update target health in the main array
            const targetIndex = enemiesState.findIndex(e => e.uniqueId === target.uniqueId);
            enemiesState[targetIndex] = defenderState as typeof target;
            
            log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));

            if (defenderState.currentHealth <= 0) {
                log.push({ turn, attacker: playerState.name, defender: defenderState.name, action: 'enemy_death', ...getHealthState() });
            }

            // 2. Hunter Bonus Attack
            if (playerData.characterClass === CharacterClass.Hunter && defenderState.currentHealth > 0) {
                 const { logs: hunterLogs, defenderState: hunterDefender } = performAttack(playerState, defenderState, 0, gameData, enemiesState);
                 
                 const lastLog = hunterLogs[hunterLogs.length - 1];
                 if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                    const originalDamage = lastLog.damage;
                    const reducedDamage = Math.floor(originalDamage * 0.5);
                    const diff = originalDamage - reducedDamage;
                    
                    lastLog.damage = reducedDamage;
                    hunterDefender.currentHealth += diff;
                    lastLog.enemyHealth = hunterDefender.currentHealth;
                    
                    enemiesState[targetIndex] = hunterDefender as typeof target;
                 }
                 log.push(...hunterLogs.map(l => ({...l, ...getHealthState()})));

                 if (hunterDefender.currentHealth <= 0) {
                    log.push({ turn, attacker: playerState.name, defender: hunterDefender.name, action: 'enemy_death', ...getHealthState() });
                }
            }
        }
    }

    while (playerState.currentHealth > 0 && enemiesState.some(e => e.currentHealth > 0) && turn < 100) {
        turn++;
        
        // --- Global Turn Start Phase (Regen, DoTs) ---
        const allCombatants: AttackerState[] = [playerState, ...enemiesState.filter(e => e.currentHealth > 0)];
        
        for(const combatant of allCombatants) {
            // Mana Regen
            const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0) {
                const newMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
                if(newMana > combatant.currentMana) {
                    combatant.currentMana = newMana;
                }
            }
            // Burning
            const burningEffect = combatant.statusEffects.find(e => e.type === 'burning');
            if (burningEffect) {
                const burnDamage = Math.floor(combatant.stats.maxHealth * 0.05);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - burnDamage);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burningTarget', damage: burnDamage, ...getHealthState() });
                
                if (combatant.currentHealth <= 0 && combatant !== playerState) {
                    log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'enemy_death', ...getHealthState() });
                }
            }
            // Tick statuses
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        // --- Player Turn ---
        if (playerState.currentHealth > 0) {
            // Check Player CC
            const isFrozen = playerState.statusEffects.some(e => e.type === 'frozen_no_attack');

            if (isFrozen) {
                 log.push({ turn, attacker: playerState.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
            } else {
                // Shaman Power (Once per turn)
                if (playerData.characterClass === CharacterClass.Shaman && playerState.currentMana > 0) {
                    const shamanTargetIndex = enemiesState.findIndex(e => e.currentHealth > 0);
                    if (shamanTargetIndex !== -1) {
                        const sTarget = enemiesState[shamanTargetIndex];
                        const damage = Math.floor(playerState.currentMana);
                        sTarget.currentHealth = Math.max(0, sTarget.currentHealth - damage);
                        log.push({ turn, attacker: playerState.name, defender: sTarget.name, action: 'shaman_power', damage, ...getHealthState() });

                        if (sTarget.currentHealth <= 0) {
                            log.push({ turn, attacker: playerState.name, defender: sTarget.name, action: 'enemy_death', ...getHealthState() });
                        }
                    }
                }

                // Standard Attacks Loop
                const attacks = (playerState.stats as CharacterStats).attacksPerRound || 1;
                const reducedAttacks = playerState.statusEffects.filter(e => e.type === 'reduced_attacks').length;
                const finalAttacks = Math.max(1, Math.floor(attacks - reducedAttacks));

                for(let i = 0; i < finalAttacks; i++) {
                    // DYNAMICALLY FIND TARGET inside the loop
                    const targetIndex = enemiesState.findIndex(e => e.currentHealth > 0);
                    if (targetIndex === -1) break; // All enemies dead

                    const target = enemiesState[targetIndex];
                    
                    // Warrior Bonus Logic (1vMany)
                    let currentAttacker = playerState;
                    let attackOptions = {};

                    if (i === 0 && playerData.characterClass === CharacterClass.Warrior) {
                         currentAttacker = { ...playerState, stats: { ...playerState.stats, critChance: 100 } };
                         attackOptions = { ignoreDodge: true };
                    }

                    const { logs: attackLogs, attackerState, defenderState, aoeData, chainData } = performAttack(currentAttacker, target, turn, gameData, enemiesState, false, attackOptions);

                    // Update states
                    // Careful not to overwrite Warrior temp crit chance stats back to playerState
                    playerState.currentHealth = attackerState.currentHealth;
                    playerState.currentMana = attackerState.currentMana;
                    playerState.statusEffects = attackerState.statusEffects;
                    
                    enemiesState[targetIndex] = defenderState as typeof target;

                    log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));

                    if (defenderState.currentHealth <= 0) {
                        log.push({ turn, attacker: playerState.name, defender: defenderState.name, action: 'enemy_death', ...getHealthState() });
                    }

                    // Handle AoE
                    if (aoeData) {
                        const otherEnemies = enemiesState.filter((e, idx) => idx !== targetIndex && e.currentHealth > 0);
                        const splashDamageDetails: { target: string, damage: number }[] = [];
                        
                        if (aoeData.type === 'earthquake' || aoeData.type === 'meteor_swarm') {
                            let splashDamage = 0;
                            if (aoeData.type === 'earthquake') splashDamage = Math.floor(aoeData.baseDamage * aoeData.splashPercent);
                            if (aoeData.type === 'meteor_swarm') splashDamage = Math.floor(aoeData.baseDamage);

                            otherEnemies.forEach(enemy => {
                                const wasAlive = enemy.currentHealth > 0;
                                enemy.currentHealth = Math.max(0, enemy.currentHealth - splashDamage);
                                splashDamageDetails.push({ target: enemy.name, damage: splashDamage });
                                
                                if (wasAlive && enemy.currentHealth <= 0) {
                                    log.push({ turn, attacker: playerState.name, defender: enemy.name, action: 'enemy_death', ...getHealthState() });
                                }
                            });
                            
                            if (splashDamageDetails.length > 0) {
                                const effectName = aoeData.type === 'earthquake' ? 'earthquakeSplash' : 'meteorSwarmSplash';
                                log.push({ 
                                    turn, 
                                    attacker: playerState.name, 
                                    defender: 'Enemies', 
                                    action: 'effectApplied', 
                                    effectApplied: effectName, 
                                    damage: splashDamage, 
                                    aoeDamage: splashDamageDetails,
                                    ...getHealthState() 
                                });
                            }
                        }
                    }
                    
                    // Handle Chain Lightning
                    if (chainData && chainData.type === 'chain_lightning') {
                        // Filter out dead enemies and the primary target we just hit
                        const potentialTargets = enemiesState.filter((e, idx) => idx !== targetIndex && e.currentHealth > 0);
                        let jumps = 0;
                        const chainDamageDetails: { target: string, damage: number }[] = [];
                        let currentChainDamage = chainData.damage;
                        
                        while(jumps < chainData.maxJumps && potentialTargets.length > 0) {
                            if (Math.random() * 100 < chainData.chance) {
                                // Decrease damage per jump
                                currentChainDamage = Math.floor(currentChainDamage * 0.75);
                                if (currentChainDamage < 1) currentChainDamage = 1;

                                // Pick random target from remaining valid targets
                                const jumpTargetIndexLocal = Math.floor(Math.random() * potentialTargets.length);
                                const jumpTarget = potentialTargets[jumpTargetIndexLocal];
                                
                                const wasAlive = jumpTarget.currentHealth > 0;
                                jumpTarget.currentHealth = Math.max(0, jumpTarget.currentHealth - currentChainDamage);
                                chainDamageDetails.push({ target: jumpTarget.name, damage: currentChainDamage });
                                
                                if (wasAlive && jumpTarget.currentHealth <= 0) {
                                    log.push({ turn, attacker: playerState.name, defender: jumpTarget.name, action: 'enemy_death', ...getHealthState() });
                                }

                                // Remove this target from potential list so it's not hit again in this chain
                                potentialTargets.splice(jumpTargetIndexLocal, 1);
                                jumps++;
                            } else {
                                break;
                            }
                        }
                        
                        if (chainDamageDetails.length > 0) {
                                log.push({ 
                                turn, 
                                attacker: playerState.name, 
                                defender: 'Enemies', 
                                action: 'effectApplied', 
                                effectApplied: 'chainLightningJump', 
                                aoeDamage: chainDamageDetails,
                                ...getHealthState() 
                            });
                        }
                    }
                }

                // --- Berserker Bonus Attack (Player vs Many) ---
                if (playerData.characterClass === CharacterClass.Berserker && playerState.currentHealth < playerState.stats.maxHealth * 0.3) {
                    const targetIndex = enemiesState.findIndex(e => e.currentHealth > 0);
                    if (targetIndex !== -1) {
                        const target = enemiesState[targetIndex];
                        log.push({
                            turn, attacker: playerState.name, defender: target.name, action: 'berserker_frenzy',
                            ...getHealthState()
                        });
                        const { logs: bonusLogs, attackerState, defenderState } = performAttack(playerState, target, turn, gameData, enemiesState);
                        
                        playerState.currentHealth = attackerState.currentHealth;
                        playerState.currentMana = attackerState.currentMana;
                        playerState.statusEffects = attackerState.statusEffects;
                        
                        enemiesState[targetIndex] = defenderState as typeof target;
                        log.push(...bonusLogs.map(l => ({...l, ...getHealthState()})));

                        if (defenderState.currentHealth <= 0) {
                            log.push({ turn, attacker: playerState.name, defender: defenderState.name, action: 'enemy_death', ...getHealthState() });
                        }
                    }
                }
            }
        }

        // --- Enemies Turn ---
        // All living enemies attack the player
        const livingEnemies = enemiesState.filter(e => e.currentHealth > 0);
        for (const enemy of livingEnemies) {
            if (playerState.currentHealth <= 0) break;

            const isFrozen = enemy.statusEffects.some(e => e.type === 'frozen_no_attack');
            if (isFrozen) {
                 log.push({ turn, attacker: enemy.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
                 continue;
            }

            const enemyAttacks = (enemy.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = enemy.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, enemyAttacks - reducedAttacks);

            for(let i = 0; i < finalAttacks; i++) {
                if (playerState.currentHealth <= 0) break;

                // Enemy attacks Player. 
                // Attacker = Enemy. Defender = Player.
                const { logs: attackLogs, attackerState, defenderState } = performAttack(enemy, playerState, turn, gameData, []);
                
                // Update states
                // Correctly update Enemy from attackerState
                const eIndex = enemiesState.findIndex(e => e.uniqueId === enemy.uniqueId);
                enemiesState[eIndex] = attackerState as typeof enemy;
                
                // Correctly update Player from defenderState properties
                playerState.currentHealth = defenderState.currentHealth;
                playerState.currentMana = defenderState.currentMana;
                playerState.statusEffects = defenderState.statusEffects;

                log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));
            }
        }
    }
    
    // Post-combat cleanup logs
    if (playerState.currentHealth <= 0) {
         log.push({ turn, attacker: 'Enemies', defender: playerState.name, action: 'death', ...getHealthState() });
    } else if (enemiesState.every(e => e.currentHealth <= 0)) {
         log.push({ turn, attacker: playerState.name, defender: '', action: 'all_enemies_defeated', ...getHealthState() });
    }

    return log;
};

// ==========================================================================================
//                                 TEAM vs BOSS COMBAT
// ==========================================================================================
export const simulateTeamVsBossCombat = (
    playersData: PlayerCharacter[],
    bossData: Enemy,
    gameData: GameData
): { combatLog: CombatLogEntry[], finalPlayers: TeamCombatPlayerState[] } => {
    
    // --- 1. Initialization ---
    let playersState: TeamCombatPlayerState[] = playersData.map(p => ({
        data: p,
        currentHealth: p.stats.currentHealth,
        currentMana: p.stats.currentMana,
        isDead: p.stats.currentHealth <= 0,
        statusEffects: [],
        manaSurgeUsed: false,
        shadowBoltStacks: 0
    }));

    const effectiveBossStats = { ...defaultEnemyStats, ...(bossData.stats || {}) };

    let bossState: AttackerState & { specialAttacksUsed: Record<string, number> } = {
        stats: effectiveBossStats,
        currentHealth: effectiveBossStats.maxHealth,
        currentMana: effectiveBossStats.maxMana || 0,
        name: bossData.name,
        statusEffects: [],
        specialAttacksUsed: (bossData.specialAttacks || []).reduce((acc, sa) => ({ ...acc, [sa.type]: 0 }), {}),
        isEmpowered: false,
    };

    const log: CombatLogEntry[] = [];
    let turn = 0;

    // Helper to generate a snapshot of all players' health at specific moment
    const getHealthStateForLog = () => ({
        playerHealth: 0, 
        playerMana: 0,
        enemyHealth: bossState.currentHealth,
        enemyMana: bossState.currentMana,
        allPlayersHealth: playersState.map(p => ({ name: p.data.name, currentHealth: p.currentHealth, maxHealth: p.data.stats.maxHealth }))
    });

    const partyStats: Record<string, CharacterStats> = {};
    playersState.forEach(p => {
        partyStats[p.data.name] = p.data.stats;
    });

    log.push({
        turn, attacker: 'Drużyna', defender: bossState.name, action: 'starts a fight with',
        ...getHealthStateForLog(), 
        playerStats: playersData[0]?.stats, 
        enemyStats: bossState.stats, 
        enemyDescription: bossData.description,
        partyMemberStats: partyStats
    });
    
    // --- 2. Turn 0: Ranged Weapon Logic ---
    for (const player of playersState) {
        const weapon = player.data.equipment?.mainHand || player.data.equipment?.twoHand;
        const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;
        
        if (template?.isRanged && bossState.currentHealth > 0) {
             const playerAsAttacker: AttackerState = { ...player, stats: player.data.stats, name: player.data.name };
             const bossAsDefender: DefenderState = { ...bossState, stats: bossState.stats, name: bossState.name };
             
             const { logs: attackLogs, defenderState } = performAttack(playerAsAttacker, bossAsDefender, 0, gameData, []);
             bossState.currentHealth = defenderState.currentHealth;
             log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));

             if (player.data.characterClass === CharacterClass.Hunter && bossState.currentHealth > 0) {
                 const { logs: hunterLogs, defenderState: hunterBossState } = performAttack(playerAsAttacker, bossAsDefender, 0, gameData, []);
                 const lastLog = hunterLogs[hunterLogs.length - 1];
                 if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                    const originalDamage = lastLog.damage;
                    const reducedDamage = Math.floor(originalDamage * 0.5);
                    const diff = originalDamage - reducedDamage;
                    lastLog.damage = reducedDamage;
                    hunterBossState.currentHealth += diff;
                    lastLog.enemyHealth = hunterBossState.currentHealth;
                    bossState.currentHealth = hunterBossState.currentHealth;
                 }
                 log.push(...hunterLogs.map(l => ({...l, ...getHealthStateForLog()})));
             }
        }
    }

    // --- 3. Main Combat Loop ---
    while (playersState.some(p => !p.isDead) && bossState.currentHealth > 0 && turn < 100) {
        turn++;
        
        // --- 3.1. Start of Turn Phase (Status & Regen) ---
        const allCombatants: any[] = [...playersState.filter(p => !p.isDead), bossState];
        
        for (const combatant of allCombatants) {
            let stats: CharacterStats | EnemyStats | undefined = combatant.stats;
            if (!stats && combatant.data && combatant.data.stats) {
                stats = combatant.data.stats;
            }
            if (stats) {
                const manaRegen = stats.manaRegen || 0;
                if (manaRegen > 0) {
                    combatant.currentMana = Math.min(stats.maxMana || 0, combatant.currentMana + manaRegen);
                }
            }
            combatant.statusEffects = combatant.statusEffects.map((e: StatusEffect) => ({...e, duration: e.duration - 1})).filter((e: StatusEffect) => e.duration > 0);
        }

        // --- 3.2. Boss Special Attacks (Lair Actions - Happens BEFORE initiative) ---
        let bossUsedSpecial = false;
        if (bossState.currentHealth > 0) {
            for (const special of (bossData.specialAttacks || [])) {
                if (bossState.specialAttacksUsed[special.type] < special.uses && Math.random() * 100 < special.chance) {
                    const livingTargets = playersState.filter(p => !p.isDead);
                    if (livingTargets.length === 0) continue;
                    
                    bossState.specialAttacksUsed[special.type]++;
                    bossUsedSpecial = true; 
                    
                    // Log Shout first
                    log.push({
                        turn, 
                        attacker: bossState.name, 
                        defender: 'Team', 
                        action: 'boss_shout', 
                        shout: special.type, 
                        ...getHealthStateForLog()
                    });

                    switch(special.type) {
                        case SpecialAttackType.Stun: {
                            const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                            const targetIndex = playersState.findIndex(p => p.data.id === target.data.id);
                            playersState[targetIndex].statusEffects.push({ type: 'stunned', duration: 2 });
                            log.push({ turn, attacker: bossState.name, defender: target.data.name, action: 'specialAttackLog', specialAttackType: special.type, stunnedPlayer: target.data.name, ...getHealthStateForLog() });
                            break;
                        }
                        case SpecialAttackType.Earthquake: {
                            const damageDetails: { target: string, damage: number }[] = [];
                            playersState.forEach(p => {
                                if (!p.isDead) {
                                    const dmg = Math.floor(p.data.stats.maxHealth * 0.2);
                                    p.currentHealth = Math.max(0, p.currentHealth - dmg);
                                    damageDetails.push({ target: p.data.name, damage: dmg });
                                }
                            });
                            log.push({ turn, attacker: bossState.name, defender: 'Drużyna', action: 'specialAttackLog', specialAttackType: special.type, aoeDamage: damageDetails, ...getHealthStateForLog() });
                            break;
                        }
                        case SpecialAttackType.ArmorPierce: {
                            const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                            const targetIndex = playersState.findIndex(p => p.data.id === target.data.id);
                            playersState[targetIndex].statusEffects.push({ type: 'armor_broken', duration: 2 });
                            log.push({ turn, attacker: bossState.name, defender: target.data.name, action: 'specialAttackLog', specialAttackType: special.type, ...getHealthStateForLog() });
                            break;
                        }
                        case SpecialAttackType.DeathTouch: {
                            const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                            const targetIndex = playersState.findIndex(p => p.data.id === target.data.id);
                            const damage = Math.floor(playersState[targetIndex].currentHealth * 0.5);
                            playersState[targetIndex].currentHealth -= damage;
                            log.push({ turn, attacker: bossState.name, defender: target.data.name, action: 'specialAttackLog', specialAttackType: special.type, damage, ...getHealthStateForLog() });
                            break;
                        }
                        case SpecialAttackType.EmpoweredStrikes: {
                            bossState.isEmpowered = true;
                            log.push({ turn, attacker: bossState.name, defender: '', action: 'specialAttackLog', specialAttackType: special.type, ...getHealthStateForLog() });
                            bossUsedSpecial = false; // Does not consume attack
                            break;
                        }
                    }
                    if (bossUsedSpecial) break; 
                }
            }
        }
        
        // Check dead after special
        playersState.forEach(p => {
            if (!p.isDead && p.currentHealth <= 0) {
                p.isDead = true;
                log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() });
            }
        });
        
        // --- 3.3. Standard Combat Phase (Initiative) ---
        
        interface ActionEntity {
            type: 'player' | 'boss';
            index: number; // Index in playersState or -1 for boss
            name: string;
            agility: number;
        }

        const actionQueue: ActionEntity[] = [];

        // Add Players to queue
        playersState.forEach((p, index) => {
            if (!p.isDead) {
                actionQueue.push({
                    type: 'player',
                    index: index,
                    name: p.data.name,
                    agility: p.data.stats.agility
                });
            }
        });

        // Add Boss to queue
        if (bossState.currentHealth > 0) {
            actionQueue.push({
                type: 'boss',
                index: -1,
                name: bossState.name,
                agility: (bossState.stats as EnemyStats).agility
            });
        }

        // Sort by Agility Descending. Players win ties.
        actionQueue.sort((a, b) => {
            if (b.agility !== a.agility) {
                return b.agility - a.agility;
            }
            return a.type === 'player' ? -1 : 1;
        });

        // Execute Actions
        for (const actor of actionQueue) {
            if (bossState.currentHealth <= 0) break; // Fight ends immediately if boss dies

            if (actor.type === 'player') {
                const playerIndex = actor.index;
                const player = playersState[playerIndex];
                
                if (player.isDead) continue;

                // --- Player Turn Logic ---
                if (player.data.characterClass === CharacterClass.Shaman && player.currentMana > 0) {
                    const shamanDamage = Math.floor(player.currentMana);
                    bossState.currentHealth = Math.max(0, bossState.currentHealth - shamanDamage);
                    log.push({ turn, attacker: player.data.name, defender: bossState.name, action: 'shaman_power', damage: shamanDamage, ...getHealthStateForLog() });
                    if (bossState.currentHealth <= 0) break;
                }

                const stunIndex = player.statusEffects.findIndex(e => e.type === 'stunned');
                if (stunIndex > -1) continue;

                const attacks = player.data.stats.attacksPerRound;
                for (let i = 0; i < attacks; i++) {
                    if (bossState.currentHealth <= 0) break;

                    let playerAsAttacker: AttackerState & {data: PlayerCharacter} = { ...playersState[playerIndex], stats: playersState[playerIndex].data.stats, name: playersState[playerIndex].data.name };
                    let attackOptions = {};

                    // Warrior Bonus: 1st attack is Auto-Crit and No-Dodge
                    if (i === 0 && player.data.characterClass === CharacterClass.Warrior) {
                        playerAsAttacker = { ...playerAsAttacker, stats: { ...playerAsAttacker.stats, critChance: 100 } };
                        attackOptions = { ignoreDodge: true };
                    }

                    const { logs: attackLogs, attackerState, defenderState } = performAttack(playerAsAttacker, { ...bossState, stats: bossState.stats, name: bossState.name }, turn, gameData, [], false, attackOptions);
                    
                    playersState[playerIndex].currentHealth = attackerState.currentHealth;
                    playersState[playerIndex].currentMana = attackerState.currentMana;
                    playersState[playerIndex].statusEffects = attackerState.statusEffects;

                    bossState.currentHealth = defenderState.currentHealth;
                    bossState.currentMana = defenderState.currentMana;
                    bossState.statusEffects = defenderState.statusEffects;
                    
                    log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));
                }
                
                if (player.data.characterClass === CharacterClass.Berserker && player.currentHealth < player.data.stats.maxHealth * 0.3 && bossState.currentHealth > 0) {
                     log.push({
                        turn, attacker: player.data.name, defender: bossState.name, action: 'berserker_frenzy',
                        ...getHealthStateForLog()
                     });
                     const { logs: bonusLogs, attackerState, defenderState } = performAttack({ ...playersState[playerIndex], stats: playersState[playerIndex].data.stats, name: playersState[playerIndex].data.name }, { ...bossState, stats: bossState.stats, name: bossState.name }, turn, gameData, []);
                     
                     playersState[playerIndex].currentHealth = attackerState.currentHealth;
                     playersState[playerIndex].currentMana = attackerState.currentMana;
                     
                     bossState.currentHealth = defenderState.currentHealth;
                     bossState.currentMana = defenderState.currentMana;
                     
                     log.push(...bonusLogs.map(l => ({...l, ...getHealthStateForLog()})));
                }

            } else {
                // --- Boss Turn Logic ---
                const bossAttacks = (bossState.stats as EnemyStats).attacksPerTurn || 1;
                for (let i = 0; i < bossAttacks; i++) {
                    const currentLivingTargets = playersState.filter(p => !p.isDead);
                    if (currentLivingTargets.length === 0) break;
                    
                    const targetPlayer = currentLivingTargets[Math.floor(Math.random() * currentLivingTargets.length)];
                    const targetIndex = playersState.findIndex(p => p.data.id === targetPlayer.data.id);

                    const targetAsDefender: DefenderState = {
                        stats: playersState[targetIndex].data.stats,
                        name: playersState[targetIndex].data.name,
                        currentHealth: playersState[targetIndex].currentHealth,
                        currentMana: playersState[targetIndex].currentMana,
                        statusEffects: playersState[targetIndex].statusEffects,
                        hardSkinTriggered: playersState[targetIndex].hardSkinTriggered,
                        data: playersState[targetIndex].data
                    };

                    const { logs: attackLogs, attackerState, defenderState, aoeData, chainData } = performAttack(
                        { ...bossState }, 
                        targetAsDefender, 
                        turn, gameData, [], true
                    );
                    
                    bossState.currentHealth = attackerState.currentHealth;
                    bossState.currentMana = attackerState.currentMana;
                    
                    playersState[targetIndex].currentHealth = defenderState.currentHealth;
                    playersState[targetIndex].currentMana = defenderState.currentMana;
                    playersState[targetIndex].statusEffects = defenderState.statusEffects;
                    
                    if (playersState[targetIndex].currentHealth <= 0) {
                        playersState[targetIndex].isDead = true;
                    }

                    log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));

                    if (aoeData) {
                        const otherPlayers = playersState.filter((p, idx) => idx !== targetIndex && !p.isDead);
                        const splashDamageDetails: { target: string, damage: number }[] = [];
                        
                        if (aoeData.type === 'earthquake' || aoeData.type === 'meteor_swarm') {
                            let splashDamage = 0;
                            if (aoeData.type === 'earthquake') splashDamage = Math.floor(aoeData.baseDamage * aoeData.splashPercent);
                            if (aoeData.type === 'meteor_swarm') splashDamage = Math.floor(aoeData.baseDamage);

                            otherPlayers.forEach(p => {
                                const wasAlive = p.currentHealth > 0;
                                p.currentHealth = Math.max(0, p.currentHealth - splashDamage);
                                splashDamageDetails.push({ target: p.data.name, damage: splashDamage });
                                
                                if (wasAlive && p.currentHealth <= 0) {
                                    p.isDead = true;
                                    log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() });
                                }
                            });
                            
                            if (splashDamageDetails.length > 0) {
                                const effectName = aoeData.type === 'earthquake' ? 'earthquakeSplash' : 'meteorSwarmSplash';
                                log.push({ 
                                    turn, 
                                    attacker: bossState.name, 
                                    defender: 'Drużyna', 
                                    action: 'effectApplied', 
                                    effectApplied: effectName, 
                                    damage: splashDamage, 
                                    aoeDamage: splashDamageDetails,
                                    ...getHealthStateForLog() 
                                });
                            }
                        }
                    }
                    
                    // Handle Chain Lightning
                    if (chainData && chainData.type === 'chain_lightning') {
                        const potentialTargets = playersState.filter((p, idx) => idx !== targetIndex && !p.isDead);
                        let jumps = 0;
                        const chainDamageDetails: { target: string, damage: number }[] = [];
                        let currentChainDamage = chainData.damage;
                        
                        while(jumps < chainData.maxJumps && potentialTargets.length > 0) {
                            if (Math.random() * 100 < chainData.chance) {
                                // Decrease damage per jump
                                currentChainDamage = Math.floor(currentChainDamage * 0.75);
                                if (currentChainDamage < 1) currentChainDamage = 1;

                                // Pick random target from remaining valid targets
                                const jumpTargetIndexLocal = Math.floor(Math.random() * potentialTargets.length);
                                const jumpTarget = potentialTargets[jumpTargetIndexLocal];
                                
                                const wasAlive = jumpTarget.currentHealth > 0;
                                jumpTarget.currentHealth = Math.max(0, jumpTarget.currentHealth - currentChainDamage);
                                chainDamageDetails.push({ target: jumpTarget.data.name, damage: currentChainDamage });
                                
                                if (wasAlive && jumpTarget.currentHealth <= 0) {
                                    jumpTarget.isDead = true;
                                    log.push({ turn, attacker: bossState.name, defender: jumpTarget.data.name, action: 'death', ...getHealthStateForLog() });
                                }

                                // Remove this target from potential list so it's not hit again in this chain
                                potentialTargets.splice(jumpTargetIndexLocal, 1);
                                jumps++;
                            } else {
                                break;
                            }
                        }
                        
                        if (chainDamageDetails.length > 0) {
                                log.push({ 
                                    turn, 
                                    attacker: bossState.name, 
                                    defender: 'Drużyna', 
                                    action: 'effectApplied', 
                                    effectApplied: 'chainLightningJump', 
                                    aoeDamage: chainDamageDetails,
                                    ...getHealthStateForLog() 
                                });
                        }
                    }
                }
            }
        }

        // --- 3.4. End of Turn Phase ---
        if (bossState.currentHealth <= 0) {
            log.push({ turn, attacker: 'Drużyna', defender: bossState.name, action: 'enemy_death', ...getHealthStateForLog() });
            break;
        }

        playersState.forEach(p => {
            if (!p.isDead && p.currentHealth <= 0) {
                p.isDead = true;
                log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() });
            }
        });
    }

    return { combatLog: log, finalPlayers: playersState };
};