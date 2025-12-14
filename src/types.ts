
export enum Race {
    Human = 'Human',
    Elf = 'Elf',
    Orc = 'Orc',
    Dwarf = 'Dwarf',
    Gnome = 'Gnome',
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
    Engineer = 'Engineer',
}

export enum ItemRarity {
    Common = 'Common',
    Uncommon = 'Uncommon',
    Rare = 'Rare',
    Epic = 'Epic',
    Legendary = 'Legendary',
}

export enum ItemCategory {
    Weapon = 'Weapon',
    Armor = 'Armor',
    Jewelry = 'Jewelry',
    Consumable = 'Consumable'
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
    TwoHand = 'twoHand',
}

export enum EssenceType {
    Common = 'commonEssence',
    Uncommon = 'uncommonEssence',
    Rare = 'rareEssence',
    Epic = 'epicEssence',
    Legendary = 'legendaryEssence',
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
    Earthquake = 'Earthquake',
}

export enum SkillType {
    Universal = 'Universal',
    Racial = 'Racial',
    Class = 'Class',
}

export enum SkillCategory {
    Passive = 'Passive',
    Active = 'Active',
}

export enum QuestType {
    Kill = 'Kill',
    Gather = 'Gather',
    GatherResource = 'GatherResource',
    PayGold = 'PayGold',
}

export enum ListingType {
    BuyNow = 'buy_now',
    Auction = 'auction',
}

export type CurrencyType = 'gold' | EssenceType;

export enum PartyStatus {
    Forming = 'FORMING',
    Preparing = 'PREPARING',
    Fighting = 'FIGHTING',
    Finished = 'FINISHED',
}

export enum PartyMemberStatus {
    Leader = 'LEADER',
    Member = 'MEMBER',
    Pending = 'PENDING',
}

export enum GuildRole {
    LEADER = 'LEADER',
    OFFICER = 'OFFICER',
    MEMBER = 'MEMBER',
    RECRUIT = 'RECRUIT',
}

export enum RaidStatus {
    PREPARING = 'PREPARING',
    FIGHTING = 'FIGHTING',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED',
}

export enum RaidType {
    RESOURCES = 'RESOURCES',
    SPARRING = 'SPARRING',
}

export enum SpecialAttackType {
    Stun = 'Stun',
    ArmorPierce = 'ArmorPierce',
    DeathTouch = 'DeathTouch',
    EmpoweredStrikes = 'EmpoweredStrikes',
    Earthquake = 'Earthquake',
}

export enum AffixType {
    Prefix = 'Prefix',
    Suffix = 'Suffix',
}

export enum GrammaticalGender {
    Masculine = 'masculine',
    Feminine = 'feminine',
    Neuter = 'neuter',
}

export enum MessageType {
    PlayerMessage = 'player_message',
    System = 'system',
    MarketNotification = 'market_notification',
    ExpeditionReport = 'expedition_report',
    PvpReport = 'pvp_report',
    RaidReport = 'raid_report',
    GuildInvite = 'guild_invite',
}

export enum Language {
    PL = 'pl',
    EN = 'en',
}

export enum TowerRunStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    RETREATED = 'RETREATED'
}

export const Tab = {
    Statistics: 'Statistics',
    Equipment: 'Equipment',
    Expedition: 'Expedition',
    Tower: 'Tower',
    Hunting: 'Hunting',
    Quests: 'Quests',
    Camp: 'Camp',
    Location: 'Location',
    Guild: 'Guild',
    University: 'University',
    Resources: 'Resources',
    Ranking: 'Ranking',
    Messages: 'Messages',
    Tavern: 'Tavern',
    Market: 'Market',
    Trader: 'Trader',
    Blacksmith: 'Blacksmith',
    Options: 'Options',
    Admin: 'Admin',
} as const;

export type Tab = typeof Tab[keyof typeof Tab];

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
    manaRegen: number;
    lifeStealPercent: number;
    lifeStealFlat: number;
    manaStealPercent: number;
    manaStealFlat: number;
    dodgeChance: number;
    armorPenetrationPercent: number;
    armorPenetrationFlat: number;
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
    
    magicAttackType?: MagicAttackType;
    armorPenetrationPercent?: number;
    armorPenetrationFlat?: number;
}

