
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

export enum ItemRarity {
    Common = 'Common',
    Uncommon = 'Uncommon',
    Rare = 'Rare',
    Epic = 'Epic',
    Legendary = 'Legendary'
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

export enum EssenceType {
    Common = 'commonEssence',
    Uncommon = 'uncommonEssence',
    Rare = 'rareEssence',
    Epic = 'epicEssence',
    Legendary = 'legendaryEssence'
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

export enum SpecialAttackType {
    Stun = 'Stun',
    ArmorPierce = 'ArmorPierce',
    DeathTouch = 'DeathTouch',
    EmpoweredStrikes = 'EmpoweredStrikes',
    Earthquake = 'Earthquake'
}

export enum ItemCategory {
    Weapon = 'Weapon',
    Armor = 'Armor',
    Jewelry = 'Jewelry'
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

export enum SkillType {
    Universal = 'Universal',
    Class = 'Class',
    Race = 'Race'
}

export enum SkillCategory {
    Passive = 'Passive',
    Active = 'Active'
}

export enum QuestType {
    Kill = 'Kill',
    Gather = 'Gather',
    GatherResource = 'GatherResource',
    PayGold = 'PayGold'
}

export enum Tab {
    Statistics = 'Statistics',
    Equipment = 'Equipment',
    Expedition = 'Expedition',
    Camp = 'Camp',
    Location = 'Location',
    Resources = 'Resources',
    Ranking = 'Ranking',
    Messages = 'Messages',
    Quests = 'Quests',
    Admin = 'Admin',
    Affixes = 'Affixes',
    Trader = 'Trader',
    Blacksmith = 'Blacksmith',
    Tavern = 'Tavern',
    Market = 'Market',
    Options = 'Options',
    University = 'University',
    Hunting = 'Hunting',
    Guild = 'Guild',
    Tower = 'Tower'
}

export enum Language {
    PL = 'pl',
    EN = 'en'
}

export enum GuildRole {
    LEADER = 'LEADER',
    OFFICER = 'OFFICER',
    MEMBER = 'MEMBER',
    RECRUIT = 'RECRUIT'
}

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

// Interfaces

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

export interface CharacterResources {
    gold: number;
    commonEssence: number;
    uncommonEssence: number;
    rareEssence: number;
    epicEssence: number;
    legendaryEssence: number;
}

export interface GuildBuff {
    id: string;
    name: string;
    stats: Partial<CharacterStats> & { expBonus?: number };
    expiresAt: number;
}

export interface PlayerCharacter {
    id: number;
    user_id: number; // For admin/backend consistency
    username: string; // For admin display
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
    chest?: { level: number; gold: number }; // Legacy/Alt
    treasury?: { level: number; gold: number };
    warehouse?: { level: number; items: ItemInstance[] };
    
    acceptedQuests: string[];
    questProgress: PlayerQuestProgress[];
    
    learnedSkills: string[];
    activeSkills: string[];
    
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;
    
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
}

export interface AdminCharacterInfo {
    user_id: number;
    username: string;
    name: string;
    level: number;
    gold: number;
    race?: Race;
    characterClass?: CharacterClass;
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
    
    damageMin?: number;
    damageMax?: number;
    armorBonus?: number;
    
    statsBonus?: Partial<CharacterStats>;
    requiredStats?: Partial<CharacterStats>;
    
    isMagical?: boolean;
    isRanged?: boolean;
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
}

export interface Affix {
    id: string;
    name: string | { masculine: string; feminine: string; neuter: string };
    type: AffixType;
    value?: number;
    spawnChances: Partial<Record<ItemCategory, number>>;
    
    // Stats similar to ItemTemplate but usually ranges or specific bonuses
    statsBonus?: Record<string, { min: number; max: number }>;
    
    damageMin?: { min: number; max: number };
    damageMax?: { min: number; max: number };
    armorBonus?: { min: number; max: number };
    maxHealthBonus?: { min: number; max: number };
    
    // ... other stats ranges
    critChanceBonus?: { min: number; max: number };
    critDamageModifierBonus?: { min: number; max: number };
    attacksPerRoundBonus?: { min: number; max: number };
    dodgeChanceBonus?: { min: number; max: number };
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
    uniqueId?: string; // Runtime
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
    
