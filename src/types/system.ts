
import { Language, Tab } from './common.js';
import { ItemRarity, ItemTemplate, Affix, CraftingSettings, ItemSet } from './items.js';
import { Location, Expedition, Quest, Skill, Ritual, Tower } from './world.js';
import { Enemy } from './combat.js';

export interface TraderSettings {
    rarityChances: Partial<Record<ItemRarity, number>>;
}

export interface GameSettings {
    language: Language;
    logoUrl?: string;
    windowBackgroundUrl?: string;
    sidebarBackgroundUrl?: string;
    reportBackgroundUrl?: string;
    loginBackground?: string;
    gameBackground?: string;
    sidebarOrder?: Tab[];
    newsContent?: string;
    newsLastUpdatedAt?: number;
    traderSettings?: TraderSettings;
    pvpProtectionMinutes?: number;
    titleScreen?: {
        description: string;
        images: string[];
    };
    crafting?: CraftingSettings;
    buyCoffeeUrl?: string;
    guildBuildingImages?: Record<string, string>;
}

export interface GameData {
    locations: Location[];
    expeditions: Expedition[];
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    quests: Quest[];
    affixes: Affix[];
    skills: Skill[];
    rituals: Ritual[];
    towers: Tower[];
    itemSets: ItemSet[];
    settings?: GameSettings;
}
// ... (reszta pliku bez zmian)
