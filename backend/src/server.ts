
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron';

import { pool, initializeDatabase } from './db.js';
import { cleanupOldTavernMessages } from './logic/tasks.js';
import { calculateDerivedStatsOnServer } from './logic/stats.js';
import { PlayerCharacter } from './types.js';

// Import all route handlers
import authRoutes from './routes/auth.js';
import gameDataRoutes from './routes/gameData.js';
import characterRoutes from './routes/character.js';
import rankingRoutes from './routes/ranking.js';
import traderRoutes from './routes/trader.js';
import blacksmithRoutes from './routes/blacksmith.js';
import pvpRoutes from './routes/pvp.js';
import messageRoutes from './routes/messages.js';
import tavernRoutes from './routes/tavern.js';
import marketRoutes from './routes/market.js';
import adminRoutes from './routes/admin.js';
import huntingRoutes from './routes/hunting.js';
import uploadRoutes from './routes/upload.js';
import publicRoutes from './routes/public.js';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare global {
  namespace Express {
    interface Request {
      user?: { id: number };
    }
  }
}

const app = express();

app.use(cors() as any);
app.use(express.json({ limit: '10mb' }) as any);

// ===================================================================================
//                                  API ROUTES
// ===================================================================================
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/game-data', gameDataRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/trader', traderRoutes);
app.use('/api/blacksmith', blacksmithRoutes);
app.use('/api/pvp', pvpRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/tavern', tavernRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hunting', huntingRoutes);
app.use('/api/upload', uploadRoutes);
// This must be the last API route because it's a broad catch-all for /character, /characters/* etc.
app.use('/api', characterRoutes);


// ===================================================================================
//                            STATIC FILES & FALLBACK
// ===================================================================================
app.use(express.static(path.join(__dirname, '../../dist')) as any);

// Serve uploads directory statically
const uploadsPath = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
// Serve via /uploads (legacy/direct) AND /api/uploads (proxy-friendly)
app.use('/uploads', express.static(uploadsPath) as any);
app.use('/api/uploads', express.static(uploadsPath) as any);

app.get('*', (req: any, res: any) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Error handling middleware
app.use(((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
}) as any);


// ===================================================================================
//                                 SERVER STARTUP
// ===================================================================================
initializeDatabase().then(() => {
    const portNumber = parseInt(process.env.PORT || '3001', 10);
    app.listen(portNumber, '0.0.0.0', () => {
        console.log(`Server is running on port ${portNumber}`);
    });
    // Set up periodic cleanup for the tavern chat
    setInterval(cleanupOldTavernMessages, 60 * 60 * 1000); // Run every hour

    // Set up hourly energy regeneration for all players
    cron.schedule('0 * * * *', async () => {
        console.log('Running hourly energy regeneration task...');
        const client = await pool.connect();
        try {
            // Fetch Game Data needed for accurate stat calculations (item bonuses)
            const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
            const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
            const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

            // Fetch all characters
            // NOTE: For very large player bases, this should be paginated/batched.
            const charsRes = await client.query("SELECT user_id, data FROM characters");
            
            let updatedCount = 0;
            const now = Date.now();

            await client.query('BEGIN');

            for (const row of charsRes.rows) {
                const char = row.data as PlayerCharacter;
                
                // Calculate TRUE max stats including equipment bonuses
                const derivedChar = calculateDerivedStatsOnServer(char, itemTemplates, affixes);
                const trueMaxEnergy = derivedChar.stats.maxEnergy;
                const currentEnergy = char.stats.currentEnergy;

                // Determine new energy
                let newEnergy = currentEnergy;
                if (currentEnergy < trueMaxEnergy) {
                    newEnergy = currentEnergy + 1;
                }

                // Update timestamp and value
                char.lastEnergyUpdateTime = now;
                char.stats.currentEnergy = newEnergy;

                await client.query(
                    'UPDATE characters SET data = $1 WHERE user_id = $2',
                    [char, row.user_id]
                );
                updatedCount++;
            }

            await client.query('COMMIT');
            console.log(`Energy regenerated for ${updatedCount} characters.`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error during hourly energy regeneration:', err);
        } finally {
            client.release();
        }
    });
}).catch((err: Error) => {
    console.error('Failed to start server:', err);
    (process as any).exit(1);
});
