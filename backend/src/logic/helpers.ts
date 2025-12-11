
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { Buffer } from 'buffer';
import { PlayerCharacter } from '../types.js';

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
