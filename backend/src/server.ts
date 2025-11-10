// FIX: Import Request, Response, and NextFunction from express and apply them to all route handlers and middleware to resolve widespread type errors.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
// Import Buffer to resolve 'Cannot find name Buffer' error.
import { randomUUID, randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { Buffer } from 'buffer';
import path from 'path';
// Import fileURLToPath to create a __dirname equivalent in ES modules.
import { fileURLToPath } from 'url';
// FIX: Import `exit` from `process` to resolve `Property 'exit' does not exist on type 'Process'` error. This ensures the correct Node.js API is used, especially in environments with conflicting global types.
import { exit } from 'process';
import { PlayerCharacter, ItemTemplate, EquipmentSlot, CharacterStats, Race, MagicAttackType, CombatLogEntry, PvpRewardSummary, Enemy, GameSettings, ItemRarity, ItemInstance, Expedition, ExpeditionRewardSummary, RewardSource, LootDrop, ResourceDrop, EssenceType, EnemyStats, Quest, QuestType, PlayerQuestProgress, Affix, RolledAffixStats, AffixType, MarketListing, ListingType, CurrencyType, MarketNotificationBody, DuplicationAuditResult, DuplicationInfo, GrammaticalGender, CharacterClass } from './types.js';


dotenv.config();

// Add __dirname shim for ES modules to resolve 'Cannot find name __dirname' error.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use declaration merging to augment the global Express Request type.
// This is the standard way to add properties to the request object in TypeScript.
declare global {
  namespace Express {
    interface Request {
      user?: { id: number };
    }
  }
}

// FIX: Correctly instantiated the express app. `express()` is the correct way, and `express.default()` does not exist.
// FIX: Explicitly type app as Express instance.
const app: express.Express = express();
const PORT = process.env.PORT || 3001;

const connectionString = process.env.DATABASE_URL;
const poolConfig: PoolConfig = {
  connectionString: connectionString,
};

// Conditionally add SSL configuration only if the connection string exists
// and does not already contain an sslmode parameter. This prevents conflicts
// with connection strings that already specify SSL requirements.
if (connectionString && !/sslmode/i.test(connectionString)) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

// --- Server-side Trader Inventory Cache ---
let traderInventoryCache = {
    inventory: [] as ItemInstance[],
    lastRefreshedHour: -1,
};

// --- Item Generation with Affixes ---
const rollAffixStats = (affix: Affix): RolledAffixStats => {
    const rolled: RolledAffixStats = {};

    const rollValue = (minMax: { min: number; max: number } | undefined): number | undefined => {
        if (minMax === undefined || minMax === null) return undefined;
        const min = Math.min(minMax.min, minMax.max);
        const max = Math.max(minMax.min, minMax.max);
        if (min === max) return min;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    if (affix.statsBonus) {
        rolled.statsBonus = {};
        for (const key in affix.statsBonus) {
            const statKey = key as keyof typeof affix.statsBonus;
            const rolledStat = rollValue(affix.statsBonus[statKey]);
            if (rolledStat !== undefined) {
                (rolled.statsBonus as any)[statKey] = rolledStat;
            }
        }
        if(Object.keys(rolled.statsBonus).length === 0) {
            delete rolled.statsBonus;
        }
    }
    
    const otherStatKeys: (keyof Omit<Affix, 'id'|'name'|'type'|'requiredLevel'|'requiredStats'|'spawnChances'|'statsBonus'|'value'>)[] = [
        'damageMin', 'damageMax', 'attacksPerRoundBonus', 'dodgeChanceBonus', 'armorBonus',
        'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent',
        'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent',
        'manaStealFlat', 'magicDamageMin', 'magicDamageMax'
    ];
    
    for (const key of otherStatKeys) {
        const value = rollValue((affix as any)[key]);
        if (value !== undefined) {
            (rolled as any)[key] = value;
        }
    }

    return rolled;
};

const getGrammaticallyCorrectFullName = (item: ItemInstance, template: ItemTemplate, affixes: Affix[]): string => {
    const prefixAffix = affixes.find(a => a.id === item.prefixId);
    const suffixAffix = affixes.find(a => a.id === item.suffixId);
    
    let genderKey: keyof Affix['name'] = 'masculine';
    if (template.gender === GrammaticalGender.Feminine) {
        genderKey = 'feminine';
    } else if (template.gender === GrammaticalGender.Neuter) {
        genderKey = 'neuter';
    }
    
    // Handle old affix data that might still be a string for backward compatibility
    const prefixName = (prefixAffix && typeof prefixAffix.name === 'object') ? prefixAffix.name[genderKey] : (prefixAffix?.name as unknown as string);
    const suffixName = (suffixAffix && typeof suffixAffix.name === 'object') ? suffixAffix.name[genderKey] : (suffixAffix?.name as unknown as string);

    return [prefixName, template.name, suffixName].filter(Boolean).join(' ');
}

const createItemInstance = (templateId: string, allItemTemplates: ItemTemplate[], allAffixes: Affix[], allowAffixes = true): ItemInstance => {
    const template = allItemTemplates.find(t => t.id === templateId);
    if (!template) {
        return { uniqueId: randomUUID(), templateId };
    }

    const instance: ItemInstance = {
        uniqueId: randomUUID(),
        templateId,
    };

    if (allowAffixes) {
        const itemCategory = template.category;
    
        const possiblePrefixes = allAffixes.filter(a => a.type === AffixType.Prefix && a.spawnChances[itemCategory]);
        const possibleSuffixes = allAffixes.filter(a => a.type === AffixType.Suffix && a.spawnChances[itemCategory]);
    
        if (possiblePrefixes.length > 0) {
            for (const prefix of possiblePrefixes) {
                const chance = prefix.spawnChances[itemCategory] || 0;
                if (Math.random() * 100 < chance) {
                    instance.prefixId = prefix.id;
                    instance.rolledPrefix = rollAffixStats(prefix);
                    break; 
                }
            }
        }
    
        if (possibleSuffixes.length > 0) {
             for (const suffix of possibleSuffixes) {
                const chance = suffix.spawnChances[itemCategory] || 0;
                if (Math.random() * 100 < chance) {
                    instance.suffixId = suffix.id;
                    instance.rolledSuffix = rollAffixStats(suffix);
                    break;
                }
            }
        }
    }

    return instance;
};

const generateTraderInventory = (itemTemplates: ItemTemplate[], affixes: Affix[], settings: GameSettings): ItemInstance[] => {
    const INVENTORY_SIZE = 12;
    const inventory: ItemInstance[] = [];
    
    const defaultChances = {
        [ItemRarity.Common]: 60,
        [ItemRarity.Uncommon]: 30,
        [ItemRarity.Rare]: 10,
    };
    
    const chances = settings.traderSettings?.rarityChances || defaultChances;
    
    const eligibleTemplates = itemTemplates.filter(t => 
        t.rarity === ItemRarity.Common ||
        t.rarity === ItemRarity.Uncommon ||
        t.rarity === ItemRarity.Rare
    );

    if (eligibleTemplates.length === 0) return [];
    
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const rand = Math.random() * 100;
        let selectedRarity: ItemRarity;

        if (rand < (chances[ItemRarity.Common] || 0)) {
            selectedRarity = ItemRarity.Common;
        } else if (rand < (chances[ItemRarity.Common] || 0) + (chances[ItemRarity.Uncommon] || 0)) {
            selectedRarity = ItemRarity.Uncommon;
        } else {
            selectedRarity = ItemRarity.Rare;
        }
        
        const templatesOfRarity = eligibleTemplates.filter(t => t.rarity === selectedRarity);

        if (templatesOfRarity.length > 0) {
            const template = templatesOfRarity[Math.floor(Math.random() * templatesOfRarity.length)];
            inventory.push(createItemInstance(template.id, itemTemplates, affixes, false));
        }
    }
    
    return inventory;
};

// Helper function to initialize the database schema
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Characters table - create with minimal columns to avoid errors on existing dbs
        await client.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id SERIAL PRIMARY KEY,
                data JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        // --- Schema Migration: Ensure 'characters.id' column is a proper SERIAL ---
        const idColumnDefault = await client.query(`
            SELECT column_default
            FROM information_schema.columns
            WHERE table_name = 'characters' AND column_name = 'id';
        `);

        // If the table exists but the 'id' column doesn't have a default, it was likely created as 'INT' instead of 'SERIAL'.
        if (idColumnDefault && idColumnDefault.rowCount != null && idColumnDefault.rowCount > 0 && idColumnDefault.rows[0].column_default === null) {
            console.log("MIGRATING SCHEMA: 'characters.id' column is missing a default value. Attempting to fix auto-increment.");
            await client.query(`CREATE SEQUENCE IF NOT EXISTS characters_id_seq;`);
            // Set the sequence to the next available value, preventing conflicts if data already exists.
            await client.query(`SELECT setval('characters_id_seq', COALESCE((SELECT MAX(id) + 1 FROM characters), 1), false);`);
            await client.query(`ALTER TABLE characters ALTER COLUMN id SET DEFAULT nextval('characters_id_seq'::regclass);`);
            await client.query(`ALTER SEQUENCE characters_id_seq OWNED BY characters.id;`);
            console.log("MIGRATION COMPLETE: 'characters.id' column should now auto-increment.");
        }

        // --- Schema Migration: Ensure 'user_id' column exists in 'characters' table ---
        const hasUserIdColumn = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='characters' AND column_name='user_id';
        `);

        if (!hasUserIdColumn.rowCount) {
            console.log("MIGRATING SCHEMA: Adding 'user_id' column and constraints to 'characters' table...");
            await client.query('ALTER TABLE characters ADD COLUMN user_id INT;');
            await client.query('ALTER TABLE characters ADD CONSTRAINT fk_characters_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');
            await client.query('ALTER TABLE characters ADD CONSTRAINT characters_user_id_key UNIQUE (user_id);');
            console.log("MIGRATION COMPLETE.");
        }
        
        // Sessions table (for tokens)
        await client.query(`
             CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_active_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        const hasLastActiveAtColumn = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='sessions' AND column_name='last_active_at';
        `);

        if (!hasLastActiveAtColumn.rowCount) {
            console.log("MIGRATING SCHEMA: Adding 'last_active_at' column to 'sessions' table...");
            await client.query('ALTER TABLE sessions ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT NOW();');
            console.log("MIGRATION COMPLETE.");
        }


        // Messages table for PvP reports
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                recipient_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                sender_id INT REFERENCES users(id) ON DELETE CASCADE,
                sender_name VARCHAR(255),
                message_type VARCHAR(50) NOT NULL DEFAULT 'pvp_report',
                subject TEXT NOT NULL,
                body JSONB NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // --- Schema Migration: messages table ---
        const msgUserIdCol = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='user_id';`);
        if (msgUserIdCol.rowCount) {
            console.log("MIGRATING SCHEMA: Renaming 'messages.user_id' to 'recipient_id'...");
            await client.query('ALTER TABLE messages RENAME COLUMN user_id TO recipient_id;');
        }
        const msgSenderIdCol = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sender_id';`);
        if (!msgSenderIdCol.rowCount) {
            console.log("MIGRATING SCHEMA: Adding 'sender_id' column to 'messages' table...");
            await client.query('ALTER TABLE messages ADD COLUMN sender_id INT REFERENCES users(id) ON DELETE CASCADE;');
        }
        const msgSenderNameCol = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sender_name';`);
        if (!msgSenderNameCol.rowCount) {
            console.log("MIGRATING SCHEMA: Adding 'sender_name' column to 'messages' table...");
            await client.query('ALTER TABLE messages ADD COLUMN sender_name VARCHAR(255);');
        }
        const msgTypeCol = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='message_type';`);
        if (!msgTypeCol.rowCount) {
            console.log("MIGRATING SCHEMA: Adding 'message_type' column to 'messages' table...");
            await client.query("ALTER TABLE messages ADD COLUMN message_type VARCHAR(50) NOT NULL DEFAULT 'pvp_report';");
            await client.query("UPDATE messages SET message_type = 'pvp_report';");
        }


        // Tavern chat messages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS tavern_messages (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                character_name VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Game data table (for locations, enemies, etc.)
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_data (
                key VARCHAR(50) PRIMARY KEY,
                data JSONB NOT NULL
            );
        `);

        // FIX: Add Market tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS market_listings (
                id SERIAL PRIMARY KEY,
                seller_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                item_data JSONB NOT NULL,
                listing_type VARCHAR(20) NOT NULL,
                currency VARCHAR(50) NOT NULL,
                buy_now_price BIGINT,
                start_bid_price BIGINT,
                current_bid_price BIGINT,
                highest_bidder_id INT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                updated_at TIMESTAMPTZ
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS market_bids (
                id SERIAL PRIMARY KEY,
                listing_id INT NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
                bidder_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount BIGINT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            );
        `);
        
        const hasUpdatedAtColumn = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='market_listings' AND column_name='updated_at';
        `);

        if (!hasUpdatedAtColumn.rowCount) {
            console.log("MIGRATING SCHEMA: Adding 'updated_at' column to 'market_listings' table...");
            await client.query('ALTER TABLE market_listings ADD COLUMN updated_at TIMESTAMPTZ;');
            console.log("MIGRATION COMPLETE.");
        }


        const gameDataRes = await client.query("SELECT key FROM game_data WHERE key IN ('locations', 'expeditions', 'enemies', 'settings', 'itemTemplates', 'quests', 'affixes')");
        const existingKeys = gameDataRes.rows.map(r => r.key);
        
        if (!existingKeys.includes('locations') || !existingKeys.includes('expeditions') || !existingKeys.includes('enemies')) {
             const startLocation = {
                id: randomUUID(),
                name: 'Starting Village',
                description: 'A peaceful village, an ideal place to start your adventure...',
                travelTime: 0,
                travelCost: 0,
                travelEnergyCost: 0,
                availableTabs: [0, 1, 2, 3, 4, 5, 6, 7, 12], // Added Tavern
                isStartLocation: true,
            };
            await client.query(`INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['locations', JSON.stringify([startLocation])]);
            await client.query(`INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['expeditions', JSON.stringify([])]);
            await client.query(`INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['enemies', JSON.stringify([])]);
            console.log('Populated with initial game data (locations, etc).');
        }

        if (!existingKeys.includes('itemTemplates')) {
            await client.query(`INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['itemTemplates', JSON.stringify([])]);
        }
        
        if (!existingKeys.includes('quests')) {
            await client.query(`INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['quests', JSON.stringify([])]);
        }

        if (!existingKeys.includes('affixes')) {
            await client.query(`INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['affixes', JSON.stringify([])]);
            console.log('Populated with initial game data (affixes).');
        }

        if (!existingKeys.includes('settings')) {
            const defaultSettings = { language: 'pl' };
            await client.query(`INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, ['settings', JSON.stringify(defaultSettings)]);
            console.log('Populated with initial game settings.');
        }


        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Error during database initialization:', err);
        throw err;
    } finally {
        client.release();
    }
};

// --- Password Hashing and Verification Helpers ---
const hashPassword = (password: string) => {
    const salt = randomBytes(16).toString('hex');
    // Use the industry-standard PBKDF2 algorithm for password hashing.
    const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
};

const verifyPassword = (password: string, salt: string, storedHash: string): boolean => {
    if (!password || !salt || !storedHash) {
        return false;
    }
    try {
        // Hash the incoming password with the stored salt and compare it to the stored hash.
        const hashToCompare = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        
        const storedHashBuffer = Buffer.from(storedHash, 'hex');
        const hashToCompareBuffer = Buffer.from(hashToCompare, 'hex');

        // timingSafeEqual requires buffers of the same length.
        if (storedHashBuffer.length !== hashToCompareBuffer.length) {
            return false;
        }

        // Use timingSafeEqual to prevent timing attacks.
        return timingSafeEqual(storedHashBuffer, hashToCompareBuffer);
    } catch (e) {
        console.error("Error during password verification:", e);
        return false;
    }
};

// --- Server-side Stat Calculation ---
// FIX: Rewrote this function to mirror the client-side implementation, fixing multiple type errors.
const calculateDerivedStatsOnServer = (character: PlayerCharacter, itemTemplates: ItemTemplate[], affixes: Affix[]): PlayerCharacter => {
    const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
        strength: character.stats.strength, agility: character.stats.agility, accuracy: character.stats.accuracy,
        stamina: character.stats.stamina, intelligence: character.stats.intelligence, energy: character.stats.energy
    };

    let bonusDamageMin = 0, bonusDamageMax = 0, bonusMagicDamageMin = 0, bonusMagicDamageMax = 0;
    let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0, bonusDodgeChance = 0;
    let bonusAttacksPerRound = 0;
    let bonusCritDamageModifier = 0;
    let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
    let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
    let bonusManaStealPercent = 0, bonusManaStealFlat = 0;
    
    const applyItemBonuses = (source: ItemTemplate, upgradeFactor: number) => {
        for (const stat in source.statsBonus) {
            const key = stat as keyof typeof source.statsBonus;
            const baseBonus = source.statsBonus[key] || 0;
            totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeFactor);
        }

        const baseDamageMin = source.damageMin || 0, baseDamageMax = source.damageMax || 0;
        const baseMagicDamageMin = source.magicDamageMin || 0, baseMagicDamageMax = source.magicDamageMax || 0;
        const baseArmor = source.armorBonus || 0, baseCritChance = source.critChanceBonus || 0, baseMaxHealth = source.maxHealthBonus || 0;
        
        bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeFactor);
        bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeFactor);
        bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeFactor);
        bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeFactor);
        bonusArmor += baseArmor + Math.round(baseArmor * upgradeFactor);
        bonusCritChance += baseCritChance + (baseCritChance * upgradeFactor);
        bonusMaxHealth += baseMaxHealth + Math.round(baseMaxHealth * upgradeFactor);

        bonusCritDamageModifier += source.critDamageModifierBonus || 0;
        bonusArmorPenetrationPercent += source.armorPenetrationPercent || 0;
        bonusArmorPenetrationFlat += source.armorPenetrationFlat || 0;
        bonusLifeStealPercent += source.lifeStealPercent || 0;
        bonusLifeStealFlat += source.lifeStealFlat || 0;
        bonusManaStealPercent += source.manaStealPercent || 0;
        bonusManaStealFlat += source.manaStealFlat || 0;
    };
    
    const applyAffixBonuses = (source: RolledAffixStats) => {
        if (source.statsBonus) {
            for (const stat in source.statsBonus) {
                const key = stat as keyof typeof source.statsBonus;
                totalPrimaryStats[key] += source.statsBonus[key] || 0;
            }
        }
        bonusDamageMin += source.damageMin || 0;
        bonusDamageMax += source.damageMax || 0;
        bonusMagicDamageMin += source.magicDamageMin || 0;
        bonusMagicDamageMax += source.magicDamageMax || 0;
        bonusArmor += source.armorBonus || 0;
        bonusCritChance += source.critChanceBonus || 0;
        bonusMaxHealth += source.maxHealthBonus || 0;
        bonusCritDamageModifier += source.critDamageModifierBonus || 0;
        bonusArmorPenetrationPercent += source.armorPenetrationPercent || 0;
        bonusArmorPenetrationFlat += source.armorPenetrationFlat || 0;
        bonusLifeStealPercent += source.lifeStealPercent || 0;
        bonusLifeStealFlat += source.lifeStealFlat || 0;
        bonusManaStealPercent += source.manaStealPercent || 0;
        bonusManaStealFlat += source.manaStealFlat || 0;
        bonusAttacksPerRound += source.attacksPerRoundBonus || 0;
        bonusDodgeChance += source.dodgeChanceBonus || 0;
    };

    for (const slot in character.equipment) {
        const itemInstance = character.equipment[slot as EquipmentSlot];
        if (itemInstance) {
            const template = itemTemplates.find(t => t.id === itemInstance.templateId);
            if (template) {
                const upgradeLevel = itemInstance.upgradeLevel || 0;
                const upgradeBonusFactor = upgradeLevel * 0.1;
                applyItemBonuses(template, upgradeBonusFactor);
            }
            if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
            if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
        }
    }
    
    const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    const baseAttacksPerRound = mainHandTemplate?.attacksPerRound || 1;
    const attacksPerRound = baseAttacksPerRound + bonusAttacksPerRound;

    const baseHealth = 50, baseEnergy = 10, baseMana = 20, baseMinDamage = 1, baseMaxDamage = 2;

    const maxHealth = baseHealth + (totalPrimaryStats.stamina * 10) + bonusMaxHealth;
    const maxEnergy = baseEnergy + Math.floor(totalPrimaryStats.energy / 2);
    const maxMana = baseMana + totalPrimaryStats.intelligence * 10;
    
    let minDamage, maxDamage;
    if (mainHandTemplate?.isMagical) {
        minDamage = baseMinDamage + bonusDamageMin;
        maxDamage = baseMaxDamage + bonusDamageMax;
    } else {
        minDamage = baseMinDamage + (totalPrimaryStats.strength * 1) + bonusDamageMin;
        maxDamage = baseMaxDamage + (totalPrimaryStats.strength * 2) + bonusDamageMax;
    }
    
    const critChance = totalPrimaryStats.accuracy * 0.5 + bonusCritChance;
    const critDamageModifier = 200 + bonusCritDamageModifier;
    const armorPenetrationPercent = bonusArmorPenetrationPercent;
    const armorPenetrationFlat = bonusArmorPenetrationFlat;
    const lifeStealPercent = bonusLifeStealPercent;
    const lifeStealFlat = bonusLifeStealFlat;
    const manaStealPercent = bonusManaStealPercent;
    const manaStealFlat = bonusManaStealFlat;
    const dodgeChance = totalPrimaryStats.agility * 0.1 + bonusDodgeChance;

    let armor = bonusArmor;
    let manaRegen = totalPrimaryStats.intelligence * 2;

    if (character.race === Race.Dwarf) armor += 5;
    if (character.race === Race.Elf) manaRegen += 10;
    
    const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
    const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
    const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

    const currentHealth = Math.min(character.stats.currentHealth, maxHealth);
    const currentMana = Math.min(character.stats.currentMana, maxMana);
    const currentEnergy = Math.min(character.stats.currentEnergy, maxEnergy);

    return {
        ...character,
        stats: {
            ...character.stats, ...totalPrimaryStats,
            maxHealth, maxEnergy, maxMana, minDamage, maxDamage, critChance, armor,
            magicDamageMin, magicDamageMax, attacksPerRound, manaRegen,
            currentHealth, currentMana, currentEnergy,
            critDamageModifier, armorPenetrationPercent, armorPenetrationFlat,
            lifeStealPercent, lifeStealFlat, manaStealPercent, manaStealFlat,
            dodgeChance,
        }
    };
};

// --- EXPEDITION & COMBAT LOGIC ---

// FIX: Added missing function
async function completeExpedition(
    client: any, // PoolClient
    userId: number,
    character: PlayerCharacter,
    allExpeditions: Expedition[],
    allEnemies: Enemy[],
    allItemTemplates: ItemTemplate[],
    allAffixes: Affix[],
    allQuests: Quest[],
): Promise<{ character: PlayerCharacter, summary: ExpeditionRewardSummary }> {
    const expeditionDetails = allExpeditions.find(e => e.id === character.activeExpedition!.expeditionId);
    if (!expeditionDetails) {
        throw new Error('Expedition details not found.');
    }

    const summary: ExpeditionRewardSummary = {
        rewardBreakdown: [],
        totalGold: 0,
        totalExperience: 0,
        combatLog: [],
        isVictory: true,
        itemsFound: [],
        essencesFound: {},
    };

    // Base rewards
    const baseGold = Math.floor(Math.random() * (expeditionDetails.maxBaseGoldReward - expeditionDetails.minBaseGoldReward + 1)) + expeditionDetails.minBaseGoldReward;
    const baseExperience = Math.floor(Math.random() * (expeditionDetails.maxBaseExperienceReward - expeditionDetails.minBaseExperienceReward + 1)) + expeditionDetails.minBaseExperienceReward;
    
    summary.rewardBreakdown.push({ source: 'Expedition Reward', gold: baseGold, experience: baseExperience });
    
    let totalGoldWithBonuses = baseGold;
    let totalExperienceWithBonuses = baseExperience;

    // Generate enemies
    let enemiesToFight: Enemy[] = [];
    if(expeditionDetails.enemies && expeditionDetails.enemies.length > 0) {
        const maxEnemies = expeditionDetails.maxEnemies || expeditionDetails.enemies.length;
        let enemyCount = 0;
        // This loop ensures we try to spawn enemies, but not indefinitely
        for(let i = 0; i < maxEnemies * 5 && enemyCount < maxEnemies; i++) {
            for (const expEnemy of expeditionDetails.enemies) {
                if (enemyCount >= maxEnemies) break;
                if (Math.random() * 100 < expEnemy.spawnChance) {
                    const enemyTemplate = allEnemies.find(e => e.id === expEnemy.enemyId);
                    if (enemyTemplate) {
                        enemiesToFight.push({ ...enemyTemplate, uniqueId: randomUUID() });
                        enemyCount++;
                    }
                }
            }
        }
    }


    let updatedChar = { ...character };

    for (const enemy of enemiesToFight) {
        const fightResult = simulateFight(updatedChar, enemy, allItemTemplates, allAffixes);
        summary.combatLog.push(...fightResult.combatLog);
        updatedChar.stats.currentHealth = fightResult.finalPlayerHealth;
        updatedChar.stats.currentMana = fightResult.finalPlayerMana;

        if (!fightResult.isVictory) {
            summary.isVictory = false;
            break;
        }

        const goldReward = Math.floor(Math.random() * (enemy.rewards.maxGold - enemy.rewards.minGold + 1)) + enemy.rewards.minGold;
        const experienceReward = Math.floor(Math.random() * (enemy.rewards.maxExperience - enemy.rewards.minExperience + 1)) + enemy.rewards.minExperience;
        
        totalGoldWithBonuses += goldReward;
        totalExperienceWithBonuses += experienceReward;
        
        summary.rewardBreakdown.push({ source: `Defeated ${enemy.name}`, gold: goldReward, experience: experienceReward });
        
        for (const drop of enemy.lootTable) {
            if (Math.random() * 100 < drop.chance) {
                summary.itemsFound.push(createItemInstance(drop.templateId, allItemTemplates, allAffixes));
            }
        }
        for (const drop of enemy.resourceLootTable || []) {
             if (Math.random() * 100 < drop.chance) {
                const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                summary.essencesFound[drop.resource] = (summary.essencesFound[drop.resource] || 0) + amount;
            }
        }
        
        updatedChar.acceptedQuests.forEach(questId => {
            const quest = allQuests.find(q => q.id === questId);
            if (quest && quest.objective.type === QuestType.Kill && quest.objective.targetId === enemy.id) {
                const progress = updatedChar.questProgress.find(p => p.questId === questId);
                if (progress) {
                    progress.progress = (progress.progress || 0) + 1;
                }
            }
        });
    }

    if (summary.isVictory) {
        for (const drop of expeditionDetails.lootTable) {
            if (Math.random() * 100 < drop.chance) {
                summary.itemsFound.push(createItemInstance(drop.templateId, allItemTemplates, allAffixes));
            }
        }
        for (const drop of expeditionDetails.resourceLootTable || []) {
             if (Math.random() * 100 < drop.chance) {
                const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                summary.essencesFound[drop.resource] = (summary.essencesFound[drop.resource] || 0) + amount;
            }
        }
        
        // Apply racial bonuses to total
        if (updatedChar.race === Race.Human) {
             totalExperienceWithBonuses = Math.floor(totalExperienceWithBonuses * 1.1);
        }
        if(updatedChar.race === Race.Gnome){
             totalGoldWithBonuses = Math.floor(totalGoldWithBonuses * 1.2);
        }
        
        summary.totalGold = totalGoldWithBonuses;
        summary.totalExperience = totalExperienceWithBonuses;
        
        updatedChar.experience += summary.totalExperience;
        updatedChar.resources.gold += summary.totalGold;
        
        const backpackCapacity = getBackpackCapacity(updatedChar);
        const freeSpace = backpackCapacity - updatedChar.inventory.length;
        if (summary.itemsFound.length > freeSpace) {
            const itemsToAdd = summary.itemsFound.slice(0, freeSpace);
            updatedChar.inventory.push(...itemsToAdd);
            summary.itemsLostCount = summary.itemsFound.length - freeSpace;
            summary.itemsFound = itemsToAdd;
        } else {
            updatedChar.inventory.push(...summary.itemsFound);
        }

        for (const [essence, amount] of Object.entries(summary.essencesFound)) {
            updatedChar.resources[essence as EssenceType] = (updatedChar.resources[essence as EssenceType] || 0) + amount;
        }
        
        const oldLevel = updatedChar.level;
        while (updatedChar.experience >= updatedChar.experienceToNextLevel) {
            updatedChar.experience -= updatedChar.experienceToNextLevel;
            updatedChar.level += 1;
            updatedChar.stats.statPoints += 1;
            updatedChar.experienceToNextLevel = Math.floor(100 * Math.pow(updatedChar.level, 1.3));
        }

        if (oldLevel < 10 && updatedChar.level >= 10 && !updatedChar.characterClass) {
            const subject = 'Czas wybrać klasę!';
            const body = 'Gratulacje! Osiągnąłeś 10 poziom. Możesz teraz wybrać klasę dla swojej postaci w zakładce Statystyki -> Ścieżka rozwoju. Wybierz mądrze, ponieważ ten wybór jest ostateczny!';
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', $2, $3)`,
                [userId, subject, JSON.stringify({ content: body })]
            );
        }
    }
    
    updatedChar.activeExpedition = null;
    
    return { character: updatedChar, summary };
}

