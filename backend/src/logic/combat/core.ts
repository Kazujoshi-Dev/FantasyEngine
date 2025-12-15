
import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../../types.js';
import { getGrammaticallyCorrectFullName } from '../items.js';
import { spellRegistry } from './spells/registry.js';
import { SpellContext } from './spells/types.js';

export type StatusEffectType = 'burning' | 'frozen_no_attack' | 'frozen_no_dodge' | 'reduced_attacks' | 'stunned' | 'armor_broken';

export interface StatusEffect {
    type: StatusEffectType;
    duration: number; // in turns
    amount?: number;
}

export interface AttackerState {
    stats: CharacterStats | EnemyStats;
    currentHealth: number;
    currentMana: number;
    name: string;
    hardSkinTriggered?: boolean;
    isEmpowered?: boolean;
    manaSurgeUsed?: boolean;
    shadowBoltStacks?: number;
    statusEffects: StatusEffect[];
    data?: PlayerCharacter;
}

export interface DefenderState {
    stats: CharacterStats | EnemyStats;
    currentHealth: number;
    currentMana: number;
    name: string;
    hardSkinTriggered?: boolean;
    statusEffects: StatusEffect[];
    data?: PlayerCharacter;
    uniqueId?: string;
}

export const getFullWeaponName = (playerData: PlayerCharacter, gameData: GameData): string | undefined => {
    if (!playerData.equipment) {
        return undefined;
    }
    const weaponInstance = playerData.equipment.mainHand || playerData.equipment.twoHand;
    if (weaponInstance) {
        const templates = gameData.itemTemplates || [];
        const affixes = gameData.affixes || [];
        const template = templates.find(t => t.id === weaponInstance.templateId);
        if (template) {
            const baseName = getGrammaticallyCorrectFullName(weaponInstance, template, affixes);
            if (weaponInstance.upgradeLevel && weaponInstance.upgradeLevel > 0) {
                return `${baseName} +${weaponInstance.upgradeLevel}`;
            }
            return baseName;
        }
    }
    return undefined;
};

export const performAttack = <
    TAttacker extends AttackerState,
    TDefender extends DefenderState
