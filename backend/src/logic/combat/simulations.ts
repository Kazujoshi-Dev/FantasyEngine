import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData, SpecialAttackType, BossSpecialAttack } from '../../types.js';
import { performAttack, AttackerState, DefenderState, getFullWeaponName } from './core.js';

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
    
    let enemyState: AttackerState & {description?: string} = {
        stats: enemyData.stats,
        currentHealth: enemyData.stats.maxHealth,
        currentMana: enemyData.stats.maxMana || 0,
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
        playerStats: playerState.stats, enemyStats: enemyState.stats, enemyDescription: enemyState.description
    });
    
    let playerAttacksFirst = (playerData.race === Race.Elf) || (playerState.stats.agility >= enemyState.stats.agility);

    while (playerState.currentHealth > 0 && enemyState.currentHealth > 0 && turn < 100) {
        turn++;
        
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
                    log.push({ turn, attacker: combatant.name, defender: '', action: 'manaRegen', manaGained } as CombatLogEntry);
                }
            }
            // Burning Effect
            const burningEffect = combatant.statusEffects.find(e => e.type === 'burning');
            if (burningEffect) {
                const burnDamage = Math.floor(combatant.stats.maxHealth * 0.05);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - burnDamage);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burning', damage: burnDamage } as CombatLogEntry);
            }
            // Decrement status effect durations
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        const attacker = playerAttacksFirst ? playerState : enemyState;
        const defender = playerAttacksFirst ? enemyState : playerState;

        // --- Attacker's Turn ---
        if (attacker.currentHealth > 0) {
            const attacks = attacker.stats.attacksPerTurn || 1;
            const reducedAttacks = attacker.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);
            
            if (attacker.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack' } as CombatLogEntry);
            } else {
                 for (let i = 0; i < finalAttacks && defender.currentHealth > 0; i++) {
                    const { logs: attackLogs, attackerState, defenderState } = performAttack(attacker, defender, turn, gameData, []);
                    log.push(...attackLogs);
                    Object.assign(attacker, attackerState);
                    Object.assign(defender, defenderState);
                }
            }
        }
        
        // --- Defender's Turn (if they weren't first) ---
        if (defender.currentHealth > 0) {
            const attacks = defender.stats.attacksPerTurn || 1;
            const reducedAttacks = defender.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);

             if (defender.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: defender.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack' } as CombatLogEntry);
            } else {
                for (let i = 0; i < finalAttacks && attacker.currentHealth > 0; i++) {
                    const { logs: attackLogs, attackerState, defenderState } = performAttack(defender, attacker, turn, gameData, []);
                    log.push(...attackLogs);
                    Object.assign(defender, attackerState);
                    Object.assign(attacker, defenderState);
                }
            }
        }

        playerAttacksFirst = playerState.stats.agility >= enemyState.stats.agility;
    }
    
    return log;
};


