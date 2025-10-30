// FIX: Import types directly and use them in handlers to resolve type errors.
// By aliasing the types, we avoid potential conflicts with other global types (e.g. from DOM's Request/Response).
// FIX: Import types from express with aliases to prevent conflicts with global types (e.g., from DOM).
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
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
import { PlayerCharacter, ItemTemplate, EquipmentSlot, CharacterStats, Race, MagicAttackType, CombatLogEntry, PvpRewardSummary, Enemy, GameSettings, ItemRarity, ItemInstance, Expedition, ExpeditionRewardSummary, RewardSource, LootDrop, ResourceDrop, EssenceType, EnemyStats, Quest, QuestType, PlayerQuestProgress, Affix, RolledAffixStats, AffixType } from '../../types.js';


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
const app = express();
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

const createItemInstance = (templateId: string, allItemTemplates: ItemTemplate[], allAffixes: Affix[]): ItemInstance => {
    const template = allItemTemplates.find(t => t.id === templateId);
    if (!template) {
        return { uniqueId: randomUUID(), templateId };
    }

    const instance: ItemInstance = {
        uniqueId: randomUUID(),
        templateId,
    };

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
            inventory.push(createItemInstance(template.id, itemTemplates, affixes));
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
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

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
    const dodgeChance = bonusDodgeChance;

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

function simulateFight(player: PlayerCharacter, initialEnemy: Enemy, itemTemplates: ItemTemplate[], affixes: Affix[]): { combatLog: CombatLogEntry[], isVictory: boolean, finalPlayerHealth: number, finalPlayerMana: number } {
    const combatLog: CombatLogEntry[] = [];
    let turn = 1;

    let playerDerived = calculateDerivedStatsOnServer(player, itemTemplates, affixes);
    let playerStats = playerDerived.stats;

    let enemyStats: EnemyStats = JSON.parse(JSON.stringify(initialEnemy.stats));
    
    let playerHealth = playerStats.currentHealth;
    let playerMana = playerStats.currentMana;
    let enemyHealth = enemyStats.maxHealth;
    let enemyMana = enemyStats.maxMana || 0;
    
    const mainHandItem = player.equipment[EquipmentSlot.MainHand] || player.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;

    combatLog.push({
        turn: 0,
        attacker: player.name,
        defender: initialEnemy.name,
        action: 'starts a fight with',
        playerHealth, playerMana, enemyHealth, enemyMana,
        playerStats: playerStats, enemyStats: enemyStats, enemyDescription: initialEnemy.description,
    });
    
    const performTurn = (
        attacker: { name: string, stats: CharacterStats | EnemyStats, race?: Race },
        defender: { name: string, stats: CharacterStats | EnemyStats, race?: Race }
    ) => {
        const isPlayerAttacking = 'strength' in attacker.stats;
        
        let attackerCurrentHealth = isPlayerAttacking ? playerHealth : enemyHealth;
        let attackerMaxHealth = attacker.stats.maxHealth;
        
        // --- Attacker Mana Regen ---
        if (isPlayerAttacking) {
            const manaRegen = (attacker.stats as CharacterStats).manaRegen;
            if (manaRegen > 0 && playerMana < playerStats.maxMana) {
                const newMana = Math.min(playerStats.maxMana, playerMana + manaRegen);
                combatLog.push({ turn, attacker: attacker.name, defender: defender.name, action: 'manaRegen', manaGained: newMana - playerMana, playerHealth, playerMana: newMana, enemyHealth, enemyMana });
                playerMana = newMana;
            }
        } else {
            const manaRegen = (attacker.stats as EnemyStats).manaRegen || 0;
            if (manaRegen > 0 && enemyMana < (enemyStats.maxMana || 0)) {
                const newMana = Math.min((enemyStats.maxMana || 0), enemyMana + manaRegen);
                combatLog.push({ turn, attacker: attacker.name, defender: defender.name, action: 'manaRegen', manaGained: newMana - enemyMana, playerHealth, playerMana, enemyHealth, enemyMana: newMana });
                enemyMana = newMana;
            }
        }
        
        const attacksPerRound = isPlayerAttacking ? (attacker.stats as CharacterStats).attacksPerRound : ((attacker.stats as EnemyStats).attacksPerTurn || 1);

        for(let i=0; i<attacksPerRound; i++) {
            if (playerHealth <= 0 || enemyHealth <= 0) break;
            
            let damage = 0;
            let isCrit = false;
            let isDodge = false;
            let damageReduced = 0;
            let healthGained = 0;
            let manaGained = 0;
            let magicAttackType: MagicAttackType | undefined = undefined;

            // --- Dodge Check ---
            if (!isPlayerAttacking && defender.race === Race.Gnome && Math.random() < 0.1) {
                isDodge = true;
            } else {
                const attackerAccuracy = isPlayerAttacking ? (attacker.stats as CharacterStats).accuracy : 0;
                const dodgeChance = Math.max(0, (defender.stats.agility - attackerAccuracy) * 0.1);
                if (Math.random() * 100 < dodgeChance) {
                    isDodge = true;
                }
            }

            if(isDodge) {
                combatLog.push({ turn, attacker: attacker.name, defender: defender.name, action: 'attacks', isDodge, playerHealth, playerMana, enemyHealth, enemyMana });
                continue;
            }

            // --- Determine Attack Type (Magic or Physical) ---
            let isMagicAttack = false;
            let notEnoughMana = false;
            if (isPlayerAttacking) {
                const pStats = attacker.stats as CharacterStats;
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
                const eStats = attacker.stats as EnemyStats;
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


            // --- Damage Calculation ---
            if (isMagicAttack) {
                damage = Math.floor(Math.random() * ((attacker.stats.magicDamageMax || 0) - (attacker.stats.magicDamageMin || 0) + 1)) + (attacker.stats.magicDamageMin || 0);
            } else { // Physical Attack
                damage = Math.floor(Math.random() * (attacker.stats.maxDamage - attacker.stats.minDamage + 1)) + attacker.stats.minDamage;
                if (Math.random() * 100 < attacker.stats.critChance) {
                    isCrit = true;
                    damage = Math.floor(damage * ((attacker.stats as CharacterStats).critDamageModifier || 200) / 100);
                }

                // Armor Reduction
                let armorPenPercent = isPlayerAttacking ? (attacker.stats as CharacterStats).armorPenetrationPercent : 0;
                let armorPenFlat = isPlayerAttacking ? (attacker.stats as CharacterStats).armorPenetrationFlat : 0;
                
                let effectiveArmor = defender.stats.armor * (1 - armorPenPercent / 100) - armorPenFlat;
                effectiveArmor = Math.max(0, effectiveArmor);

                const reduction = Math.floor(effectiveArmor * 0.5);
                damageReduced = Math.min(damage, reduction);
                damage -= damageReduced;
            }

            // --- Race/Special Bonuses ---
            if (isPlayerAttacking && attacker.race === Race.Orc && attackerCurrentHealth < attackerMaxHealth * 0.25) {
                damage = Math.floor(damage * 1.25);
            }
            if (!isPlayerAttacking && defender.race === Race.Dwarf && playerHealth < playerStats.maxHealth * 0.5) {
                damage = Math.floor(damage * 0.8);
            }
            
            damage = Math.max(0, damage);
            
            // --- Life/Mana Steal (Player attacking only for now) ---
            if (isPlayerAttacking) {
                const pStats = attacker.stats as CharacterStats;
                healthGained = Math.floor(damage * (pStats.lifeStealPercent / 100)) + pStats.lifeStealFlat;
                manaGained = Math.floor(damage * (pStats.manaStealPercent / 100)) + pStats.lifeStealFlat;

                if(healthGained > 0) playerHealth = Math.min(pStats.maxHealth, playerHealth + healthGained);
                if(manaGained > 0) playerMana = Math.min(pStats.maxMana, playerMana + manaGained);
            }

            // --- Apply Damage ---
            if (isPlayerAttacking) {
                enemyHealth -= damage;
            } else {
                playerHealth -= damage;
            }
        
            combatLog.push({
                turn, attacker: attacker.name, defender: defender.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, magicAttackType,
                playerHealth: Math.max(0, playerHealth), playerMana: Math.max(0, playerMana), enemyHealth: Math.max(0, enemyHealth), enemyMana: Math.max(0, enemyMana),
                weaponName: isPlayerAttacking ? mainHandTemplate?.name : undefined,
            });
        }
    };

    while (playerHealth > 0 && enemyHealth > 0) {
        const playerGoesFirst = (turn === 1 && player.race === Race.Elf) || playerStats.agility >= enemyStats.agility;

        if (playerGoesFirst) {
            performTurn({ name: player.name, stats: playerStats, race: player.race }, { name: initialEnemy.name, stats: enemyStats });
            if (enemyHealth > 0) {
                performTurn({ name: initialEnemy.name, stats: enemyStats }, { name: player.name, stats: playerStats, race: player.race });
            }
        } else {
            performTurn({ name: initialEnemy.name, stats: enemyStats }, { name: player.name, stats: playerStats, race: player.race });
            if (playerHealth > 0) {
                performTurn({ name: player.name, stats: playerStats, race: player.race }, { name: initialEnemy.name, stats: enemyStats });
            }
        }
        turn++;
        if (turn > 50) break; // Safety break
    }

    return {
        combatLog,
        isVictory: playerHealth > 0,
        finalPlayerHealth: playerHealth,
        finalPlayerMana: playerMana
    };
}

function simulatePvpFight(
    initialAttacker: PlayerCharacter, 
    initialDefender: PlayerCharacter, 
    allItemTemplates: ItemTemplate[],
    affixes: Affix[]
): { combatLog: CombatLogEntry[], isVictory: boolean, finalAttackerHealth: number, finalAttackerMana: number, finalDefenderHealth: number, finalDefenderMana: number } {
    const combatLog: CombatLogEntry[] = [];
    let turn = 1;

    const attacker = calculateDerivedStatsOnServer(initialAttacker, allItemTemplates, affixes);
    const defender = calculateDerivedStatsOnServer(initialDefender, allItemTemplates, affixes);

    let attackerHealth = attacker.stats.currentHealth;
    let attackerMana = attacker.stats.currentMana;
    let defenderHealth = defender.stats.currentHealth;
    let defenderMana = defender.stats.currentMana;
    
    const getWeaponTemplate = (p: PlayerCharacter) => {
        const mainHandItem = p.equipment[EquipmentSlot.MainHand] || p.equipment[EquipmentSlot.TwoHand];
        return mainHandItem ? allItemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    }

    combatLog.push({
        turn: 0,
        attacker: attacker.name,
        defender: defender.name,
        action: 'starts a fight with',
        playerHealth: attackerHealth,
        playerMana: attackerMana,
        enemyHealth: defenderHealth,
        enemyMana: defenderMana,
        playerStats: attacker.stats,
        enemyStats: defender.stats,
    });
    
    const performTurn = (
        atk: PlayerCharacter,
        def: PlayerCharacter,
    ) => {
        
        if (atk.id === attacker.id) {
            const manaRegen = atk.stats.manaRegen;
            if (manaRegen > 0 && attackerMana < atk.stats.maxMana) {
                const newMana = Math.min(atk.stats.maxMana, attackerMana + manaRegen);
                combatLog.push({ turn, attacker: atk.name, defender: def.name, action: 'manaRegen', manaGained: newMana - attackerMana, playerHealth: attackerHealth, playerMana: newMana, enemyHealth: defenderHealth, enemyMana: defenderMana });
                attackerMana = newMana;
            }
        } else {
             const manaRegen = atk.stats.manaRegen;
            if (manaRegen > 0 && defenderMana < atk.stats.maxMana) {
                const newMana = Math.min(atk.stats.maxMana, defenderMana + manaRegen);
                combatLog.push({ turn, attacker: atk.name, defender: def.name, action: 'manaRegen', manaGained: newMana - defenderMana, playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: newMana });
                defenderMana = newMana;
            }
        }

        const attacksPerRound = atk.stats.attacksPerRound;
        const weaponTemplate = getWeaponTemplate(atk);

        for(let i=0; i < attacksPerRound; i++) {
            if (attackerHealth <= 0 || defenderHealth <= 0) break;
            
            let damage = 0;
            let isCrit = false;
            let isDodge = false;
            let damageReduced = 0;
            let healthGained = 0;
            let manaGained = 0;
            let magicAttackType: MagicAttackType | undefined = undefined;

            if (def.race === Race.Gnome && Math.random() < 0.1) isDodge = true;
            else {
                const dodgeChance = Math.max(0, (def.stats.agility - atk.stats.accuracy) * 0.1);
                if (Math.random() * 100 < dodgeChance) isDodge = true;
            }

            if(isDodge) {
                const logEntry = {
                    turn, attacker: atk.name, defender: def.name, action: 'attacks', isDodge,
                    playerHealth: atk.id === attacker.id ? attackerHealth : defenderHealth,
                    playerMana: atk.id === attacker.id ? attackerMana : defenderMana,
                    enemyHealth: def.id === defender.id ? defenderHealth : attackerHealth,
                    enemyMana: def.id === defender.id ? defenderMana : attackerMana,
                };
                if (atk.id === defender.id) { // Swap if defender is attacking
                    [logEntry.playerHealth, logEntry.enemyHealth] = [logEntry.enemyHealth, logEntry.playerHealth];
                    [logEntry.playerMana, logEntry.enemyMana] = [logEntry.enemyMana, logEntry.playerMana];
                }
                combatLog.push(logEntry);
                continue;
            }

            let isMagicAttack = false;
            let notEnoughMana = false;
            let currentMana = (atk.id === attacker.id) ? attackerMana : defenderMana;

            if (weaponTemplate?.isMagical && weaponTemplate.magicAttackType && weaponTemplate.manaCost) {
                if (currentMana >= weaponTemplate.manaCost) {
                    isMagicAttack = true;
                    currentMana -= weaponTemplate.manaCost;
                    magicAttackType = weaponTemplate.magicAttackType;
                } else {
                    notEnoughMana = true;
                }
            }
            if (atk.id === attacker.id) attackerMana = currentMana; else defenderMana = currentMana;
            
            if (notEnoughMana) {
                combatLog.push({ turn, attacker: atk.name, defender: def.name, action: 'notEnoughMana', playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana });
            }

            if (isMagicAttack) {
                damage = Math.floor(Math.random() * (atk.stats.magicDamageMax - atk.stats.magicDamageMin + 1)) + atk.stats.magicDamageMin;
            } else {
                damage = Math.floor(Math.random() * (atk.stats.maxDamage - atk.stats.minDamage + 1)) + atk.stats.minDamage;
                if (Math.random() * 100 < atk.stats.critChance) {
                    isCrit = true;
                    damage = Math.floor(damage * (atk.stats.critDamageModifier / 100));
                }
                let effectiveArmor = def.stats.armor * (1 - atk.stats.armorPenetrationPercent / 100) - atk.stats.armorPenetrationFlat;
                effectiveArmor = Math.max(0, effectiveArmor);
                damageReduced = Math.min(damage, Math.floor(effectiveArmor * 0.5));
                damage -= damageReduced;
            }
            
            let currentAtkHealth = (atk.id === attacker.id) ? attackerHealth : defenderHealth;
            let currentDefHealth = (def.id === attacker.id) ? attackerHealth : defenderHealth;

            if (atk.race === Race.Orc && currentAtkHealth < atk.stats.maxHealth * 0.25) damage = Math.floor(damage * 1.25);
            if (def.race === Race.Dwarf && currentDefHealth < def.stats.maxHealth * 0.5) damage = Math.floor(damage * 0.8);
            damage = Math.max(0, damage);
            
            healthGained = Math.floor(damage * (atk.stats.lifeStealPercent / 100)) + atk.stats.lifeStealFlat;
            manaGained = Math.floor(damage * (atk.stats.manaStealPercent / 100)) + atk.stats.manaStealFlat;

            if(healthGained > 0) currentAtkHealth = Math.min(atk.stats.maxHealth, currentAtkHealth + healthGained);
            if(manaGained > 0) currentMana = Math.min(atk.stats.maxMana, currentMana + manaGained);
            
            if (atk.id === attacker.id) { attackerHealth = currentAtkHealth; attackerMana = currentMana; }
            else { defenderHealth = currentAtkHealth; defenderMana = currentMana; }

            if (atk.id === attacker.id) defenderHealth -= damage; else attackerHealth -= damage;

            const logEntry = {
                turn, attacker: atk.name, defender: def.name, action: 'attacks', damage, isCrit, damageReduced, healthGained, manaGained, magicAttackType,
                playerHealth: Math.max(0, attackerHealth), playerMana: Math.max(0, attackerMana),
                enemyHealth: Math.max(0, defenderHealth), enemyMana: Math.max(0, defenderMana),
                weaponName: weaponTemplate?.name,
            };

            combatLog.push(logEntry);
        }
    };

    while (attackerHealth > 0 && defenderHealth > 0) {
        const attackerGoesFirst = (turn === 1 && attacker.race === Race.Elf) || attacker.stats.agility >= defender.stats.agility;

        if (attackerGoesFirst) {
            performTurn(attacker, defender);
            if (defenderHealth > 0) performTurn(defender, attacker);
        } else {
            performTurn(defender, attacker);
            if (attackerHealth > 0) performTurn(attacker, defender);
        }
        turn++;
        if (turn > 50) break;
    }

    return {
        combatLog,
        isVictory: attackerHealth > 0,
        finalAttackerHealth: attackerHealth,
        finalAttackerMana: attackerMana,
        finalDefenderHealth: defenderHealth,
        finalDefenderMana: defenderMana
    };
}


async function completeExpedition(
    client: any, // PoolClient
    userId: number,
    character: PlayerCharacter,
    allExpeditions: Expedition[],
    allEnemies: Enemy[],
    allItemTemplates: ItemTemplate[],
    allAffixes: Affix[],
    allQuests: Quest[]
): Promise<{ character: PlayerCharacter; summary: ExpeditionRewardSummary }> {
    const expedition = allExpeditions.find(e => e.id === character.activeExpedition!.expeditionId);
    if (!expedition) {
        throw new Error('Expedition not found');
    }

    let updatedCharacter = JSON.parse(JSON.stringify(character));
    
    // --- Spawn enemies ---
    const enemiesToFight: Enemy[] = [];
    let enemyCount = 0;
    const maxEnemies = expedition.maxEnemies ?? expedition.enemies.length;

    while (enemyCount < maxEnemies) {
        let spawned = false;
        for (const expEnemy of expedition.enemies) {
            if (Math.random() * 100 < expEnemy.spawnChance) {
                const enemyTemplate = allEnemies.find(e => e.id === expEnemy.enemyId);
                if (enemyTemplate) {
                    enemiesToFight.push({ ...enemyTemplate, uniqueId: randomUUID() });
                    enemyCount++;
                    spawned = true;
                    if (enemyCount >= maxEnemies) break;
                }
            }
        }
        // Safety break if no enemies are ever spawned to avoid infinite loop
        if (!spawned && enemyCount === 0) break;
    }

    // --- Simulate Fights ---
    let totalGoldFromFights = 0;
    let totalExpFromFights = 0;
    const itemsFound: ItemInstance[] = [];
    const essencesFound: Partial<Record<EssenceType, number>> = {};
    let fullCombatLog: CombatLogEntry[] = [];
    let isVictory = true;

    for (const enemy of enemiesToFight) {
        const fightResult = simulateFight(updatedCharacter, enemy, allItemTemplates, allAffixes);
        fullCombatLog.push(...fightResult.combatLog);
        
        updatedCharacter.stats.currentHealth = fightResult.finalPlayerHealth;
        updatedCharacter.stats.currentMana = fightResult.finalPlayerMana;

        if (!fightResult.isVictory) {
            isVictory = false;
            break; // Stop expedition on defeat
        }

        const goldGained = Math.floor(Math.random() * (enemy.rewards.maxGold - enemy.rewards.minGold + 1)) + enemy.rewards.minGold;
        let expGained = Math.floor(Math.random() * (enemy.rewards.maxExperience - enemy.rewards.minExperience + 1)) + enemy.rewards.minExperience;
        
        if (updatedCharacter.race === Race.Human) {
            expGained = Math.floor(expGained * 1.1);
        }
        
        totalGoldFromFights += goldGained;
        totalExpFromFights += expGained;
        
        // --- Handle Quest Progress ---
        updatedCharacter.acceptedQuests.forEach((questId: string) => {
            const quest = allQuests.find(q => q.id === questId);
            if (quest && quest.objective.type === QuestType.Kill && quest.objective.targetId === enemy.id) {
                const progressIndex = updatedCharacter.questProgress.findIndex((p: PlayerQuestProgress) => p.questId === questId);
                if (progressIndex > -1) {
                    const progress = updatedCharacter.questProgress[progressIndex];
                    if (progress.progress < quest.objective.amount) {
                        progress.progress += 1;
                    }
                }
            }
        });

        // --- Handle Loot ---
        for (const drop of enemy.lootTable) {
            if (Math.random() * 100 < drop.chance) {
                itemsFound.push(createItemInstance(drop.templateId, allItemTemplates, allAffixes));
            }
        }
        for (const drop of enemy.resourceLootTable || []) {
            if (Math.random() * 100 < drop.chance) {
                const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
            }
        }
    }
    
    const rewardBreakdown: RewardSource[] = [];
    let totalGold = 0;
    let totalExp = 0;

    if (isVictory) {
        // --- Expedition Base Rewards ---
        let baseGold = Math.floor(Math.random() * (expedition.maxBaseGoldReward - expedition.minBaseGoldReward + 1)) + expedition.minBaseGoldReward;
        let baseExp = Math.floor(Math.random() * (expedition.maxBaseExperienceReward - expedition.minBaseExperienceReward + 1)) + expedition.minBaseExperienceReward;
        
        if (updatedCharacter.race === Race.Human) {
            baseExp = Math.floor(baseExp * 1.1);
        }
        if (updatedCharacter.race === Race.Gnome) {
            baseGold = Math.floor(baseGold * 1.2);
        }
        
        totalGold += baseGold;
        totalExp += baseExp;
        rewardBreakdown.push({ source: `Nagroda podstawowa za ekspedycję`, gold: baseGold, experience: baseExp });

        // --- Fight Rewards ---
        totalGold += totalGoldFromFights;
        totalExp += totalExpFromFights;
        if (totalGoldFromFights > 0 || totalExpFromFights > 0) {
            rewardBreakdown.push({ source: 'Łącznie za pokonanych wrogów', gold: totalGoldFromFights, experience: totalExpFromFights });
        }
        
        // --- Expedition Loot ---
        for (const drop of expedition.lootTable) {
            if (Math.random() * 100 < drop.chance) {
                itemsFound.push(createItemInstance(drop.templateId, allItemTemplates, allAffixes));
            }
        }
         for (const drop of expedition.resourceLootTable || []) {
            if (Math.random() * 100 < drop.chance) {
                const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                essencesFound[drop.resource] = (essencesFound[drop.resource] || 0) + amount;
            }
        }

        // --- Apply Rewards ---
        updatedCharacter.resources.gold += totalGold;
        updatedCharacter.experience += totalExp;
        updatedCharacter.inventory.push(...itemsFound);

        for (const [essenceType, amount] of Object.entries(essencesFound)) {
            updatedCharacter.resources[essenceType as EssenceType] = (updatedCharacter.resources[essenceType as EssenceType] || 0) + amount;
        }

        // Level up check
        while (updatedCharacter.experience >= updatedCharacter.experienceToNextLevel) {
            updatedCharacter.experience -= updatedCharacter.experienceToNextLevel;
            updatedCharacter.level += 1;
            updatedCharacter.stats.statPoints += 1;
            updatedCharacter.experienceToNextLevel = Math.floor(100 * Math.pow(updatedCharacter.level, 1.3));
        }

    } else { // On defeat
        updatedCharacter.stats.currentHealth = 1;
        updatedCharacter.isResting = true; // Force rest on defeat
        updatedCharacter.lastRestTime = Date.now();
        updatedCharacter.restStartHealth = 1;
    }

    updatedCharacter.activeExpedition = null;

    const summary: ExpeditionRewardSummary = {
        rewardBreakdown,
        totalGold,
        totalExperience: totalExp,
        combatLog: fullCombatLog,
        isVictory,
        itemsFound,
        essencesFound
    };

    return { character: updatedCharacter, summary };
}

// ===================================================================================
//                                  ROUTES
// ===================================================================================
app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../../../dist')));

// --- Authentication Routes ---
// FIX: Add explicit types to all route handlers
app.post('/api/auth/register', async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.post('/api/auth/login', async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.post('/api/auth/logout', authenticateToken, (req: ExpressRequest, res: ExpressResponse) => {
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

// --- Middleware for authentication ---
// FIX: Add explicit types to all route handlers
async function authenticateToken(req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) {
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
// FIX: Add explicit types to all route handlers
app.get('/api/character', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
    const userId = req.user!.id;
    try {
        const result = await pool.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        let character: PlayerCharacter = result.rows[0].data;

        // Check if expedition is finished
        if (character.activeExpedition && Date.now() >= character.activeExpedition.finishTime) {
            const gameDataRes = await pool.query("SELECT key, data FROM game_data WHERE key IN ('expeditions', 'enemies', 'itemTemplates', 'quests', 'affixes')");
            const allExpeditions = gameDataRes.rows.find(r => r.key === 'expeditions')?.data || [];
            const allEnemies = gameDataRes.rows.find(r => r.key === 'enemies')?.data || [];
            const allItemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const allQuests = gameDataRes.rows.find(r => r.key === 'quests')?.data || [];
            const allAffixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const { character: updatedChar, summary } = await completeExpedition(client, userId, character, allExpeditions, allEnemies, allItemTemplates, allAffixes, allQuests);
                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(updatedChar), userId]);
                await client.query('COMMIT');

                const summaryMessageBody = JSON.stringify(summary);
                await client.query(
                    'INSERT INTO messages (recipient_id, message_type, subject, body) VALUES ($1, $2, $3, $4)',
                    [userId, 'expedition_report', 'Raport z Ekspedycji', summaryMessageBody]
                );

                res.json({ ...updatedChar, expeditionSummary: summary });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err; // Propagate error
            } finally {
                client.release();
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
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving character.' });
    }
});

// FIX: Add explicit types to all route handlers
app.post('/api/character', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.put('/api/character', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.get('/api/characters/all', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        // First check if the user is an admin
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (userRes.rows[0]?.username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        const result = await pool.query(`
            SELECT c.user_id, u.username, c.data->>'name' as name, c.data->>'race' as race, (c.data->>'level')::int as level
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

// FIX: Add explicit types to all route handlers
app.delete('/api/characters/:userId', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.get('/api/characters/names', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query(`SELECT data->>'name' as name FROM characters`);
        res.json(result.rows.map(r => r.name));
    } catch(err) {
        console.error("Error fetching character names:", err);
        res.status(500).json({ message: 'Failed to fetch character names.' });
    }
});

// FIX: Add explicit types to all route handlers
app.post('/api/characters/:userId/reset-stats', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.post('/api/characters/:userId/heal', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// --- User Routes (Admin) ---
// FIX: Add explicit types to all route handlers
app.get('/api/users', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.delete('/api/users/:userId', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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
// FIX: Add explicit types to all route handlers
app.get('/api/game-data', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query('SELECT key, data FROM game_data');
        const gameData = result.rows.reduce((acc, row) => {
            acc[row.key] = row.data;
            return acc;
        }, {} as any);
        res.json(gameData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving game data.' });
    }
});

// --- Admin: Update Game Data ---
// FIX: Add explicit types to all route handlers
app.put('/api/game-data', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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
// FIX: Add explicit types to all route handlers
app.get('/api/ranking', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id as id,
                c.data->>'name' as name,
                c.data->>'race' as race,
                (c.data->>'level')::int as level,
                (c.data->>'experience')::bigint as experience,
                (c.data->>'pvpWins')::int as "pvpWins",
                (c.data->>'pvpLosses')::int as "pvpLosses",
                (c.data->>'pvpProtectionUntil')::bigint as "pvpProtectionUntil"
            FROM characters c
            ORDER BY experience DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching ranking.' });
    }
});

// --- Trader Routes ---
// FIX: Add explicit types to all route handlers
app.get('/api/trader/inventory', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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
// FIX: Add explicit types to all route handlers
app.post('/api/trader/buy', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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
        if (character.inventory.length >= 40) { // MAX_PLAYER_INVENTORY_SIZE
            return res.status(400).json({ message: 'Inventory is full.' });
        }
        if (character.resources.gold < cost) {
            return res.status(400).json({ message: 'Not enough gold.' });
        }

        // Update character
        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);

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
    } finally {
        client.release();
    }
});

// --- PvP Route ---
// FIX: Add explicit types to all route handlers
app.post('/api/pvp/attack/:defenderId', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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
        const { isVictory, combatLog, finalAttackerHealth, finalAttackerMana, finalDefenderHealth, finalDefenderMana } = simulatePvpFight(attacker, defender, allItemTemplates, allAffixes);

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
        while (attacker.experience >= attacker.experienceToNextLevel) {
            attacker.experience -= attacker.experienceToNextLevel;
            attacker.level += 1;
            attacker.stats.statPoints += 1;
            attacker.experienceToNextLevel = Math.floor(100 * Math.pow(attacker.level, 1.3));
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
        const fullAttackerData = calculateDerivedStatsOnServer(attacker, allItemTemplates, allAffixes);
        const fullDefenderData = calculateDerivedStatsOnServer(defender, allItemTemplates, allAffixes);

        const summary: PvpRewardSummary = {
            gold: goldStolen,
            experience: xpGained,
            combatLog,
            isVictory,
            attacker: fullAttackerData,
            defender: fullDefenderData,
        };
        
        // Message to defender
        await client.query(
            'INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body) VALUES ($1, $2, $3, $4, $5, $6)',
            [defenderId, attackerId, attacker.name, 'pvp_report', `You have been attacked by ${attacker.name}!`, JSON.stringify(summary)]
        );
        // Message to attacker
        await client.query(
             'INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body) VALUES ($1, $2, $3, $4, $5, $6)',
            [attackerId, defenderId, defender.name, 'pvp_report', `Attack report: You attacked ${defender.name}!`, JSON.stringify(summary)]
        );

        await client.query('COMMIT');
        res.json(summary);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during PvP attack:', err);
        res.status(500).json({ message: 'Server error during attack.' });
    } finally {
        client.release();
    }
});


// --- Message Routes ---
// FIX: Add explicit types to all route handlers
app.get('/api/messages', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
    const userId = req.user!.id;
    try {
        const result = await pool.query('SELECT * FROM messages WHERE recipient_id = $1 ORDER BY created_at DESC', [userId]);
        res.json(result.rows);
    } catch(err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ message: 'Failed to fetch messages.' });
    }
});

// FIX: Add explicit types to all route handlers
app.post('/api/messages', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.put('/api/messages/:id', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.delete('/api/messages/:id', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// FIX: Add explicit types to all route handlers
app.post('/api/admin/global-message', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// --- Tavern (Chat) ---
// FIX: Add explicit types to all route handlers
app.get('/api/tavern/messages', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query('SELECT * FROM tavern_messages ORDER BY created_at ASC LIMIT 100');
        res.json(result.rows);
    } catch(err) {
        console.error("Error fetching tavern messages:", err);
        res.status(500).json({ message: 'Failed to fetch tavern messages.' });
    }
});

// FIX: Add explicit types to all route handlers
app.post('/api/tavern/messages', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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


// --- Admin Routes ---
// FIX: Add explicit types to all route handlers
app.post('/api/admin/pvp/reset-cooldowns', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
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

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// FIX: Add explicit types to all route handlers
app.get('*', (req: ExpressRequest, res: ExpressResponse) => {
  res.sendFile(path.join(__dirname, '../../../../dist/index.html'));
});

// Error handling middleware
// FIX: Add explicit types to all route handlers
app.use((err: Error, req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initializeDatabase().catch(err => {
    console.error("Failed to initialize database, shutting down.", err);
    exit(1);
  });
});