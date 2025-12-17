
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { pool, initializeDatabase } from './db.js';
import { cleanupOldTavernMessages } from './logic/tasks.js';
import { calculateDerivedStatsOnServer } from './logic/stats.js';
import { PlayerCharacter, GuildRole } from './types.js';
import { processPendingRaids } from './logic/guildRaids.js';
import { processPendingEspionage } from './logic/espionage.js'; // Import new logic

// Import all route handlers
import authRoutes from './routes/auth.js';
import gameDataRoutes from './routes/gameData.js';
import characterRoutes from './routes/character.js'; 
import rankingRoutes from './routes/ranking.js';
import traderRoutes from './routes/trader.js';
import blacksmithRoutes from './routes/blacksmith.js';
import workshopRoutes from './routes/workshop.js';
import pvpRoutes from './routes/pvp.js';
import messageRoutes from './routes/messages.js';
import tavernRoutes from './routes/tavern.js';
import marketRoutes from './routes/market.js';
import adminRoutes from './routes/admin.js';
import huntingRoutes from './routes/hunting.js';
import uploadRoutes from './routes/upload.js';
import publicRoutes from './routes/public.js';
import guildRoutes from './routes/guilds.js';
import questRoutes from './routes/quests.js';
import expeditionRoutes from './routes/expedition.js';
import towerRoutes from './routes/towers.js';
import espionageRoutes from './routes/espionage.js'; // NEW


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare global {
  namespace Express {
    interface Request {
      user?: { id: number };
      io?: Server;
    }
  }
}

const app = express();
const httpServer = createServer(app);

// --- CORS Configuration ---
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['*']; 

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
};

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins.includes('*') ? "*" : allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Attach socket instance to request for route usage
app.use((req: any, res, next) => {
    req.io = io;
    next();
});

app.use(cors(corsOptions) as any);
app.use(express.json({ limit: '10mb' }) as any);

// ===================================================================================
//                                  API ROUTES
// ===================================================================================
app.get('/api/time', (req, res) => {
    res.json({ time: Date.now() });
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/game-data', gameDataRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/trader', traderRoutes);
app.use('/api/blacksmith', blacksmithRoutes);
app.use('/api/workshop', workshopRoutes); 
app.use('/api/pvp', pvpRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/tavern', tavernRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hunting', huntingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/guilds', guildRoutes);
app.use('/api/quests', questRoutes); 
app.use('/api/expedition', expeditionRoutes); 
app.use('/api/towers', towerRoutes);
app.use('/api/espionage', espionageRoutes); // Register
app.use('/api', characterRoutes); 

// ===================================================================================
//                            SOCKET.IO HANDLING
// ===================================================================================
io.on('connection', (socket) => {
    socket.on('join_guild', async (guildId: number, token: string) => {
        try {
            const res = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
            if(res.rows.length > 0) {
                const userId = res.rows[0].user_id;
                const memberRes = await pool.query('SELECT 1 FROM guild_members WHERE user_id = $1 AND guild_id = $2', [userId, guildId]);
                if (memberRes.rows.length > 0) {
                    socket.join(`guild_${guildId}`);
                }
            }
        } catch (e) {
            console.error('Socket Join Error', e);
        }
    });

    socket.on('send_guild_message', async (data: { guildId: number, content: string, token: string }) => {
        try {
            const { guildId, content, token } = data;
            const res = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
            if(res.rows.length === 0) return;
            const userId = res.rows[0].user_id;

            const charRes = await pool.query(`
                SELECT c.data->>'name' as name, gm.role 
                FROM characters c 
                JOIN guild_members gm ON c.user_id = gm.user_id 
                WHERE c.user_id = $1 AND gm.guild_id = $2
            `, [userId, guildId]);

            if (charRes.rows.length === 0) return;

            const { name, role } = charRes.rows[0];

            const insertRes = await pool.query(`
                INSERT INTO guild_chat (guild_id, user_id, content) 
                VALUES ($1, $2, $3) 
                RETURNING id, created_at
            `, [guildId, userId, content]);

            const msg = {
                id: insertRes.rows[0].id,
                userId,
                characterName: name,
                role: role as GuildRole,
                content,
                timestamp: insertRes.rows[0].created_at
            };

            io.to(`guild_${guildId}`).emit('receive_guild_message', msg);

        } catch (e) {
            console.error('Socket Send Error', e);
        }
    });
});


// ===================================================================================
//                            STATIC FILES & FALLBACK
// ===================================================================================

const distPath = path.join(__dirname, '../../dist');

app.use(express.static(distPath) as any);

const uploadsPath = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath) as any);
app.use('/api/uploads', express.static(uploadsPath) as any);