// ==========================================================================================
//                                   1 vs MANY COMBAT
// ==========================================================================================
export const simulate1vManyCombat = (playerData: PlayerCharacter, enemiesData: Enemy[], gameData: GameData): { combatLog: CombatLogEntry[] } => {
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
    
    const nameCounts = new Map<string, number>();
    enemiesData.forEach(e => { nameCounts.set(e.name, (nameCounts.get(e.name) || 0) + 1); });
    const currentNameInstances = new Map<string, number>();
    let enemiesState: (AttackerState & { uniqueId: string })[] = enemiesData.map(e => {
        let finalName = e.name;
        if ((nameCounts.get(e.name) || 0) > 1) {
            const instanceCount = (currentNameInstances.get(e.name) || 0) + 1;
            currentNameInstances.set(e.name, instanceCount);
            finalName = `${e.name} ${instanceCount}`;
        }
        return {
            stats: e.stats, currentHealth: e.stats.maxHealth, currentMana: e.stats.maxMana || 0,
            name: finalName, uniqueId: e.uniqueId!, hardSkinTriggered: false, shadowBoltStacks: 0, statusEffects: []
        };
    });

    const log: CombatLogEntry[] = [];
    let turn = 0;
    
    log.push({
        turn, attacker: playerState.name, defender: 'Grupa wrogów', action: 'starts a fight with',
        playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
        enemyHealth: 0, enemyMana: 0, playerStats: playerState.stats,
        allEnemiesHealth: enemiesState.map(e => ({ uniqueId: e.uniqueId, name: e.name, currentHealth: e.currentHealth, maxHealth: e.stats.maxHealth }))
    });

    while (playerState.currentHealth > 0 && enemiesState.some(e => e.currentHealth > 0) && turn < 100) {
        turn++;
        
        // --- Turn Start Effects & Mana Regen for all combatants ---
        const allCombatants: (AttackerState | (AttackerState & { uniqueId: string }))[] = [playerState, ...enemiesState.filter(e => e.currentHealth > 0)];
        for(const combatant of allCombatants) {
             const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0) {
                const newMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
                if (newMana > combatant.currentMana) combatant.currentMana = newMana;
            }
            const burningEffect = combatant.statusEffects.find(e => e.type === 'burning');
            if (burningEffect) {
                const burnDamage = Math.floor(combatant.stats.maxHealth * 0.05);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - burnDamage);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burning', damage: burnDamage } as CombatLogEntry);
            }
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        // Player's turn
        const attacks = playerState.stats.attacksPerRound || 1;
        const reducedAttacks = playerState.statusEffects.filter(e => e.type === 'reduced_attacks').length;
        const finalPlayerAttacks = Math.max(1, attacks - reducedAttacks);

        if (playerState.statusEffects.some(e => e.type === 'frozen_no_attack')) {
            log.push({ turn, attacker: playerState.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack' } as CombatLogEntry);
        } else {
            for (let i = 0; i < finalPlayerAttacks; i++) {
                const livingEnemies = enemiesState.filter(e => e.currentHealth > 0);
                if (livingEnemies.length === 0) break;
                
                const target = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
                const targetIndex = enemiesState.findIndex(e => e.uniqueId === target.uniqueId);
                const healthBeforeAttack = target.currentHealth;

                const { logs: attackLogs, attackerState, defenderState, aoeData, chainData } = performAttack(playerState, target, turn, gameData, livingEnemies);
                
                playerState = attackerState;
                enemiesState[targetIndex] = { ...enemiesState[targetIndex], ...defenderState };
                
                log.push(...attackLogs);

                // Handle AoE
                if (aoeData?.type === 'earthquake') {
                    const splashDamage = Math.floor(aoeData.baseDamage * aoeData.splashPercent);
                    livingEnemies.filter(e => e.uniqueId !== target.uniqueId).forEach(otherEnemy => {
                        otherEnemy.currentHealth = Math.max(0, otherEnemy.currentHealth - splashDamage);
                        log.push({ turn, attacker: playerState.name, defender: otherEnemy.name, action: 'effectApplied', effectApplied: 'earthquakeSplash', damage: splashDamage } as CombatLogEntry);
                    });
                }
                if (chainData?.type === 'chain_lightning' && Math.random() * 100 < chainData.chance) {
                    let chainedTargets = [target.uniqueId];
                    for (let j = 0; j < chainData.maxJumps; j++) {
                        const potentialTargets = livingEnemies.filter(e => !chainedTargets.includes(e.uniqueId));
                        if (potentialTargets.length === 0) break;

                        const chainTarget = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                        chainedTargets.push(chainTarget.uniqueId);
                        
                        const chainDamage = Math.floor(chainData.damage * 0.75); // Chain hits are weaker
                        chainTarget.currentHealth = Math.max(0, chainTarget.currentHealth - chainDamage);
                        log.push({ turn, attacker: playerState.name, defender: chainTarget.name, action: 'effectApplied', effectApplied: 'chainLightningJump', damage: chainDamage } as CombatLogEntry);
                    }
                }

                if (defenderState.currentHealth <= 0 && healthBeforeAttack > 0) {
                    log.push({ turn, defender: defenderState.name, action: 'enemy_death' } as CombatLogEntry);
                }
            }
        }

        // Enemies' turn
        for (const enemy of enemiesState.filter(e => e.currentHealth > 0)) {
            if (playerState.currentHealth <= 0) break;

            const attacks = enemy.stats.attacksPerTurn || 1;
            const reducedAttacks = enemy.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalEnemyAttacks = Math.max(1, attacks - reducedAttacks);

            if (enemy.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: enemy.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack' } as CombatLogEntry);
            } else {
                for(let i = 0; i < finalEnemyAttacks; i++) {
                    const { logs: enemyLogs, attackerState: enemyAttacker, defenderState: playerDefender } = performAttack(enemy, playerState, turn, gameData, []);
                    Object.assign(enemy, enemyAttacker);
                    playerState = playerDefender;
                    log.push(...enemyLogs);
                }
            }
        }
    }

    log.forEach(l => {
        l.playerHealth = playerState.currentHealth;
        l.playerMana = playerState.currentMana;
        l.allEnemiesHealth = enemiesState.map(e => ({ uniqueId: e.uniqueId, name: e.name, currentHealth: e.currentHealth, maxHealth: e.stats.maxHealth }))
    });
    
    return { combatLog: log };
};

export const simulateTeamVsBossCombat = (
    playersData: PlayerCharacter[], 
    enemyData: Enemy, 
    gameData: GameData
): { combatLog: CombatLogEntry[], finalPlayers: TeamCombatPlayerState[] } => {
    // This logic is complex and will be moved here from hunting.ts later if needed.
    // For now, the expedition logic is the primary focus.
    return { combatLog: [], finalPlayers: [] };
};