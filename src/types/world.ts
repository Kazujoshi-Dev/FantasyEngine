
import { Tab, EssenceType, CharacterClass, Race } from './common.js';
import { CharacterStats } from './character.js';
import { LootDrop, ResourceDrop, ItemInstance, ItemRarity } from './items.js';

export interface Location {
    id: string;
    name: string;
    description: string;
    travelTime: number;
    travelCost: number;
    travelEnergyCost: number;
    availableTabs: Tab[];
    isStartLocation: boolean;
    image?: string;
}

export interface ExpeditionEnemy {
    enemyId: string;
    spawnChance: number;
}

export interface Expedition {
    id: string;
    name: string;
    description: string;
    duration: number;
    goldCost: number;
    energyCost: number;
    minBaseGoldReward: number;
    maxBaseGoldReward: number;
    minBaseExperienceReward: number;
    maxBaseExperienceReward: number;
    locationIds: string[];
    enemies: ExpeditionEnemy[];
    lootTable: LootDrop[];
    resourceLootTable: ResourceDrop[];
    maxEnemies?: number;
    maxItems?: number;
    image?: string;
}

export enum QuestType {
    Kill = 'Kill',
    Gather = 'Gather',
    GatherResource = 'GatherResource',
    PayGold = 'PayGold'
}

export enum QuestCategory {
    Normal = 'Normal',
    Daily = 'Daily'
}

export interface ItemReward {
    templateId: string;
    quantity: number;
}

export interface RandomItemReward {
    rarity: ItemRarity;
    quantity: number;
}

export interface ResourceReward {
    resource: EssenceType;
    quantity: number;
}

export interface Quest {
    id: string;
    name: string;
    description: string;
    image?: string;
    category: QuestCategory;
    locationIds?: string[];
    repeatable: number;
    objective: {
        type: QuestType;
        targetId: string;
        amount: number;
    };
    rewards: {
        gold: number;
        experience: number;
        itemRewards?: ItemReward[];
        randomItemRewards?: RandomItemReward[];
        resourceRewards?: ResourceReward[];
        lootTable?: LootDrop[];
    };
}

export interface PlayerQuestProgress {
    questId: string;
    progress: number;
    completions: number;
    lastCompletedAt?: number;
}

export enum SkillType {
    Universal = 'Universal',
    Class = 'Class',
    Race = 'Race'
}

export enum SkillCategory {
    Passive = 'Passive',
    Active = 'Active'
}

export interface SkillCost {
    gold?: number;
    commonEssence?: number;
    uncommonEssence?: number;
    rareEssence?: number;
    epicEssence?: number;
    legendaryEssence?: number;
}

export interface SkillRequirements {
    level?: number;
    characterClass?: CharacterClass;
    race?: Race;
    strength?: number;
    agility?: number;
    accuracy?: number;
    stamina?: number;
    intelligence?: number;
    energy?: number;
    luck?: number;
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    type: SkillType;
    category: SkillCategory;
    manaMaintenanceCost?: number;
    requirements: SkillRequirements;
    cost: SkillCost;
    learningTimeMinutes?: number;
}

export interface Ritual {
    id: string;
    name: string;
    description: string;
    tier: number;
    durationMinutes: number;
    cost: { type: EssenceType | 'gold'; amount: number }[];
    stats: Partial<CharacterStats> & { expBonus?: number };
    image?: string;
}

export interface ActiveTowerRun {
    id: number;
    userId: number;
    towerId: string;
    currentFloor: number;
    currentHealth: number;
    currentMana: number;
    accumulatedRewards: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
    };
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'RETREATED';
}

export interface TowerFloor {
    floorNumber: number;
    enemies: ExpeditionEnemy[];
    energyCost: number;
    duration: number;
    guaranteedReward?: { gold: number; experience: number };
    specificItemRewards?: ItemInstance[];
    randomItemRewards?: { rarity: ItemRarity; chance: number; amount: number; affixCount?: number }[];
    resourceLootTable?: ResourceDrop[];
    lootTable?: LootDrop[];
}

export interface Tower {
    id: string;
    name: string;
    description: string;
    locationId: string;
    totalFloors: number;
    floors: TowerFloor[];
    grandPrize?: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
        randomItemRewards: { rarity: ItemRarity; chance: number; amount: number; affixCount?: number }[];
    };
    isActive: boolean;
    image?: string;
}
