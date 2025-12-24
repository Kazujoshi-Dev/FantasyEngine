
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
// Added PlayerCharacter to imports to fix "Cannot find name 'PlayerCharacter'"
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, RaidType, Affix, PlayerCharacter } from '../types.js';
// Fix: Import getBackpackCapacity from stats.js, keep enforceInboxLimit and fetchFullCharacter from helpers.js
import { getBackpackCapacity, calculateDerivedStatsOnServer } from '../logic/stats.js';
import { enforceInboxLimit, fetchFullCharacter } from '../logic/helpers.js';

const router = express.Router();

// Middleware: Wszystkie trasy wymagają autoryzacji
router.use(authenticateToken);

// GET /api/guilds/list - Publiczna lista gildii
router.get('/list', async (req: any, res: any) => {
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
router.get('/my-guild', async (req: any, res: any) => {
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
                   EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = gm.user_id AND s.last_active_at > NOW() - INTERVAL '5 minutes' ) as "isOnline"
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

// GET /api/guilds/armory - Pobieranie zbrojowni
router.get('/armory', async (req: any, res: any) => {
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
                   item as item, (item->>'uniqueId') as "itemKey",
                   (item->>'originalOwnerId')::int as "ownerId",
                   item->>'originalOwnerName' as "ownerName",
                   (item->>'borrowedAt')::bigint as "depositedAt"
            FROM characters c, jsonb_array_elements(c.data->'inventory') AS item
            WHERE (item->>'isBorrowed')::boolean = TRUE 
            AND (item->>'borrowedFromGuildId')::int = $1
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
        console.error("Zbrojownia Error:", err);
        res.status(500).json({ message: 'Błąd zbrojowni' });
    }
});

// POST /api/guilds/armory/deposit - Deponowanie lub Zwrot przedmiotu
router.post('/armory/deposit', async (req: any, res: any) => {
    const { itemId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error("Nie należysz do gildii.");
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const character: PlayerCharacter = charRes.rows[0].data;

        const itemIdx = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIdx === -1) throw new Error("Przedmiot nie znaleziony w plecaku.");
        const item = character.inventory[itemIdx];

        // Sprawdź pojemność zbrojowni
        const guildRes = await client.query('SELECT buildings FROM guilds WHERE id = $1', [guildId]);
        const armoryLevel = guildRes.rows[0].buildings?.armory || 0;
        const capacity = 10 + armoryLevel;

        const countRes = await client.query('SELECT COUNT(*) FROM guild_armory_items WHERE guild_id = $1', [guildId]);
        if (parseInt(countRes.rows[0].count) >= capacity) throw new Error("Zbrojownia jest pełna.");

        // Usuń z plecaka
        character.inventory.splice(itemIdx, 1);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);

        // Jeśli to był pożyczony przedmiot, czyścimy flagi przed deponowaniem
        const originalOwnerId = item.isBorrowed ? item.originalOwnerId : userId;
        delete item.isBorrowed;
        delete item.borrowedFromGuildId;
        delete item.borrowedAt;
        delete item.originalOwnerId;
        delete item.originalOwnerName;

        // Wstaw do zbrojowni
        await client.query(
            `INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`,
            [guildId, originalOwnerId, JSON.stringify(item)]
        );

        await client.query('COMMIT');
        res.json({ message: "Przedmiot przekazany do zbrojowni." });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/armory/borrow - Wypożyczenie przedmiotu
router.post('/armory/borrow', async (req: any, res: any) => {
    const { armoryId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Sprawdź gildię i postać
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) throw new Error("Brak gildii.");
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [userId]);
        const character: PlayerCharacter = charRes.rows[0].data;

        if (character.inventory.length >= getBackpackCapacity(character)) throw new Error("Brak miejsca w plecaku.");

        // 2. Pobierz przedmiot ze zbrojowni
        const itemRes = await client.query(
            `SELECT a.*, c.data->>'name' as owner_name FROM guild_armory_items a 
             JOIN characters c ON a.owner_id = c.user_id 
             WHERE a.id = $1 AND a.guild_id = $2 FOR UPDATE`,
            [armoryId, guildId]
        );
        if (itemRes.rows.length === 0) throw new Error("Przedmiot nie jest już dostępny w zbrojowni.");
        
        const armoryEntry = itemRes.rows[0];
        const item: ItemInstance = armoryEntry.item_data;

        // 3. Oblicz koszty (Wartość przedmiotu * Podatek)
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const templates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

        const template = templates.find(t => t.id === item.templateId);
        if (!template) throw new Error("Błąd danych przedmiotu.");

        let baseValue = Number(template.value) || 0;
        if (item.prefixId) baseValue += (affixes.find(a => a.id === item.prefixId)?.value || 0);
        if (item.suffixId) baseValue += (affixes.find(a => a.id === item.suffixId)?.value || 0);

        const guildDataRes = await client.query('SELECT resources, rental_tax FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guildData = guildDataRes.rows[0];
        const taxRate = guildData.rental_tax || 10;
        const cost = Math.ceil(baseValue * (taxRate / 100));

        if (character.resources.gold < cost) throw new Error(`Brak złota na opłatę wypożyczenia (${cost}g).`);

        // 4. Wykonaj transfer
        character.resources.gold -= cost;
        const guildResources = guildData.resources;
        guildResources.gold += cost;

        item.isBorrowed = true;
        item.borrowedFromGuildId = guildId;
        item.borrowedAt = Date.now();
        item.originalOwnerId = armoryEntry.owner_id;
        item.originalOwnerName = armoryEntry.owner_name;

        character.inventory.push(item);

        // 5. Zapisz zmiany
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), userId]);
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildResources), guildId]);
        await client.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);
        await client.query(
            `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) 
             VALUES ($1, $2, 'RENTAL', 'gold', $3)`,
            [guildId, userId, cost]
        );

        await client.query('COMMIT');
        res.json({ message: "Przedmiot wypożyczony.", character });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/armory/recall - Przymusowe odebranie przedmiotu od członka
