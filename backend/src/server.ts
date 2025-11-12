// FIX: Import `ItemLocationInfo` to resolve 'Cannot find name' error for item location tracking in admin audit routes.
import { PlayerCharacter, ItemTemplate, EquipmentSlot, CharacterStats, Race, MagicAttackType, CombatLogEntry, PvpRewardSummary, Enemy, GameSettings, ItemRarity, ItemInstance, Expedition, ExpeditionRewardSummary, RewardSource, LootDrop, ResourceDrop, EssenceType, EnemyStats, Quest, QuestType, PlayerQuestProgress, Affix, RolledAffixStats, AffixType, MarketListing, ListingType, CurrencyType, MarketNotificationBody, DuplicationAuditResult, DuplicationInfo, GrammaticalGender, CharacterClass, OrphanAuditResult, OrphanInfo, ItemLocationInfo, ItemSearchResult } from './types.js';
// FIX: Imported `Request`, `Response`, `NextFunction` from `express` and used them directly
// to resolve a persistent type conflict where fully-qualified type names like `express.Request`
// were not being correctly identified. This fixes numerous errors about missing properties 
// like `.body`, `.status`, `.json`, etc. on request and response objects.
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

// FIX: Removed explicit type to allow TypeScript to infer it from `express()`.
// This avoids potential type conflicts from the import changes.
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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

