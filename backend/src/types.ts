
export enum Race {
    Human = 'Human',
    Elf = 'Elf',
    Orc = 'Orc',
    Gnome = 'Gnome',
    Dwarf = 'Dwarf'
}

export enum CharacterClass {
    Mage = 'Mage',
    Warrior = 'Warrior',
    Rogue = 'Rogue',
    Wizard = 'Wizard',
    Hunter = 'Hunter',
    Druid = 'Druid',
    Shaman = 'Shaman',
    Berserker = 'Berserker',
    Blacksmith = 'Blacksmith',
    DungeonHunter = 'DungeonHunter',
    Thief = 'Thief',
    Engineer = 'Engineer'
}

export enum EssenceType {
    Common = 'commonEssence',
    Uncommon = 'uncommonEssence',
    Rare = 'rareEssence',
    Epic = 'epicEssence',
    Legendary = 'legendaryEssence'
}

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
    Chest = 'chest',
    Legs = 'legs',
    Feet = 'feet',
    Hands = 'hands',
    Waist = 'waist',
    Neck = 'neck',
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

export enum QuestType {
    Kill = 'Kill',
    Gather = 'Gather',
    GatherResource = 'GatherResource',
    PayGold = 'PayGold'
}

export enum SkillType {
    Universal = 'Universal',
    Racial = 'Racial',
    Class = 'Class'
}

export enum SkillCategory {
    Passive = 'Passive',
    Active = 'Active'
}

export enum GuildRole {
    LEADER = 'LEADER',
    OFFICER = 'OFFICER',
    MEMBER = 'MEMBER',
    RECRUIT = 'RECRUIT'
}

export enum Tab {
    Statistics = 'Statistics',
    Equipment = 'Equipment',
    Expedition = 'Expedition',
    Quests = 'Quests',
    Camp = 'Camp',
    Location = 'Location',
    Resources = 'Resources',
    Ranking = 'Ranking',
    Messages = 'Messages',
    Trader = 'Trader',
    Blacksmith = 'Blacksmith',
    Tavern = 'Tavern',
    Market = 'Market',
    Options = 'Options',
    Admin = 'Admin',
    University = 'University',
    Hunting = 'Hunting',
    Guild = 'Guild',
    Tower = 'Tower'
}

export enum Language {
    PL = 'pl',
    EN = 'en'
}

export enum CurrencyType {
    Gold = 'gold',
    Common = 'commonEssence',
    Uncommon = 'uncommonEssence',
    Rare = 'rareEssence',
    Epic = 'epicEssence',
    Legendary = 'legendaryEssence'
}

export enum ListingType {
    BuyNow = 'buy_now',
    Auction = 'auction'
}

export enum PartyStatus {
    Forming = 'FORMING',
    Preparing = 'PREPARING',
    Fighting = 'FIGHTING',
    Finished = 'FINISHED'
}

export enum PartyMemberStatus {
    Leader = 'LEADER',
    Member = 'MEMBER',
    Pending = 'PENDING'
}

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

export enum SpecialAttackType {
    Stun = 'Stun',
    ArmorPierce = 'ArmorPierce',
    DeathTouch = 'DeathTouch',
    EmpoweredStrikes = 'EmpoweredStrikes',
    Earthquake = 'Earthquake'
}

export enum TowerRunStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    RETREATED = 'RETREATED'
}

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
    currentEnergy: number;
    maxEnergy: number;
    currentMana: number;
    maxMana: number;
    
    minDamage: number;
    maxDamage: number;
    magicDamageMin: number;
    magicDamageMax: number;
    
    armor: number;
    critChance: number;
    critDamageModifier: number;
    attacksPerRound: number;
    manaRegen: number;
    dodgeChance: number;
    
    armorPenetrationPercent: number;
    armorPenetrationFlat: number;
    lifeStealPercent: number;
    lifeStealFlat: number;
    manaStealPercent: number;
    manaStealFlat: number;
}

