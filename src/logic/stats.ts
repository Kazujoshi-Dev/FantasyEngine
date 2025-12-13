
import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, EquipmentSlot, Race, RolledAffixStats, Skill, GuildBuff, EssenceType } from '../types';

export const calculateTotalExperience = (level: number, currentExperience: number | string): number => {
    let totalXp = Number(currentExperience);
    for (let i = 1; i < level; i++) {
        const xpForPrevLevel = Math.floor(100 * Math.pow(i, 1.3));
        totalXp += xpForPrevLevel;
    }
    return totalXp;
};

export const calculateDerivedStats = (
    character: PlayerCharacter, 
    itemTemplates: ItemTemplate[], 
    affixes: Affix[], 
    guildBarracksLevel: number = 0, 
    guildShrineLevel: number = 0, 
    skills: Skill[] = [],
    activeGuildBuffs: GuildBuff[] = []
): PlayerCharacter => {
    
    // Safety checks: ensure arrays are actually arrays
    const safeItemTemplates = Array.isArray(itemTemplates) ? itemTemplates : [];
    const safeAffixes = Array.isArray(affixes) ? affixes : [];
    const safeEquipment = character.equipment || {};
    const safeSkills = Array.isArray(skills) ? skills : [];

    const getMaxValue = (value: number | { min: number; max: number } | undefined): number => {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'object' && 'max' in value) return value.max;
        return 0;
    };

    const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy' | 'luck'> = {
        strength: Number(character.stats.strength) || 0, 
        agility: Number(character.stats.agility) || 0, 
        accuracy: Number(character.stats.accuracy) || 0,
        stamina: Number(character.stats.stamina) || 0, 
        intelligence: Number(character.stats.intelligence) || 0, 
        energy: Number(character.stats.energy) || 0,
        luck: Number(character.stats.luck) || 0,
    };
    
    if (guildShrineLevel > 0) {
        totalPrimaryStats.luck += (guildShrineLevel * 5);
    }

    let bonusAttacksFromBuffs = 0;

    if (activeGuildBuffs && activeGuildBuffs.length > 0) {
        const now = Date.now();
        activeGuildBuffs.forEach(buff => {
            if (buff.expiresAt > now) {
                for (const key in buff.stats) {
                    const statKey = key as keyof typeof totalPrimaryStats;
                    if (totalPrimaryStats[statKey] !== undefined) {
                        totalPrimaryStats[statKey] += (Number(buff.stats[statKey as keyof CharacterStats]) || 0);
                    }
                    if (key === 'attacksPerRound') {
                        bonusAttacksFromBuffs += (Number(buff.stats[key]) || 0);
                    }
                }
            }
        });
    }

    let bonusDamageMin = 0, bonusDamageMax = 0, bonusMagicDamageMin = 0, bonusMagicDamageMax = 0;
    let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0, bonusDodgeChance = 0;
    let bonusAttacksPerRound = 0;
    let bonusCritDamageModifier = 0;
    let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
    let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
    let bonusManaStealPercent = 0, bonusManaStealFlat = 0;

    // Helper to apply stats from rolled affixes with cap at upgrade +5
    const applyAffixBonuses = (source: RolledAffixStats, affixUpgradeBonusFactor: number) => {
        const applyUpgrade = (val: number | undefined) => (Number(val) || 0) + Math.round((Number(val) || 0) * affixUpgradeBonusFactor);
        const applyFloatUpgrade = (val: number | undefined) => (Number(val) || 0) + ((Number(val) || 0) * affixUpgradeBonusFactor);

        if (source.statsBonus) {
            for (const stat in source.statsBonus) {
                const key = stat as keyof typeof source.statsBonus;
                const val = Number(source.statsBonus[key]) || 0;
                (totalPrimaryStats as any)[key] = ((totalPrimaryStats as any)[key] || 0) + val + Math.round(val * affixUpgradeBonusFactor);
            }
        }
        bonusDamageMin += applyUpgrade(source.damageMin);
        bonusDamageMax += applyUpgrade(source.damageMax);
        bonusMagicDamageMin += applyUpgrade(source.magicDamageMin);
        bonusMagicDamageMax += applyUpgrade(source.magicDamageMax);
        bonusArmor += applyUpgrade(source.armorBonus);
        bonusCritChance += applyFloatUpgrade(source.critChanceBonus);
        bonusMaxHealth += applyUpgrade(source.maxHealthBonus);
        bonusCritDamageModifier += applyUpgrade(source.critDamageModifierBonus);
        bonusArmorPenetrationPercent += applyUpgrade(source.armorPenetrationPercent);
        bonusArmorPenetrationFlat += applyUpgrade(source.armorPenetrationFlat);
        bonusLifeStealPercent += applyUpgrade(source.lifeStealPercent);
        bonusLifeStealFlat += applyUpgrade(source.lifeStealFlat);
        bonusManaStealPercent += applyUpgrade(source.manaStealPercent);
        bonusManaStealFlat += applyUpgrade(source.manaStealFlat);
        
        bonusAttacksPerRound += Number(source.attacksPerRoundBonus) || 0;
        bonusDodgeChance += applyFloatUpgrade(source.dodgeChanceBonus);
    };

    for (const slot in safeEquipment) {
        const itemInstance = safeEquipment[slot as EquipmentSlot];
        if (itemInstance && typeof itemInstance === 'object') {
            const template = safeItemTemplates.find(t => t.id === itemInstance.templateId);
            if (!template) continue;

            const upgradeLevel = itemInstance.upgradeLevel || 0;
            // Base items scale infinitely (10% per level)
            const upgradeBonusFactor = upgradeLevel * 0.1;
            // Affixes scale only up to level 5 (50% max)
            const affixUpgradeBonusFactor = Math.min(upgradeLevel, 5) * 0.1;

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
                
                bonusCritDamageModifier += applyUpgrade(baseStats.critDamageModifierBonus);
                bonusArmorPenetrationFlat += applyUpgrade(baseStats.armorPenetrationFlat);
                bonusLifeStealFlat += applyUpgrade(baseStats.lifeStealFlat);
                bonusManaStealFlat += applyUpgrade(baseStats.manaStealFlat);

                bonusArmorPenetrationPercent += Number(baseStats.armorPenetrationPercent) || 0;
                bonusLifeStealPercent += Number(baseStats.lifeStealPercent) || 0;
                bonusManaStealPercent += Number(baseStats.manaStealPercent) || 0;

            } else if (template) {
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

            if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix, affixUpgradeBonusFactor);
            if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix, affixUpgradeBonusFactor);
        }
    }
    
    const mainHandItem = safeEquipment[EquipmentSlot.MainHand] || safeEquipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? safeItemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    
    const baseAttacksPerRound = Number(mainHandTemplate?.attacksPerRound) || 1;
    const calculatedAPR = baseAttacksPerRound + bonusAttacksPerRound + bonusAttacksFromBuffs;
    const attacksPerRound = !isNaN(calculatedAPR) ? parseFloat(calculatedAPR.toFixed(2)) : 1;

    const baseHealth = 50, baseEnergy = 10, baseMana = 20, baseMinDamage = 1, baseMaxDamage = 2;

    let maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
    if (isNaN(maxHealth) || maxHealth < 1) maxHealth = 50;

    const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
    let maxMana = baseMana + totalPrimaryStats.intelligence * 10;

    if (character.activeSkills && character.activeSkills.length > 0) {
        character.activeSkills.forEach(skillId => {
            const skill = safeSkills.find(s => s.id === skillId);
            if (skill && skill.manaMaintenanceCost) {
                maxMana -= skill.manaMaintenanceCost;
            }
        });
    }
    maxMana = Math.max(0, maxMana);
    
    let minDamage, maxDamage;
    if (mainHandTemplate?.isMagical) {
        minDamage = baseMinDamage + bonusDamageMin;
        maxDamage = baseMaxDamage + bonusDamageMax;
    } else if (mainHandTemplate?.isRanged) {
        minDamage = baseMinDamage + (totalPrimaryStats.agility * 1) + bonusDamageMin;
        maxDamage = baseMaxDamage + (totalPrimaryStats.agility * 2) + bonusDamageMax;
    } else {
        minDamage = baseMinDamage + (totalPrimaryStats.strength * 1) + bonusDamageMin;
        maxDamage = baseMaxDamage + (totalPrimaryStats.strength * 2) + bonusDamageMax;
    }
    
    const critChance = totalPrimaryStats.accuracy * 0.5 + bonusCritChance;
    const critDamageModifier = 200 + bonusCritDamageModifier;
    let dodgeChance = totalPrimaryStats.agility * 0.1 + bonusDodgeChance;

    let armor = bonusArmor;
    let manaRegen = totalPrimaryStats.intelligence * 2;

    if (character.race === Race.Dwarf) armor += 5;
    if (character.race === Race.Elf) manaRegen += 10;
    if (character.race === Race.Gnome) dodgeChance += 10;
    
    const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
    const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
    const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

    let finalMagicDamageMin = magicDamageMin;
    let finalMagicDamageMax = magicDamageMax;

    if (guildBarracksLevel > 0) {
        const damageMultiplier = 1 + (guildBarracksLevel * 0.05);
        minDamage = Math.floor(minDamage * damageMultiplier);
        maxDamage = Math.floor(maxDamage * damageMultiplier);
        
        finalMagicDamageMin = Math.floor(magicDamageMin * damageMultiplier);
        finalMagicDamageMax = Math.floor(magicDamageMax * damageMultiplier);
    }
    
    const valOrMax = (val: any, max: number) => {
        const num = Number(val);
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
            maxHealth, maxEnergy, maxMana, 
            minDamage, maxDamage, 
            critChance, armor,
            magicDamageMin: finalMagicDamageMin, 
            magicDamageMax: finalMagicDamageMax, 
            attacksPerRound, manaRegen,
            currentHealth, currentMana, currentEnergy,
            critDamageModifier,
            armorPenetrationPercent: bonusArmorPenetrationPercent,
            armorPenetrationFlat: bonusArmorPenetrationFlat,
            lifeStealPercent: bonusLifeStealPercent,
            lifeStealFlat: bonusLifeStealFlat,
            manaStealPercent: bonusManaStealPercent,
            manaStealFlat: bonusManaStealFlat,
            dodgeChance
        }
    };
};