const rollTemplateStats = (template: ItemTemplate): RolledAffixStats => {
    const rolled: RolledAffixStats = {};

    const rollValue = (minMax: { min: number; max: number } | undefined): number | undefined => {
        if (minMax === undefined || minMax === null) return undefined;
        const min = Math.min(minMax.min, minMax.max);
        const max = Math.max(minMax.min, minMax.max);
        if (min === max) return min;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    if (template.statsBonus) {
        rolled.statsBonus = {};
        for (const key in template.statsBonus) {
            const statKey = key as keyof typeof template.statsBonus;
            const rolledStat = rollValue(template.statsBonus[statKey]);
            if (rolledStat !== undefined) {
                (rolled.statsBonus as any)[statKey] = rolledStat;
            }
        }
        if(Object.keys(rolled.statsBonus).length === 0) {
            delete rolled.statsBonus;
        }
    }
    
    const otherStatKeys: (keyof Omit<RolledAffixStats, 'statsBonus' | 'attacksPerRoundBonus' | 'dodgeChanceBonus'>)[] = [
        'damageMin', 'damageMax', 'armorBonus',
        'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent',
        'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent',
        'manaStealFlat', 'magicDamageMin', 'magicDamageMax'
    ];
    
    for (const key of otherStatKeys) {
        const value = rollValue((template as any)[key]);
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
        rolledBaseStats: rollTemplateStats(template),
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
const calculateDerivedStatsOnServer = (character: PlayerCharacter, itemTemplates: ItemTemplate[], affixes: Affix[]): PlayerCharacter => {
    
    const getMaxValue = (value: number | { min: number; max: number } | undefined): number => {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'object' && 'max' in value) return value.max;
        return 0;
    };

    const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
        strength: Number(character.stats.strength) || 0, 
        agility: Number(character.stats.agility) || 0, 
        accuracy: Number(character.stats.accuracy) || 0,
        stamina: Number(character.stats.stamina) || 0, 
        intelligence: Number(character.stats.intelligence) || 0, 
        energy: Number(character.stats.energy) || 0
    };

    let bonusDamageMin = 0, bonusDamageMax = 0, bonusMagicDamageMin = 0, bonusMagicDamageMax = 0;
    let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0, bonusDodgeChance = 0;
    let bonusAttacksPerRound = 0;
    let bonusCritDamageModifier = 0;
    let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
    let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
    let bonusManaStealPercent = 0, bonusManaStealFlat = 0;

    const applyAffixBonuses = (source: RolledAffixStats) => {
        if (source.statsBonus) {
            for (const stat in source.statsBonus) {
                const key = stat as keyof typeof source.statsBonus;
                totalPrimaryStats[key] = (totalPrimaryStats[key] || 0) + (source.statsBonus[key] || 0);
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
            const upgradeLevel = itemInstance.upgradeLevel || 0;
            const upgradeBonusFactor = upgradeLevel * 0.1;

            // Apply rolled base stats with upgrade bonuses
            if (itemInstance.rolledBaseStats) {
                const baseStats = itemInstance.rolledBaseStats;
                
                if (baseStats.statsBonus) {
                    for (const stat in baseStats.statsBonus) {
                        const key = stat as keyof typeof baseStats.statsBonus;
                        const baseBonus = baseStats.statsBonus[key] || 0;
                        totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                    }
                }
                
                const applyUpgrade = (val: number | undefined) => (val || 0) + Math.round((val || 0) * upgradeBonusFactor);
                
                bonusDamageMin += applyUpgrade(baseStats.damageMin);
                bonusDamageMax += applyUpgrade(baseStats.damageMax);
                bonusMagicDamageMin += applyUpgrade(baseStats.magicDamageMin);
                bonusMagicDamageMax += applyUpgrade(baseStats.magicDamageMax);
                bonusArmor += applyUpgrade(baseStats.armorBonus);
                bonusMaxHealth += applyUpgrade(baseStats.maxHealthBonus);
                bonusCritChance += (baseStats.critChanceBonus || 0) + ((baseStats.critChanceBonus || 0) * upgradeBonusFactor);
            } else if (template) {
                // Fallback for old items without rolledBaseStats
                 if (template.statsBonus) {
                    for (const stat in template.statsBonus) {
                        const key = stat as keyof typeof template.statsBonus;
                        const bonusValue = template.statsBonus[key];
                        const baseBonus = getMaxValue(bonusValue as any);
                        totalPrimaryStats[key] = (totalPrimaryStats[key] || 0) + baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                    }
                }

                const baseDamageMin = getMaxValue(template.damageMin as any);
                const baseDamageMax = getMaxValue(template.damageMax as any);
                const baseMagicDamageMin = getMaxValue(template.magicDamageMin as any);
                const baseMagicDamageMax = getMaxValue(template.magicDamageMax as any);
                const baseArmor = getMaxValue(template.armorBonus as any);
                const baseCritChance = getMaxValue(template.critChanceBonus as any);
                const baseMaxHealth = getMaxValue(template.maxHealthBonus as any);
                
                bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeBonusFactor);
                bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeBonusFactor);
                bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeBonusFactor);
                bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeBonusFactor);
                bonusArmor += baseArmor + Math.round(baseArmor * upgradeBonusFactor);
                bonusCritChance += baseCritChance + (baseCritChance * upgradeBonusFactor);
                bonusMaxHealth += baseMaxHealth + Math.round(baseMaxHealth * upgradeBonusFactor);
            }

            // Apply non-rolled/non-upgraded stats from template
            if (template) {
                bonusCritDamageModifier += getMaxValue(template.critDamageModifierBonus as any);
                bonusArmorPenetrationPercent += getMaxValue(template.armorPenetrationPercent as any);
                bonusArmorPenetrationFlat += getMaxValue(template.armorPenetrationFlat as any);
                bonusLifeStealPercent += getMaxValue(template.lifeStealPercent as any);
                bonusLifeStealFlat += getMaxValue(template.lifeStealFlat as any);
                bonusManaStealPercent += getMaxValue(template.manaStealPercent as any);
                bonusManaStealFlat += getMaxValue(template.manaStealFlat as any);
            }

            if (itemInstance.rolledPrefix) applyAffixBonuses(itemInstance.rolledPrefix);
            if (itemInstance.rolledSuffix) applyAffixBonuses(itemInstance.rolledSuffix);
        }
    }
    
    const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    const baseAttacksPerRound = mainHandTemplate?.attacksPerRound || 1;
    const attacksPerRound = parseFloat((baseAttacksPerRound + bonusAttacksPerRound).toFixed(2));

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

        // Druid bonus
        if (updatedChar.characterClass === CharacterClass.Druid) {
            const derivedStats = calculateDerivedStatsOnServer(updatedChar, allItemTemplates, allAffixes).stats;
            updatedChar.stats.currentHealth = Math.min(derivedStats.maxHealth, updatedChar.stats.currentHealth + derivedStats.maxHealth * 0.5);
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

        // Dungeon Hunter bonus
        if (updatedChar.characterClass === CharacterClass.DungeonHunter && expeditionDetails.lootTable.length > 0) {
            if (Math.random() < 0.5) {
                const extraDrop = expeditionDetails.lootTable[Math.floor(Math.random() * expeditionDetails.lootTable.length)];
                summary.itemsFound.push(createItemInstance(extraDrop.templateId, allItemTemplates, allAffixes));
            }
            if (Math.random() < 0.25) {
                const extraDrop = expeditionDetails.lootTable[Math.floor(Math.random() * expeditionDetails.lootTable.length)];
                summary.itemsFound.push(createItemInstance(extraDrop.templateId, allItemTemplates, allAffixes));
            }
        }
        
        // Apply racial & class bonuses to total
        if (updatedChar.race === Race.Human) {
             totalExperienceWithBonuses = Math.floor(totalExperienceWithBonuses * 1.1);
        }
        if(updatedChar.race === Race.Gnome){
             totalGoldWithBonuses = Math.floor(totalGoldWithBonuses * 1.2);
        }
        if(updatedChar.characterClass === CharacterClass.Thief) {
            totalGoldWithBonuses = Math.floor(totalGoldWithBonuses * 1.25);
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

    let mageManaRestored = false;

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

    // Ranged opening shot helper
    const performAttack = (attackerStats: CharacterStats, defenderStats: EnemyStats, isPlayer: boolean, isCritForced: boolean) => {
        let damage = 0;
        let isCrit = isCritForced;
        let damageReduced = 0;
        let healthGained = 0;
        let manaGained = 0;

        damage = Math.floor(Math.random() * (attackerStats.maxDamage - attackerStats.minDamage + 1)) + attackerStats.minDamage;
        
        if (!isCrit && Math.random() * 100 < attackerStats.critChance) {
            isCrit = true;
        }

        if (isCrit) {
            damage = Math.floor(damage * (attackerStats.critDamageModifier || 200) / 100);
        }

        // Armor Reduction
        let armorPenPercent = isPlayer ? attackerStats.armorPenetrationPercent : 0;
        let armorPenFlat = isPlayer ? attackerStats.armorPenetrationFlat : 0;
        let effectiveArmor = defenderStats.armor * (1 - armorPenPercent / 100) - armorPenFlat;
        effectiveArmor = Math.max(0, effectiveArmor);
        const reduction = Math.floor(effectiveArmor * 0.5);
        damageReduced = Math.min(damage, reduction);
        damage -= damageReduced;

        damage = Math.max(0, damage);
        
        if (isPlayer) {
            healthGained = Math.floor(damage * (attackerStats.lifeStealPercent / 100)) + attackerStats.lifeStealFlat;
            manaGained = Math.floor(damage * (attackerStats.manaStealPercent / 100)) + attackerStats.manaStealFlat;
        }

        return { damage, isCrit, damageReduced, healthGained, manaGained };
    }

    if (mainHandTemplate?.isRanged) {
        // Standard ranged opening attack
        const attack1 = performAttack(playerStats, enemyStats, true, false);
        if(attack1.healthGained > 0) playerHealth = Math.min(playerStats.maxHealth, playerHealth + attack1.healthGained);
        if(attack1.manaGained > 0) playerMana = Math.min(playerStats.maxMana, playerMana + attack1.manaGained);
        enemyHealth -= attack1.damage;
        enemyHealth = Math.max(0, enemyHealth);

        combatLog.push({
            turn: 0, attacker: player.name, defender: initialEnemy.name, action: 'attacks', 
            damage: attack1.damage, isCrit: attack1.isCrit, damageReduced: attack1.damageReduced, 
            healthGained: attack1.healthGained, manaGained: attack1.manaGained, 
            playerHealth, playerMana, enemyHealth, enemyMana,
            weaponName: mainHandTemplate.name,
        });

        // Hunter's bonus second attack
        if (player.characterClass === CharacterClass.Hunter && enemyHealth > 0) {
            let attack2 = performAttack(playerStats, enemyStats, true, false);
            // Hunter bonus shot deals 50% damage
            attack2.damage = Math.floor(attack2.damage * 0.5);
            attack2.healthGained = Math.floor(attack2.healthGained * 0.5);
            attack2.manaGained = Math.floor(attack2.manaGained * 0.5);

            if(attack2.healthGained > 0) playerHealth = Math.min(playerStats.maxHealth, playerHealth + attack2.healthGained);
            if(attack2.manaGained > 0) playerMana = Math.min(playerStats.maxMana, playerMana + attack2.manaGained);

            enemyHealth -= attack2.damage;
            enemyHealth = Math.max(0, enemyHealth);

            combatLog.push({
                turn: 0, attacker: player.name, defender: initialEnemy.name, action: 'attacks', 
                damage: attack2.damage, isCrit: attack2.isCrit, damageReduced: attack2.damageReduced, 
                healthGained: attack2.healthGained, manaGained: attack2.manaGained, 
                playerHealth, playerMana, enemyHealth, enemyMana,
                weaponName: mainHandTemplate.name,
            });
        }
    }
    
    let turn = 1; // Round counter
    let isFirstAttackOfTurnForPlayer = true;
    while (playerHealth > 0 && enemyHealth > 0 && turn < 50) {
        // --- Round Start ---
        isFirstAttackOfTurnForPlayer = true;
        
        // Shaman Bonus
        if (player.characterClass === CharacterClass.Shaman && playerMana > 0) {
            const shamanDamage = Math.floor(playerMana);
            enemyHealth -= shamanDamage;
            enemyHealth = Math.max(0, enemyHealth);
            combatLog.push({ turn, attacker: player.name, defender: initialEnemy.name, action: 'attacks', damage: shamanDamage, magicAttackType: MagicAttackType.ShadowBolt, playerHealth, playerMana, enemyHealth, enemyMana });
            if (enemyHealth <= 0) break;
        }

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
            let attacker: { name: string, stats: CharacterStats | EnemyStats, race?: Race, characterClass?: CharacterClass | null };
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
                
                // Warrior Bonus
                const isWarriorCrit = isPlayerTurn && (attacker.characterClass === CharacterClass.Warrior) && isFirstAttackOfTurnForPlayer;

                // Dodge Check
                const baseDodge = (defenderStats as CharacterStats).dodgeChance || 0;
                const racialDodge = defender.race === Race.Gnome ? 10 : 0;
                const agilityDiff = defenderStats.agility - ((attackerStats as CharacterStats).accuracy || 0);
                const agilityDodge = Math.max(0, agilityDiff * 0.1);

                if (!isWarriorCrit && Math.random() * 100 < (baseDodge + racialDodge + agilityDodge)) {
                    isDodge = true;
                }

                if(isDodge) {
                    combatLog.push({ turn, attacker: attacker.name, defender: defender.name, action: 'attacks', isDodge, playerHealth, playerMana, enemyHealth, enemyMana });
                } else {
                    // Determine Attack Type (Magic or Physical)
                    let isMagicAttack = false;
                    let notEnoughMana = false;
                    if (isPlayerTurn) {
                        // FIX: Corrected type error by using .max from manaCost range object.
                        if (mainHandTemplate?.isMagical && mainHandTemplate.magicAttackType && mainHandTemplate.manaCost) {
                            if (playerMana >= mainHandTemplate.manaCost.max) {
                                isMagicAttack = true;
                                playerMana -= mainHandTemplate.manaCost.max;
                                magicAttackType = mainHandTemplate.magicAttackType;
                            } else {
                                notEnoughMana = true;
                                if (!mageManaRestored && (player.characterClass === CharacterClass.Mage || player.characterClass === CharacterClass.Wizard)) {
                                    playerMana = playerStats.maxMana;
                                    mageManaRestored = true;
                                    isMagicAttack = true;
                                    playerMana -= mainHandTemplate.manaCost.max;
                                    magicAttackType = mainHandTemplate.magicAttackType;
                                    notEnoughMana = false; // Resolved
                                }
                            }
                        }
                    } else { // Enemy turn
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
                        if (isPlayerTurn && (player.characterClass === CharacterClass.Mage || player.characterClass === CharacterClass.Wizard)) {
                            if (Math.random() * 100 < attackerStats.critChance) {
                                isCrit = true;
                                damage = Math.floor(damage * ((attackerStats as CharacterStats).critDamageModifier || 200) / 100);
                            }
                        }
                    } else { // Physical Attack
                        damage = Math.floor(Math.random() * (attackerStats.maxDamage - attackerStats.minDamage + 1)) + attackerStats.minDamage;
                        if (isWarriorCrit) {
                            isCrit = true;
                        } else if (Math.random() * 100 < attackerStats.critChance) {
                            isCrit = true;
                        }

                        if(isCrit) {
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
                
                if (isPlayerTurn) {
                    playerAttacksRemaining--;
                    isFirstAttackOfTurnForPlayer = false;
                }
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

        // Berserker Bonus
        if (playerHealth > 0 && enemyHealth > 0 && player.characterClass === CharacterClass.Berserker && playerHealth < playerStats.maxHealth * 0.3) {
            const { damage, isCrit, damageReduced, healthGained, manaGained } = performAttack(playerStats, enemyStats, true, false);
            enemyHealth -= damage;
            enemyHealth = Math.max(0, enemyHealth);
            if(healthGained > 0) playerHealth = Math.min(playerStats.maxHealth, playerHealth + healthGained);
            if(manaGained > 0) playerMana = Math.min(playerStats.maxMana, playerMana + manaGained);
            combatLog.push({ turn, attacker: player.name, defender: initialEnemy.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, playerHealth, playerMana, enemyHealth, enemyMana });
        }


        turn++;
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

    let attackerMageManaRestored = false;
    let defenderMageManaRestored = false;

    combatLog.push({
        turn: 0,
        attacker: attacker.name,
        defender: defender.name,
        action: 'starts a fight with',
        playerHealth: attackerHealth, playerMana: attackerMana,
        enemyHealth: defenderHealth, enemyMana: defenderMana,
        playerStats: attackerStats, enemyStats: defenderStats,
    });
    
    const attackerMainHandItem = attacker.equipment[EquipmentSlot.MainHand] || attacker.equipment[EquipmentSlot.TwoHand];
    const attackerMainHandTemplate = attackerMainHandItem ? itemTemplates.find(t => t.id === attackerMainHandItem.templateId) : null;
    const defenderMainHandItem = defender.equipment[EquipmentSlot.MainHand] || defender.equipment[EquipmentSlot.TwoHand];
    const defenderMainHandTemplate = defenderMainHandItem ? itemTemplates.find(t => t.id === defenderMainHandItem.templateId) : null;

     // Turn 0 - Ranged opening shots
    const performPvpOpeningAttack = (
        attackingPlayer: PlayerCharacter, attackingStats: CharacterStats, 
        defendingPlayer: PlayerCharacter, defendingStats: CharacterStats,
        currentAttackerHealth: number, currentDefenderHealth: number
    ) => {
        let damage = Math.floor(Math.random() * (attackingStats.maxDamage - attackingStats.minDamage + 1)) + attackingStats.minDamage;
        let isCrit = false;
        if (Math.random() * 100 < attackingStats.critChance) {
            isCrit = true;
            damage = Math.floor(damage * (attackingStats.critDamageModifier / 100));
        }
        
        let effectiveArmor = defendingStats.armor * (1 - attackingStats.armorPenetrationPercent / 100) - attackingStats.armorPenetrationFlat;
        effectiveArmor = Math.max(0, effectiveArmor);
        const damageReduced = Math.min(damage, Math.floor(effectiveArmor * 0.5));
        damage -= damageReduced;
        
        if (attackingPlayer.race === Race.Orc && currentAttackerHealth < attackingStats.maxHealth * 0.25) damage = Math.floor(damage * 1.25);
        if (defendingPlayer.race === Race.Dwarf && currentDefenderHealth < defendingStats.maxHealth * 0.5) damage = Math.floor(damage * 0.8);
        
        damage = Math.max(0, damage);
        const healthGained = Math.floor(damage * (attackingStats.lifeStealPercent / 100)) + attackingStats.lifeStealFlat;
        const manaGained = Math.floor(damage * (attackingStats.manaStealPercent / 100)) + attackingStats.manaStealFlat;

        return { damage, isCrit, damageReduced, healthGained, manaGained };
    };

    // Attacker's base ranged shot
    if (attackerMainHandTemplate?.isRanged) {
        const { damage, isCrit, damageReduced, healthGained, manaGained } = performPvpOpeningAttack(attacker, attackerStats, defender, defenderStats, attackerHealth, defenderHealth);
        attackerHealth = Math.min(attackerStats.maxHealth, attackerHealth + healthGained);
        attackerMana = Math.min(attackerStats.maxMana, attackerMana + manaGained);
        defenderHealth -= damage;
        combatLog.push({ turn: 0, attacker: attacker.name, defender: defender.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana, weaponName: attackerMainHandTemplate.name });
    }
    // Defender's base ranged shot
    if (defenderHealth > 0 && defenderMainHandTemplate?.isRanged) {
        const { damage, isCrit, damageReduced, healthGained, manaGained } = performPvpOpeningAttack(defender, defenderStats, attacker, attackerStats, defenderHealth, attackerHealth);
        defenderHealth = Math.min(defenderStats.maxHealth, defenderHealth + healthGained);
        defenderMana = Math.min(defenderStats.maxMana, defenderMana + manaGained);
        attackerHealth -= damage;
        combatLog.push({ turn: 0, attacker: defender.name, defender: attacker.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana, weaponName: defenderMainHandTemplate.name });
    }
    // Attacker's Hunter bonus shot
    if (attackerHealth > 0 && defenderHealth > 0 && attacker.characterClass === CharacterClass.Hunter && attackerMainHandTemplate?.isRanged) {
        let { damage, isCrit, damageReduced, healthGained, manaGained } = performPvpOpeningAttack(attacker, attackerStats, defender, defenderStats, attackerHealth, defenderHealth);
        damage = Math.floor(damage * 0.5);
        healthGained = Math.floor(healthGained * 0.5);
        manaGained = Math.floor(manaGained * 0.5);
        attackerHealth = Math.min(attackerStats.maxHealth, attackerHealth + healthGained);
        attackerMana = Math.min(attackerStats.maxMana, attackerMana + manaGained);
        defenderHealth -= damage;
        combatLog.push({ turn: 0, attacker: attacker.name, defender: defender.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana, weaponName: attackerMainHandTemplate.name });
    }
    // Defender's Hunter bonus shot
    if (attackerHealth > 0 && defenderHealth > 0 && defender.characterClass === CharacterClass.Hunter && defenderMainHandTemplate?.isRanged) {
        let { damage, isCrit, damageReduced, healthGained, manaGained } = performPvpOpeningAttack(defender, defenderStats, attacker, attackerStats, defenderHealth, attackerHealth);
        damage = Math.floor(damage * 0.5);
        healthGained = Math.floor(healthGained * 0.5);
        manaGained = Math.floor(manaGained * 0.5);
        defenderHealth = Math.min(defenderStats.maxHealth, defenderHealth + healthGained);
        defenderMana = Math.min(defenderStats.maxMana, defenderMana + manaGained);
        attackerHealth -= damage;
        combatLog.push({ turn: 0, attacker: defender.name, defender: attacker.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana, weaponName: defenderMainHandTemplate.name });
    }

    attackerHealth = Math.max(0, attackerHealth);
    defenderHealth = Math.max(0, defenderHealth);

    let turn = 1;
    while (attackerHealth > 0 && defenderHealth > 0 && turn <= 50) {
        let isFirstAttackOfTurnForAttacker = true;
        let isFirstAttackOfTurnForDefender = true;
        
        // Shaman Bonus
        if (attacker.characterClass === CharacterClass.Shaman && attackerMana > 0) {
            defenderHealth -= Math.floor(attackerMana);
             combatLog.push({ turn, attacker: attacker.name, defender: defender.name, action: 'attacks', damage: Math.floor(attackerMana), magicAttackType: MagicAttackType.ShadowBolt, playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana });
        }
         if (defender.characterClass === CharacterClass.Shaman && defenderMana > 0) {
            attackerHealth -= Math.floor(defenderMana);
            combatLog.push({ turn, attacker: defender.name, defender: attacker.name, action: 'attacks', damage: Math.floor(defenderMana), magicAttackType: MagicAttackType.ShadowBolt, playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana });
        }
        if (attackerHealth <= 0 || defenderHealth <= 0) break;

        // Mana Regen
        attackerMana = Math.min(attackerStats.maxMana, attackerMana + attackerStats.manaRegen);
        defenderMana = Math.min(defenderStats.maxMana, defenderMana + defenderStats.manaRegen);

        let attackerAttacksRemaining = Math.floor(attackerStats.attacksPerRound);
        let defenderAttacksRemaining = Math.floor(defenderStats.attacksPerRound);

        let isAttackerTurn = (turn === 1 && attacker.race === Race.Elf) || (turn > 1 && attackerStats.agility >= defenderStats.agility);

        while ((attackerAttacksRemaining > 0 || defenderAttacksRemaining > 0) && attackerHealth > 0 && defenderHealth > 0) {
            let playerA: PlayerCharacter, statsA: CharacterStats, playerB: PlayerCharacter, statsB: CharacterStats;
            let currentAttacksRemaining: number;
            let isFirstAttackOfTurn: boolean;

            if (isAttackerTurn) {
                [playerA, statsA] = [attacker, attackerStats];
                [playerB, statsB] = [defender, defenderStats];
                currentAttacksRemaining = attackerAttacksRemaining;
                isFirstAttackOfTurn = isFirstAttackOfTurnForAttacker;
            } else {
                [playerA, statsA] = [defender, defenderStats];
                [playerB, statsB] = [attacker, attackerStats];
                currentAttacksRemaining = defenderAttacksRemaining;
                 isFirstAttackOfTurn = isFirstAttackOfTurnForDefender;
            }

            if (currentAttacksRemaining > 0) {
                let damage = 0, isCrit = false, isDodge = false, damageReduced = 0, healthGained = 0, manaGained = 0;
                let magicAttackType: MagicAttackType | undefined = undefined;

                const isWarriorCrit = playerA.characterClass === CharacterClass.Warrior && isFirstAttackOfTurn;

                const dodgeChance = statsB.dodgeChance + (playerB.race === Race.Gnome ? 10 : 0);
                if (!isWarriorCrit && Math.random() * 100 < dodgeChance) {
                    isDodge = true;
                }

                if (!isDodge) {
                    const mainHand = isAttackerTurn ? attackerMainHandTemplate : defenderMainHandTemplate;
                    let isMagicAttack = false;
                    
                    // FIX: Corrected type error by using .max from manaCost range object.
                    if (mainHand?.isMagical && mainHand.magicAttackType && mainHand.manaCost) {
                        let currentMana = isAttackerTurn ? attackerMana : defenderMana;
                        if (currentMana >= mainHand.manaCost.max) {
                            isMagicAttack = true;
                            currentMana -= mainHand.manaCost.max;
                            magicAttackType = mainHand.magicAttackType;
                        } else {
                             const isMage = playerA.characterClass === CharacterClass.Mage || playerA.characterClass === CharacterClass.Wizard;
                             const hasRestored = isAttackerTurn ? attackerMageManaRestored : defenderMageManaRestored;
                             if (isMage && !hasRestored) {
                                currentMana = statsA.maxMana - mainHand.manaCost.max;
                                isMagicAttack = true;
                                if (isAttackerTurn) attackerMageManaRestored = true; else defenderMageManaRestored = true;
                             }
                        }
                        if (isAttackerTurn) attackerMana = currentMana; else defenderMana = currentMana;
                    }

                    if (isMagicAttack) {
                        damage = Math.floor(Math.random() * (statsA.magicDamageMax - statsA.magicDamageMin + 1)) + statsA.magicDamageMin;
                        const isMage = playerA.characterClass === CharacterClass.Mage || playerA.characterClass === CharacterClass.Wizard;
                        if (isMage && Math.random() * 100 < statsA.critChance) {
                             isCrit = true;
                             damage = Math.floor(damage * (statsA.critDamageModifier / 100));
                        }
                    } else {
                        damage = Math.floor(Math.random() * (statsA.maxDamage - statsA.minDamage + 1)) + statsA.minDamage;
                        if (isWarriorCrit || Math.random() * 100 < statsA.critChance) {
                            isCrit = true;
                            damage = Math.floor(damage * (statsA.critDamageModifier / 100));
                        }

                        let effectiveArmor = statsB.armor * (1 - statsA.armorPenetrationPercent / 100) - statsA.armorPenetrationFlat;
                        effectiveArmor = Math.max(0, effectiveArmor);
                        damageReduced = Math.min(damage, Math.floor(effectiveArmor * 0.5));
                        damage -= damageReduced;
                    }

                    if (playerA.race === Race.Orc && (isAttackerTurn ? attackerHealth : defenderHealth) < statsA.maxHealth * 0.25) damage = Math.floor(damage * 1.25);
                    if (playerB.race === Race.Dwarf && (isAttackerTurn ? defenderHealth : attackerHealth) < statsB.maxHealth * 0.5) damage = Math.floor(damage * 0.8);

                    damage = Math.max(0, damage);
                    healthGained = Math.floor(damage * (statsA.lifeStealPercent / 100)) + statsA.lifeStealFlat;
                    manaGained = Math.floor(damage * (statsA.manaStealPercent / 100)) + statsA.manaStealFlat;

                    if (isAttackerTurn) {
                        attackerHealth = Math.min(statsA.maxHealth, attackerHealth + healthGained);
                        attackerMana = Math.min(statsA.maxMana, attackerMana + manaGained);
                        defenderHealth -= damage;
                    } else {
                        defenderHealth = Math.min(statsA.maxHealth, defenderHealth + healthGained);
                        defenderMana = Math.min(statsA.maxMana, defenderMana + manaGained);
                        attackerHealth -= damage;
                    }
                }

                combatLog.push({
                    turn, attacker: playerA.name, defender: playerB.name, action: 'attacks',
                    damage: isDodge ? 0 : damage, isCrit, isDodge, damageReduced, healthGained, manaGained, magicAttackType,
                    playerHealth: attackerHealth, playerMana: attackerMana,
                    enemyHealth: defenderHealth, enemyMana: defenderMana,
                });

                if (isAttackerTurn) {
                    attackerAttacksRemaining--;
                    isFirstAttackOfTurnForAttacker = false;
                } else {
                    defenderAttacksRemaining--;
                    isFirstAttackOfTurnForDefender = false;
                }
            }
            
            const agilityAdvantage = statsA.agility - statsB.agility;
            const chanceToAttackAgain = Math.min(75, Math.max(0, agilityAdvantage * 2));
    
            if (Math.random() * 100 < chanceToAttackAgain && (isAttackerTurn ? attackerAttacksRemaining > 0 : defenderAttacksRemaining > 0)) {
                // Current attacker attacks again
            } else {
                isAttackerTurn = !isAttackerTurn;
                if (isAttackerTurn && attackerAttacksRemaining === 0 && defenderAttacksRemaining > 0) {
                    isAttackerTurn = false;
                } else if (!isAttackerTurn && defenderAttacksRemaining === 0 && attackerAttacksRemaining > 0) {
                    isAttackerTurn = true;
                }
            }
        }
        
        // Berserker Bonus
        if (attacker.characterClass === CharacterClass.Berserker && attackerHealth < attackerStats.maxHealth * 0.3) attackerAttacksRemaining++;
        if (defender.characterClass === CharacterClass.Berserker && defenderHealth < defenderStats.maxHealth * 0.3) defenderAttacksRemaining++;
        
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

// --- Authentication Routes---
app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        if (username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters long.'});
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.'});
        }


        const { salt, hash } = hashPassword(password);
        await pool.query(
            'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3)',
            [username, hash, salt]
        );
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (err: any) {
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ message: 'Username already exists.' });
        }
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

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
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
        }
        res.status(204).send();
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ message: 'Server error during logout.' });
    }
});