router.post('/armory/recall', async (req: any, res: any) => {
    const { targetUserId, itemUniqueId } = req.body;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Sprawdź uprawnienia (Lider/Oficer/Właściciel)
        const myMemberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [userId]);
        if (myMemberRes.rows.length === 0) throw new Error("Brak gildii.");
        const guildId = myMemberRes.rows[0].guild_id;
        const myRole = myMemberRes.rows[0].role;

        const targetCharRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [targetUserId]);
        if (targetCharRes.rows.length === 0) throw new Error("Cel nie istnieje.");
        const targetCharacter: PlayerCharacter = targetCharRes.rows[0].data;

        const itemIdx = targetCharacter.inventory.findIndex(i => i.uniqueId === itemUniqueId);
        if (itemIdx === -1) throw new Error("Przedmiot nie znajduje się już u tego gracza.");
        const item = targetCharacter.inventory[itemIdx];

        if (!item.isBorrowed || item.borrowedFromGuildId !== guildId) throw new Error("To nie jest przedmiot pożyczony z Twojej gildii.");

        const isOwner = item.originalOwnerId === userId;
        if (!isOwner && !canManage(myRole as GuildRole)) throw new Error("Brak uprawnień do wycofania przedmiotu.");

        // 2. Usuń od gracza i zwróć do zbrojowni (nie sprawdzamy limitu zbrojowni przy Recall, aby uniknąć blokady przedmiotu)
        targetCharacter.inventory.splice(itemIdx, 1);
        
        const originalOwnerId = item.originalOwnerId!;
        delete item.isBorrowed;
        delete item.borrowedFromGuildId;
        delete item.borrowedAt;
        delete item.originalOwnerId;
        delete item.originalOwnerName;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(targetCharacter), targetUserId]);
        await client.query(
            `INSERT INTO guild_armory_items (guild_id, owner_id, item_data) VALUES ($1, $2, $3)`,
            [guildId, originalOwnerId, JSON.stringify(item)]
        );

        await client.query('COMMIT');
        res.json({ message: "Przedmiot został wycofany do zbrojowni." });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// DELETE /api/guilds/armory/:armoryId - Usunięcie przedmiotu ze zbrojowni (zwraca go do właściciela)
