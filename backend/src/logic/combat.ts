
import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../types.js';
import { getGrammaticallyCorrectFullName } from './items.js';

interface CombatState {
    player: { stats: CharacterStats, currentHealth: number, currentMana: number, name: string, hardSkinTriggered: boolean };
    enemy: { stats: EnemyStats, currentHealth: number, currentMana: number, name: string, description?: string, hardSkinTriggered: boolean };
    log: CombatLogEntry[];
    turn: number;
}

const getFullWeaponName = (playerData: PlayerCharacter, gameData: GameData): string | undefined => {
    const weaponInstance = playerData.equipment.mainHand || playerData.equipment.twoHand;
    if (weaponInstance) {
        const template = gameData.itemTemplates.find(t => t.id === weaponInstance.templateId);
        if (template) {
            return getGrammaticallyCorrectFullName(weaponInstance, template, gameData.affixes);
        }
    }
    return undefined; 
};

// Existing single player combat simulation (kept for backward compatibility and single expeditions)
export const simulateCombat = (playerData: PlayerCharacter, enemyData: Enemy, gameData: GameData): CombatLogEntry[] => {
    const state: CombatState = {
        player: {
            stats: playerData.stats,
            currentHealth: playerData.stats.currentHealth,
            currentMana: playerData.stats.currentMana,
            name: playerData.name,
            hardSkinTriggered: false
        },
        enemy: {
            stats: enemyData.stats,
            currentHealth: enemyData.stats.maxHealth,
            currentMana: enemyData.stats.maxMana || 0,
            name: enemyData.name,
            description: enemyData.description,
            hardSkinTriggered: false
        },
        log: [],
        turn: 0
    };
    
    state.log.push({
        turn: state.turn,
        attacker: state.player.name,
        defender: state.enemy.name,
        action: 'starts a fight with',
        playerHealth: state.player.currentHealth,
        playerMana: state.player.currentMana,
        enemyHealth: state.enemy.currentHealth,
        enemyMana: state.enemy.currentMana,
        playerStats: state.player.stats,
        enemyStats: state.enemy.stats,
        enemyDescription: state.enemy.description
    });
    
    const weaponName = getFullWeaponName(playerData, gameData);
    
    // ... (Previous turn 0 logic remains the same, abbreviated for brevity but assume it's here) ...
     // Turn 0 attacks for ranged weapons
    const weapon = playerData.equipment.mainHand || playerData.equipment.twoHand;
    const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
    if (template && template.isRanged) {
        let universalDamage = Math.floor(Math.random() * (state.player.stats.maxDamage - state.player.stats.minDamage + 1)) + state.player.stats.minDamage;
        const universalArmorReduction = Math.min(universalDamage, Math.floor(state.enemy.stats.armor));
        universalDamage = Math.max(0, universalDamage - universalArmorReduction);
        state.enemy.currentHealth = Math.max(0, state.enemy.currentHealth - universalDamage);

        state.log.push({
            turn: state.turn,
            attacker: state.player.name,
            defender: state.enemy.name,
            action: 'attacks',
            damage: universalDamage,
            damageReduced: universalArmorReduction > 0 ? universalArmorReduction : undefined,
            weaponName: weaponName,
            playerHealth: state.player.currentHealth,
            playerMana: state.player.currentMana,
            enemyHealth: state.enemy.currentHealth,
            enemyMana: state.enemy.currentMana,
        });
         // Hunter's *additional* Turn 0 Ranged Attack
        if (playerData.characterClass === CharacterClass.Hunter && state.enemy.currentHealth > 0) {
            let hunterDamage = Math.floor(Math.random() * (state.player.stats.maxDamage - state.player.stats.minDamage + 1)) + state.player.stats.minDamage;
            hunterDamage = Math.floor(hunterDamage * 0.5);
            const hunterArmorReduction = Math.min(hunterDamage, Math.floor(state.enemy.stats.armor));
            hunterDamage = Math.max(0, hunterDamage - hunterArmorReduction);
            state.enemy.currentHealth = Math.max(0, state.enemy.currentHealth - hunterDamage);

            state.log.push({
                turn: state.turn,
                attacker: state.player.name,
                defender: state.enemy.name,
                action: 'attacks',
                damage: hunterDamage,
                damageReduced: hunterArmorReduction > 0 ? hunterArmorReduction : undefined,
                weaponName: weaponName,
                playerHealth: state.player.currentHealth,
                playerMana: state.player.currentMana,
                enemyHealth: state.enemy.currentHealth,
                enemyMana: state.enemy.currentMana,
            });
        }
    }


    let playerAttacksFirst = state.player.stats.agility >= state.enemy.stats.agility;
    if (playerData.race === Race.Elf) {
        playerAttacksFirst = true;
    }

    while (state.player.currentHealth > 0 && state.enemy.currentHealth > 0 && state.turn < 100) {
        state.turn++;
        const attackers = playerAttacksFirst ? ['player', 'enemy'] : ['enemy', 'player'];

        for (const attackerType of attackers) {
            if (state.player.currentHealth <= 0 || state.enemy.currentHealth <= 0) break;

            if (attackerType === 'player') {
                 // Shaman Class Bonus
                if (playerData.characterClass === CharacterClass.Shaman && state.player.currentMana > 0) {
                    const shamanDamage = state.player.currentMana;
                    state.enemy.currentHealth = Math.max(0, state.enemy.currentHealth - shamanDamage);
                    state.log.push({
                        turn: state.turn,
                        attacker: state.player.name,
                        defender: state.enemy.name,
                        action: 'shaman_power',
                        damage: shamanDamage,
                        playerHealth: state.player.currentHealth,
                        playerMana: state.player.currentMana,
                        enemyHealth: state.enemy.currentHealth,
                        enemyMana: state.enemy.currentMana,
                    });
                }
                 // Player mana regen
                const manaToRegen = state.player.stats.manaRegen;
                if (manaToRegen > 0) {
                    const newMana = Math.min(state.player.stats.maxMana, state.player.currentMana + manaToRegen);
                    if (newMana > state.player.currentMana) {
                        state.log.push({
                            turn: state.turn,
                            attacker: state.player.name,
                            defender: state.enemy.name,
                            action: 'manaRegen',
                            manaGained: newMana - state.player.currentMana,
                            playerHealth: state.player.currentHealth,
                            playerMana: newMana,
                            enemyHealth: state.enemy.currentHealth,
                            enemyMana: state.enemy.currentMana
                        });
                        state.player.currentMana = newMana;
                    }
                }
                
                for (let i = 0; i < state.player.stats.attacksPerRound; i++) {
                     if (state.enemy.currentHealth <= 0) break;
                     performAttack(state, 'player', gameData, playerData, weaponName);
                }

            } else {
                 // Enemy mana regen
                const enemyManaToRegen = state.enemy.stats.manaRegen || 0;
                if (enemyManaToRegen > 0) {
                    const newMana = Math.min(state.enemy.stats.maxMana || 0, state.enemy.currentMana + enemyManaToRegen);
                    if (newMana > state.enemy.currentMana) {
                        state.log.push({
                            turn: state.turn,
                            attacker: state.enemy.name,
                            defender: state.player.name,
                            action: 'manaRegen',
                            manaGained: newMana - state.enemy.currentMana,
                            playerHealth: state.player.currentHealth,
                            playerMana: state.player.currentMana,
                            enemyHealth: state.enemy.currentHealth,
                            enemyMana: newMana
                        });
                         state.enemy.currentMana = newMana;
                    }
                }
                
                for (let i = 0; i < (state.enemy.stats.attacksPerTurn || 1); i++) {
                    if (state.player.currentHealth <= 0) break;
                    performAttack(state, 'enemy', gameData, playerData);
                }
            }
        }
        playerAttacksFirst = state.player.stats.agility >= state.enemy.stats.agility;
    }
    
    return state.log;
};


