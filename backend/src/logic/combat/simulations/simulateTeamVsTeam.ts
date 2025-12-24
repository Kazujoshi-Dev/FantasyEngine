
import { PlayerCharacter, CombatLogEntry, CharacterStats, CharacterClass, GameData, Race } from '../../../types.js';
import { performAttack, AttackerState, DefenderState, StatusEffect } from '../core.js';

interface TeamCombatant {
    data: PlayerCharacter;
    currentHealth: number;
    currentMana: number;
    isDead: boolean;
    statusEffects: StatusEffect[];
    team: 'attacker' | 'defender';
    
    // State flags
    hardSkinTriggered?: boolean;
    manaSurgeUsed?: boolean;
    shadowBoltStacks?: number;
}

export const simulateTeamVsTeamCombat = (
    attackersData: PlayerCharacter[],
    defendersData: PlayerCharacter[],
    gameData: GameData
): { combatLog: CombatLogEntry[], winner: 'attacker' | 'defender', finalPlayers: TeamCombatant[] } => {

    // Check for immediate empty teams (should be handled by Walkower logic in guildRaids, but safe guard here)
    if (attackersData.length === 0) {
        return {
            combatLog: [{
                turn: 0, attacker: 'System', defender: 'System', action: 'walkover', 
                playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0 
            }],
            winner: 'defender',
            finalPlayers: []
        };
    }
    if (defendersData.length === 0) {
        return {
            combatLog: [{
                turn: 0, attacker: 'System', defender: 'System', action: 'walkover', 
                playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0 
            }],
            winner: 'attacker',
            finalPlayers: []
        };
    }

    // 1. Initialize Combatants
    const combatants: TeamCombatant[] = [];

    attackersData.forEach(p => {
        combatants.push({
            data: p,
            currentHealth: p.stats.currentHealth,
            currentMana: p.stats.currentMana,
            isDead: false,
            statusEffects: [],
            team: 'attacker',
            shadowBoltStacks: 0
        });
    });

    defendersData.forEach(p => {
        combatants.push({
            data: p,
            currentHealth: p.stats.currentHealth,
            currentMana: p.stats.currentMana,
            isDead: false,
            statusEffects: [],
            team: 'defender',
            shadowBoltStacks: 0
        });
    });

    const log: CombatLogEntry[] = [];
    let turn = 0;

    // Helper for log snapshot
    const getHealthState = () => ({
        playerHealth: 0, // Placeholder
        playerMana: 0,   // Placeholder
        enemyHealth: 0,  // Placeholder
        enemyMana: 0,    // Placeholder
        allPlayersHealth: combatants.map(c => ({
            name: c.data.name,
            currentHealth: c.currentHealth,
            maxHealth: c.data.stats.maxHealth,
            currentMana: c.currentMana,
            maxMana: c.data.stats.maxMana
        }))
    });
    
    const partyStats: Record<string, CharacterStats> = {};
    combatants.forEach(c => partyStats[c.data.name] = c.data.stats);

    log.push({
        turn: 0,
        attacker: 'Rozpoczęcie',
        defender: 'Bitwy',
        action: 'starts a fight with',
        ...getHealthState(),
        partyMemberStats: partyStats
    });

    // --- 2. Turn 0: Ranged Weapon Logic ---
    // Iterate through all combatants to see who has ranged weapons
    for (const combatant of combatants) {
        if (combatant.isDead) continue; // Skip dead players

        const weapon = combatant.data.equipment?.mainHand || combatant.data.equipment?.twoHand;
        const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

        if (template?.isRanged) {
            // Ranged user gets a free attack on a random living enemy
            const livingEnemies = combatants.filter(c => c.team !== combatant.team && !c.isDead);
            if (livingEnemies.length > 0) {
                const target = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];

                // Create attacker/defender states for performAttack
                const playerAsAttacker: AttackerState & { data: PlayerCharacter } = { ...combatant, stats: combatant.data.stats, name: combatant.data.name };
                const enemyAsDefender: DefenderState = { ...target, stats: target.data.stats, name: target.data.name };

                const attackOptions: { ignoreDodge?: boolean, critChanceOverride?: number } = {};
                if (combatant.data.characterClass === CharacterClass.Warrior) {
                    attackOptions.critChanceOverride = 100;
                    attackOptions.ignoreDodge = true;
                }
                
                // --- Standard Ranged Attack ---
                const { logs: attackLogs, attackerState, defenderState } = performAttack(playerAsAttacker, enemyAsDefender, 0, gameData, []);

                // Update combatant states
                Object.assign(combatant, attackerState);
                Object.assign(target, defenderState);

                log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));
                
                if(target.currentHealth <= 0 && !target.isDead) {
                    target.isDead = true;
                    log.push({ turn: 0, attacker: combatant.data.name, defender: target.data.name, action: 'death', ...getHealthState() });
                }

                // --- Hunter Bonus Attack ---
                if (combatant.data.characterClass === CharacterClass.Hunter && !target.isDead) {
                    const { logs: hunterLogs, defenderState: hunterDefenderState } = performAttack(playerAsAttacker, {...target, stats: target.data.stats, name: target.data.name}, 0, gameData, []);
                    const lastLog = hunterLogs[hunterLogs.length - 1];
                    if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                        const originalDamage = lastLog.damage;
                        const reducedDamage = Math.floor(originalDamage * 0.5);
                        const diff = originalDamage - reducedDamage;
                        lastLog.damage = reducedDamage;
                        hunterDefenderState.currentHealth += diff;
                        lastLog.enemyHealth = hunterDefenderState.currentHealth; // This property is for 1v1, but we can set it for consistency
                        Object.assign(target, hunterDefenderState);
                    }
                    log.push(...hunterLogs.map(l => ({ ...l, ...getHealthState(), action: 'hunter_bonus_shot' })));
                    if (target.currentHealth <= 0 && !target.isDead) {
                        target.isDead = true;
                        log.push({ turn: 0, attacker: combatant.data.name, defender: target.data.name, action: 'death', ...getHealthState() });
                    }
                }
            }
        }
    }

    // --- 3. Main Combat Loop ---
    while (
        combatants.some(c => c.team === 'attacker' && !c.isDead) && 
        combatants.some(c => c.team === 'defender' && !c.isDead) && 
        turn < 100
    ) {
        turn++;
        
        // --- Initiative Phase ---
        // Filter living, sort by agility
        const activeQueue = combatants
            .filter(c => !c.isDead)
            .sort((a, b) => {
                 // Elf bonus turn 1
                 if (turn === 1) {
                     const aElf = a.data.race === Race.Elf;
                     const bElf = b.data.race === Race.Elf;
                     if (aElf && !bElf) return -1; // a comes first
                     if (!aElf && bElf) return 1;  // b comes first
                 }
                 return b.data.stats.agility - a.data.stats.agility;
            });

        for (const actor of activeQueue) {
            if (actor.isDead) continue; // Could have died from DoT or AoE earlier in turn

            // --- Turn Start (Regen, DoTs) ---
            if (actor.data.stats.manaRegen > 0) {
                actor.currentMana = Math.min(actor.data.stats.maxMana, actor.currentMana + actor.data.stats.manaRegen);
            }
            
            // --- Status Resistance Logic (Dwarves) ---
            const isDwarfResistant = actor.data.race === Race.Dwarf && actor.data.learnedSkills?.includes('bedrock-foundation');
            const reduction = isDwarfResistant ? 2 : 1;
            
            actor.statusEffects = actor.statusEffects
                .map(e => ({...e, duration: e.duration - reduction}))
                .filter(e => e.duration > 0);
            
            // --- Action ---
            // 1. Find Potential Targets (Living enemies)
            const targets = combatants.filter(c => c.team !== actor.team && !c.isDead);
            if (targets.length === 0) break; // Fight over

            // 2. Select Target (Random for now, could implement aggro later)
            const target = targets[Math.floor(Math.random() * targets.length)];

            // 3. Execute Attacks
            const isFrozen = actor.statusEffects.some(e => e.type === 'frozen_no_attack');
            if (isFrozen) {
                log.push({ turn, attacker: actor.data.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
                continue;
            }

            // Shaman Power
            if (actor.data.characterClass === CharacterClass.Shaman && actor.currentMana > 0) {
                 const dmg = Math.floor(actor.currentMana);
                 target.currentHealth = Math.max(0, target.currentHealth - dmg);
                 log.push({ turn, attacker: actor.data.name, defender: target.data.name, action: 'shaman_power', damage: dmg, ...getHealthState() });
                 if (target.currentHealth <= 0) {
                     target.isDead = true;
                     log.push({ turn, attacker: actor.data.name, defender: target.data.name, action: 'death', ...getHealthState() });
                     if (targets.length === 1) break; // Last enemy died
                     // Re-select target if current died
                     const newTargets = combatants.filter(c => c.team !== actor.team && !c.isDead);
                     if (newTargets.length === 0) break;
                 }
            }

            const attacks = actor.data.stats.attacksPerRound || 1;
            const reducedAttacks = actor.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, Math.floor(attacks - reducedAttacks));

            for (let i = 0; i < finalAttacks; i++) {
                // Re-check target life (could die from thorns or multi-hit)
                let currentTarget = target;
                if (currentTarget.isDead) {
                     const newTargets = combatants.filter(c => c.team !== actor.team && !c.isDead);
                     if (newTargets.length === 0) break;
                     currentTarget = newTargets[Math.floor(Math.random() * newTargets.length)];
                }

                const attackerState: AttackerState & { data: PlayerCharacter } = {
                    stats: actor.data.stats,
                    currentHealth: actor.currentHealth,
                    currentMana: actor.currentMana,
                    name: actor.data.name,
                    hardSkinTriggered: actor.hardSkinTriggered,
                    manaSurgeUsed: actor.manaSurgeUsed,
                    shadowBoltStacks: actor.shadowBoltStacks,
                    statusEffects: actor.statusEffects,
                    data: actor.data
                };

                const defenderState: DefenderState = {
                    stats: currentTarget.data.stats,
                    currentHealth: currentTarget.currentHealth,
                    currentMana: currentTarget.currentMana,
                    name: currentTarget.data.name,
                    hardSkinTriggered: currentTarget.hardSkinTriggered,
                    statusEffects: currentTarget.statusEffects,
                    data: currentTarget.data
                };

                const attackOptions = {};
                if (actor.data.characterClass === CharacterClass.Warrior && i === 0) {
                    attackerState.stats = { ...attackerState.stats, critChance: 100 };
                    Object.assign(attackOptions, { ignoreDodge: true });
                }

                // We pass ALL enemies as potential AoE targets
                const enemyTeamStates: DefenderState[] = combatants
                    .filter(c => c.team !== actor.team && !c.isDead && c !== currentTarget)
                    .map(c => ({
                        stats: c.data.stats,
                        currentHealth: c.currentHealth,
                        currentMana: c.currentMana,
                        name: c.data.name,
                        statusEffects: c.statusEffects,
                        data: c.data
                    }));

                const { logs, attackerState: postAttacker, defenderState: postDefender, aoeData, chainData } = performAttack(
                    attackerState, defenderState, turn, gameData, enemyTeamStates, false, attackOptions
                );

                // Sync State Back
                actor.currentHealth = postAttacker.currentHealth;
                actor.currentMana = postAttacker.currentMana;
                actor.statusEffects = postAttacker.statusEffects;
                actor.manaSurgeUsed = postAttacker.manaSurgeUsed;
                actor.shadowBoltStacks = postAttacker.shadowBoltStacks;

                currentTarget.currentHealth = postDefender.currentHealth;
                currentTarget.currentMana = postDefender.currentMana;
                currentTarget.statusEffects = postDefender.statusEffects;
                currentTarget.hardSkinTriggered = postDefender.hardSkinTriggered;

                log.push(...logs.map(l => ({ ...l, ...getHealthState() })));

                if (currentTarget.currentHealth <= 0) {
                    currentTarget.isDead = true;
                    log.push({ turn, attacker: actor.data.name, defender: currentTarget.data.name, action: 'death', ...getHealthState() });
                }
                
                // --- Handle AoE Logic (Earthquake, Meteor) ---
                if (aoeData) {
                     const splashTargets = combatants.filter(c => c.team !== actor.team && !c.isDead && c !== currentTarget);
                     const splashDamageDetails: { target: string, damage: number }[] = [];
                     let splashDamage = 0;
                     
                     if (aoeData.type === 'earthquake') splashDamage = Math.floor(aoeData.baseDamage * aoeData.splashPercent);
                     if (aoeData.type === 'meteor_swarm') splashDamage = Math.floor(aoeData.baseDamage);

                     splashTargets.forEach(t => {
                         t.currentHealth = Math.max(0, t.currentHealth - splashDamage);
                         splashDamageDetails.push({ target: t.data.name, damage: splashDamage });
                         if (t.currentHealth <= 0) {
                             t.isDead = true;
                             log.push({ turn, attacker: actor.data.name, defender: t.data.name, action: 'death', ...getHealthState() });
                         }
                     });

                     if (splashDamageDetails.length > 0) {
                        const effectName = aoeData.type === 'earthquake' ? 'earthquakeSplash' : 'meteorSwarmSplash';
                        log.push({ 
                            turn, 
                            attacker: actor.data.name, 
                            defender: 'Enemies', 
                            action: 'effectApplied', 
                            effectApplied: effectName, 
                            damage: splashDamage, 
                            aoeDamage: splashDamageDetails,
                            ...getHealthState() 
                        });
                    }
                }

                // --- Handle Chain Lightning ---
                 if (chainData && chainData.type === 'chain_lightning') {
                    const potentialTargets = combatants.filter(c => c.team !== actor.team && !c.isDead && c !== currentTarget);
                    let jumps = 0;
                    const chainDamageDetails: { target: string, damage: number }[] = [];
                    let currentChainDamage = chainData.damage;

                    while(jumps < chainData.maxJumps && potentialTargets.length > 0) {
                        if (Math.random() * 100 < chainData.chance) {
                            currentChainDamage = Math.floor(currentChainDamage * 0.75);
                             if (currentChainDamage < 1) currentChainDamage = 1;
                             
                             const jumpTargetIndexLocal = Math.floor(Math.random() * potentialTargets.length);
                             const jumpTarget = potentialTargets[jumpTargetIndexLocal];
                             
                             jumpTarget.currentHealth = Math.max(0, jumpTarget.currentHealth - currentChainDamage);
                             chainDamageDetails.push({ target: jumpTarget.data.name, damage: currentChainDamage });
                             
                             if (jumpTarget.currentHealth <= 0) {
                                 jumpTarget.isDead = true;
                                 log.push({ turn, attacker: actor.data.name, defender: jumpTarget.data.name, action: 'death', ...getHealthState() });
                             }

                             potentialTargets.splice(jumpTargetIndexLocal, 1);
                             jumps++;
                        } else break;
                    }
                    if (chainDamageDetails.length > 0) {
                        log.push({ turn, attacker: actor.data.name, defender: 'Enemies', action: 'effectApplied', effectApplied: 'chainLightningJump', aoeDamage: chainDamageDetails, ...getHealthState() });
                    }
                 }
            }
            
            // Berserker Bonus
             if (actor.data.characterClass === CharacterClass.Berserker && actor.currentHealth < actor.data.stats.maxHealth * 0.3 && !actor.isDead) {
                 // Find target
                 const targets = combatants.filter(c => c.team !== actor.team && !c.isDead);
                 if (targets.length > 0) {
                     const target = targets[Math.floor(Math.random() * targets.length)];
                     log.push({ turn, attacker: actor.data.name, defender: target.data.name, action: 'berserker_frenzy', ...getHealthState() });
                     
                     // Reconstruct detailed Attacker/Defender states for performAttack
                     const attackerState: AttackerState & { data: PlayerCharacter } = {
                        stats: actor.data.stats,
                        currentHealth: actor.currentHealth,
                        currentMana: actor.currentMana,
                        name: actor.data.name,
                        hardSkinTriggered: actor.hardSkinTriggered,
                        manaSurgeUsed: actor.manaSurgeUsed,
                        shadowBoltStacks: actor.shadowBoltStacks,
                        statusEffects: actor.statusEffects,
                        data: actor.data
                    };
                    const defenderState: DefenderState = {
                        stats: target.data.stats,
                        currentHealth: target.currentHealth,
                        currentMana: target.currentMana,
                        name: target.data.name,
                        hardSkinTriggered: target.hardSkinTriggered,
                        statusEffects: target.statusEffects,
                        data: target.data
                    };

                    // Pass empty enemy list as AoE is not typically triggered on bonus attacks (simplification)
                    const { logs } = performAttack(attackerState, defenderState, turn, gameData, []);
                    
                    actor.currentHealth = attackerState.currentHealth;
                    actor.currentMana = attackerState.currentMana;
                    target.currentHealth = defenderState.currentHealth;
                    log.push(...logs.map(l => ({...l, ...getHealthState()})));

                    if (target.currentHealth <= 0) {
                        target.isDead = true;
                        log.push({ turn, attacker: actor.data.name, defender: target.data.name, action: 'death', ...getHealthState() });
                    }
                 }
             }
        }
    }

    const winner = combatants.some(c => c.team === 'attacker' && !c.isDead) ? 'attacker' : 'defender';

    // --- Post-Combat Logic: Druid Heal ---
    // Apply 50% max HP heal to surviving winners of class Druid
    combatants.forEach(combatant => {
        if (combatant.team === winner && !combatant.isDead && combatant.data.characterClass === CharacterClass.Druid) {
            const maxHealth = combatant.data.stats.maxHealth;
            const healAmount = Math.floor(maxHealth * 0.5);
            combatant.currentHealth = Math.min(maxHealth, combatant.currentHealth + healAmount);
        }
    });
    
    return { combatLog: log, winner, finalPlayers: combatants };
};
