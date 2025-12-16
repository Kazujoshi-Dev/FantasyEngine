


import { EssenceType, ItemRarity, PlayerCharacter, GameData, ItemTemplate, EquipmentSlot, CharacterClass, ItemInstance, CraftingSettings } from '../types.js';
import { createItemInstance, rollAffixStats, rollTemplateStats } from './items.js';
import { getBackpackCapacity } from './helpers.js';

export const calculateCraftingCost = (rarity: ItemRarity, character: PlayerCharacter, settings?: CraftingSettings) => {
    let gold = 0;
    const essences: { type: EssenceType, amount: number }[] = [];

    if (settings && settings.costs && settings.costs[rarity]) {
        const costConfig = settings.costs[rarity]!;
        gold = costConfig.gold;
        // Deep copy essences to avoid mutation reference issues if we modify amount later
        costConfig.essences.forEach(e => essences.push({ type: e.type, amount: e.amount }));
    } else {
        // Fallback Default Logic
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
    }

    // Engineer Class Bonus: 20% Discount
    if (character.characterClass === CharacterClass.Engineer) {
        gold = Math.floor(gold * 0.8);
        essences.forEach(e => {
            e.amount = Math.max(1, Math.floor(e.amount * 0.8));
        });
    }

    return { gold, essences };
};

export const calculateReforgeCost = (item: ItemInstance, type: 'values' | 'affixes', character: PlayerCharacter, template: ItemTemplate, settings?: CraftingSettings) => {
    let gold = 0;
    const essences: { type: EssenceType, amount: number }[] = [];
    const rarity = template.rarity;

    if (settings && settings.costs && settings.costs[rarity]) {
         const rawConfig = settings.costs[rarity]!;
         
         if (type === 'values') {
             // 20% of base gold, 20% of base essences
             gold = Math.floor(rawConfig.gold * 0.2);
             rawConfig.essences.forEach(e => essences.push({ type: e.type, amount: Math.max(1, Math.floor(e.amount * 0.2)) }));
         } else {
             // type === 'affixes'
             // 40% of base gold, 40% of base essences
             gold = Math.floor(rawConfig.gold * 0.4);
             rawConfig.essences.forEach(e => essences.push({ type: e.type, amount: Math.max(1, Math.floor(e.amount * 0.4)) }));
         }
         
         // Apply Engineer Discount
         if (character.characterClass === CharacterClass.Engineer) {
            gold = Math.floor(gold * 0.8);
            essences.forEach(e => {
                e.amount = Math.max(1, Math.floor(e.amount * 0.8));
            });
        }
    } else {
        // Fallback Default Hardcoded Logic
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
    }

    return { gold, essences };
};

export const performCraft = (
    character: PlayerCharacter, 
    gameData: GameData, 
    slot: EquipmentSlot | 'ring' | 'consumable', 
    rarity: ItemRarity
): { character: PlayerCharacter, item: ItemInstance } => {
    
    const workshopLevel = character.workshop?.level || 0;
    
    // Level Checks
    if (rarity === ItemRarity.Rare && workshopLevel < 3) throw new Error("Warsztat poziom 3 wymagany.");
    if (rarity === ItemRarity.Epic && workshopLevel < 5) throw new Error("Warsztat poziom 5 wymagany.");
    if (rarity === ItemRarity.Legendary && workshopLevel < 7) throw new Error("Warsztat poziom 7 wymagany.");

    const settings = gameData.settings?.crafting;
    const cost = calculateCraftingCost(rarity, character, settings);
    
    // Check Resources
    if (character.resources.gold < cost.gold) throw new Error("Niewystarczająco złota.");
    for (const e of cost.essences) {
        if ((character.resources[e.type] || 0) < e.amount) throw new Error(`Brak ${e.type}.`);
    }
    
    // Find Templates
    const possibleTemplates = gameData.itemTemplates.filter(t => 
        t.rarity === rarity && 
        (slot === 'ring' ? (t.slot === 'ring' || t.slot === 'ring1' || t.slot === 'ring2') : t.slot === slot)
    );
    
    if (possibleTemplates.length === 0) throw new Error("Brak przedmiotów w tej kategorii.");
    
    // Deduct Resources
    character.resources.gold -= cost.gold;
    cost.essences.forEach(e => character.resources[e.type] -= e.amount);
    
    // Roll Item
    const selectedTemplate = possibleTemplates[Math.floor(Math.random() * possibleTemplates.length)];
    const newItem = createItemInstance(selectedTemplate.id, gameData.itemTemplates, gameData.affixes, character);
    
    // -- Set Crafter Name --
    newItem.crafterName = character.name;

    // Add to Inventory
    if (character.inventory.length >= getBackpackCapacity(character)) {
        throw new Error("Plecak pełny.");
    }
    character.inventory.push(newItem);
    
    return { character, item: newItem };
};

export const performReforge = (
    character: PlayerCharacter, 
    gameData: GameData, 
    itemId: string,
    type: 'values' | 'affixes'
): PlayerCharacter => {
    
    const workshopLevel = character.workshop?.level || 0;
    if (workshopLevel < 10) throw new Error("Warsztat poziom 10 wymagany.");
    
    const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
    if (itemIndex === -1) throw new Error("Przedmiot nie znaleziony.");
    const item = character.inventory[itemIndex];
    if (item.isBorrowed) throw new Error("Nie można przekuwać pożyczonych przedmiotów.");
    
    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) throw new Error("Błąd danych przedmiotu.");
    
    const settings = gameData.settings?.crafting;
    const cost = calculateReforgeCost(item, type, character, template, settings);
    
    if (character.resources.gold < cost.gold) throw new Error("Niewystarczająco złota.");
    for (const e of cost.essences) {
        if ((character.resources[e.type] || 0) < e.amount) throw new Error(`Brak ${e.type}.`);
    }
    
    // Deduct
    character.resources.gold -= cost.gold;
    cost.essences.forEach(e => character.resources[e.type] -= e.amount);
    
    const luck = character.stats.luck;

    if (type === 'values') {
        // Reroll stats using existing template and affix definitions
        item.rolledBaseStats = rollTemplateStats(template, luck);
        if (item.prefixId) {
            const prefix = gameData.affixes.find(a => a.id === item.prefixId);
            if (prefix) item.rolledPrefix = rollAffixStats(prefix, luck);
        }
        if (item.suffixId) {
            const suffix = gameData.affixes.find(a => a.id === item.suffixId);
            if (suffix) item.rolledSuffix = rollAffixStats(suffix, luck);
        }
    } else {
        // Reroll Affixes
        const freshItem = createItemInstance(template.id, gameData.itemTemplates, gameData.affixes, character);
        item.prefixId = freshItem.prefixId;
        item.suffixId = freshItem.suffixId;
        item.rolledPrefix = freshItem.rolledPrefix;
        item.rolledSuffix = freshItem.rolledSuffix;
        item.rolledBaseStats = freshItem.rolledBaseStats;
    }
    
    return character;
};
