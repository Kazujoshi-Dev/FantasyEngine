
import { ItemInstance, ItemTemplate, Affix, RolledAffixStats, AffixType, GrammaticalGender, ItemRarity, ItemCategory, EquipmentSlot, PlayerCharacter } from '../types.js';
import { randomUUID } from 'crypto';

// Scentralizowana logika nazewnictwa (identyczna z src/components/shared/ItemSlot.tsx)
export const getGrammaticallyCorrectFullName = (item: ItemInstance, template: ItemTemplate, affixes: Affix[]): string => {
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
        return (affix.name as any)[genderKey] || affix.name.masculine || '';
    };

    const prefixName = getName(prefixAffix);
    const suffixName = getName(suffixAffix);

    return [prefixName, template.name, suffixName].filter(Boolean).join(' ');
};

export const rollValueWithLuck = (minMax: number | { min: number; max: number } | undefined, luck: number = 0): number | undefined => {
    if (typeof minMax === 'number') return minMax;
    if (minMax === undefined || minMax === null) return undefined;
    const min = Math.min(minMax.min, minMax.max);
    const max = Math.max(minMax.min, minMax.max);
    if (min === max) return min;
    const luckFactor = Math.min(1, luck / 1000);
    const baseRoll = Math.random();
    const weightedRoll = baseRoll * (1 - luckFactor) + luckFactor;
    return min + Math.floor(weightedRoll * (max - min + 1));
};

export const pickWeighted = <T extends { weight?: number }>(items: T[]): T | null => {
    if (!items || items.length === 0) return null;
    const weightedItems = items.map(item => ({
        ...item,
        _effectiveWeight: (item as any).weight !== undefined ? (item as any).weight : ((item as any).chance || 0)
    }));
    const totalWeight = weightedItems.reduce((sum, item) => sum + item._effectiveWeight, 0);
    if (totalWeight <= 0) return null;
    let random = Math.random() * totalWeight;
    for (const item of weightedItems) {
        if (random < item._effectiveWeight) return item;
        random -= item._effectiveWeight;
    }
    return weightedItems[weightedItems.length - 1];
};

export const rollAffixStats = (affix: Affix, luck: number = 0): RolledAffixStats => {
    const rolled: RolledAffixStats = {};
    if (affix.statsBonus) {
        rolled.statsBonus = {};
        for (const key in affix.statsBonus) {
            const rolledStat = rollValueWithLuck((affix.statsBonus as any)[key], luck);
            if (rolledStat !== undefined) (rolled.statsBonus as any)[key] = rolledStat;
        }
    }
    const keys = ['damageMin', 'damageMax', 'attacksPerRoundBonus', 'dodgeChanceBonus', 'armorBonus', 'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent', 'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent', 'manaStealFlat', 'magicDamageMin', 'magicDamageMax'];
    for (const key of keys) {
        const val = rollValueWithLuck((affix as any)[key], luck);
        if (val !== undefined) (rolled as any)[key] = val;
    }
    return rolled;
};

export const rollTemplateStats = (template: ItemTemplate, luck: number = 0): RolledAffixStats => {
    const rolled: RolledAffixStats = {};
    if (template.statsBonus) {
        rolled.statsBonus = {};
        for (const key in template.statsBonus) {
            const rolledStat = rollValueWithLuck((template.statsBonus as any)[key], luck);
            if (rolledStat !== undefined) (rolled.statsBonus as any)[key] = rolledStat;
        }
    }
    const keys = ['damageMin', 'damageMax', 'armorBonus', 'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent', 'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent', 'manaStealFlat', 'magicDamageMin', 'magicDamageMax'];
    for (const key of keys) {
        const value = rollValueWithLuck((template as any)[key], luck);
        if (value !== undefined) (rolled as any)[key] = value;
    }
    return rolled;
};

export const createItemInstance = (templateId: string, allItemTemplates: ItemTemplate[], allAffixes: Affix[], character?: PlayerCharacter, allowAffixes = true): ItemInstance => {
    const template = allItemTemplates.find(t => t.id === templateId);
    if (!template) return { uniqueId: randomUUID(), templateId };
    const luck = character?.stats?.luck || 0;
    const instance: ItemInstance = { uniqueId: randomUUID(), templateId, rolledBaseStats: rollTemplateStats(template, luck) };
    if (allowAffixes) {
        const category = template.category;
        const validPrefixes = allAffixes.filter(a => a.type === AffixType.Prefix && a.spawnChances?.[category]).map(a => ({ ...a, weight: a.spawnChances[category] || 0 }));
        const validSuffixes = allAffixes.filter(a => a.type === AffixType.Suffix && a.spawnChances?.[category]).map(a => ({ ...a, weight: a.spawnChances[category] || 0 }));
        const chance = (character?.stats.luck || 0) * 0.1 + 10;
        if (validPrefixes.length > 0 && Math.random() * 100 < chance) {
            const p = pickWeighted(validPrefixes);
            if (p) { instance.prefixId = p.id; instance.rolledPrefix = rollAffixStats(p, luck); }
        }
        if (validSuffixes.length > 0 && Math.random() * 100 < chance) {
            const s = pickWeighted(validSuffixes);
            if (s) { instance.suffixId = s.id; instance.rolledSuffix = rollAffixStats(s, luck); }
        }
    }
    return instance;
};

export const generateTraderInventory = (itemTemplates: ItemTemplate[], affixes: Affix[], settings: any): any => {
    const regularItems: ItemInstance[] = [];
    const specialOfferItems: ItemInstance[] = [];
    const eligible = itemTemplates.filter(t => t.rarity === ItemRarity.Common || t.rarity === ItemRarity.Uncommon || t.rarity === ItemRarity.Rare);
    for (let i = 0; i < 12; i++) {
        const t = eligible[Math.floor(Math.random() * eligible.length)];
        if (t) regularItems.push(createItemInstance(t.id, itemTemplates, affixes, undefined, false));
    }
    const s1 = eligible[Math.floor(Math.random() * eligible.length)];
    if (s1) specialOfferItems.push(createItemInstance(s1.id, itemTemplates, affixes, undefined, true));
    return { regularItems, specialOfferItems };
};