const performAttack = (state: CombatState, attackerType: 'player' | 'enemy', gameData: GameData, playerData: PlayerCharacter, weaponName?: string) => {
    // 1. Explicitly define attacker and defender roles
    const isPlayerAttacking = attackerType === 'player';
    const attacker = isPlayerAttacking ? state.player : state.enemy;
    const defender = isPlayerAttacking ? state.enemy : state.player;
    
    const attackerStats = attacker.stats;
    const defenderStats = defender.stats;

    // 2. Dodge Check
    const dodgeChance = 'dodgeChance' in defenderStats ? defenderStats.dodgeChance : 0;
    if (Math.random() * 100 < dodgeChance) {
        state.log.push({
            turn: state.turn,
            attacker: attacker.name,
            defender: defender.name,
            action: 'dodge',
            isDodge: true,
            playerHealth: state.player.currentHealth,
            playerMana: state.player.currentMana,
            enemyHealth: state.enemy.currentHealth,
            enemyMana: state.enemy.currentMana,
        });
        return;
    }

    let damage = 0;
    let isCrit = false;
    let damageReduced = 0;
    let healthGained = 0;
    let manaGained = 0;
    let magicAttackType: MagicAttackType | undefined = undefined;
    let useMagicAttack = false;

    // 3. Determine Attack Type (Magic vs. Physical)
    if (isPlayerAttacking) {
        const weapon = playerData.equipment.mainHand || playerData.equipment.twoHand;
        const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
        if (template && template.isMagical && template.magicAttackType) {
            const manaCost = template.manaCost ? (template.manaCost.min + template.manaCost.max) / 2 : 0;
            if (attacker.currentMana >= manaCost) {
                useMagicAttack = true;
                magicAttackType = template.magicAttackType;
                attacker.currentMana -= manaCost;
            } else {
                 state.log.push({
                    turn: state.turn,
                    attacker: attacker.name,
                    defender: defender.name,
                    action: 'notEnoughMana',
                    playerHealth: state.player.currentHealth,
                    playerMana: state.player.currentMana,
                    enemyHealth: state.enemy.currentHealth,
                    enemyMana: state.enemy.currentMana,
                });
            }
        }
    } else { // Enemy attack
        const enemyStats = attackerStats as EnemyStats;
        const manaCost = enemyStats.magicAttackManaCost || 0;
        const willUseMagic = Math.random() * 100 < (enemyStats.magicAttackChance || 0);
        if (willUseMagic && attacker.currentMana >= manaCost) {
            useMagicAttack = true;
            magicAttackType = enemyStats.magicAttackType;
            attacker.currentMana -= manaCost;
        }
    }
    
    // 4. Calculate Damage
    if (useMagicAttack) {
        const magicDmgMin = attackerStats.magicDamageMin || 0;
        const magicDmgMax = attackerStats.magicDamageMax || 0;
        damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;

        // Mage/Wizard crit logic
        if (isPlayerAttacking && (playerData.characterClass === CharacterClass.Mage || playerData.characterClass === CharacterClass.Wizard)) {
            if (Math.random() * 100 < attackerStats.critChance) {
                isCrit = true;
                damage = Math.floor(damage * ((attackerStats as CharacterStats).critDamageModifier / 100));
            }
        }
    } else { // Physical attack
        damage = Math.floor(Math.random() * (attackerStats.maxDamage - attackerStats.minDamage + 1)) + attackerStats.minDamage;

        // Crit logic
        if (Math.random() * 100 < attackerStats.critChance) {
            isCrit = true;
            const critModifier = 'critDamageModifier' in attackerStats && attackerStats.critDamageModifier ? attackerStats.critDamageModifier : 200;
            damage = Math.floor(damage * (critModifier / 100));
        }

        // Twarda skóra (Hard Skin) skill check for defender
        if (isCrit) {
            if (!isPlayerAttacking) { // Defender is the player
                if ((playerData.learnedSkills || []).includes('twarda-skora-1') && !defender.hardSkinTriggered) {
                    const reduction = Math.floor(damage * 0.5);
                    damage -= reduction;
                    damageReduced += reduction;
                    defender.hardSkinTriggered = true; 
                }
            }
        }

        // Armor reduction
        const armorPenPercent = 'armorPenetrationPercent' in attackerStats ? attackerStats.armorPenetrationPercent : 0;
        const armorPenFlat = 'armorPenetrationFlat' in attackerStats ? attackerStats.armorPenetrationFlat : 0;
        const effectiveArmor = Math.max(0, defenderStats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
        const armorReduction = Math.min(damage, Math.floor(effectiveArmor));
        damage -= armorReduction;
        damageReduced += armorReduction;
    }
    
    // 5. Apply Race/Class specific damage modifiers
    if (isPlayerAttacking && playerData.race === Race.Orc && attacker.currentHealth < attacker.stats.maxHealth * 0.25) {
        damage = Math.floor(damage * 1.25);
    }
    if (!isPlayerAttacking && playerData.race === Race.Dwarf && defender.currentHealth < defender.stats.maxHealth * 0.5) {
        const reduction = Math.floor(damage * 0.20);
        damage -= reduction;
        damageReduced += reduction;
    }

    // 6. Apply Lifesteal/Manasteal (only for players for now)
    if (isPlayerAttacking) {
        const playerStats = attackerStats as CharacterStats;
        const lifeStealAmount = Math.floor(damage * (playerStats.lifeStealPercent / 100)) + playerStats.lifeStealFlat;
        if (lifeStealAmount > 0) {
            const newHealth = Math.min(playerStats.maxHealth, attacker.currentHealth + lifeStealAmount);
            healthGained = newHealth - attacker.currentHealth;
            attacker.currentHealth = newHealth;
        }

        const manaStealAmount = Math.floor(damage * (playerStats.manaStealPercent / 100)) + playerStats.manaStealFlat;
        if (manaStealAmount > 0) {
            const newMana = Math.min(playerStats.maxMana, attacker.currentMana + manaStealAmount);
            manaGained = newMana - attacker.currentMana;
            attacker.currentMana = newMana;
        }
    }
    
    // 7. Apply damage and update state
    defender.currentHealth = Math.max(0, defender.currentHealth - damage);

    if (isPlayerAttacking) {
        state.player.currentHealth = attacker.currentHealth;
        state.player.currentMana = attacker.currentMana;
        state.enemy.currentHealth = defender.currentHealth;
    } else {
        state.enemy.currentHealth = attacker.currentHealth;
        state.enemy.currentMana = attacker.currentMana;
        state.player.currentHealth = defender.currentHealth;
    }

    state.log.push({
        turn: state.turn,
        attacker: attacker.name,
        defender: defender.name,
        action: useMagicAttack ? 'magicAttack' : 'attacks',
        damage,
        isCrit,
        damageReduced: damageReduced > 0 ? damageReduced : undefined,
        healthGained: healthGained > 0 ? healthGained : undefined,
        manaGained: manaGained > 0 ? manaGained : undefined,
        magicAttackType,
        weaponName: isPlayerAttacking ? weaponName : undefined,
        playerHealth: state.player.currentHealth,
        playerMana: state.player.currentMana,
        enemyHealth: state.enemy.currentHealth,
        enemyMana: state.enemy.currentMana,
    });
};


// ==========================================================================================
//                                   TEAM COMBAT LOGIC
// ==========================================================================================

interface TeamCombatPlayerState {
    data: PlayerCharacter;
    stats: CharacterStats;
    currentHealth: number;
    currentMana: number;
    hardSkinTriggered: boolean;
    isDead: boolean;
}

interface TeamCombatState {
    players: TeamCombatPlayerState[];
    enemy: { stats: EnemyStats, currentHealth: number, currentMana: number, name: string, description?: string, hardSkinTriggered: boolean };
    log: CombatLogEntry[];
    turn: number;
}

export const simulateTeamCombat = (playersData: PlayerCharacter[], enemyData: Enemy, gameData: GameData): CombatLogEntry[] => {
    // Scale boss health based on player count to make it challenging but fair
    const healthMultiplier = 1 + (playersData.length - 1) * 0.7; // e.g., 1 player = 1x, 5 players = 3.8x
    
    const state: TeamCombatState = {
        players: playersData.map(p => ({
            data: p,
            stats: p.stats,
            currentHealth: p.stats.currentHealth,
            currentMana: p.stats.currentMana,
            hardSkinTriggered: false,
            isDead: false
        })),
        enemy: {
            stats: { ...enemyData.stats, maxHealth: Math.floor(enemyData.stats.maxHealth * healthMultiplier) },
            currentHealth: Math.floor(enemyData.stats.maxHealth * healthMultiplier),
            currentMana: enemyData.stats.maxMana || 0,
            name: enemyData.name,
            description: enemyData.description,
            hardSkinTriggered: false
        },
        log: [],
        turn: 0
    };

    state.log.push({
        turn: 0,
        attacker: 'Team',
        defender: state.enemy.name,
        action: 'starts a fight with',
        playerHealth: 0, // Irrelevant for start message
        playerMana: 0,
        enemyHealth: state.enemy.currentHealth,
        enemyMana: state.enemy.currentMana,
        enemyStats: state.enemy.stats,
        enemyDescription: `Boss Multiplier: x${healthMultiplier.toFixed(1)}`
    });

    while (state.enemy.currentHealth > 0 && state.players.some(p => !p.isDead) && state.turn < 200) {
        state.turn++;

        // Players Turn
        for (const playerState of state.players) {
            if (playerState.isDead || state.enemy.currentHealth <= 0) continue;
            
            // Perform all attacks for the player
            for (let i = 0; i < (playerState.stats.attacksPerRound || 1); i++) {
                 if (state.enemy.currentHealth <= 0) break;
                 performTeamAttack(state, playerState, gameData);
            }
        }
        
        // Boss Turn
        if (state.enemy.currentHealth > 0) {
            // Boss performs all its attacks, picking a potentially new random target for each
            const totalBossAttacks = state.enemy.stats.attacksPerTurn || 1;
            for (let i = 0; i < totalBossAttacks; i++) {
                 const alivePlayers = state.players.filter(p => !p.isDead);
                 if (alivePlayers.length === 0) break;
                 
                 // Boss attacks random player
                 const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                 performTeamAttack(state, target, gameData, true);
            }
        }
    }

    return state.log;
}

const performTeamAttack = (
    state: TeamCombatState, 
    activePlayer: TeamCombatPlayerState, // When player attacks, this is attacker. When boss attacks, this is defender.
    gameData: GameData, 
    isBossAttacking: boolean = false
) => {
    
    // Setup temporary state object compatible with performAttack function logic structure
    const attacker = isBossAttacking ? state.enemy : activePlayer;
    const defender = isBossAttacking ? activePlayer : state.enemy;
    const attackerStats = isBossAttacking ? state.enemy.stats : activePlayer.stats;
    const defenderStats = isBossAttacking ? activePlayer.stats : state.enemy.stats;

    // Dodge Check
    const dodgeChance = 'dodgeChance' in defenderStats ? (defenderStats as CharacterStats).dodgeChance : 0;
    if (Math.random() * 100 < dodgeChance) {
        state.log.push({
            turn: state.turn,
            attacker: attacker === state.enemy ? attacker.name : (attacker as TeamCombatPlayerState).data.name,
            defender: defender === state.enemy ? defender.name : (defender as TeamCombatPlayerState).data.name,
            action: 'dodge',
            isDodge: true,
            // Capture state of specific player involved
            playerHealth: activePlayer.currentHealth, 
            playerMana: activePlayer.currentMana,
            enemyHealth: state.enemy.currentHealth,
            enemyMana: state.enemy.currentMana,
        });
        return;
    }

    let damage = 0;
    let isCrit = false;
    let damageReduced = 0;
    let healthGained = 0;
    let manaGained = 0;
    let magicAttackType: MagicAttackType | undefined = undefined;
    let useMagicAttack = false;
    const weaponName = !isBossAttacking ? getFullWeaponName(activePlayer.data, gameData) : undefined;

     // Determine Attack Type & Calc Damage
     if (!isBossAttacking) {
         const weapon = activePlayer.data.equipment.mainHand || activePlayer.data.equipment.twoHand;
         const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
         if (template && template.isMagical && template.magicAttackType) {
             const manaCost = template.manaCost ? (template.manaCost.min + template.manaCost.max) / 2 : 0;
             if (activePlayer.currentMana >= manaCost) {
                 useMagicAttack = true;
                 magicAttackType = template.magicAttackType;
                 activePlayer.currentMana -= manaCost;
             }
         }

         if (useMagicAttack) {
            const magicDmgMin = activePlayer.stats.magicDamageMin || 0;
            const magicDmgMax = activePlayer.stats.magicDamageMax || 0;
            damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;
             if ((activePlayer.data.characterClass === CharacterClass.Mage || activePlayer.data.characterClass === CharacterClass.Wizard)) {
                 if (Math.random() * 100 < activePlayer.stats.critChance) {
                     isCrit = true;
                     damage = Math.floor(damage * (activePlayer.stats.critDamageModifier / 100));
                 }
             }
         } else {
             damage = Math.floor(Math.random() * (activePlayer.stats.maxDamage - activePlayer.stats.minDamage + 1)) + activePlayer.stats.minDamage;
             if (Math.random() * 100 < activePlayer.stats.critChance) {
                 isCrit = true;
                 damage = Math.floor(damage * (activePlayer.stats.critDamageModifier / 100));
             }
             // Boss Armor Reduction
             const armorPenPercent = activePlayer.stats.armorPenetrationPercent || 0;
             const armorPenFlat = activePlayer.stats.armorPenetrationFlat || 0;
             const effectiveArmor = Math.max(0, state.enemy.stats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
             const reduction = Math.min(damage, Math.floor(effectiveArmor));
             damage -= reduction;
             damageReduced += reduction;
         }
         
         // Lifesteal/Manasteal for player
         const ls = Math.floor(damage * (activePlayer.stats.lifeStealPercent / 100)) + activePlayer.stats.lifeStealFlat;
         if(ls > 0) {
             activePlayer.currentHealth = Math.min(activePlayer.stats.maxHealth, activePlayer.currentHealth + ls);
             healthGained = ls;
         }
         const ms = Math.floor(damage * (activePlayer.stats.manaStealPercent / 100)) + activePlayer.stats.manaStealFlat;
         if(ms > 0) {
             activePlayer.currentMana = Math.min(activePlayer.stats.maxMana, activePlayer.currentMana + ms);
             manaGained = ms;
         }

     } else {
         // Boss attacking player
         const bossStats = state.enemy.stats;
         const manaCost = bossStats.magicAttackManaCost || 0;
         const willUseMagic = Math.random() * 100 < (bossStats.magicAttackChance || 0);
         if (willUseMagic && state.enemy.currentMana >= manaCost) {
             useMagicAttack = true;
             magicAttackType = bossStats.magicAttackType;
             state.enemy.currentMana -= manaCost;
         }

         if (useMagicAttack) {
            const magicDmgMin = bossStats.magicDamageMin || 0;
            const magicDmgMax = bossStats.magicDamageMax || 0;
            damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;
         } else {
             damage = Math.floor(Math.random() * (bossStats.maxDamage - bossStats.minDamage + 1)) + bossStats.minDamage;
             if (Math.random() * 100 < bossStats.critChance) {
                 isCrit = true;
                 damage = Math.floor(damage * ((bossStats.critDamageModifier || 150) / 100));
             }
             
             // Player Armor Reduction
             const reduction = Math.min(damage, Math.floor(activePlayer.stats.armor));
             damage -= reduction;
             damageReduced += reduction;
         }
     }

    // Apply Damage
    if (!isBossAttacking) {
        state.enemy.currentHealth = Math.max(0, state.enemy.currentHealth - damage);
    } else {
        activePlayer.currentHealth = Math.max(0, activePlayer.currentHealth - damage);
        if (activePlayer.currentHealth <= 0) activePlayer.isDead = true;
    }

    state.log.push({
        turn: state.turn,
        attacker: attacker === state.enemy ? attacker.name : (attacker as TeamCombatPlayerState).data.name,
        defender: defender === state.enemy ? defender.name : (defender as TeamCombatPlayerState).data.name,
        action: useMagicAttack ? 'magicAttack' : 'attacks',
        damage,
        isCrit,
        damageReduced: damageReduced > 0 ? damageReduced : undefined,
        healthGained: healthGained > 0 ? healthGained : undefined,
        manaGained: manaGained > 0 ? manaGained : undefined,
        magicAttackType,
        weaponName,
        playerHealth: activePlayer.currentHealth,
        playerMana: activePlayer.currentMana,
        enemyHealth: state.enemy.currentHealth,
        enemyMana: state.enemy.currentMana,
        playerStats: !isBossAttacking ? activePlayer.stats : undefined // Pass stats on attack so UI can update
    });
}
