
import express from 'express';
import { pool } from '../../db.js';
import { PlayerCharacter, EquipmentSlot, ItemTemplate, CharacterStats, GameData } from '../../types.js';
import { calculateDerivedStatsOnServer } from '../../logic/stats.js';
import { getBackpackCapacity } from '../../logic/helpers.js';

const router = express.Router();

/**
 * Helper do sprawdzania wymagań przedmiotu.
 * UWAGA: Używa wyliczonych statystyk (totalStats), nie bazowych.
 */
const canEquip = (character: PlayerCharacter, template: ItemTemplate, totalStats: CharacterStats): { success: boolean; message?: string } => {
    if (character.level < template.requiredLevel) {
        return { success: false, message: `Wymagany poziom: ${template.requiredLevel}` };
    }

    if (template.requiredStats) {
        for (const [stat, value] of Object.entries(template.requiredStats)) {
            const key = stat as keyof CharacterStats;
            const playerValue = Number(totalStats[key]) || 0;
            if (playerValue < (value as number)) {
                return { success: false, message: `Niewystarczająca ilość statystyki: ${stat} (Wymagane: ${value}, Posiadasz: ${playerValue})` };
            }
        }
    }
    return { success: true };
};

// POST /api/character/equip
router.post('/equip', async (req: any, res: any) => {
    const { itemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Pobierz postać i dane gildii dla statystyk
        const charRes = await client.query(`
            SELECT c.data, g.buildings, g.active_buffs 
            FROM characters c 
            LEFT JOIN guild_members gm ON c.user_id = gm.user_id
            LEFT JOIN guilds g ON gm.guild_id = g.id
            WHERE c.user_id = $1 FOR UPDATE OF c
        `, [req.user.id]);

        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;
        const guildBuildings = charRes.rows[0].buildings || {};
        const activeGuildBuffs = charRes.rows[0].active_buffs || [];

        // 2. Znajdź przedmiot w ekwipunku
        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) throw new Error("Item not found in inventory");
        const item = character.inventory[itemIndex];

        // 3. Pobierz dane gry dla statystyk
        const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes', 'skills')");
        const gameData: Partial<GameData> = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {});
        
        const template = (gameData.itemTemplates || []).find(t => t.id === item.templateId);
        if (!template) throw new Error("Item template missing");

        // 4. Oblicz AKTUALNE pełne statystyki (uwzględniając obecny sprzęt i gildie)
        const derivedChar = calculateDerivedStatsOnServer(
            character, 
            gameData.itemTemplates || [], 
            gameData.affixes || [], 
            guildBuildings.barracks || 0, 
            guildBuildings.shrine || 0, 
            gameData.skills || [],
            activeGuildBuffs
        );

        // 5. Walidacja wymagań na bazie wyliczonych statystyk (totalStats)
        const validation = canEquip(character, template, derivedChar.stats);
        if (!validation.success) throw new Error(validation.message);

        // 6. Określ slot docelowy
        let targetSlot: EquipmentSlot;
        if (template.slot === 'ring') {
            targetSlot = !character.equipment.ring1 ? EquipmentSlot.Ring1 : EquipmentSlot.Ring2;
        } else {
            targetSlot = template.slot as EquipmentSlot;
        }

        const itemsToUnequip: EquipmentSlot[] = [];

        // Logika broni 2H vs 1H
        if (targetSlot === EquipmentSlot.TwoHand) {
            if (character.equipment.mainHand) itemsToUnequip.push(EquipmentSlot.MainHand);
            if (character.equipment.offHand) itemsToUnequip.push(EquipmentSlot.OffHand);
        } else if (targetSlot === EquipmentSlot.MainHand || targetSlot === EquipmentSlot.OffHand) {
            if (character.equipment.twoHand) itemsToUnequip.push(EquipmentSlot.TwoHand);
        }

        // Standardowe zdejmowanie przedmiotu z zajętego slotu
        if (character.equipment[targetSlot]) {
            itemsToUnequip.push(targetSlot);
        }

        // 7. Sprawdź miejsce w plecaku po uwzględnieniu rotacji
        const backpackCap = getBackpackCapacity(character);
        const uniqueUnequips = Array.from(new Set(itemsToUnequip));
        if (character.inventory.length - 1 + uniqueUnequips.length > backpackCap) {
            throw new Error("Brak miejsca w plecaku na zamianę przedmiotów");
        }

        // 8. Wykonaj rotację
        uniqueUnequips.forEach(slot => {
            const oldItem = character.equipment[slot];
            if (oldItem) {
                character.inventory.push(oldItem);
                character.equipment[slot] = null;
            }
        });

        // 9. Załóż nowy przedmiot
        character.inventory.splice(itemIndex, 1);
        character.equipment[targetSlot] = item;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /api/character/unequip
router.post('/unequip', async (req: any, res: any) => {
    const { slot } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        if (charRes.rows.length === 0) throw new Error("Character not found");
        const character: PlayerCharacter = charRes.rows[0].data;

        const item = character.equipment[slot as EquipmentSlot];
        if (!item) throw new Error("Slot jest pusty");

        if (character.inventory.length >= getBackpackCapacity(character)) {
            throw new Error("Plecak jest pełny");
        }

        character.inventory.push(item);
        character.equipment[slot as EquipmentSlot] = null;

        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
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