function simulateFight(player: PlayerCharacter, initialEnemy: Enemy, itemTemplates: ItemTemplate[], affixes: Affix[]): { combatLog: CombatLogEntry[], isVictory: boolean, finalPlayerHealth: number, finalPlayerMana: number } {
    const combatLog: CombatLogEntry[] = [];
    
    const playerDerived = calculateDerivedStatsOnServer(player, itemTemplates, affixes);
    const playerStats = playerDerived.stats;
    const enemyStats: EnemyStats = JSON.parse(JSON.stringify(initialEnemy.stats));
    
    let playerHealth = playerStats.currentHealth;
    let playerMana = playerStats.currentMana;
    let enemyHealth = enemyStats.maxHealth;
    let enemyMana = enemyStats.maxMana || 0;

    combatLog.push({
        turn: 0,
        attacker: player.name,
        defender: initialEnemy.name,
        action: 'starts a fight with',
        playerHealth, playerMana, enemyHealth, enemyMana,
        playerStats: playerStats, enemyStats: enemyStats, enemyDescription: initialEnemy.description,
    });
    
    const mainHandItem = player.equipment[EquipmentSlot.MainHand] || player.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;

    // Ranged opening shot
    if (mainHandTemplate?.isRanged) {
        let damage = 0;
        let isCrit = false;
        let damageReduced = 0;
        let healthGained = 0;
        let manaGained = 0;
        
        damage = Math.floor(Math.random() * (playerStats.maxDamage - playerStats.minDamage + 1)) + playerStats.minDamage;
        
        if (Math.random() * 100 < playerStats.critChance) {
            isCrit = true;
            damage = Math.floor(damage * (playerStats.critDamageModifier || 200) / 100);
        }

        // Armor Reduction
        let armorPenPercent = playerStats.armorPenetrationPercent;
        let armorPenFlat = playerStats.armorPenetrationFlat;
        let effectiveArmor = enemyStats.armor * (1 - armorPenPercent / 100) - armorPenFlat;
        effectiveArmor = Math.max(0, effectiveArmor);
        const reduction = Math.floor(effectiveArmor * 0.5);
        damageReduced = Math.min(damage, reduction);
        damage -= damageReduced;

        damage = Math.max(0, damage);
        
        // Life/Mana Steal
        healthGained = Math.floor(damage * (playerStats.lifeStealPercent / 100)) + playerStats.lifeStealFlat;
        manaGained = Math.floor(damage * (playerStats.manaStealPercent / 100)) + playerStats.manaStealFlat;
        if(healthGained > 0) playerHealth = Math.min(playerStats.maxHealth, playerHealth + healthGained);
        if(manaGained > 0) playerMana = Math.min(playerStats.maxMana, playerMana + manaGained);

        // Apply Damage
        enemyHealth -= damage;
        enemyHealth = Math.max(0, enemyHealth);

        combatLog.push({
            turn: 0, // Opening shot
            attacker: player.name, 
            defender: initialEnemy.name, 
            action: 'attacks', 
            damage, 
            isCrit, 
            damageReduced, 
            healthGained, 
            manaGained, 
            playerHealth, 
            playerMana, 
            enemyHealth, 
            enemyMana,
            weaponName: mainHandTemplate.name,
        });
    }
    
    let turn = 1; // Round counter
    while (playerHealth > 0 && enemyHealth > 0) {
        // --- Round Start ---
        let playerAttacksRemaining = Math.floor(playerStats.attacksPerRound);
        let enemyAttacksRemaining = enemyStats.attacksPerTurn || 1;

        // Player Mana Regen
        const pManaRegen = playerStats.manaRegen;
        if (pManaRegen > 0 && playerMana < playerStats.maxMana) {
            const newMana = Math.min(playerStats.maxMana, playerMana + pManaRegen);
            combatLog.push({ turn, attacker: player.name, defender: initialEnemy.name, action: 'manaRegen', manaGained: newMana - playerMana, playerHealth, playerMana: newMana, enemyHealth, enemyMana });
            playerMana = newMana;
        }
        // Enemy Mana Regen
        const eManaRegen = enemyStats.manaRegen || 0;
        if (eManaRegen > 0 && enemyMana < (enemyStats.maxMana || 0)) {
            const newMana = Math.min((enemyStats.maxMana || 0), enemyMana + eManaRegen);
            combatLog.push({ turn, attacker: initialEnemy.name, defender: player.name, action: 'manaRegen', manaGained: newMana - enemyMana, playerHealth, playerMana, enemyHealth, enemyMana: newMana });
            enemyMana = newMana;
        }
        
        let isPlayerTurn = (turn === 1 && player.race === Race.Elf) || playerStats.agility >= enemyStats.agility;

        // --- Single Attack Loop for the Round ---
        while ((playerAttacksRemaining > 0 || enemyAttacksRemaining > 0) && playerHealth > 0 && enemyHealth > 0) {
            let attacker: { name: string, stats: CharacterStats | EnemyStats, race?: Race };
            let defender: { name: string, stats: CharacterStats | EnemyStats, race?: Race };
            let attackerStats: CharacterStats | EnemyStats;
            let defenderStats: CharacterStats | EnemyStats;
            let attackerHasAttacks: boolean;

            if (isPlayerTurn) {
                attacker = player;
                attackerStats = playerStats;
                defender = initialEnemy;
                defenderStats = enemyStats;
                attackerHasAttacks = playerAttacksRemaining > 0;
            } else {
                attacker = initialEnemy;
                attackerStats = enemyStats;
                defender = player;
                defenderStats = playerStats;
                attackerHasAttacks = enemyAttacksRemaining > 0;
            }

            if (attackerHasAttacks) {
                // --- Single Attack Logic ---
                let damage = 0;
                let isCrit = false;
                let isDodge = false;
                let damageReduced = 0;
                let healthGained = 0;
                let manaGained = 0;
                let magicAttackType: MagicAttackType | undefined = undefined;

                // Dodge Check
                const baseDodge = (defenderStats as CharacterStats).dodgeChance || 0;
                const racialDodge = defender.race === Race.Gnome ? 10 : 0;
                const agilityDiff = defenderStats.agility - ((attackerStats as CharacterStats).accuracy || 0);
                const agilityDodge = Math.max(0, agilityDiff * 0.1);

                if (Math.random() * 100 < (baseDodge + racialDodge + agilityDodge)) {
                    isDodge = true;
                }

                if(isDodge) {
                    combatLog.push({ turn, attacker: attacker.name, defender: defender.name, action: 'attacks', isDodge, playerHealth, playerMana, enemyHealth, enemyMana });
                } else {
                    // Determine Attack Type (Magic or Physical)
                    let isMagicAttack = false;
                    let notEnoughMana = false;
                    if (isPlayerTurn) {
                        if (mainHandTemplate?.isMagical && mainHandTemplate.magicAttackType && mainHandTemplate.manaCost) {
                            if (playerMana >= mainHandTemplate.manaCost) {
                                isMagicAttack = true;
                                playerMana -= mainHandTemplate.manaCost;
                                magicAttackType = mainHandTemplate.magicAttackType;
                            } else {
                                notEnoughMana = true;
                            }
                        }
                    } else {
                        const eStats = attackerStats as EnemyStats;
                        if (eStats.magicAttackType && eStats.magicAttackChance && eStats.magicAttackManaCost) {
                            if (Math.random() * 100 < eStats.magicAttackChance && enemyMana >= eStats.magicAttackManaCost) {
                                isMagicAttack = true;
                                enemyMana -= eStats.magicAttackManaCost;
                                magicAttackType = eStats.magicAttackType;
                            }
                        }
                    }
                    if (notEnoughMana) {
                        combatLog.push({ turn, attacker: attacker.name, defender: defender.name, action: 'notEnoughMana', playerHealth, playerMana, enemyHealth, enemyMana });
                    }

                    // Damage Calculation
                    if (isMagicAttack) {
                        damage = Math.floor(Math.random() * ((attackerStats.magicDamageMax || 0) - (attackerStats.magicDamageMin || 0) + 1)) + (attackerStats.magicDamageMin || 0);
                    } else { // Physical Attack
                        damage = Math.floor(Math.random() * (attackerStats.maxDamage - attackerStats.minDamage + 1)) + attackerStats.minDamage;
                        if (Math.random() * 100 < attackerStats.critChance) {
                            isCrit = true;
                            damage = Math.floor(damage * ((attackerStats as CharacterStats).critDamageModifier || 200) / 100);
                        }

                        // Armor Reduction
                        let armorPenPercent = isPlayerTurn ? (attackerStats as CharacterStats).armorPenetrationPercent : 0;
                        let armorPenFlat = isPlayerTurn ? (attackerStats as CharacterStats).armorPenetrationFlat : 0;
                        
                        let effectiveArmor = defenderStats.armor * (1 - armorPenPercent / 100) - armorPenFlat;
                        effectiveArmor = Math.max(0, effectiveArmor);

                        const reduction = Math.floor(effectiveArmor * 0.5);
                        damageReduced = Math.min(damage, reduction);
                        damage -= damageReduced;
                    }

                    // Race/Special Bonuses
                    if (attacker.race === Race.Orc && (isPlayerTurn ? playerHealth : enemyHealth) < attackerStats.maxHealth * 0.25) {
                        damage = Math.floor(damage * 1.25);
                    }
                    if (defender.race === Race.Dwarf && (isPlayerTurn ? enemyHealth : playerHealth) < defenderStats.maxHealth * 0.5) {
                        damage = Math.floor(damage * 0.8);
                    }
                    
                    damage = Math.max(0, damage);
                    
                    // Life/Mana Steal (Player attacking only)
                    if (isPlayerTurn) {
                        healthGained = Math.floor(damage * (playerStats.lifeStealPercent / 100)) + playerStats.lifeStealFlat;
                        manaGained = Math.floor(damage * (playerStats.manaStealPercent / 100)) + playerStats.manaStealFlat;

                        if(healthGained > 0) playerHealth = Math.min(playerStats.maxHealth, playerHealth + healthGained);
                        if(manaGained > 0) playerMana = Math.min(playerStats.maxMana, playerMana + manaGained);
                    }

                    // Apply Damage
                    if (isPlayerTurn) {
                        enemyHealth -= damage;
                    } else {
                        playerHealth -= damage;
                    }

                    playerHealth = Math.max(0, playerHealth);
                    enemyHealth = Math.max(0, enemyHealth);
                
                    combatLog.push({
                        turn, attacker: attacker.name, defender: defender.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, magicAttackType,
                        playerHealth, playerMana, enemyHealth, enemyMana,
                        weaponName: isPlayerTurn ? mainHandTemplate?.name : undefined,
                    });
                }
                
                if (isPlayerTurn) playerAttacksRemaining--;
                else enemyAttacksRemaining--;
            }

            // --- Decide who attacks next ---
            const agilityAdvantage = attackerStats.agility - defenderStats.agility;
            const chanceToAttackAgain = Math.min(75, Math.max(0, agilityAdvantage * 2)); // 2% per point, capped at 75%
    
            if (Math.random() * 100 < chanceToAttackAgain && (isPlayerTurn ? playerAttacksRemaining > 0 : enemyAttacksRemaining > 0)) {
                // Current attacker attacks again, isPlayerTurn does not change
            } else {
                // Switch turns
                isPlayerTurn = !isPlayerTurn;
    
                // If the new attacker has no attacks, but the other one still does, switch back.
                if (isPlayerTurn && playerAttacksRemaining === 0 && enemyAttacksRemaining > 0) {
                    isPlayerTurn = false;
                } else if (!isPlayerTurn && enemyAttacksRemaining === 0 && playerAttacksRemaining > 0) {
                    isPlayerTurn = true;
                }
            }
        } // End of single-attack loop for the round

        turn++;
        if (turn > 50) break; // Safety break
    } // End of round loop

    return {
        combatLog,
        isVictory: playerHealth > 0,
        finalPlayerHealth: playerHealth,
        finalPlayerMana: playerMana
    };
}