router.delete('/armory/:armoryId', async (req: any, res: any) => {
    const { armoryId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Sprawdź uprawnienia lidera
        const myMemberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (myMemberRes.rows.length === 0 || myMemberRes.rows[0].role !== GuildRole.LEADER) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: "Tylko lider może usuwać przedmioty." });
        }
        const guildId = myMemberRes.rows[0].guild_id;

        // 2. Pobierz przedmiot, aby poznać właściciela
        const itemRes = await client.query(
            'SELECT item_data, owner_id FROM guild_armory_items WHERE id = $1 AND guild_id = $2 FOR UPDATE',
            [armoryId, guildId]
        );
        if (itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Przedmiot nie znaleziony." });
        }

        const { item_data: item, owner_id: ownerId } = itemRes.rows[0];

        // 3. Usuń ze zbrojowni
        await client.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);

        // 4. Zwróć przedmiot właścicielowi
        const ownerCharRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [ownerId]);
        if (ownerCharRes.rows.length > 0) {
            const ownerChar = ownerCharRes.rows[0].data;
            const backpackCap = getBackpackCapacity(ownerChar);

            if (ownerChar.inventory.length < backpackCap) {
                // Do plecaka
                ownerChar.inventory.push(item);
                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(ownerChar), ownerId]);
            } else {
                // Plecak pełny -> Wyślij pocztą systemową (ITEM_RETURNED pozwala na claim)
                await enforceInboxLimit(client, ownerId);
                const body = { 
                    type: 'ITEM_RETURNED', 
                    itemName: 'Zwrot ze zbrojowni gildii', 
                    item 
                };
                await client.query(
                    `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) 
                     VALUES ($1, 'Gildia', 'market_notification', 'Twój przedmiot został zwrócony ze zbrojowni', $2)`,
                    [ownerId, JSON.stringify(body)]
                );
            }
        }

        await client.query('COMMIT');
        res.sendStatus(204);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Armory Delete/Return Error:", err);
        res.status(500).json({ message: "Błąd podczas usuwania przedmiotu." });
    } finally {
        client.release();
    }
});

// GET /api/guilds/raids - Lista rajdów (Aktywne i historia)
router.get('/raids', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Brak gildii' });
        const guildId = memberRes.rows[0].guild_id;

        const raids = await getActiveRaids(guildId);
        res.json(raids);
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania rajdów' });
    }
});

// GET /api/guilds/espionage - Aktywne misje szpiegowskie i raporty
router.get('/espionage', async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Brak gildii' });
        const guildId = memberRes.rows[0].guild_id;

        const activeSpies = await pool.query(`
            SELECT e.*, g.name as "targetGuildName"
            FROM guild_espionage e
            JOIN guilds g ON e.defender_guild_id = g.id
            WHERE e.attacker_guild_id = $1 AND e.status = 'IN_PROGRESS'
            ORDER BY e.end_time ASC
        `, [guildId]);

        const history = await pool.query(`
            SELECT e.*, g.name as "targetGuildName"
            FROM guild_espionage e
            JOIN guilds g ON e.defender_guild_id = g.id
            WHERE e.attacker_guild_id = $1 AND e.status = 'COMPLETED'
            ORDER BY e.end_time DESC LIMIT 20
        `, [guildId]);

        res.json({
            activeSpies: activeSpies.rows.map(r => ({ ...r, targetGuildName: r.targetGuildName, endTime: r.end_time })),
            history: history.rows.map(r => ({ ...r, targetGuildName: r.targetGuildName, endTime: r.end_time, resultSnapshot: r.result_snapshot }))
        });
    } catch (err) {
        res.status(500).json({ message: 'Błąd pobierania danych wywiadu' });
    }
});

