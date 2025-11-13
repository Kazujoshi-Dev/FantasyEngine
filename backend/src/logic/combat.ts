import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../types.js';

interface CombatState {
    player: { stats: CharacterStats, currentHealth: number, currentMana: number, name: string };
    enemy: { stats: EnemyStats, currentHealth: number, currentMana: number, name: string, description?: string };
    log: CombatLogEntry[];
    turn: number;
}

const getEquippedWeaponName = (playerData: PlayerCharacter, gameData: GameData): string | undefined => {
    const weaponInstance = playerData.equipment.mainHand || playerData.equipment.twoHand;
    if (weaponInstance) {
        const template = gameData.itemTemplates.find(t => t.id === weaponInstance.templateId);
        return template?.name;
    }
    return undefined; 
};

export const simulateCombat = (playerData: PlayerCharacter, enemyData: Enemy, gameData: GameData): CombatLogEntry[] => {
    const state: CombatState = {
        player: {
            stats: playerData.stats,
            currentHealth: playerData.stats.currentHealth,
            currentMana: playerData.stats.currentMana,
            name: playerData.name
        },
        enemy: {
            stats: enemyData.stats,
            currentHealth: enemyData.stats.maxHealth,
            currentMana: enemyData.stats.maxMana || 0,
            name: enemyData.name,
            description: enemyData.description,
        },
        log: [],
        turn: 0
    };
    
    // Log the start of the fight
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
    
    const weaponName = getEquippedWeaponName(playerData, gameData);

    let playerAttacksFirst = state.player.stats.agility >= state.enemy.stats.agility;
    if (playerData.race === Race.Elf) {
        playerAttacksFirst = true; // Elves always attack first in round 1
    }

    while (state.player.currentHealth > 0 && state.enemy.currentHealth > 0 && state.turn < 100) {
        state.turn++;
        
        const attackers = playerAttacksFirst ? ['player', 'enemy'] : ['enemy', 'player'];

        for (const attackerType of attackers) {
            if (state.player.currentHealth <= 0 || state.enemy.currentHealth <= 0) break;

            if (attackerType === 'player') {
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
                
                // Player attacks
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
                
                // Enemy attacks
                for (let i = 0; i < (state.enemy.stats.attacksPerTurn || 1); i++) {
                    if (state.player.currentHealth <= 0) break;
                    performAttack(state, 'enemy', gameData, playerData);
                }
            }
        }
        
        // After turn 1, agility determines who attacks first
        playerAttacksFirst = state.player.stats.agility >= state.enemy.stats.agility;
    }
    
    return state.log;
};


const performAttack = (state: CombatState, attackerType: 'player' | 'enemy', gameData: GameData, playerData: PlayerCharacter, weaponName?: string) => {
    // 1. Explicitly define attacker and defender references
    const isPlayerAttacking = attackerType === 'player';
    const attacker = isPlayerAttacking ? state.player : state.enemy;
    const defender = isPlayerAttacking ? state.enemy : state.player;

    // 2. Dodge check
    const dodgeChance = !isPlayerAttacking ? (defender.stats as CharacterStats).dodgeChance : 0; // Enemies don't dodge
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

    // 3. Magic Attack Logic
    if (isPlayerAttacking) {
        const weapon = playerData.equipment.mainHand || playerData.equipment.twoHand;
        const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
        if (template && template.isMagical && template.magicAttackType) {
            const manaCost = template.manaCost ? (template.manaCost.min + template.manaCost.max) / 2 : 0;
            if (attacker.currentMana >= manaCost) {
                useMagicAttack = true;
                magicAttackType = template.magicAttackType;
                attacker.currentMana -= manaCost;

                const magicDmgMin = (attacker.stats as CharacterStats).magicDamageMin || 0;
                const magicDmgMax = (attacker.stats as CharacterStats).magicDamageMax || 0;
                damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;

                if (playerData.characterClass === CharacterClass.Mage || playerData.characterClass === CharacterClass.Wizard) {
                    if (Math.random() * 100 < attacker.stats.critChance) {
                        isCrit = true;
                        damage = Math.floor(damage * ((attacker.stats as CharacterStats).critDamageModifier / 100));
                    }
                }
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
    } else { // Enemy is attacking
        const enemyStats = attacker.stats as EnemyStats;
        const manaCost = enemyStats.magicAttackManaCost || 0;
        if (Math.random() * 100 < (enemyStats.magicAttackChance || 0) && attacker.currentMana >= manaCost) {
            useMagicAttack = true;
            magicAttackType = enemyStats.magicAttackType;
            attacker.currentMana -= manaCost;
            damage = Math.floor(Math.random() * ((enemyStats.magicDamageMax || 0) - (enemyStats.magicDamageMin || 0) + 1)) + (enemyStats.magicDamageMin || 0);
        }
    }

    // 4. Physical Attack Logic
    if (!useMagicAttack) {
        damage = Math.floor(Math.random() * (attacker.stats.maxDamage - attacker.stats.minDamage + 1)) + attacker.stats.minDamage;

        if (Math.random() * 100 < attacker.stats.critChance) {
            isCrit = true;
            let critModifier = 200; // Default for enemies
            if (isPlayerAttacking) {
                critModifier = (attacker.stats as CharacterStats).critDamageModifier;
            }
            damage = Math.floor(damage * (critModifier / 100));
        }

        const armorPenPercent = isPlayerAttacking ? (attacker.stats as CharacterStats).armorPenetrationPercent : 0;
        const armorPenFlat = isPlayerAttacking ? (attacker.stats as CharacterStats).armorPenetrationFlat : 0;
        const effectiveArmor = Math.max(0, defender.stats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
        damageReduced = Math.min(damage, Math.floor(effectiveArmor * 0.5));
        damage -= damageReduced;
    }

    // 5. Special Bonuses
    if (isPlayerAttacking && playerData.race === Race.Orc && attacker.currentHealth < attacker.stats.maxHealth * 0.25) {
        damage = Math.floor(damage * 1.25);
    }
    if (!isPlayerAttacking && playerData.race === Race.Dwarf && defender.currentHealth < defender.stats.maxHealth * 0.5) {
        const reduction = Math.floor(damage * 0.20);
        damage -= reduction;
        damageReduced += reduction;
    }

    // 6. Lifesteal / Manasteal
    if (isPlayerAttacking) {
        const playerStats = attacker.stats as CharacterStats;
        const lifeStealAmount = Math.floor(damage * (playerStats.lifeStealPercent / 100)) + playerStats.lifeStealFlat;
        if (lifeStealAmount > 0) {
            const newHealth = Math.min(attacker.stats.maxHealth, attacker.currentHealth + lifeStealAmount);
            healthGained = newHealth - attacker.currentHealth;
            attacker.currentHealth = newHealth;
        }
        const manaStealAmount = Math.floor(damage * (playerStats.manaStealPercent / 100)) + playerStats.manaStealFlat;
        if (manaStealAmount > 0) {
            const newMana = Math.min(attacker.stats.maxMana, attacker.currentMana + manaStealAmount);
            manaGained = newMana - attacker.currentMana;
            attacker.currentMana = newMana;
        }
    }
    
    // 7. Apply damage
    defender.currentHealth -= damage;
    if (defender.currentHealth < 0) defender.currentHealth = 0;
    
    // 8. Log Entry (reading directly from state)
    const logEntry: CombatLogEntry = {
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
        weaponName,
        playerHealth: state.player.currentHealth,
        playerMana: state.player.currentMana,
        enemyHealth: state.enemy.currentHealth,
        enemyMana: state.enemy.currentMana || 0,
    };
    
    state.log.push(logEntry);
};