// FIX: Added missing function
function simulatePvpFight(
    attacker: PlayerCharacter,
    defender: PlayerCharacter,
    itemTemplates: ItemTemplate[],
    affixes: Affix[]
): {
    isVictory: boolean,
    combatLog: CombatLogEntry[],
    finalAttackerHealth: number,
    finalAttackerMana: number,
    finalDefenderHealth: number,
    finalDefenderMana: number,
    initialDerivedAttacker: PlayerCharacter,
    initialDerivedDefender: PlayerCharacter
} {
    const combatLog: CombatLogEntry[] = [];
    
    const initialDerivedAttacker = calculateDerivedStatsOnServer(attacker, itemTemplates, affixes);
    const initialDerivedDefender = calculateDerivedStatsOnServer(defender, itemTemplates, affixes);

    const attackerStats = initialDerivedAttacker.stats;
    const defenderStats = initialDerivedDefender.stats;
    
    let attackerHealth = attackerStats.currentHealth;
    let attackerMana = attackerStats.currentMana;
    let defenderHealth = defenderStats.currentHealth;
    let defenderMana = defenderStats.currentMana;

    combatLog.push({
        turn: 0,
        attacker: attacker.name,
        defender: defender.name,
        action: 'starts a fight with',
        playerHealth: attackerHealth, playerMana: attackerMana,
        enemyHealth: defenderHealth, enemyMana: defenderMana,
        playerStats: attackerStats, enemyStats: defenderStats,
    });
    
    let turn = 1;
    let isAttackerTurn = (attacker.race === Race.Elf) || attackerStats.agility >= defenderStats.agility;
    
    while (attackerHealth > 0 && defenderHealth > 0 && turn <= 50) {
        // Mana Regen
        if (attackerMana < attackerStats.maxMana) {
            attackerMana = Math.min(attackerStats.maxMana, attackerMana + attackerStats.manaRegen);
        }
        if (defenderMana < defenderStats.maxMana) {
            defenderMana = Math.min(defenderStats.maxMana, defenderMana + defenderStats.manaRegen);
        }

        let playerA: PlayerCharacter, statsA: CharacterStats, playerB: PlayerCharacter, statsB: CharacterStats;
        if (isAttackerTurn) {
            [playerA, statsA] = [attacker, attackerStats];
            [playerB, statsB] = [defender, defenderStats];
        } else {
            [playerA, statsA] = [defender, defenderStats];
            [playerB, statsB] = [attacker, attackerStats];
        }

        let attacksRemaining = Math.floor(statsA.attacksPerRound);
        while (attacksRemaining > 0 && attackerHealth > 0 && defenderHealth > 0) {
            let damage = 0;
            let isCrit = false, isDodge = false, damageReduced = 0, healthGained = 0, manaGained = 0;
            let magicAttackType: MagicAttackType | undefined = undefined;

            if (Math.random() * 100 < statsB.dodgeChance) {
                isDodge = true;
            }

            if(!isDodge) {
                damage = Math.floor(Math.random() * (statsA.maxDamage - statsA.minDamage + 1)) + statsA.minDamage;
                if (Math.random() * 100 < statsA.critChance) {
                    isCrit = true;
                    damage = Math.floor(damage * (statsA.critDamageModifier / 100));
                }

                let effectiveArmor = statsB.armor * (1 - statsA.armorPenetrationPercent / 100) - statsA.armorPenetrationFlat;
                effectiveArmor = Math.max(0, effectiveArmor);
                damageReduced = Math.min(damage, Math.floor(effectiveArmor * 0.5));
                damage -= damageReduced;
                damage = Math.max(0, damage);
                
                healthGained = Math.floor(damage * (statsA.lifeStealPercent / 100)) + statsA.lifeStealFlat;
                manaGained = Math.floor(damage * (statsA.manaStealPercent / 100)) + statsA.manaStealFlat;

                if (playerA.id === attacker.id) { // isAttackerTurn
                    attackerHealth = Math.min(statsA.maxHealth, attackerHealth + healthGained);
                    attackerMana = Math.min(statsA.maxMana, attackerMana + manaGained);
                    defenderHealth -= damage;
                } else { // isDefenderTurn
                    defenderHealth = Math.min(statsA.maxHealth, defenderHealth + healthGained);
                    defenderMana = Math.min(statsA.maxMana, defenderMana + manaGained);
                    attackerHealth -= damage;
                }
            }

            combatLog.push({
                turn,
                attacker: playerA.name,
                defender: playerB.name,
                action: 'attacks',
                damage: isDodge ? 0 : damage, isCrit, isDodge, damageReduced, healthGained, manaGained, magicAttackType,
                playerHealth: attackerHealth, playerMana: attackerMana,
                enemyHealth: defenderHealth, enemyMana: defenderMana,
            });

            attacksRemaining--;
        }
        
        isAttackerTurn = !isAttackerTurn;
        turn++;
    }

    return {
        isVictory: defenderHealth <= 0,
        combatLog,
        finalAttackerHealth: Math.max(0, attackerHealth),
        finalAttackerMana: Math.max(0, attackerMana),
        finalDefenderHealth: Math.max(0, defenderHealth),
        finalDefenderMana: Math.max(0, defenderMana),
        initialDerivedAttacker,
        initialDerivedDefender,
    };
}


