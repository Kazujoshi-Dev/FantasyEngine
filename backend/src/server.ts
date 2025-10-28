// FIX: Import types directly and use them in handlers to resolve type errors.
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
import { PlayerCharacter, ItemTemplate, EquipmentSlot, CharacterStats, Race, MagicAttackType, CombatLogEntry, PvpRewardSummary, Enemy, GameSettings, ItemRarity, ItemInstance, Expedition, ExpeditionRewardSummary, RewardSource, LootDrop, ResourceDrop, EssenceType, EnemyStats } from '../../types.js';


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

const generateTraderInventory = (itemTemplates: ItemTemplate[], settings: GameSettings): ItemInstance[] => {
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
            inventory.push({
                uniqueId: crypto.randomUUID(),
                templateId: template.id
            });
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

        const gameDataRes = await client.query("SELECT key FROM game_data WHERE key IN ('locations', 'expeditions', 'enemies', 'settings', 'itemTemplates', 'quests')");
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

        if (!existingKeys.includes('settings')) {
            const defaultSettings = { language: 'en' };
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
const calculateDerivedStatsOnServer = (character: PlayerCharacter, itemTemplates: ItemTemplate[]): PlayerCharacter => {
    const totalPrimaryStats: Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'> = {
        strength: character.stats.strength,
        agility: character.stats.agility,
        accuracy: character.stats.accuracy,
        stamina: character.stats.stamina,
        intelligence: character.stats.intelligence,
        energy: character.stats.energy,
    };
    
    let bonusDamageMin = 0, bonusDamageMax = 0, bonusMagicDamageMin = 0, bonusMagicDamageMax = 0;
    let bonusArmor = 0, bonusCritChance = 0, bonusMaxHealth = 0;
    let bonusCritDamageModifier = 0;
    let bonusArmorPenetrationPercent = 0, bonusArmorPenetrationFlat = 0;
    let bonusLifeStealPercent = 0, bonusLifeStealFlat = 0;
    let bonusManaStealPercent = 0, bonusManaStealFlat = 0;
    
    for (const slot in character.equipment) {
        const itemInstance = character.equipment[slot as EquipmentSlot];
        if (itemInstance) {
            const template = itemTemplates.find(t => t.id === itemInstance.templateId);
            if (template) {
                const upgradeLevel = itemInstance.upgradeLevel || 0;
                const upgradeBonusFactor = upgradeLevel * 0.1;

                for (const stat in template.statsBonus) {
                    const key = stat as keyof typeof template.statsBonus;
                    const baseBonus = template.statsBonus[key] || 0;
                    totalPrimaryStats[key] += baseBonus + Math.round(baseBonus * upgradeBonusFactor);
                }

                const baseDamageMin = template.damageMin || 0, baseDamageMax = template.damageMax || 0;
                const baseMagicDamageMin = template.magicDamageMin || 0, baseMagicDamageMax = template.magicDamageMax || 0;
                const baseArmor = template.armorBonus || 0, baseCritChance = template.critChanceBonus || 0, baseMaxHealth = template.maxHealthBonus || 0;
                
                bonusDamageMin += baseDamageMin + Math.round(baseDamageMin * upgradeBonusFactor);
                bonusDamageMax += baseDamageMax + Math.round(baseDamageMax * upgradeBonusFactor);
                bonusMagicDamageMin += baseMagicDamageMin + Math.round(baseMagicDamageMin * upgradeBonusFactor);
                bonusMagicDamageMax += baseMagicDamageMax + Math.round(baseMagicDamageMax * upgradeBonusFactor);
                bonusArmor += baseArmor + Math.round(baseArmor * upgradeBonusFactor);
                bonusCritChance += baseCritChance + baseCritChance * upgradeBonusFactor;
                bonusMaxHealth += baseMaxHealth + Math.round(baseMaxHealth * upgradeBonusFactor);

                bonusCritDamageModifier += template.critDamageModifierBonus || 0;
                bonusArmorPenetrationPercent += template.armorPenetrationPercent || 0;
                bonusArmorPenetrationFlat += template.armorPenetrationFlat || 0;
                bonusLifeStealPercent += template.lifeStealPercent || 0;
                bonusLifeStealFlat += template.lifeStealFlat || 0;
                bonusManaStealPercent += template.manaStealPercent || 0;
                bonusManaStealFlat += template.manaStealFlat || 0;
            }
        }
    }

    const mainHandItem = character.equipment[EquipmentSlot.MainHand] || character.equipment[EquipmentSlot.TwoHand];
    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
    const attacksPerRound = mainHandTemplate?.attacksPerRound || 1;

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

    let armor = bonusArmor;
    let manaRegen = totalPrimaryStats.intelligence * 2;

    if (character.race === Race.Dwarf) armor += 5;
    if (character.race === Race.Elf) manaRegen += 10;
    
    const intelligenceDamageBonus = Math.floor(totalPrimaryStats.intelligence * 1.5);
    const magicDamageMin = bonusMagicDamageMin > 0 ? bonusMagicDamageMin + intelligenceDamageBonus : 0;
    const magicDamageMax = bonusMagicDamageMax > 0 ? bonusMagicDamageMax + intelligenceDamageBonus : 0;

    return {
      ...character,
      stats: {
        ...character.stats, ...totalPrimaryStats,
        maxHealth, maxEnergy, maxMana, minDamage, maxDamage, critChance, armor,
        magicDamageMin, magicDamageMax, attacksPerRound, manaRegen,
        critDamageModifier, armorPenetrationPercent, armorPenetrationFlat,
        lifeStealPercent, lifeStealFlat, manaStealPercent, manaStealFlat,
      }
    };
};

// --- EXPEDITION & COMBAT LOGIC ---

function simulateFight(player: PlayerCharacter, initialEnemy: Enemy, itemTemplates: ItemTemplate[]): { combatLog: CombatLogEntry[], isVictory: boolean, finalPlayerHealth: number, finalPlayerMana: number } {
    const combatLog: CombatLogEntry[] = [];
    let turn = 1;

    let playerDerived = calculateDerivedStatsOnServer(player, itemTemplates);
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
                manaGained = Math.floor(damage * (pStats.manaStealPercent / 100)) + pStats.manaStealFlat;

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


async function completeExpedition(
    character: PlayerCharacter,
    allExpeditions: Expedition[],
    allEnemies: Enemy[],
    allItemTemplates: ItemTemplate[]
): Promise<PlayerCharacter> {
    const expeditionTemplate = allExpeditions.find(e => e.id === character.activeExpedition!.expeditionId);
    if (!expeditionTemplate) {
        character.activeExpedition = null;
        return character;
    }

    const encounteredEnemies: Enemy[] = [];
    const maxEnemies = expeditionTemplate.maxEnemies || expeditionTemplate.enemies.length;
    let enemyCount = 0;
    const shuffledPotentialEnemies = [...expeditionTemplate.enemies].sort(() => 0.5 - Math.random());

    for (const expEnemy of shuffledPotentialEnemies) {
        if (maxEnemies > 0 && enemyCount >= maxEnemies) break;
        if (Math.random() * 100 < expEnemy.spawnChance) {
            const enemyTemplate = allEnemies.find(e => e.id === expEnemy.enemyId);
            if (enemyTemplate) {
                encounteredEnemies.push({ ...enemyTemplate, uniqueId: crypto.randomUUID() });
                enemyCount++;
            }
        }
    }

    let overallIsVictory = true;
    const overallCombatLog: CombatLogEntry[] = [];
    let tempChar = JSON.parse(JSON.stringify(character));

    for (const enemy of encounteredEnemies) {
        const fightResult = simulateFight(tempChar, enemy, allItemTemplates);
        overallCombatLog.push(...fightResult.combatLog);
        
        if (fightResult.isVictory) {
            tempChar.stats.currentHealth = fightResult.finalPlayerHealth;
            tempChar.stats.currentMana = fightResult.finalPlayerMana;
        } else {
            overallIsVictory = false;
            tempChar.stats.currentHealth = Math.max(0, fightResult.finalPlayerHealth);
            break; 
        }
    }
    
    let updatedChar = JSON.parse(JSON.stringify(character));
    updatedChar.stats.currentHealth = tempChar.stats.currentHealth;

    const summary: ExpeditionRewardSummary = {
        rewardBreakdown: [],
        totalGold: 0, totalExperience: 0,
        combatLog: overallCombatLog,
        isVictory: overallIsVictory,
        itemsFound: [],
        essencesFound: {},
    };

    if (overallIsVictory) {
        let totalGold = 0;
        let totalExperience = 0;

        const baseGold = Math.floor(Math.random() * (expeditionTemplate.maxBaseGoldReward - expeditionTemplate.minBaseGoldReward + 1)) + expeditionTemplate.minBaseGoldReward;
        const baseExp = Math.floor(Math.random() * (expeditionTemplate.maxBaseExperienceReward - expeditionTemplate.minBaseExperienceReward + 1)) + expeditionTemplate.minBaseExperienceReward;
        
        summary.rewardBreakdown.push({ source: expeditionTemplate.name, gold: baseGold, experience: baseExp });
        totalGold += baseGold;
        totalExperience += baseExp;

        for (const enemy of encounteredEnemies) {
            const gold = Math.floor(Math.random() * (enemy.rewards.maxGold - enemy.rewards.minGold + 1)) + enemy.rewards.minGold;
            const exp = Math.floor(Math.random() * (enemy.rewards.maxExperience - enemy.rewards.minExperience + 1)) + enemy.rewards.minExperience;
            summary.rewardBreakdown.push({ source: enemy.name, gold: gold, experience: exp });
            totalGold += gold;
            totalExperience += exp;
            
            (enemy.lootTable || []).forEach((drop: LootDrop) => {
                if (Math.random() * 100 < drop.chance) {
                    summary.itemsFound.push({ uniqueId: crypto.randomUUID(), templateId: drop.templateId });
                }
            });
            (enemy.resourceLootTable || []).forEach((drop: ResourceDrop) => {
                if (Math.random() * 100 < drop.chance) {
                    const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                    summary.essencesFound[drop.resource] = (summary.essencesFound[drop.resource] || 0) + amount;
                }
            });
        }
        
        (expeditionTemplate.lootTable || []).forEach((drop: LootDrop) => {
            if (Math.random() * 100 < drop.chance) {
                summary.itemsFound.push({ uniqueId: crypto.randomUUID(), templateId: drop.templateId });
            }
        });
        (expeditionTemplate.resourceLootTable || []).forEach((drop: ResourceDrop) => {
            if (Math.random() * 100 < drop.chance) {
                const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
                summary.essencesFound[drop.resource] = (summary.essencesFound[drop.resource] || 0) + amount;
            }
        });

        if (character.race === Race.Human) totalExperience = Math.floor(totalExperience * 1.1);
        if (character.race === Race.Gnome) totalGold = Math.floor(totalGold * 1.2);
        
        summary.totalGold = totalGold;
        summary.totalExperience = totalExperience;

        updatedChar.resources.gold += totalGold;
        updatedChar.experience += totalExperience;
        updatedChar.inventory.push(...summary.itemsFound);
        for (const key in summary.essencesFound) {
            const essenceType = key as EssenceType;
            updatedChar.resources[essenceType] = (updatedChar.resources[essenceType] || 0) + summary.essencesFound[essenceType]!;
        }
    }

    while (updatedChar.experience >= updatedChar.experienceToNextLevel) {
        updatedChar.experience -= updatedChar.experienceToNextLevel;
        updatedChar.level += 1;
        updatedChar.stats.statPoints += 1;
        updatedChar.experienceToNextLevel = Math.floor(100 * Math.pow(updatedChar.level, 1.3));
    }

    updatedChar.activeExpedition = null;
    updatedChar.lastReward = summary;
    
    return updatedChar;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// FIX: Add explicit types for req, res, and next to resolve overload errors and property access errors.
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401); // Unauthorized
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
        if (!result.rowCount) {
            return res.sendStatus(403); // Forbidden
        }
        req.user = { id: result.rows[0].user_id };
        next();
    } catch (err) {
        console.error('Authentication error:', err);
        res.sendStatus(500);
    } finally {
        if (client) client.release();
    }
};

