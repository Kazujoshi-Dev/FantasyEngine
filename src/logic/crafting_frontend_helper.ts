
import { EssenceType, ItemRarity, PlayerCharacter, CharacterClass, ItemInstance, ItemTemplate } from '../types';

export const calculateCraftingCost = (rarity: ItemRarity, character: PlayerCharacter) => {
    let gold = 0;
    const essences: { type: EssenceType, amount: number }[] = [];

    switch (rarity) {
        case ItemRarity.Common:
            gold = 100;
            essences.push({ type: EssenceType.Common, amount: 2 });
            break;
        case ItemRarity.Uncommon:
            gold = 250;
            essences.push({ type: EssenceType.Uncommon, amount: 5 });
            essences.push({ type: EssenceType.Common, amount: 2 });
            break;
        case ItemRarity.Rare:
            gold = 1000;
            essences.push({ type: EssenceType.Rare, amount: 5 });
            essences.push({ type: EssenceType.Uncommon, amount: 5 });
            break;
        case ItemRarity.Epic:
            gold = 5000;
            essences.push({ type: EssenceType.Epic, amount: 5 });
            essences.push({ type: EssenceType.Rare, amount: 10 });
            break;
        case ItemRarity.Legendary:
            gold = 25000;
            essences.push({ type: EssenceType.Legendary, amount: 5 });
            essences.push({ type: EssenceType.Epic, amount: 20 });
            break;
    }

    if (character.characterClass === CharacterClass.Engineer) {
        gold = Math.floor(gold * 0.8);
        essences.forEach(e => {
            e.amount = Math.max(1, Math.floor(e.amount * 0.8));
        });
    }

    return { gold, essences };
};

export const calculateReforgeCost = (item: ItemInstance, type: 'values' | 'affixes', character: PlayerCharacter, template: ItemTemplate) => {
    let gold = 0;
    const essences: { type: EssenceType, amount: number }[] = [];
    const rarity = template.rarity;

    if (type === 'values') {
        switch (rarity) {
            case ItemRarity.Common: gold = 50; essences.push({ type: EssenceType.Common, amount: 1 }); break;
            case ItemRarity.Uncommon: gold = 100; essences.push({ type: EssenceType.Uncommon, amount: 1 }); break;
            case ItemRarity.Rare: gold = 250; essences.push({ type: EssenceType.Rare, amount: 1 }); break;
            case ItemRarity.Epic: gold = 1000; essences.push({ type: EssenceType.Epic, amount: 1 }); break;
            case ItemRarity.Legendary: gold = 5000; essences.push({ type: EssenceType.Legendary, amount: 1 }); break;
        }
    } else {
        switch (rarity) {
             case ItemRarity.Common: gold = 100; essences.push({ type: EssenceType.Common, amount: 2 }); break;
             case ItemRarity.Uncommon: gold = 250; essences.push({ type: EssenceType.Uncommon, amount: 2 }); break;
             case ItemRarity.Rare: gold = 500; essences.push({ type: EssenceType.Rare, amount: 2 }); break;
             case ItemRarity.Epic: gold = 2500; essences.push({ type: EssenceType.Epic, amount: 2 }); break;
             case ItemRarity.Legendary: gold = 10000; essences.push({ type: EssenceType.Legendary, amount: 2 }); break;
        }
    }

    if (character.characterClass === CharacterClass.Engineer) {
        gold = Math.floor(gold * 0.8);
        essences.forEach(e => {
            e.amount = Math.max(1, Math.floor(e.amount * 0.8));
        });
    }

    return { gold, essences };
};