export interface RolledAffixStats {
    statsBonus?: Partial<CharacterStats>;
    damageMin?: number;
    damageMax?: number;
    attacksPerRoundBonus?: number;
    dodgeChanceBonus?: number;
    armorBonus?: number;
    critChanceBonus?: number;
    maxHealthBonus?: number;
    critDamageModifierBonus?: number;
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
    prefixId?: string;
    suffixId?: string;
    upgradeLevel?: number;
    rolledBaseStats?: RolledAffixStats;
    rolledPrefix?: RolledAffixStats;
    rolledSuffix?: RolledAffixStats;
    isBorrowed?: boolean;
    borrowedFromGuildId?: number;
    originalOwnerId?: number;
    originalOwnerName?: string;
    borrowedAt?: number;
}

export interface ItemTemplate {
    id: string;
    name: string;
    description: string;
    slot: EquipmentSlot | 'ring' | 'consumable';
    category: ItemCategory;
    rarity: ItemRarity;
    icon?: string;
    value: number;
    requiredLevel: number;
    gender?: GrammaticalGender;
    
    // Base Stats
    damageMin?: { min: number; max: number };
    damageMax?: { min: number; max: number };
    armorBonus?: { min: number; max: number };
    critChanceBonus?: number;
    maxHealthBonus?: { min: number; max: number };
    
    // Advanced
    critDamageModifierBonus?: number;
    armorPenetrationPercent?: number;
    armorPenetrationFlat?: number;
    lifeStealPercent?: number;
    lifeStealFlat?: number;
    manaStealPercent?: number;
    manaStealFlat?: number;
    
    // Magic
    isMagical?: boolean;
    isRanged?: boolean;
    magicAttackType?: MagicAttackType;
    manaCost?: { min: number; max: number };
    magicDamageMin?: { min: number; max: number };
    magicDamageMax?: { min: number; max: number };
    
    attacksPerRound?: number;
    
    requiredStats?: Partial<CharacterStats>;
    statsBonus?: Partial<Record<keyof CharacterStats, { min: number; max: number }>>;
}

export interface Affix {
    id: string;
    name: {
        masculine: string;
        feminine: string;
        neuter: string;
    } | string;
    type: AffixType;
    value: number;
    requiredLevel?: number;
    spawnChances: Partial<Record<ItemCategory, number>>;
    
    requiredStats?: Partial<CharacterStats>;
    statsBonus?: Partial<Record<keyof CharacterStats, { min: number; max: number }>>;
    
    // Bonuses (Range)
    damageMin?: { min: number; max: number };
    damageMax?: { min: number; max: number };
    attacksPerRoundBonus?: number;
    dodgeChanceBonus?: number;
    armorBonus?: { min: number; max: number };
    critChanceBonus?: number;
    maxHealthBonus?: { min: number; max: number };
    critDamageModifierBonus?: { min: number; max: number };
    armorPenetrationPercent?: { min: number; max: number };
    armorPenetrationFlat?: { min: number; max: number };
    lifeStealPercent?: { min: number; max: number };
    lifeStealFlat?: { min: number; max: number };
    manaStealPercent?: { min: number; max: number };
    manaStealFlat?: { min: number; max: number };
    magicDamageMin?: { min: number; max: number };
    magicDamageMax?: { min: number; max: number };
}

export interface PlayerCharacter {
    id: number;
    name: string;
    username?: string;
    email?: string;
    description?: string;
    avatarUrl?: string;
    race: Race;
    characterClass?: CharacterClass;
    level: number;
    experience: number;
    experienceToNextLevel: number;
    
    stats: CharacterStats;
    resources: CharacterResources;
    
    currentLocationId: string;
    
    equipment: {
        [key in EquipmentSlot]: ItemInstance | null;
    };
    inventory: ItemInstance[];
    
    activeExpedition?: {
        expeditionId: string;
        finishTime: number;
        enemies: string[];
        combatLog: CombatLogEntry[];
        rewards: {
            gold: number;
            experience: number;
        }
    } | null;
    
    activeTravel?: {
        destinationLocationId: string;
        finishTime: number;
    } | null;
    
    activeTowerRun?: ActiveTowerRun | null;
    
    isResting: boolean;
    restStartHealth: number;
    lastRestTime?: number;
    lastEnergyUpdateTime?: number;
    
    camp?: { level: number };
    treasury?: { level: number, gold: number };
    chest?: { level: number, gold: number }; // Legacy alias
    warehouse?: { level: number, items: ItemInstance[] };
    backpack?: { level: number };
    
