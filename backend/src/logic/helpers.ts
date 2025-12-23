
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { Buffer } from 'buffer';
import { PlayerCharacter } from '../types.js';
// Import pruneExpiredBuffs to handle character synchronization
import { pruneExpiredBuffs } from './guilds.js';

export const hashPassword = (password: string) => {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
};

export const verifyPassword = (password: string, salt: string, storedHash: string): boolean => {
    if (!password || !salt || !storedHash) {
        return false;
    }
    try {
        const hashToCompare = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        
        const storedHashBuffer = Buffer.from(storedHash, 'hex');
        const hashToCompareBuffer = Buffer.from(hashToCompare, 'hex');

        if (storedHashBuffer.length !== hashToCompareBuffer.length) {
            return false;
        }

        return timingSafeEqual(storedHashBuffer, hashToCompareBuffer);
    } catch (e) {
        console.error("Error during password verification:", e);
        return false;
    }
};

export const getBackpackCapacity = (character: PlayerCharacter): number => 40 + ((character.backpack?.level || 1) - 1) * 10;

// Enforces a limit of unsaved messages in the inbox (FIFO).
// Keeps the 'limit' newest unsaved messages, deletes the rest.
// Use limit = 49 before inserting 1 new message to maintain a cap of 50.
export const enforceInboxLimit = async (client: any, userId: number, limit: number = 49) => {
    await client.query(`
        DELETE FROM messages
        WHERE id IN (
            SELECT id FROM messages
            WHERE recipient_id = $1 AND is_saved = FALSE
            ORDER BY created_at DESC
            OFFSET $2
        )
    `, [userId, limit]);
};

/**
 * central logic for fetching full character data, used by multiple routes to ensure consistency.
 * It fetches the base JSONB data and joins with user and guild tables for derived stats context.
 */
export const fetchFullCharacter = async (client: any, userId: number): Promise<PlayerCharacter | null> => {
    const result = await client.query(`
        SELECT 
            c.data, u.email, g.buildings, g.active_buffs, g.id as guild_id,
            (SELECT row_to_json(tr) FROM tower_runs tr WHERE tr.user_id = c.user_id AND tr.status = 'IN_PROGRESS' LIMIT 1) as active_tower_run
        FROM characters c 
        JOIN users u ON c.user_id = u.id
        LEFT JOIN guild_members gm ON c.user_id = gm.user_id
        LEFT JOIN guilds g ON gm.guild_id = g.id
        WHERE c.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    const charData: PlayerCharacter = row.data;

    // Apply defensive defaults for data consistency
    if (!charData.loadouts) charData.loadouts = [];
    if (!charData.resources) charData.resources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
    if (row.email) charData.email = row.email;
    if (charData.honor === undefined) charData.honor = 0;

    // Synchronize guild-related context
    if (row.guild_id) {
        charData.guildId = row.guild_id;
        charData.guildBarracksLevel = row.buildings?.barracks || 0;
        charData.guildShrineLevel = row.buildings?.shrine || 0;
        charData.guildStablesLevel = row.buildings?.stables || 0;
        
        // Prune expired buffs and sync if needed
        const { pruned, wasModified } = pruneExpiredBuffs(row.active_buffs || []);
        if (wasModified) {
            await client.query('UPDATE guilds SET active_buffs = $1 WHERE id = $2', [JSON.stringify(pruned), row.guild_id]);
            charData.activeGuildBuffs = pruned;
        } else {
            charData.activeGuildBuffs = row.active_buffs || [];
        }
    }

    // Map active tower run if present
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

    return charData;
};
