import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData, SpecialAttackType, BossSpecialAttack } from '../../types.js';
import { performAttack, AttackerState, DefenderState, getFullWeaponName, StatusEffect } from './core.js';

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
        playerStats: playerState.stats as CharacterStats, enemyStats: enemyState.stats, enemyDescription: enemyState.description
    });
    
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
        enemyHealth: 0, enemyMana: 0, 
        playerStats: playerState.stats as CharacterStats,
        allEnemiesHealth: enemiesState.map(e => ({ uniqueId: e.uniqueId, name: e.name, currentHealth: e.currentHealth, maxHealth: e.stats.maxHealth }))
    });

    while (playerState.currentHealth > 0 && enemiesState.some(e => e.currentHealth > 0) && turn < 100) {
        turn++;
        
        const getHealthState = () => ({
            playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
            enemyHealth: 0, // Not applicable in 1vMany
            enemyMana: 0,
            allEnemiesHealth: enemiesState.map(e => ({ uniqueId: e.uniqueId, name: e.name, currentHealth: e.currentHealth, maxHealth: e.stats.maxHealth }))
        });

        // --- Shaman Class Power ---
        if (playerData.characterClass === CharacterClass.Shaman && turn > 0) {
            const livingEnemies = enemiesState.filter(e => e.currentHealth > 0);
            if (livingEnemies.length > 0) {
                const damage = Math.floor(playerState.currentMana);
                if (damage > 0) {
                    const target = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
                    const targetIndex = enemiesState.findIndex(e => e.uniqueId === target.uniqueId);
                    
                    enemiesState[targetIndex].currentHealth = Math.max(0, enemiesState[targetIndex].currentHealth - damage);
                    log.push({
                        turn,
                        attacker: playerState.name,
                        defender: enemiesState[targetIndex].name,
                        action: 'shaman_power',
                        damage,
                        ...getHealthState()
                    });
                     if (enemiesState[targetIndex].currentHealth <= 0) {
                        log.push({ turn, attacker: playerState.name, defender: enemiesState[targetIndex].name, action: 'enemy_death', ...getHealthState() });
                    }
                }
            }
        }

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
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burningTarget', damage: burnDamage, ...getHealthState() });
            }
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        // Player's turn
        const attacks = (playerState.stats as CharacterStats).attacksPerRound;
        const reducedAttacks = playerState.statusEffects.filter(e => e.type === 'reduced_attacks').length;
        const finalPlayerAttacks = Math.max(1, attacks - reducedAttacks);

        if (playerState.statusEffects.some(e => e.type === 'frozen_no_attack')) {
            log.push({ turn, attacker: playerState.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
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

                // Handle AoE for METEOR SWARM
                if (aoeData?.type === 'meteor_swarm') {
                    const aoeDamage = aoeData.baseDamage;
                    livingEnemies.filter(e => e.uniqueId !== target.uniqueId).forEach(otherEnemy => {
                        const healthBefore = otherEnemy.currentHealth;
                        otherEnemy.currentHealth = Math.max(0, otherEnemy.currentHealth - aoeDamage);
                        log.push({ 
                            turn, 
                            attacker: playerState.name, 
                            defender: otherEnemy.name, 
                            action: 'effectApplied', 
                            effectApplied: 'meteorSwarmSplash',
                            damage: aoeDamage, 
                            ...getHealthState() 
                        });
                        if (otherEnemy.currentHealth <= 0 && healthBefore > 0) {
                            log.push({ turn, attacker: playerState.name, defender: otherEnemy.name, action: 'enemy_death', ...getHealthState() });
                        }
                    });
                }
                
                // Handle AoE for EARTHQUAKE
                if (aoeData?.type === 'earthquake') {
                    const splashDamage = Math.floor(aoeData.baseDamage * aoeData.splashPercent);
                    livingEnemies.filter(e => e.uniqueId !== target.uniqueId).forEach(otherEnemy => {
                        const healthBefore = otherEnemy.currentHealth;
                        otherEnemy.currentHealth = Math.max(0, otherEnemy.currentHealth - splashDamage);
                        log.push({ turn, attacker: playerState.name, defender: otherEnemy.name, action: 'effectApplied', effectApplied: 'earthquakeSplash', damage: splashDamage, ...getHealthState() });
                        if (otherEnemy.currentHealth <= 0 && healthBefore > 0) {
                            log.push({ turn, attacker: playerState.name, defender: otherEnemy.name, action: 'enemy_death', ...getHealthState() });
                        }
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
                        const healthBefore = chainTarget.currentHealth;
                        chainTarget.currentHealth = Math.max(0, chainTarget.currentHealth - chainDamage);
                        log.push({ turn, attacker: playerState.name, defender: chainTarget.name, action: 'effectApplied', effectApplied: 'chainLightningJump', damage: chainDamage, ...getHealthState() });
                        if (chainTarget.currentHealth <= 0 && healthBefore > 0) {
                            log.push({ turn, attacker: playerState.name, defender: chainTarget.name, action: 'enemy_death', ...getHealthState() });
                        }
                    }
                }

                if (defenderState.currentHealth <= 0 && healthBeforeAttack > 0) {
                    log.push({ turn, attacker: playerState.name, defender: defenderState.name, action: 'enemy_death', ...getHealthState() });
                }
            }
        }

        // Enemies' turn
        for (const enemy of enemiesState.filter(e => e.currentHealth > 0)) {
            if (playerState.currentHealth <= 0) break;

            const attacks = (enemy.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = enemy.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalEnemyAttacks = Math.max(1, attacks - reducedAttacks);

            if (enemy.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: enemy.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
            } else {
                for(let i = 0; i < finalEnemyAttacks; i++) {
                    const { logs: enemyLogs, attackerState: enemyAttacker, defenderState: playerDefender } = performAttack(enemy, playerState, turn, gameData, []);
                    
                    const enemyIndex = enemiesState.findIndex(e => e.uniqueId === (enemyAttacker as any).uniqueId);
                    if (enemyIndex !== -1) {
                        enemiesState[enemyIndex] = enemyAttacker as any;
                    }

                    playerState = playerDefender;
                    log.push(...enemyLogs);
                }
            }
        }
    }

    // Ensure all logs have the final health states for accurate display
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
    let playersState: TeamCombatPlayerState[] = playersData.map(p => ({
        data: p,
        currentHealth: p.stats.currentHealth,
        currentMana: p.stats.currentMana,
        isDead: p.stats.currentHealth <= 0,
        statusEffects: [],
    }));

    let bossState: AttackerState & { description?: string; specialAttacksUsed: Record<string, number> } = {
        stats: enemyData.stats,
        currentHealth: enemyData.stats.maxHealth,
        currentMana: enemyData.stats.maxMana || 0,
        name: enemyData.name,
        description: enemyData.description,
        statusEffects: [],
        specialAttacksUsed: {},
    };
    (enemyData.specialAttacks || []).forEach(sa => { bossState.specialAttacksUsed[sa.type] = 0; });

    const log: CombatLogEntry[] = [];
    let turn = 0;

    const getHealthStateForLog = () => ({
        playerHealth: 0, // Not directly applicable for individual log entries
        playerMana: 0,
        enemyHealth: bossState.currentHealth,
        enemyMana: bossState.currentMana,
        allPlayersHealth: playersState.map(p => ({ name: p.data.name, currentHealth: p.currentHealth, maxHealth: p.data.stats.maxHealth }))
    });

    log.push({
        turn, attacker: 'Drużyna', defender: bossState.name, action: 'starts a fight with',
        ...getHealthStateForLog(), playerStats: playersData[0]?.stats, enemyStats: bossState.stats, enemyDescription: bossState.description
    });
    
    // Hunter Bonus Attack (Turn 0)
    for (const player of playersState) {
        const weapon = player.data.equipment.mainHand || player.data.equipment.twoHand;
        const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
        if (player.data.characterClass === CharacterClass.Hunter && template?.isRanged) {
             const playerAsAttacker: AttackerState = { ...player, stats: player.data.stats, name: player.data.name };
             const bossAsDefender: DefenderState = { ...bossState, stats: bossState.stats, name: bossState.name };
             const { logs: attackLogs, defenderState } = performAttack(playerAsAttacker, bossAsDefender, 0, gameData, [], false, {});
             
             const lastLog = attackLogs[attackLogs.length - 1];
             // CRITICAL FIX: Only apply damage reduction if the attack was not a dodge and dealt damage.
             if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                const reducedDamage = Math.floor(lastLog.damage * 0.5);
                const damageDiff = lastLog.damage - reducedDamage;
                bossState.currentHealth = defenderState.currentHealth + damageDiff;
                lastLog.damage = reducedDamage;
             }
             log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));
        }
    }

    while (playersState.some(p => !p.isDead) && bossState.currentHealth > 0 && turn < 100) {
        turn++;
        
        // --- Turn Start & Mana Regen ---
        const allCombatants: any[] = [...playersState.filter(p => !p.isDead), bossState];
        for (const combatant of allCombatants) {
            const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0 && combatant.currentMana < (combatant.stats.maxMana || 0)) {
                combatant.currentMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
            }
            combatant.statusEffects = combatant.statusEffects.map((e: StatusEffect) => ({...e, duration: e.duration - 1})).filter((e: StatusEffect) => e.duration > 0);
        }
        
        // --- Players' Turn ---
        const livingPlayers = playersState.filter(p => !p.isDead);
        for (const player of livingPlayers) {
            if (bossState.currentHealth <= 0) break;
            
            const stunEffectIndex = player.statusEffects.findIndex(e => e.type === 'stunned');
            if (stunEffectIndex > -1) {
                player.statusEffects.splice(stunEffectIndex, 1); // Stun is consumed
                log.push({ turn, attacker: bossState.name, defender: player.data.name, action: 'specialAttackLog', specialAttackType: SpecialAttackType.Stun, stunnedPlayer: player.data.name, ...getHealthStateForLog() });
                continue; // Skip this player's turn
            }

            const playerAsAttacker: AttackerState = { ...player, stats: player.data.stats, name: player.data.name };
            const bossAsDefender: DefenderState = { ...bossState, stats: bossState.stats, name: bossState.name };
            
            const attacks = player.data.stats.attacksPerRound;
            for (let i = 0; i < attacks; i++) {
                if (bossState.currentHealth <= 0) break;
                
                let attackOptions = {};
                if (i === 0 && player.data.characterClass === CharacterClass.Warrior) {
                    playerAsAttacker.stats = { ...playerAsAttacker.stats, critChance: 100 };
                }

                const { logs, attackerState, defenderState } = performAttack(playerAsAttacker, bossAsDefender, turn, gameData, [], false, attackOptions);
                
                if (i === 0 && player.data.characterClass === CharacterClass.Warrior) {
                    playerAsAttacker.stats = player.data.stats;
                }

                player.currentHealth = attackerState.currentHealth;
                player.currentMana = attackerState.currentMana;
                bossState.currentHealth = defenderState.currentHealth;
                
                log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));
            }
            
            if (player.data.characterClass === CharacterClass.Berserker && player.currentHealth < player.data.stats.maxHealth * 0.3) {
                 if (bossState.currentHealth > 0) {
                     const { logs, attackerState, defenderState } = performAttack(playerAsAttacker, bossAsDefender, turn, gameData, []);
                     player.currentHealth = attackerState.currentHealth;
                     player.currentMana = attackerState.currentMana;
                     bossState.currentHealth = defenderState.currentHealth;
                     log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));
                 }
            }
        }
        
        if (bossState.currentHealth <= 0) {
            log.push({ turn, attacker: 'Drużyna', defender: bossState.name, action: 'enemy_death', ...getHealthStateForLog() });
            break;
        }
        
        // --- Boss's Turn ---
        let bossUsedSpecial = false;
        for (const special of (enemyData.specialAttacks || [])) {
            if (bossState.specialAttacksUsed[special.type] < special.uses && Math.random() * 100 < special.chance) {
                bossUsedSpecial = true;
                bossState.specialAttacksUsed[special.type]++;

                const livingTargets = playersState.filter(p => !p.isDead);
                if (livingTargets.length === 0) continue;
                const randomTarget = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                const randomTargetIndex = playersState.findIndex(p => p.data.id === randomTarget.data.id);
                
                switch(special.type) {
                    case SpecialAttackType.Stun:
                        log.push({ turn, attacker: bossState.name, defender: randomTarget.data.name, action: 'specialAttackLog', specialAttackType: special.type, ...getHealthStateForLog() });
                        randomTarget.statusEffects.push({ type: 'stunned', duration: 2 });
                        break;
                    case SpecialAttackType.ArmorPierce:
                        const { logs: apLogs, defenderState: apDefender } = performAttack({ ...bossState }, { ...randomTarget, stats: randomTarget.data.stats, name: randomTarget.data.name }, turn, gameData, [], true, { ignoreArmor: true });
                        playersState[randomTargetIndex].currentHealth = apDefender.currentHealth;
                        log.push(...apLogs.map(l => ({...l, ...getHealthStateForLog()})));
                        break;
                    case SpecialAttackType.DeathTouch:
                        randomTarget.currentHealth = Math.floor(randomTarget.currentHealth / 2);
                        log.push({ turn, attacker: bossState.name, defender: randomTarget.data.name, action: 'specialAttackLog', specialAttackType: SpecialAttackType.DeathTouch, ...getHealthStateForLog() });
                        break;
                    case SpecialAttackType.EmpoweredStrikes:
                        bossState.isEmpowered = true;
                        log.push({ turn, attacker: bossState.name, defender: '', action: 'specialAttackLog', specialAttackType: special.type, ...getHealthStateForLog() });
                        break;
                    case SpecialAttackType.Earthquake:
                        playersState.forEach(p => {
                            if (!p.isDead) p.currentHealth = Math.max(0, p.currentHealth - Math.floor(p.data.stats.maxHealth * 0.2));
                        });
                        log.push({ turn, attacker: bossState.name, defender: 'Drużyna', action: 'specialAttackLog', specialAttackType: special.type, ...getHealthStateForLog() });
                        break;
                }
                break; 
            }
        }
        
        if (!bossUsedSpecial) {
            const livingTargets = playersState.filter(p => !p.isDead);
            if (livingTargets.length > 0) {
                const bossAttacks = (bossState.stats as EnemyStats).attacksPerTurn || 1;
                for (let i = 0; i < bossAttacks; i++) {
                    if (playersState.every(p => p.isDead)) break;
                    
                    const targetPlayer = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                    const bossAsAttacker: AttackerState = { ...bossState };
                    const playerAsDefender: DefenderState = { ...targetPlayer, stats: targetPlayer.data.stats, name: targetPlayer.data.name };

                    const { logs: attackLogs, defenderState } = performAttack(bossAsAttacker, playerAsDefender, turn, gameData, []);
                    
                    const targetIndex = playersState.findIndex(p => p.data.id === targetPlayer.data.id);
                    if (targetIndex !== -1) {
                        const targetToUpdate = playersState[targetIndex];
                        targetToUpdate.currentHealth = defenderState.currentHealth;
                        targetToUpdate.currentMana = defenderState.currentMana;
                        targetToUpdate.statusEffects = defenderState.statusEffects;
                    }
                    log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));
                }
            }
        }

        // Check for player deaths after boss turn
        playersState.forEach(p => {
            if (!p.isDead && p.currentHealth <= 0) {
                p.isDead = true;
                log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() });
            }
        });
    }

    // Final state update for logs
    log.forEach(l => {
        const states = getHealthStateForLog();
        l.allPlayersHealth = states.allPlayersHealth;
        l.enemyHealth = states.enemyHealth;
        l.enemyMana = states.enemyMana;
        const playerInLog = playersState.find(p => p.data.name === l.attacker || p.data.name === l.defender);
        if (playerInLog) {
            l.playerMana = playerInLog.currentMana;
        }
    });

    return { combatLog: log, finalPlayers: playersState };
};