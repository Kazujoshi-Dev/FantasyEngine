

import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, EquipmentSlot, Race, RolledAffixStats } from '../types.js';

export const calculateTotalExperience = (level: number, currentExperience: number | string): number => {
    // The pg driver returns bigint as a string, so we must cast to Number
    // to prevent string concatenation.
    let totalXp = Number(currentExperience);
    
    // Sum up the experience required for all previous levels
    for (let i = 1; i < level; i++) {
        const xpForPrevLevel = Math.floor(100 * Math.pow(i, 1.3));
        totalXp += xpForPrevLevel;
    }
    return totalXp;
};

export const calculateDerivedStatsOnServer = (character: PlayerCharacter, itemTemplates: ItemTemplate[], affixes: Affix[], guildBarracksLevel: number = 0): PlayerCharacter => {
    
    // Ensure arrays exist to prevent crashes if gameData is partial
    const safeItemTemplates = itemTemplates || [];
    const safeAffixes = affixes || [];
    const safeEquipment = character.equipment || {};

    const getMaxValue = (value: number | { min: number; max: number } | undefined): number => {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'object' && 'max' in value) return value.max;
        return 0;
    };

    // Initialize base stats from character (ensure they are numbers)
    const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy' | 'luck'> = {
        strength: Number(character.stats.strength) || 0, 
        agility: Number(character.stats.agility) || 0, 
        accuracy: Number(character.stats.accuracy) || 0,
        stamina: Number(character.stats.stamina) || 0, 
        intelligence: Number(character.stats.intelligence) || 0, 
        energy: Number(character.stats.energy) || 0,
        luck: Number(character.stats.luck) || 0,
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
                const val = Number(source.statsBonus[key]) || 0;
                (totalPrimaryStats as any)[key] = ((totalPrimaryStats as any)[key] || 0) + val;
            }
        }
        bonusDamageMin += Number(source.damageMin) || 0;
        bonusDamageMax += Number(source.damageMax) || 0;
        bonusMagicDamageMin += Number(source.magicDamageMin) || 0;
        bonusMagicDamageMax += Number(source.magicDamageMax) || 0;
        bonusArmor += Number(source.armorBonus) || 0;
        bonusCritChance += Number(source.critChanceBonus) || 0;
        bonusMaxHealth += Number(source.maxHealthBonus) || 0;
        bonusCritDamageModifier += Number(source.critDamageModifierBonus) || 0;
        bonusArmorPenetrationPercent += Number(source.armorPenetrationPercent) || 0;
        bonusArmorPenetrationFlat += Number(source.armorPenetrationFlat) || 0;
        bonusLifeStealPercent += Number(source.lifeStealPercent) || 0;
        bonusLifeStealFlat += Number(source.lifeStealFlat) || 0;
        bonusManaStealPercent += Number(source.manaStealPercent) || 0;
        bonusManaStealFlat += Number(source.manaStealFlat) || 0;
        bonusAttacksPerRound += Number(source.attacksPerRoundBonus) || 0;
        bonusDodgeChance += Number(source.dodgeChanceBonus) || 0;
    };

    for (const slot in safeEquipment) {
        const itemInstance = safeEquipment[slot as EquipmentSlot];
        // Must check if itemInstance exists AND is an object (not null)
        if (itemInstance && typeof itemInstance === 'object') {
            const template = safeItemTemplates.find(t => t.id === itemInstance.templateId);
            
            // CRITICAL FIX: If template is missing, skip this item entirely.
            // This prevents the crash where code tries to access properties of undefined.
            if (!template) {
                console.warn(`[Stats] Missing template for item ${itemInstance.uniqueId} in slot ${slot}. Skipping.`);
                continue;
            }

            const upgradeLevel = itemInstance.upgradeLevel || 0;
            const upgradeBonusFactor = upgradeLevel * 0.1;

            if (itemInstance.rolledBaseStats) {
                const baseStats = itemInstance.rolledBaseStats;
                const applyUpgrade = (val: number | undefined) => (Number(val) || 0) + Math.round((Number(val) || 0) * upgradeBonusFactor);
                
                if (baseStats.statsBonus) {
                    for (const stat in baseStats.statsBonus) {
                        const key = stat as keyof typeof baseStats.statsBonus;
                        const baseBonus = Number(baseStats.statsBonus[key]) || 0;
                        (totalPrimaryStats as any)[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                    }
                }
                
                bonusDamageMin += applyUpgrade(baseStats.damageMin);
                bonusDamageMax += applyUpgrade(baseStats.damageMax);
                bonusMagicDamageMin += applyUpgrade(baseStats.magicDamageMin);
                bonusMagicDamageMax += applyUpgrade(baseStats.magicDamageMax);
                bonusArmor += applyUpgrade(baseStats.armorBonus);
                bonusMaxHealth += applyUpgrade(baseStats.maxHealthBonus);
                bonusCritChance += (Number(baseStats.critChanceBonus) || 0) + ((Number(baseStats.critChanceBonus) || 0) * upgradeBonusFactor);
                
                // Apply upgrade to secondary stats
                bonusCritDamageModifier += applyUpgrade(baseStats.critDamageModifierBonus);
                bonusArmorPenetrationFlat += applyUpgrade(baseStats.armorPenetrationFlat);
                bonusLifeStealFlat += applyUpgrade(baseStats.lifeStealFlat);
                bonusManaStealFlat += applyUpgrade(baseStats.manaStealFlat);

                // Percentage based stats usually don't scale with upgrade level to avoid broken builds, 
                // but if desired, change logic here. Currently keeping them flat + bonus.
                bonusArmorPenetrationPercent += Number(baseStats.armorPenetrationPercent) || 0;
                bonusLifeStealPercent += Number(baseStats.lifeStealPercent) || 0;
                bonusManaStealPercent += Number(baseStats.manaStealPercent) || 0;

            } else if (template) {
                // Fallback for old items without rolledBaseStats
                 if (template.statsBonus) {
                    for (const stat in template.statsBonus) {
                        const key = stat as keyof typeof template.statsBonus;
                        const bonusValue = template.statsBonus[key];
                        const baseBonus = getMaxValue(bonusValue as any);
                        (totalPrimaryStats as any)[key] = ((totalPrimaryStats as any)[key] || 0) + baseBonus + Math.round(baseBonus * upgradeBonusFactor);
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
                
                // Apply upgrade to secondary stats using getMaxValue since template stores min/max objects usually
                const getBaseAndUpgrade = (prop: any) => {
                    const base = getMaxValue(prop);
                    return base + Math.round(base * upgradeBonusFactor);
                }

                bonusCritDamageModifier += getBaseAndUpgrade(template.critDamageModifierBonus);
                bonusArmorPenetrationFlat += getBaseAndUpgrade(template.armorPenetrationFlat);
                bonusLifeStealFlat += getBaseAndUpgrade(template.lifeStealFlat);
                bonusManaStealFlat += getBaseAndUpgrade(template.manaStealFlat);

                bonusArmorPenetrationPercent += getMaxValue(template.armorPenetrationPercent as any);
                bonusLifeStealPercent += getMaxValue(template.lifeStealPercent as any);
                bonusManaStealPercent += getMaxValue(template.manaStealPercent as any);
            }

            if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
            if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
        }
    }
    
    const mainHandItem = safeEquipment[EquipmentSlot.MainHand] || safeEquipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? safeItemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    
    // Ensure attacksPerRound is at least 1 and never NaN
    const baseAttacksPerRound = Number(mainHandTemplate?.attacksPerRound) || 1;
    const calculatedAPR = baseAttacksPerRound + bonusAttacksPerRound;
    const attacksPerRound = !isNaN(calculatedAPR) ? parseFloat(calculatedAPR.toFixed(2)) : 1;

    const baseHealth = 50, baseEnergy = 10, baseMana = 20, baseMinDamage = 1, baseMaxDamage = 2;

    let maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
    // Safety clamp for maxHealth to prevent 0 or negative
    if (isNaN(maxHealth) || maxHealth < 1) maxHealth = 50;

    const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
    const maxMana = baseMana + totalPrimaryStats.intelligence * 10;
    
    let minDamage, maxDamage;
    if (mainHandTemplate?.isMagical) {
        minDamage = baseMinDamage + bonusDamageMin;
        maxDamage = baseMaxDamage + bonusDamageMax;
    } else if (mainHandTemplate?.isRanged) {
        // Ranged weapons scale with Agility
        minDamage = baseMinDamage + (totalPrimaryStats.agility * 1) + bonusDamageMin;
        maxDamage = baseMaxDamage + (totalPrimaryStats.agility * 2) + bonusDamageMax;
    } else {
        // Melee weapons scale with Strength
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

    // Apply Guild Barracks Bonus (5% per level)
    if (guildBarracksLevel > 0) {
        const damageMultiplier = 1 + (guildBarracksLevel * 0.05);
        minDamage = Math.floor(minDamage * damageMultiplier);
        maxDamage = Math.floor(maxDamage * damageMultiplier);
        // Apply to magic damage as well (base + intelligence bonus)
        // Wait, intelligence bonus is part of base calculation? Yes. So we scale the final result.
        // But we need to update the specific variables.
    }
    
    // Recalculate Magic Damage with Guild Bonus
    const finalMagicDamageMin = guildBarracksLevel > 0 ? Math.floor(magicDamageMin * (1 + (guildBarracksLevel * 0.05))) : magicDamageMin;
    const finalMagicDamageMax = guildBarracksLevel > 0 ? Math.floor(magicDamageMax * (1 + (guildBarracksLevel * 0.05))) : magicDamageMax;

    // Ensure derived values are valid numbers and DO NOT default to max if 0 (fixes full heal bug)
    const valOrMax = (val: any, max: number) => {
        const num = Number(val);
        // If it is not a number (NaN) or explicitly null/undefined, use max (initial state).
        // BUT if it is 0, it stays 0.
        if (val === undefined || val === null || isNaN(num)) return max;
        return num;
    }

    const currentHealth = Math.min(valOrMax(character.stats.currentHealth, maxHealth), maxHealth);
    const currentMana = Math.min(valOrMax(character.stats.currentMana, maxMana), maxMana);
    const currentEnergy = Math.min(valOrMax(character.stats.currentEnergy, maxEnergy), maxEnergy);

    return {
        ...character,
        stats: {
            ...character.stats, ...totalPrimaryStats,
            maxHealth, maxEnergy, maxMana, minDamage, maxDamage, critChance, armor,
            magicDamageMin: finalMagicDamageMin, 
            magicDamageMax: finalMagicDamageMax, 
            attacksPerRound, manaRegen,
            currentHealth, currentMana, currentEnergy,
            critDamageModifier, armorPenetrationPercent, armorPenetrationFlat,
            lifeStealPercent, lifeStealFlat, manaStealPercent, manaStealFlat,
            dodgeChance,
        }
    };
}