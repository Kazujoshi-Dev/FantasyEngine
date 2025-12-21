
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
    // FIX: Add buyCoffeeUrl property to GameSettings type
    buyCoffeeUrl?: string;
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

export interface GlobalStats {
    totalPlayers: number;
    totalGoldInEconomy: number;
    raceCounts: Record<string, number>;
    classCounts: Record<string, number>;
    topItems: { id: string; count: number }[];
    topAffixes: { id: string; count: number }[];
}

// Audits
export interface DuplicationAuditResult {
    uniqueId: string;
    itemName: string;
    templateId: string;
    instances: {
        userId: number;
        ownerName: string;
        location: string;
        templateId: string;
    }[];
}

export interface OrphanAuditResult {
    userId: number;
    characterName: string;
    orphans: {
        uniqueId: string;
        templateId: string;
        location: string;
    }[];
}

export interface ItemSearchResult {
    item: any; // Using any or specific ItemInstance if imports allow without cycle, here loose for admin tool
    template: ItemTemplate;
    locations: {
        userId: number;
        ownerName: string;
        location: string;
    }[];
}
