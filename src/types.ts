

export enum Tab {
  Statistics,
  Equipment,
  Expedition,
  Camp,
  Location,
  Resources,
  Ranking,
  Admin,
  Trader,
  Blacksmith,
  Messages,
  Quests,
  Tavern,
  Market,
  Options,
  University,
  Hunting,
  Guild,
  Tower, // New
}

export enum Race {
  Human = 'Human',
  Elf = 'Elf',
  Orc = 'Orc',
  Gnome = 'Gnome',
  Dwarf = 'Dwarf',
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

export enum Language {
    PL = 'pl',
    EN = 'en',
}

export enum GrammaticalGender {
    Masculine = 'Masculine',
    Feminine = 'Feminine',
    Neuter = 'Neuter',
}

export interface User {
    id: number;
    username: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  travelTime: number; // in seconds
  travelCost: number; // in gold
  travelEnergyCost: number; // in energy
  availableTabs: Tab[];
  isStartLocation: boolean;
  image?: string;
}

export interface EnemyStats {
  maxHealth: number;
  minDamage: number;
  maxDamage: number;
  armor: number;
  critChance: number;
  critDamageModifier?: number;
  agility: number;
  dodgeChance?: number;
  armorPenetrationPercent?: number;
  armorPenetrationFlat?: number;
  // New magic properties for enemies
  maxMana?: number;
  manaRegen?: number;
  magicDamageMin?: number;
  magicDamageMax?: number;
  magicAttackChance?: number; // Percentage chance to use magic attack if mana is sufficient
  magicAttackType?: MagicAttackType;
  magicAttackManaCost?: number;
  attacksPerTurn?: number;
}

export interface EnemyRewards {
  minGold: number;
  maxGold: number;
  minExperience: number;
  maxExperience: number;
}

export interface LootDrop {
    templateId: string;
    chance: number; // Percentage
}

export enum EssenceType {
    Common = 'commonEssence',
    Uncommon = 'uncommonEssence',
    Rare = 'rareEssence',
    Epic = 'epicEssence',
    Legendary = 'legendaryEssence',
}

export interface ResourceDrop {
    resource: EssenceType;
    min: number;
    max: number;
    chance: number; // Percentage
}

// --- Boss Special Attacks ---
export enum SpecialAttackType {
    Stun = 'Stun',
    ArmorPierce = 'ArmorPierce',
    DeathTouch = 'DeathTouch',
    EmpoweredStrikes = 'EmpoweredStrikes',
    Earthquake = 'Earthquake'
}

export interface BossSpecialAttack {
    type: SpecialAttackType;
    chance: number; // Percentage
    uses: number; // Max uses per combat
}
// --------------------------

export interface Enemy {
  id: string; // Template ID
  uniqueId?: string; // Runtime instance ID for expeditions
  name: string;
  description: string;
  stats: EnemyStats;
  rewards: EnemyRewards;
  lootTable: LootDrop[];
  resourceLootTable?: ResourceDrop[];
  isBoss?: boolean;
  isGuildBoss?: boolean; // New property
  image?: string; // Boss portrait
  specialAttacks?: BossSpecialAttack[];
  preparationTimeSeconds?: number;
}

export interface ExpeditionEnemy {
  enemyId: string;
  spawnChance: number; // Percentage
}

export interface Expedition {
  id:string;
  name: string;
  description: string;
  duration: number; // in seconds
  goldCost: number;
  energyCost: number;
  minBaseGoldReward: number;
  maxBaseGoldReward: number;
  minBaseExperienceReward: number;
  maxBaseExperienceReward: number;
  locationIds: string[];
  enemies: ExpeditionEnemy[];
  maxEnemies?: number;
  maxItems?: number;
  lootTable: LootDrop[];
  resourceLootTable?: ResourceDrop[];
  image?: string;
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

export interface CombatLogEntry {
  turn: number;
  attacker: string;
  defender: string;
  action: string;
  damage?: number;
  bonusDamage?: number;
  manaSpent?: number;
  manaGained?: number;
  healthGained?: number;
  playerHealth: number;
  playerMana: number;
  enemyHealth: number;
  enemyMana: number;
  isCrit?: boolean;
  isDodge?: boolean;
  damageReduced?: number;
  magicAttackType?: MagicAttackType;
  playerStats?: CharacterStats;
  enemyStats?: EnemyStats;
  enemyDescription?: string;
  weaponName?: string;
  specialAttackType?: SpecialAttackType;
  stunnedPlayer?: string;
  affectedPlayers?: string[];
  defenderUniqueId?: string;
  allEnemiesHealth?: { uniqueId: string, name: string, currentHealth: number, maxHealth: number }[];
  allPlayersHealth?: { name: string, currentHealth: number, maxHealth: number, currentMana?: number, maxMana?: number }[];
  effectApplied?: string; // e.g., 'burning', 'frozen'
  aoeDamage?: { target: string, damage: number }[];
  chainTargets?: string[];
  partyMemberStats?: Record<string, CharacterStats>;
  shout?: string; // New field for boss dialogue
}

export interface ActiveExpedition {
    expeditionId: string;
    finishTime: number; // timestamp
    enemies: Enemy[]; // Specific enemies encountered
    combatLog: CombatLogEntry[];
    rewards: {
      gold: number;
      experience: number;
    }
}

export interface RewardSource {
  source: string;
  gold: number;
  experience: number;
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
  // For Hunting Reports
  huntingMembers?: PartyMember[];
  allRewards?: Record<string, { gold: number; experience: number }>;
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


export interface CharacterStats {
  // Base Attributes
  strength: number;
  agility: number;
  accuracy: number;
  stamina: number;
  intelligence: number;
  energy: number;
  luck: number;

