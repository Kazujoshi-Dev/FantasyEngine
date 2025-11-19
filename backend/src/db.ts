
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const poolConfig: PoolConfig = {
  connectionString: connectionString,
};

if (connectionString && !/sslmode/i.test(connectionString)) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

export const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id SERIAL PRIMARY KEY,
                data JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        const idColumnDefault = await client.query(`
            SELECT column_default
            FROM information_schema.columns
            WHERE table_name = 'characters' AND column_name = 'id';
        `);

        if (idColumnDefault && idColumnDefault.rowCount != null && idColumnDefault.rowCount > 0 && idColumnDefault.rows[0].column_default === null) {
            console.log("MIGRATING SCHEMA: 'characters.id' column is missing a default value. Attempting to fix auto-increment.");
            await client.query(`CREATE SEQUENCE IF NOT EXISTS characters_id_seq;`);
            await client.query(`SELECT setval('characters_id_seq', COALESCE((SELECT MAX(id) + 1 FROM characters), 1), false);`);
            await client.query(`ALTER TABLE characters ALTER COLUMN id SET DEFAULT nextval('characters_id_seq'::regclass);`);
            await client.query(`ALTER SEQUENCE characters_id_seq OWNED BY characters.id;`);
            console.log("MIGRATION COMPLETE: 'characters.id' column should now auto-increment.");
        }

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
            CREATE TABLE IF NOT EXISTS tavern_presence (
                user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                last_seen TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS game_data (
                key VARCHAR(50) PRIMARY KEY,
                data JSONB NOT NULL
            );
        `);

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

        // --- Hunting Party Tables ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS hunting_parties (
                id SERIAL PRIMARY KEY,
                leader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                boss_id VARCHAR(255) NOT NULL,
                max_members INT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'FORMING',
                start_time TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                members JSONB NOT NULL,
                combat_log JSONB,
                rewards JSONB,
                victory BOOLEAN
            );
        `);

        // --- Robust Seeding ---
        const defaultData = {
            locations: [{
                id: randomUUID(),
                name: 'Starting Village',
                description: 'A peaceful village, an ideal place to start your adventure...',
                travelTime: 0,
                travelCost: 0,
                travelEnergyCost: 0,
                availableTabs: [0, 1, 2, 3, 4, 5, 6, 7, 12, 16],
                isStartLocation: true,
            }],
            expeditions: [],
            enemies: [],
            itemTemplates: [
                { id: 'short_sword', name: 'Krótki Miecz', gender: 'Masculine', description: 'Prosty, ale niezawodny krótki miecz.', slot: 'mainHand', category: 'Weapon', rarity: 'Common', icon: 'https://i.imgur.com/3sS8Z29.png', value: 10, requiredLevel: 1, damageMin: { min: 3, max: 5 }, damageMax: { min: 6, max: 8 } },
                { id: 'leather_armor', name: 'Skórzana Zbroja', gender: 'Feminine', description: 'Podstawowa zbroja zapewniająca minimalną ochronę.', slot: 'chest', category: 'Armor', rarity: 'Common', icon: 'https://i.imgur.com/m8e0v3K.png', value: 15, requiredLevel: 1, armorBonus: { min: 5, max: 8 } },
                { id: 'wooden_shield', name: 'Drewniana Tarcza', gender: 'Feminine', description: 'Prosta tarcza z drewna.', slot: 'offHand', category: 'Armor', rarity: 'Common', icon: 'https://i.imgur.com/2JB2t4x.png', value: 8, requiredLevel: 1, armorBonus: { min: 3, max: 5 } },
                { id: 'long_sword', name: 'Długi Miecz', gender: 'Masculine', description: 'Dobrze wyważony długi miecz, ulubieniec poszukiwaczy przygód.', slot: 'mainHand', category: 'Weapon', rarity: 'Uncommon', icon: 'https://i.imgur.com/mYtE5a3.png', value: 50, requiredLevel: 5, damageMin: { min: 8, max: 12 }, damageMax: { min: 15, max: 20 } }
            ],
            quests: [],
            affixes: [
                { id: 'prefix_strength', name: { masculine: 'Mocny', feminine: 'Mocna', neuter: 'Mocne' }, type: 'Prefix', value: 10, statsBonus: { strength: { min: 1, max: 3 } }, spawnChances: { Weapon: 10, Armor: 5 } },
                { id: 'suffix_stamina', name: { masculine: 'Wytrzymałości', feminine: 'Wytrzymałości', neuter: 'Wytrzymałości' }, type: 'Suffix', value: 10, statsBonus: { stamina: { min: 1, max: 3 } }, spawnChances: { Weapon: 5, Armor: 10, Jewelry: 10 } }
            ],
            skills: [
                {
                    id: 'twarda-skora-1',
                    name: 'Twarda skóra',
                    description: 'Pierwszy otrzymany cios krytyczny w walce jest zredukowany o 50%.',
                    type: 'Universal',
                    category: 'Passive',
                    cost: {
                        gold: 25000,
                        epicEssence: 5,
                    },
                    requirements: {
                        strength: 35,
                        agility: 25,
                        stamina: 30,
                        intelligence: 10,
                    },
                }
            ],
            settings: { language: 'pl' }
        };

        for (const key of Object.keys(defaultData) as (keyof typeof defaultData)[]) {
            const res = await client.query('SELECT data FROM game_data WHERE key = $1', [key]);
            if (res.rowCount === 0) {
                await client.query('INSERT INTO game_data (key, data) VALUES ($1, $2)', [key, JSON.stringify(defaultData[key])]);
                console.log(`Initialized game_data for key: ${key}`);
            } else if (!res.rows[0].data || (Array.isArray(res.rows[0].data) && res.rows[0].data.length === 0)) {
                await client.query('UPDATE game_data SET data = $1 WHERE key = $2', [JSON.stringify(defaultData[key]), key]);
                 console.log(`Restored empty game_data for key: ${key}`);
            }
        }

        const hasLearnedSkills = await client.query(`SELECT 1 FROM characters WHERE data ? 'learnedSkills' LIMIT 1;`);
        if (hasLearnedSkills.rowCount === 0) {
            console.log("MIGRATING SCHEMA: Adding 'learnedSkills' array to all characters...");
            await client.query(`UPDATE characters SET data = data || '{"learnedSkills": []}'::jsonb WHERE NOT (data ? 'learnedSkills');`);
            console.log("MIGRATION COMPLETE.");
        }

        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Error during database initialization:', err);
        throw err;
    } finally {
        client.release();
    }
};