    questProgress: PlayerQuestProgress[];
    acceptedQuests: string[];
    
    learnedSkills: string[];
    activeSkills: string[];
    
    settings?: GameSettings;
    
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;
    
    traderData?: TraderData;
    
    guildId?: number;
    guildBarracksLevel?: number;
    guildShrineLevel?: number;
    activeGuildBuffs?: GuildBuff[];

    freeStatResetUsed?: boolean;
    windowBackgroundUrl?: string;
}

export interface PlayerQuestProgress {
    questId: string;
    progress: number;
    completions: number;
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
    maxMana?: number;
    manaRegen?: number;
    magicDamageMin?: number;
    magicDamageMax?: number;
    magicAttackChance?: number;
    magicAttackManaCost?: number;
    magicAttackType?: MagicAttackType;
    attacksPerTurn?: number;
    armorPenetrationPercent?: number;
    armorPenetrationFlat?: number;
}

export interface BossSpecialAttack {
    type: SpecialAttackType;
    chance: number; // % per turn
    uses: number; // Max uses per combat
}

export interface Enemy {
    id: string;
    uniqueId?: string;
    name: string;
    description: string;
    image?: string;
    stats: EnemyStats;
    rewards: {
        minGold: number;
        maxGold: number;
        minExperience: number;
        maxExperience: number;
    };
    lootTable?: LootDrop[];
    resourceLootTable?: ResourceDrop[];
    isBoss?: boolean;
    isGuildBoss?: boolean;
    preparationTimeSeconds?: number;
    specialAttacks?: BossSpecialAttack[];
}

export interface LootDrop {
    templateId: string;
    chance: number;
}

export interface ResourceDrop {
    resource: EssenceType;
    min: number;
    max: number;
    chance: number;
}

export interface ExpeditionEnemy {
    enemyId: string;
    spawnChance: number;
}

export interface Expedition {
    id: string;
    name: string;
    description: string;
    image?: string;
    duration: number;
    goldCost: number;
    energyCost: number;
    minBaseGoldReward: number;
    maxBaseGoldReward: number;
    minBaseExperienceReward: number;
    maxBaseExperienceReward: number;
    locationIds: string[];
    enemies: ExpeditionEnemy[];
    lootTable?: LootDrop[];
    resourceLootTable?: ResourceDrop[];
    maxEnemies?: number;
    maxItems?: number;
}

export interface Location {
    id: string;
    name: string;
    description: string;
    image?: string;
    travelTime: number;
    travelCost: number;
    travelEnergyCost: number;
    availableTabs?: Tab[];
    isStartLocation?: boolean;
}

export interface Quest {
    id: string;
    name: string;
    description: string;
    locationIds: string[];
    objective: {
        type: QuestType;
        targetId: string;
        amount: number;
    };
    rewards: {
        gold?: number;
        experience?: number;
        itemRewards?: ItemReward[];
        resourceRewards?: ResourceReward[];
        lootTable?: LootDrop[];
    };
    repeatable: number;
}

export interface ItemReward {
    templateId: string;
    quantity: number;
}

export interface ResourceReward {
    resource: EssenceType;
    quantity: number;
}

export interface SkillRequirements {
    level?: number;
    strength?: number;
    agility?: number;
    accuracy?: number;
    stamina?: number;
    intelligence?: number;
    energy?: number;
}

export interface SkillCost {
    gold?: number;
    commonEssence?: number;
    uncommonEssence?: number;
    rareEssence?: number;
    epicEssence?: number;
    legendaryEssence?: number;
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    type: SkillType;
    category: SkillCategory;
    requirements: SkillRequirements;
    cost: SkillCost;
    manaMaintenanceCost?: number; // For active skills
}

export interface Ritual {
    id: string;
    name: string;
    description: string;
    tier: number;
    durationMinutes: number;
    cost: { type: EssenceType | 'gold'; amount: number }[];
    stats: Partial<CharacterStats & { expBonus: number }>;
}

