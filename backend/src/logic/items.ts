
import { ItemInstance, ItemTemplate, Affix, RolledAffixStats, AffixType, GrammaticalGender, GameSettings, ItemRarity, TraderInventoryData, ItemCategory, EquipmentSlot, PlayerCharacter, LootDrop } from '../types.js';
import { randomUUID } from 'crypto';

// Helper for luck-based rolls
export const rollValueWithLuck = (minMax: number | { min: number; max: number } | undefined, luck: number = 0): number | undefined => {
    if (typeof minMax === 'number') return minMax;
    if (minMax === undefined || minMax === null) return undefined;
    const min = Math.min(minMax.min, minMax.max);
    const max = Math.max(minMax.min, minMax.max);
    if (min === max) return min;
    
    // Luck factor: 100 luck = 10% bonus to minimum roll range
    const luckFactor = Math.min(1, luck / 1000); // Cap at 100% bonus (1000 luck)
    const baseRoll = Math.random();
    // Weighted roll: instead of 0-1, roll is from luckFactor to 1.
    const weightedRoll = baseRoll * (1 - luckFactor) + luckFactor;

    // Use floor for integer stats, but ensure it can reach max
    return min + Math.floor(weightedRoll * (max - min + 1));
};

export const pickWeighted = <T extends { weight?: number }>(items: T[]): T | null => {
    if (!items || items.length === 0) return null;
    
    // Default weight to 1 if missing or 0 (unless we want 0 to mean impossible, but safe fallback 1 is better for migration)
    // Actually, 0 should mean impossible. For migration safety, we can use 'chance' if weight is missing, but Typescript says weight is mandatory now.
    // Let's assume input data might still have 'chance' if not fully migrated DB.
    // The items here are usually LootDrop[], Affix[], etc.
    
    const weightedItems = items.map(item => ({
        ...item,
        _effectiveWeight: (item as any).weight !== undefined ? (item as any).weight : ((item as any).chance || 0)
    }));

    const totalWeight = weightedItems.reduce((sum, item) => sum + item._effectiveWeight, 0);
    if (totalWeight <= 0) return null;

    let random = Math.random() * totalWeight;
    for (const item of weightedItems) {
        if (random < item._effectiveWeight) {
            return item;
        }
        random -= item._effectiveWeight;
    }
    return weightedItems[weightedItems.length - 1];
};


export const rollAffixStats = (affix: Affix, luck: number = 0): RolledAffixStats => {
    const rolled: RolledAffixStats = {};

    if (affix.statsBonus) {
        rolled.statsBonus = {};
        for (const key in affix.statsBonus) {
            const statKey = key as keyof typeof affix.statsBonus;
            const rolledStat = rollValueWithLuck(affix.statsBonus[statKey], luck);
            if (rolledStat !== undefined) {
                (rolled.statsBonus as any)[statKey] = rolledStat;
            }
        }
        if(Object.keys(rolled.statsBonus).length === 0) {
            delete rolled.statsBonus;
        }
    }
    
    const otherStatKeys: string[] = [
        'damageMin', 'damageMax', 'attacksPerRoundBonus', 'dodgeChanceBonus', 'armorBonus',
        'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent',
        'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent',
        'manaStealFlat', 'magicDamageMin', 'magicDamageMax'
    ];
    
    for (const key of otherStatKeys) {
        const val = (affix as any)[key] as { min: number, max: number } | undefined;
        const value = rollValueWithLuck(val, luck);
        if (value !== undefined) {
            (rolled as any)[key] = value;
        }
    }

    return rolled;
};