async function processExpiredListings(client: any) { // Can be PoolClient or Pool
    const expiredRes = await client.query(
        "SELECT * FROM market_listings WHERE status = 'ACTIVE' AND expires_at <= NOW() FOR UPDATE"
    );

    if (expiredRes.rows.length === 0) {
        return;
    }

    const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
    const allItemTemplates: ItemTemplate[] = gameDataRes.rows[0]?.data || [];

    for (const listing of expiredRes.rows) {
        const isUnsold = listing.listing_type === 'buy_now' || (listing.listing_type === 'auction' && !listing.highest_bidder_id);
        
        if (isUnsold) {
            await client.query("UPDATE market_listings SET status = 'EXPIRED' WHERE id = $1", [listing.id]);

            const template = allItemTemplates.find(t => t.id === listing.item_data.templateId);
            const notificationBody: MarketNotificationBody = {
                type: 'ITEM_RETURNED',
                itemName: template?.name || 'Unknown Item',
                item: listing.item_data,
                listingId: listing.id
            };
            
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                 VALUES ($1, 'Rynek', 'market_notification', 'Twoja oferta wygasła', $2)`,
                [listing.seller_id, JSON.stringify(notificationBody)]
            );
        }
        // TODO in future: handle sold auctions that have expired
    }
}

// --- TAVERN CLEANUP ---
async function cleanupOldTavernMessages() {
    const client = await pool.connect();
    try {
        const result = await client.query(
            "DELETE FROM tavern_messages WHERE created_at < NOW() - INTERVAL '12 hours'"
        );
        if (result.rowCount && result.rowCount > 0) {
            console.log(`[TAVERN CLEANUP] Removed ${result.rowCount} old tavern messages.`);
        }
    } catch (err) {
        console.error('[TAVERN CLEANUP] Error removing old tavern messages:', err);
    } finally {
        client.release();
    }
}

/**
 * Calculates the maximum capacity of a character's backpack based on its level.
 * @param character The player character object.
 * @returns The total number of slots in the backpack.
 */
const getBackpackCapacity = (character: PlayerCharacter): number => 40 + ((character.backpack?.level || 1) - 1) * 10;

// ===================================================================================
//                                  ROUTES
// ===================================================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist')));

// --- Authentication Routes ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    if (username.length < 3 || password.length < 6) {
        return res.status(400).json({ message: 'Username must be at least 3 characters and password at least 6 characters.' });
    }

    const { salt, hash } = hashPassword(password);
    
    try {
        await pool.query(
            'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3)',
            [username, hash, salt]
        );
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err: any) {
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ message: 'Username already exists.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    try {
        const result = await pool.query('SELECT id, password_hash, salt FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        const user = result.rows[0];
        const isPasswordValid = verifyPassword(password, user.salt, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = randomBytes(64).toString('hex');
        await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/auth/logout', authenticateToken, (req: Request, res: Response) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
        pool.query('DELETE FROM sessions WHERE token = $1', [token])
            .then(() => res.sendStatus(204))
            .catch(err => {
                console.error("Logout error:", err);
                res.sendStatus(500);
            });
    } else {
        res.sendStatus(400); // No token provided
    }
});

// Heartbeat endpoint
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/session/heartbeat', authenticateToken, async (req: Request, res: Response) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.sendStatus(401);
    }
    try {
        await pool.query('UPDATE sessions SET last_active_at = NOW() WHERE token = $1', [token]);
        res.sendStatus(200);
    } catch (err) {
        console.error('Heartbeat error:', err);
        res.sendStatus(500);
    }
});

// --- Middleware for authentication ---
// FIX: Add explicit types for Express request, response and next function objects to resolve type errors.
async function authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    try {
        const result = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
        if (result.rows.length === 0) {
            return res.status(403).json({ message: "Invalid token" });
        }
        req.user = { id: result.rows[0].user_id };
        next();
    } catch (err) {
        console.error("Authentication error:", err);
        return res.sendStatus(500);
    }
}

// --- Character Routes ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/character', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await processExpiredListings(client);

        const result = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            await client.query('COMMIT');
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        let character: PlayerCharacter = result.rows[0].data;

        // Check if we need to send a class choice notification to existing players
        if (character.level >= 10 && !character.characterClass) {
            const subject = 'Czas wybrać klasę!';
            const messageCheck = await client.query("SELECT 1 FROM messages WHERE recipient_id = $1 AND subject = $2", [userId, subject]);
            if (messageCheck.rowCount === 0) {
                const body = 'Gratulacje! Osiągnąłeś 10 poziom. Możesz teraz wybrać klasę dla swojej postaci w zakładce Statystyki -> Ścieżka rozwoju. Wybierz mądrze, ponieważ ten wybór jest ostateczny!';
                await client.query(
                    `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', $2, $3)`,
                    [userId, subject, JSON.stringify({ content: body })]
                );
            }
        }
        
        await client.query('COMMIT');

        // Check if expedition is finished
        if (character.activeExpedition && Date.now() >= character.activeExpedition.finishTime) {
            const gameDataRes = await pool.query("SELECT key, data FROM game_data WHERE key IN ('expeditions', 'enemies', 'itemTemplates', 'quests', 'affixes')");
            const allExpeditions = gameDataRes.rows.find(r => r.key === 'expeditions')?.data || [];
            const allEnemies = gameDataRes.rows.find(r => r.key === 'enemies')?.data || [];
            const allItemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const allQuests = gameDataRes.rows.find(r => r.key === 'quests')?.data || [];
            const allAffixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

            const expeditionClient = await pool.connect();
            try {
                await expeditionClient.query('BEGIN');
                const { character: updatedChar, summary } = await completeExpedition(expeditionClient, userId, character, allExpeditions, allEnemies, allItemTemplates, allAffixes, allQuests);
                await expeditionClient.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(updatedChar), userId]);
                await expeditionClient.query('COMMIT');

                const summaryMessageBody = JSON.stringify(summary);
                await expeditionClient.query(
                    'INSERT INTO messages (recipient_id, message_type, subject, body) VALUES ($1, $2, $3, $4)',
                    [userId, 'expedition_report', 'Raport z Ekspedycji', summaryMessageBody]
                );

                res.json({ ...updatedChar, expeditionSummary: summary });
            } catch (err) {
                await expeditionClient.query('ROLLBACK');
                throw err; // Propagate error
            } finally {
                expeditionClient.release();
            }
        } else {
             // Energy Regeneration Logic
            const now = Date.now();
            const timeSinceLastUpdate = now - character.lastEnergyUpdateTime;
            const hoursPassed = Math.floor(timeSinceLastUpdate / (1000 * 60 * 60));

            if (hoursPassed > 0) {
                const gameDataRes = await pool.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
                const allItemTemplates = gameDataRes.rows[0]?.data || [];
                const gameDataAffixesRes = await pool.query("SELECT data FROM game_data WHERE key = 'affixes'");
                const allAffixes = gameDataAffixesRes.rows[0]?.data || [];

                const derivedChar = calculateDerivedStatsOnServer(character, allItemTemplates, allAffixes);
                const maxEnergy = derivedChar.stats.maxEnergy;

                if (character.stats.currentEnergy < maxEnergy) {
                    const newEnergy = Math.min(maxEnergy, character.stats.currentEnergy + hoursPassed);
                    character.stats.currentEnergy = newEnergy;
                    character.lastEnergyUpdateTime += hoursPassed * (1000 * 60 * 60);
                    // No need to save to DB here, it will be saved on next PUT, this is just for the GET request
                }
            }
            res.json(character);
        }

    } catch (err) {
        await client.query('ROLLBACK').catch(() => {}); // Attempt rollback on error
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving character.' });
    } finally {
        client.release();
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/character', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const characterData: PlayerCharacter = req.body;
    try {
        await pool.query('INSERT INTO characters (user_id, data) VALUES ($1, $2)', [userId, JSON.stringify(characterData)]);
        res.status(201).json(characterData);
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'A character already exists for this user.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error creating character.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.put('/api/character', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const characterData: PlayerCharacter = req.body;
    try {
        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(characterData), userId]);
        res.json(characterData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error updating character.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/character/select-class', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { characterClass } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
            throw new Error('Character not found.');
        }

        let character: PlayerCharacter = charRes.rows[0].data;

        // Validation
        if (character.level < 10) {
            throw new Error('You must be at least level 10 to choose a class.');
        }
        if (character.characterClass) {
            throw new Error('You have already chosen a class.');
        }

        const classOptions: Record<Race, CharacterClass[]> = {
            [Race.Human]: [CharacterClass.Mage, CharacterClass.Warrior, CharacterClass.Rogue],
            [Race.Elf]: [CharacterClass.Wizard, CharacterClass.Hunter, CharacterClass.Druid],
            [Race.Orc]: [CharacterClass.Shaman, CharacterClass.Warrior, CharacterClass.Berserker],
            [Race.Dwarf]: [CharacterClass.Warrior, CharacterClass.Blacksmith, CharacterClass.DungeonHunter],
            [Race.Gnome]: [CharacterClass.Thief, CharacterClass.Engineer, CharacterClass.Warrior],
        };

        const isValidClass = classOptions[character.race]?.includes(characterClass);
        if (!isValidClass) {
            throw new Error(`Invalid class for your race.`);
        }

        // Update character
        character.characterClass = characterClass;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error selecting class:', err);
        res.status(400).json({ message: err.message || 'Server error while selecting class.' });
    } finally {
        client.release();
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/characters/all', authenticateToken, async (req: Request, res: Response) => {
    try {
        // First check if the user is an admin
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        const result = await pool.query(`
            SELECT 
                c.user_id, 
                u.username, 
                c.data->>'name' as name, 
                c.data->>'race' as race, 
                (c.data->>'level')::int as level,
                (c.data->'resources'->>'gold')::bigint as gold
            FROM characters c
            JOIN users u ON c.user_id = u.id
            ORDER BY level DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching all characters.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.delete('/api/characters/:userId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        const { userId } = req.params;
        await pool.query('DELETE FROM characters WHERE user_id = $1', [userId]);
        res.sendStatus(204);
    } catch (err) {
        console.error("Error deleting character:", err);
        res.status(500).json({ message: 'Failed to delete character.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/characters/names', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`SELECT data->>'name' as name FROM characters`);
        res.json(result.rows.map(r => r.name));
    } catch(err) {
        console.error("Error fetching character names:", err);
        res.status(500).json({ message: 'Failed to fetch character names.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/characters/:userId/reset-stats', authenticateToken, async (req: Request, res: Response) => {
     try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') return res.status(403).json({ message: 'Forbidden' });

        const { userId } = req.params;
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found.' });

        let char: PlayerCharacter = charRes.rows[0].data;
        const totalPoints = 10 + (char.level - 1);
        
        char.stats.strength = 0;
        char.stats.agility = 0;
        char.stats.accuracy = 0;
        char.stats.stamina = 0;
        char.stats.intelligence = 0;
        char.stats.energy = 0;
        char.stats.statPoints = totalPoints;

        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        res.sendStatus(200);

    } catch (err) {
        console.error("Error resetting stats:", err);
        res.status(500).json({ message: 'Failed to reset stats.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/characters/:userId/heal', authenticateToken, async (req: Request, res: Response) => {
     try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') return res.status(403).json({ message: 'Forbidden' });
        
        const { userId } = req.params;
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found.' });

        let char: PlayerCharacter = charRes.rows[0].data;
        
        // This won't have derived stats yet, so we just set it to a very large number
        // The next client sync will fix it with calculateDerivedStats
        char.stats.currentHealth = 999999; 

        await pool.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
        res.sendStatus(200);

    } catch (err) {
        console.error("Error healing character:", err);
        res.status(500).json({ message: 'Failed to heal character.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/admin/character/:userId/update-gold', authenticateToken, async (req: Request, res: Response) => {
    try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { userId } = req.params;
        const { gold } = req.body;

        if (gold === undefined || typeof gold !== 'number' || gold < 0) {
            return res.status(400).json({ message: 'Invalid gold amount provided.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
            if (charRes.rows.length === 0) {
                throw new Error('Character not found.');
            }
            let char: PlayerCharacter = charRes.rows[0].data;

            char.resources.gold = gold;

            await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), userId]);
            await client.query('COMMIT');
            
            res.status(200).json({ message: `Successfully updated gold for character ${char.name}.` });
        } catch (err: any) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err: any) {
        console.error("Error updating character gold:", err);
        res.status(500).json({ message: err.message || 'Failed to update gold.' });
    }
});

// --- User Routes (Admin) ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/users', authenticateToken, async (req: Request, res: Response) => {
    try {
        // First check if the user is an admin
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        const result = await pool.query('SELECT id, username FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching users.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.delete('/api/users/:userId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        const { userId } = req.params;
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        res.sendStatus(204);
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
});


// --- Game Data Routes ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/game-data', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT key, data FROM game_data');
        const gameData: { [key: string]: any } = {};
        for (const row of result.rows) {
            if (row.key && row.data) {
                gameData[row.key] = row.data;
            }
        }
        res.json(gameData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving game data.' });
    }
});

// --- Admin: Update Game Data ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.put('/api/game-data', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { key, data } = req.body;

        if (!key || data === undefined) {
            return res.status(400).json({ message: 'Key and data are required.' });
        }

        const validKeys = ['locations', 'expeditions', 'enemies', 'settings', 'itemTemplates', 'quests', 'affixes'];
        if (!validKeys.includes(key)) {
            return res.status(400).json({ message: 'Invalid game data key.' });
        }
        
        await pool.query('INSERT INTO game_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = $2', [key, JSON.stringify(data)]);
        
        res.status(200).json({ message: `Game data for '${key}' updated.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error updating game data.' });
    }
});