export interface TowerFloor {
    floorNumber: number;
    enemies: ExpeditionEnemy[]; 
    energyCost?: number;
    duration?: number;
    guaranteedReward?: {
        gold: number;
        experience: number;
    };
    lootTable?: LootDrop[];
    resourceLootTable?: ResourceDrop[];
    specificItemRewards?: ItemInstance[]; 
    randomItemRewards?: {
        rarity: ItemRarity;
        chance: number;
        amount: number;
        affixCount?: number;
    }[];
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
        items?: ItemInstance[];
        essences?: Partial<Record<EssenceType, number>>;
    };
    isActive: boolean;
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
    status: TowerRunStatus;
}

export interface TraderSettings {
    rarityChances: Partial<Record<ItemRarity, number>>;
}

export interface GameSettings {
    language: Language;
    newsContent?: string;
    newsLastUpdatedAt?: number;
    traderSettings?: TraderSettings;
    pvpProtectionMinutes?: number;
    logoUrl?: string;
    windowBackgroundUrl?: string;
    sidebarBackgroundUrl?: string;
    reportBackgroundUrl?: string;
    loginBackground?: string;
    gameBackground?: string;
    sidebarOrder?: Tab[];
    titleScreen?: {
        description?: string;
        images?: string[];
    }
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
    settings: GameSettings;
}

export interface CombatLogEntry {
    turn: number;
    attacker: string;
    defender: string;
    action: string;
    damage?: number;
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
    effectApplied?: string;
    manaSpent?: number;
    
    // Snapshots
    playerStats?: CharacterStats;
    enemyStats?: EnemyStats;
    enemyDescription?: string;
    
    // Team/Group context
    allPlayersHealth?: { name: string; currentHealth: number; maxHealth: number; currentMana?: number; maxMana?: number }[];
    allEnemiesHealth?: { uniqueId: string; name: string; currentHealth: number; maxHealth: number }[];
    partyMemberStats?: Record<string, CharacterStats>;
    
    specialAttackType?: SpecialAttackType;
    shout?: string;
    aoeDamage?: { target: string; damage: number }[];
    stunnedPlayer?: string;
}

export interface ExpeditionRewardSummary {
    rewardBreakdown: RewardSource[];
    totalGold: number;
    totalExperience: number;
    combatLog: CombatLogEntry[];
    isVictory: boolean;
    itemsFound: ItemInstance[];
    essencesFound: Partial<Record<EssenceType, number>>;
    itemsLostCount?: number;
    
    huntingMembers?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number, items?: ItemInstance[], essences?: Partial<Record<EssenceType, number>> }>;
    bossId?: string;
    encounteredEnemies?: Enemy[];
}

export interface RewardSource {
    source: string;
    gold: number;
    experience: number;
}

export interface PartyMember {
    userId: number;
    characterName: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
    status: PartyMemberStatus;
    stats?: CharacterStats; // Snapshot for reports
}

export interface HuntingParty {
    id: number;
    leaderId: number;
    leaderName?: string; // hydrated
    bossId: string;
    maxMembers: number;
    status: PartyStatus;
    startTime?: string; // ISO
    createdAt: string;
    members: PartyMember[];
    currentMembersCount?: number; // hydrated
    combatLog?: CombatLogEntry[];
    allRewards?: Record<string, any>;
    myRewards?: any;
    victory?: boolean;
    guildId?: number;
    messageId?: number;
}

export interface Guild {
    id: number;
    name: string;
    tag: string;
    description: string;
    crestUrl?: string;
    leaderId: number;
    memberCount: number;
    maxMembers: number;
    createdAt: string;
    minLevel: number;
    isPublic: boolean;
    rentalTax: number;
    huntingTax: number;
    
    resources: CharacterResources;
    buildings: {
        headquarters: number;
        armory: number;
        barracks: number;
        scoutHouse: number;
        shrine: number;
        altar: number;
    };
    activeBuffs: GuildBuff[];
    
    // Hydrated
    members?: {
        userId: number;
        name: string;
        level: number;
        race: Race;
        characterClass?: CharacterClass;
        role: GuildRole;
        joinedAt: string;
        isOnline: boolean;
    }[];
    transactions?: {
        id: number;
        userId: number;
        characterName: string;
        type: string;
        currency: string;
        amount: number;
        timestamp: string;
    }[];
    chatHistory?: GuildChatMessage[];
    
    myRole?: GuildRole;
}

