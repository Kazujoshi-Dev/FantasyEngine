
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, Affix, RaidType } from '../types.js';
import { getBackpackCapacity, enforceInboxLimit, fetchFullCharacter } from '../logic/helpers.js';

const router = express.Router();

// GET /api/guilds/list - Publiczna lista gildii
router.get('/list', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(`
            SELECT g.*, COUNT(gm.user_id) as "memberCount"
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            WHERE g.is_public = TRUE
            GROUP BY g.id
            ORDER BY g.member_count DESC
        `);
        res.json(result.rows.map(row => ({
            ...row,
            createdAt: row.created_at,
            memberCount: parseInt(row.member_count) || 0,
            isPublic: row.is_public
        })));
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania listy gildii' });
    }
});

// GET /api/guilds/my-guild - Dane gildii aktualnego gracza
router.get('/my-guild', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.json(null);

        const guildId = memberRes.rows[0].guild_id;
        const myRole = memberRes.rows[0].role;

        const guildRes = await pool.query('SELECT * FROM guilds WHERE id = $1', [guildId]);
        const guild = guildRes.rows[0];

        const membersRes = await pool.query(`
            SELECT gm.user_id as "userId", gm.role, gm.joined_at as "joinedAt", 
                   c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race,
                   EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes') as "isOnline"
            FROM guild_members gm
            JOIN characters c ON gm.user_id = c.user_id
            WHERE gm.guild_id = $1
            ORDER BY gm.role ASC, level DESC
        `, [guildId]);

        const transactionsRes = await pool.query(`
            SELECT h.*, c.data->>'name' as "characterName"
            FROM guild_bank_history h
            JOIN characters c ON h.user_id = c.user_id
            WHERE h.guild_id = $1
            ORDER BY h.created_at DESC LIMIT 50
        `, [guildId]);

        res.json({
            ...guild,
            createdAt: guild.created_at,
            memberCount: guild.member_count,
            maxMembers: guild.max_members,
            isPublic: guild.is_public,
            rentalTax: guild.rental_tax,
            huntingTax: guild.hunting_tax,
            members: membersRes.rows,
            transactions: transactionsRes.rows.map(t => ({ ...t, timestamp: t.created_at })),
            myRole
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych gildii' });
    }
});

// GET /api/guilds/targets - Inne gildie dla szpiegostwa i rajdów
router.get('/targets', authenticateToken, async (req: any, res: any) => {
    try {
        const myGuildRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        const myGuildId = myGuildRes.rows[0]?.guild_id;

        const result = await pool.query(`
            SELECT g.id, g.name, g.tag, g.member_count as "memberCount", 
                   COALESCE(SUM((c.data->>'level')::int), 0) as "totalLevel"
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            LEFT JOIN characters c ON gm.user_id = c.user_id
            WHERE g.id != $1
            GROUP BY g.id
            ORDER BY "totalLevel" DESC
        `, [myGuildId || 0]);

        res.json(result.rows.map(r => ({
            ...r,
            memberCount: parseInt(r.memberCount) || 0,
            totalLevel: parseInt(r.totalLevel) || 0
        })));
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania celów' });
    }
});

// POST /api/guilds/update - Zapisywanie ustawień gildii
router.post('/update', authenticateToken, async (req: any, res: any) => {
    const { description, crestUrl, minLevel, isPublic, rentalTax, huntingTax } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || memberRes.rows[0].role !== GuildRole.LEADER) {
            return res.status(403).json({ message: 'Brak uprawnień lidera' });
        }
        const guildId = memberRes.rows[0].guild_id;

        await pool.query(`
            UPDATE guilds 
            SET description = $1, crest_url = $2, min_level = $3, is_public = $4, rental_tax = $5, hunting_tax = $6
            WHERE id = $7
        `, [description, crestUrl, minLevel, isPublic, rentalTax, huntingTax, guildId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Błąd zapisu ustawień' });
    }
});

// GET /api/guilds/armory - Poprawione pobieranie zbrojowni
router.get('/armory', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Brak gildii' });
        const guildId = memberRes.rows[0].guild_id;

        const armoryItems = await pool.query(`
            SELECT a.id, a.item_data as item, a.owner_id as "ownerId", a.created_at as "depositedAt",
                   c.data->>'name' as "ownerName"
            FROM guild_armory_items a
            JOIN characters c ON a.owner_id = c.user_id
            WHERE a.guild_id = $1
            ORDER BY a.created_at DESC
        `, [guildId]);

        const borrowedItems = await pool.query(`
            SELECT c.user_id as "userId", c.data->>'name' as "borrowedBy", 
                   item.value as item, item.key as "itemKey",
                   (item.value->>'originalOwnerId')::int as "ownerId",
                   item.value->>'originalOwnerName' as "ownerName",
                   (item.value->>'borrowedAt')::bigint as "depositedAt"
            FROM characters c, jsonb_array_elements(c.data->'inventory') AS item
            WHERE (item.value->>'isBorrowed')::boolean = TRUE 
            AND (item.value->>'borrowedFromGuildId')::int = $1
        `, [guildId]);

        res.json({
            armoryItems: armoryItems.rows.map(row => ({
                ...row,
                depositedAt: row.depositedAt
            })),
            borrowedItems: borrowedItems.rows.map(row => ({
                id: row.itemKey,
                item: row.item,
                ownerId: row.ownerId,
                ownerName: row.ownerName,
                depositedAt: row.depositedAt,
                borrowedBy: row.borrowedBy,
                userId: row.userId
            }))
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd zbrojowni' });
    }
});

// ... reszta pliku bez zmian (create, join, bank, upgrade-building) ...
// Zapewnienie, że router jest wyeksportowany na końcu
export default router;