export const rollTemplateStats = (template: ItemTemplate, luck: number = 0): RolledAffixStats => {
    const rolled: RolledAffixStats = {};

    if (template.statsBonus) {
        rolled.statsBonus = {};
        for (const key in template.statsBonus) {
            const statKey = key as keyof typeof template.statsBonus;
            const rolledStat = rollValueWithLuck(template.statsBonus[statKey], luck);
            if (rolledStat !== undefined) {
                (rolled.statsBonus as any)[statKey] = rolledStat;
            }
        }
        if(Object.keys(rolled.statsBonus).length === 0) {
            delete rolled.statsBonus;
        }
    }
    
    const otherStatKeys: string[] = [
        'damageMin', 'damageMax', 'armorBonus',
        'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent',
        'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent',
        'manaStealFlat', 'magicDamageMin', 'magicDamageMax'
    ];
    
    for (const key of otherStatKeys) {
        const value = rollValueWithLuck((template as any)[key], luck);
        if (value !== undefined) {
            (rolled as any)[key] = value;
        }
    }

    return rolled;
};

export const getGrammaticallyCorrectFullName = (item: ItemInstance, template: ItemTemplate, affixes: Affix[]): string => {
    // Critical Fix: If template is undefined (e.g. item deleted from DB), return placeholder
    if (!template) return "Nieznany Przedmiot";

    const prefixAffix = affixes.find(a => a.id === item.prefixId);
    const suffixAffix = affixes.find(a => a.id === item.suffixId);
    
    let genderKey: 'masculine' | 'feminine' | 'neuter' = 'masculine';
    if (template.gender === GrammaticalGender.Feminine) {
        genderKey = 'feminine';
    } else if (template.gender === GrammaticalGender.Neuter) {
        genderKey = 'neuter';
    }
    
    const getName = (affix: Affix | undefined) => {
        if (!affix) return '';
        if (typeof affix.name === 'string') return affix.name;
        // TS should infer affix.name is the object here
        return affix.name[genderKey] || affix.name.masculine || '';
    };

    const prefixName = getName(prefixAffix);
    const suffixName = getName(suffixAffix);

    return [prefixName, template.name, suffixName].filter(Boolean).join(' ');
}

// Config for affix chances based on Item Rarity
const affixChanceByRarity: Record<ItemRarity, number> = {
    [ItemRarity.Common]: 5,     // 5% chance
    [ItemRarity.Uncommon]: 20,  // 20% chance
    [ItemRarity.Rare]: 50,      // 50% chance
    [ItemRarity.Epic]: 80,      // 80% chance
    [ItemRarity.Legendary]: 100 // Always has affixes
};