>(
    attacker: TAttacker,
    defender: TDefender,
    turn: number,
    gameData: GameData,
    allEnemies: DefenderState[],
    isBossAttacking: boolean = false,
    options: { ignoreArmor?: boolean; ignoreDodge?: boolean, critChanceOverride?: number } = {}
): { logs: CombatLogEntry[], attackerState: TAttacker, defenderState: TDefender, aoeData?: any, chainData?: any } => {

    const logs: CombatLogEntry[] = [];
    const attackerIsPlayer = 'statPoints' in attacker.stats;
    const defenderIsPlayer = 'statPoints' in defender.stats;
    
    // This is now a placeholder; the caller (simulation) is responsible for the full health snapshot.
    const getHealthState = (currentAttacker: TAttacker, currentDefender: TDefender) => ({
        playerHealth: defenderIsPlayer ? currentDefender.currentHealth : currentAttacker.currentHealth,
        playerMana: defenderIsPlayer ? currentDefender.currentMana : currentAttacker.currentMana,
        enemyHealth: defenderIsPlayer ? currentAttacker.currentHealth : currentDefender.currentHealth,
        enemyMana: defenderIsPlayer ? currentAttacker.currentMana : currentDefender.currentMana,
    });


    let damage = 0;
    let isCrit = false;
    let damageReduced = 0;
    let healthGained = 0;
    let manaGainedFromSteal = 0;
    let magicAttackType: MagicAttackType | undefined = undefined;
    let useMagicAttack = false;
    let weaponName: string | undefined = undefined;
    let arcaneMissileBonusDamage = 0;
    let manaSpent = 0;

    let tempDodgeChance: number = defender.stats.dodgeChance || 0;
    
    // Apply ignoreDodge option (e.g. for Warrior class bonus) or frozen status
    if (options.ignoreDodge || defender.statusEffects.some(e => e.type === 'frozen_no_dodge')) {
        tempDodgeChance = 0;
    }

    if (Math.random() * 100 < tempDodgeChance) {
        return {
            logs: [{
                turn, attacker: attacker.name, defender: defender.name, action: 'dodge', isDodge: true,
                ...getHealthState(attacker, defender)
            }],
            attackerState: attacker,
            defenderState: defender,
        };
    }

    if (attackerIsPlayer) {
        const playerData = (attacker as any).data as PlayerCharacter;
        const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
        const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
        weaponName = template ? getFullWeaponName(playerData, gameData) : undefined;

        if (template?.isMagical && template.magicAttackType) {
            // FIX: Calculate random mana cost within range instead of average
            let manaCost = 0;
            if (template.manaCost) {
                const min = template.manaCost.min;
                const max = template.manaCost.max;
                manaCost = Math.floor(Math.random() * (max - min + 1)) + min;
            }

            if (attacker.currentMana < manaCost) {
                const canUseManaSurge = (playerData.characterClass === CharacterClass.Mage || playerData.characterClass === CharacterClass.Wizard) && !attacker.manaSurgeUsed;

                if (canUseManaSurge) {
                    attacker.manaSurgeUsed = true;
                    const maxMana = (attacker.stats as CharacterStats).maxMana;
                    attacker.currentMana = maxMana;
                    
                    logs.push({ turn, attacker: attacker.name, defender: '', action: 'manaSurge', ...getHealthState(attacker, defender) });
                    
                    useMagicAttack = true;
                    magicAttackType = template.magicAttackType;
                    attacker.currentMana -= manaCost;
                    manaSpent = manaCost;
                } else {
                    logs.push({ turn, attacker: attacker.name, defender: '', action: 'notEnoughMana', ...getHealthState(attacker, defender) });
                    useMagicAttack = false;
                }
            } else {
                useMagicAttack = true;
                magicAttackType = template.magicAttackType;
                attacker.currentMana -= manaCost;
                manaSpent = manaCost;
            }
        }
    } else {
        const enemyStats = attacker.stats as EnemyStats;
        const manaCost = enemyStats.magicAttackManaCost || 0;
        if (Math.random() * 100 < (enemyStats.magicAttackChance || 0) && attacker.currentMana >= manaCost) {
            useMagicAttack = true;
            magicAttackType = enemyStats.magicAttackType;
            attacker.currentMana -= manaCost;
            manaSpent = manaCost;
        }
    }

    if (useMagicAttack) {
        const magicDmgMin = attacker.stats.magicDamageMin || 0;
        const magicDmgMax = attacker.stats.magicDamageMax || 0;
        damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;

        const attackerClass = (attacker as any).data?.characterClass;
        
        // Critical Magic Logic
        // Allow crit if:
        // 1. It is a player AND they are Mage or Wizard (Class Bonus)
        // 2. OR It is NOT a player (Boss/Enemy always has potential to crit with magic if stats allow)
        if ((attackerIsPlayer && (attackerClass === CharacterClass.Mage || attackerClass === CharacterClass.Wizard)) || !attackerIsPlayer) {
            if (Math.random() * 100 < attacker.stats.critChance) {
                isCrit = true;
                const critMod = 'critDamageModifier' in attacker.stats ? (attacker.stats as any).critDamageModifier : 150;
                damage = Math.floor(damage * (critMod / 100));
            }
        }
    } else {
        damage = Math.floor(Math.random() * (attacker.stats.maxDamage - attacker.stats.minDamage + 1)) + attacker.stats.minDamage;
        const critChance = options.critChanceOverride ?? (attacker.stats.critChance + (attacker.isEmpowered ? 15 : 0));
        if (Math.random() * 100 < critChance) {
            isCrit = true;
            const critMod = 'critDamageModifier' in attacker.stats ? (attacker.stats as any).critDamageModifier : 150;
            damage = Math.floor(damage * (critMod / 100));
        }

        const armorPenPercent = 'armorPenetrationPercent' in attacker.stats ? (attacker.stats as any).armorPenetrationPercent : 0;
        const armorPenFlat = 'armorPenetrationFlat' in attacker.stats ? (attacker.stats as any).armorPenetrationFlat : 0;
        
        let effectiveArmor = Math.max(0, defender.stats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
        
        // Apply armor break status effect or explicit ignore option
        if (options.ignoreArmor || defender.statusEffects.some(e => e.type === 'armor_broken')) {
            effectiveArmor = 0;
        }

        const armorReduction = Math.min(damage, Math.floor(effectiveArmor));
        damage -= armorReduction;
        damageReduced += armorReduction;
    }

    if (attackerIsPlayer && attacker.data?.race === Race.Orc && attacker.currentHealth < attacker.stats.maxHealth * 0.25) {
        damage = Math.floor(damage * 1.25);
        logs.push({
            turn, 
            attacker: attacker.name, 
            defender: defender.name, 
            action: 'orc_fury',
            ...getHealthState(attacker, defender)
        });
    }
    if (defenderIsPlayer && defender.data?.race === Race.Dwarf && defender.currentHealth < defender.stats.maxHealth * 0.5) {
        const reduction = Math.floor(damage * 0.20);
        damage -= reduction;
        damageReduced += reduction;
        
        logs.push({
            turn,
            attacker: attacker.name,
            defender: defender.name,
            action: 'dwarf_defense',
            damageReduced: reduction,
            ...getHealthState(attacker, defender)
        });
    }

    // --- Passive Skill: Hard Skin (Twarda skóra) ---
    // Effect: Reduces first critical hit received in combat by 50%
    if (isCrit && defenderIsPlayer && !defender.hardSkinTriggered) {
        const defenderChar = defender.data as PlayerCharacter;
        if (defenderChar.learnedSkills && defenderChar.learnedSkills.includes('twarda-skora-1')) {
            const reduction = Math.floor(damage * 0.5);
            damage -= reduction;
            damageReduced += reduction;
            defender.hardSkinTriggered = true;
            
            logs.push({
                turn,
                attacker: attacker.name,
                defender: defender.name,
                action: 'hardSkinProc',
                ...getHealthState(attacker, defender)
            });
        }
    }

    // --- Apply Magic Effects via Registry ---
    let aoeData;
    let chainData;
    
    if (useMagicAttack && magicAttackType) {
        const spellLogic = spellRegistry[magicAttackType];
        if (spellLogic) {
            const context: SpellContext = {
                attacker,
                defender,
                turn,
                baseDamage: damage,
                allEnemies
            };
            const result = spellLogic(context);
            
            // Merge spell logs with health context
            logs.push(...result.logs.map(log => ({ ...log, ...getHealthState(attacker, defender) })));
            
            if (result.bonusDamage) arcaneMissileBonusDamage = result.bonusDamage;
            if (result.healthGained) healthGained += result.healthGained;
            if (result.damageMultiplier) damage = Math.floor(damage * result.damageMultiplier);
            if (result.aoeData) aoeData = result.aoeData;
            if (result.chainData) chainData = result.chainData;
        }
    }
    
    if (attackerIsPlayer) {
        const playerStats = attacker.stats as CharacterStats;
        const lifeSteal = Math.floor(damage * (playerStats.lifeStealPercent / 100)) + playerStats.lifeStealFlat;
        if (lifeSteal > 0) {
            const newHealth = Math.min(playerStats.maxHealth, attacker.currentHealth + lifeSteal);
            healthGained += newHealth - attacker.currentHealth;
            attacker.currentHealth = newHealth;
        }
        const manaSteal = Math.floor(damage * (playerStats.manaStealPercent / 100)) + playerStats.manaStealFlat;
        if (manaSteal > 0) {
            const newMana = Math.min(playerStats.maxMana, attacker.currentMana + manaSteal);
            manaGainedFromSteal += newMana - attacker.currentMana;
            attacker.currentMana = newMana;
        }
    }
    
    const totalDamage = damage + arcaneMissileBonusDamage;
    defender.currentHealth = Math.max(0, defender.currentHealth - totalDamage);

    const finalLogEntry: CombatLogEntry = {
        turn, attacker: attacker.name, defender: defender.name,
        action: useMagicAttack ? 'magicAttack' : 'attacks',
        damage: totalDamage,
        bonusDamage: arcaneMissileBonusDamage > 0 ? arcaneMissileBonusDamage : undefined,
        isCrit,
        damageReduced: damageReduced > 0 ? damageReduced : undefined,
        healthGained: healthGained > 0 ? healthGained : undefined,
        manaGained: manaGainedFromSteal > 0 ? manaGainedFromSteal : undefined,
        magicAttackType, weaponName,
        manaSpent: manaSpent > 0 ? manaSpent : undefined,
        ...getHealthState(attacker, defender),
    };
    logs.push(finalLogEntry);

    return { logs, attackerState: attacker, defenderState: defender, aoeData, chainData };
};
