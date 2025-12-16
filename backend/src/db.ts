
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { CharacterClass } from './types.js';

dotenv.config();

const dbUser = process.env.DB_USER || process.env.POSTGRES_USER;
const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const dbHost = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const dbName = process.env.DB_NAME || process.env.POSTGRES_DB || 'fantasy_game';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

if (!dbUser || !dbPassword) {
    console.error("FATAL ERROR: Missing database credentials.");
    console.error("Please set DB_USER (or POSTGRES_USER) and DB_PASSWORD (or POSTGRES_PASSWORD) in your environment variables or .env file.");
    (process as any).exit(1);
}

const poolConfig: PoolConfig = {
  user: dbUser,
  password: dbPassword,
  host: dbHost, 
  database: dbName,
  port: dbPort,
  connectionTimeoutMillis: 5000, 
};

console.log(`[Database Config] Host: ${poolConfig.host}, Port: ${poolConfig.port}, User: ${poolConfig.user}, DB: ${poolConfig.database}`);

export const pool = new Pool(poolConfig);

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const initializeDatabase = async (retries = 5, delay = 5000) => {
    while (retries > 0) {
        let client;
        try {
            client = await pool.connect();
            try {
                console.log('Successfully connected to database. Initializing schema...');
                
                // Tabela Users
                await client.query(`
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        salt TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                // Migracja: Email
                try {
                    const emailCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email'");
                    if (emailCol.rowCount === 0) {
                        console.log("MIGRATING SCHEMA: Adding 'email' column to 'users' table...");
                        await client.query("ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE;");
                        console.log("MIGRATION SUCCESS: 'email' column added.");
                    }
                } catch (migErr) {
                    console.error("Migration Error (users.email):", migErr);
                }

                // Tabela Password Resets
                await client.query(`
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        token VARCHAR(255) NOT NULL UNIQUE,
                        expires_at TIMESTAMPTZ NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                // Tabela Characters
                await client.query(`
                    CREATE TABLE IF NOT EXISTS characters (
                        id SERIAL PRIMARY KEY,
                        data JSONB NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);
                
                // Migracja: Character ID Sequence Fix
                try {
                    const idColumnDefault = await client.query(`
                        SELECT column_default
                        FROM information_schema.columns
                        WHERE table_name = 'characters' AND column_name = 'id';
                    `);
                    if (idColumnDefault && idColumnDefault.rowCount != null && idColumnDefault.rowCount > 0 && idColumnDefault.rows[0].column_default === null) {
                        console.log("MIGRATING SCHEMA: Fixing 'characters.id' auto-increment...");
                        await client.query(`CREATE SEQUENCE IF NOT EXISTS characters_id_seq;`);
                        await client.query(`SELECT setval('characters_id_seq', COALESCE((SELECT MAX(id) + 1 FROM characters), 1), false);`);
                        await client.query(`ALTER TABLE characters ALTER COLUMN id SET DEFAULT nextval('characters_id_seq'::regclass);`);
                        await client.query(`ALTER SEQUENCE characters_id_seq OWNED BY characters.id;`);
                    }
                } catch (migErr) {
                    console.error("Migration Error (characters.id seq):", migErr);
                }

                // Migracja: Character user_id
                try {
                    const hasUserIdColumn = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='user_id';`);
                    if (!hasUserIdColumn.rowCount) {
                        console.log("MIGRATING SCHEMA: Adding 'user_id' to 'characters'...");
                        await client.query('ALTER TABLE characters ADD COLUMN user_id INT;');
                        await client.query('ALTER TABLE characters ADD CONSTRAINT fk_characters_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;');
                        await client.query('ALTER TABLE characters ADD CONSTRAINT characters_user_id_key UNIQUE (user_id);');
                    }
                } catch (migErr) { console.error("Migration Error (characters.user_id):", migErr); }
                
                // Migracja: Character guild_id
                try {
                    const hasGuildIdColumn = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='guild_id';`);
                    if (!hasGuildIdColumn.rowCount) {
                         console.log("MIGRATING SCHEMA: Adding 'guild_id' to 'characters'...");
                         await client.query('ALTER TABLE characters ADD COLUMN guild_id INT DEFAULT NULL;');
                    }
                } catch (migErr) { console.error("Migration Error (characters.guild_id):", migErr); }

                // Tabela Sessions
                await client.query(`
                     CREATE TABLE IF NOT EXISTS sessions (
                        token TEXT PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        last_active_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);
                
                // Migracja: Sessions last_active_at (CRITICAL FOR LOGIN)
                try {
                    const hasLastActiveAtColumn = await client.query(`
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='sessions' AND column_name='last_active_at';
                    `);

                    if (!hasLastActiveAtColumn.rowCount) {
                        console.log("MIGRATING SCHEMA: Adding 'last_active_at' column to 'sessions' table...");
                        await client.query('ALTER TABLE sessions ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT NOW();');
                        console.log("MIGRATION SUCCESS: 'last_active_at' column added.");
                    }
                } catch (migErr) {
                    console.error("Migration Error (sessions.last_active_at):", migErr);
                }

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
                        is_saved BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                try {
                    const msgIsSavedCol = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='is_saved';`);
                    if (!msgIsSavedCol.rowCount) {
                        await client.query("ALTER TABLE messages ADD COLUMN is_saved BOOLEAN DEFAULT FALSE;");
                    }
                } catch (e) {}

                await client.query(`
                    CREATE TABLE IF NOT EXISTS tavern_messages (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        character_name VARCHAR(255) NOT NULL,
                        content TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS game_data (
                        key VARCHAR(50) PRIMARY KEY,
                        data JSONB NOT NULL
                    );
                `);

                // Migracja: Dodanie/Aktualizacja skilla 'Zaawansowane Rzemiosło' do bazy danych
                try {
                    const skillsRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
                    let skills = skillsRes.rows[0]?.data || [];
                    const advancedCraftingId = 'advanced-crafting';
                    
                    const newSkillData = {
                        id: advancedCraftingId,
                        name: 'Zaawansowane Rzemiosło',
                        description: 'Mistrzowskie opanowanie młota i kowadła. Podczas wytwarzania przedmiotów, jako Kowal, masz szansę na stworzenie przedmiotu ulepszonego od razu do poziomu +2 lub +3.',
                        type: 'Class',
                        category: 'Passive',
                        requirements: {
                            strength: 20,
                            agility: 15,
                            stamina: 10,
                            intelligence: 10,
                            luck: 25,
                            characterClass: CharacterClass.Blacksmith
                        },
                        cost: {
                            gold: 15000,
                            epicEssence: 5,
                            legendaryEssence: 1
                        }
                    };

                    const existingSkillIndex = skills.findIndex((s: any) => s.id === advancedCraftingId);
                    
                    if (existingSkillIndex === -1) {
                        console.log("MIGRATING DATA: Adding 'Zaawansowane Rzemiosło' skill...");
                        skills.push(newSkillData);
                        await client.query(
                            "INSERT INTO game_data (key, data) VALUES ('skills', $1) ON CONFLICT (key) DO UPDATE SET data = $1",
                            [JSON.stringify(skills)]
                        );
                        console.log("MIGRATION SUCCESS: 'Zaawansowane Rzemiosło' skill added.");
                    } else {
                         // Update existing skill to ensure new requirements (luck/class) are present
                         console.log("MIGRATING DATA: Updating 'Zaawansowane Rzemiosło' skill definition...");
                         skills[existingSkillIndex] = newSkillData;
                         await client.query(
                            "UPDATE game_data SET data = $1 WHERE key = 'skills'",
                            [JSON.stringify(skills)]
                        );
                    }
                } catch (skillErr) {
                    console.error("Migration Error (Adding Skills):", skillErr);
                }
                
                // Market Tables
                await client.query(`
                    CREATE TABLE IF NOT EXISTS market_listings (
                        id SERIAL PRIMARY KEY,
                        seller_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        item_data JSONB NOT NULL,
                        listing_type VARCHAR(20) NOT NULL,
                        currency VARCHAR(50) NOT NULL DEFAULT 'gold',
                        buy_now_price INT,
                        start_bid_price INT,
                        current_bid_price INT DEFAULT 0,
                        highest_bidder_id INT REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        expires_at TIMESTAMPTZ NOT NULL,
                        status VARCHAR(20) DEFAULT 'ACTIVE',
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS market_bids (
                        id SERIAL PRIMARY KEY,
                        listing_id INT NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
                        bidder_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        amount INT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);
                
                // Hunting Tables
                await client.query(`
                    CREATE TABLE IF NOT EXISTS hunting_parties (
                        id SERIAL PRIMARY KEY,
                        leader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        boss_id VARCHAR(255) NOT NULL,
                        max_members INT NOT NULL DEFAULT 5,
                        status VARCHAR(50) NOT NULL DEFAULT 'FORMING',
                        start_time TIMESTAMPTZ,
                        members JSONB NOT NULL DEFAULT '[]',
                        combat_log JSONB,
                        rewards JSONB,
                        victory BOOLEAN,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                try {
                    const hpGuildIdCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='hunting_parties' AND column_name='guild_id'");
                    if (hpGuildIdCol.rowCount === 0) {
                         await client.query("ALTER TABLE hunting_parties ADD COLUMN guild_id INT DEFAULT NULL;");
                    }
                } catch (e) {}

                // NEW: Auto Join column for hunting_parties
                try {
                    const hpAutoJoinCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='hunting_parties' AND column_name='auto_join'");
                    if (hpAutoJoinCol.rowCount === 0) {
                        console.log("MIGRATING SCHEMA: Adding 'auto_join' to 'hunting_parties'...");
                        await client.query("ALTER TABLE hunting_parties ADD COLUMN auto_join BOOLEAN DEFAULT FALSE;");
                    }
                } catch (e) {
                    console.error("Migration Error (hunting_parties.auto_join):", e);
                }
                
                // Guilds Table
                await client.query(`
                    CREATE TABLE IF NOT EXISTS guilds (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL UNIQUE,
                        tag VARCHAR(5) NOT NULL UNIQUE,
                        description TEXT,
                        crest_url TEXT,
                        leader_id INT NOT NULL REFERENCES users(id),
                        resources JSONB DEFAULT '{"gold": 0, "commonEssence": 0, "uncommonEssence": 0, "rareEssence": 0, "epicEssence": 0, "legendaryEssence": 0}',
                        buildings JSONB DEFAULT '{"headquarters": 0, "armory": 0, "barracks": 0, "scoutHouse": 0, "shrine": 0, "altar": 0}',
                        active_buffs JSONB DEFAULT '[]',
                        member_count INT DEFAULT 1,
                        max_members INT DEFAULT 10,
                        min_level INT DEFAULT 1,
                        is_public BOOLEAN DEFAULT TRUE,
                        rental_tax INT DEFAULT 10,
                        hunting_tax INT DEFAULT 0,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                // Guild Members Table
                await client.query(`
                    CREATE TABLE IF NOT EXISTS guild_members (
                        guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        role VARCHAR(20) NOT NULL DEFAULT 'RECRUIT', 
                        joined_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (guild_id, user_id)
                    );
                `);

                // Guild Chat
                await client.query(`
                    CREATE TABLE IF NOT EXISTS guild_chat (
                        id SERIAL PRIMARY KEY,
                        guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        content TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                // Guild Armory
                await client.query(`
                    CREATE TABLE IF NOT EXISTS guild_armory_items (
                        id SERIAL PRIMARY KEY,
                        guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
                        owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        item_data JSONB NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                // Guild Bank History
                await client.query(`
                    CREATE TABLE IF NOT EXISTS guild_bank_history (
                        id SERIAL PRIMARY KEY,
                        guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
                        user_id INT NOT NULL REFERENCES users(id),
                        type VARCHAR(20) NOT NULL,
                        currency VARCHAR(50) NOT NULL,
                        amount INT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);
                
                // Guild Raids / Wars
                await client.query(`
                    CREATE TABLE IF NOT EXISTS guild_raids (
                        id SERIAL PRIMARY KEY,
                        attacker_guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
                        defender_guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
                        status VARCHAR(20) NOT NULL DEFAULT 'PREPARING',
                        raid_type VARCHAR(20) NOT NULL DEFAULT 'RESOURCES',
                        start_time TIMESTAMPTZ NOT NULL,
                        attacker_participants JSONB DEFAULT '[]',
                        defender_participants JSONB DEFAULT '[]',
                        winner_guild_id INT REFERENCES guilds(id),
                        loot JSONB,
                        combat_log JSONB,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                 // Tavern Presence
                await client.query(`
                    CREATE TABLE IF NOT EXISTS tavern_presence (
                        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                        last_seen TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                // Tower Runs (New)
                await client.query(`
                    CREATE TABLE IF NOT EXISTS tower_runs (
                        id SERIAL PRIMARY KEY,
                        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        tower_id VARCHAR(255) NOT NULL,
                        current_floor INT NOT NULL DEFAULT 1,
                        current_health INT NOT NULL,
                        current_mana INT NOT NULL,
                        accumulated_rewards JSONB DEFAULT '{}',
                        status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                client.release();
                console.log('Database schema initialization completed.');
                return; 
            } catch (err) {
                console.error('Database initialization error details:', err);
                if (client) client.release(); 
                throw err;
            }
        } catch (err) {
            console.error(`Failed to connect to DB. Retrying in ${delay/1000}s... (Retries left: ${retries})`, err);
            await wait(delay);
            retries--;
        }
    }
    throw new Error('Could not connect to database after multiple retries.');
};