export const createItemInstance = (templateId: string, allItemTemplates: ItemTemplate[], allAffixes: Affix[], character?: PlayerCharacter, allowAffixes = true): ItemInstance => {
    const template = allItemTemplates.find(t => t.id === templateId);
    if (!template) {
        return { uniqueId: randomUUID(), templateId };
    }
    
    const luck = character?.stats?.luck || 0;

    // --- Rarity Upgrade Logic ---
    if (character) {
        const rarityOrder: ItemRarity[] = [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare, ItemRarity.Epic, ItemRarity.Legendary];
        const currentRarityIndex = rarityOrder.indexOf(template.rarity);

        if (currentRarityIndex < rarityOrder.length - 1) { // Not legendary
             const chanceToUpgradeRarity = luck * 0.05; // 5% chance at 100 luck
             if (Math.random() * 100 < chanceToUpgradeRarity) {
                 const nextRarity = rarityOrder[currentRarityIndex + 1];
                 const possibleUpgrades = allItemTemplates.filter(t => 
                     t.rarity === nextRarity &&
                     t.category === template.category &&
                     t.slot === template.slot &&
                     t.requiredLevel >= template.requiredLevel &&
                     t.requiredLevel <= character.level
                 );
                 if (possibleUpgrades.length > 0) {
                     const upgradedTemplate = possibleUpgrades[Math.floor(Math.random() * possibleUpgrades.length)];
                     // Recursive call to create a new, upgraded item and return it immediately
                     return createItemInstance(upgradedTemplate.id, allItemTemplates, allAffixes, character);
                 }
             }
        }
    }

    const instance: ItemInstance = {
        uniqueId: randomUUID(),
        templateId,
        rolledBaseStats: rollTemplateStats(template, luck),
    };

    if (allowAffixes) {
        const itemCategory = template.category;
        
        // Filter valid affixes. Affix spawnChances is now a Weight Map.
        const validPrefixes = allAffixes
            .filter(a => a.type === AffixType.Prefix && a.spawnChances && (a.spawnChances[itemCategory] || 0) > 0)
            .map(a => ({ ...a, weight: a.spawnChances[itemCategory] || 0 }));
            
        const validSuffixes = allAffixes
            .filter(a => a.type === AffixType.Suffix && a.spawnChances && (a.spawnChances[itemCategory] || 0) > 0)
            .map(a => ({ ...a, weight: a.spawnChances[itemCategory] || 0 }));

        // Chance to get an affix depends on Item Rarity + Luck
        const baseChance = affixChanceByRarity[template.rarity] || 10;
        const prefixChance = baseChance + (luck * 0.1); 
        const suffixChance = baseChance + (luck * 0.1);

        if (validPrefixes.length > 0 && Math.random() * 100 < prefixChance) {
            const pickedPrefix = pickWeighted(validPrefixes);
            if (pickedPrefix) {
                instance.prefixId = pickedPrefix.id;
                instance.rolledPrefix = rollAffixStats(pickedPrefix, luck);
            }
        }
    
        if (validSuffixes.length > 0 && Math.random() * 100 < suffixChance) {
             const pickedSuffix = pickWeighted(validSuffixes);
             if (pickedSuffix) {
                instance.suffixId = pickedSuffix.id;
                instance.rolledSuffix = rollAffixStats(pickedSuffix, luck);
             }
        }

        // Second chance logic if a character is provided (reroll for affix if missed)
        if (character) {
            if (!instance.prefixId && validPrefixes.length > 0 && Math.random() * 100 < luck * 0.05) {
                const luckyPrefix = pickWeighted(validPrefixes);
                if(luckyPrefix) {
                    instance.prefixId = luckyPrefix.id;
                    instance.rolledPrefix = rollAffixStats(luckyPrefix, luck);
                }
            }
            if (!instance.suffixId && validSuffixes.length > 0 && Math.random() * 100 < luck * 0.05) {
                const luckySuffix = pickWeighted(validSuffixes);
                if (luckySuffix) {
                    instance.suffixId = luckySuffix.id;
                    instance.rolledSuffix = rollAffixStats(luckySuffix, luck);
                }
            }
        }
    }
    
    // Pre-upgrade logic if a character is provided
    if (character) {
        let upgradeLevel = 0;
        const chanceForPlus1 = luck * 0.15; // 15% at 100 luck
        if (Math.random() * 100 < chanceForPlus1) {
            upgradeLevel = 1;
            const chanceForPlus2 = luck * 0.075; // 7.5% at 100 luck
            if (Math.random() * 100 < chanceForPlus2) {
                upgradeLevel = 2;
                const chanceForPlus3 = luck * 0.03; // 3% at 100 luck
                if (Math.random() * 100 < chanceForPlus3) {
                    upgradeLevel = 3;
                }
            }
        }
        if (upgradeLevel > 0) {
            instance.upgradeLevel = upgradeLevel;
        }
    }

    return instance;
};

