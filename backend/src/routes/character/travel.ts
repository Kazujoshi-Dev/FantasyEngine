
import express from 'express';
import { pool } from '../../db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { PlayerCharacter, Location, GameData } from '../../types.js';

const router = express.Router();

router.use(authenticateToken);

// Start podróży
router.post('/start', async (req: any, res: any) => {
    const { destinationLocationId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.activeTravel) throw new Error("Już jesteś w podróży.");
        if (character.activeExpedition) throw new Error("Nie możesz podróżować podczas wyprawy.");

        const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'locations'");
        const locations: Location[] = gameDataRes.rows[0]?.data || [];
        const destination = locations.find(l => l.id === destinationLocationId);

        if (!destination) throw new Error("Nieprawidłowa lokacja docelowa.");
        if (destination.id === character.currentLocationId) throw new Error("Już tu jesteś.");

        if (character.resources.gold < destination.travelCost) throw new Error("Brak złota.");
        if (character.stats.currentEnergy < destination.travelEnergyCost) throw new Error("Brak energii.");

        character.resources.gold -= destination.travelCost;
        character.stats.currentEnergy -= destination.travelEnergyCost;
        character.activeTravel = {
            destinationLocationId: destination.id,
            finishTime: Date.now() + (destination.travelTime * 1000)
        };

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// Zakończenie podróży (wywoływane po czasie)
router.post('/complete', async (req: any, res: any) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        if (!character.activeTravel) throw new Error("Nie jesteś w podróży.");
        
        if (Date.now() < character.activeTravel.finishTime) {
            throw new Error("Jeszcze nie dotarłeś do celu.");
        }

        character.currentLocationId = character.activeTravel.destinationLocationId;
        character.activeTravel = null;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;
