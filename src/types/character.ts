
import { EssenceType, Language, Race, CharacterClass } from './common.js';
import { EquipmentSlot, ItemInstance, RolledAffixStats } from './items.js';
import { GuildBuff } from './guild.js';
import { PlayerQuestProgress } from './world.js';
import { ActiveTowerRun } from './world.js'; // Circular but needed
import { CombatLogEntry } from './combat.js';
import { TraderData } from './social.js';

export interface EquipmentLoadout {
    id: number;
    name: string;
    equipment: Record<EquipmentSlot, string | null>; // Przechowuje uniqueId przedmiotów
}

// Fix: Define CharacterResources
export interface CharacterResources {
    gold: number;
    commonEssence: number;
    uncommonEssence: number;
    rareEssence: number;
    epicEssence: number;
    legendaryEssence: number;
}

export interface CharacterStats {
    strength: number;
    agility: number;
    accuracy: number;
    stamina: number;
    intelligence: number;
    energy: number;
    luck: number;
    statPoints: number;
    
    currentHealth: number;
    maxHealth: number;
    currentMana: number;
    maxMana: number;
    currentEnergy: number;
    maxEnergy: number;
    
    minDamage: number;
    maxDamage: number;
    magicDamageMin: number;
    magicDamageMax: number;

    // Statystyki dla drugiej ręki (Dual Wield)
    offHandMinDamage?: number;
    offHandMaxDamage?: number;
    offHandMagicDamageMin?: number;
    offHandMagicDamageMax?: number;
    
    armor: number;
    critChance: number;
    critDamageModifier: number;
    attacksPerRound: number;
    dodgeChance: number;
    manaRegen: number;
    
    armorPenetrationPercent: number;
    armorPenetrationFlat: number;
    lifeStealPercent: number;
    lifeStealFlat: number;
    manaStealPercent: number;
    manaStealFlat: number;
}

export interface PlayerCharacter {
    id: number;
    user_id: number; 
    username: string; 
    name: string;
    race: Race;
    characterClass?: CharacterClass;
    level: number;
    experience: number;
    experienceToNextLevel: number;
    stats: CharacterStats;
    resources: CharacterResources;
    equipment: Record<EquipmentSlot, ItemInstance | null>;
    inventory: ItemInstance[];
    
    currentLocationId: string;
    activeTravel: { destinationLocationId: string; finishTime: number } | null;
    activeExpedition: { 
        expeditionId: string; 
        finishTime: number; 
        enemies: any[]; 
        combatLog: CombatLogEntry[]; 
        rewards: { gold: number; experience: number } 
    } | null;
    isResting: boolean;
    restStartHealth: number;
    lastRestTime: number;
    lastEnergyUpdateTime: number;
    
    backpack: { level: number };
    camp: { level: number };
    chest?: { level: number; gold: number }; 
    treasury?: { level: number; gold: number };
    warehouse?: { level: number; items: ItemInstance[] };
    workshop?: { level: number };
    
    loadouts?: EquipmentLoadout[];

    acceptedQuests: string[];
    questProgress: PlayerQuestProgress[];
    
    learnedSkills: string[];
    activeSkills: string[];
    
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;

    activeRankId?: string;
    
    traderData?: TraderData;
    
    guildId?: number;
    guildBarracksLevel?: number;
    guildShrineLevel?: number;
    activeGuildBuffs?: GuildBuff[];
    
    settings?: { language: Language };
    description?: string;
    avatarUrl?: string;
    email?: string;
    windowBackgroundUrl?: string;
    
    activeTowerRun?: ActiveTowerRun;
    resetsUsed?: number; // Licznik resetów statystyk
}

export interface PublicCharacterProfile {
    name: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    guildName?: string;
    guildTag?: string;
    avatarUrl?: string;
    description?: string;
    isOnline: boolean;
}

export interface AdminCharacterInfo {
    user_id: number;
    username: string;
    name: string;
    level: number;
    gold: number;
    race: Race;
    characterClass?: CharacterClass;
}

export interface RankingPlayer {
    id: number;
    name: string;
    race: Race;
    characterClass?: CharacterClass;
    level: number;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;
    guildTag?: string;
    isOnline: boolean;
}

export interface PlayerRank {
    id: string;
    name: string;
    bonus: RolledAffixStats;
}
