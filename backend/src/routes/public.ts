
import express from 'express';
import { pool } from '../db.js';
import { calculateTotalExperience } from '../logic/stats.js';
import { PublicCharacterProfile } from '../types.js';

const router = express.Router();

/**
 * Public routes for viewing shared combat reports and character profiles.
 */

router.get('/report/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT message_type, subject, body, sender_name FROM messages WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Report not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania raportu' });
    }
});

router.get('/raid/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM guild_raids WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Raid not found' });
        
        const raid = result.rows[0];
        res.json({
            message_type: 'raid_report',
            subject: 'Raport z Rajdu',
            body: {
                totalGold: raid.loot?.gold || 0,
                essencesFound: raid.loot?.essences || {},
                combatLog: raid.combat_log,
                huntingMembers: raid.attacker_participants,
                opponents: raid.defender_participants,
                isVictory: true 
            },
            sender_name: 'Gildia'
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania rajdu' });
    }
});

// GET /api/public/profile/:name - Fetch public character profile
router.get('/profile/:name', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.user_id as id,
                c.data->>'name' as name,
                c.data->>'race' as race,
                c.data->>'characterClass' as "characterClass",
                (c.data->>'level')::int as level,
                (c.data->>'experience')::bigint as experience,
                (c.data->>'pvpWins')::int as "pvpWins",
                (c.data->>'pvpLosses')::int as "pvpLosses",
                COALESCE((c.data->>'honor')::int, 0) as honor,
                c.data->>'description' as description,
                c.data->>'avatarUrl' as "avatarUrl",
                g.name as "guildName",
                g.tag as "guildTag",
                EXISTS (
                    SELECT 1 
                    FROM sessions s 
                    WHERE s.user_id = c.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes'
                ) as "isOnline"
            FROM characters c
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.data->>'name' = $1
        `, [req.params.name]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Postać nie została znaleziona.' });
        }

        const row = result.rows[0];
        const totalXp = calculateTotalExperience(row.level, row.experience);

        const profile: PublicCharacterProfile = {
            name: row.name,
            level: row.level,
            race: row.race,
            characterClass: row.characterClass,
            experience: totalXp,
            pvpWins: row.pvpWins || 0,
            pvpLosses: row.pvpLosses || 0,
            honor: row.honor || 0,
            guildName: row.guildName,
            guildTag: row.guildTag,
            avatarUrl: row.avatarUrl,
            description: row.description,
            isOnline: row.isOnline
        };

        res.json(profile);
    } catch (err) {
        console.error('Error fetching public profile:', err);
        res.status(500).json({ message: 'Błąd serwera podczas pobierania profilu.' });
    }
});

export default router;
