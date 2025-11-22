import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../../types.js';
import { getGrammaticallyCorrectFullName } from '../items.js';

// Interfejsy dla stanów, używane wewnętrznie przez logikę walki
export interface AttackerState {
    stats: CharacterStats | EnemyStats;
    currentHealth: number;
    currentMana: number;
    name: string;
    hardSkinTriggered?: boolean;
    isEmpowered?: boolean;
}

export interface DefenderState {
    stats: CharacterStats | EnemyStats;
    currentHealth: number;
    currentMana: number;
    name: string;
    hardSkinTriggered?: boolean;
    data?: PlayerCharacter; // Pełne dane gracza, jeśli obrońcą jest gracz
}

// Funkcja pomocnicza do pobierania nazwy broni
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

// Logika pojedynczego ataku
export const performAttack = (
    attacker: AttackerState,
    defender: DefenderState,
    turn: number,
    gameData: GameData,
    isBossAttacking: boolean = false,
    turnEffects: any = {}
): { logEntry: CombatLogEntry, attackerState: AttackerState, defenderState: DefenderState } => {

    const attackerIsPlayer = 'statPoints' in attacker.stats;
    const defenderIsPlayer = 'statPoints' in defender.stats;

    // --- Inicjalizacja ---
    let damage = 0;
    let isCrit = false;
    let damageReduced = 0;
    let healthGained = 0;
    let manaGained = 0;
    let magicAttackType: MagicAttackType | undefined = undefined;
    let useMagicAttack = false;
    let weaponName: string | undefined = undefined;

    // --- Krok 1: Sprawdzenie Uniku ---
    const dodgeChance = 'dodgeChance' in defender.stats ? defender.stats.dodgeChance : 0;
    if (Math.random() * 100 < dodgeChance) {
        return {
            logEntry: {
                turn, attacker: attacker.name, defender: defender.name, action: 'dodge', isDodge: true,
                playerHealth: defenderIsPlayer ? defender.currentHealth : attacker.currentHealth,
                playerMana: defenderIsPlayer ? defender.currentMana : attacker.currentMana,
                enemyHealth: defenderIsPlayer ? attacker.currentHealth : defender.currentHealth,
                enemyMana: defenderIsPlayer ? attacker.currentMana : defender.currentMana,
            },
            attackerState: attacker,
            defenderState: defender,
        };
    }

    // --- Krok 2: Określenie Typu Ataku (Fizyczny/Magiczny) ---
    if (attackerIsPlayer) {
        const playerData = (attacker as any).data as PlayerCharacter;
        const weapon = playerData.equipment.mainHand || playerData.equipment.twoHand;
        const template = weapon ? gameData.itemTemplates.find(t => t.id === weapon.templateId) : null;
        weaponName = template ? getGrammaticallyCorrectFullName(weapon!, template, gameData.affixes) : undefined;

        if (template?.isMagical && template.magicAttackType) {
            const manaCost = template.manaCost ? (template.manaCost.min + template.manaCost.max) / 2 : 0;
            if (attacker.currentMana >= manaCost) {
                useMagicAttack = true;
                magicAttackType = template.magicAttackType;
                attacker.currentMana -= manaCost;
            }
        }
    } else { // Atak potwora
        const enemyStats = attacker.stats as EnemyStats;
        const manaCost = enemyStats.magicAttackManaCost || 0;
        if (Math.random() * 100 < (enemyStats.magicAttackChance || 0) && attacker.currentMana >= manaCost) {
            useMagicAttack = true;
            magicAttackType = enemyStats.magicAttackType;
            attacker.currentMana -= manaCost;
        }
    }

    // --- Krok 3: Obliczenie Obrażeń ---
    if (useMagicAttack) {
        const magicDmgMin = attacker.stats.magicDamageMin || 0;
        const magicDmgMax = attacker.stats.magicDamageMax || 0;
        damage = Math.floor(Math.random() * (magicDmgMax - magicDmgMin + 1)) + magicDmgMin;

        // Krytyki magiczne dla klas
        const attackerClass = (attacker as any).data?.characterClass;
        if (attackerIsPlayer && (attackerClass === CharacterClass.Mage || attackerClass === CharacterClass.Wizard)) {
            if (Math.random() * 100 < attacker.stats.critChance) {
                isCrit = true;
                damage = Math.floor(damage * ((attacker.stats as CharacterStats).critDamageModifier / 100));
            }
        }
    } else { // Atak fizyczny
        damage = Math.floor(Math.random() * (attacker.stats.maxDamage - attacker.stats.minDamage + 1)) + attacker.stats.minDamage;
        const critChance = attacker.stats.critChance + (attacker.isEmpowered ? 15 : 0);
        if (Math.random() * 100 < critChance) {
            isCrit = true;
            const critMod = 'critDamageModifier' in attacker.stats ? (attacker.stats as any).critDamageModifier : 150;
            damage = Math.floor(damage * (critMod / 100));
        }

        // Redukcja z pancerza
        const isArmorPierced = turnEffects.armorPierceTargetId && defenderIsPlayer && turnEffects.armorPierceTargetId === (defender.data as PlayerCharacter).id;
        const armorPenPercent = 'armorPenetrationPercent' in attacker.stats ? (attacker.stats as any).armorPenetrationPercent : 0;
        const armorPenFlat = 'armorPenetrationFlat' in attacker.stats ? (attacker.stats as any).armorPenetrationFlat : 0;
        
        const effectiveArmor = isArmorPierced ? 0 : Math.max(0, defender.stats.armor * (1 - armorPenPercent / 100) - armorPenFlat);
        const armorReduction = Math.min(damage, Math.floor(effectiveArmor));
        damage -= armorReduction;
        damageReduced += armorReduction;
    }

    // --- Krok 4: Modyfikatory Rasowe/Klasowe ---
    const attackerRace = (attacker as any).data?.race;
    const defenderRace = (defender as any).data?.race;
    if (attackerIsPlayer && attackerRace === Race.Orc && attacker.currentHealth < attacker.stats.maxHealth * 0.25) {
        damage = Math.floor(damage * 1.25);
    }
    if (defenderIsPlayer && defenderRace === Race.Dwarf && defender.currentHealth < defender.stats.maxHealth * 0.5) {
        const reduction = Math.floor(damage * 0.20);
        damage -= reduction;
        damageReduced += reduction;
    }

    // --- Krok 5: Kradzież Życia/Many ---
    if (attackerIsPlayer) {
        const playerStats = attacker.stats as CharacterStats;
        const lifeSteal = Math.floor(damage * (playerStats.lifeStealPercent / 100)) + playerStats.lifeStealFlat;
        if (lifeSteal > 0) {
            const newHealth = Math.min(playerStats.maxHealth, attacker.currentHealth + lifeSteal);
            healthGained = newHealth - attacker.currentHealth;
            attacker.currentHealth = newHealth;
        }
        const manaSteal = Math.floor(damage * (playerStats.manaStealPercent / 100)) + playerStats.manaStealFlat;
        if (manaSteal > 0) {
            const newMana = Math.min(playerStats.maxMana, attacker.currentMana + manaSteal);
            manaGained = newMana - attacker.currentMana;
            attacker.currentMana = newMana;
        }
    }
    
    // --- Krok 6: Zadanie obrażeń ---
    defender.currentHealth = Math.max(0, defender.currentHealth - damage);

    const logEntry: CombatLogEntry = {
        turn, attacker: attacker.name, defender: defender.name,
        action: useMagicAttack ? 'magicAttack' : 'attacks',
        damage, isCrit,
        damageReduced: damageReduced > 0 ? damageReduced : undefined,
        healthGained: healthGained > 0 ? healthGained : undefined,
        manaGained: manaGained > 0 ? manaGained : undefined,
        magicAttackType, weaponName,
        playerHealth: defenderIsPlayer ? defender.currentHealth : attacker.currentHealth,
        playerMana: defenderIsPlayer ? defender.currentMana : attacker.currentMana,
        enemyHealth: defenderIsPlayer ? attacker.currentHealth : defender.currentHealth,
        enemyMana: defenderIsPlayer ? attacker.currentMana : defender.currentMana,
    };

    return { logEntry, attackerState: attacker, defenderState: defender };
};