// --- Heartbeat ---
app.post('/api/session/heartbeat', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided.'});

    try {
         await pool.query('UPDATE sessions SET last_active_at = NOW() WHERE token = $1', [token]);
         res.status(204).send();
    } catch(err) {
         console.error('Heartbeat error:', err);
         res.status(500).send();
    }
});

// --- Middleware for authenticated routes ---
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    try {
        const result = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid token.' });
        }
        
        // Token is valid, attach user ID to request and update last_active_at
        req.user = { id: result.rows[0].user_id };
        await pool.query('UPDATE sessions SET last_active_at = NOW() WHERE token = $1', [token]);
        
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ message: 'Server error during authentication.' });
    }
};

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.id !== 1) { // Assuming admin user ID is 1
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};


// ... More routes defined here, using requireAuth as needed

// All API routes need to be prefixed with /api
// FIX: The type `any` is used here because PoolClient from `pg` can cause type conflicts.
// This is a safe use case as we are passing it through to functions expecting this type.
const withClient = (handler: (client: any, req: Request, res: Response, next: NextFunction) => Promise<void>) => 
    async (req: Request, res: Response, next: NextFunction) => {
        const client = await pool.connect();
        try {
            await handler(client, req, res, next);
        } finally {
            client.release();
        }
    };
    
// --- Admin Routes ---
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username FROM users ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (userId === 1) return res.status(403).json({ message: 'Cannot delete primary admin user.'});
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Server error deleting user' });
    }
});

// FIX: This catch-all route should be the very last route defined.
// It ensures that any request that doesn't match a defined API endpoint
// will be served the main React application file, enabling client-side routing.
// The express.static middleware serves static assets like JS, CSS, and images.
app.use(express.static(path.join(__dirname, '../../dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Error handling middleware should be last
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke!' });
});

// ===================================================================================
//                                SERVER START
// ===================================================================================
const startServer = async () => {
    try {
        await initializeDatabase();
        
        // Start tavern cleanup job
        setInterval(cleanupOldTavernMessages, 60 * 60 * 1000); // Run every hour
        cleanupOldTavernMessages(); // Run once on start

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://0.0.0.0:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        exit(1);
    }
};

startServer();