export interface RolledAffixStats extends Partial<CharacterStats> {
    statsBonus?: Partial<CharacterStats>;
    damageMin?: number;
    damageMax?: number;
    magicDamageMin?: number;
    magicDamageMax?: number;
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
    attacksPerRoundBonus?: number;
    dodgeChanceBonus?: number;
    manaCost?: { min: number, max: number };
    magicAttackType?: MagicAttackType;
}

export interface ItemTemplate {
    id: string;
    name: string;
    description: string;
    category: ItemCategory;
    slot: EquipmentSlot | 'ring' | 'consumable';
    rarity: ItemRarity;
    icon?: string;
    value: number;
    requiredLevel: number;
    requiredStats?: Partial<CharacterStats>;
    
    gender?: GrammaticalGender;
    
    statsBonus?: Partial<CharacterStats>;
    damageMin?: { min: number, max: number };
    damageMax?: { min: number, max: number };
    armorBonus?: { min: number, max: number };
    critChanceBonus?: { min: number, max: number };
    maxHealthBonus?: { min: number, max: number };
    critDamageModifierBonus?: { min: number, max: number };
    armorPenetrationPercent?: { min: number, max: number };
    armorPenetrationFlat?: { min: number, max: number };
    lifeStealPercent?: { min: number, max: number };
    lifeStealFlat?: { min: number, max: number };
    manaStealPercent?: { min: number, max: number };
    manaStealFlat?: { min: number, max: number };
    magicDamageMin?: { min: number, max: number };
    magicDamageMax?: { min: number, max: number };
    attacksPerRound?: number;
    dodgeChanceBonus?: { min: number, max: number };
    attacksPerRoundBonus?: { min: number, max: number };

    isMagical?: boolean;
    isRanged?: boolean;
    magicAttackType?: MagicAttackType;
    manaCost?: { min: number, max: number };
}

export interface Affix {
    id: string;
    name: { masculine: string, feminine?: string, neuter?: string } | string;
    type: AffixType;
    value: number;
    requiredLevel?: number;
    requiredStats?: Partial<CharacterStats>;
    spawnChances: Partial<Record<ItemCategory, number>>;
    
    statsBonus?: Partial<Record<keyof CharacterStats, { min: number, max: number }>>;
    damageMin?: { min: number, max: number };
    damageMax?: { min: number, max: number };
    armorBonus?: { min: number, max: number };
    critChanceBonus?: { min: number, max: number };
    maxHealthBonus?: { min: number, max: number };
    critDamageModifierBonus?: { min: number, max: number };
    armorPenetrationPercent?: { min: number, max: number };
    armorPenetrationFlat?: { min: number, max: number };
    lifeStealPercent?: { min: number, max: number };
    lifeStealFlat?: { min: number, max: number };
    manaStealPercent?: { min: number, max: number };
    manaStealFlat?: { min: number, max: number };
    magicDamageMin?: { min: number, max: number };
    magicDamageMax?: { min: number, max: number };
    attacksPerRoundBonus?: { min: number, max: number };
    dodgeChanceBonus?: { min: number, max: number };
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

export interface CharacterResources {
    gold: number;
    [EssenceType.Common]: number;
    [EssenceType.Uncommon]: number;
    [EssenceType.Rare]: number;
    [EssenceType.Epic]: number;
    [EssenceType.Legendary]: number;
}

export interface GuildBuff {
    id: string;
    name: string;
    stats: Partial<CharacterStats>;
    expiresAt: number;
}

export interface PlayerCharacter {
    id: number;
    user_id?: number; 
    username?: string;
    name: string;
    race: Race;
    characterClass?: CharacterClass;
    level: number;
    experience: number;
    experienceToNextLevel: number;
    
    stats: CharacterStats;
    resources: CharacterResources;
    
    inventory: ItemInstance[];
    equipment: Record<EquipmentSlot, ItemInstance | null>;
    
    currentLocationId: string;
    
    activeExpedition: {
        expeditionId: string;
        finishTime: number;
        enemies: Enemy[];
        combatLog: CombatLogEntry[];
        rewards: { gold: number, experience: number };
    } | null;
    
    activeTravel: {
        destinationLocationId: string;
        finishTime: number;
    } | null;