export interface GuildBuff {
    id: string;
    name: string;
    stats: Partial<CharacterStats & { expBonus: number }>;
    expiresAt: number;
}

export interface GuildChatMessage {
    id: number;
    userId: number;
    characterName: string;
    role: GuildRole;
    content: string;
    timestamp: string;
}

export interface GuildArmoryItem {
    id: number;
    item: ItemInstance;
    ownerId: number;
    ownerName: string;
    depositedAt: string;
    borrowedBy?: string;
    userId?: number;
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
    loot?: {
        gold: number;
        essences: Partial<Record<EssenceType, number>>;
    };
    combatLog?: CombatLogEntry[] | string; // Can be string from DB
    
    // Hydrated
    attackerGuildName: string;
    defenderGuildName: string;
}

export interface RaidParticipant {
    userId: number;
    name: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
}

export interface AdminCharacterInfo {
    user_id: number;
    username: string;
    name: string;
    level: number;
    gold: number;
}

export interface TraderInventoryData {
    regularItems: ItemInstance[];
    specialOfferItems: ItemInstance[];
}

export interface TraderData {
    lastRefresh: number;
    regularItems: ItemInstance[];
    specialOfferItems: ItemInstance[];
}

export interface Message {
    id: number;
    recipient_id: number;
    sender_id?: number;
    sender_name?: string;
    message_type: 'system' | 'player_message' | 'battle_report' | 'expedition_report' | 'market_notification' | 'pvp_report' | 'guild_invite' | 'raid_report';
    subject: string;
    body: any; // JSON
    is_read: boolean;
    is_saved: boolean;
    created_at: string;
}

export type MessageType = Message['message_type'];

export interface PlayerMessageBody {
    content: string;
}

export interface MarketNotificationBody {
    type: 'SOLD' | 'BOUGHT' | 'WON' | 'OUTBID' | 'EXPIRED' | 'ITEM_RETURNED' | 'CANCELLED';
    itemName: string;
    price?: number;
    currency?: CurrencyType;
    item?: ItemInstance;
    listingId?: number;
}

export interface GuildInviteBody {
    guildId: number;
    guildName: string;
}

export interface TavernMessage {
    id: number;
    user_id: number;
    character_name: string;
    content: string;
    created_at: string;
}

export interface MarketListing {
    id: number;
    seller_id: number;
    seller_name: string;
    item_data: ItemInstance;
    listing_type: ListingType;
    currency: CurrencyType;
    buy_now_price?: number;
    start_bid_price?: number;
    current_bid_price?: number;
    highest_bidder_id?: number;
    highest_bidder_name?: string;
    created_at: string;
    expires_at: string;
    status: 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'CANCELLED' | 'CLAIMED';
    bid_count: number;
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
    isOnline: boolean;
    guildTag?: string;
}

export interface GuildRankingEntry {
    id: number;
    name: string;
    tag: string;
    memberCount: number;
    totalLevel: number;
}

export interface GlobalStats {
    totalPlayers: number;
    totalGoldInEconomy: number;
    raceCounts: Record<string, number>;
    classCounts: Record<string, number>;
    topItems: { id: string, count: number }[];
    topAffixes: { id: string, count: number }[];
}

export interface PublicCharacterProfile {
    name: string;
    race: Race;
    characterClass?: CharacterClass;
    level: number;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    description?: string;
    avatarUrl?: string;
    guildName?: string;
    guildTag?: string;
    isOnline: boolean;
}

export interface PublicGuildProfile {
    id: number;
    name: string;
    tag: string;
    description: string;
    crestUrl?: string;
    leaderName: string;
    memberCount: number;
    maxMembers: number;
    totalLevel: number;
    createdAt: string;
    isPublic: boolean;
    minLevel: number;
}

export interface PvpRewardSummary {
    gold: number;
    experience: number;
    combatLog: CombatLogEntry[];
    isVictory: boolean;
    attacker: PlayerCharacter;
    defender: PlayerCharacter;
}

export interface ItemSearchResult {
    item: ItemInstance;
    template: ItemTemplate;
    locations: {
        userId: number;
        ownerName: string;
        location: string;
    }[];
}

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

export type Key = string | number | symbol;
