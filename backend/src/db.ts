
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import { GAME_SKILLS } from './content/skills.js';

dotenv.config();

/**
 * LOGIKA KONFIGURACJI POŁĄCZENIA:
 * 1. Priorytet ma DATABASE_URL (często używane w chmurze).
 * 2. Następnie sprawdzane są pojedyncze zmienne (używane w Docker Compose).
 */
const getPoolConfig = () => {
    if (process.env.DATABASE_URL) {
        return { connectionString: process.env.DATABASE_URL };
    }

    // Jeśli brak URL, budujemy z pojedynczych zmiennych
    if (process.env.POSTGRES_HOST && process.env.POSTGRES_USER) {
        return {
            host: process.env.POSTGRES_HOST,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DB,
            port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        };
    }

    return null;
};

const config = getPoolConfig();

if (!config) {
    console.error("================================================================");
    console.error("BŁĄD KRYTYCZNY: Brak konfiguracji bazy danych!");
    console.error("Upewnij się, że w pliku .env masz zdefiniowane:");
    console.error("POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB");
    console.error("================================================================");
    process.exit(1);
}

// Logowanie parametrów połączenia (bezpieczne)
const dbUser = (config as any).user || "z DATABASE_URL";
const dbHost = (config as any).host || "z DATABASE_URL";
console.log(`[DB] Próba połączenia: Host=${dbHost}, Użytkownik=${dbUser}`);

/**
 * PROBLEM SSL:
 * W Dockerze baza danych zazwyczaj nie wspiera SSL. 
 * Dodajemy opcję wyłączenia SSL nawet jeśli NODE_ENV === 'production'.
 */
const sslConfig = process.env.DB_SSL === 'true' 
    ? { rejectUnauthorized: false } 
    : false;

export const pool = new Pool({
    ...config,
    ssl: sslConfig
});

export const initializeDatabase = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log(`[DB] Połączono pomyślnie z bazą danych jako: ${dbUser}`);
        
        // 1. Tworzenie tabel
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS characters (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS game_data (
                key TEXT PRIMARY KEY,
                data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                last_active_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                sender_name TEXT,
                message_type TEXT NOT NULL,
                subject TEXT NOT NULL,
                body JSONB NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                is_saved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS market_listings (
                id SERIAL PRIMARY KEY,
                seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                item_data JSONB NOT NULL,
                listing_type TEXT NOT NULL,
                currency TEXT NOT NULL,
                buy_now_price INTEGER,
                start_bid_price INTEGER,
                current_bid_price INTEGER,
                highest_bidder_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL,
                status TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS tavern_messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                character_name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS tavern_presence (
                user_id PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                last_seen TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS tower_runs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tower_id TEXT NOT NULL,
                current_floor INTEGER NOT NULL,
                current_health NUMERIC NOT NULL,
                current_mana NUMERIC NOT NULL,
                accumulated_rewards JSONB NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS guilds (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                tag TEXT NOT NULL,
                description TEXT,
                crest_url TEXT,
                leader_id INTEGER NOT NULL,
                resources JSONB DEFAULT '{"gold": 0, "commonEssence": 0, "uncommonEssence": 0, "rareEssence": 0, "epicEssence": 0, "legendaryEssence": 0}'::jsonb,
                buildings JSONB DEFAULT '{}'::jsonb,
                active_buffs JSONB DEFAULT '[]'::jsonb,
                member_count INTEGER DEFAULT 1,
                max_members INTEGER DEFAULT 10,
                min_level INTEGER DEFAULT 1,
                is_public BOOLEAN DEFAULT TRUE,
                rental_tax INTEGER DEFAULT 10,
                hunting_tax INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS guild_members (
                guild_id INTEGER NOT NULL,
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                joined_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS guild_chat (
                id SERIAL PRIMARY KEY,
                guild_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS guild_armory_items (
                id SERIAL PRIMARY KEY,
                guild_id INTEGER NOT NULL,
                owner_id INTEGER NOT NULL,
                item_data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS guild_bank_history (
                id SERIAL PRIMARY KEY,
                guild_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                currency TEXT NOT NULL,
                amount INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS guild_raids (
                id SERIAL PRIMARY KEY,
                attacker_guild_id INTEGER NOT NULL,
                defender_guild_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                raid_type TEXT NOT NULL,
                start_time TIMESTAMP NOT NULL,
                attacker_participants JSONB DEFAULT '[]'::jsonb,
                defender_participants JSONB DEFAULT '[]'::jsonb,
                winner_guild_id INTEGER,
                loot JSONB,
                combat_log JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS guild_espionage (
                id SERIAL PRIMARY KEY,
                attacker_guild_id INTEGER NOT NULL,
                defender_guild_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                result_snapshot JSONB,
                cost INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS hunting_parties (
                id SERIAL PRIMARY KEY,
                leader_id INTEGER NOT NULL,
                boss_id TEXT NOT NULL,
                max_members INTEGER NOT NULL,
                status TEXT NOT NULL,
                members JSONB NOT NULL,
                start_time TIMESTAMP,
                combat_log JSONB,
                rewards JSONB,
                victory BOOLEAN,
                guild_id INTEGER,
                auto_join BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS password_resets (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL
            );
        `);

        // 2. Synchronizacja Umiejętności
        console.log("[DB] Synchronizacja umiejętności...");
        const skillsRes = await client.query("SELECT data FROM game_data WHERE key = 'skills'");
        let dbSkills = Array.isArray(skillsRes.rows[0]?.data) ? skillsRes.rows[0].data : [];
        
        let modified = false;
        for (const skill of GAME_SKILLS) {
            const index = dbSkills.findIndex((s: any) => s.id === skill.id);
            if (index === -1) {
                dbSkills.push(skill);
                modified = true;
            }
        }

        if (modified) {
            await client.query("INSERT INTO game_data (key, data) VALUES ('skills', $1) ON CONFLICT (key) DO UPDATE SET data = $1", [JSON.stringify(dbSkills)]);
            console.log("[DB] Umiejętności zsynchronizowane.");
        }

        console.log("[DB] Inicjalizacja bazy zakończona pomyślnie.");

    } catch (e) {
        console.error("[DB] Błąd inicjalizacji:", e);
        throw e;
    } finally {
        if (client) client.release();
    }
};
