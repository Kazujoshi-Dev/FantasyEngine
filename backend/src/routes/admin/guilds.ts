
import express from 'express';
import { pool } from '../../db.js';

const router = express.Router();

// GET /api/admin/guilds - Pobierz wszystkie gildie z danymi liderów
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT g.id, g.name, g.tag, c.data->>'name' as leader_name, g.buildings
            FROM guilds g
            JOIN characters c ON g.leader_id = c.user_id
            ORDER BY g.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Admin Guilds Fetch Error:", err);
        res.status(500).json({ message: 'Błąd pobierania listy gildii' });
    }
});

// PUT /api/admin/guilds/:id/buildings - Aktualizacja poziomów budynków przez admina
router.put('/:id/buildings', async (req, res) => {
    const { id } = req.params;
    const { buildings } = req.body;

    if (!buildings) {
        return res.status(400).json({ message: 'Brak danych budynków' });
    }

    try {
        await pool.query(
            'UPDATE guilds SET buildings = $1 WHERE id = $2',
            [JSON.stringify(buildings), id]
        );
        res.json({ message: 'Budynki zostały zaktualizowane' });
    } catch (err) {
        console.error("Admin Guilds Update Error:", err);
        res.status(500).json({ message: 'Błąd podczas aktualizacji budynków' });
    }
});

export default router;