    activeTowerRun?: ActiveTowerRun | null;
    
    isResting: boolean;
    restStartHealth: number;
    lastRestTime?: number;
    lastEnergyUpdateTime?: number;
    
    camp: { level: number };
    treasury?: { level: number, gold: number };
    chest?: { level: number, gold: number };
    warehouse?: { level: number, items: ItemInstance[] };
    backpack?: { level: number };
    
    questProgress: PlayerQuestProgress[];
    acceptedQuests: string[];
    
    learnedSkills: string[];
    activeSkills: string[];
    
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;
    
    guild_id?: number;
    guildBarracksLevel?: number;
    guildShrineLevel?: number;
    activeGuildBuffs?: GuildBuff[];
    
    traderData?: TraderData;
    
    description?: string;
    avatarUrl?: string;
    settings?: {
        language: Language;
        sidebarOrder?: Tab[];
        windowBackgroundUrl?: string;
    };
    windowBackgroundUrl?: string;
    
    email?: string;
    freeStatResetUsed?: boolean;
}

export interface PlayerQuestProgress {
    questId: string;
    progress: number;
    completions: number;
}

export interface TraderInventoryData {
    regularItems: ItemInstance[];
    specialOfferItems: ItemInstance[];
}

export interface TraderData extends TraderInventoryData {
    lastRefresh: number;
}

export interface Location {
    id: string;
    name: string;
    description: string;
    travelTime: number;
    travelCost: number;
    travelEnergyCost: number;
    availableTabs: Tab[];
    isStartLocation?: boolean;
    image?: string;
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
    
    stats: EnemyStats;
    rewards: {
        minGold: number;
        maxGold: number;
        minExperience: number;
        maxExperience: number;
    };
    
    lootTable: LootDrop[];
    resourceLootTable: ResourceDrop[];
    
    isBoss?: boolean;
    isGuildBoss?: boolean;
    preparationTimeSeconds?: number;
    specialAttacks?: BossSpecialAttack[];
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
    locationIds: string[];
    duration: number;
    goldCost: number;
    energyCost: number;
    
    minBaseGoldReward: number;
    maxBaseGoldReward: number;
    minBaseExperienceReward: number;
    maxBaseExperienceReward: number;
    
    enemies: ExpeditionEnemy[];
    maxEnemies?: number;
    maxItems?: number;
    
    lootTable: LootDrop[];
    resourceLootTable: ResourceDrop[];
}

export interface ItemReward {
    templateId: string;
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
    locationIds: string[];
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
        resourceRewards?: ResourceReward[];
        lootTable?: LootDrop[];
    };
}

export interface SkillRequirements extends Partial<CharacterStats> {
    level?: number;
}

export interface SkillCost {
    gold?: number;
    [EssenceType.Common]?: number;
    [EssenceType.Uncommon]?: number;
    [EssenceType.Rare]?: number;
    [EssenceType.Epic]?: number;
    [EssenceType.Legendary]?: number;
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

export interface Ritual {
    id: string;
    name: string;
    description: string;
    tier: number;
    durationMinutes: number;
    cost: { type: EssenceType | 'gold', amount: number }[];
    stats: Partial<CharacterStats & { expBonus?: number }>;
}

export interface TraderSettings {
    rarityChances: {
        [ItemRarity.Common]: number;
        [ItemRarity.Uncommon]: number;
        [ItemRarity.Rare]: number;
    };
}

export interface GameSettings {
    language: Language;
    sidebarOrder?: Tab[];
    newsContent?: string;
    newsLastUpdatedAt?: number;
    
    logoUrl?: string;
    windowBackgroundUrl?: string;
    sidebarBackgroundUrl?: string;
    reportBackgroundUrl?: string;
    loginBackground?: string;
    gameBackground?: string;
    
    titleScreen?: {
        description: string;
        images: string[];
    };

    traderSettings?: TraderSettings;
    pvpProtectionMinutes?: number;
}

export interface GameData {
    locations: Location[];
    expeditions: Expedition[];
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    quests: Quest[];
    skills: Skill[];
    rituals: Ritual[];
    towers: Tower[];
    settings?: GameSettings;
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
    manaSpent?: number;
    magicAttackType?: MagicAttackType;
    weaponName?: string;
    isDodge?: boolean;
    effectApplied?: string;
    specialAttackType?: SpecialAttackType;
    shout?: SpecialAttackType;
    aoeDamage?: { target: string, damage: number }[];
    stunnedPlayer?: string;
    bonusDamage?: number;
    