const createGuaranteedAffixItem = (itemTemplates: ItemTemplate[], affixes: Affix[]): ItemInstance | null => {
    let eligibleTemplates = itemTemplates.filter(t => 
        t.rarity === ItemRarity.Common ||
        t.rarity === ItemRarity.Uncommon ||
        t.rarity === ItemRarity.Rare
    );

    if (eligibleTemplates.length === 0) {
        // Fallback to any template if specific rarities are missing
        eligibleTemplates = itemTemplates;
    }
    
    // Hardcoded fallback to prevent returning null if DB is totally empty of valid templates
    if (eligibleTemplates.length === 0) {
        return null;
    }

    const template = eligibleTemplates[Math.floor(Math.random() * eligibleTemplates.length)];

    const instance: ItemInstance = {
        uniqueId: randomUUID(),
        templateId: template.id,
        rolledBaseStats: rollTemplateStats(template),
    };

    const itemCategory = template.category;
    
    const validPrefixes = affixes
        .filter(a => a.type === AffixType.Prefix && a.spawnChances && (a.spawnChances[itemCategory] || 0) > 0)
        .map(a => ({ ...a, weight: a.spawnChances[itemCategory] || 0 }));
            
    const validSuffixes = affixes
        .filter(a => a.type === AffixType.Suffix && a.spawnChances && (a.spawnChances[itemCategory] || 0) > 0)
        .map(a => ({ ...a, weight: a.spawnChances[itemCategory] || 0 }));

    if (validPrefixes.length > 0) {
        const prefix = pickWeighted(validPrefixes);
        if (prefix) {
            instance.prefixId = prefix.id;
            instance.rolledPrefix = rollAffixStats(prefix);
        }
    }

    if (validSuffixes.length > 0) {
        const suffix = pickWeighted(validSuffixes);
        if (suffix) {
            instance.suffixId = suffix.id;
            instance.rolledSuffix = rollAffixStats(suffix);
        }
    }
    
    return instance;
};

export const generateTraderInventory = (itemTemplates: ItemTemplate[], affixes: Affix[], settings: GameSettings): TraderInventoryData => {
    const INVENTORY_SIZE = 12;
    const regularItems: ItemInstance[] = [];
    
    // Trader Rarity Chances usually remain percentage-based (0-100) in settings because it dictates pool selection logic, not specific item weights.
    // However, if we want full consistency, we could treat these as weights too. For now, kept as is for settings compatibility.
    const defaultChances = {
        [ItemRarity.Common]: 60,
        [ItemRarity.Uncommon]: 30,
        [ItemRarity.Rare]: 10,
    };
    
    const chances = settings.traderSettings?.rarityChances || defaultChances;
    
    if (!Array.isArray(itemTemplates)) return { regularItems: [], specialOfferItems: [] };

    // Filter templates that are meant to be sold by trader (usually lower tiers)
    let eligibleTemplates = itemTemplates.filter(t => 
        t.rarity === ItemRarity.Common ||
        t.rarity === ItemRarity.Uncommon ||
        t.rarity === ItemRarity.Rare
    );

    if (eligibleTemplates.length === 0) {
        console.warn("No Common, Uncommon, or Rare items found for trader. Falling back to all items.");
        eligibleTemplates = itemTemplates;
    }
    
    // If absolutely no items exist, return empty to prevent crash
    if (eligibleTemplates.length === 0) return { regularItems: [], specialOfferItems: [] };
    
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const rand = Math.random() * 100;
        let selectedRarity: ItemRarity;

        if (rand < (chances[ItemRarity.Common] || 0)) {
            selectedRarity = ItemRarity.Common;
        } else if (rand < (chances[ItemRarity.Common] || 0) + (chances[ItemRarity.Uncommon] || 0)) {
            selectedRarity = ItemRarity.Uncommon;
        } else {
            selectedRarity = ItemRarity.Rare;
        }
        
        let templatesOfRarity = eligibleTemplates.filter(t => t.rarity === selectedRarity);

        if (templatesOfRarity.length === 0) {
            // Critical Fallback: If we rolled "Rare" but have no Rare items, 
            // default to ANY eligible item instead of leaving the slot empty.
            templatesOfRarity = eligibleTemplates;
        }

        if (templatesOfRarity.length > 0) {
            const template = templatesOfRarity[Math.floor(Math.random() * templatesOfRarity.length)];
            // Pass false to create item without affixes for regular inventory
            regularItems.push(createItemInstance(template.id, itemTemplates, affixes, undefined, false));
        }
    }
    
    const specialOfferItems: ItemInstance[] = [];
    const item1 = createGuaranteedAffixItem(itemTemplates, affixes);
    if(item1) specialOfferItems.push(item1);
    const item2 = createGuaranteedAffixItem(itemTemplates, affixes);
    if(item2) specialOfferItems.push(item2);
    
    return { regularItems, specialOfferItems };
};
