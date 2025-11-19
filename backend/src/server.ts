
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exit } from 'process';

import { initializeDatabase } from './db.js';
import { cleanupOldTavernMessages } from './logic/tasks.js';

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
// This must be the last API route because it's a broad catch-all for /character, /characters/* etc.
app.use('/api', characterRoutes);


// ===================================================================================
//                            STATIC FILES & FALLBACK
// ===================================================================================
app.use(express.static(path.join(__dirname, '../../dist')) as any);

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
}).catch((err: Error) => {
    console.error('Failed to start server:', err);
    exit(1);
});
