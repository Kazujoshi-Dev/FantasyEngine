import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../../types.js';
import { getGrammaticallyCorrectFullName } from '../items.js';

export type StatusEffectType = 'burning' | 'frozen_no_attack' | 'frozen_no_dodge' | 'reduced_attacks';

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
    const weaponInstance = playerData.equipment.mainHand || playerData.equipment.twoHand;
    if (weaponInstance) {
        const templates = gameData.itemTemplates || [];
        const affixes = gameData.affixes || [];
        const template = templates.find(t => t.id === weaponInstance.templateId);
        if (template) {
            return getGrammaticallyCorrectFullName(weaponInstance, template, affixes);
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
    turnEffects: any = {}
): { logs: CombatLogEntry[], attackerState: TAttacker, defenderState: TDefender, aoeData?: any, chainData?: any } => {

    const logs: CombatLogEntry[] = [];
    const attackerIsPlayer = 'statPoints' in attacker.stats;
    const defenderIsPlayer = 'statPoints' in defender.stats;
    
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

    let tempDodgeChance = 'dodgeChance' in defender.stats ? defender.stats.dodgeChance : 0;
    if (defender.statusEffects.some(e => e.type === 'frozen_no_dodge')) {
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
        const weapon = playerData.equipment.mainHand || playerData.equipment.twoHand;
        const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
        weaponName = template ? getGrammaticallyCorrectFullName(weapon!, template, gameData.affixes) : undefined;

        if (template?.isMagical && template.magicAttackType) {
            const manaCost = template.manaCost ? (template.manaCost.min + template.manaCost.max) / 2 : 0;
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
                } else {
                    logs.push({ turn, attacker: attacker.name, defender: '', action: 'notEnoughMana', ...getHealthState(attacker, defender) });
                    useMagicAttack = false;
                }
            } else {
                useMagicAttack = true;
                magicAttackType = template.magicAttackType;
                attacker.currentMana -= manaCost;
            }
        }
    } else {
        const enemyStats = attacker.stats as EnemyStats;
        const manaCost = enemyStats.magicAttackManaCost || 0;
        if (Math.random() * 100 < (enemyStats.magicAttackChance || 0) && attacker.currentMana >= manaCost) {
            useMagicAttack = true;
            magicAttackType = enemyStats.magicAttackType;
            attacker.currentMana -= manaCost;
        }
    }

    if (useMagicAttack) {
        const magicDmgMin = attacker.stats.magicDamageMin || 0;
        const magicDmgMax = attacker.stats.magicDamageMax || 0;
        damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;

        const attackerClass = (attacker as any).data?.characterClass;
        if (attackerIsPlayer && (attackerClass === CharacterClass.Mage || attackerClass === CharacterClass.Wizard)) {
            if (Math.random() * 100 < attacker.stats.critChance) {
                isCrit = true;
                damage = Math.floor(damage * ((attacker.stats as CharacterStats).critDamageModifier / 100));
            }
        }
    } else {
        damage = Math.floor(Math.random() * (attacker.stats.maxDamage - attacker.stats.minDamage + 1)) + attacker.stats.minDamage;
        const critChance = attacker.stats.critChance + (attacker.isEmpowered ? 15 : 0);
        if (Math.random() * 100 < critChance) {
            isCrit = true;
            const critMod = 'critDamageModifier' in attacker.stats ? (attacker.stats as any).critDamageModifier : 150;
            damage = Math.floor(damage * (critMod / 100));
        }

        const armorPenPercent = 'armorPenetrationPercent' in attacker.stats ? (attacker.stats as any).armorPenetrationPercent : 0;
        const armorPenFlat = 'armorPenetrationFlat' in attacker.stats ? (attacker.stats as any).armorPenetrationFlat : 0;
        
        const effectiveArmor = Math.max(0, defender.stats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
        const armorReduction = Math.min(damage, Math.floor(effectiveArmor));
        damage -= armorReduction;
        damageReduced += armorReduction;
    }

    if (attackerIsPlayer && attacker.data?.race === Race.Orc && attacker.currentHealth < attacker.stats.maxHealth * 0.25) {
        damage = Math.floor(damage * 1.25);
    }
    if (defenderIsPlayer && defender.data?.race === Race.Dwarf && defender.currentHealth < defender.stats.maxHealth * 0.5) {
        const reduction = Math.floor(damage * 0.20);
        damage -= reduction;
        damageReduced += reduction;
    }

    // --- Apply Magic Effects ---
    let aoeData;
    let chainData;
    if (useMagicAttack && magicAttackType) {
        switch(magicAttackType) {
            case MagicAttackType.Fireball:
                if (Math.random() * 100 < 25) {
                    defender.statusEffects.push({ type: 'burning', duration: 2 });
                    logs.push({ turn, attacker: attacker.name, defender: defender.name, action: 'effectApplied', effectApplied: 'burning', ...getHealthState(attacker, defender) });
                }
                break;
            case MagicAttackType.LightningStrike:
                if (Math.random() * 100 < 15) {
                     defender.statusEffects.push({ type: 'reduced_attacks', duration: Infinity, amount: 1 });
                     logs.push({ turn, attacker: attacker.name, defender: defender.name, action: 'effectApplied', effectApplied: 'reduced_attacks', ...getHealthState(attacker, defender) });
                }
                break;
            case MagicAttackType.ShadowBolt:
                if (attackerIsPlayer) {
                    attacker.shadowBoltStacks = Math.min(5, (attacker.shadowBoltStacks || 0) + 1);
                    const bonus = 1 + (attacker.shadowBoltStacks * 0.05);
                    damage = Math.floor(damage * bonus);
                    logs.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'shadowBoltStack', ...getHealthState(attacker, defender) });
                }
                break;
            case MagicAttackType.FrostWave:
                if (Math.random() * 100 < 20) {
                    defender.statusEffects.push({ type: 'frozen_no_dodge', duration: 2 });
                    logs.push({ turn, attacker: attacker.name, defender: defender.name, action: 'effectApplied', effectApplied: 'frozen_no_dodge', ...getHealthState(attacker, defender) });
                }
                break;
            case MagicAttackType.IceLance:
                if (Math.random() * 100 < 10) {
                    defender.statusEffects.push({ type: 'frozen_no_attack', duration: 1 });
                    logs.push({ turn, attacker: attacker.name, defender: defender.name, action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(attacker, defender) });
                }
                break;
            case MagicAttackType.ArcaneMissile:
                if (attackerIsPlayer) {
                    const bonusDamage = Math.floor((attacker.stats as CharacterStats).maxMana * 0.5);
                    damage += bonusDamage;
                    logs.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'arcaneMissileBonus', damage: bonusDamage, ...getHealthState(attacker, defender) });
                }
                break;
            case MagicAttackType.LifeDrain:
                const drained = Math.floor(damage * 0.25);
                const newHealth = Math.min(attacker.stats.maxHealth, attacker.currentHealth + drained);
                healthGained += newHealth - attacker.currentHealth;
                attacker.currentHealth = newHealth;
                break;
            case MagicAttackType.Earthquake:
                aoeData = { type: 'earthquake', baseDamage: damage, splashPercent: 0.20 };
                break;
            case MagicAttackType.ChainLightning:
                chainData = { type: 'chain_lightning', chance: 25, maxJumps: 2, damage: damage };
                break;
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
    
    defender.currentHealth = Math.max(0, defender.currentHealth - damage);

    const finalLogEntry: CombatLogEntry = {
        turn, attacker: attacker.name, defender: defender.name,
        action: useMagicAttack ? 'magicAttack' : 'attacks',
        damage, isCrit,
        damageReduced: damageReduced > 0 ? damageReduced : undefined,
        healthGained: healthGained > 0 ? healthGained : undefined,
        manaGained: manaGainedFromSteal > 0 ? manaGainedFromSteal : undefined,
        magicAttackType, weaponName,
        ...getHealthState(attacker, defender),
    };
    logs.push(finalLogEntry);

    return { logs, attackerState: attacker, defenderState: defender, aoeData, chainData };
};
