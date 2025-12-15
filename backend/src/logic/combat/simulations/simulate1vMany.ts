
import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../../../types.js';
import { performAttack, AttackerState, DefenderState, StatusEffect } from '../core.js';
import { randomUUID } from 'crypto';

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
        // Calculate total health of all enemies instead of hardcoding 0
        enemyHealth: enemiesState.reduce((sum, e) => sum + Math.max(0, e.currentHealth), 0),
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
            const attackOptions: { ignoreDodge?: boolean, critChanceOverride?: number } = {};
            if (playerData.characterClass === CharacterClass.Warrior) {
                attackOptions.critChanceOverride = 100;
                attackOptions.ignoreDodge = true;
            }
            const { logs: attackLogs, attackerState, defenderState } = performAttack(playerState, target, 0, gameData, enemiesState, false, attackOptions);
            
            Object.assign(playerState, attackerState);
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
                 log.push(...hunterLogs.map(l => ({ ...l, ...getHealthState(), action: 'hunter_bonus_shot' })));

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
                
                if (combatant.currentHealth <= 0) {
                    if (combatant !== playerState) {
                        log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'enemy_death', ...getHealthState() });
                    } else {
                        log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'death', ...getHealthState() });
                    }
                }
            }
            // Tick statuses
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }
        
        // Check if player died from DoTs before starting turn
        if (playerState.currentHealth <= 0) break;

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
                    const targetIndex = enemiesState.findIndex(e => e.currentHealth > 0);
                    if (targetIndex === -1) break; 
                    const target = enemiesState[targetIndex];

                    const attackerForThisHit = { ...playerState };
                    const attackOptions = {};
                    if (playerData.characterClass === CharacterClass.Warrior && i === 0) {
                        attackerForThisHit.stats = { ...attackerForThisHit.stats, critChance: 100 };
                        Object.assign(attackOptions, { ignoreDodge: true });
                    }

                    const { logs: attackLogs, attackerState, defenderState, aoeData, chainData } = performAttack(attackerForThisHit, target, turn, gameData, enemiesState, false, attackOptions);

                    playerState.currentHealth = attackerState.currentHealth;
                    playerState.currentMana = attackerState.currentMana;
                    playerState.statusEffects = attackerState.statusEffects;
                    playerState.manaSurgeUsed = attackerState.manaSurgeUsed;
                    playerState.shadowBoltStacks = attackerState.shadowBoltStacks;

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
                        
                        Object.assign(playerState, attackerState);
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

                const { logs: attackLogs, attackerState, defenderState } = performAttack(enemy, playerState, turn, gameData, []);
                
                const eIndex = enemiesState.findIndex(e => e.uniqueId === enemy.uniqueId);
                Object.assign(enemiesState[eIndex], attackerState);
                Object.assign(playerState, defenderState);

                log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));

                // CHECK DEATH HERE INSIDE THE LOOP to capture the specific killer
                if (playerState.currentHealth <= 0) {
                    log.push({ turn, attacker: enemy.name, defender: playerState.name, action: 'death', ...getHealthState() });
                    break; // Player died, stop this enemy's attacks
                }
            }
        }
    }
    
    // Post-combat cleanup logs
    // We check if 'death' was already logged inside the loop to avoid duplication
    if (playerState.currentHealth <= 0 && !log.some(l => l.action === 'death')) {
         log.push({ turn, attacker: 'Enemies', defender: playerState.name, action: 'death', ...getHealthState() });
    } else if (enemiesState.every(e => e.currentHealth <= 0)) {
         // Changed action from 'enemy_death' to 'all_enemies_defeated' to avoid singular "X został pokonany!" for a group victory summary
         log.push({ turn, attacker: playerState.name, defender: '', action: 'all_enemies_defeated', ...getHealthState() });
    }

    return log;
};