// GET /api/guilds/targets - Inne gildie dla szpiegostwa i rajdów
router.get('/targets', async (req: any, res: any) => {
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

// POST /api/guilds/create - Tworzenie nowej gildii
router.post('/create', async (req: any, res: any) => {
    const { name, tag, description } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.resources.gold < 1000) throw new Error('Brak złota (wymagane 1000g)');

        const existingMember = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (existingMember.rows.length > 0) throw new Error('Już należysz do gildii');

        const guildInsert = await client.query(
            `INSERT INTO guilds (name, tag, description, leader_id) VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, tag, description, req.user.id]
        );
        const guildId = guildInsert.rows[0].id;

        await client.query(
            `INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, $3)`,
            [guildId, req.user.id, GuildRole.LEADER]
        );

        char.resources.gold -= 1000;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);

        await client.query('COMMIT');
        res.status(201).json({ id: guildId });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/join/:id - Dołączanie do gildii
router.post('/join/:id', async (req: any, res: any) => {
    const guildId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const guildRes = await client.query('SELECT * FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildRes.rows.length === 0) throw new Error('Gildia nie istnieje');
        const guild = guildRes.rows[0];

        if (!guild.is_public) throw new Error('Ta gildia jest zamknięta');
        if (guild.member_count >= guild.max_members) throw new Error('Gildia jest pełna');

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.level < guild.min_level) throw new Error(`Wymagany poziom: ${guild.min_level}`);

        const existingMember = await client.query('SELECT 1 FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (existingMember.rows.length > 0) throw new Error('Już należysz do gildii');

        await client.query('INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, $3)', [guildId, req.user.id, GuildRole.RECRUIT]);
        await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guildId]);

        await client.query('COMMIT');
        res.json({ message: 'Dołączono' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/update - Zapisywanie ustawień gildii
router.post('/update', async (req: any, res: any) => {
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

// POST /api/guilds/bank - Operacje bankowe
router.post('/bank', async (req: any, res: any) => {
    const { type, currency, amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Brak gildii');
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;

        if (type === 'DEPOSIT') {
            if ((char.resources[currency] || 0) < amount) throw new Error('Brak środków');
            char.resources[currency] -= amount;
            const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
            const resources = guildRes.rows[0].resources;
            resources[currency] = (resources[currency] || 0) + amount;
            await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(resources), guildId]);
            await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'DEPOSIT', $3, $4)`, [guildId, req.user.id, currency, amount]);
        }

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/guilds/upgrade-building - Ulepszanie budynków
router.post('/upgrade-building', async (req: any, res: any) => {
    const { buildingType } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Brak gildii');
        const { guild_id: guildId, role } = memberRes.rows[0];

        if (!canManage(role as GuildRole)) throw new Error('Brak uprawnień');

        const guildRes = await client.query('SELECT buildings, resources, max_members FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        const buildings = guild.buildings || {};
        const currentLevel = buildings[buildingType] || 0;

        const cost = getBuildingCost(buildingType, currentLevel);
        if (guild.resources.gold < cost.gold) throw new Error('Skarbiec gildii nie ma dość złota');
        for (const e of cost.costs) {
            if ((guild.resources[e.type] || 0) < e.amount) throw new Error(`Brak esencji w skarbcu: ${e.type}`);
        }

        guild.resources.gold -= cost.gold;
        for (const e of cost.costs) guild.resources[e.type] -= e.amount;
        buildings[buildingType] = currentLevel + 1;

        let maxMembers = guild.max_members;
        if (buildingType === 'headquarters') maxMembers = 10 + buildings[buildingType];

        await client.query(
            'UPDATE guilds SET buildings = $1, resources = $2, max_members = $3 WHERE id = $4',
            [JSON.stringify(buildings), JSON.stringify(guild.resources), maxMembers, guildId]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// Rajdy i Szpiegostwo - Inicjacja
router.post('/raids/create', async (req: any, res: any) => {
    const { targetGuildId, raidType } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || !canManage(memberRes.rows[0].role)) throw new Error('Brak uprawnień');
        
        await createRaid(memberRes.rows[0].guild_id, req.user.id, targetGuildId, raidType);
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/raids/join', async (req: any, res: any) => {
    const { raidId } = req.body;
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Brak gildii');
        
        await joinRaid(raidId, req.user.id, memberRes.rows[0].guild_id);
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/espionage/start', async (req: any, res: any) => {
    const { targetGuildId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberRes = await client.query('SELECT guild_id, role FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0 || !canManage(memberRes.rows[0].role)) throw new Error('Brak uprawnień');
        const guildId = memberRes.rows[0].guild_id;

        const targetRes = await client.query(`
            SELECT g.id, COALESCE(SUM((c.data->>'level')::int), 0) as total_level
            FROM guilds g
            LEFT JOIN guild_members gm ON g.id = gm.guild_id
            LEFT JOIN characters c ON gm.user_id = c.user_id
            WHERE g.id = $1
            GROUP BY g.id
        `, [targetGuildId]);
        
        if (targetRes.rows.length === 0) throw new Error('Cel nie istnieje');
        const cost = 1000 + (targetRes.rows[0].total_level * 50);

        const guildData = await client.query('SELECT resources, buildings FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        if (guildData.rows[0].resources.gold < cost) throw new Error('Brak złota w skarbcu');
        
        const spyLevel = guildData.rows[0].buildings?.spyHideout || 0;
        const durationMin = spyLevel >= 3 ? 5 : spyLevel === 2 ? 10 : 15;
        const endTime = new Date(Date.now() + durationMin * 60000);

        guildData.rows[0].resources.gold -= cost;
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guildData.rows[0].resources), guildId]);

        await client.query(`
            INSERT INTO guild_espionage (attacker_guild_id, defender_guild_id, status, start_time, end_time, cost)
            VALUES ($1, $2, 'IN_PROGRESS', NOW(), $3, $4)
        `, [guildId, targetGuildId, endTime, cost]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

export default router;
