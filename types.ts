

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
}

export enum Race {
  Human = 'Human',
  Elf = 'Elf',
  Orc = 'Orc',
  Gnome = 'Gnome',
  Dwarf = 'Dwarf',
}

export enum Language {
    EN = 'en',
    PL = 'pl',
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
}

export interface EnemyStats {
  maxHealth: number;
  minDamage: number;
  maxDamage: number;
  armor: number;
  critChance: number;
  agility: number;
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

export interface Enemy {
  id: string; // Template ID
  uniqueId?: string; // Runtime instance ID for expeditions
  name: string;
  description: string;
  stats: EnemyStats;
  rewards: EnemyRewards;
  lootTable: LootDrop[];
  resourceLootTable?: ResourceDrop[];
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
  lootTable: LootDrop[];
  resourceLootTable?: ResourceDrop[];
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

export interface ItemTemplate {
    id: string;
    name: string;
    description: string;
    slot: EquipmentSlot | 'consumable' | 'ring';
    rarity: ItemRarity;
    icon: string; // Placeholder for image path or ID
    value: number; // Gold value
    requiredLevel: number;
    // Bonuses
    statsBonus: Partial<Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>>;
    damageMin?: number;
    damageMax?: number;
    attacksPerRound?: number;
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
    // Magic properties
    isMagical?: boolean;
    magicAttackType?: MagicAttackType;
    manaCost?: number;
    magicDamageMin?: number;
    magicDamageMax?: number;
}

export interface ItemInstance {
    uniqueId: string; // Unique identifier for this specific instance of an item
    templateId: string; // ID of the ItemTemplate it's based on
    upgradeLevel?: number;
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


export interface PlayerCharacter {
  id?: number; // User ID
  username?: string;
  name: string;
  race: Race;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  stats: CharacterStats;
  resources: CharacterResources;
  currentLocationId: string;
  activeExpedition: ActiveExpedition | null;
  activeTravel: ActiveTravel | null;
  camp: CharacterCamp;
  isResting: boolean;
  restStartHealth: number;
  lastEnergyUpdateTime: number;
  equipment: Record<EquipmentSlot, ItemInstance | null>;
  inventory: ItemInstance[];
  pvpWins: number;
  pvpLosses: number;
  pvpProtectionUntil: number; // Timestamp
  questProgress: PlayerQuestProgress[];
  acceptedQuests: string[];
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
}

export interface GameData {
    locations: Location[];
    expeditions: Expedition[];
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    quests: Quest[];
    settings: GameSettings;
}

export interface RankingPlayer {
    id: number; // User ID
    name: string;
    race: Race;
    level: number;
    experience: number;
    pvpWins: number;
    pvpLosses: number;
    pvpProtectionUntil: number;
}

export interface AdminCharacterInfo {
    user_id: number;
    username: string;
    name: string;
    race: Race;
    level: number;
}

export type MessageType = 'pvp_report' | 'player_message';

export interface PlayerMessageBody {
    content: string;
}

export type MessageBody = PvpRewardSummary | PlayerMessageBody;

export interface Message {
    id: number;
    recipient_id: number;
    sender_id: number | null;
    sender_name: string | null;
    message_type: MessageType;
    subject: string;
    body: MessageBody;
    is_read: boolean;
    created_at: string;
}

export interface TavernMessage {
  id: number;
  user_id: number;
  character_name: string;
  content: string;
  created_at: string;
}