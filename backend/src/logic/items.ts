
import { ItemInstance, ItemTemplate, Affix, RolledAffixStats, AffixType, GrammaticalGender, GameSettings, ItemRarity, TraderInventoryData, ItemCategory, EquipmentSlot, PlayerCharacter } from '../types.js';
import { randomUUID } from 'crypto';

// Helper for luck-based rolls
const rollValueWithLuck = (minMax: { min: number; max: number } | undefined, luck: number = 0): number | undefined => {
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
    
    const otherStatKeys: (keyof Omit<Affix, 'id'|'name'|'type'|'requiredLevel'|'requiredStats'|'spawnChances'|'statsBonus'|'value'>)[] = [
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
    
    const otherStatKeys: (keyof Omit<RolledAffixStats, 'statsBonus' | 'attacksPerRoundBonus' | 'dodgeChanceBonus'>)[] = [
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
    
    let genderKey: keyof Affix['name'] = 'masculine';
    if (template.gender === GrammaticalGender.Feminine) {
        genderKey = 'feminine';
    } else if (template.gender === GrammaticalGender.Neuter) {
        genderKey = 'neuter';
    }
    
    const getName = (affix: Affix | undefined) => {
        if (!affix) return '';
        if (typeof affix.name === 'string') return affix.name;
        return affix.name[genderKey] || affix.name.masculine || '';
    };

    const prefixName = getName(prefixAffix);
    const suffixName = getName(suffixAffix);

    return [prefixName, template.name, suffixName].filter(Boolean).join(' ');
}

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
    
        const possiblePrefixes = allAffixes.filter(a => a.type === AffixType.Prefix && a.spawnChances[itemCategory]);
        const possibleSuffixes = allAffixes.filter(a => a.type === AffixType.Suffix && a.spawnChances[itemCategory]);
    
        if (possiblePrefixes.length > 0) {
            for (const prefix of possiblePrefixes) {
                const chance = prefix.spawnChances[itemCategory] || 0;
                if (Math.random() * 100 < chance) {
                    instance.prefixId = prefix.id;
                    instance.rolledPrefix = rollAffixStats(prefix, luck);
                    break; 
                }
            }
        }
    
        if (possibleSuffixes.length > 0) {
             for (const suffix of possibleSuffixes) {
                const chance = suffix.spawnChances[itemCategory] || 0;
                if (Math.random() * 100 < chance) {
                    instance.suffixId = suffix.id;
                    instance.rolledSuffix = rollAffixStats(suffix, luck);
                    break;
                }
            }
        }

        // Second chance logic if a character is provided
        if (character) {
            if (!instance.prefixId && possiblePrefixes.length > 0 && Math.random() * 100 < luck * 0.1) {
                const luckyPrefix = possiblePrefixes[Math.floor(Math.random() * possiblePrefixes.length)];
                instance.prefixId = luckyPrefix.id;
                instance.rolledPrefix = rollAffixStats(luckyPrefix, luck);
            }
            if (!instance.suffixId && possibleSuffixes.length > 0 && Math.random() * 100 < luck * 0.1) {
                const luckySuffix = possibleSuffixes[Math.floor(Math.random() * possibleSuffixes.length)];
                instance.suffixId = luckySuffix.id;
                instance.rolledSuffix = rollAffixStats(luckySuffix, luck);
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
    
    const possiblePrefixes = affixes.filter(a => a.type === AffixType.Prefix && a.spawnChances[itemCategory]);
    const possibleSuffixes = affixes.filter(a => a.type === AffixType.Suffix && a.spawnChances[itemCategory]);

    if (possiblePrefixes.length > 0) {
        const prefix = possiblePrefixes[Math.floor(Math.random() * possiblePrefixes.length)];
        instance.prefixId = prefix.id;
        instance.rolledPrefix = rollAffixStats(prefix);
    }

    if (possibleSuffixes.length > 0) {
        const suffix = possibleSuffixes[Math.floor(Math.random() * possibleSuffixes.length)];
        instance.suffixId = suffix.id;
        instance.rolledSuffix = rollAffixStats(suffix);
    }
    
    return instance;
};

export const generateTraderInventory = (itemTemplates: ItemTemplate[], affixes: Affix[], settings: GameSettings): TraderInventoryData => {
    const INVENTORY_SIZE = 12;
    const regularItems: ItemInstance[] = [];
    
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
