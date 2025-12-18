
import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../../../types.js';
import { performAttack, AttackerState, DefenderState, getFullWeaponName, StatusEffect } from '../core.js';

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
        playerStats: playerState.stats as CharacterStats, enemyStats: enemyState.stats as EnemyStats, enemyDescription: enemyState.description
    });
    
    // --- Turn 0: Ranged Weapons Logic ---
    const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
    const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

    if (template?.isRanged && enemyState.currentHealth > 0) {
        // 1. Standard Ranged Attack (Everyone with ranged weapon)
        const attackOptions: { ignoreDodge?: boolean, critChanceOverride?: number } = {};
        if (playerData.characterClass === CharacterClass.Warrior) {
            attackOptions.critChanceOverride = 100;
            attackOptions.ignoreDodge = true;
        }

        const { logs: attackLogs, attackerState, defenderState } = performAttack(playerState, enemyState, 0, gameData, [], false, attackOptions);
        log.push(...attackLogs);
        Object.assign(playerState, attackerState);
        Object.assign(enemyState, defenderState);

        // 2. Hunter Bonus Attack (Only Hunters, 50% damage)
        if (playerData.characterClass === CharacterClass.Hunter && enemyState.currentHealth > 0) {
             const { logs: hunterLogs, defenderState: hunterDefenderState } = performAttack(playerState, enemyState, 0, gameData, []);
             
             const lastLog = hunterLogs[hunterLogs.length - 1];
             if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                const originalDamage = lastLog.damage;
                const reducedDamage = Math.floor(originalDamage * 0.5);
                const diff = originalDamage - reducedDamage;
                
                lastLog.damage = reducedDamage;
                hunterDefenderState.currentHealth += diff;
                lastLog.enemyHealth = hunterDefenderState.currentHealth;

                Object.assign(enemyState, hunterDefenderState);
             }
             // Tag the log as a hunter bonus shot
             log.push(...hunterLogs.map(l => ({ ...l, action: 'hunter_bonus_shot' })));
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
            const isPlayerAttacking = 'data' in attacker;
            const attacks = isPlayerAttacking ? (attacker.stats as CharacterStats).attacksPerRound : (attacker.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = attacker.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);
            
            if (attacker.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                 for (let i = 0; i < finalAttacks && defender.currentHealth > 0; i++) {
                    const isWarrior = isPlayerAttacking && (attacker as any).data.characterClass === CharacterClass.Warrior;
                    
                    const attackerForThisHit = { ...attacker };
                    const attackOptions = {};

                    if (isWarrior && i === 0) {
                        attackerForThisHit.stats = { ...attackerForThisHit.stats, critChance: 100 };
                        Object.assign(attackOptions, { ignoreDodge: true });
                    }

                    const { logs: attackLogs, attackerState, defenderState } = performAttack(attackerForThisHit, defender, turn, gameData, [], false, attackOptions);
                    log.push(...attackLogs);

                    if (playerAttacksFirst) {
                        Object.assign(playerState, { currentHealth: attackerState.currentHealth, currentMana: attackerState.currentMana, statusEffects: attackerState.statusEffects, manaSurgeUsed: attackerState.manaSurgeUsed, shadowBoltStacks: attackerState.shadowBoltStacks });
                        Object.assign(enemyState, defenderState);
                    } else {
                        Object.assign(enemyState, { currentHealth: attackerState.currentHealth, currentMana: attackerState.currentMana, statusEffects: attackerState.statusEffects });
                        Object.assign(playerState, defenderState);
                    }
                }

                // --- Berserker Bonus Attack (Player Only) ---
                if (isPlayerAttacking && defender.currentHealth > 0) {
                    const pAttacker = attacker as typeof playerState;
                    if (pAttacker.data.characterClass === CharacterClass.Berserker && pAttacker.currentHealth < pAttacker.stats.maxHealth * 0.3) {
                        log.push({
                            turn, attacker: attacker.name, defender: defender.name, action: 'berserker_frenzy',
                            ...getHealthState(playerState, enemyState)
                        });
                        const { logs: bonusLogs, attackerState, defenderState } = performAttack(pAttacker, defender, turn, gameData, []);
                        log.push(...bonusLogs);
                         if (playerAttacksFirst) {
                            Object.assign(playerState, { currentHealth: attackerState.currentHealth, currentMana: attackerState.currentMana, statusEffects: attackerState.statusEffects, manaSurgeUsed: attackerState.manaSurgeUsed, shadowBoltStacks: attackerState.shadowBoltStacks });
                            Object.assign(enemyState, defenderState);
                        } else {
                            Object.assign(enemyState, attackerState);
                            Object.assign(playerState, defenderState);
                        }
                    }
                }
            }
        }
        
        // --- Defender's Turn (if they weren't first) ---
        if (defender.currentHealth > 0) {
            const isPlayerDefending = 'data' in defender;
            const attacks = isPlayerDefending ? (defender.stats as CharacterStats).attacksPerRound : (defender.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = defender.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);

             if (defender.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: defender.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                for (let i = 0; i < finalAttacks && attacker.currentHealth > 0; i++) {
                    const isWarrior = isPlayerDefending && (defender as any).data.characterClass === CharacterClass.Warrior;

                    const attackerForThisHit = { ...defender };
                    const attackOptions = {};
                    if (isWarrior && i === 0) {
                        attackerForThisHit.stats = { ...attackerForThisHit.stats, critChance: 100 };
                        Object.assign(attackOptions, { ignoreDodge: true });
                    }

                    const { logs: attackLogs, attackerState, defenderState } = performAttack(attackerForThisHit, attacker, turn, gameData, [], false, attackOptions);
                    log.push(...attackLogs);

                    if (playerAttacksFirst) {
                        Object.assign(enemyState, { currentHealth: attackerState.currentHealth, currentMana: attackerState.currentMana, statusEffects: attackerState.statusEffects });
                        Object.assign(playerState, defenderState);
                    } else {
                        Object.assign(playerState, { currentHealth: attackerState.currentHealth, currentMana: attackerState.currentMana, statusEffects: attackerState.statusEffects, manaSurgeUsed: attackerState.manaSurgeUsed, shadowBoltStacks: attackerState.shadowBoltStacks });
                        Object.assign(enemyState, defenderState);
                    }
                }

                // --- Berserker Bonus Attack (Player as Defender/Second Attacker) ---
                if (isPlayerDefending && attacker.currentHealth > 0) {
                    const pDefender = defender as typeof playerState;
                    if (pDefender.data.characterClass === CharacterClass.Berserker && pDefender.currentHealth < pDefender.stats.maxHealth * 0.3) {
                        log.push({
                            turn, attacker: defender.name, defender: attacker.name, action: 'berserker_frenzy',
                            ...getHealthState(playerState, enemyState)
                        });
                        const { logs: bonusLogs, attackerState, defenderState } = performAttack(pDefender, attacker, turn, gameData, []);
                        log.push(...bonusLogs);
                         if (playerAttacksFirst) {
                            Object.assign(enemyState, attackerState);
                            Object.assign(playerState, defenderState);
                        } else {
                            Object.assign(playerState, { currentHealth: attackerState.currentHealth, currentMana: attackerState.currentMana, statusEffects: attackerState.statusEffects, manaSurgeUsed: attackerState.manaSurgeUsed, shadowBoltStacks: attackerState.shadowBoltStacks });
                            Object.assign(enemyState, defenderState);
                        }
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