  // Distributable points
  statPoints: number;

  // Derived Stats
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
  critChance: number;
  critDamageModifier: number;
  armor: number;
  armorPenetrationPercent: number;
  armorPenetrationFlat: number;
  attacksPerRound: number;
  manaRegen: number;
  lifeStealPercent: number;
  lifeStealFlat: number;
  manaStealPercent: number;
  manaStealFlat: number;
  dodgeChance: number;
}

export interface CharacterResources {
  gold: number;
  commonEssence: number;
  uncommonEssence: number;
  rareEssence: number;
  epicEssence: number;
  legendaryEssence: number;
}

export interface CharacterCamp {
    level: number;
}

export interface CharacterChest {
    level: number;
    gold: number;
}

export interface CharacterTreasury {
    level: number;
    gold: number;
}

export interface CharacterWarehouse {
    level: number;
    items: ItemInstance[];
}

export interface CharacterBackpack {
    level: number;
}

export interface ActiveTravel {
  destinationLocationId: string;
  finishTime: number; // timestamp
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
}

export interface ItemTemplate {
    id: string;
    name: string;
    gender: GrammaticalGender;
    description: string;
    slot: EquipmentSlot | 'consumable' | 'ring';
    category: ItemCategory; // New property
    rarity: ItemRarity;
    icon: string; // Placeholder for image path or ID
    value: number; // Gold value
    requiredLevel: number;
    requiredStats?: Partial<Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>>;
    // Bonuses with min-max ranges
    statsBonus?: Partial<{ [key in keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy' | 'luck'>]: { min: number; max: number } }>;
    damageMin?: { min: number; max: number; };
    damageMax?: { min: number; max: number; };
    attacksPerRound?: number;
    armorBonus?: { min: number; max: number; };
    critChanceBonus?: { min: number; max: number; };
    maxHealthBonus?: { min: number; max: number; };
    critDamageModifierBonus?: { min: number; max: number; };
    armorPenetrationPercent?: { min: number; max: number; };
    armorPenetrationFlat?: { min: number; max: number; };
    lifeStealPercent?: { min: number; max: number; };
    lifeStealFlat?: { min: number; max: number; };
    manaStealPercent?: { min: number; max: number; };
    manaStealFlat?: { min: number; max: number; };
    // Magic properties
    isMagical?: boolean;
    isRanged?: boolean;
    magicAttackType?: MagicAttackType;
    manaCost?: { min: number; max: number; };
    magicDamageMin?: { min: number; max: number; };
    magicDamageMax?: { min: number; max: number; };
}

export interface RolledAffixStats {
    statsBonus?: Partial<Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy' | 'luck'>>;
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
    upgradeLevel?: number;
    prefixId?: string;
    suffixId?: string;
    rolledPrefix?: RolledAffixStats;
    rolledSuffix?: RolledAffixStats;
    rolledBaseStats?: RolledAffixStats;
    // Guild Armory fields
    isBorrowed?: boolean;
    borrowedFromGuildId?: number;
    originalOwnerId?: number;
    originalOwnerName?: string; // Optional for UI display
    borrowedAt?: number; // Timestamp
}

export enum AffixType {
    Prefix = 'Prefix',
    Suffix = 'Suffix',
}

export interface Affix {
    id: string;
    name: {
        masculine: string;
        feminine: string;
        neuter: string;
    };
    type: AffixType;
    value?: number;
    requiredLevel?: number;
    requiredStats?: Partial<Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>>;
    
    statsBonus?: Partial<{ [key in keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy' | 'luck'>]: { min: number; max: number } }>;
    damageMin?: { min: number; max: number; };
    damageMax?: { min: number; max: number; };
    attacksPerRoundBonus?: { min: number; max: number; };
    dodgeChanceBonus?: { min: number; max: number; };
    armorBonus?: { min: number; max: number; };
    critChanceBonus?: { min: number; max: number; };
    maxHealthBonus?: { min: number; max: number; };
    critDamageModifierBonus?: { min: number; max: number; };
    armorPenetrationPercent?: { min: number; max: number; };
    armorPenetrationFlat?: { min: number; max: number; };
    lifeStealPercent?: { min: number; max: number; };
    lifeStealFlat?: { min: number; max: number; };
    manaStealPercent?: { min: number; max: number; };
    manaStealFlat?: { min: number; max: number; };
    magicDamageMin?: { min: number; max: number; };
    magicDamageMax?: { min: number; max: number; };

    spawnChances: {
      [key in ItemCategory]?: number;
    };
}


// --- Quest System Types ---
export enum QuestType {
    Kill = 'Kill',
    Gather = 'Gather', // Gather Items
    GatherResource = 'GatherResource', // Gather Essences/Resources
    PayGold = 'PayGold',
}

export interface QuestObjective {
    type: QuestType;
    targetId?: string; // enemyId for Kill, templateId for Gather, EssenceType for GatherResource
    amount: number;
}

export interface ItemReward {
    templateId: string;
    quantity: number;
}

export interface ResourceReward {
    resource: EssenceType;
    quantity: number;
}

export interface QuestRewards {
    gold: number;
    experience: number;
    itemRewards?: ItemReward[];
    resourceRewards?: ResourceReward[];
    lootTable?: LootDrop[];
}

export interface Quest {
    id: string;
    name: string;
    description: string;
    locationIds: string[];
    objective: QuestObjective;
    rewards: QuestRewards;
    repeatable: number; // 1 for one-time, >1 for specific count, 0 for infinite
}

export interface PlayerQuestProgress {
    questId: string;
    progress: number; // e.g., number of enemies killed
    completions: number;
}
// --- End Quest System Types ---

// --- University / Skill System Types ---
export enum SkillType {
    Universal = 'Universal',
    Racial = 'Racial',
}

export enum SkillCategory {
    Passive = 'Passive',
    Active = 'Active',
}

export type SkillCost = Partial<CharacterResources>;

export type SkillRequirements = Partial<Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>> & {
    level?: number;
};

export interface Skill {
    id: string;
    name: string;
    description: string;
    type: SkillType;
    category: SkillCategory;
    cost: SkillCost;
    requirements: SkillRequirements;
    manaMaintenanceCost?: number; // Amount of Max Mana reduced while active
}
// --- End University / Skill System Types ---

// --- Hunting System Types ---
export enum PartyStatus {
    Forming = 'FORMING',
    Preparing = 'PREPARING', // Countdown
    Fighting = 'FIGHTING', // Logic processing
    Finished = 'FINISHED'
}

export enum PartyMemberStatus {
    Leader = 'LEADER',
    Member = 'MEMBER',
    Pending = 'PENDING'
}

export interface PartyMember {
    userId: number;
    characterName: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
    status: PartyMemberStatus;
    stats?: CharacterStats; // Only for UI during combat
}

export interface HuntingParty {
    id: number;
    leaderId: number;
    bossId: string;
    maxMembers: number;
    status: PartyStatus;
    startTime?: string; // ISO date
    createdAt: string;
    members: PartyMember[];
    combatLog?: CombatLogEntry[]; // Populated only when finished
    victory?: boolean;
    myRewards?: { // Only visible to specific user in response
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
    };
    allRewards?: Record<string, { gold: number; experience: number; items?: ItemInstance[]; essences?: Partial<Record<EssenceType, number>> }>; // Map player name -> rewards
    messageId?: number; // ID of the message containing the report for the current user
    guildId?: number; // Added for Guild Hunts
}
// --- End Hunting System Types ---

// --- Guild System Types ---
export enum GuildRole {
    LEADER = 'LEADER',
    OFFICER = 'OFFICER',
    MEMBER = 'MEMBER',
    RECRUIT = 'RECRUIT',
}

export interface GuildMember {
    userId: number;
    name: string;
    level: number;
    race: Race;
    characterClass?: CharacterClass;
    role: GuildRole;
    joinedAt: string;
    isOnline?: boolean;
}

export interface GuildTransaction {
    id: number;
    userId: number;
    characterName: string;
    type: 'DEPOSIT' | 'WITHDRAW' | 'RENTAL' | 'TAX' | 'LOOT';
    currency: 'gold' | EssenceType;
    amount: number;
    timestamp: string;
}

export interface GuildResources {
    gold: number;
    commonEssence: number;
    uncommonEssence: number;
    rareEssence: number;
    epicEssence: number;
    legendaryEssence: number;
}

export interface GuildArmoryItem {
    id: number;
    item: ItemInstance;
    ownerId: number;
    ownerName: string;
    depositedAt: string;
    borrowedBy?: string; // For UI logic mostly, backend handles actual borrowing via character inventory
    userId?: number; // ID of the player holding the item (if borrowed)
}

export interface GuildBuff {
    id: string;
    name: string;
    stats: Partial<CharacterStats> & { expBonus?: number }; // Extended to allow explicit expBonus typing
    expiresAt: number; // Timestamp
}

export interface Ritual {
    id: string; // Used string for flexibility (UUIDs)
    name: string;
    description: string;
    tier: number; // Wtajemniczenie (1-5)
    durationMinutes: number;
    cost: { type: EssenceType | 'gold', amount: number }[];
    stats: Partial<CharacterStats> & { expBonus?: number };
}

export interface Guild {
    id: number;
    name: string;
    tag: string;
    leaderId: number;
    description: string;
    crestUrl?: string; // Extended property
    resources: GuildResources;
    memberCount: number;
    maxMembers: number;
    createdAt: string;
    isPublic: boolean;
    minLevel: number;
    rentalTax?: number; // 0-100 percentage
    huntingTax?: number; // 0-100 percentage
    buildings?: Record<string, number>; // Map building type to level
    activeBuffs?: GuildBuff[]; // New property for active buffs
    // Extended properties
    members?: GuildMember[];
    transactions?: GuildTransaction[];
    chatHistory?: GuildChatMessage[];
    armoryItems?: GuildArmoryItem[]; // Items physically in the armory
    borrowedItems?: GuildArmoryItem[]; // Items borrowed by others (visible to leadership/owners)
    myRole?: GuildRole;
}

export interface GuildChatMessage {
    id: string; // UUID or simple generated ID
    userId: number;
    characterName: string;
    role: GuildRole;
    content: string;
    timestamp: string;
}

export interface GuildInviteBody {
    guildId: number;
    guildName: string;
}

export enum RaidStatus {
    PREPARING = 'PREPARING',
    FIGHTING = 'FIGHTING',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED'
}

export enum RaidType {
    RESOURCES = 'RESOURCES',
    SPARRING = 'SPARRING'
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
    attackerGuildName: string;
    defenderGuildName: string;
    status: RaidStatus;
    type: RaidType;
    startTime: string; // ISO string
    createdAt: string;
    attackerParticipants: RaidParticipant[];
    defenderParticipants: RaidParticipant[];
    winnerGuildId?: number;
    loot?: {
        gold: number;
        essences: Partial<Record<EssenceType, number>>;
    };
    combatLog?: CombatLogEntry[];
}
// --- End Guild System Types ---

// --- Tower System Types ---
export interface TowerFloor {
    floorNumber: number;
    enemies: ExpeditionEnemy[]; // Use existing spawnChance interface
    guaranteedReward?: {
        gold: number;
        experience: number;
    };
    lootTable?: LootDrop[];
    resourceLootTable?: ResourceDrop[];
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
        items?: ItemInstance[]; // Or templates to generate
        essences?: Partial<Record<EssenceType, number>>;
    };
    isActive: boolean;
}

export type TowerRunStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'RETREATED';

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
// --- End Tower System Types ---

export interface TraderInventoryData {
    regularItems: ItemInstance[];
    specialOfferItems: ItemInstance[];
}

export interface TraderData {
    regularItems: ItemInstance[];
    specialOfferItems: ItemInstance[];
    lastRefresh: number;
}

export interface PlayerCharacter {
  id?: number; // User ID
  username?: string;
  email?: string;
  name: string;
  race: Race;
  characterClass?: CharacterClass | null;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  stats: CharacterStats;
  resources: CharacterResources;
  currentLocationId: string;
  activeExpedition: ActiveExpedition | null;
  activeTravel: ActiveTravel | null;
  camp: CharacterCamp;
  treasury: CharacterTreasury;
  warehouse: CharacterWarehouse;
  chest?: CharacterChest; // Optional/Deprecated for compatibility
  backpack: CharacterBackpack;
  isResting: boolean;
  restStartHealth: number;
  lastRestTime?: number;
  lastEnergyUpdateTime: number;
  equipment: Record<EquipmentSlot, ItemInstance | null>;
  inventory: ItemInstance[];
  traderData?: TraderData; // Personal trader inventory
  pvpWins: number;
  pvpLosses: number;
  pvpProtectionUntil: number; // Timestamp
  questProgress: PlayerQuestProgress[];
  acceptedQuests: string[];
  traderPurchases?: string[];
  freeStatResetUsed?: boolean;
  lastReadNewsTimestamp?: number;
  settings?: {
    language?: Language;
  };
  learnedSkills?: string[];
  activeSkills?: string[]; // IDs of currently active (toggled) skills
  guildId?: number; // Added guildId
  guildBarracksLevel?: number;
  guildShrineLevel?: number; // Added guildShrineLevel
  activeGuildBuffs?: GuildBuff[]; // Transient property from backend
  description?: string;
  avatarUrl?: string;
  rentalTax?: number;
  windowBackgroundUrl?: string;
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
    traderSettings?: TraderSettings;
    pvpProtectionMinutes?: number;
    titleScreen?: {
        description: string;
        images: string[];
    };
    loginBackground?: string;
    gameBackground?: string;
    sidebarBackgroundUrl?: string;
    logoUrl?: string;
    windowBackgroundUrl?: string;
    reportBackgroundUrl?: string; // NEW
    newsContent?: string;
    newsLastUpdatedAt?: number;
    sidebarOrder?: Tab[];
}

export interface GameData {
    locations: Location[];
    expeditions: Expedition[];
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    quests: Quest[];
    affixes: Affix[];
    skills: Skill[];
    rituals?: Ritual[]; // Added rituals to GameData
    towers?: Tower[]; // Added towers
    settings: GameSettings;
}

export interface RankingPlayer {
    id: number; // User ID
    name: string;
    race: Race;
    characterClass?: CharacterClass | null;
    level: number;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;
    isOnline: boolean;
    guildTag?: string; // Added guildTag
}

export interface AdminCharacterInfo {
    user_id: number;
    username: string;
    name: string;
    race: Race;
    level: number;
    gold: number;
    characterClass?: CharacterClass; // Added characterClass
}

export type MessageType = 'pvp_report' | 'player_message' | 'expedition_report' | 'market_notification' | 'system' | 'guild_invite' | 'raid_report';

export interface PlayerMessageBody {
    content: string;
}

export interface MarketNotificationBody {
    type: 'SOLD' | 'BOUGHT' | 'EXPIRED' | 'OUTBID' | 'WON' | 'ITEM_RETURNED';
    itemName: string;
    price?: number;
    currency?: CurrencyType;
    item?: ItemInstance; // For when an item is sent via message
    listingId?: number;
}


export type MessageBody = PvpRewardSummary | PlayerMessageBody | ExpeditionRewardSummary | MarketNotificationBody | GuildInviteBody;

export interface Message {
    id: number;
    recipient_id: number;
    sender_id: number | null;
    sender_name: string | null;
    message_type: MessageType;
    subject: string;
    body: MessageBody;
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

// --- Market Types ---
export type CurrencyType = 'gold' | EssenceType;
export type ListingType = 'buy_now' | 'auction';
export type ListingStatus = 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'CANCELLED' | 'CLAIMED';

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
    status: ListingStatus;
    bid_count: number;
}

// --- Admin Types ---
export interface DuplicationInfo {
    ownerName: string;
    location: string; // e.g., 'inventory', 'equipment.mainHand', 'market'
    userId: number;
}

export interface DuplicationAuditResult {
    uniqueId: string;
    templateId: string;
    itemName: string;
    gender: GrammaticalGender;
    instances: DuplicationInfo[];
}

export interface OrphanInfo {
    uniqueId: string;
    templateId: string;
    location: string; // e.g., 'inventory', 'equipment.mainHand'
}

export interface OrphanAuditResult {
    characterName: string;
    userId: number;
    orphans: OrphanInfo[];
}

export interface ItemLocationInfo {
    ownerName: string;
    userId: number;
    location: string; // e.g., 'inventory', 'equipment.mainHand', 'market.123', 'mailbox.456'
}

export interface ItemSearchResult {
    item: ItemInstance;
    template: ItemTemplate;
    locations: ItemLocationInfo[];
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
    characterClass?: CharacterClass | null;
    level: number;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    guildName?: string;
    guildTag?: string;
    description?: string;
    avatarUrl?: string;
    isOnline?: boolean;
}

export interface PublicGuildProfile {
    name: string;
    tag: string;
    leaderName: string;
    description: string;
    crestUrl?: string; // Extended property
    memberCount: number;
    maxMembers: number;
    totalLevel: number;
    createdAt: string;
    isPublic: boolean;
    minLevel: number;
}

export interface GlobalStats {
    totalPlayers: number;
    totalGoldInEconomy: number;
    raceCounts: Record<string, number>;
    classCounts: Record<string, number>;
    topItems: { id: string, count: number }[];
    topAffixes: { id: string, count: number }[];
}
