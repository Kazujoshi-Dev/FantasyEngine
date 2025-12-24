
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

export const getFullWeaponName = (playerData: PlayerCharacter, gameData: GameData, hand: 'main' | 'off' = 'main'): string | undefined => {
    if (!playerData.equipment) return undefined;
    const templates = gameData.itemTemplates || [];
    const affixes = gameData.affixes || [];
    if (hand === 'off') {
        const offHand = playerData.equipment.offHand;
        if (!offHand) return undefined;
        const t = templates.find(temp => temp.id === offHand.templateId);
        return t ? getGrammaticallyCorrectFullName(offHand, t, affixes) : undefined;
    }
    const mainHand = playerData.equipment.mainHand || playerData.equipment.twoHand;
    if (mainHand) {
        const t = templates.find(temp => temp.id === mainHand.templateId);
        return t ? getGrammaticallyCorrectFullName(mainHand, t, affixes) : undefined;
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
    options: { ignoreArmor?: boolean; ignoreDodge?: boolean, critChanceOverride?: number, hand?: 'main' | 'off' } = {}
): { logs: CombatLogEntry[], attackerState: TAttacker, defenderState: TDefender, aoeData?: any, chainData?: any } => {

    const logs: CombatLogEntry[] = [];
    const attackerIsPlayer = 'statPoints' in attacker.stats;
    const defenderIsPlayer = 'statPoints' in defender.stats;
    const hand = options.hand || 'main';
    
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
    let bonusDamage = 0;
    let manaSpent = 0;

    let tempDodgeChance: number = defender.stats.dodgeChance || 0;
    if (options.ignoreDodge || defender.statusEffects.some(e => e.type === 'frozen_no_dodge')) {
        tempDodgeChance = 0;
    } else {
        tempDodgeChance = Math.min(30, tempDodgeChance);
    }

    if (Math.random() * 100 < tempDodgeChance) {
        return {
            logs: [{ turn, attacker: attacker.name, defender: defender.name, action: 'dodge', isDodge: true, ...getHealthState(attacker, defender) }],
            attackerState: attacker,
            defenderState: defender,
        };
    }

    if (attackerIsPlayer) {
        const playerData = (attacker as any).data as PlayerCharacter;
        weaponName = getFullWeaponName(playerData, gameData, hand);
        const weapon = hand === 'off' ? playerData.equipment?.offHand : (playerData.equipment?.mainHand || playerData.equipment?.twoHand);
        const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;

        if (template?.isMagical && template.magicAttackType) {
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
                    attacker.currentMana = (attacker.stats as CharacterStats).maxMana;
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
        const magicDmgMin = hand === 'off' ? (attacker.stats as CharacterStats).offHandMagicDamageMin || 0 : attacker.stats.magicDamageMin || 0;
        const magicDmgMax = hand === 'off' ? (attacker.stats as CharacterStats).offHandMagicDamageMax || 0 : attacker.stats.magicDamageMax || 0;
        damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;

        const attackerClass = (attacker as any).data?.characterClass;
        if ((attackerIsPlayer && (attackerClass === CharacterClass.Mage || attackerClass === CharacterClass.Wizard)) || !attackerIsPlayer) {
            if (Math.random() * 100 < attacker.stats.critChance) {
                isCrit = true;
                const critMod = 'critDamageModifier' in attacker.stats ? (attacker.stats as any).critDamageModifier : 150;
                damage = Math.floor(damage * (critMod / 100));
            }
        }
    } else {
        const min = hand === 'off' ? (attacker.stats as CharacterStats).offHandMinDamage || 0 : attacker.stats.minDamage;
        const max = hand === 'off' ? (attacker.stats as CharacterStats).offHandMaxDamage || 0 : attacker.stats.maxDamage;
        damage = Math.floor(Math.random() * (max - min + 1)) + min;
        const critChance = options.critChanceOverride ?? (attacker.stats.critChance + (attacker.isEmpowered ? 15 : 0));
        if (Math.random() * 100 < critChance) {
            isCrit = true;
            const critMod = 'critDamageModifier' in attacker.stats ? (attacker.stats as any).critDamageModifier : 150;
            damage = Math.floor(damage * (critMod / 100));
        }

        const armorPenPercent = 'armorPenetrationPercent' in attacker.stats ? (attacker.stats as any).armorPenetrationPercent : 0;
        const armorPenFlat = 'armorPenetrationFlat' in attacker.stats ? (attacker.stats as any).armorPenetrationFlat : 0;
        let effectiveArmor = Math.max(0, defender.stats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
        if (options.ignoreArmor || defender.statusEffects.some(e => e.type === 'armor_broken')) effectiveArmor = 0;
        const armorReduction = Math.min(damage, Math.floor(effectiveArmor));
        damage -= armorReduction;
        damageReduced += armorReduction;
    }

    const reductionPercent = (defender.stats as CharacterStats).damageReductionPercent || 0;
    if (reductionPercent > 0) {
        const reductionVal = Math.floor(damage * (reductionPercent / 100));
        damage -= reductionVal;
        damageReduced += reductionVal;
    }

    // --- ORC FURY LOGIC ---
    if (attackerIsPlayer && attacker.data?.race === Race.Orc) {
        let furyThreshold = 0.25;
        if (attacker.data.learnedSkills?.includes('behemoths-hide')) {
            furyThreshold = 0.35;
        }

        if (attacker.currentHealth < attacker.stats.maxHealth * furyThreshold) {
            damage = Math.floor(damage * 1.25);
            logs.push({ turn, attacker: attacker.name, defender: defender.name, action: 'orc_fury', ...getHealthState(attacker, defender) });
        }
    }

    if (defenderIsPlayer && defender.data?.race === Race.Dwarf && defender.currentHealth < defender.stats.maxHealth * 0.5) {
        const reduction = Math.floor(damage * 0.20);
        damage -= reduction;
        damageReduced += reduction;
        logs.push({ turn, attacker: attacker.name, defender: defender.name, action: 'dwarf_defense', damageReduced: reduction, ...getHealthState(attacker, defender) });
    }

    if (isCrit && defenderIsPlayer && !defender.hardSkinTriggered) {
        const defenderChar = defender.data as PlayerCharacter;
        if (defenderChar.learnedSkills && defenderChar.learnedSkills.includes('twarda-skora-1')) {
            const reduction = Math.floor(damage * 0.5);
            damage -= reduction;
            damageReduced += reduction;
            defender.hardSkinTriggered = true;
            logs.push({ turn, attacker: attacker.name, defender: defender.name, action: 'hardSkinProc', ...getHealthState(attacker, defender) });
        }
    }

    let aoeData;
    let chainData;
    if (useMagicAttack && magicAttackType) {
        const spellLogic = spellRegistry[magicAttackType];
        if (spellLogic) {
            const context: SpellContext = { attacker, defender, turn, baseDamage: damage, allEnemies };
            const result = spellLogic(context);
            logs.push(...result.logs.map(log => ({ ...log, ...getHealthState(attacker, defender) })));
            if (result.bonusDamage) bonusDamage = result.bonusDamage;
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
    
    const totalDamage = damage + bonusDamage;
    defender.currentHealth = Math.max(0, defender.currentHealth - totalDamage);
    const finalLogEntry: CombatLogEntry = { turn, attacker: attacker.name, defender: defender.name, action: useMagicAttack ? 'magicAttack' : 'attacks', damage: totalDamage, bonusDamage: bonusDamage > 0 ? bonusDamage : undefined, isCrit, damageReduced: damageReduced > 0 ? damageReduced : undefined, healthGained: healthGained > 0 ? healthGained : undefined, manaGained: manaGainedFromSteal > 0 ? manaGainedFromSteal : undefined, magicAttackType, weaponName, manaSpent: manaSpent > 0 ? manaSpent : undefined, ...getHealthState(attacker, defender), };
    logs.push(finalLogEntry);
    return { logs, attackerState: attacker, defenderState: defender, aoeData, chainData };
};
