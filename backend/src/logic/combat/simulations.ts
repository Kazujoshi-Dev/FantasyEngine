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

    log.push({
        turn, attacker: 'Drużyna', defender: bossState.name, action: 'starts a fight with',
        ...getHealthStateForLog(), playerStats: playersData[0]?.stats, enemyStats: bossState.stats, enemyDescription: bossData.description
    });
    
    // --- 2. Turn 0: Hunter Bonus Attack ---
    for (const player of playersState) {
        // FIX: Optional chaining to prevent crash if equipment is missing.
        const weapon = player.data.equipment?.mainHand || player.data.equipment?.twoHand;
        const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;
        if (player.data.characterClass === CharacterClass.Hunter && template?.isRanged) {
             const playerAsAttacker: AttackerState = { ...player, stats: player.data.stats, name: player.data.name };
             const bossAsDefender: DefenderState = { ...bossState, stats: bossState.stats, name: bossState.name };
             const { logs: attackLogs, defenderState } = performAttack(playerAsAttacker, bossAsDefender, 0, gameData, []);
             
             const lastLog = attackLogs[attackLogs.length - 1];
             if (lastLog?.damage !== undefined && !lastLog.isDodge) {
                const reducedDamage = Math.floor(lastLog.damage * 0.5);
                bossState.currentHealth = defenderState.currentHealth + (lastLog.damage - reducedDamage);
                lastLog.damage = reducedDamage;
             }
             log.push(...attackLogs.map(l => ({...l, ...getHealthStateForLog()})));
        }
    }

    // --- 3. Main Combat Loop ---
    while (playersState.some(p => !p.isDead) && bossState.currentHealth > 0 && turn < 100) {
        turn++;
        
        // --- 3.1. Start of Turn Phase ---
        const allCombatants: any[] = [...playersState.filter(p => !p.isDead), bossState];
        for (const combatant of allCombatants) {
            // Fix for mixed types (Player vs Boss) - correctly extract stats
            const stats = combatant.stats || (combatant.data ? combatant.data.stats : undefined);

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
                playersState[playerIndex].statusEffects.splice(stunIndex, 1);
                log.push({ turn, attacker: bossState.name, defender: player.data.name, action: 'specialAttackLog', specialAttackType: SpecialAttackType.Stun, stunnedPlayer: player.data.name, ...getHealthStateForLog() });
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
                bossUsedSpecial = true;
                bossState.specialAttacksUsed[special.type]++;
                const livingTargets = playersState.filter(p => !p.isDead);
                if (livingTargets.length === 0) continue;
                
                switch(special.type) {
                    case SpecialAttackType.Stun: {
                        const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                        const targetIndex = playersState.findIndex(p => p.data.id === target.data.id);
                        playersState[targetIndex].statusEffects.push({ type: 'stunned', duration: 2 });
                        log.push({ turn, attacker: bossState.name, defender: target.data.name, action: 'specialAttackLog', specialAttackType: special.type, ...getHealthStateForLog() });
                        break;
                    }
                    case SpecialAttackType.Earthquake: {
                        playersState.forEach(p => {
                            if (!p.isDead) p.currentHealth = Math.max(0, p.currentHealth - Math.floor(p.data.stats.maxHealth * 0.2));
                        });
                        log.push({ turn, attacker: bossState.name, defender: 'Drużyna', action: 'specialAttackLog', specialAttackType: special.type, ...getHealthStateForLog() });
                        break;
                    }
                    // Implement other special attacks similarly...
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