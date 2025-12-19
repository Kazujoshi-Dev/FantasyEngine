
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, Race } from '../types.js';
import { pruneExpiredBuffs } from '../logic/guilds.js';

// Import sub-routers
import statsRoutes from './character/stats.js';
import campRoutes from './character/camp.js';
import storageRoutes from './character/storage.js';
import skillsRoutes from './character/skills.js';
import loadoutsRoutes from './character/loadouts.js';
import equipmentRoutes from './character/equipment.js'; // Dodano

const router = express.Router();

// Middleware: Wszystkie trasy w tej grupie wymagają tokenu
router.use(authenticateToken);

// GET /api/character - Pobierz pełne dane postaci
router.get('/', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`
            SELECT 
                c.data, u.email, g.buildings, g.active_buffs, g.id as guild_id,
                (SELECT row_to_json(tr) FROM tower_runs tr WHERE tr.user_id = c.user_id AND tr.status = 'IN_PROGRESS' LIMIT 1) as active_tower_run
            FROM characters c 
            JOIN users u ON c.user_id = u.id
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [req.user.id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json(null);
        }

        const row = result.rows[0];
        const charData: PlayerCharacter = row.data;

        if (!charData.loadouts) charData.loadouts = [];
        if (!charData.resources) charData.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
        if (row.email) charData.email = row.email;

        if (row.guild_id) {
            charData.guildId = row.guild_id;
            charData.guildBarracksLevel = row.buildings?.barracks || 0;
            charData.guildShrineLevel = row.buildings?.shrine || 0;
            const { pruned, wasModified } = pruneExpiredBuffs(row.active_buffs || []);
            if (wasModified) {
                await client.query('UPDATE guilds SET active_buffs = $1 WHERE id = $2', [JSON.stringify(pruned), row.guild_id]);
                charData.activeGuildBuffs = pruned;
            } else {
                charData.activeGuildBuffs = row.active_buffs || [];
            }
        }

        if (row.active_tower_run) {
            charData.activeTowerRun = {
                id: row.active_tower_run.id,
                userId: row.active_tower_run.user_id,
                towerId: row.active_tower_run.tower_id,
                currentFloor: row.active_tower_run.current_floor,
                currentHealth: row.active_tower_run.current_health,
                currentMana: row.active_tower_run.current_mana,
                accumulatedRewards: row.active_tower_run.accumulated_rewards,
                status: row.active_tower_run.status
            };
        }

        await client.query('COMMIT');
        res.json(charData);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Błąd pobierania postaci' });
    } finally {
        client.release();
    }
});

// POST /api/character - Tworzenie nowej postaci
router.post('/', async (req: any, res: any) => {
    const { name, race, startLocationId } = req.body;
    if (!name || !race) return res.status(400).json({ message: 'Imię i rasa są wymagane.' });

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
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: {
                strength: 1, agility: 1, accuracy: 1, stamina: 1, intelligence: 1, energy: 1, luck: 1,
                statPoints: 20, // PRZYZNANO 20 PUNKTÓW NA START
                currentHealth: 60, maxHealth: 60,
                currentMana: 30, maxMana: 30,
                currentEnergy: 10, maxEnergy: 10,
                minDamage: 1, maxDamage: 2,
                magicDamageMin: 0, magicDamageMax: 0,
                armor: 0, critChance: 0, critDamageModifier: 200,
                attacksPerRound: 1, dodgeChance: 0, manaRegen: 2,
                armorPenetrationPercent: 0, armorPenetrationFlat: 0,
                lifeStealPercent: 0, lifeStealFlat: 0,
                manaStealPercent: 0, manaStealFlat: 0
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
        client.release();
    }
});

// Delegacja do wyspecjalizowanych routerów
router.use('/stats', statsRoutes);
router.use('/camp', campRoutes);
router.use('/storage', storageRoutes);
router.use('/skills', skillsRoutes);
router.use('/loadouts', loadoutsRoutes);
router.use('/', equipmentRoutes); // Rejestracja logiki ekwipunku

export default router;