app.get('*', (req: any, res: any) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use(((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
}) as any);


// ===================================================================================
//                                 SERVER STARTUP
// ===================================================================================
initializeDatabase().then(() => {
    const portNumber = parseInt(process.env.PORT || '3001', 10);
    httpServer.listen(portNumber, '0.0.0.0', () => {
        console.log(`Server is running on port ${portNumber}`);
        console.log(`Serving static files from: ${distPath}`);
    });
    
    setInterval(cleanupOldTavernMessages, 60 * 60 * 1000); 
    
    // Check for raids and espionage every minute
    setInterval(() => {
        processPendingRaids().catch(err => console.error("Error processing raids:", err));
        processPendingEspionage().catch(err => console.error("Error processing espionage:", err));
    }, 60000);

    // CRON: Hourly Energy Regeneration (11:00, 12:00, etc.)
    cron.schedule('0 * * * *', async () => {
        const client = await pool.connect();
        try {
            console.log('[ENERGY REGEN] Starting hourly regeneration process...');
            
            // Fetch game data needed for stat calculation
            const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
            const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
            const skills = gameDataRes.rows.find(r => r.key === 'skills')?.data || [];

            await client.query('BEGIN');
            
            // Fetch all characters and their associated guild data for accurate stat bonus calculation
            const charsRes = await client.query(`
                SELECT c.user_id, c.data, g.buildings, g.active_buffs
                FROM characters c
                LEFT JOIN guild_members gm ON c.user_id = gm.user_id
                LEFT JOIN guilds g ON gm.guild_id = g.id
            `);

            for (const row of charsRes.rows) {
                let char = row.data as PlayerCharacter;
                const barracks = row.buildings?.barracks || 0;
                const shrine = row.buildings?.shrine || 0;
                const activeBuffs = row.active_buffs || [];

                // Calculate derived stats to find the current absolute maxEnergy (considering items/guilds)
                const derivedChar = calculateDerivedStatsOnServer(char, itemTemplates, affixes, barracks, shrine, skills, activeBuffs);
                const maxEnergy = derivedChar.stats.maxEnergy || 10;
                const currentEnergy = char.stats.currentEnergy || 0;

                if (currentEnergy < maxEnergy) {
                    char.stats.currentEnergy = currentEnergy + 1;
                    char.lastEnergyUpdateTime = Date.now();

                    await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), row.user_id]);
                }
            }

            await client.query('COMMIT');
            console.log(`[ENERGY REGEN] Successfully updated energy for characters. Total processed: ${charsRes.rowCount}`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[ENERGY REGEN] CRITICAL ERROR during hourly energy regeneration:', err);
        } finally {
            client.release();
        }
    });

    cron.schedule('* * * * *', async () => {
        // ... existing minutely cron for regeneration
        const client = await pool.connect();
        try {
            const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
            const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

            await client.query('BEGIN');
            
            const charsRes = await client.query(`
                SELECT user_id, data 
                FROM characters 
                WHERE (data->>'isResting')::boolean IS TRUE
            `);

            if (charsRes.rows.length === 0) {
                await client.query('COMMIT');
                return;
            }

            for (const row of charsRes.rows) {
                const char = row.data as PlayerCharacter;
                if (!char.stats || !char.camp) continue;

                const derivedChar = calculateDerivedStatsOnServer(char, itemTemplates, affixes);
                const maxHealth = derivedChar.stats.maxHealth || 50; 
                const currentHealth = char.stats.currentHealth || 0;
                
                if (currentHealth >= maxHealth) {
                    if (char.stats.currentHealth !== maxHealth) {
                         char.stats.currentHealth = maxHealth;
                         await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, row.user_id]);
                    }
                    continue;
                }

                const campLevel = char.camp.level || 1;
                const regenAmount = Math.max(1, Math.floor(maxHealth * (campLevel / 100)));
                const newHealth = Math.min(maxHealth, currentHealth + regenAmount);
                
                char.stats.currentHealth = newHealth;
                char.lastRestTime = Date.now();

                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [char, row.user_id]);
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error during health regeneration:', err);
        } finally {
            client.release();
        }
    });

}).catch((err: Error) => {
    console.error('Failed to start server:', err);
    (process as any).exit(1);
});
