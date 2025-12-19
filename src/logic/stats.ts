import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, EquipmentSlot, Race, RolledAffixStats, Skill, GuildBuff, EssenceType, CharacterClass } from '../types';

/**
 * STAŁE FORMUIŁY GRY (Single Source of Truth)
 */
export const getBackpackCapacity = (character: PlayerCharacter): number => 40 + ((character.backpack?.level || 1) - 1) * 10;
export const getWarehouseCapacity = (level: number): number => 5 + ((level - 1) * 3);
export const getTreasuryCapacity = (level: number): number => Math.floor(500 * Math.pow(level, 1.8));

export const calculateTotalExperience = (level: number, currentExperience: number | string): number => {
    let totalXp = Number(currentExperience);
    for (let i = 1; i < level; i++) {
        const xpForPrevLevel = Math.floor(100 * Math.pow(i, 1.3));
        totalXp += xpForPrevLevel;
    }
    return totalXp;
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

// Added export alias for TreasuryPanel compatibility
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

export const getWorkshopUpgradeCost = (level: number, settings?: any) => {
    if (settings?.workshopUpgrades?.[level]) return settings.workshopUpgrades[level];
    const gold = Math.floor(300 * Math.pow(level, 1.6));
    const essences: { type: EssenceType, amount: number }[] = [];
    if (level >= 2 && level <= 4) essences.push({ type: EssenceType.Common, amount: (level - 1) * 3 });
    if (level >= 5 && level <= 7) essences.push({ type: EssenceType.Uncommon, amount: (level - 4) * 2 });
    if (level >= 8) essences.push({ type: EssenceType.Rare, amount: level - 7 });
    return { gold, essences };
};

/**
 * GŁÓWNY SILNIK STATYSTYK
 */
export const calculateDerivedStats = (
    character: PlayerCharacter, 
    itemTemplates: ItemTemplate[], 
    affixes: Affix[], 
    guildBarracksLevel: number = 0, 
    guildShrineLevel: number = 0, 
    skills: Skill[] = [],
    activeGuildBuffs: GuildBuff[] = []
): PlayerCharacter => {
    
    const safeItemTemplates = Array.isArray(itemTemplates) ? itemTemplates : [];
    const safeAffixes = Array.isArray(affixes) ? affixes : [];
    const safeEquipment = character.equipment || {};

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
    
    if (guildShrineLevel > 0) totalPrimaryStats.luck += (guildShrineLevel * 5);

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
                    if (key === 'attacksPerRound') bonusAttacksFromBuffs += (Number(buff.stats[key as keyof CharacterStats]) || 0);
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
        if (itemInstance && typeof itemInstance === 'object') {
            const template = safeItemTemplates.find(t => t.id === itemInstance.templateId);
            if (!template) continue;
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
                bonusCritDamageModifier += applyUpgrade(baseStats.critDamageModifierBonus);
                bonusArmorPenetrationFlat += applyUpgrade(baseStats.armorPenetrationFlat);
                bonusLifeStealFlat += applyUpgrade(baseStats.lifeStealFlat);
                bonusManaStealFlat += applyUpgrade(baseStats.manaStealFlat);
                bonusArmorPenetrationPercent += Number(baseStats.armorPenetrationPercent) || 0;
                bonusLifeStealPercent += Number(baseStats.lifeStealPercent) || 0;
                bonusManaStealPercent += Number(baseStats.manaStealPercent) || 0;
            } else if (template) {
                // Obsługa szablonów bez rolledBaseStats
                const baseDamageMin = getMaxValue(template.damageMin as any);
                const baseDamageMax = getMaxValue(template.damageMax as any);
                bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeBonusFactor);
                bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeBonusFactor);
                // ... (pozostałe statystyki szablonu)
            }
            if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
            if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
        }
    }
    
    // --- LOGIKA SZTUKI DWÓCH MIECZY ---
    const isDualWieldActive = character.activeSkills?.includes('dual-wield-mastery');
    const mainHandItem = safeEquipment[EquipmentSlot.MainHand];
    const offHandItem = safeEquipment[EquipmentSlot.OffHand];
    const mainHandTemplate = mainHandItem ? safeItemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    const offHandTemplate = offHandItem ? safeItemTemplates.find(t => t.id === offHandItem.templateId) : null;

    const isActuallyDualWielding = isDualWieldActive && mainHandItem && offHandItem && 
        mainHandTemplate?.category === 'Weapon' && offHandTemplate?.category === 'Weapon';

    let baseAttacksPerRound = Number(mainHandTemplate?.attacksPerRound) || 1;
    if (isActuallyDualWielding && offHandTemplate) {
        baseAttacksPerRound += (Number(offHandTemplate.attacksPerRound) || 1);
    }
    // ---------------------------------

    const attacksPerRound = parseFloat((baseAttacksPerRound + bonusAttacksPerRound + bonusAttacksFromBuffs).toFixed(2)) || 1;
    const baseHealth = 50, baseEnergy = 10, baseMana = 20, baseMinDamage = 1, baseMaxDamage = 2;
    
    let maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
    const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
    let maxMana = baseMana + totalPrimaryStats.intelligence * 10;

    // Konserwacja many umiejętności aktywnych
    if (character.activeSkills) {
        character.activeSkills.forEach(skillId => {
            const s = skills.find(sk => sk.id === skillId);
            if (s?.manaMaintenanceCost) maxMana -= s.manaMaintenanceCost;
        });
    }
    maxMana = Math.max(0, maxMana);
    
    let minDamage, maxDamage;
    if (mainHandTemplate?.isMagical) {
        minDamage = baseMinDamage + Math.floor(totalPrimaryStats.strength * 0.5) + bonusDamageMin;
        maxDamage = baseMaxDamage + Math.floor(totalPrimaryStats.strength * 1.0) + bonusDamageMax;
    } else if (mainHandTemplate?.isRanged) {
        minDamage = baseMinDamage + (totalPrimaryStats.agility * 1) + bonusDamageMin;
        maxDamage = baseMaxDamage + (totalPrimaryStats.agility * 2) + bonusDamageMax;
    } else {
        minDamage = baseMinDamage + (totalPrimaryStats.strength * 1) + bonusDamageMin;
        maxDamage = baseMaxDamage + (totalPrimaryStats.strength * 2) + bonusDamageMax;
    }

    if (isActuallyDualWielding) {
        minDamage = Math.floor(minDamage * 0.75);
        maxDamage = Math.floor(maxDamage * 0.75);
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
    let magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
    let magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

    if (isActuallyDualWielding) {
        magicDamageMin = Math.floor(magicDamageMin * 0.75);
        magicDamageMax = Math.floor(magicDamageMax * 0.75);
    }

    if (guildBarracksLevel > 0) {
        const mult = 1 + (guildBarracksLevel * 0.05);
        minDamage = Math.floor(minDamage * mult);
        maxDamage = Math.floor(maxDamage * mult);
        magicDamageMin = Math.floor(magicDamageMin * mult);
        magicDamageMax = Math.floor(magicDamageMax * mult);
    }
    
    const currentHealth = Math.min(Number(character.stats.currentHealth) ?? maxHealth, maxHealth);
    const currentMana = Math.min(Number(character.stats.currentMana) ?? maxMana, maxMana);
    const currentEnergy = Math.min(Number(character.stats.currentEnergy) ?? maxEnergy, maxEnergy);

    return {
        ...character,
        stats: {
            ...character.stats, ...totalPrimaryStats,
            maxHealth, maxEnergy, maxMana, 
            minDamage, maxDamage, 
            critChance, armor,
            magicDamageMin, magicDamageMax, 
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