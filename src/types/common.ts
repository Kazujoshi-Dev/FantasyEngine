
export enum Language {
    PL = 'pl',
    EN = 'en'
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

// Resource related, but very common
export enum EssenceType {
    Common = 'commonEssence',
    Uncommon = 'uncommonEssence',
    Rare = 'rareEssence',
    Epic = 'epicEssence',
    Legendary = 'legendaryEssence'
}

export type CurrencyType = 'gold' | EssenceType;

export interface ResourceCost {
    type: EssenceType;
    amount: number;
}

export enum Race {
    Human = 'Human',
    Elf = 'Elf',
    Orc = 'Orc',
    Gnome = 'Gnome',
    Dwarf = 'Dwarf'
}

export enum Gender {
    Male = 'Male',
    Female = 'Female'
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
