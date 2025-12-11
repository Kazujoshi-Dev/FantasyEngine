
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
  travelTime: number; 
  travelCost: number; 
  travelEnergyCost: number; 
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
  maxMana?: number;
  manaRegen?: number;
  magicDamageMin?: number;
  magicDamageMax?: number;
  magicAttackChance?: number;
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
    chance: number; 
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
    chance: number;
}

export enum SpecialAttackType {
    Stun = 'Stun',
    ArmorPierce = 'ArmorPierce',
    DeathTouch = 'DeathTouch',
    EmpoweredStrikes = 'EmpoweredStrikes',
    Earthquake = 'Earthquake'
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
  stats: EnemyStats;
  rewards: EnemyRewards;
  lootTable: LootDrop[];
  resourceLootTable?: ResourceDrop[];
  isBoss?: boolean;
  isGuildBoss?: boolean;
  image?: string;
  specialAttacks?: BossSpecialAttack[];
  preparationTimeSeconds?: number;
}

export interface ExpeditionEnemy {
  enemyId: string;
  spawnChance: number;
}

export interface Expedition {
  id:string;
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
  effectApplied?: string;
  aoeDamage?: { target: string, damage: number }[];
  chainTargets?: string[];
  partyMemberStats?: Record<string, CharacterStats>;
  shout?: string;
}

export interface ActiveExpedition {
    expeditionId: string;
    finishTime: number;
    enemies: Enemy[];
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

// Deprecated
export interface CharacterChest {
    level: number;
    gold: number;
}

// New
export interface CharacterTreasury {
    level: number;
    gold: number;
}

// New
export interface CharacterWarehouse {
    level: number;
    items: ItemInstance[];
}

export interface CharacterBackpack {
    level: number;
}

export interface ActiveTravel {
  destinationLocationId: string;
  finishTime: number;
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
    category: ItemCategory;
    rarity: ItemRarity;
    icon: string;
    value: number;
    requiredLevel: number;
    requiredStats?: Partial<Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>>;
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
    isBorrowed?: boolean;
    borrowedFromGuildId?: number;
    originalOwnerId?: number;
    originalOwnerName?: string;
    borrowedAt?: number;
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

export enum QuestType {
    Kill = 'Kill',
    Gather = 'Gather',
    GatherResource = 'GatherResource',
    PayGold = 'PayGold',
}

export interface QuestObjective {
    type: QuestType;
    targetId?: string;
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
    repeatable: number;
}

export interface PlayerQuestProgress {
    questId: string;
    progress: number;
    completions: number;
}

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
    manaMaintenanceCost?: number;
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
    startTime?: string;
    createdAt: string;
    members: PartyMember[];
    combatLog?: CombatLogEntry[];
    victory?: boolean;
    myRewards?: {
        gold: number;
        experience: number;
        items: ItemInstance[];
        essences: Partial<Record<EssenceType, number>>;
    };
    allRewards?: Record<string, { gold: number; experience: number; items?: ItemInstance[]; essences?: Partial<Record<EssenceType, number>> }>;
    messageId?: number;
    guildId?: number;
}

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
    borrowedBy?: string;
    userId?: number;
}

export interface GuildBuff {
    id: string;
    name: string;
    stats: Partial<CharacterStats> & { expBonus?: number };
    expiresAt: number;
}

export interface Ritual {
    id: string;
    name: string;
    description: string;
    tier: number;
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
    crestUrl?: string;
    resources: GuildResources;
    memberCount: number;
    maxMembers: number;
    createdAt: string;
    isPublic: boolean;
    minLevel: number;
    rentalTax?: number;
    huntingTax?: number;
    buildings?: Record<string, number>;
    activeBuffs?: GuildBuff[];
    members?: GuildMember[];
    transactions?: GuildTransaction[];
    chatHistory?: GuildChatMessage[];
    armoryItems?: GuildArmoryItem[];
    borrowedItems?: GuildArmoryItem[];
    myRole?: GuildRole;
}

export interface GuildChatMessage {
    id: string;
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
    startTime: string;
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
  id?: number;
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
  treasury: CharacterTreasury; // New
  warehouse: CharacterWarehouse; // New
  chest?: CharacterChest; // Optional/Deprecated
  backpack: CharacterBackpack;
  isResting: boolean;
  restStartHealth: number;
  lastRestTime?: number;
  lastEnergyUpdateTime: number;
  equipment: Record<EquipmentSlot, ItemInstance | null>;
  inventory: ItemInstance[];
  traderData?: TraderData;
  pvpWins: number;
  pvpLosses: number;
  pvpProtectionUntil: number;
  questProgress: PlayerQuestProgress[];
  acceptedQuests: string[];
  traderPurchases?: string[];
  freeStatResetUsed?: boolean;
  lastReadNewsTimestamp?: number;
  settings?: {
    language?: Language;
  };
  learnedSkills?: string[];
  activeSkills?: string[];
  guildId?: number;
  guildBarracksLevel?: number;
  guildShrineLevel?: number;
  activeGuildBuffs?: GuildBuff[];
  description?: string;
  avatarUrl?: string;
  rentalTax?: number;
  windowBackgroundUrl?: string;
}

export interface TraderSettings {
    rarityChances: Partial<Record<ItemRarity, number>>;
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
    reportBackgroundUrl?: string;
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
    rituals?: Ritual[];
    settings: GameSettings;
}

export interface RankingPlayer {
    id: number;
    name: string;
    race: Race;
    characterClass?: CharacterClass | null;
    level: number;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;
    isOnline: boolean;
    guildTag?: string;
}

export interface AdminCharacterInfo {
    user_id: number;
    username: string;
    name: string;
    race: Race;
    level: number;
    gold: number;
    characterClass?: CharacterClass;
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
    item?: ItemInstance;
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

export interface DuplicationInfo {
    ownerName: string;
    location: string;
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
    location: string;
}

export interface OrphanAuditResult {
    characterName: string;
    userId: number;
    orphans: OrphanInfo[];
}

export interface ItemLocationInfo {
    ownerName: string;
    userId: number;
    location: string;
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
}

export interface PublicGuildProfile {
    name: string;
    tag: string;
    leaderName: string;
    description: string;
    crestUrl?: string;
    memberCount: number;
    maxMembers: number;
    totalLevel: number;
    createdAt: string;
    isPublic: boolean;
    minLevel: number;
}