    playerHealth: number;
    playerMana: number;
    enemyHealth: number;
    enemyMana: number;

    playerStats?: CharacterStats;
    enemyStats?: EnemyStats;
    enemyDescription?: string;
    
    allPlayersHealth?: { name: string, currentHealth: number, maxHealth: number, currentMana?: number, maxMana?: number }[];
    allEnemiesHealth?: { uniqueId: string, name: string, currentHealth: number, maxHealth: number }[];
    
    partyMemberStats?: Record<string, CharacterStats>;
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
    
    huntingMembers?: PartyMember[];
    allRewards?: Record<string, any>;
    bossId?: string;
    
    encounteredEnemies?: Enemy[];
}

export interface PvpRewardSummary {
    gold: number;
    experience: number;
    combatLog: CombatLogEntry[];
    isVictory: boolean;
    attacker: PlayerCharacter;
    defender: PlayerCharacter;
}

export interface Message {
    id: number;
    recipient_id: number;
    sender_id?: number;
    sender_name: string;
    message_type: MessageType;
    subject: string;
    body: string | any;
    is_read: boolean;
    is_saved: boolean;
    created_at: string;
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
    seller_name?: string;
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
    bid_count?: number;
}

export interface MarketNotificationBody {
    type: 'SOLD' | 'BOUGHT' | 'WON' | 'OUTBID' | 'EXPIRED' | 'ITEM_RETURNED';
    itemName: string;
    price?: number;
    currency?: CurrencyType;
    listingId?: number;
    item?: ItemInstance;
}

export interface GuildInviteBody {
    guildId: number;
    guildName: string;
}

export interface PlayerMessageBody {
    content: string;
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
    
    buildings: {
        headquarters: number;
        armory: number;
        barracks: number;
        scoutHouse: number;
        shrine: number;
        altar: number;
    };
    
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
    characterClass: CharacterClass;
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
    combatLog?: CombatLogEntry[] | string;
    loot?: { gold: number, essences: Record<string, number> };
    
    attackerGuildName: string;
    defenderGuildName: string;
}

export interface RaidParticipant {
    userId: number;
    name: string;
    level: number;
    race: Race;
    characterClass: CharacterClass;
}

export interface HuntingParty {
    id: number;
    leaderId: number;
    leaderName?: string;
    bossId: string;
    maxMembers: number;
    status: PartyStatus;
    startTime: string | null;
    createdAt: string;
    members: PartyMember[];
    currentMembersCount?: number;
    
    guildId?: number;
    
    combatLog?: CombatLogEntry[];
    victory?: boolean;
    allRewards?: any;
    myRewards?: any;
    
    messageId?: number;
}

export interface PartyMember {
    userId: number;
    characterName: string;
    level: number;
    race: Race;
    characterClass: CharacterClass;
    status: PartyMemberStatus;
    stats?: CharacterStats;
}

export interface AdminCharacterInfo {
    user_id: number;
    username: string;
    name: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
    gold: number;
}

export interface GlobalStats {
    totalPlayers: number;
    totalGoldInEconomy: number;
    raceCounts: Record<string, number>;
    classCounts: Record<string, number>;
    topItems: { id: string, count: number }[];
    topAffixes: { id: string, count: number }[];
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

export interface RankingPlayer {
    id: number;
    name: string;
    race: Race;
    characterClass: CharacterClass;
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

export interface PublicCharacterProfile {
    name: string;
    race: Race;
    characterClass: CharacterClass;
    level: number;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    description: string;
    avatarUrl: string;
    guildName?: string;
    guildTag?: string;
    isOnline: boolean;
}

export interface PublicGuildProfile {
    name: string;
    tag: string;
    description: string;
    crestUrl: string;
    memberCount: number;
    maxMembers: number;
    totalLevel: number;
    leaderName: string;
    createdAt: string;
    isPublic: boolean;
    minLevel: number;
}

export interface TowerFloor {
    floorNumber: number;
    enemies: ExpeditionEnemy[]; 
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
