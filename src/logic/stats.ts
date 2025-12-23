
import { PlayerCharacter, ItemTemplate, Affix, CharacterStats, EquipmentSlot, Race, RolledAffixStats, Skill, GuildBuff, EssenceType, CharacterClass, CraftingSettings, ItemSet } from '../types.js';

export const calculateTotalExperience = (level: number, currentExperience: number | string): number => {
    let totalXp = Number(currentExperience);
    for (let i = 1; i < level; i++) {
        const xpForPrevLevel = Math.floor(100 * Math.pow(i, 1.3));
        totalXp += xpForPrevLevel;
    }
    return totalXp;
};

// Oblicza dynamiczny zakres poziomów dla PvP (rośnie wraz z levelem)
export const calculatePvPRange = (level: number): number => {
    return 3 + Math.floor(level / 7);
};

export const getBackpackCapacity = (character: PlayerCharacter): number => 40 + ((character.backpack?.level || 1) - 1) * 10;
export const getTreasuryCapacity = (level: number) => Math.floor(500 * Math.pow(level, 1.8));

export const calculateDerivedStats = (
    character: PlayerCharacter, 
    itemTemplates: ItemTemplate[], 
    affixes: Affix[], 
    guildBarracksLevel: number = 0, 
    guildShrineLevel: number = 0, 
    skills: Skill[] = [],
    activeGuildBuffs: GuildBuff[] = [],
    itemSets: ItemSet[] = []
): PlayerCharacter => {
    
    const safeItemTemplates = Array.isArray(itemTemplates) ? itemTemplates : [];
    const safeAffixes = Array.isArray(affixes) ? affixes : [];
    const safeEquipment = character.equipment || {};
    const safeSkills = Array.isArray(skills) ? skills : [];

    const totalPrimaryStats: CharacterStats = {
        strength: Number(character.stats.strength) || 0, 
        agility: Number(character.stats.agility) || 0, 
        accuracy: Number(character.stats.accuracy) || 0,
        stamina: Number(character.stats.stamina) || 0, 
        intelligence: Number(character.stats.intelligence) || 0, 
        energy: Number(character.stats.energy) || 0,
        luck: Number(character.stats.luck) || 0,
        statPoints: character.stats.statPoints || 0,
        currentHealth: character.stats.currentHealth,
        maxHealth: 0,
        currentMana: character.stats.currentMana,
        maxMana: 0,
        currentEnergy: character.stats.currentEnergy,
        maxEnergy: 0,
        minDamage: 0,
        maxDamage: 0,
        magicDamageMin: 0,
        magicDamageMax: 0,
        armor: 0,
        critChance: 0,
        critDamageModifier: 200,
        attacksPerRound: 1,
        dodgeChance: 0,
        manaRegen: 0,
        armorPenetrationPercent: 0,
        armorPenetrationFlat: 0,
        lifeStealPercent: 0,
        lifeStealFlat: 0,
        manaStealPercent: 0,
        manaStealFlat: 0,
        expBonusPercent: 0,
        goldBonusPercent: 0,
        damageBonusPercent: 0,
        damageReductionPercent: 0
    };
    
    if (character.race === Race.Human) totalPrimaryStats.expBonusPercent += 10;
    if (character.race === Race.Gnome) totalPrimaryStats.goldBonusPercent += 20;

    if (guildShrineLevel > 0) totalPrimaryStats.luck += (guildShrineLevel * 5);

    if (activeGuildBuffs && activeGuildBuffs.length > 0) {
        const now = Date.now();
        activeGuildBuffs.forEach(buff => {
            if (buff.expiresAt > now) {
                for (const key in buff.stats) {
                    const statKey = key as keyof CharacterStats;
                    if (totalPrimaryStats[statKey] !== undefined) {
                        (totalPrimaryStats as any)[statKey] += (Number(buff.stats[statKey]) || 0);
                    }
                    if (key === 'expBonus') totalPrimaryStats.expBonusPercent += (Number(buff.stats[key]) || 0);
                }
            }
        });
    }

    let globalBonusDmgMin = 0, globalBonusDmgMax = 0;
    let mhWeaponBonusDmgMin = 0, mhWeaponBonusDmgMax = 0;
    let ohWeaponBonusDmgMin = 0, ohWeaponBonusDmgMax = 0;
    let bonusMagicDmgMin = 0, bonusMagicDmgMax = 0;
    let ohMagicDmgMin = 0, ohMagicDmgMax = 0;

    let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0, bonusDodgeChance = 0;
    let bonusAttacksPerRound = 0;
    let bonusCritDamageModifier = 0;
    let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
    let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
    let bonusManaStealPercent = 0, bonusManaStealFlat = 0;

    const isDualWieldActive = character.activeSkills?.includes('dual-wield-mastery');

    const applyStatsFromRolled = (source: RolledAffixStats, isMHWeapon: boolean, isOHWeapon: boolean) => {
        if (source.statsBonus) {
            for (const stat in source.statsBonus) {
                const val = Number((source.statsBonus as any)[stat]) || 0;
                (totalPrimaryStats as any)[stat] = ((totalPrimaryStats as any)[stat] || 0) + val;
            }
        }
        
        const dmgMin = Number(source.damageMin) || 0;
        const dmgMax = Number(source.damageMax) || 0;
        const mDmgMin = Number(source.magicDamageMin) || 0;
        const mDmgMax = Number(source.magicDamageMax) || 0;

        if (isMHWeapon) {
            mhWeaponBonusDmgMin += dmgMin;
            mhWeaponBonusDmgMax += dmgMax;
            bonusMagicDmgMin += mDmgMin;
            bonusMagicDmgMax += mDmgMax;
        } else if (isOHWeapon) {
            ohWeaponBonusDmgMin += dmgMin;
            ohWeaponBonusDmgMax += dmgMax;
            ohMagicDmgMin += mDmgMin;
            ohMagicDmgMax += mDmgMax;
        } else {
            globalBonusDmgMin += dmgMin;
            globalBonusDmgMax += dmgMax;
            bonusMagicDmgMin += mDmgMin;
            bonusMagicDmgMax += mDmgMax;
        }

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

    const equippedAffixCounts: Record<string, number> = {};

    for (const slot in safeEquipment) {
        const item = safeEquipment[slot as EquipmentSlot];
        if (!item) continue;
        const template = safeItemTemplates.find(t => t.id === item.templateId);
        if (!template) continue;

        if (item.prefixId) equippedAffixCounts[item.prefixId] = (equippedAffixCounts[item.prefixId] || 0) + 1;
        if (item.suffixId) equippedAffixCounts[item.suffixId] = (equippedAffixCounts[item.suffixId] || 0) + 1;

        const isMH = slot === EquipmentSlot.MainHand || slot === EquipmentSlot.TwoHand;
        const isOH = slot === EquipmentSlot.OffHand;
        const upLvl = item.upgradeLevel || 0;
        const upFact = upLvl * 0.1;

        if (item.rolledBaseStats) {
            const base = item.rolledBaseStats;
            const applyUp = (v: number | undefined) => (Number(v) || 0) + Math.round((Number(v) || 0) * upFact);
            
            const upgradedSource: RolledAffixStats = {
                ...base,
                damageMin: applyUp(base.damageMin),
                damageMax: applyUp(base.damageMax),
                magicDamageMin: applyUp(base.magicDamageMin),
                magicDamageMax: applyUp(base.magicDamageMax),
                armorBonus: applyUp(base.armorBonus),
                maxHealthBonus: applyUp(base.maxHealthBonus),
                critChanceBonus: (Number(base.critChanceBonus) || 0) * (1 + upFact),
                critDamageModifierBonus: applyUp(base.critDamageModifierBonus),
                armorPenetrationFlat: applyUp(base.armorPenetrationFlat),
                lifeStealFlat: applyUp(base.lifeStealFlat),
                manaStealFlat: applyUp(base.manaStealFlat)
            };
            applyStatsFromRolled(upgradedSource, isMH, isOH);
        }
        if (item.rolledPrefix) applyStatsFromRolled(item.rolledPrefix, isMH, isOH);
        if (item.rolledSuffix) applyStatsFromRolled(item.rolledSuffix, isMH, isOH);
    }

    if (Array.isArray(itemSets)) {
        itemSets.forEach(set => {
            const count = equippedAffixCounts[set.affixId] || 0;
            if (count > 0) {
                const reachedTiers = set.tiers
                    .filter(t => count >= t.requiredPieces)
                    .sort((a, b) => b.requiredPieces - a.requiredPieces);
                
                if (reachedTiers.length > 0) {
                    const bestTier = reachedTiers[0];
                    for (const key in bestTier.bonuses) {
                        const val = Number((bestTier.bonuses as any)[key]) || 0;
                        if (totalPrimaryStats[key as keyof CharacterStats] !== undefined) {
                            (totalPrimaryStats as any)[key] += val;
                        }
                    }
                }
            }
        });
    }
    
    const mhItem = safeEquipment[EquipmentSlot.MainHand] || safeEquipment[EquipmentSlot.TwoHand];
    const ohItem = safeEquipment[EquipmentSlot.OffHand];
    const mhTemplate = mhItem ? safeItemTemplates.find(t => t.id === mhItem.templateId) : null;
    const ohTemplate = ohItem ? safeItemTemplates.find(t => t.id === ohItem.templateId) : null;
    
    const baseAPR = Number(mhTemplate?.attacksPerRound) || 1;
    const attacksPerRound = parseFloat((baseAPR + bonusAttacksPerRound).toFixed(2));

    let maxHealth = 50 + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
    let maxMana = 20 + totalPrimaryStats.intelligence * 10;
    if (character.activeSkills) {
        character.activeSkills.forEach(sId => {
            const s = safeSkills.find(sk => sk.id === sId);
            if (s?.manaMaintenanceCost) maxMana -= s.manaMaintenanceCost;
        });
    }
    maxMana = Math.max(0, maxMana);
    
    let mhMin, mhMax;
    const attrDmg = mhTemplate?.isMagical ? 0 : (mhTemplate?.isRanged ? totalPrimaryStats.agility : totalPrimaryStats.strength);
    mhMin = 1 + (attrDmg * 1) + globalBonusDmgMin + mhWeaponBonusDmgMin;
    mhMax = 2 + (attrDmg * 2) + globalBonusDmgMax + mhWeaponBonusDmgMax;

    let ohMin = 0, ohMax = 0;
    if (isDualWieldActive && ohItem && ohTemplate?.category === 'Weapon') {
        const ohAttrDmg = ohTemplate.isRanged ? totalPrimaryStats.agility : totalPrimaryStats.strength;
        ohMin = 1 + (ohAttrDmg * 1) + globalBonusDmgMin + ohWeaponBonusDmgMin;
        ohMax = 2 + (ohAttrDmg * 2) + globalBonusDmgMax + ohWeaponBonusDmgMax;
    }

    if (isDualWieldActive && ohItem) {
        mhMin = Math.floor(mhMin * 0.75);
        mhMax = Math.floor(mhMax * 0.75);
        ohMin = Math.floor(ohMin * 0.75);
        ohMax = Math.floor(ohMax * 0.75);
    }

    const intBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
    let mhMagMin = bonusMagicDmgMin > 0 ? bonusMagicDmgMin + intBonus : 0;
    let mhMagMax = bonusMagicDmgMax > 0 ? bonusMagicDmgMax + intBonus : 0;
    let ohMagMin = ohMagicDmgMin > 0 ? ohMagicDmgMin + intBonus : 0;
    let ohMagMax = ohMagicDmgMax > 0 ? ohMagicDmgMax + intBonus : 0;

    if (isDualWieldActive && ohItem) {
        mhMagMin = Math.floor(mhMagMin * 0.75);
        mhMagMax = Math.floor(mhMagMax * 0.75);
        ohMagMin = Math.floor(ohMagMin * 0.75);
        ohMagMax = Math.floor(ohMagMax * 0.75);
    }

    if (guildBarracksLevel > 0) {
        const mult = 1 + (guildBarracksLevel * 0.05);
        mhMin = Math.floor(mhMin * mult); mhMax = Math.floor(mhMax * mult);
        ohMin = Math.floor(ohMin * mult); ohMax = Math.floor(ohMax * mult);
        mhMagMin = Math.floor(mhMagMin * mult); mhMagMax = Math.floor(mhMagMax * mult);
        ohMagMin = Math.floor(ohMagMin * mult); ohMax = Math.floor(ohMax * mult);
    }

    if (totalPrimaryStats.damageBonusPercent > 0) {
        const mult = 1 + (totalPrimaryStats.damageBonusPercent / 100);
        mhMin = Math.floor(mhMin * mult); mhMax = Math.floor(mhMax * mult);
        ohMin = Math.floor(ohMin * mult); ohMax = Math.floor(ohMax * mult);
        mhMagMin = Math.floor(mhMagMin * mult); mhMagMax = Math.floor(mhMagMax * mult);
        ohMagMin = Math.floor(ohMagMin * mult); ohMax = Math.floor(ohMax * mult);
    }

    return {
        ...character,
        stats: {
            ...character.stats, ...totalPrimaryStats,
            maxHealth, maxMana,
            minDamage: mhMin, maxDamage: mhMax,
            offHandMinDamage: ohMin, offHandMaxDamage: ohMax,
            magicDamageMin: mhMagMin, magicDamageMax: mhMagMax,
            offHandMagicDamageMin: ohMagMin, offHandMagicDamageMax: ohMagMax,
            attacksPerRound, 
            currentHealth: Math.min(character.stats.currentHealth ?? maxHealth, maxHealth),
            currentMana: Math.min(character.stats.currentMana ?? maxMana, maxMana),
            currentEnergy: Math.min(character.stats.currentEnergy ?? 10, 10 + Math.floor(totalPrimaryStats.energy / 2)),
            maxEnergy: 10 + Math.floor(totalPrimaryStats.energy / 2),
            armor: bonusArmor + (character.race === Race.Dwarf ? 5 : 0),
            critChance: totalPrimaryStats.accuracy * 0.1 + bonusCritChance,
            critDamageModifier: 200 + bonusCritDamageModifier,
            dodgeChance: Math.min(30, totalPrimaryStats.agility * 0.1 + bonusDodgeChance + (character.race === Race.Gnome ? 10 : 0)),
            manaRegen: totalPrimaryStats.intelligence * 2 + (character.race === Race.Elf ? 10 : 0),
            armorPenetrationPercent: bonusArmorPenetrationPercent,
            armorPenetrationFlat: bonusArmorPenetrationFlat,
            lifeStealPercent: bonusLifeStealPercent,
            lifeStealFlat: bonusLifeStealFlat,
            manaStealPercent: bonusManaStealPercent,
            manaStealFlat: bonusManaStealFlat,
        }
    };
};

export const getCampUpgradeCost = (level: number) => { const gold = Math.floor(150 * Math.pow(level, 1.5)); const essences: { type: EssenceType, amount: number }[] = []; if (level >= 5 && level <= 7) essences.push({ type: EssenceType.Common, amount: (level - 4) * 2 }); if (level >= 8) essences.push({ type: EssenceType.Common, amount: 6 }, { type: EssenceType.Uncommon, amount: level - 7 }); return { gold, essences }; };
export const getTreasuryUpgradeCost = (level: number) => { const gold = Math.floor(200 * Math.pow(level, 1.6)); const essences: { type: EssenceType, amount: number }[] = []; if (level >= 4 && level <= 6) essences.push({ type: EssenceType.Common, amount: level * 2 }); if (level >= 7) essences.push({ type: EssenceType.Uncommon, amount: Math.floor(level / 2) }); return { gold, essences }; };
export const getChestUpgradeCost = getTreasuryUpgradeCost;
export const getWarehouseUpgradeCost = (level: number) => { const baseCost = getTreasuryUpgradeCost(level); return { gold: baseCost.gold * 2, essences: baseCost.essences.map(e => ({ type: e.type, amount: e.amount * 2 })) }; };
export const getBackpackUpgradeCost = (level: number) => { const gold = Math.floor(150 * Math.pow(level, 1.5)); const essences: { type: EssenceType, amount: number }[] = []; if (level >= 4 && level <= 6) essences.push({ type: EssenceType.Common, amount: (level - 3) * 5 }); if (level >= 7 && level <= 8) essences.push({ type: EssenceType.Uncommon, amount: (level - 6) * 3 }); if (level >= 9) essences.push({ type: EssenceType.Rare, amount: level - 8 }); return { gold, essences }; };
export const getWarehouseCapacity = (level: number) => { return 5 + ((level - 1) * 3); };
export const getWorkshopUpgradeCost = (level: number, settings?: CraftingSettings) => { if (settings && settings.workshopUpgrades && settings.workshopUpgrades[level]) { return settings.workshopUpgrades[level]; } const gold = Math.floor(300 * Math.pow(level, 1.6)); const essences: { type: EssenceType, amount: number }[] = []; if (level >= 2 && level <= 4) essences.push({ type: EssenceType.Common, amount: (level - 1) * 3 }); if (level >= 5 && level <= 7) essences.push({ type: EssenceType.Uncommon, amount: (level - 4) * 2 }); if (level >= 8) essences.push({ type: EssenceType.Rare, amount: level - 7 }); return { gold, essences }; };
