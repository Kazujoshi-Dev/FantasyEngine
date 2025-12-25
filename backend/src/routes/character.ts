
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, Race, Gender } from '../types.js';
// centralize fetching logic
import { fetchFullCharacter } from '../logic/helpers.js';

// Import sub-routers
import statsRoutes from './character/stats.js';
import campRoutes from './character/camp.js';
import storageRoutes from './character/storage.js';
import skillsRoutes from './character/skills.js';
import loadoutsRoutes from './character/loadouts.js';
import equipmentRoutes from './character/equipment.js';

const router = express.Router();

// Middleware: Wszystkie trasy w tej grupie wymagają tokenu
router.use(authenticateToken);

// GET /api/character - Pobierz pełne dane postaci
router.get('/', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Use central helper to fetch character with guild context and pruned buffs
        const charData = await fetchFullCharacter(client, req.user.id);

        if (!charData) {
            await client.query('ROLLBACK');
            return res.json(null);
        }

        await client.query('COMMIT');
        res.json(charData);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error fetching character data:", err);
        res.status(500).json({ message: 'Błąd pobierania postaci' });
    } finally {
        if (client) client.release();
    }
});

// POST /api/character/update-profile - Aktualizacja profilu (Avatar, Opis, Settings, Gender)
router.post('/update-profile', async (req: any, res: any) => {
    const { description, avatarUrl, settings, email, gender } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        
        const character = charRes.rows[0].data;
        
        if (description !== undefined) character.description = description;
        if (avatarUrl !== undefined) character.avatarUrl = avatarUrl;
        if (settings !== undefined) character.settings = { ...character.settings, ...settings };
        
        // JEDNORAZOWY WYBÓR PŁCI DLA STARYCH KONT
        if (gender !== undefined && (character.gender === undefined || character.gender === null)) {
            if (Object.values(Gender).includes(gender)) {
                character.gender = gender;
            }
        }
        
        // Aktualizacja danych w tabeli characters
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        
        // Opcjonalna aktualizacja emaila w tabeli users
        if (email) {
            await client.query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user.id]);
        }

        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        if (client) client.release();
    }
});

// POST /api/character - Tworzenie nowej postaci
router.post('/', async (req: any, res: any) => {
    const { name, race, gender, startLocationId } = req.body;
    if (!name || !race || !gender) return res.status(400).json({ message: 'Imię, rasa i płeć są wymagane.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Sprawdź czy użytkownik ma już postać
        const existingCheck = await client.query('SELECT id FROM characters WHERE user_id = $1', [req.user.id]);
        if (existingCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Użytkownik posiada już postać.' });
        }

        // Sprawdź czy imię jest zajęte
        const nameCheck = await client.query("SELECT id FROM characters WHERE data->>'name' = $1", [name]);
        if (nameCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'To imię jest już zajęte.' });
        }

        const initialCharacter: Partial<PlayerCharacter> = {
            name: name,
            race: race as Race,
            gender: gender as Gender,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: {
                strength: 1, agility: 1, accuracy: 1, stamina: 1, intelligence: 1, energy: 1, luck: 1,
                statPoints: 20,
                currentHealth: 60, maxHealth: 60,
                currentMana: 30, maxMana: 30,
                currentEnergy: 10, maxEnergy: 10,
                minDamage: 1, maxDamage: 2,
                magicDamageMin: 0, magicDamageMax: 0,
                armor: 0, critChance: 0, critDamageModifier: 200,
                attacksPerRound: 1, dodgeChance: 0, blockChance: 0, manaRegen: 2,
                armorPenetrationPercent: 0, armorPenetrationFlat: 0,
                lifeStealPercent: 0, lifeStealFlat: 0,
                manaStealPercent: 0, manaStealFlat: 0,
                expBonusPercent: 0, goldBonusPercent: 0, 
                damageBonusPercent: 0, damageReductionPercent: 0
            },
            resources: { gold: 100, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            equipment: { head: null, neck: null, chest: null, hands: null, waist: null, legs: null, feet: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            inventory: [],
            currentLocationId: startLocationId || 'start',
            activeTravel: null,
            activeExpedition: null,
            isResting: false,
            restStartHealth: 60,
            lastRestTime: Date.now(),
            lastEnergyUpdateTime: Date.now(),
            backpack: { level: 1 },
            camp: { level: 1 },
            treasury: { level: 1, gold: 0 },
            warehouse: { level: 1, items: [] },
            workshop: { level: 1 },
            loadouts: [],
            acceptedQuests: [],
            questProgress: [],
            learnedSkills: [],
            activeSkills: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0,
            honor: 0,
            resetsUsed: 0
        };

        const insertResult = await client.query(
            'INSERT INTO characters (user_id, data) VALUES ($1, $2) RETURNING data',
            [req.user.id, JSON.stringify(initialCharacter)]
        );

        await client.query('COMMIT');
        res.status(201).json(insertResult.rows[0].data);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("CREATE CHARACTER ERROR:", err);
        res.status(500).json({ message: 'Błąd serwera podczas tworzenia postaci.' });
    } finally {
        if (client) client.release();
    }
});

// Delegacja do wyspecjalizowanych routerów
router.use('/stats', statsRoutes);
router.use('/camp', campRoutes);
router.use('/storage', storageRoutes);
router.use('/skills', skillsRoutes);
router.use('/loadouts', loadoutsRoutes);
router.use('/', equipmentRoutes);

export default router;