const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    // This middleware assumes 'authenticate' has already run.
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required." });
    }
    
    // Check if the authenticated user has ID 1 (admin)
    if (req.user.id !== 1) {
        return res.status(403).json({ message: "Forbidden: Administrator access required." });
    }
    
    next();
};

// --- API Router ---
const apiRouter = express.Router();


// --- Authentication Endpoints ---
// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    console.log(`Received registration request for user: ${username}`);

    if (!username || !password || password.length < 4) {
        console.log(`Validation error for user ${username}: invalid data.`);
        return res.status(400).json({ message: 'Username and password (min. 4 characters) are required.' });
    }

    let client;
    try {
        const { salt, hash } = hashPassword(password);
        client = await pool.connect();
        
        let result;

        if (username === 'Kazujoshi') {
            console.log("Special registration for admin user 'Kazujoshi'.");
            const user1Res = await client.query('SELECT username FROM users WHERE id = 1');
            if (user1Res.rowCount != null && user1Res.rowCount > 0 && user1Res.rows[0].username !== 'Kazujoshi') {
                 return res.status(409).json({ message: "User ID 1 is already taken by another user. Cannot create admin account." });
            }

            result = await client.query(
                `INSERT INTO users (id, username, password_hash, salt) VALUES (1, $1, $2, $3) 
                 ON CONFLICT (id) DO UPDATE SET 
                    username = EXCLUDED.username, 
                    password_hash = EXCLUDED.password_hash, 
                    salt = EXCLUDED.salt
                 RETURNING id`,
                [username, hash, salt]
            );
            // After inserting ID 1, ensure the sequence is updated to the max ID so the next user doesn't collide.
            await client.query("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));");
        } else {
             // Standard user registration
             result = await client.query(
                'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3) RETURNING id',
                [username, hash, salt]
            );
        }

        console.log(`User ${username} registered successfully with ID: ${result.rows[0].id}`);
        res.status(201).json({ message: 'User created successfully.', userId: result.rows[0].id });
    } catch (err: any) {
        if (err.code === '23505') { // unique_violation for username
            console.log(`Registration error: Username ${username} is already taken.`);
            return res.status(409).json({ message: 'This username is already taken.' });
        }
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    console.log(`[LOGIN_START] Attempting login for user: ${username}`);

    if (!username || !password) {
        console.log('[LOGIN_FAIL] Validation failed: Missing username or password.');
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    
    let client;
    try {
        console.log(`[LOGIN_DB_FETCH] Acquiring client and querying for user '${username}'...`);
        client = await pool.connect();
        const userRes = await client.query('SELECT id, password_hash, salt FROM users WHERE username = $1', [username]);
        
        if (!userRes.rowCount) {
            console.log(`[LOGIN_FAIL] User '${username}' not found in database.`);
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        const user = userRes.rows[0];
        console.log(`[LOGIN_DB_FETCH_SUCCESS] Found user with ID: ${user.id}`);

        console.log(`[LOGIN_PW_VERIFY] Verifying password for user ID: ${user.id}`);
        const isPasswordValid = verifyPassword(password, user.salt, user.password_hash);
        
        if (!isPasswordValid) {
            console.log(`[LOGIN_FAIL] Password verification failed for user ID: ${user.id}`);
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        console.log(`[LOGIN_PW_VERIFY_SUCCESS] Password is valid.`);

        console.log(`[LOGIN_TOKEN_GEN] Generating session token...`);
        const token = randomBytes(64).toString('hex');
        console.log(`[LOGIN_SESSION_INSERT] Inserting session token into database for user ID: ${user.id}`);
        await client.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
        console.log(`[LOGIN_SUCCESS] Session created. Sending token to client.`);

        return res.status(200).json({ message: 'Logged in successfully.', token });

    } catch (err) {
        console.error('[LOGIN_ERROR] An unexpected error occurred during the login process:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) {
            client.release();
            console.log('[LOGIN_END] Client released. Login process finished.');
        }
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/auth/logout', authenticate, async (req: Request, res: Response) => {
     const authHeader = req.headers['authorization'];
     const token = authHeader && authHeader.split(' ')[1];
     let client;
     try {
         client = await pool.connect();
         await client.query('DELETE FROM sessions WHERE token = $1', [token]);
         res.status(200).json({ message: 'Logged out successfully.' });
     } catch(err) {
        console.error('Logout error:', err);
        res.status(500).json({ message: 'Internal server error.' });
     } finally {
        if (client) client.release();
     }
});

// --- Admin User Management ---
// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/users', authenticate, isAdmin, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT id, username FROM users ORDER BY username ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.delete('/users/:id', authenticate, isAdmin, async (req: Request, res: Response) => {
    const userIdToDelete = parseInt(req.params.id, 10);

    if (isNaN(userIdToDelete)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    if (req.user!.id === userIdToDelete) {
        return res.status(403).json({ message: "You cannot delete your own account." });
    }

    let client;
    try {
        client = await pool.connect();
        // Thanks to `ON DELETE CASCADE`, deleting from `users` will also remove
        // the user's character and sessions.
        const result = await client.query('DELETE FROM users WHERE id = $1', [userIdToDelete]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});


// --- Character Endpoints (protected) ---
// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/character', authenticate, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        const characterResult = await client.query(
            `SELECT c.data, u.username 
             FROM characters c
             JOIN users u ON c.user_id = u.id
             WHERE c.user_id = $1`, 
            [req.user!.id]
        );
        if (!characterResult.rowCount) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        let character: PlayerCharacter = characterResult.rows[0].data;
        character.username = characterResult.rows[0].username;
        character.id = req.user!.id;
        
        const gameDataRes = await client.query('SELECT key, data FROM game_data');
        const gameData = gameDataRes.rows.reduce((acc, row) => {
            acc[row.key] = row.data;
            return acc;
        }, {} as any);

        let expeditionCompleted = false;
        if (character.activeExpedition && character.activeExpedition.finishTime <= Date.now()) {
            character = await completeExpedition(character, gameData.expeditions, gameData.enemies, gameData.itemTemplates);
            expeditionCompleted = true;
        }

        let needsDbUpdate = expeditionCompleted;

        const itemTemplates: ItemTemplate[] = gameData.itemTemplates || [];
        // Calculate derived stats once to get max values needed for logic
        const tempDerivedChar = calculateDerivedStatsOnServer(character, itemTemplates);
        const currentMaxEnergy = tempDerivedChar.stats.maxEnergy;

        // --- Offline Energy Regeneration Logic ---
        const now = Date.now();
        const lastUpdate = character.lastEnergyUpdateTime || now;
        const hoursPassed = Math.floor((now - lastUpdate) / (1000 * 60 * 60));
        
        if (hoursPassed > 0 && character.stats.currentEnergy < currentMaxEnergy) {
            const energyToRegen = hoursPassed;
            // Update the BASE character object
            character.stats.currentEnergy = Math.min(
                currentMaxEnergy,
                character.stats.currentEnergy + energyToRegen
            );
            character.lastEnergyUpdateTime = lastUpdate + hoursPassed * (1000 * 60 * 60);
            needsDbUpdate = true;
        }
        
        const currentHour = new Date().getUTCHours();
        const characterLastUpdateDate = new Date(lastUpdate);
        const characterLastPurchaseHour = characterLastUpdateDate.getUTCHours();
        if(currentHour !== characterLastPurchaseHour){
            character.traderPurchases = [];
            needsDbUpdate = true;
        }

        if (needsDbUpdate) {
            // Save the updated BASE character, not the one with derived stats
            await client.query(
                'UPDATE characters SET data = $1 WHERE user_id = $2',
                [JSON.stringify(character), req.user!.id]
            );
        }

        // Now create the final response object with up-to-date derived stats
        const finalResponseCharacter = calculateDerivedStatsOnServer(character, itemTemplates);
        res.status(200).json(finalResponseCharacter);

    } catch (err) {
        console.error('Error fetching character:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/character', authenticate, async (req: Request, res: Response) => {
    const characterData = req.body;
    if (!characterData || !characterData.name || !characterData.race) {
        return res.status(400).json({ message: 'Invalid character data.' });
    }
    let client;
    try {
        client = await pool.connect();
        
        // When creating a character, we save the base data directly.
        // No need to calculate derived stats as there's no equipment yet.
        const result = await client.query(
            `INSERT INTO characters (user_id, data) VALUES ($1, $2) RETURNING data;`,
            [req.user!.id, JSON.stringify(characterData)]
        );
        res.status(201).json(result.rows[0].data);
    } catch (err: any) {
        if (err.code === '23505') { // unique_violation
            console.error('Error creating character: A character for this user already exists.', err);
            return res.status(409).json({ message: 'A character for this user already exists.' });
        }
        console.error('Error creating character:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.put('/character', authenticate, async (req: Request, res: Response) => {
    const characterData = req.body;
     if (!characterData || !characterData.name || !characterData.race) {
        return res.status(400).json({ message: 'Invalid character data.' });
    }
    let client;
    try {
        client = await pool.connect();
        
        // The client sends the base character data with updates (e.g., spent stat points).
        // The server should save this data directly without recalculating derived stats.
        const result = await client.query(
            'UPDATE characters SET data = $1 WHERE user_id = $2 RETURNING data',
            [JSON.stringify(characterData), req.user!.id]
        );
         if (!result.rowCount) {
            return res.status(404).json({ message: 'Character not found to update.' });
        }
        // Respond with the saved base data. The client will handle recalculating derived stats.
        res.status(200).json(result.rows[0].data);
    } catch (err) {
        console.error('Error updating character:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/characters/all', authenticate, isAdmin, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`
            SELECT
                c.user_id,
                u.username,
                c.data->>'name' as name,
                c.data->>'race' as race,
                (c.data->>'level')::int as level
            FROM characters c
            JOIN users u ON c.user_id = u.id
            ORDER BY u.username ASC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching all characters:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/characters/names', authenticate, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`SELECT data->>'name' as name FROM characters`);
        const names = result.rows.map(r => r.name);
        res.status(200).json(names);
    } catch (err) {
        console.error('Error fetching character names:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});


// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.delete('/characters/:userId', authenticate, isAdmin, async (req: Request, res: Response) => {
    const userIdToDelete = parseInt(req.params.userId, 10);

    if (isNaN(userIdToDelete)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    if (req.user!.id === userIdToDelete) {
        return res.status(403).json({ message: "You cannot delete your own character this way. Delete your account instead." });
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query('DELETE FROM characters WHERE user_id = $1', [userIdToDelete]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Character not found for the specified user.' });
        }

        res.status(200).json({ message: 'Character deleted successfully.' });
    } catch (err) {
        console.error('Error deleting character:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/characters/:userId/reset-stats', authenticate, isAdmin, async (req: Request, res: Response) => {
    const userIdToReset = parseInt(req.params.userId, 10);
    
    if (isNaN(userIdToReset)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    let client;
    try {
        client = await pool.connect();

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userIdToReset]);
        if (!charRes.rowCount) {
            return res.status(404).json({ message: 'Character not found for the specified user.' });
        }

        const character = charRes.rows[0].data;

        // Reset logic
        const level = character.level || 1;
        const newStatPoints = 10 + (level - 1); // 10 base points + 1 per level after 1

        character.stats.strength = 0;
        character.stats.agility = 0;
        character.stats.accuracy = 0;
        character.stats.stamina = 0;
        character.stats.intelligence = 0;
        character.stats.energy = 0;
        character.stats.statPoints = newStatPoints;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userIdToReset]);

        res.status(200).json({ message: 'Character stats reset successfully.' });

    } catch (err) {
        console.error('Error resetting character stats:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/characters/:userId/heal', authenticate, isAdmin, async (req: Request, res: Response) => {
    const userIdToHeal = parseInt(req.params.userId, 10);
    
    if (isNaN(userIdToHeal)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    let client;
    try {
        client = await pool.connect();
        
        // Fetch character data
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userIdToHeal]);
        if (!charRes.rowCount) {
            return res.status(404).json({ message: 'Character not found for the specified user.' });
        }
        const character = charRes.rows[0].data;

        // Fetch item templates to calculate max health
        const itemTemplatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates = itemTemplatesRes.rowCount ? itemTemplatesRes.rows[0].data : [];

        // Calculate max health using the helper
        const derived = calculateDerivedStatsOnServer(character, itemTemplates);

        // Update character's health and mana
        character.stats.currentHealth = derived.stats.maxHealth;
        character.stats.currentMana = derived.stats.maxMana;

        // Save updated character data
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userIdToHeal]);

        res.status(200).json({ message: 'Character healed successfully.' });

    } catch (err) {
        console.error('Error healing character:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});


// --- Ranking Endpoint ---
const calculateTotalExperience = (level: number, currentExperience: number): number => {
    let totalExperience = currentExperience;
    for (let i = 1; i < level; i++) {
        totalExperience += Math.floor(100 * Math.pow(i, 1.3));
    }
    return totalExperience;
};

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/ranking', async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        // Fetch all characters without SQL ordering
        const result = await client.query(`
            SELECT 
                c.user_id as id,
                c.data 
            FROM characters c
            JOIN users u ON c.user_id = u.id;
        `);
        
        // Map and calculate total experience
        const rankingData = result.rows.map(row => {
            const char = row.data;
            const totalExperience = calculateTotalExperience(char.level, char.experience || 0);
            return {
                id: row.id,
                name: char.name,
                race: char.race,
                level: char.level,
                experience: totalExperience, // This is now total experience
                pvpWins: char.pvpWins || 0,
                pvpLosses: char.pvpLosses || 0,
                pvpProtectionUntil: char.pvpProtectionUntil || 0,
            };
        });

        // Sort the data in Node.js based on total experience
        rankingData.sort((a, b) => {
            if (b.experience !== a.experience) {
                return b.experience - a.experience;
            }
            // Use name as a tie-breaker
            return a.name.localeCompare(b.name);
        });

        res.status(200).json(rankingData);
    } catch (err) {
        console.error('Error fetching ranking data:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// --- Game Data Endpoints ---
// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/game-data', async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT key, data FROM game_data');
        const gameData = result.rows.reduce((acc, row) => {
            acc[row.key] = row.data;
            return acc;
        }, {} as { [key: string]: any });
        res.status(200).json(gameData);
    } catch (err) {
        console.error('Error fetching game data:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.put('/game-data', authenticate, isAdmin, async (req: Request, res: Response) => {
    const { key, data } = req.body;
    const validKeys = ['locations', 'expeditions', 'enemies', 'settings', 'itemTemplates', 'quests'];
    if (!key || !validKeys.includes(key) || data === undefined) {
        return res.status(400).json({ message: 'Invalid key or data.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query(
            `INSERT INTO game_data (key, data) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET data = $2;`,
             [key, JSON.stringify(data)]
        );
        res.status(200).json({ message: `Data for '${key}' updated successfully.`});
    } catch (err) {
        console.error(`Error updating data for key ${key}:`, err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// --- Trader Endpoint ---
apiRouter.get('/trader/inventory', authenticate, async (req: Request, res: Response) => {
    const forceRefresh = req.query.force === 'true';
    const currentHour = new Date().getUTCHours();
    
    if (forceRefresh || traderInventoryCache.lastRefreshedHour !== currentHour) {
        let client;
        try {
            client = await pool.connect();
            const [itemTemplatesRes, settingsRes] = await Promise.all([
                client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'"),
                client.query("SELECT data FROM game_data WHERE key = 'settings'")
            ]);
            
            const itemTemplates: ItemTemplate[] = itemTemplatesRes.rowCount ? itemTemplatesRes.rows[0].data : [];
            const settings: GameSettings = settingsRes.rowCount ? settingsRes.rows[0].data : { language: 'en' };
            
            traderInventoryCache.inventory = generateTraderInventory(itemTemplates, settings);
            traderInventoryCache.lastRefreshedHour = currentHour;
            console.log(`Trader inventory refreshed for hour: ${currentHour}`);
            
        } catch (err) {
            console.error('Error refreshing trader inventory:', err);
            if (traderInventoryCache.inventory.length > 0) {
                 return res.status(200).json(traderInventoryCache.inventory);
            }
            return res.status(500).json({ message: 'Internal server error while generating trader inventory.' });
        } finally {
            if (client) client.release();
        }
    }
    
    let client;
    try {
        client = await pool.connect();
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [req.user!.id]);
        if (!charRes.rowCount) {
            return res.status(404).json({ message: "Character not found." });
        }
        const character: PlayerCharacter = charRes.rows[0].data;
        const purchasedIds = character.traderPurchases || [];
        const personalInventory = traderInventoryCache.inventory.filter(item => !purchasedIds.includes(item.uniqueId));
        res.status(200).json(personalInventory);
    } catch (err) {
        console.error('Error fetching personal trader inventory:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

apiRouter.post('/trader/buy', authenticate, async (req, res) => {
    const { itemId } = req.body;
    if (!itemId) {
        return res.status(400).json({ message: 'Item ID is required.' });
    }

    let client;
    try {
        client = await pool.connect();
        
        const itemToBuy = traderInventoryCache.inventory.find(i => i.uniqueId === itemId);
        if (!itemToBuy) {
            return res.status(404).json({ message: 'Item not found in trader inventory.' });
        }

        const itemTemplatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates: ItemTemplate[] = itemTemplatesRes.rowCount ? itemTemplatesRes.rows[0].data : [];
        const template = itemTemplates.find(t => t.id === itemToBuy.templateId);
        if (!template) {
            return res.status(500).json({ message: 'Item template data is missing.' });
        }
        
        const cost = template.value * 2;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [req.user!.id]);
        if (!charRes.rowCount) {
            return res.status(404).json({ message: 'Character not found.' });
        }
        
        let character: PlayerCharacter = charRes.rows[0].data;

        if (character.traderPurchases?.includes(itemId)) {
            return res.status(400).json({ message: 'You have already purchased this item.' });
        }
        if (character.resources.gold < cost) {
            return res.status(400).json({ message: 'Not enough gold.' });
        }
        if (character.inventory.length >= 40) { // MAX_PLAYER_INVENTORY_SIZE
            return res.status(400).json({ message: 'Your inventory is full.' });
        }

        character.resources.gold -= cost;
        character.inventory.push(itemToBuy);
        if (!character.traderPurchases) {
            character.traderPurchases = [];
        }
        character.traderPurchases.push(itemId);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user!.id]);

        // Respond with the updated base character data
        res.status(200).json(character);

    } catch (err) {
        console.error('Error buying item:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// --- Messages Endpoints ---
// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/messages', authenticate, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'SELECT * FROM messages WHERE recipient_id = $1 ORDER BY created_at DESC',
            [req.user!.id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/messages', authenticate, async (req: Request, res: Response) => {
    const { recipientName, subject, content } = req.body;
    const senderId = req.user!.id;

    if (!recipientName || !subject || !content) {
        return res.status(400).json({ message: 'Recipient, subject, and content are required.' });
    }

    let client;
    try {
        client = await pool.connect();
        
        const recipientRes = await client.query(`SELECT user_id FROM characters WHERE data->>'name' = $1`, [recipientName]);
        if (!recipientRes.rowCount) {
            return res.status(404).json({ message: 'Recipient not found.' });
        }
        const recipientId = recipientRes.rows[0].user_id;

        const senderRes = await client.query(`SELECT data->>'name' as name FROM characters WHERE user_id = $1`, [senderId]);
        if (!senderRes.rowCount) {
            return res.status(404).json({ message: 'Sender character not found.' });
        }
        const senderName = senderRes.rows[0].name;

        if (recipientId === senderId) {
            return res.status(400).json({ message: "You cannot send a message to yourself." });
        }

        const body = { content };
        const messageType = 'player_message';

        const result = await client.query(
            'INSERT INTO messages (recipient_id, sender_id, sender_name, message_type, subject, body) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
// FIX: Corrected a corrupted line of code that was causing multiple errors. The query parameters were missing and replaced with junk text. I have restored the correct parameters to complete the database query.
            [recipientId, senderId, senderName, messageType, subject, JSON.stringify(body)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

apiRouter.put('/messages/:id', authenticate, async (req: Request, res: Response) => {
    const messageId = parseInt(req.params.id, 10);
    const { is_read } = req.body;

    if (isNaN(messageId) || typeof is_read !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request data.' });
    }

    let client;
    try {
        client = await pool.connect();
        // Ensure the user can only modify their own messages
        const result = await client.query(
            'UPDATE messages SET is_read = $1 WHERE id = $2 AND recipient_id = $3 RETURNING *',
            [is_read, messageId, req.user!.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Message not found or you do not have permission to modify it.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating message:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

apiRouter.delete('/messages/:id', authenticate, async (req: Request, res: Response) => {
    const messageId = parseInt(req.params.id, 10);

    if (isNaN(messageId)) {
        return res.status(400).json({ message: 'Invalid message ID.' });
    }

    let client;
    try {
        client = await pool.connect();
        // Ensure user can only delete their own messages
        const result = await client.query(
            'DELETE FROM messages WHERE id = $1 AND recipient_id = $2',
            [messageId, req.user!.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Message not found or you do not have permission to delete it.' });
        }
        res.status(204).send(); // No content
    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// --- Tavern Endpoints ---
apiRouter.get('/tavern/messages', authenticate, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'SELECT * FROM tavern_messages ORDER BY created_at ASC LIMIT 50' // Get last 50 messages
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching tavern messages:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

apiRouter.post('/tavern/messages', authenticate, async (req: Request, res: Response) => {
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: 'Message content cannot be empty.' });
    }

    let client;
    try {
        client = await pool.connect();
        
        // Get character name for the message
        const charRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [userId]);
        if (!charRes.rowCount) {
            return res.status(404).json({ message: 'Character not found for this user.' });
        }
        const characterName = charRes.rows[0].name;

        const result = await client.query(
            'INSERT INTO tavern_messages (user_id, character_name, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, characterName, content.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error posting tavern message:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});


// Mount the API router
app.use('/api', apiRouter);

// Serve static assets in production
app.use(express.static(path.join(__dirname, '..', '..', '..', '..', 'dist')));

// For any other request, serve the index.html file
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', '..', '..', 'dist', 'index.html'));
});

// Start the server after DB initialization
initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("Failed to initialize database. Server will not start.", err);
        exit(1);
    });