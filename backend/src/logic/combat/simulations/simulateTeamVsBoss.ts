
import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData, SpecialAttackType } from '../../../types.js';
import { performAttack, AttackerState, DefenderState, StatusEffect } from '../core.js';

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
        hardSkinTriggered: false,
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
        enemyStats: bossState.stats as EnemyStats, 
        enemyDescription: bossData.description,
        partyMemberStats: partyStats
    });
    
    // --- 2. Turn 0: Ranged Weapon Logic ---
    for (const player of playersState) {
        const weapon = player.data.equipment?.mainHand || player.data.equipment?.twoHand;
        const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;
        
        if (template?.isRanged && bossState.currentHealth > 0) {
             const playerAsAttacker: AttackerState & { data: PlayerCharacter } = { ...player, stats: player.data.stats, name: player.data.name };
             const bossAsDefender: DefenderState = { ...bossState, stats: bossState.stats, name: bossState.name };
             
             const attackOptions: { ignoreDodge?: boolean, critChanceOverride?: number } = {};
             if (player.data.characterClass === CharacterClass.Warrior) {
                 attackOptions.critChanceOverride = 100;
                 attackOptions.ignoreDodge = true;
             }
             const { logs: attackLogs, attackerState, defenderState } = performAttack(playerAsAttacker, bossAsDefender, 0, gameData, [], false, attackOptions);
             
             Object.assign(player, attackerState);
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
                 log.push(...hunterLogs.map(l => ({ ...l, ...getHealthStateForLog(), action: 'hunter_bonus_shot' })));
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

        // --- 3.2. Boss Special Attacks (Lair Actions) ---
        if (bossState.currentHealth > 0) {
            for (const special of (bossData.specialAttacks || [])) {
                if (bossState.specialAttacksUsed[special.type] < special.uses && Math.random() * 100 < special.chance) {
                    const livingTargets = playersState.filter(p => !p.isDead);
                    if (livingTargets.length === 0) continue;
                    
                    bossState.specialAttacksUsed[special.type]++;
                    
                    // Okrzyk
                    log.push({
                        turn, 
                        attacker: bossState.name, 
                        defender: 'Team', 
                        action: 'boss_shout', 
                        shout: special.type, 
                        ...getHealthStateForLog()
                    });

                    // Efekt natychmiastowy
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
                            break;
                        }
                    }
                    break; // Tylko jeden atak specjalny na runda
                }
            }
        }
        
        // Sprawdzenie zgonów po ataku specjalnym
        playersState.forEach(p => {
            if (!p.isDead && p.currentHealth <= 0) {
                p.isDead = true;
                log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() });
            }
        });
        
        // --- 3.3. Standard Combat Phase ---
        interface ActionEntity {
            type: 'player' | 'boss';
            index: number;
            name: string;
            agility: number;
        }

        const actionQueue: ActionEntity[] = [];
        playersState.forEach((p, index) => {
            if (!p.isDead) {
                actionQueue.push({ type: 'player', index, name: p.data.name, agility: p.data.stats.agility });
            }
        });

        if (bossState.currentHealth > 0) {
            actionQueue.push({ type: 'boss', index: -1, name: bossState.name, agility: (bossState.stats as EnemyStats).agility });
        }

        actionQueue.sort((a, b) => {
            if (turn === 1) {
                const isAElf = a.type === 'player' && playersState[a.index].data.race === Race.Elf;
                const isBElf = b.type === 'player' && playersState[b.index].data.race === Race.Elf;
                if (isAElf && !isBElf) return -1;
                if (!isAElf && isBElf) return 1;
            }
            if (b.agility !== a.agility) return b.agility - a.agility;
            return a.type === 'player' ? -1 : 1;
        });

        for (const actor of actionQueue) {
            if (bossState.currentHealth <= 0) break;

            if (actor.type === 'player') {
                const player = playersState[actor.index];
                if (player.isDead) continue;

                if (player.data.characterClass === CharacterClass.Shaman && player.currentMana > 0) {
                    const shamanDamage = Math.floor(player.currentMana);
                    bossState.currentHealth = Math.max(0, bossState.currentHealth - shamanDamage);
                    log.push({ turn, attacker: player.data.name, defender: bossState.name, action: 'shaman_power', damage: shamanDamage, ...getHealthStateForLog() });
                    if (bossState.currentHealth <= 0) break;
                }

                if (player.statusEffects.some(e => e.type === 'stunned')) continue;

                const attacks = player.data.stats.attacksPerRound;
                for (let i = 0; i < attacks; i++) {
                    if (bossState.currentHealth <= 0) break;
                    let playerAsAttacker: AttackerState & {data: PlayerCharacter} = { ...player, stats: player.data.stats, name: player.data.name };
                    const attackOptions = {};
                    if (player.data.characterClass === CharacterClass.Warrior && i === 0) {
                        playerAsAttacker.stats = { ...playerAsAttacker.stats, critChance: 100 };
                        Object.assign(attackOptions, { ignoreDodge: true });
                    }
                    const { logs, attackerState, defenderState } = performAttack(playerAsAttacker, { ...bossState, stats: bossState.stats, name: bossState.name }, turn, gameData, [], false, attackOptions);
                    Object.assign(player, attackerState);
                    Object.assign(bossState, defenderState);
                    log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));
                }
                
                if (player.data.characterClass === CharacterClass.Berserker && player.currentHealth < player.data.stats.maxHealth * 0.3 && bossState.currentHealth > 0) {
                     log.push({ turn, attacker: player.data.name, defender: bossState.name, action: 'berserker_frenzy', ...getHealthStateForLog() });
                     const { logs, attackerState, defenderState } = performAttack({ ...player, stats: player.data.stats, name: player.data.name }, { ...bossState, stats: bossState.stats, name: bossState.name }, turn, gameData, []);
                     Object.assign(player, attackerState);
                     Object.assign(bossState, defenderState);
                     log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));
                }

            } else {
                const bossAttacks = (bossState.stats as EnemyStats).attacksPerTurn || 1;
                for (let i = 0; i < bossAttacks; i++) {
                    const livingTargets = playersState.filter(p => !p.isDead);
                    if (livingTargets.length === 0) break;
                    
                    const targetPlayer = livingTargets[Math.floor(Math.random() * livingTargets.length)];
                    const targetIndex = playersState.findIndex(p => p.data.id === targetPlayer.data.id);
                    const targetAsDefender: DefenderState = {
                        stats: playersState[targetIndex].data.stats, name: playersState[targetIndex].data.name,
                        currentHealth: playersState[targetIndex].currentHealth, currentMana: playersState[targetIndex].currentMana,
                        statusEffects: playersState[targetIndex].statusEffects, hardSkinTriggered: playersState[targetIndex].hardSkinTriggered,
                        data: playersState[targetIndex].data
                    };
                    const otherTargets = livingTargets.filter(p => p.data.id !== targetPlayer.data.id).map(p => ({
                        stats: p.data.stats, currentHealth: p.currentHealth, currentMana: p.currentMana,
                        name: p.data.name, statusEffects: p.statusEffects, data: p.data, uniqueId: String(p.data.id)
                    }));

                    const { logs, attackerState, defenderState, aoeData, chainData } = performAttack({ ...bossState }, targetAsDefender, turn, gameData, otherTargets, true);
                    bossState = { ...bossState, ...attackerState };
                    Object.assign(playersState[targetIndex], defenderState);
                    log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));

                    if (aoeData) {
                        const otherPlayers = playersState.filter((p, idx) => idx !== targetIndex && !p.isDead);
                        const splashDetails: { target: string, damage: number }[] = [];
                        let splashDmg = aoeData.type === 'earthquake' ? Math.floor(aoeData.baseDamage * aoeData.splashPercent) : Math.floor(aoeData.baseDamage);
                        otherPlayers.forEach(p => {
                            p.currentHealth = Math.max(0, p.currentHealth - splashDmg);
                            splashDetails.push({ target: p.data.name, damage: splashDmg });
                            if (p.currentHealth <= 0) { p.isDead = true; log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() }); }
                        });
                        if (splashDetails.length > 0) {
                            log.push({ turn, attacker: bossState.name, defender: 'Drużyna', action: 'effectApplied', effectApplied: aoeData.type === 'earthquake' ? 'earthquakeSplash' : 'meteorSwarmSplash', damage: splashDmg, aoeDamage: splashDetails, ...getHealthStateForLog() });
                        }
                    }
                }
            }
        }

        playersState.forEach(p => {
            if (!p.isDead && p.currentHealth <= 0) {
                p.isDead = true;
                log.push({ turn, attacker: bossState.name, defender: p.data.name, action: 'death', ...getHealthStateForLog() });
            }
        });

        if (bossState.currentHealth <= 0) {
            log.push({ turn, attacker: 'Drużyna', defender: bossState.name, action: 'enemy_death', ...getHealthStateForLog() });
            break;
        }
    }

    return { combatLog: log, finalPlayers: playersState };
};