// --- Ranking Route ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/ranking', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id as id,
                c.data->>'name' as name,
                c.data->>'race' as race,
                (c.data->>'level')::int as level,
                (c.data->>'experience')::bigint as experience,
                (
                    (c.data->>'experience')::bigint + 
                    COALESCE((
                        SELECT sum(floor(100 * pow(i, 1.3)))::bigint
                        FROM generate_series(1, (c.data->>'level')::int - 1) as i
                    ), 0)
                ) as "totalExperience",
                (c.data->>'pvpWins')::int as "pvpWins",
                (c.data->>'pvpLosses')::int as "pvpLosses",
                (c.data->>'pvpProtectionUntil')::bigint as "pvpProtectionUntil",
                EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = c.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
            FROM characters c
            ORDER BY "totalExperience" DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching ranking.' });
    }
});

// --- Trader Routes ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/trader/inventory', authenticateToken, async (req: Request, res: Response) => {
    const forceRefresh = req.query.force === 'true';

    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        const isAdmin = userRes.rows[0]?.username === 'Kazujoshi';

        const currentHour = new Date().getUTCHours();
        if (forceRefresh && !isAdmin) {
             return res.status(403).json({ message: 'Forbidden' });
        }

        if (forceRefresh || traderInventoryCache.lastRefreshedHour !== currentHour) {
            const gameDataRes = await pool.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'settings', 'affixes')");
            const allItemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const settings = gameDataRes.rows.find(r => r.key === 'settings')?.data || { language: 'pl' };
            const allAffixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

            traderInventoryCache.inventory = generateTraderInventory(allItemTemplates, allAffixes, settings);
            traderInventoryCache.lastRefreshedHour = currentHour;
        }

        res.json(traderInventoryCache.inventory);
    } catch(err) {
         console.error('Error fetching trader inventory:', err);
        res.status(500).json({ message: 'Server error fetching trader inventory.' });
    }
});

