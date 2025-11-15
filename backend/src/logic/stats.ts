import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, EquipmentSlot, Race, RolledAffixStats } from '../types.js';

export const calculateDerivedStatsOnServer = (character: PlayerCharacter, itemTemplates: ItemTemplate[], affixes: Affix[]): PlayerCharacter => {
    
    const getMaxValue = (value: number | { min: number; max: number } | undefined): number => {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'object' && 'max' in value) return value.max;
        return 0;
    };

    const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
        strength: Number(character.stats.strength) || 0, 
        agility: Number(character.stats.agility) || 0, 
        accuracy: Number(character.stats.accuracy) || 0,
        stamina: Number(character.stats.stamina) || 0, 
        intelligence: Number(character.stats.intelligence) || 0, 
        energy: Number(character.stats.energy) || 0
    };

    let bonusDamageMin = 0, bonusDamageMax = 0, bonusMagicDamageMin = 0, bonusMagicDamageMax = 0;
    let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0, bonusDodgeChance = 0;
    let bonusAttacksPerRound = 0;
    let bonusCritDamageModifier = 0;
    let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
    let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
    let bonusManaStealPercent = 0, bonusManaStealFlat = 0;

    const applyAffixBonuses = (source: RolledAffixStats) => {
        if (source.statsBonus) {
            for (const stat in source.statsBonus) {
                const key = stat as keyof typeof source.statsBonus;
                totalPrimaryStats[key] = (totalPrimaryStats[key] || 0) + (source.statsBonus[key] || 0);
            }
        }
        bonusDamageMin += source.damageMin || 0;
        bonusDamageMax += source.damageMax || 0;
        bonusMagicDamageMin += source.magicDamageMin || 0;
        bonusMagicDamageMax += source.magicDamageMax || 0;
        bonusArmor += source.armorBonus || 0;
        bonusCritChance += source.critChanceBonus || 0;
        bonusMaxHealth += source.maxHealthBonus || 0;
        bonusCritDamageModifier += source.critDamageModifierBonus || 0;
        bonusArmorPenetrationPercent += source.armorPenetrationPercent || 0;
        bonusArmorPenetrationFlat += source.armorPenetrationFlat || 0;
        bonusLifeStealPercent += source.lifeStealPercent || 0;
        bonusLifeStealFlat += source.lifeStealFlat || 0;
        bonusManaStealPercent += source.manaStealPercent || 0;
        bonusManaStealFlat += source.manaStealFlat || 0;
        bonusAttacksPerRound += source.attacksPerRoundBonus || 0;
        bonusDodgeChance += source.dodgeChanceBonus || 0;
    };

    for (const slot in character.equipment) {
        const itemInstance = character.equipment[slot as EquipmentSlot];
        if (itemInstance) {
            const template = itemTemplates.find(t => t.id === itemInstance.templateId);
            const upgradeLevel = itemInstance.upgradeLevel || 0;
            const upgradeBonusFactor = upgradeLevel * 0.1;

            if (itemInstance.rolledBaseStats) {
                const baseStats = itemInstance.rolledBaseStats;
                const applyUpgrade = (val: number | undefined) => (val || 0) + Math.round((val || 0) * upgradeBonusFactor);
                
                if (baseStats.statsBonus) {
                    for (const stat in baseStats.statsBonus) {
                        const key = stat as keyof typeof baseStats.statsBonus;
                        const baseBonus = baseStats.statsBonus[key] || 0;
                        totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                    }
                }
                
                bonusDamageMin += applyUpgrade(baseStats.damageMin);
                bonusDamageMax += applyUpgrade(baseStats.damageMax);
                bonusMagicDamageMin += applyUpgrade(baseStats.magicDamageMin);
                bonusMagicDamageMax += applyUpgrade(baseStats.magicDamageMax);
                bonusArmor += applyUpgrade(baseStats.armorBonus);
                bonusMaxHealth += applyUpgrade(baseStats.maxHealthBonus);
                bonusCritChance += (baseStats.critChanceBonus || 0) + ((baseStats.critChanceBonus || 0) * upgradeBonusFactor);
                
                bonusCritDamageModifier += baseStats.critDamageModifierBonus || 0;
                bonusArmorPenetrationPercent += baseStats.armorPenetrationPercent || 0;
                bonusArmorPenetrationFlat += baseStats.armorPenetrationFlat || 0;
                bonusLifeStealPercent += baseStats.lifeStealPercent || 0;
                bonusLifeStealFlat += baseStats.lifeStealFlat || 0;
                bonusManaStealPercent += baseStats.manaStealPercent || 0;
                bonusManaStealFlat += baseStats.manaStealFlat || 0;

            } else if (template) {
                // Fallback for old items without rolledBaseStats
                 if (template.statsBonus) {
                    for (const stat in template.statsBonus) {
                        const key = stat as keyof typeof template.statsBonus;
                        const bonusValue = template.statsBonus[key];
                        const baseBonus = getMaxValue(bonusValue as any);
                        totalPrimaryStats[key] = (totalPrimaryStats[key] || 0) + baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                    }
                }

                const baseDamageMin = getMaxValue(template.damageMin as any);
                const baseDamageMax = getMaxValue(template.damageMax as any);
                const baseMagicDamageMin = getMaxValue(template.magicDamageMin as any);
                const baseMagicDamageMax = getMaxValue(template.magicDamageMax as any);
                const baseArmor = getMaxValue(template.armorBonus as any);
                const baseCritChance = getMaxValue(template.critChanceBonus as any);
                const baseMaxHealth = getMaxValue(template.maxHealthBonus as any);
                
                bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeBonusFactor);
                bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeBonusFactor);
                bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeBonusFactor);
                bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeBonusFactor);
                bonusArmor += baseArmor + Math.round(baseArmor * upgradeBonusFactor);
                bonusCritChance += baseCritChance + (baseCritChance * upgradeBonusFactor);
                bonusMaxHealth += baseMaxHealth + Math.round(baseMaxHealth * upgradeBonusFactor);
                
                bonusCritDamageModifier += getMaxValue(template.critDamageModifierBonus as any);
                bonusArmorPenetrationPercent += getMaxValue(template.armorPenetrationPercent as any);
                bonusArmorPenetrationFlat += getMaxValue(template.armorPenetrationFlat as any);
                bonusLifeStealPercent += getMaxValue(template.lifeStealPercent as any);
                bonusLifeStealFlat += getMaxValue(template.lifeStealFlat as any);
                bonusManaStealPercent += getMaxValue(template.manaStealPercent as any);
                bonusManaStealFlat += getMaxValue(template.manaStealFlat as any);
            }

            if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
            if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
        }
    }
    
    const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    const baseAttacksPerRound = mainHandTemplate?.attacksPerRound || 1;
    const attacksPerRound = parseFloat((baseAttacksPerRound + bonusAttacksPerRound).toFixed(2));

    const baseHealth = 50, baseEnergy = 10, baseMana = 20, baseMinDamage = 1, baseMaxDamage = 2;

    const maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
    const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
    const maxMana = baseMana + totalPrimaryStats.intelligence * 10;
    
    let minDamage, maxDamage;
    if (mainHandTemplate?.isMagical) {
        minDamage = baseMinDamage + bonusDamageMin;
        maxDamage = baseMaxDamage + bonusDamageMax;
    } else {
        minDamage = baseMinDamage + (totalPrimaryStats.strength * 1) + bonusDamageMin;
        maxDamage = baseMaxDamage + (totalPrimaryStats.strength * 2) + bonusDamageMax;
    }
    
    const critChance = totalPrimaryStats.accuracy * 0.5 + bonusCritChance;
    const critDamageModifier = 200 + bonusCritDamageModifier;
    const armorPenetrationPercent = bonusArmorPenetrationPercent;
    const armorPenetrationFlat = bonusArmorPenetrationFlat;
    const lifeStealPercent = bonusLifeStealPercent;
    const lifeStealFlat = bonusLifeStealFlat;
    const manaStealPercent = bonusManaStealPercent;
    const manaStealFlat = bonusManaStealFlat;
    let dodgeChance = totalPrimaryStats.agility * 0.1 + bonusDodgeChance;

    let armor = bonusArmor;
    let manaRegen = totalPrimaryStats.intelligence * 2;

    if (character.race === Race.Dwarf) armor += 5;
    if (character.race === Race.Elf) manaRegen += 10;
    if (character.race === Race.Gnome) dodgeChance += 10;
    
    const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
    const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
    const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

    const currentHealth = Math.min(character.stats.currentHealth, maxHealth);
    const currentMana = Math.min(character.stats.currentMana, maxMana);
    const currentEnergy = Math.min(character.stats.currentEnergy, maxEnergy);

    return {
        ...character,
        stats: {
            ...character.stats, ...totalPrimaryStats,
            maxHealth, maxEnergy, maxMana, minDamage, maxDamage, critChance, armor,
            magicDamageMin, magicDamageMax, attacksPerRound, manaRegen,
            currentHealth, currentMana, currentEnergy,
            critDamageModifier, armorPenetrationPercent, armorPenetrationFlat,
            lifeStealPercent, lifeStealFlat, manaStealPercent, manaStealFlat,
            dodgeChance,
        }
    };
}