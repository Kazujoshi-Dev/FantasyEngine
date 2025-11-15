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

// FIX: Increased backpack base capacity to 40 for consistency.
export const getBackpackCapacity = (character: PlayerCharacter): number => 40 + ((character.backpack?.level || 1) - 1) * 10;