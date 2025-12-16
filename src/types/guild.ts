import { CharacterResources, CharacterStats } from './character';
import { CurrencyType, EssenceType, Race, CharacterClass } from './common';
import { CombatLogEntry, ItemInstance } from './index';

export enum GuildRole {
    LEADER = 'LEADER',
    OFFICER = 'OFFICER',
    MEMBER = 'MEMBER',
    RECRUIT = 'RECRUIT'
}

export interface GuildBuff {
    id: string;
    name: string;
    stats: Partial<CharacterStats> & { expBonus?: number };
    expiresAt: number;
}

export interface GuildMember {
    userId: number;
    name: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
    role: GuildRole;
    joinedAt: string;
    isOnline: boolean;
}

export interface GuildChatMessage {
    id: number;
    userId: number;
    characterName: string;
    role: GuildRole;
    content: string;
    timestamp: string;
}

export interface GuildTransaction {
    id: number;
    userId: number;
    characterName: string;
    type: 'DEPOSIT' | 'WITHDRAW' | 'RENTAL' | 'TAX' | 'LOOT' | 'WAR_LOSS';
    currency: CurrencyType;
    amount: number;
    timestamp: string;
}

export interface GuildArmoryItem {
    id: number;
    item: ItemInstance;
    ownerId: number;
    ownerName: string;
    depositedAt: string;
    borrowedBy?: string;
    userId?: number; // Borrower ID
}

export interface Guild {
    id: number;
    name: string;
    tag: string;
    leaderId: number;
    description: string;
    crestUrl: string;
    resources: CharacterResources;
    memberCount: number;
    maxMembers: number;
    createdAt: string;
    isPublic: boolean;
    minLevel: number;
    rentalTax: number;
    huntingTax: number;
    buildings: Record<string, number>;
    activeBuffs: GuildBuff[];
    members?: GuildMember[];
    transactions?: GuildTransaction[];
    chatHistory?: GuildChatMessage[];
    myRole?: GuildRole;
}

export interface GuildRankingEntry {
    id: number;
    name: string;
    tag: string;
    memberCount: number;
    totalLevel: number;
}

export interface PublicGuildProfile {
    id: number;
    name: string;
    tag: string;
    leaderName: string;
    memberCount: number;
    maxMembers: number;
    totalLevel: number;
    createdAt: string;
    description: string;
    crestUrl: string;
    isPublic: boolean;
    minLevel: number;
}

// --- Raids ---

export enum RaidType {
    RESOURCES = 'RESOURCES',
    SPARRING = 'SPARRING'
}

export enum RaidStatus {
    PREPARING = 'PREPARING',
    FIGHTING = 'FIGHTING',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED'
}

export interface RaidParticipant {
    userId: number;
    name: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
}

export interface GuildRaid {
    id: number;
    attackerGuildId: number;
    defenderGuildId: number;
    status: RaidStatus;
    type: RaidType;
    startTime: string;
    createdAt: string;
    attackerParticipants: RaidParticipant[];
    defenderParticipants: RaidParticipant[];
    winnerGuildId?: number;
    loot?: { gold: number; essences: Record<string, number> };
    combatLog?: CombatLogEntry[] | string;
    attackerGuildName: string;
    defenderGuildName: string;
}

// --- Hunting Parties (Used in Guilds and Public) ---

export enum PartyStatus {
    Forming = 'FORMING',
    Preparing = 'PREPARING',
    Fighting = 'FIGHTING',
    Finished = 'FINISHED'
}

export enum PartyMemberStatus {
    Leader = 'Leader',
    Member = 'Member',
    Pending = 'Pending'
}

export interface PartyMember {
    userId: number;
    characterName: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
    status: PartyMemberStatus;
    stats?: CharacterStats;
}

export interface HuntingParty {
    id: number;
    leaderId: number;
    bossId: string;
    maxMembers: number;
    status: PartyStatus;
    startTime: string | null;
    createdAt: string;
    members: PartyMember[];
    combatLog?: CombatLogEntry[];
    allRewards?: Record<string, any>;
    victory?: boolean;
    guildId?: number;
    leaderName?: string; // Computed
    currentMembersCount?: number; // Computed
    autoJoin?: boolean;
    
    // Client specific
    myRewards?: any;
    messageId?: number;
}

export interface EspionageEntry {
    id: number;
    attackerGuildId: number;
    defenderGuildId: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
    startTime: string;
    endTime: string;
    resultSnapshot?: CharacterResources; // If completed
    cost: number;
    targetGuildName: string;
}