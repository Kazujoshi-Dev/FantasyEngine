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
    
    // --- Turn 0: Ranged Weapons Logic ---
    const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
    const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

    if (template?.isRanged && enemyState.currentHealth > 0) {
        // 1. Standard Ranged Attack (Everyone with ranged weapon)
        const { logs: attackLogs, defenderState } = performAttack(playerState, enemyState, 0, gameData, []);
        log.push(...attackLogs);
        enemyState = defenderState as typeof enemyState; // Sync state

        // 2. Hunter Bonus Attack (Only Hunters, 50% damage)
        if (playerData.characterClass === CharacterClass.Hunter && enemyState.currentHealth > 0) {
             const { logs: hunterLogs, defenderState: hunterDefenderState } = performAttack(playerState, enemyState, 0, gameData, []);
             
             // Apply 50% damage reduction logic manually to the log and state
             const lastLog = hunterLogs[hunterLogs.length - 1];
             if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                const originalDamage = lastLog.damage;
                const reducedDamage = Math.floor(originalDamage * 0.5);
                const diff = originalDamage - reducedDamage;
                
                // Correct the log
                lastLog.damage = reducedDamage;
                // Correct the actual health state (heal back the difference)
                hunterDefenderState.currentHealth += diff;
                // Sync local variable
                enemyState = hunterDefenderState as typeof enemyState;
                
                // Update health in log entry to match new state
                lastLog.enemyHealth = enemyState.currentHealth;
             }
             log.push(...hunterLogs);
        }
    }

    let playerAttacksFirst = (playerData.race === Race.Elf) || (playerState.stats.agility >= enemyState.stats.agility);

    while (playerState.currentHealth > 0 && enemyState.currentHealth > 0 && turn < 100) {
        turn++;
        
        const getHealthState = (pState: typeof playerState, eState: typeof enemyState) => ({
            playerHealth: pState.currentHealth, playerMana: pState.currentMana,
            enemyHealth: eState.currentHealth, enemyMana: eState.currentMana
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
                    ...getHealthState(playerState, enemyState)
                });
                if (enemyState.currentHealth <= 0) {
                    log.push({ turn, attacker: playerState.name, defender: enemyState.name, action: 'enemy_death', ...getHealthState(playerState, enemyState) });
                    break; 
                }
            }
        }
        
        // --- Turn Start Effects & Mana Regen ---
        const turnParticipants = playerAttacksFirst ? [playerState, enemyState] : [enemyState, playerState];
        for(const combatant of turnParticipants) {
            // Mana Regen
            const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0) {
                const newMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
                const manaGained = newMana - combatant.currentMana;
                if(manaGained > 0) {
                    combatant.currentMana = newMana;
                    log.push({ turn, attacker: combatant.name, defender: '', action: 'manaRegen', manaGained, ...getHealthState(playerState, enemyState) });
                }
            }
            // Burning Effect
            const burningEffect = combatant.statusEffects.find(e => e.type === 'burning');
            if (burningEffect) {
                const burnDamage = Math.floor(combatant.stats.maxHealth * 0.05);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - burnDamage);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burningTarget', damage: burnDamage, ...getHealthState(playerState, enemyState) });
            }
            // Decrement status effect durations
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        const attacker = playerAttacksFirst ? playerState : enemyState;
        const defender = playerAttacksFirst ? enemyState : playerState;

        // --- Attacker's Turn ---
        if (attacker.currentHealth > 0) {
            const isPlayerAttacking = 'statPoints' in attacker.stats;
            const attacks = isPlayerAttacking ? (attacker.stats as CharacterStats).attacksPerRound : (attacker.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = attacker.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);
            
            if (attacker.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                 for (let i = 0; i < finalAttacks && defender.currentHealth > 0; i++) {
                    const { logs: attackLogs, attackerState, defenderState } = performAttack(attacker, defender, turn, gameData, []);
                    log.push(...attackLogs);
                    if (playerAttacksFirst) {
                        playerState = attackerState as typeof playerState;
                        enemyState = defenderState as typeof enemyState;
                    } else {
                        enemyState = attackerState as typeof enemyState;
                        playerState = defenderState as typeof playerState;
                    }
                }
            }
        }
        
        // --- Defender's Turn (if they weren't first) ---
        if (defender.currentHealth > 0) {
            const isPlayerDefending = 'statPoints' in defender.stats;
            const attacks = isPlayerDefending ? (defender.stats as CharacterStats).attacksPerRound : (defender.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = defender.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);

             if (defender.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: defender.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                for (let i = 0; i < finalAttacks && attacker.currentHealth > 0; i++) {
                    const { logs: attackLogs, attackerState, defenderState } = performAttack(defender, attacker, turn, gameData, []);
                    log.push(...attackLogs);
                    if (playerAttacksFirst) {
                        enemyState = attackerState as typeof enemyState;
                        playerState = defenderState as typeof playerState;
                    } else {
                        playerState = attackerState as typeof playerState;
                        enemyState = defenderState as typeof enemyState;
                    }
                }
            }
        }

        playerAttacksFirst = playerState.stats.agility >= enemyState.stats.agility;
    }
    
    // Final death check if loop exited due to HP <= 0 but no death log was pushed (e.g. Turn 0 kill)
    if (enemyState.currentHealth <= 0 && !log.some(l => l.action === 'enemy_death')) {
         log.push({ 
             turn, attacker: playerState.name, defender: enemyState.name, action: 'enemy_death', 
             playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
             enemyHealth: enemyState.currentHealth, enemyMana: enemyState.currentMana
         });
    } else if (playerState.currentHealth <= 0 && !log.some(l => l.action === 'death')) {
         log.push({ 
             turn, attacker: enemyState.name, defender: playerState.name, action: 'death', 
             playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
             enemyHealth: enemyState.currentHealth, enemyMana: enemyState.currentMana
         });
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
        // For logs focusing on one enemy, typically the last target is used, 
        // but for group updates we rely on `allEnemiesHealth`
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

                    const { logs: attackLogs, attackerState, defenderState, aoeData, chainData } = performAttack(playerState, target, turn, gameData, enemiesState);

                    // Update states
                    playerState = attackerState as typeof playerState;
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
                            if (aoeData.type === 'meteor_swarm') splashDamage = aoeData.baseDamage;

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
                        const otherEnemies = enemiesState.filter((e, idx) => idx !== targetIndex && e.currentHealth > 0);
                        let jumps = 0;
                        const chainDamageDetails: { target: string, damage: number }[] = [];
                        
                        while(jumps < chainData.maxJumps && otherEnemies.length > 0) {
                            if (Math.random() * 100 < chainData.chance) {
                                const jumpTargetIndex = Math.floor(Math.random() * otherEnemies.length);
                                const jumpTarget = otherEnemies[jumpTargetIndex];
                                const dmg = Math.floor(chainData.damage * 0.75);
                                
                                const wasAlive = jumpTarget.currentHealth > 0;
                                jumpTarget.currentHealth = Math.max(0, jumpTarget.currentHealth - dmg);
                                chainDamageDetails.push({ target: jumpTarget.name, damage: dmg });
                                
                                if (wasAlive && jumpTarget.currentHealth <= 0) {
                                    log.push({ turn, attacker: playerState.name, defender: jumpTarget.name, action: 'enemy_death', ...getHealthState() });
                                }

                                otherEnemies.splice(jumpTargetIndex, 1);
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

                const { logs: attackLogs, attackerState, defenderState } = performAttack(enemy, playerState, turn, gameData, []);
                
                // Update states (enemyState needs to be updated in the array via reference or ID, 
                // but performAttack returns a new object/state typically.
                // Here `enemy` is a reference from `enemiesState`, but performAttack treats inputs as immutable-ish 
                // returning new states. We must write back.)
                const eIndex = enemiesState.findIndex(e => e.uniqueId === enemy.uniqueId);
                enemiesState[eIndex] = attackerState as typeof enemy;
                playerState = defenderState as typeof playerState;

                log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));
            }
        }
    }
    
    // Post-combat cleanup logs
    if (playerState.currentHealth <= 0) {
         log.push({ turn, attacker: 'Enemies', defender: playerState.name, action: 'death', ...getHealthState() });
    } else if (enemiesState.every(e => e.currentHealth <= 0)) {
         // Changed action from 'enemy_death' to 'all_enemies_defeated' to avoid singular "X został pokonany!" for a group victory summary
         log.push({ turn, attacker: playerState.name, defender: '', action: 'all_enemies_defeated', ...getHealthState() });
    }

    return log;
};

