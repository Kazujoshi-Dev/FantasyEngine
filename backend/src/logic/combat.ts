import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../types.js';
import { getGrammaticallyCorrectFullName } from './items.js';

interface CombatState {
    player: { stats: CharacterStats, currentHealth: number, currentMana: number, name: string };
    enemy: { stats: EnemyStats, currentHealth: number, currentMana: number, name: string, description?: string };
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
    
    let mageManaRestored = false;

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
    
    const weaponName = getFullWeaponName(playerData, gameData);

    // Hunter Class Bonus: Extra attack at turn 0
    const weapon = playerData.equipment.mainHand || playerData.equipment.twoHand;
    const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
    if (playerData.characterClass === CharacterClass.Hunter && template?.isRanged) {
        performAttack(state, 'player', gameData, playerData, weaponName, { isHunterInitialAttack: true });
    }

    let playerAttacksFirst = state.player.stats.agility >= state.enemy.stats.agility;
    if (playerData.race === Race.Elf) {
        playerAttacksFirst = true; // Elves always attack first in round 1
    }

    while (state.player.currentHealth > 0 && state.enemy.currentHealth > 0 && state.turn < 100) {
        state.turn++;

        // Shaman Class Bonus
        if (playerData.characterClass === CharacterClass.Shaman && state.player.currentMana > 0) {
            const shamanDamage = state.player.currentMana;
            state.enemy.currentHealth = Math.max(0, state.enemy.currentHealth - shamanDamage);
            state.log.push({
                turn: state.turn,
                attacker: state.player.name,
                defender: state.enemy.name,
                action: 'magicAttack',
                damage: shamanDamage,
                magicAttackType: MagicAttackType.ShadowBolt, // Visual representation
                playerHealth: state.player.currentHealth,
                playerMana: state.player.currentMana,
                enemyHealth: state.enemy.currentHealth,
                enemyMana: state.enemy.currentMana
            });
            if (state.enemy.currentHealth <= 0) break;
        }
        
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
                     const isWarriorFirstAttack = i === 0 && playerData.characterClass === CharacterClass.Warrior;
                     performAttack(state, 'player', gameData, playerData, weaponName, { isGuaranteedCrit: isWarriorFirstAttack, mageManaRestored: mageManaRestored, onManaRestore: () => mageManaRestored = true });
                }

                // Berserker Class Bonus
                if (playerData.characterClass === CharacterClass.Berserker && state.player.currentHealth < state.player.stats.maxHealth * 0.3 && state.enemy.currentHealth > 0) {
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


const performAttack = (
    state: CombatState, 
    attackerType: 'player' | 'enemy', 
    gameData: GameData, 
    playerData: PlayerCharacter, 
    weaponName?: string,
    options: { 
        isGuaranteedCrit?: boolean, 
        isHunterInitialAttack?: boolean,
        mageManaRestored?: boolean,
        onManaRestore?: () => void
    } = {}
) => {
    // 1. Explicitly define attacker and defender roles
    const isPlayerAttacking = attackerType === 'player';
    const attacker = isPlayerAttacking ? state.player : state.enemy;
    const defender = isPlayerAttacking ? state.enemy : state.player;
    
    const attackerStats = attacker.stats;
    const defenderStats = defender.stats;

    // 2. Dodge Check
    const dodgeChance = 'dodgeChance' in defenderStats ? defenderStats.dodgeChance : 0;
    if (Math.random() * 100 < dodgeChance && !options.isGuaranteedCrit /* Warrior cannot be dodged */) {
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
    let isCrit = options.isGuaranteedCrit || false;
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
                // Mage/Wizard mana restore bonus
                if ((playerData.characterClass === CharacterClass.Mage || playerData.characterClass === CharacterClass.Wizard) && !options.mageManaRestored) {
                    attacker.currentMana = attacker.stats.maxMana;
                    if(options.onManaRestore) options.onManaRestore();
                }

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
        if (!isCrit && Math.random() * 100 < attackerStats.critChance) {
            isCrit = true;
        }
        
        if (isCrit) {
             const critModifier = 'critDamageModifier' in attackerStats && attackerStats.critDamageModifier ? attackerStats.critDamageModifier : 200;
             damage = Math.floor(damage * (critModifier / 100));
        }

        // Armor reduction
        const armorPenPercent = 'armorPenetrationPercent' in attackerStats ? attackerStats.armorPenetrationPercent : 0;
        const armorPenFlat = 'armorPenetrationFlat' in attackerStats ? attackerStats.armorPenetrationFlat : 0;
        const effectiveArmor = Math.max(0, defenderStats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
        damageReduced = Math.min(damage, Math.floor(effectiveArmor));
        damage -= damageReduced;
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
    // Hunter's initial attack has 50% damage
    if (options.isHunterInitialAttack) {
        damage = Math.floor(damage * 0.5);
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

    // 8. Create Log Entry (reading directly from main state)
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