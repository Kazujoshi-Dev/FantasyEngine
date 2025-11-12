

// FIX: Use fully qualified express types to resolve type conflicts with global types (e.g. from DOM).
import express, { NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exit } from 'process';

import { initializeDatabase } from './db';
import { cleanupOldTavernMessages } from './logic/tasks';

// Import all route handlers
import authRoutes from './routes/auth';
import gameDataRoutes from './routes/gameData';
import characterRoutes from './routes/character';
import rankingRoutes from './routes/ranking';
import traderRoutes from './routes/trader';
import blacksmithRoutes from './routes/blacksmith';
import pvpRoutes from './routes/pvp';
import messageRoutes from './routes/messages';
import tavernRoutes from './routes/tavern';
import marketRoutes from './routes/market';
import adminRoutes from './routes/admin';


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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ===================================================================================
//                                  API ROUTES
// ===================================================================================
app.use('/api/auth', authRoutes);
app.use('/api/game-data', gameDataRoutes);
app.use('/api', characterRoutes); // Includes /character, /characters/*
app.use('/api/ranking', rankingRoutes);
app.use('/api/trader', traderRoutes);
app.use('/api/blacksmith', blacksmithRoutes);
app.use('/api/pvp', pvpRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/tavern', tavernRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin', adminRoutes);


// ===================================================================================
//                            STATIC FILES & FALLBACK
// ===================================================================================
app.use(express.static(path.join(__dirname, '../../dist')));

// FIX: Use fully qualified express types to resolve type conflicts.
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Error handling middleware
// FIX: Use fully qualified express types to resolve type conflicts.
app.use((err: Error, req: express.Request, res: express.Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


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
}).catch(err => {
    console.error('Failed to start server:', err);
    exit(1);
});