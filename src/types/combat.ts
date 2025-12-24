
import { EssenceType } from './common.js';
import { MagicAttackType, ItemInstance, LootDrop, ResourceDrop } from './items.js';
import { CharacterStats, PlayerCharacter } from './character.js';
import { PartyMember } from './guild.js';

export enum CombatType {
    PVE = 'PVE',
    PVP = 'PVP',
    HUNTING = 'HUNTING',
    RAID = 'RAID',
    TOWER = 'TOWER'
}

export enum SpecialAttackType {
    Stun = 'Stun',
    ArmorPierce = 'ArmorPierce',
    DeathTouch = 'DeathTouch',
    EmpoweredStrikes = 'EmpoweredStrikes',
    Earthquake = 'Earthquake'
}

export interface EnemyStats {
    maxHealth: number;
    minDamage: number;
    maxDamage: number;
    armor: number;
    critChance: number;
    critDamageModifier: number;
    agility: number;
    dodgeChance: number;
    blockChance?: number;
    maxMana: number;
    manaRegen: number;
    magicDamageMin: number;
    magicDamageMax: number;
    magicAttackChance: number;
    magicAttackManaCost: number;
    attacksPerTurn: number;
    armorPenetrationPercent?: number;
    armorPenetrationFlat?: number;
    magicAttackType?: MagicAttackType;
}

export interface BossSpecialAttack {
    type: SpecialAttackType;
    chance: number;
    uses: number;
}

export interface Enemy {
    id: string;
    uniqueId?: string;
    name: string;
    description: string;
    image?: string;
    isBoss: boolean;
    isGuildBoss?: boolean;
    stats: EnemyStats;
    rewards: {
        minGold: number;
        maxGold: number;
        minExperience: number;
        maxExperience: number;
    };
    lootTable: LootDrop[];
    resourceLootTable: ResourceDrop[];
    specialAttacks?: BossSpecialAttack[];
    preparationTimeSeconds?: number;
    currentHealth?: number;
}

export interface CombatLogEntry {
    turn: number;
    attacker: string;
    defender: string;
    action: string;
    damage?: number;
    bonusDamage?: number;
    isCrit?: boolean;
    damageReduced?: number;
    healthGained?: number;
    manaGained?: number;
    magicAttackType?: MagicAttackType;
    weaponName?: string;
    playerHealth: number;
    playerMana: number;
    enemyHealth: number;
    enemyMana: number;
    isDodge?: boolean;
    isBlock?: boolean;
    effectApplied?: string;
    manaSpent?: number;
    playerStats?: CharacterStats;
    enemyStats?: EnemyStats;
    enemyDescription?: string;
    allPlayersHealth?: { name: string; currentHealth: number; maxHealth: number; currentMana?: number; maxMana?: number }[];
    allEnemiesHealth?: { uniqueId: string; name: string; currentHealth: number; maxHealth: number }[];
    partyMemberStats?: Record<string, CharacterStats>;
    specialAttackType?: SpecialAttackType;
    shout?: string;
    aoeDamage?: { target: string; damage: number }[];
    stunnedPlayer?: string;
}

export interface RewardSource {
    source: string;
    gold: number;
    experience: number;
}

export interface ExpeditionRewardSummary {
    isVictory: boolean;
    totalGold: number;
    totalExperience: number;
    itemsFound: ItemInstance[];
    essencesFound: Partial<Record<EssenceType, number>>;
    combatLog: CombatLogEntry[];
    rewardBreakdown: RewardSource[];
    itemsLostCount?: number;
    encounteredEnemies?: Enemy[];
    huntingMembers?: PartyMember[];
    opponents?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number, items?: ItemInstance[], essences?: Partial<Record<EssenceType, number>> }>;
    bossId?: string;
    combatType?: CombatType;
}

export interface PvpRewardSummary {
    combatLog: CombatLogEntry[];
    isVictory: boolean;
    gold: number;
    experience: number;
    attacker: PlayerCharacter;
    defender: PlayerCharacter;
    combatType: CombatType.PVP;
}
