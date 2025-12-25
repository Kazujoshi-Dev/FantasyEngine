
import { CharacterStats } from './character.js';
import { EssenceType, ResourceCost, Gender } from './common.js';

export enum ItemRarity {
    Common = 'Common',
    Uncommon = 'Uncommon',
    Rare = 'Rare',
    Epic = 'Epic',
    Legendary = 'Legendary'
}

export enum ItemCategory {
    Weapon = 'Weapon',
    Armor = 'Armor',
    Jewelry = 'Jewelry'
}

export enum EquipmentSlot {
    Head = 'head',
    Neck = 'neck',
    Chest = 'chest',
    Hands = 'hands',
    Waist = 'waist',
    Legs = 'legs',
    Feet = 'feet',
    Ring1 = 'ring1',
    Ring2 = 'ring2',
    MainHand = 'mainHand',
    OffHand = 'offHand',
    TwoHand = 'twoHand'
}

export enum AffixType {
    Prefix = 'Prefix',
    Suffix = 'Suffix'
}

export enum GrammaticalGender {
    Masculine = 'Masculine',
    Feminine = 'Feminine',
    Neuter = 'Neuter'
}

export enum MagicAttackType {
    Fireball = 'Fireball',
    LightningStrike = 'LightningStrike',
    ShadowBolt = 'ShadowBolt',
    FrostWave = 'FrostWave',
    ChainLightning = 'ChainLightning',
    IceLance = 'IceLance',
    ArcaneMissile = 'ArcaneMissile',
    LifeDrain = 'LifeDrain',
    MeteorSwarm = 'MeteorSwarm',
    Earthquake = 'Earthquake'
}

export interface ItemTemplate {
    id: string;
    name: string;
    description: string;
    icon?: string;
    slot: EquipmentSlot | 'ring' | 'consumable';
    category: ItemCategory;
    rarity: ItemRarity;
    value: number;
    requiredLevel: number;
    gender: GrammaticalGender;
    requiredGender?: Gender | null; // NOWE: Wymagana płeć postaci
    
    damageMin?: number;
    damageMax?: number;
    armorBonus?: number;
    
    statsBonus?: Partial<CharacterStats>;
    requiredStats?: Partial<CharacterStats>;
    
    isMagical?: boolean;
    isRanged?: boolean;
    isShield?: boolean;
    magicAttackType?: MagicAttackType;
    manaCost?: { min: number; max: number };
    magicDamageMin?: number;
    magicDamageMax?: number;
    
    attacksPerRound?: number;
    critChanceBonus?: number;
    maxHealthBonus?: number;
    critDamageModifierBonus?: number;
    armorPenetrationPercent?: number;
    armorPenetrationFlat?: number;
    lifeStealPercent?: number;
    lifeStealFlat?: number;
    manaStealPercent?: number;
    manaStealFlat?: number;
    dodgeChanceBonus?: number;
    blockChanceBonus?: number;
}

export interface RolledAffixStats {
    statsBonus?: Partial<CharacterStats>;
    damageMin?: number;
    damageMax?: number;
    armorBonus?: number;
    maxHealthBonus?: number;
    critChanceBonus?: number;
    critDamageModifierBonus?: number;
    attacksPerRoundBonus?: number;
    dodgeChanceBonus?: number;
    blockChanceBonus?: number;
    armorPenetrationPercent?: number;
    armorPenetrationFlat?: number;
    lifeStealPercent?: number;
    lifeStealFlat?: number;
    manaStealPercent?: number;
    manaStealFlat?: number;
    magicDamageMin?: number;
    magicDamageMax?: number;
}

export interface ItemInstance {
    uniqueId: string;
    templateId: string;
    upgradeLevel?: number;
    
    prefixId?: string;
    suffixId?: string;
    
    rolledBaseStats?: RolledAffixStats;
    rolledPrefix?: RolledAffixStats;
    rolledSuffix?: RolledAffixStats;
    
    isBorrowed?: boolean;
    borrowedFromGuildId?: number;
    originalOwnerId?: number;
    originalOwnerName?: string;
    borrowedAt?: number;

    crafterName?: string; 
}

export interface Affix {
    id: string;
    name: string | { masculine: string; feminine: string; neuter: string };
    type: AffixType;
    value?: number;
    spawnChances: Partial<Record<ItemCategory, number>>; 
    
    statsBonus?: Record<string, { min: number; max: number }>;
    
    damageMin?: { min: number; max: number };
    damageMax?: { min: number; max: number };
    armorBonus?: { min: number; max: number };
    maxHealthBonus?: { min: number; max: number };
    
    critChanceBonus?: { min: number; max: number };
    critDamageModifierBonus?: { min: number; max: number };
    attacksPerRoundBonus?: { min: number; max: number };
    dodgeChanceBonus?: { min: number; max: number };
    blockChanceBonus?: { min: number; max: number };
    armorPenetrationPercent?: { min: number; max: number };
    armorPenetrationFlat?: { min: number; max: number };
    lifeStealPercent?: { min: number; max: number };
    lifeStealFlat?: { min: number; max: number };
    manaStealPercent?: { min: number; max: number };
    manaStealFlat?: { min: number; max: number };
    magicDamageMin?: { min: number; max: number };
    magicDamageMax?: { min: number; max: number };
    
    requiredLevel?: number;
    requiredStats?: Partial<CharacterStats>;
}

export interface ItemSetTier {
    requiredPieces: number;
    bonuses: Partial<CharacterStats> & {
        expBonusPercent?: number;
        goldBonusPercent?: number;
        damageBonusPercent?: number;
        damageReductionPercent?: number;
        blockChanceBonus?: number;
    };
}

export interface ItemSet {
    id: string;
    name: string;
    affixId: string; // Afiks który "aktywuje" zestaw
    tiers: ItemSetTier[];
}

export interface LootDrop {
    templateId: string;
    weight: number; 
}

export interface ResourceDrop {
    resource: EssenceType;
    min: number;
    max: number;
    weight: number; 
}

export interface CraftingSettings {
    costs: {
        [key in ItemRarity]?: {
            gold: number;
            essences: ResourceCost[];
        };
    };
    workshopUpgrades: {
        [level: number]: {
            gold: number;
            essences: ResourceCost[];
        };
    };
}