export const getCampUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 5 && level <= 7) essences.push({ type: EssenceType.Common, amount: (level - 4) * 2 });
    if (level >= 8) essences.push({ type: EssenceType.Common, amount: 6 }, { type: EssenceType.Uncommon, amount: level - 7 });
    return { gold, essences };
};

export const getTreasuryUpgradeCost = (level: number) => {
    const gold = Math.floor(200 * Math.pow(level, 1.6));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 4 && level <= 6) essences.push({ type: EssenceType.Common, amount: level * 2 });
    if (level >= 7) essences.push({ type: EssenceType.Uncommon, amount: Math.floor(level / 2) });
    return { gold, essences };
};

export const getChestUpgradeCost = getTreasuryUpgradeCost;

export const getWarehouseUpgradeCost = (level: number) => {
    const baseCost = getTreasuryUpgradeCost(level);
    return {
        gold: baseCost.gold * 2,
        essences: baseCost.essences.map(e => ({ type: e.type, amount: e.amount * 2 }))
    };
};

export const getBackpackUpgradeCost = (level: number) => {
    const gold = Math.floor(150 * Math.pow(level, 1.5));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 4 && level <= 6) essences.push({ type: EssenceType.Common, amount: (level - 3) * 5 });
    if (level >= 7 && level <= 8) essences.push({ type: EssenceType.Uncommon, amount: (level - 6) * 3 });
    if (level >= 9) essences.push({ type: EssenceType.Rare, amount: level - 8 });
    return { gold, essences };
};

export const getWarehouseCapacity = (level: number) => {
    return 5 + ((level - 1) * 3);
};
