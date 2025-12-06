import express from 'express';
import { pool } from '../db.js';
import { PlayerCharacter, CharacterStats, Language } from '../types.js';

const router = express.Router();

router.post('/characters/:userId/reset-progress', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        
        const oldChar: PlayerCharacter = charRes.rows[0].data;
        
        const initialStats: CharacterStats = {
          strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0,
          statPoints: 10,
          currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10,
          currentMana: 20, maxMana: 20,
          minDamage: 0, maxDamage: 0,
          magicDamageMin: 0, magicDamageMax: 0,
          critChance: 0,
          critDamageModifier: 200,
          armor: 0,
          armorPenetrationPercent: 0,
          armorPenetrationFlat: 0,
          attacksPerRound: 1,
          manaRegen: 0,
          lifeStealPercent: 0,
          lifeStealFlat: 0,
          manaStealPercent: 0,
          manaStealFlat: 0,
          dodgeChance: 0,
        };

        const newChar: PlayerCharacter = {
            name: oldChar.name,
            race: oldChar.race,
            settings: oldChar.settings || { language: Language.PL },
            characterClass: null,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: initialStats,
            resources: { gold: 500, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            currentLocationId: oldChar.currentLocationId, 
            activeExpedition: null,
            activeTravel: null,
            camp: { level: 1 },
            chest: { level: 1, gold: 0 },
            backpack: { level: 1 },
            isResting: false,
            restStartHealth: 0,
            lastRestTime: undefined,
            lastEnergyUpdateTime: Date.now(),
            equipment: { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            inventory: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0,
            learnedSkills: [],
            questProgress: [],
            acceptedQuests: [],
            freeStatResetUsed: false,
            guildId: oldChar.guildId,
        };
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [newChar, req.params.userId]);
        await client.query('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to reset progress' });
    } finally {
        client.release();
    }
});

// POST /api/admin/characters/:userId/soft-reset (Repair Character)
// Resets stats and level to 1, ensures structure integrity, BUT KEEPS INVENTORY and EQUIPMENT
router.post('/characters/:userId/soft-reset', async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.params.userId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ message: 'Character not found' });
        }
        
        const oldChar: PlayerCharacter = charRes.rows[0].data;
        
        // Default Safe Stats
        const initialStats: CharacterStats = {
          strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0,
          statPoints: 10, // Level 1 default
          currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10,
          currentMana: 20, maxMana: 20,
          minDamage: 0, maxDamage: 0,
          magicDamageMin: 0, magicDamageMax: 0,
          critChance: 0,
          critDamageModifier: 200,
          armor: 0,
          armorPenetrationPercent: 0,
          armorPenetrationFlat: 0,
          attacksPerRound: 1,
          manaRegen: 0,
          lifeStealPercent: 0,
          lifeStealFlat: 0,
          manaStealPercent: 0,
          manaStealFlat: 0,
          dodgeChance: 0,
        };

        // Reconstruct character with safe defaults but PRESERVE items/gold
        const fixedChar: PlayerCharacter = {
            // Identity
            name: oldChar.name || 'Unknown Hero',
            race: oldChar.race || 'Human' as any,
            username: oldChar.username,
            id: oldChar.id,
            
            // Reset Progression
            characterClass: null,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: initialStats,
            
            // Keep Resources/Items (Safe fallback if missing)
            resources: oldChar.resources || { gold: 500, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 },
            inventory: Array.isArray(oldChar.inventory) ? oldChar.inventory : [],
            equipment: oldChar.equipment || { head: null, chest: null, legs: null, feet: null, hands: null, waist: null, neck: null, ring1: null, ring2: null, mainHand: null, offHand: null, twoHand: null },
            
            // Reset World State to prevent stuck logic
            currentLocationId: 'village', // Force back to start
            activeExpedition: null,
            activeTravel: null,
            isResting: false,
            
            // Keep Buildings
            camp: oldChar.camp || { level: 1 },
            chest: oldChar.chest || { level: 1, gold: 0 },
            backpack: oldChar.backpack || { level: 1 },
            
            // Keep Social
            guildId: oldChar.guildId,
            
            // Reset combat counters
            pvpWins: oldChar.pvpWins || 0,
            pvpLosses: oldChar.pvpLosses || 0,
            pvpProtectionUntil: 0,
            
            // Keep Quests? Maybe safer to keep progress but reset active state if broken
            questProgress: oldChar.questProgress || [],
            acceptedQuests: oldChar.acceptedQuests || [],
            
            learnedSkills: oldChar.learnedSkills || [],
            activeSkills: [], // Reset active toggles
            settings: oldChar.settings || { language: Language.PL },
            
            // Reset timers
            lastEnergyUpdateTime: Date.now(),
            restStartHealth: 0
        };
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [fixedChar, req.params.userId]);
        await client.query('COMMIT');
        res.json({ message: 'Postać naprawiona (Soft Reset)', character: fixedChar });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to repair character: ' + err.message });
    } finally {
        client.release();
    }
});

export default router;