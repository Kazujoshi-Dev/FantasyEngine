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
import { PlayerCharacter, ItemTemplate, EquipmentSlot, CharacterStats, Race, MagicAttackType, CombatLogEntry, PvpRewardSummary, Enemy, GameSettings } from '../../types.js';


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
        const result = await client.query(
            'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3) RETURNING id',
            [username, hash, salt]
        );
        console.log(`User ${username} registered successfully with ID: ${result.rows[0].id}`);
        res.status(201).json({ message: 'User created successfully.', userId: result.rows[0].id });
    } catch (err: any) {
        if (err.code === '23505') { // unique_violation
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
apiRouter.get('/users', authenticate, async (req: Request, res: Response) => {
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
apiRouter.delete('/users/:id', authenticate, async (req: Request, res: Response) => {
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

        const itemTemplatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates: ItemTemplate[] = itemTemplatesRes.rowCount ? itemTemplatesRes.rows[0].data : [];

        let character: PlayerCharacter = characterResult.rows[0].data;
        character.username = characterResult.rows[0].username;
        character.id = req.user!.id;
        
        let needsDbUpdate = false;

        const characterWithDerivedStats = calculateDerivedStatsOnServer(character, itemTemplates);
        const currentMaxEnergy = characterWithDerivedStats.stats.maxEnergy;

        // --- Offline Energy Regeneration Logic ---
        const now = Date.now();

        if (!character.lastEnergyUpdateTime) {
            character.lastEnergyUpdateTime = Math.floor(now / (1000 * 60 * 60)) * (1000 * 60 * 60);
            needsDbUpdate = true;
        }

        const lastUpdate = character.lastEnergyUpdateTime;
        const hoursPassed = Math.floor((now - lastUpdate) / (1000 * 60 * 60));
        
        if (hoursPassed > 0 && character.stats.currentEnergy < currentMaxEnergy) {
            const energyToRegen = hoursPassed;
            character.stats.currentEnergy = Math.min(
                currentMaxEnergy,
                character.stats.currentEnergy + energyToRegen
            );

            character.lastEnergyUpdateTime = lastUpdate + hoursPassed * (1000 * 60 * 60);
            needsDbUpdate = true;
        }

        if (needsDbUpdate) {
            await client.query(
                'UPDATE characters SET data = $1 WHERE user_id = $2',
                [JSON.stringify(character), req.user!.id]
            );
        }

        res.status(200).json(character);
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
        const result = await client.query(
            'UPDATE characters SET data = $1 WHERE user_id = $2 RETURNING data',
            [JSON.stringify(characterData), req.user!.id]
        );
         if (!result.rowCount) {
            return res.status(404).json({ message: 'Character not found to update.' });
        }
        res.status(200).json(result.rows[0].data);
    } catch (err) {
        console.error('Error updating character:', err);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/characters/all', authenticate, async (req: Request, res: Response) => {
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
apiRouter.delete('/characters/:userId', authenticate, async (req: Request, res: Response) => {
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
apiRouter.post('/characters/:userId/reset-stats', authenticate, async (req: Request, res: Response) => {
    const userIdToReset = parseInt(req.params.userId, 10);
    
    if (isNaN(userIdToReset)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    let client;
    try {
        client = await pool.connect();

        const adminUserRes = await client.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (!adminUserRes.rowCount || adminUserRes.rows[0].username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Permission denied. Administrator access required.' });
        }

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
apiRouter.post('/characters/:userId/heal', authenticate, async (req: Request, res: Response) => {
    const userIdToHeal = parseInt(req.params.userId, 10);
    
    if (isNaN(userIdToHeal)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    let client;
    try {
        client = await pool.connect();
        
        // Admin check
        const adminUserRes = await client.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (!adminUserRes.rowCount || adminUserRes.rows[0].username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Permission denied. Administrator access required.' });
        }
        
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
apiRouter.put('/game-data', authenticate, async (req: Request, res: Response) => {
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


// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.put('/messages/:id', authenticate, async (req: Request, res: Response) => {
    const messageId = parseInt(req.params.id, 10);
    const { is_read } = req.body;

    if (isNaN(messageId) || typeof is_read !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request data' });
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'UPDATE messages SET is_read = $1 WHERE id = $2 AND recipient_id = $3',
            [is_read, messageId, req.user!.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Message not found or permission denied' });
        }
        res.status(200).json({ message: 'Message updated' });
    } catch (err) {
        console.error('Error updating message:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.delete('/messages/:id', authenticate, async (req: Request, res: Response) => {
    const messageId = parseInt(req.params.id, 10);
    if (isNaN(messageId)) {
        return res.status(400).json({ message: 'Invalid message ID' });
    }
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'DELETE FROM messages WHERE id = $1 AND recipient_id = $2',
            [messageId, req.user!.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Message not found or permission denied' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});


// --- PvP Endpoint ---
// This is the full implementation of the PvP logic on the backend.
// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/pvp/attack/:defenderId', authenticate, async (req: Request, res: Response) => {
    const attackerId = req.user!.id;
    const defenderId = parseInt(req.params.defenderId, 10);

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Fetch all necessary data
        const itemTemplatesRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
        const itemTemplates: ItemTemplate[] = itemTemplatesRes.rows[0].data;
        
        const settingsRes = await client.query("SELECT data FROM game_data WHERE key = 'settings'");
        const settings: GameSettings = settingsRes.rowCount ? settingsRes.rows[0].data : { language: 'en' };
        const pvpProtectionMinutes = settings.pvpProtectionMinutes ?? 60;

        const attackerRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [attackerId]);
        const defenderRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [defenderId]);

        if (!attackerRes.rowCount || !defenderRes.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'One of the players does not exist.' });
        }

        const attackerBase: PlayerCharacter = attackerRes.rows[0].data;
        if (!attackerBase.stats) attackerBase.stats = {} as CharacterStats;
        if (attackerBase.stats.critDamageModifier === undefined) attackerBase.stats.critDamageModifier = 200;
        if (attackerBase.stats.armorPenetrationPercent === undefined) attackerBase.stats.armorPenetrationPercent = 0;
        if (attackerBase.stats.lifeStealPercent === undefined) attackerBase.stats.lifeStealPercent = 0;
        if (attackerBase.stats.manaStealPercent === undefined) attackerBase.stats.manaStealPercent = 0;
        if (attackerBase.stats.armorPenetrationFlat === undefined) attackerBase.stats.armorPenetrationFlat = 0;
        if (attackerBase.stats.lifeStealFlat === undefined) attackerBase.stats.lifeStealFlat = 0;
        if (attackerBase.stats.manaStealFlat === undefined) attackerBase.stats.manaStealFlat = 0;
        attackerBase.id = attackerId;

        const defenderBase: PlayerCharacter = defenderRes.rows[0].data;
        if (!defenderBase.stats) defenderBase.stats = {} as CharacterStats;
        if (defenderBase.stats.critDamageModifier === undefined) defenderBase.stats.critDamageModifier = 200;
        if (defenderBase.stats.armorPenetrationPercent === undefined) defenderBase.stats.armorPenetrationPercent = 0;
        if (defenderBase.stats.lifeStealPercent === undefined) defenderBase.stats.lifeStealPercent = 0;
        if (defenderBase.stats.manaStealPercent === undefined) defenderBase.stats.manaStealPercent = 0;
        if (defenderBase.stats.armorPenetrationFlat === undefined) defenderBase.stats.armorPenetrationFlat = 0;
        if (defenderBase.stats.lifeStealFlat === undefined) defenderBase.stats.lifeStealFlat = 0;
        if (defenderBase.stats.manaStealFlat === undefined) defenderBase.stats.manaStealFlat = 0;
        defenderBase.id = defenderId;

        const attacker = calculateDerivedStatsOnServer(attackerBase, itemTemplates);
        const defender = calculateDerivedStatsOnServer(defenderBase, itemTemplates);
        
        // --- Validation ---
        if (attackerId === defenderId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "You can't attack yourself." });
        }
        if (Math.abs(attacker.level - defender.level) > 3) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'You can only attack players within +/- 3 levels.' });
        }
        if (attacker.stats.currentEnergy < 3) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Not enough energy to attack (costs 3).' });
        }
        if (defender.pvpProtectionUntil && defender.pvpProtectionUntil > Date.now()) {
            await client.query('ROLLBACK');
            const timeLeft = Math.ceil((defender.pvpProtectionUntil - Date.now()) / 1000 / 60);
            return res.status(400).json({ message: `This player is protected from attacks for another ${timeLeft} minutes.` });
        }

        // --- Combat Simulation ---
        const combatLog: CombatLogEntry[] = [];
        let turn = 1, attackerHealth = attacker.stats.currentHealth, defenderHealth = defender.stats.currentHealth;
        let attackerMana = attacker.stats.currentMana, defenderMana = defender.stats.currentMana;

        const agilityDifference = attacker.stats.agility - defender.stats.agility;
        const firstStrikeChance = Math.max(10, Math.min(90, 50 + agilityDifference * 2));

        while(attackerHealth > 0 && defenderHealth > 0 && turn < 50) {
            attackerMana = Math.min(attacker.stats.maxMana, attackerMana + attacker.stats.manaRegen);
            defenderMana = Math.min(defender.stats.maxMana, defenderMana + defender.stats.manaRegen);
        
            const attackerGoesFirst = (turn === 1 && attacker.race === Race.Elf) || Math.random() * 100 < firstStrikeChance;
        
            const attackerTurn = () => {
                const attacksPerRound = attacker.stats.attacksPerRound || 1;
                for (let i = 0; i < attacksPerRound; i++) {
                    if (defenderHealth <= 0) break;
                    
                    const mainHandItem = attacker.equipment[EquipmentSlot.MainHand] || attacker.equipment[EquipmentSlot.TwoHand];
                    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
                    
                    let damage: number, isCrit: boolean, magicAttackType: MagicAttackType | undefined, damageReduced = 0;
                    const manaCost = mainHandTemplate?.manaCost || 0;
                    const isMagicAttack = mainHandTemplate?.isMagical && attackerMana >= manaCost;
        
                    if (isMagicAttack && mainHandTemplate) {
                        attackerMana -= manaCost;
                        damage = Math.floor(Math.random() * (attacker.stats.magicDamageMax - attacker.stats.magicDamageMin + 1)) + attacker.stats.magicDamageMin;
                        magicAttackType = mainHandTemplate.magicAttackType;
                    } else {
                        damage = Math.floor(Math.random() * (attacker.stats.maxDamage - attacker.stats.minDamage + 1)) + attacker.stats.minDamage;
                    }
                    
                    isCrit = Math.random() * 100 < attacker.stats.critChance;
                    if (isCrit) damage = Math.floor(damage * (attacker.stats.critDamageModifier / 100));
                    if (attacker.race === Race.Orc && attackerHealth < attacker.stats.maxHealth * 0.25) damage = Math.floor(damage * 1.25);
                    
                    let finalDamageDealt;
                    let isDodge = false;
                    if (defender.race === Race.Gnome && Math.random() < 0.1) {
                        finalDamageDealt = 0;
                        isDodge = true;
                    } else if (isMagicAttack) {
                        finalDamageDealt = damage;
                    } else {
                        if (defender.race === Race.Dwarf && defenderHealth < defender.stats.maxHealth * 0.5) {
                            const originalDmg = damage;
                            damage = Math.floor(damage * 0.8);
                            damageReduced = originalDmg - damage;
                        }
                        const armorAfterPen = Math.max(0, defender.stats.armor * (1 - (attacker.stats.armorPenetrationPercent / 100)) - attacker.stats.armorPenetrationFlat);
                        finalDamageDealt = Math.max(0, damage - armorAfterPen);
                    }
        
                    const actualDamageDealt = Math.min(defenderHealth, finalDamageDealt);
                    defenderHealth = Math.max(0, defenderHealth - actualDamageDealt);
                    
                    const healthGained = Math.min(attacker.stats.maxHealth - attackerHealth, Math.floor(actualDamageDealt * (attacker.stats.lifeStealPercent / 100)) + attacker.stats.lifeStealFlat);
                    if (healthGained > 0) attackerHealth += healthGained;
                    
                    const manaGained = Math.min(attacker.stats.maxMana - attackerMana, Math.floor(actualDamageDealt * (attacker.stats.manaStealPercent / 100)) + attacker.stats.manaStealFlat);
                    if (manaGained > 0) attackerMana += manaGained;
        
                    combatLog.push({
                        turn, attacker: attacker.name, defender: defender.name, action: 'attacks', damage: actualDamageDealt, isCrit,
                        playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana,
                        magicAttackType, damageReduced, weaponName: mainHandTemplate?.name, healthGained, manaGained, isDodge
                    });
                }
            };
            
            const defenderTurn = () => {
                const attacksPerRound = defender.stats.attacksPerRound || 1;
                for (let i = 0; i < attacksPerRound; i++) {
                    if (attackerHealth <= 0) break;
        
                    const mainHandItem = defender.equipment[EquipmentSlot.MainHand] || defender.equipment[EquipmentSlot.TwoHand];
                    const mainHandTemplate = mainHandItem ? itemTemplates.find(t => t.id === mainHandItem.templateId) : null;
                    
                    let damage: number, isCrit: boolean, magicAttackType: MagicAttackType | undefined, damageReduced = 0;
                    const manaCost = mainHandTemplate?.manaCost || 0;
                    const isMagicAttack = mainHandTemplate?.isMagical && defenderMana >= manaCost;
        
                    if (isMagicAttack && mainHandTemplate) {
                        defenderMana -= manaCost;
                        damage = Math.floor(Math.random() * (defender.stats.magicDamageMax - defender.stats.magicDamageMin + 1)) + defender.stats.magicDamageMin;
                        magicAttackType = mainHandTemplate.magicAttackType;
                    } else {
                        damage = Math.floor(Math.random() * (defender.stats.maxDamage - defender.stats.minDamage + 1)) + defender.stats.minDamage;
                    }
                    
                    isCrit = Math.random() * 100 < defender.stats.critChance;
                    if (isCrit) damage = Math.floor(damage * (defender.stats.critDamageModifier / 100));
                    if (defender.race === Race.Orc && defenderHealth < defender.stats.maxHealth * 0.25) damage = Math.floor(damage * 1.25);
                    
                    let finalDamageDealt;
                    let isDodge = false;
                    if (attacker.race === Race.Gnome && Math.random() < 0.1) {
                        finalDamageDealt = 0;
                        isDodge = true;
                    } else if (isMagicAttack) {
                        finalDamageDealt = damage;
                    } else {
                        if (attacker.race === Race.Dwarf && attackerHealth < attacker.stats.maxHealth * 0.5) {
                            const originalDmg = damage;
                            damage = Math.floor(damage * 0.8);
                            damageReduced = originalDmg - damage;
                        }
                        const armorAfterPen = Math.max(0, attacker.stats.armor * (1 - (defender.stats.armorPenetrationPercent / 100)) - defender.stats.armorPenetrationFlat);
                        finalDamageDealt = Math.max(0, damage - armorAfterPen);
                    }
        
                    const actualDamageDealt = Math.min(attackerHealth, finalDamageDealt);
                    attackerHealth = Math.max(0, attackerHealth - actualDamageDealt);
                    
                    const healthGained = Math.min(defender.stats.maxHealth - defenderHealth, Math.floor(actualDamageDealt * (defender.stats.lifeStealPercent / 100)) + defender.stats.lifeStealFlat);
                    if (healthGained > 0) defenderHealth += healthGained;
                    
                    const manaGained = Math.min(defender.stats.maxMana - defenderMana, Math.floor(actualDamageDealt * (defender.stats.manaStealPercent / 100)) + defender.stats.manaStealFlat);
                    if (manaGained > 0) defenderMana += manaGained;
        
                    combatLog.push({
                        turn, attacker: defender.name, defender: attacker.name, action: 'attacks', damage: actualDamageDealt, isCrit,
                        playerHealth: attackerHealth, playerMana: attackerMana, enemyHealth: defenderHealth, enemyMana: defenderMana,
                        magicAttackType, damageReduced, weaponName: mainHandTemplate?.name, healthGained, manaGained, isDodge
                    });
                }
            };
            
            if (attackerGoesFirst) {
                attackerTurn();
                defenderTurn();
            } else {
                defenderTurn();
                attackerTurn();
            }
        
            turn++;
        }
        
        const isVictory = attackerHealth > 0;
        
        // --- Calculate Rewards & Update Characters ---
        const goldTransfer = isVictory ? Math.floor(defenderBase.resources.gold * 0.1) : Math.floor(attackerBase.resources.gold * 0.1);
        
        const winner = isVictory ? attacker : defender;
        const loser = isVictory ? defender : attacker;
        const levelDifference = winner.level - loser.level;
        const expTransfer = Math.round(Math.max(100, Math.min(300, 200 - (levelDifference * 30))));
        
        attackerBase.stats.currentEnergy -= 3;
        attackerBase.stats.currentHealth = isVictory ? attackerHealth : 1;

        if(isVictory) {
            attackerBase.resources.gold += goldTransfer;
            attackerBase.experience += expTransfer;
            attackerBase.pvpWins = (attackerBase.pvpWins || 0) + 1;

            defenderBase.resources.gold -= goldTransfer;
            defenderBase.pvpLosses = (defenderBase.pvpLosses || 0) + 1;
        } else {
            attackerBase.resources.gold -= goldTransfer;
            attackerBase.pvpLosses = (attackerBase.pvpLosses || 0) + 1;

            defenderBase.resources.gold += goldTransfer;
            defenderBase.experience += expTransfer;
            defenderBase.pvpWins = (defenderBase.pvpWins || 0) + 1;
        }

        defenderBase.pvpProtectionUntil = Date.now() + pvpProtectionMinutes * 60 * 1000;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(attackerBase), attackerId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(defenderBase), defenderId]);

        const result: PvpRewardSummary = {
            isVictory, gold: goldTransfer, experience: expTransfer, combatLog,
            attacker: attacker,
            defender: defender
        };

        const defenderSubject = `Zostałeś zaatakowany przez ${attacker.name}!`;
        await client.query('INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, $2, $3, $4, $5)', [defenderId, 'System', 'pvp_report', defenderSubject, JSON.stringify(result)]);
        const attackerSubject = `Raport z ataku: Zaatakowałeś ${defender.name}!`;
        await client.query('INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, $2, $3, $4, $5)', [attackerId, 'System', 'pvp_report', attackerSubject, JSON.stringify(result)]);

        await client.query('COMMIT');
        res.status(200).json(result);

    } catch (err) {
        if(client) await client.query('ROLLBACK');
        console.error('Error during PvP attack:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/admin/pvp/reset-cooldowns', authenticate, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();

        // Admin check
        const adminUserRes = await client.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
        if (!adminUserRes.rowCount || adminUserRes.rows[0].username !== 'Kazujoshi') {
            return res.status(403).json({ message: 'Permission denied. Administrator access required.' });
        }
        
        // Update all characters. The `jsonb_set` function is used to modify a key inside a JSONB column.
        // The third argument `'{pvpProtectionUntil}'` is the path to the key.
        // The fourth argument `'0'` is the new value (as a JSONB number).
        // The fifth argument `true` creates the key if it doesn't exist.
        await client.query(`
            UPDATE characters
            SET data = jsonb_set(data, '{pvpProtectionUntil}', '0', true);
        `);
        
        res.status(200).json({ message: 'All PvP cooldowns have been reset.' });

    } catch (err) {
        console.error('Error resetting PvP cooldowns:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});


// --- Tavern (Chat) Endpoints ---
// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.get('/tavern/messages', authenticate, async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect();
        
        // Delete messages older than 12 hours
        await client.query("DELETE FROM tavern_messages WHERE created_at < NOW() - INTERVAL '12 hours'");

        // Fetch the last 100 messages, ordered oldest to newest
        const result = await client.query(`
            SELECT * FROM (
                SELECT * FROM tavern_messages ORDER BY created_at DESC LIMIT 100
            ) sub ORDER BY created_at ASC;
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching tavern messages:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// FIX: Add explicit types for req and res to resolve property access errors.
apiRouter.post('/tavern/messages', authenticate, async (req: Request, res: Response) => {
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: 'Message content cannot be empty.' });
    }

    let client;
    try {
        client = await pool.connect();
        // Get character name
        const charRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [userId]);
        if (!charRes.rowCount) {
            return res.status(404).json({ message: 'Character not found to send a message.' });
        }
        const characterName = charRes.rows[0].name;

        // Insert message
        const result = await client.query(
            'INSERT INTO tavern_messages (user_id, character_name, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, characterName, content.trim()]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error sending tavern message:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});



const staticDir = path.resolve(__dirname, '../../../../dist');

// Handle all API routes first
app.use('/api', apiRouter);

// Then, serve static files for the frontend
app.use(express.static(staticDir));

// Fallback for Single Page Applications (SPA)
// This should be the last route. It sends the main index.html file
// for any request that doesn't match a static file or an API route.
// FIX: Add explicit types for req and res to resolve property access errors.
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(staticDir, 'index.html'));
});

const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server due to database initialization error:', error);
        // FIX: Use the imported `exit` function instead of the potentially untyped `process.exit`.
        exit(1);
    }
};

startServer();