// --- Trader: Buy Item ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/trader/buy', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { itemId } = req.body;
    if (!itemId) {
        return res.status(400).json({ message: 'Item ID is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch all game data needed
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const allItemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const allAffixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        // Find the item in the server's trader inventory cache
        const itemToBuy = traderInventoryCache.inventory.find(i => i.uniqueId === itemId);
        if (!itemToBuy) {
            return res.status(404).json({ message: 'Item not found in trader inventory.' });
        }

        const template = allItemTemplates.find(t => t.id === itemToBuy.templateId);
        if (!template) {
            return res.status(500).json({ message: 'Item template not found.' });
        }

        // Calculate cost (template value + affix values) * 2
        let itemValue = template.value;
        if (itemToBuy.prefixId) {
            const prefix = allAffixes.find(a => a.id === itemToBuy.prefixId);
            if (prefix && prefix.value) {
                itemValue += prefix.value;
            }
        }
        if (itemToBuy.suffixId) {
            const suffix = allAffixes.find(a => a.id === itemToBuy.suffixId);
            if (suffix && suffix.value) {
                itemValue += suffix.value;
            }
        }
        const cost = itemValue * 2;

        // Fetch character data
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        // Check inventory space and gold
        if (character.inventory.length >= getBackpackCapacity(character)) {
            return res.status(400).json({ message: 'Inventory is full.' });
        }
        if (character.resources.gold < cost) {
            return res.status(400).json({ message: 'Not enough gold.' });
        }

        // Update character
        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);
        // Add a record of the purchase to prevent immediate re-listing if the trader refreshes.
        character.traderPurchases = [...(character.traderPurchases || []), itemToBuy.uniqueId];


        // Update trader inventory
        traderInventoryCache.inventory = traderInventoryCache.inventory.filter(i => i.uniqueId !== itemId);

        // Save character
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);

        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error buying item:', err);
        res.status(500).json({ message: 'Server error while buying item.' });
    }
});

// --- Trader: Sell Items ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/trader/sell', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { itemIds } = req.body as { itemIds: string[] };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: 'Item IDs must be a non-empty array.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const allItemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const allAffixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        let totalValue = 0;
        const itemsToKeep: ItemInstance[] = [];
        const soldItemIds = new Set(itemIds);

        for (const item of character.inventory) {
            if (soldItemIds.has(item.uniqueId)) {
                const template = allItemTemplates.find(t => t.id === item.templateId);
                let itemValue = template?.value || 0;
                if (item.prefixId) {
                    const prefix = allAffixes.find(a => a.id === item.prefixId);
                    itemValue += prefix?.value || 0;
                }
                if (item.suffixId) {
                    const suffix = allAffixes.find(a => a.id === item.suffixId);
                    itemValue += suffix?.value || 0;
                }
                totalValue += itemValue;
            } else {
                itemsToKeep.push(item);
            }
        }

        if (soldItemIds.size !== itemIds.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'One or more items to sell were not found in your inventory.' });
        }

        character.inventory = itemsToKeep;
        character.resources.gold += totalValue;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');

        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error selling items:', err);
        res.status(500).json({ message: 'Server error while selling items.' });
    }
});


// --- PvP Route ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/pvp/attack/:defenderId', authenticateToken, async (req: Request, res: Response) => {
    const attackerId = req.user!.id;
    const { defenderId } = req.params;

    if (attackerId === parseInt(defenderId)) {
        return res.status(400).json({ message: 'You cannot attack yourself.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Fetch attacker and defender data
        const attackerRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [attackerId]);
        const defenderRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [defenderId]);

        if (attackerRes.rows.length === 0 || defenderRes.rows.length === 0) {
            return res.status(404).json({ message: 'Player not found.' });
        }
        let attacker: PlayerCharacter = attackerRes.rows[0].data;
        let defender: PlayerCharacter = defenderRes.rows[0].data;
        
        // Validation
        if (Math.abs(attacker.level - defender.level) > 3) {
            return res.status(400).json({ message: 'You can only attack players within +/- 3 levels.' });
        }
        if (attacker.stats.currentEnergy < 3) {
            return res.status(400).json({ message: 'Not enough energy to attack (costs 3).' });
        }
        if (defender.pvpProtectionUntil > Date.now()) {
             const timeLeft = Math.ceil((defender.pvpProtectionUntil - Date.now()) / 1000 / 60);
             return res.status(400).json({ message: `This player is protected from attacks for another ${timeLeft} minutes.` });
        }

        // Deduct energy
        attacker.stats.currentEnergy -= 3;
        
        // Fetch game data for combat simulation
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'settings', 'affixes')");
        const allItemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const allAffixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        const settings: GameSettings = gameDataRes.rows.find(r => r.key === 'settings')?.data || { language: 'pl', pvpProtectionMinutes: 60 };

        // Simulate fight
        const { isVictory, combatLog, finalAttackerHealth, finalAttackerMana, finalDefenderHealth, finalDefenderMana, initialDerivedAttacker, initialDerivedDefender } = simulatePvpFight(attacker, defender, allItemTemplates, allAffixes);

        attacker.stats.currentHealth = finalAttackerHealth;
        attacker.stats.currentMana = finalAttackerMana;
        defender.stats.currentHealth = finalDefenderHealth;
        defender.stats.currentMana = finalDefenderMana;

        let goldStolen = 0;
        let xpGained = 0;

        if (isVictory) {
            goldStolen = Math.min(defender.resources.gold, Math.floor(defender.level * 100 * Math.random()));
            xpGained = Math.floor(defender.level * 20 * (1 + Math.random()));

            attacker.resources.gold += goldStolen;
            attacker.experience += xpGained;
            attacker.pvpWins = (attacker.pvpWins || 0) + 1;

            defender.resources.gold -= goldStolen;
            defender.pvpLosses = (defender.pvpLosses || 0) + 1;
        } else {
            // No penalties for attacker on loss, except energy cost
            attacker.pvpLosses = (attacker.pvpLosses || 0) + 1;
            defender.pvpWins = (defender.pvpWins || 0) + 1;
        }
        
        // Level up check for attacker
        const oldLevel = attacker.level;
        while (attacker.experience >= attacker.experienceToNextLevel) {
            attacker.experience -= attacker.experienceToNextLevel;
            attacker.level += 1;
            attacker.stats.statPoints += 1;
            attacker.experienceToNextLevel = Math.floor(100 * Math.pow(attacker.level, 1.3));
        }
        if (oldLevel < 10 && attacker.level >= 10 && !attacker.characterClass) {
            const subject = 'Czas wybrać klasę!';
            const body = 'Gratulacje! Osiągnąłeś 10 poziom. Możesz teraz wybrać klasę dla swojej postaci w zakładce Statystyki -> Ścieżka rozwoju. Wybierz mądrze, ponieważ ten wybór jest ostateczny!';
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', $2, $3)`,
                [attackerId, subject, JSON.stringify({ content: body })]
            );
        }

        // Apply PvP protection
        const protectionMinutes = settings.pvpProtectionMinutes || 60;
        const now = Date.now();
        attacker.pvpProtectionUntil = now + protectionMinutes * 60 * 1000;
        defender.pvpProtectionUntil = now + protectionMinutes * 60 * 1000;
        
        // Update both characters in DB
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(attacker), attackerId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(defender), defenderId]);

        // Create reward summary and send messages
        const summary: PvpRewardSummary = {
            gold: goldStolen,
            experience: xpGained,
            combatLog,
            isVictory,
            attacker: initialDerivedAttacker,
            defender: initialDerivedDefender,
        };
        
        // Message to defender
        await client.query(
            'INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body) VALUES ($1, $2, $3, $4, $5, $6)',
            [defenderId, attackerId, attacker.name, 'pvp_report', `You have been attacked by ${attacker.name}!`, JSON.stringify(summary)]
        );
        
        await client.query('COMMIT');
        res.json({ summary, updatedAttacker: attacker });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during PvP attack:', err);
        res.status(500).json({ message: 'Server error during attack.' });
    } finally {
        client.release();
    }
});