    // Runtime state
    currentHealth?: number;
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

export interface Location {
    id: string;
    name: string;
    description: string;
    image?: string;
    travelTime: number;
    travelCost: number;
    travelEnergyCost: number;
    availableTabs: Tab[];
    isStartLocation: boolean;
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
    lootTable: LootDrop[];
    resourceLootTable: ResourceDrop[];
    maxEnemies: number;
    maxItems?: number;
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
    manaMaintenanceCost?: number;
}

export interface ItemReward { templateId: string; quantity: number }
export interface ResourceReward { resource: EssenceType; quantity: number }

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
        gold: number;
        experience: number;
        itemRewards: ItemReward[];
        resourceRewards: ResourceReward[];
        lootTable?: LootDrop[];
    };
    repeatable: number; // 0 = infinite
}

export interface PlayerQuestProgress {
    questId: string;
    progress: number;
    completions: number;
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
    allRewards?: Record<string, { gold: number; experience: number, items?: ItemInstance[], essences?: Partial<Record<EssenceType, number>> }>;
    bossId?: string;
}

export interface RewardSource {
    source: string;
    gold: number;
    experience: number;
}

export interface PvpRewardSummary {
    combatLog: CombatLogEntry[];
    isVictory: boolean;
    gold: number;
    experience: number;
    attacker: PlayerCharacter;
    defender: PlayerCharacter;
}

export type MessageType = 'player_message' | 'system' | 'expedition_report' | 'pvp_report' | 'market_notification' | 'guild_invite' | 'raid_report';

export interface Message {
    id: number;
    recipient_id: number;
    sender_id?: number;
    sender_name?: string;
    message_type: MessageType;
    subject: string;
    body: any; // JSON
    is_read: boolean;
    is_saved: boolean;
    created_at: string;
}

export interface PlayerMessageBody {
    content: string;
}

export interface MarketNotificationBody {
    type: 'SOLD' | 'BOUGHT' | 'WON' | 'EXPIRED' | 'ITEM_RETURNED' | 'OUTBID';
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

export interface GuildChatMessage {
    id: number;
    userId: number;
    characterName: string;
    role: GuildRole;
    content: string;
    timestamp: string;
}

export type CurrencyType = 'gold' | EssenceType;
export enum ListingType {
    BuyNow = 'buy_now',
    Auction = 'auction'
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
    guildTag?: string;
    isOnline: boolean;
}

export interface GuildRankingEntry {
    id: number;
    name: string;
    tag: string;
    memberCount: number;
    totalLevel: number;
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
    autoJoin?: boolean; // New field for selective/open party
    
    // Client specific
    myRewards?: any;
    messageId?: number;
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

export interface RaidParticipant {
    userId: number;
    name: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
}

export interface Tower {
    id: string;
    name: string;
    description: string;
    locationId: string;
    totalFloors: number;
    floors: TowerFloor[];
    image?: string; // Added image support
    grandPrize: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
        // Added random rewards to grand prize
        randomItemRewards?: { rarity: ItemRarity; chance: number; amount: number; affixCount?: number }[];
    };
    isActive: boolean;
}

export interface TowerFloor {
    floorNumber: number;
    enemies: { enemyId: string; spawnChance: number }[];
    energyCost: number;
    duration: number; // Seconds
    guaranteedReward?: { gold: number; experience: number };
    lootTable?: LootDrop[];
    resourceLootTable?: ResourceDrop[];
    // New: Specific item rewards
    specificItemRewards?: ItemInstance[];
    randomItemRewards?: { rarity: ItemRarity; chance: number; amount: number; affixCount?: number }[];
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

export interface Ritual {
    id: string;
    name: string;
    description: string;
    tier: number;
    durationMinutes: number;
    cost: { type: EssenceType | 'gold'; amount: number }[];
    stats: Partial<CharacterStats> & { expBonus?: number };
}

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
    settings?: GameSettings;
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

export interface GlobalStats {
    totalPlayers: number;
    totalGoldInEconomy: number;
    raceCounts: Record<string, number>;
    classCounts: Record<string, number>;
    topItems: { id: string; count: number }[];
    topAffixes: { id: string; count: number }[];
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

export interface ItemSearchResult {
    item: ItemInstance;
    template: ItemTemplate;
    locations: {
        userId: number;
        ownerName: string;
        location: string; // 'inventory', 'equipment:head', 'market:123', 'armory:456'
    }[];
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
