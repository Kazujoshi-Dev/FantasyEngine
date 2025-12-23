
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { getActiveRaids, createRaid, joinRaid } from '../logic/guildRaids.js';
import { getBuildingCost, canManage, pruneExpiredBuffs } from '../logic/guilds.js';
import { GuildRole, EssenceType, ItemInstance, ItemTemplate, Affix } from '../types.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// ... (pozostałe endpointy bez zmian)

// POST /api/guilds/armory/borrow
router.post('/armory/borrow', authenticateToken, async (req: any, res: any) => {
    const { armoryId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const memberRes = await client.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) throw new Error('Not in guild');
        const guildId = memberRes.rows[0].guild_id;

        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const char = charRes.rows[0].data;
        if (char.inventory.length >= getBackpackCapacity(char)) throw new Error('Backpack full');

        const itemRes = await client.query('SELECT * FROM guild_armory_items WHERE id = $1 AND guild_id = $2 FOR UPDATE', [armoryId, guildId]);
        if (itemRes.rows.length === 0) throw new Error('Item not found in armory');
        
        const armoryEntry = itemRes.rows[0];
        const item: ItemInstance = armoryEntry.item_data;
        const ownerRes = await client.query("SELECT data->>'name' as name FROM characters WHERE user_id = $1", [armoryEntry.owner_id]);
        const ownerName = ownerRes.rows[0]?.name || 'Unknown';

        // Calculate actual item value on server for tax accuracy
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
        const templates: ItemTemplate[] = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
        const affixes: Affix[] = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];
        
        const template = templates.find(t => t.id === item.templateId);
        let value = template ? template.value : 100;
        
        if (item.prefixId) {
            const prefix = affixes.find(a => a.id === item.prefixId);
            if (prefix) value += (prefix.value || 0);
        }
        if (item.suffixId) {
            const suffix = affixes.find(a => a.id === item.suffixId);
            if (suffix) value += (suffix.value || 0);
        }

        const guildRes = await client.query('SELECT rental_tax, resources FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
        const guild = guildRes.rows[0];
        const tax = Math.ceil(value * (guild.rental_tax / 100));

        if (char.resources.gold < tax) throw new Error(`Not enough gold for rental tax (Required: ${tax})`);

        // Process Transaction
        char.resources.gold -= tax;
        if (!guild.resources) guild.resources = { gold: 0 };
        guild.resources.gold = (Number(guild.resources.gold) || 0) + tax;
        
        // Add Borrow Flags
        item.isBorrowed = true;
        item.borrowedFromGuildId = guildId;
        item.originalOwnerId = armoryEntry.owner_id;
        item.originalOwnerName = ownerName;
        item.borrowedAt = Date.now();
        
        char.inventory.push(item);
        
        await client.query('DELETE FROM guild_armory_items WHERE id = $1', [armoryId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(char), req.user.id]);
        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(guild.resources), guildId]);
        
        await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'RENTAL', 'gold', $3)`, [guildId, req.user.id, tax]);

        await client.query('COMMIT');
        res.json(char);
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("BORROW ERROR:", err.message);
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// ... (reszta pliku bez zmian)
export default router;