// --- Message Routes ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/messages', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    try {
        const result = await pool.query('SELECT * FROM messages WHERE recipient_id = $1 ORDER BY created_at DESC', [userId]);
        res.json(result.rows);
    } catch(err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ message: 'Failed to fetch messages.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/messages', authenticateToken, async (req: Request, res: Response) => {
    const senderId = req.user!.id;
    const { recipientName, subject, content } = req.body;

    if (!recipientName || !subject || !content) {
        return res.status(400).json({ message: 'Recipient, subject, and content are required.' });
    }

    try {
        const senderRes = await pool.query(`SELECT data->>'name' as name FROM characters WHERE user_id = $1`, [senderId]);
        if (senderRes.rows.length === 0) return res.status(404).json({ message: 'Sender character not found.' });
        const senderName = senderRes.rows[0].name;

        const recipientRes = await pool.query(`SELECT user_id FROM characters WHERE data->>'name' = $1`, [recipientName]);
        if (recipientRes.rows.length === 0) {
            return res.status(404).json({ message: 'Recipient not found.' });
        }
        const recipientId = recipientRes.rows[0].user_id;
        
        const messageBody = { content };
        
        const result = await pool.query(
            `INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body) VALUES ($1, $2, $3, 'player_message', $4, $5) RETURNING *`,
            [recipientId, senderId, senderName, subject, JSON.stringify(messageBody)]
        );
        
        res.status(201).json(result.rows[0]);
    } catch(err) {
         console.error("Error sending message:", err);
        res.status(500).json({ message: 'Failed to send message.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.put('/api/messages/:id', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;
    const { is_read } = req.body;

    try {
        await pool.query('UPDATE messages SET is_read = $1 WHERE id = $2 AND recipient_id = $3', [is_read, id, userId]);
        res.sendStatus(204);
    } catch(err) {
        console.error("Error updating message:", err);
        res.status(500).json({ message: 'Failed to update message.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.delete('/api/messages/:id', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM messages WHERE id = $1 AND recipient_id = $2', [id, userId]);
        res.sendStatus(204);
    } catch (err) {
        console.error("Error deleting message:", err);
        res.status(500).json({ message: 'Failed to delete message.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/admin/global-message', authenticateToken, async (req: Request, res: Response) => {
    const { subject, content } = req.body;
    
    const client = await pool.connect();
    try {
        const adminRes = await client.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') return res.status(403).json({ message: 'Forbidden' });
        
        if (!subject || !content) return res.status(400).json({ message: 'Subject and content are required.' });

        const usersRes = await client.query('SELECT id FROM users');
        const userIds: number[] = usersRes.rows.map(r => r.id);

        await client.query('BEGIN');
        for (const userId of userIds) {
             await client.query(`
                INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, null, 'Administrator', 'player_message', subject, JSON.stringify({ content })]);
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Global message sent to all users.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error sending global message:", err);
        res.status(500).json({ message: 'Failed to send global message.' });
    } finally {
        client.release();
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/messages/claim-return/:id', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const messageId = parseInt(req.params.id, 10);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const msgRes = await client.query('SELECT * FROM messages WHERE id = $1 AND recipient_id = $2 FOR UPDATE', [messageId, userId]);
        if (msgRes.rows.length === 0) {
            throw new Error('Message not found or you do not have permission to access it.');
        }
        const message = msgRes.rows[0];
        const messageBody = message.body as MarketNotificationBody;

        if (message.message_type !== 'market_notification' || messageBody.type !== 'ITEM_RETURNED' || !messageBody.item) {
            throw new Error('This message does not contain a returnable item.');
        }
        
        if (messageBody.listingId) {
            const listingCheck = await client.query('SELECT status FROM market_listings WHERE id = $1 FOR UPDATE', [messageBody.listingId]);
            if (listingCheck.rows.length === 0 || listingCheck.rows[0].status === 'CLAIMED') {
                await client.query('DELETE FROM messages WHERE id = $1', [messageId]);
                const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
                await client.query('COMMIT');
                return res.json(charRes.rows[0].data);
            }
        }

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        let character: PlayerCharacter = charRes.rows[0].data;

        if (character.inventory.length >= getBackpackCapacity(character)) {
            throw new Error('Your inventory is full. Cannot claim item.');
        }
        
        const itemToClaim = messageBody.item!;
        character.inventory.push(itemToClaim);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        
        if (messageBody.listingId) {
            await client.query("UPDATE market_listings SET status = 'CLAIMED', updated_at = NOW() WHERE id = $1", [messageBody.listingId]);
        }

        await client.query('DELETE FROM messages WHERE id = $1', [messageId]);

        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error claiming market return:', err);
        res.status(400).json({ message: err.message || 'Failed to claim item.' });
    } finally {
        client.release();
    }
});


// --- Tavern (Chat) ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/tavern/messages', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM tavern_messages ORDER BY created_at ASC LIMIT 100');
        res.json(result.rows);
    } catch(err) {
        console.error("Error fetching tavern messages:", err);
        res.status(500).json({ message: 'Failed to fetch tavern messages.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/tavern/messages', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: 'Content is required.' });
    }
    
    try {
        const charRes = await pool.query(`SELECT data->>'name' as name FROM characters WHERE user_id = $1`, [userId]);
        if (charRes.rows.length === 0) return res.status(404).json({ message: 'Character not found.' });
        const characterName = charRes.rows[0].name;

        const result = await pool.query(
            `INSERT INTO tavern_messages (user_id, character_name, content) VALUES ($1, $2, $3) RETURNING *`,
            [userId, characterName, content.trim()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error sending tavern message:", err);
        res.status(500).json({ message: 'Failed to send tavern message.' });
    }
});

// --- Market Routes ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/market/listings', authenticateToken, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await processExpiredListings(client);
        const result = await client.query(`
            SELECT 
                ml.id,
                ml.seller_id,
                seller.data->>'name' as seller_name,
                ml.item_data,
                ml.listing_type,
                ml.currency,
                ml.buy_now_price,
                ml.start_bid_price,
                ml.current_bid_price,
                ml.highest_bidder_id,
                bidder.data->>'name' as highest_bidder_name,
                ml.created_at,
                ml.expires_at,
                ml.status,
                (SELECT COUNT(DISTINCT bidder_id) FROM market_bids mb WHERE mb.listing_id = ml.id) as bid_count
            FROM market_listings ml
            JOIN characters seller ON ml.seller_id = seller.user_id
            LEFT JOIN characters bidder ON ml.highest_bidder_id = bidder.user_id
            WHERE ml.status = 'ACTIVE' AND ml.expires_at > NOW()
            ORDER BY ml.created_at DESC
        `);
        await client.query('COMMIT');
        
        const listings: MarketListing[] = result.rows.map(row => ({
            id: row.id,
            seller_id: row.seller_id,
            seller_name: row.seller_name,
            item_data: row.item_data,
            listing_type: row.listing_type,
            currency: row.currency,
            buy_now_price: row.buy_now_price ? parseInt(row.buy_now_price, 10) : undefined,
            start_bid_price: row.start_bid_price ? parseInt(row.start_bid_price, 10) : undefined,
            current_bid_price: row.current_bid_price ? parseInt(row.current_bid_price, 10) : undefined,
            highest_bidder_id: row.highest_bidder_id,
            highest_bidder_name: row.highest_bidder_name,
            created_at: row.created_at,
            expires_at: row.expires_at,
            status: row.status,
            bid_count: parseInt(row.bid_count, 10),
        }));

        res.json(listings);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error fetching market listings:", err);
        res.status(500).json({ message: 'Failed to fetch market listings.' });
    } finally {
        client.release();
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/market/buy', authenticateToken, async (req: Request, res: Response) => {
    const buyerId = req.user!.id;
    const { listingId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const listingRes = await client.query('SELECT * FROM market_listings WHERE id = $1 FOR UPDATE', [listingId]);
        if (listingRes.rows.length === 0) {
            throw new Error('Listing not found.');
        }
        const listing = listingRes.rows[0];

        if (listing.status !== 'ACTIVE' || new Date(listing.expires_at) < new Date()) {
            throw new Error('This listing is no longer active.');
        }
        if (listing.listing_type !== 'buy_now' || !listing.buy_now_price) {
            throw new Error('This item is not for immediate sale.');
        }
        if (listing.seller_id === buyerId) {
            throw new Error('You cannot buy your own item.');
        }

        const buyerRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [buyerId]);
        let buyerChar: PlayerCharacter = buyerRes.rows[0].data;

        if (buyerChar.inventory.length >= getBackpackCapacity(buyerChar)) {
            throw new Error('Your inventory is full.');
        }

        if (listing.currency === 'gold') {
            if (buyerChar.resources.gold < listing.buy_now_price) throw new Error('Not enough gold.');
            buyerChar.resources.gold -= listing.buy_now_price;
        } else {
            if ((buyerChar.resources[listing.currency as EssenceType] || 0) < listing.buy_now_price) throw new Error('Not enough essence.');
            buyerChar.resources[listing.currency as EssenceType] -= listing.buy_now_price;
        }

        buyerChar.inventory.push(listing.item_data);

        const sellerRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [listing.seller_id]);
        let sellerChar: PlayerCharacter = sellerRes.rows[0].data;

        if (listing.currency === 'gold') {
            sellerChar.resources.gold += listing.buy_now_price;
        } else {
            sellerChar.resources[listing.currency as EssenceType] += listing.buy_now_price;
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(buyerChar), buyerId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(sellerChar), listing.seller_id]);
        await client.query("UPDATE market_listings SET status = 'SOLD' WHERE id = $1", [listingId]);
        
        const gameDataResForName = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const allItemTemplatesForName: ItemTemplate[] = gameDataResForName.rows[0]?.data || [];
        const soldItemTemplate = allItemTemplatesForName.find(t => t.id === listing.item_data.templateId);

        // Notification for the seller
        const sellerNotificationBody: MarketNotificationBody = {
            type: 'SOLD',
            itemName: soldItemTemplate?.name || 'Unknown Item',
            price: parseInt(listing.buy_now_price, 10),
            currency: listing.currency,
            item: listing.item_data
        };

        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                VALUES ($1, 'Rynek', 'market_notification', 'Przedmiot sprzedany!', $2)`,
            [listing.seller_id, JSON.stringify(sellerNotificationBody)]
        );

        // Notification for the buyer
        const buyerNotificationBody: MarketNotificationBody = {
            type: 'BOUGHT',
            itemName: soldItemTemplate?.name || 'Unknown Item',
            price: parseInt(listing.buy_now_price, 10),
            currency: listing.currency,
            item: listing.item_data
        };

        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                VALUES ($1, 'Rynek', 'market_notification', 'Przedmiot zakupiony!', $2)`,
            [buyerId, JSON.stringify(buyerNotificationBody)]
        );

        await client.query('COMMIT');
        res.json(buyerChar);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error buying market item:', err);
        res.status(400).json({ message: err.message || 'Failed to buy item.' });
    } finally {
        client.release();
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/market/bid', authenticateToken, async (req: Request, res: Response) => {
    const bidderId = req.user!.id;
    const { listingId, amount } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const listingRes = await client.query('SELECT * FROM market_listings WHERE id = $1 FOR UPDATE', [listingId]);
        if (listingRes.rows.length === 0) throw new Error('Listing not found.');
        const listing = listingRes.rows[0];

        if (listing.status !== 'ACTIVE' || new Date(listing.expires_at) < new Date()) throw new Error('This auction has ended.');
        if (listing.listing_type !== 'auction') throw new Error('This item is not up for auction.');
        if (listing.seller_id === bidderId) throw new Error('You cannot bid on your own item.');

        const minBid = listing.current_bid_price ? parseInt(listing.current_bid_price, 10) + 1 : parseInt(listing.start_bid_price, 10);
        if (amount < minBid) throw new Error(`Bid is too low. Minimum bid is ${minBid}.`);

        const bidderRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [bidderId]);
        const bidderChar: PlayerCharacter = bidderRes.rows[0].data;

        if (listing.currency === 'gold') {
            if (bidderChar.resources.gold < amount) throw new Error('Not enough gold.');
        } else {
            if ((bidderChar.resources[listing.currency as EssenceType] || 0) < amount) throw new Error('Not enough essence.');
        }
        
        await client.query('INSERT INTO market_bids (listing_id, bidder_id, amount) VALUES ($1, $2, $3)', [listingId, bidderId, amount]);
        await client.query('UPDATE market_listings SET current_bid_price = $1, highest_bidder_id = $2 WHERE id = $3', [amount, bidderId, listingId]);
        
        await client.query('COMMIT');
        
        const updatedListingRes = await client.query(`
            SELECT 
                ml.id, ml.seller_id, seller.data->>'name' as seller_name, ml.item_data, ml.listing_type, ml.currency,
                ml.buy_now_price, ml.start_bid_price, ml.current_bid_price, ml.highest_bidder_id,
                bidder.data->>'name' as highest_bidder_name, ml.created_at, ml.expires_at, ml.status,
                (SELECT COUNT(DISTINCT bidder_id) FROM market_bids mb WHERE mb.listing_id = ml.id) as bid_count
            FROM market_listings ml
            JOIN characters seller ON ml.seller_id = seller.user_id
            LEFT JOIN characters bidder ON ml.highest_bidder_id = bidder.user_id
            WHERE ml.id = $1
        `, [listingId]);
        
        const row = updatedListingRes.rows[0];
        const updatedListing: MarketListing = {
            id: row.id,
            seller_id: row.seller_id,
            seller_name: row.seller_name,
            item_data: row.item_data,
            listing_type: row.listing_type,
            currency: row.currency,
            buy_now_price: row.buy_now_price ? parseInt(row.buy_now_price, 10) : undefined,
            start_bid_price: row.start_bid_price ? parseInt(row.start_bid_price, 10) : undefined,
            current_bid_price: row.current_bid_price ? parseInt(row.current_bid_price, 10) : undefined,
            highest_bidder_id: row.highest_bidder_id,
            highest_bidder_name: row.highest_bidder_name,
            created_at: row.created_at,
            expires_at: row.expires_at,
            status: row.status,
            bid_count: parseInt(row.bid_count, 10),
        };
        
        res.json(updatedListing);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error placing bid:', err);
        res.status(400).json({ message: err.message || 'Failed to place bid.' });
    } finally {
        client.release();
    }
});

// --- Admin Routes ---
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/admin/pvp/reset-cooldowns', authenticateToken, async (req: Request, res: Response) => {
     try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') return res.status(403).json({ message: 'Forbidden' });
        
        await pool.query(`UPDATE characters SET data = data || jsonb_build_object('pvpProtectionUntil', 0)`);
        res.sendStatus(200);

    } catch (err) {
        console.error("Error resetting PvP cooldowns:", err);
        res.status(500).json({ message: 'Failed to reset cooldowns.' });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/market/listings', authenticateToken, async (req: Request, res: Response) => {
    const sellerId = req.user!.id;
    const { itemId, listingType, currency, price, durationHours } = req.body as {
        itemId: string;
        listingType: ListingType;
        currency: CurrencyType;
        price: number;
        durationHours: number;
    };

    if (!itemId || !listingType || !currency || !price || !durationHours) {
        return res.status(400).json({ message: 'Missing required fields for creating a listing.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [sellerId]);
        if (charRes.rows.length === 0) {
            throw new Error('Character not found.');
        }
        let character: PlayerCharacter = charRes.rows[0].data;

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) {
            throw new Error('Item not found in your inventory.');
        }
        const itemToSell = character.inventory[itemIndex];
        character.inventory.splice(itemIndex, 1);

        const expires_at = new Date(Date.now() + durationHours * 60 * 60 * 1000);

        const query = {
            text: `INSERT INTO market_listings 
                    (seller_id, item_data, listing_type, currency, buy_now_price, start_bid_price, expires_at, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE') RETURNING id`,
            values: [
                sellerId,
                JSON.stringify(itemToSell),
                listingType,
                currency,
                listingType === 'buy_now' ? price : null,
                listingType === 'auction' ? price : null,
                expires_at
            ]
        };
        await client.query(query);

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), sellerId]);

        await client.query('COMMIT');
        res.json(character);

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error creating market listing:', err);
        res.status(500).json({ message: err.message || 'Failed to create listing.' });
    } finally {
        client.release();
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/market/my-listings', authenticateToken, async (req: Request, res: Response) => {
    const sellerId = req.user!.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await processExpiredListings(client);
        const result = await client.query(`
            SELECT 
                ml.*,
                seller.data->>'name' as seller_name,
                bidder.data->>'name' as highest_bidder_name,
                (SELECT COUNT(DISTINCT bidder_id) FROM market_bids mb WHERE mb.listing_id = ml.id) as bid_count
            FROM market_listings ml
            JOIN characters seller ON ml.seller_id = seller.user_id
            LEFT JOIN characters bidder ON ml.highest_bidder_id = bidder.user_id
            WHERE ml.seller_id = $1 AND (ml.status != 'CLAIMED' OR ml.updated_at > NOW() - INTERVAL '12 hours')
            ORDER BY
                CASE ml.status
                    WHEN 'ACTIVE' THEN 1
                    WHEN 'SOLD' THEN 2
                    WHEN 'EXPIRED' THEN 3
                    WHEN 'CANCELLED' THEN 4
                    WHEN 'CLAIMED' THEN 5
                    ELSE 6
                END,
                ml.created_at DESC
        `, [sellerId]);
        await client.query('COMMIT');
        
         const listings: MarketListing[] = result.rows.map(row => ({
            id: row.id,
            seller_id: row.seller_id,
            seller_name: row.seller_name,
            item_data: row.item_data,
            listing_type: row.listing_type,
            currency: row.currency,
            buy_now_price: row.buy_now_price ? parseInt(row.buy_now_price, 10) : undefined,
            start_bid_price: row.start_bid_price ? parseInt(row.start_bid_price, 10) : undefined,
            current_bid_price: row.current_bid_price ? parseInt(row.current_bid_price, 10) : undefined,
            highest_bidder_id: row.highest_bidder_id,
            highest_bidder_name: row.highest_bidder_name,
            created_at: row.created_at,
            expires_at: row.expires_at,
            status: row.status,
            bid_count: parseInt(row.bid_count, 10),
        }));
        res.json(listings);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error fetching my market listings:", err);
        res.status(500).json({ message: 'Failed to fetch my listings.' });
    } finally {
        client.release();
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/market/listings/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
    const sellerId = req.user!.id;
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const listingRes = await client.query('SELECT * FROM market_listings WHERE id = $1 FOR UPDATE', [id]);
        if (listingRes.rows.length === 0) throw new Error('Listing not found.');
        const listing = listingRes.rows[0];

        if (listing.seller_id !== sellerId) throw new Error('You do not own this listing.');
        if (listing.status !== 'ACTIVE') throw new Error('Only active listings can be cancelled.');
        if (listing.listing_type === 'auction' && listing.current_bid_price) throw new Error('Cannot cancel an auction that has bids.');

        await client.query("UPDATE market_listings SET status = 'CANCELLED' WHERE id = $1", [id]);

        const gameDataResForName = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const allItemTemplatesForName: ItemTemplate[] = gameDataResForName.rows[0]?.data || [];
        const itemTemplate = allItemTemplatesForName.find(t => t.id === listing.item_data.templateId);

        const notificationBody: MarketNotificationBody = {
            type: 'ITEM_RETURNED',
            itemName: itemTemplate?.name || 'Unknown Item',
            item: listing.item_data,
            listingId: listing.id
        };

        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                VALUES ($1, 'Rynek', 'market_notification', 'Przedmiot zwrócony', $2)`,
            [sellerId, JSON.stringify(notificationBody)]
        );
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [sellerId]);
        const character: PlayerCharacter = charRes.rows[0].data;

        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Error cancelling listing:", err);
        res.status(400).json({ message: err.message || 'Failed to cancel listing.' });
    } finally {
        client.release();
    }
});


// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/market/listings/:id/claim', authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const listingRes = await client.query('SELECT * FROM market_listings WHERE id = $1 FOR UPDATE', [id]);
        if (listingRes.rows.length === 0) throw new Error('Listing not found.');
        const listing = listingRes.rows[0];

        if (listing.seller_id !== userId) throw new Error('You do not own this listing.');
        if (listing.status === 'ACTIVE' || listing.status === 'CLAIMED') throw new Error('This listing cannot be claimed at this time.');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        let character: PlayerCharacter = charRes.rows[0].data;

        if (listing.status === 'SOLD') {
            const gameDataRes = await client.query("SELECT data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
            const allItemTemplates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const allAffixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

            const item: ItemInstance = listing.item_data;
            const template = allItemTemplates.find(t => t.id === item.templateId);
            let itemValue = template?.value || 0;
            // Add affix values if they exist
            if (item.prefixId) itemValue += allAffixes.find(a => a.id === item.prefixId)?.value || 0;
            if (item.suffixId) itemValue += allAffixes.find(a => a.id === item.suffixId)?.value || 0;
            
            const commission = Math.ceil(itemValue * 0.15);
            const price = listing.listing_type === 'buy_now' ? listing.buy_now_price : listing.current_bid_price;
            
            let netGain = parseInt(price, 10);
            if (listing.currency === 'gold') {
                netGain -= commission;
                character.resources.gold += Math.max(0, netGain);
            } else {
                character.resources[listing.currency as EssenceType] = (character.resources[listing.currency as EssenceType] || 0) + netGain;
                // Commission is always paid in gold
                character.resources.gold -= commission;
            }
        } else if (listing.status === 'EXPIRED' || listing.status === 'CANCELLED') {
             if (character.inventory.length >= getBackpackCapacity(character)) throw new Error('Your inventory is full. Cannot retrieve item.');
             character.inventory.push(listing.item_data);
        }

        await client.query("UPDATE market_listings SET status = 'CLAIMED', updated_at = NOW() WHERE id = $1", [id]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);

        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Error claiming listing:", err);
        res.status(400).json({ message: err.message || 'Failed to claim listing.' });
    } finally {
        client.release();
    }
});

// Admin duplication audit route
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('/api/admin/audit/duplicates', authenticateToken, async (req: Request, res: Response) => {
    try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const client = await pool.connect();
        try {
            const itemMap = new Map<string, { templateId: string, instances: DuplicationInfo[] }>();

            const templatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
            const allItemTemplates: ItemTemplate[] = templatesRes.rows[0]?.data || [];

            const charactersRes = await client.query("SELECT user_id, data->>'name' as name, data FROM characters");
            for (const row of charactersRes.rows) {
                const character: PlayerCharacter = row.data;
                const ownerName = character.name;
                const userId = row.user_id;

                for (const item of character.inventory) {
                    if (!itemMap.has(item.uniqueId)) {
                        itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                    }
                    itemMap.get(item.uniqueId)!.instances.push({ ownerName, location: 'inventory', userId });
                }

                for (const slot in character.equipment) {
                    const item = character.equipment[slot as EquipmentSlot];
                    if (item) {
                        if (!itemMap.has(item.uniqueId)) {
                            itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                        }
                        itemMap.get(item.uniqueId)!.instances.push({ ownerName, location: `equipment.${slot}`, userId });
                    }
                }
            }
            
            const marketRes = await client.query("SELECT id, item_data, seller_id, status FROM market_listings WHERE status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')");
            for (const row of marketRes.rows) {
                const item: ItemInstance = row.item_data;
                const sellerId = row.seller_id;
                const sellerName = charactersRes.rows.find(c => c.user_id === sellerId)?.name || 'Unknown';
                 if (!itemMap.has(item.uniqueId)) {
                    itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                }
                itemMap.get(item.uniqueId)!.instances.push({ ownerName: sellerName, location: `market.${row.id}`, userId: sellerId });
            }
            
            const messagesRes = await client.query("SELECT id, body, recipient_id FROM messages WHERE message_type = 'market_notification' AND body->>'type' = 'ITEM_RETURNED'");
            for (const row of messagesRes.rows) {
                const body: MarketNotificationBody = row.body;
                if (body.item) {
                    const item = body.item;
                    const recipientId = row.recipient_id;
                    const recipientName = charactersRes.rows.find(c => c.user_id === recipientId)?.name || 'Unknown';
                    if (!itemMap.has(item.uniqueId)) {
                        itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                    }
                    itemMap.get(item.uniqueId)!.instances.push({ ownerName: recipientName, location: `mailbox.${row.id}`, userId: recipientId });
                }
            }

            const duplicates: DuplicationAuditResult[] = [];
            for (const [uniqueId, data] of itemMap.entries()) {
                if (data.instances.length > 1) {
                    const template = allItemTemplates.find(t => t.id === data.templateId);
                    duplicates.push({
                        uniqueId,
                        templateId: data.templateId,
                        itemName: template?.name || 'Unknown Item',
                        gender: template?.gender || GrammaticalGender.Masculine,
                        instances: data.instances,
                    });
                }
            }

            res.json(duplicates);
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('Duplication audit error:', err);
        res.status(500).json({ message: err.message });
    }
});

// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.post('/api/admin/resolve-duplicates', authenticateToken, async (req: Request, res: Response) => {
    try {
        const adminRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (adminRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const itemMap = new Map<string, { templateId: string, instances: DuplicationInfo[] }>();
            const charactersRes = await client.query("SELECT user_id, data->>'name' as name, data FROM characters");
            const allCharactersData = new Map<number, { name: string; data: PlayerCharacter }>();
            charactersRes.rows.forEach(r => allCharactersData.set(r.user_id, { name: r.name, data: r.data }));

            // 1. GATHER ALL ITEMS
            for (const [userId, charInfo] of allCharactersData.entries()) {
                const character = charInfo.data;
                const ownerName = charInfo.name;
                
                for (const item of character.inventory) {
                    if (!itemMap.has(item.uniqueId)) itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                    itemMap.get(item.uniqueId)!.instances.push({ ownerName, location: 'inventory', userId });
                }
                for (const slot in character.equipment) {
                    const item = character.equipment[slot as EquipmentSlot];
                    if (item) {
                        if (!itemMap.has(item.uniqueId)) itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                        itemMap.get(item.uniqueId)!.instances.push({ ownerName, location: `equipment.${slot}`, userId });
                    }
                }
            }
            const marketRes = await client.query("SELECT id, item_data, seller_id, status FROM market_listings WHERE status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')");
            for (const row of marketRes.rows) {
                const item: ItemInstance = row.item_data;
                const sellerId = row.seller_id;
                const sellerName = allCharactersData.get(sellerId)?.name || 'Unknown';
                 if (!itemMap.has(item.uniqueId)) {
                    itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                }
                itemMap.get(item.uniqueId)!.instances.push({ ownerName: sellerName, location: `market.${row.id}`, userId: sellerId });
            }
            const messagesRes = await client.query("SELECT id, body, recipient_id FROM messages WHERE message_type = 'market_notification' AND body->>'type' = 'ITEM_RETURNED'");
            for (const row of messagesRes.rows) {
                const body: MarketNotificationBody = row.body;
                if (body.item) {
                    const item = body.item;
                    const recipientId = row.recipient_id;
                    const recipientName = allCharactersData.get(recipientId)?.name || 'Unknown';
                    if (!itemMap.has(item.uniqueId)) {
                        itemMap.set(item.uniqueId, { templateId: item.templateId, instances: [] });
                    }
                    itemMap.get(item.uniqueId)!.instances.push({ ownerName: recipientName, location: `mailbox.${row.id}`, userId: recipientId });
                }
            }

            // 2. IDENTIFY DUPLICATES
            const duplicates = Array.from(itemMap.entries()).filter(([, d]) => d.instances.length > 1);
            let itemsDeleted = 0;

            // 3. RESOLVE DUPLICATES
            const priority = ['equipment', 'market', 'inventory', 'mailbox'];
            for (const [uniqueId, dupSet] of duplicates) {
                let bestInstance: DuplicationInfo | null = null;
                let bestPriority = Infinity;

                for (const instance of dupSet.instances) {
                    const currentPriority = priority.findIndex(p => instance.location.startsWith(p));
                    if (currentPriority !== -1 && currentPriority < bestPriority) {
                        bestPriority = currentPriority;
                        bestInstance = instance;
                    }
                }
                if (!bestInstance) bestInstance = dupSet.instances[0];

                const instancesToDelete = dupSet.instances.filter(i => i !== bestInstance);

                for (const inst of instancesToDelete) {
                    const [locationType, id] = inst.location.split('.');
                    const characterData = allCharactersData.get(inst.userId)?.data;
                    if (!characterData) continue;

                    let modified = false;
                    if (locationType === 'inventory') {
                        const initialLength = characterData.inventory.length;
                        const itemIndex = characterData.inventory.findIndex(i => i.uniqueId === uniqueId);
                        if (itemIndex > -1) {
                            characterData.inventory.splice(itemIndex, 1);
                        }
                        if (characterData.inventory.length < initialLength) modified = true;
                    } else if (locationType === 'equipment') {
                        const slot = id as EquipmentSlot;
                        if (characterData.equipment[slot]?.uniqueId === uniqueId) {
                            characterData.equipment[slot] = null;
                            modified = true;
                        }
                    }
                    
                    if (modified) {
                        allCharactersData.set(inst.userId, { ...allCharactersData.get(inst.userId)!, data: characterData });
                        itemsDeleted++;
                    } else if (locationType === 'market') {
                        await client.query("DELETE FROM market_listings WHERE id = $1", [id]);
                        itemsDeleted++;
                    } else if (locationType === 'mailbox') {
                         await client.query("DELETE FROM messages WHERE id = $1", [id]);
                         itemsDeleted++;
                    }
                }
            }

            // 4. SAVE CHANGES
            for (const [userId, charInfo] of allCharactersData.entries()) {
                 await client.query("UPDATE characters SET data = $1 WHERE user_id = $2", [JSON.stringify(charInfo.data), userId]);
            }

            await client.query('COMMIT');
            res.json({ resolvedSets: duplicates.length, itemsDeleted });

        } catch (err: any) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('Resolve duplicates error:', err);
        res.status(500).json({ message: err.message });
    }
});


// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// FIX: Add explicit types for Express request and response objects to resolve type errors.
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Start the server
// Initialize DB first, then start the server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);

        // --- Periodic Tasks ---
        // Initial cleanup on start
        cleanupOldTavernMessages();
        // Run cleanup every hour
        setInterval(cleanupOldTavernMessages, 1000 * 60 * 60);
    });
}).catch(err => {
    console.error("Failed to initialize database. Server will not start.", err);
    // FIX: Replaced `process.exit(1)` with a call to the imported `exit` function to ensure correct Node.js API usage and prevent type errors in environments with conflicting global types.
    exit(1);
});