// ==========================================================================================
//                                 TEAM vs BOSS COMBAT (REWRITTEN)
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

    const getHealthStateForLog = () => ({
        playerHealth: 0, 
        playerMana: 0,
        enemyHealth: bossState.currentHealth,
        enemyMana: bossState.currentMana,
        allPlayersHealth: playersState.map(p => ({ name: p.data.name, currentHealth: p.currentHealth, maxHealth: p.data.stats.maxHealth }))
    });

    // Calculate stats for all players for the log to fix tooltips
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
             
             // 1. Standard Ranged Attack (Everyone with ranged weapon)
             const { logs: attackLogs, defenderState } = performAttack(playerAsAttacker, bossAsDefender, 0, gameData, []);
             bossState.currentHealth = defenderState.currentHealth; // Sync Boss HP
             log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));

             // 2. Hunter Bonus Attack (Only Hunters, 50% damage)
             if (player.data.characterClass === CharacterClass.Hunter && bossState.currentHealth > 0) {
                 const { logs: hunterLogs, defenderState: hunterBossState } = performAttack(playerAsAttacker, bossAsDefender, 0, gameData, []);
                 
                 const lastLog = hunterLogs[hunterLogs.length - 1];
                 if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                    const originalDamage = lastLog.damage;
                    const reducedDamage = Math.floor(originalDamage * 0.5);
                    const diff = originalDamage - reducedDamage;
                    
                    lastLog.damage = reducedDamage;
                    hunterBossState.currentHealth += diff; // Restore HP
                    lastLog.enemyHealth = hunterBossState.currentHealth;
                    
                    bossState.currentHealth = hunterBossState.currentHealth; // Sync Boss HP
                 }
                 log.push(...hunterLogs.map(l => ({...l, ...getHealthStateForLog()})));
             }
        }
    }

    // --- 3. Main Combat Loop ---
    while (playersState.some(p => !p.isDead) && bossState.currentHealth > 0 && turn < 100) {
        turn++;
        
        // --- 3.1. Start of Turn Phase ---
        // CRITICAL FIX: Use `any` or a specific union type to handle both Player and Boss states correctly in the loop.
        // The previous crash was caused by accessing `combatant.stats` on a Player object where stats are nested in `data`.
        const allCombatants: any[] = [...playersState.filter(p => !p.isDead), bossState];
        
        for (const combatant of allCombatants) {
            // Access stats safely: Player has `data.stats`, Boss has direct `stats`.
            let stats: CharacterStats | EnemyStats | undefined = combatant.stats;
            if (!stats && combatant.data && combatant.data.stats) {
                stats = combatant.data.stats;
            }

            // Mana Regen
            if (stats) {
                const manaRegen = stats.manaRegen || 0;
                if (manaRegen > 0) {
                    combatant.currentMana = Math.min(stats.maxMana || 0, combatant.currentMana + manaRegen);
                }
            }
            // Status Effects
            combatant.statusEffects = combatant.statusEffects.map((e: StatusEffect) => ({...e, duration: e.duration - 1})).filter((e: StatusEffect) => e.duration > 0);
        }
        
        // --- 3.2. Players' Turn ---
        const livingPlayers = playersState.filter(p => !p.isDead);
        for (const player of livingPlayers) {
            if (bossState.currentHealth <= 0) break;
            const playerIndex = playersState.findIndex(p => p.data.id === player.data.id);

            // Shaman Damage
            if (player.data.characterClass === CharacterClass.Shaman && player.currentMana > 0) {
                const shamanDamage = Math.floor(player.currentMana);
                bossState.currentHealth = Math.max(0, bossState.currentHealth - shamanDamage);
                log.push({ turn, attacker: player.data.name, defender: bossState.name, action: 'shaman_power', damage: shamanDamage, ...getHealthStateForLog() });
                if (bossState.currentHealth <= 0) break;
            }

            // Stun Check
            const stunIndex = player.statusEffects.findIndex(e => e.type === 'stunned');
            if (stunIndex > -1) {
                // Stun consumes the turn
                continue;
            }

            const attacks = player.data.stats.attacksPerRound;
            for (let i = 0; i < attacks; i++) {
                if (bossState.currentHealth <= 0) break;

                let playerAsAttacker: AttackerState & {data: PlayerCharacter} = { ...playersState[playerIndex], stats: playersState[playerIndex].data.stats, name: playersState[playerIndex].data.name };
                
                // Warrior Bonus
                if (i === 0 && player.data.characterClass === CharacterClass.Warrior) {
                    playerAsAttacker.stats = { ...playerAsAttacker.stats, critChance: 100 };
                }

                const { logs: attackLogs, attackerState, defenderState } = performAttack(playerAsAttacker, { ...bossState, stats: bossState.stats, name: bossState.name }, turn, gameData, []);
                
                playersState[playerIndex] = { ...playersState[playerIndex], ...attackerState };
                bossState = { ...bossState, ...defenderState };
                log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));
            }
            
            // Berserker Bonus Attack
            if (player.data.characterClass === CharacterClass.Berserker && player.currentHealth < player.data.stats.maxHealth * 0.3 && bossState.currentHealth > 0) {
                 const { logs: bonusLogs, attackerState, defenderState } = performAttack({ ...playersState[playerIndex], stats: playersState[playerIndex].data.stats, name: playersState[playerIndex].data.name }, { ...bossState, stats: bossState.stats, name: bossState.name }, turn, gameData, []);
                 playersState[playerIndex] = { ...playersState[playerIndex], ...attackerState };
                 bossState = { ...bossState, ...defenderState };
                 log.push(...bonusLogs.map(l => ({...l, ...getHealthStateForLog()})));
            }
        }
        
        if (bossState.currentHealth <= 0) {
            log.push({ turn, attacker: 'Drużyna', defender: bossState.name, action: 'enemy_death', ...getHealthStateForLog() });
            break;
        }
        
        // --- 3.3. Boss's Turn ---
        let bossUsedSpecial = false;
        for (const special of (bossData.specialAttacks || [])) {
            if (bossState.specialAttacksUsed[special.type] < special.uses && Math.random() * 100 < special.chance) {
                const livingTargets = playersState.filter(p => !p.isDead);
                if (livingTargets.length === 0) continue;
                
                bossState.specialAttacksUsed[special.type]++;
                bossUsedSpecial = true; // Consume turn action with special attack (usually)
                
                switch(special.type) {
                    case SpecialAttackType.Stun: {
                        const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                        const targetIndex = playersState.findIndex(p => p.data.id === target.data.id);
                        // Apply stunned effect. Duration 2 means "this turn" (decremented at end of boss turn) and "next player turn".
                        // Actually status update happens at START of turn. So applying now means it exists for player's next turn.
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
                        // Does not consume attack action, boss still attacks
                        bossUsedSpecial = false; 
                        break;
                    }
                }
                if (bossUsedSpecial) break; // Only one action-consuming special per turn
            }
        }
        
        if (!bossUsedSpecial) {
            const livingTargets = playersState.filter(p => !p.isDead);
            if (livingTargets.length > 0) {
                const bossAttacks = (bossState.stats as EnemyStats).attacksPerTurn || 1;
                for (let i = 0; i < bossAttacks; i++) {
                    if (playersState.every(p => p.isDead)) break;
                    
                    const targetPlayer = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                    const targetIndex = playersState.findIndex(p => p.data.id === targetPlayer.data.id);

                    const { logs: attackLogs, attackerState, defenderState } = performAttack({ ...bossState }, { ...playersState[targetIndex], stats: playersState[targetIndex].data.stats, name: playersState[targetIndex].data.name }, turn, gameData, []);
                    
                    bossState = { ...bossState, ...attackerState };
                    playersState[targetIndex] = { ...playersState[targetIndex], ...defenderState };
                    log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));
                }
            }
        }

        // --- 3.4. End of Turn Phase ---
        playersState.forEach(p => {
            if (!p.isDead && p.currentHealth <= 0) {
                p.isDead = true;
                log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() });
            }
        });
    }

    // --- 4. Finalization ---
    const finalState = getHealthStateForLog();
    log.forEach(l => {
        l.allPlayersHealth = finalState.allPlayersHealth;
        l.enemyHealth = finalState.enemyHealth;
        l.enemyMana = finalState.enemyMana;
    });

    return { combatLog: log, finalPlayers: playersState };
};