
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PartyStatus, PartyMemberStatus, HuntingParty, GameData, PlayerCharacter } from '../types.js';
import { getPartyByLeader, getPartyByMember, processPartyCombat, camelizeParty } from '../logic/hunting.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';

const router = express.Router();

const getGameData = async (): Promise<GameData> => {
    const gameDataRes = await pool.query("SELECT key, data FROM game_data");
    return gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);
};

// GET /api/hunting/parties - List open PUBLIC parties (FORMING)
// Guild parties are handled by a separate logic or filter
router.get('/parties', authenticateToken, async (req: any, res: any) => {
    try {
        // Show public parties only (guild_id IS NULL)
        const result = await pool.query(`
            SELECT hp.id, hp.leader_id, hp.boss_id, hp.max_members, hp.status, hp.members, hp.auto_join, c.data->>'name' as leader_name
            FROM hunting_parties hp
            JOIN characters c ON hp.leader_id = c.user_id
            WHERE hp.status = 'FORMING' AND hp.guild_id IS NULL
            ORDER BY hp.created_at DESC
        `);
        
        const parties = result.rows.map(row => ({
            id: row.id,
            leaderId: row.leader_id,
            bossId: row.boss_id,
            maxMembers: row.max_members,
            status: row.status,
            members: row.members,
            currentMembersCount: row.members.length,
            leaderName: row.leader_name,
            autoJoin: row.auto_join
        }));
        
        res.json(parties);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch parties' });
    }
});

// GET /api/hunting/guild-parties - List active GUILD parties
router.get('/guild-parties', authenticateToken, async (req: any, res: any) => {
    try {
        const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
        if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Not in guild' });
        const guildId = memberRes.rows[0].guild_id;

        const result = await pool.query(`
            SELECT hp.id, hp.leader_id, hp.boss_id, hp.max_members, hp.status, hp.members, hp.auto_join, c.data->>'name' as leader_name
            FROM hunting_parties hp
            JOIN characters c ON hp.leader_id = c.user_id
            WHERE hp.status = 'FORMING' AND hp.guild_id = $1
            ORDER BY hp.created_at DESC
        `, [guildId]);
        
        const parties = result.rows.map(row => ({
            id: row.id,
            leaderId: row.leader_id,
            bossId: row.boss_id,
            maxMembers: row.max_members,
            status: row.status,
            members: row.members,
            currentMembersCount: row.members.length,
            leaderName: row.leader_name,
            autoJoin: row.auto_join
        }));
        
        res.json(parties);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch guild parties' });
    }
});

// GET /api/hunting/my-party - Get current user's party status
router.get('/my-party', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        const partyRes = await client.query(`
            SELECT p.* FROM hunting_parties p, jsonb_array_elements(p.members) AS member 
            WHERE (member->>'userId')::int = $1 FOR UPDATE
        `, [req.user.id]);

        if (partyRes.rows.length === 0) {
            await client.query('COMMIT');
            return res.json({ party: null, serverTime: new Date().toISOString() });
        }
        
        let party = camelizeParty(partyRes.rows[0]);

        if (party.status === PartyStatus.Preparing && party.startTime) {
            const gameData = await getGameData();
            const boss = gameData.enemies.find(e => e.id === party.bossId);
            const preparationTimeSeconds = boss?.preparationTimeSeconds ?? 30;
            const fightStartTime = new Date(party.startTime).getTime() + preparationTimeSeconds * 1000;

            if (Date.now() >= fightStartTime) {
                await client.query('SAVEPOINT before_combat');
                try {
                    await client.query("UPDATE hunting_parties SET status = 'FIGHTING' WHERE id = $1", [party.id]);
                    await processPartyCombat(party, gameData, client);
                } catch (combatError) {
                    console.error(`CRITICAL: processPartyCombat failed for party ${party.id}. Rolling back combat and marking as failed.`, combatError);
                    await client.query('ROLLBACK TO SAVEPOINT before_combat');
                    
                    const failureLog = [{
                        turn: 0,
                        action: 'Wystąpił krytyczny błąd podczas przetwarzania walki. Skontaktuj się z administratorem.',
                        attacker: 'System',
                        defender: 'Gracze',
                        playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0
                    }];

                    await client.query(
                        `UPDATE hunting_parties 
                         SET status = 'FINISHED', victory = false, combat_log = $1, rewards = '{}'::jsonb 
                         WHERE id = $2`, 
                        [JSON.stringify(failureLog), party.id]
                    );
                }

                // After processing (success or failure), re-fetch to get the final state.
                const finalPartyRes = await client.query('SELECT * FROM hunting_parties WHERE id = $1', [party.id]);
                if (finalPartyRes.rows.length > 0) {
                    party = camelizeParty(finalPartyRes.rows[0]);
                }
            }
        }
        
        if (party.status === PartyStatus.Finished) {
             // 1. Rewards logic
             if (!party.myRewards) {
                 const rewardsRaw = (await client.query('SELECT rewards FROM hunting_parties WHERE id = $1', [party.id])).rows[0]?.rewards;
                 if (rewardsRaw) {
                     const myName = party.members.find(m => m.userId === req.user.id)?.characterName;
                     if (myName) {
                         party.myRewards = rewardsRaw[myName];
                     }
                     party.allRewards = rewardsRaw;
                 }
             }

             // 2. Find the message ID associated with this report for the "Copy Link" button
             const msgRes = await client.query(
                `SELECT id FROM messages 
                 WHERE recipient_id = $1 
                 AND message_type = 'expedition_report' 
                 AND (body->>'bossId') = $2 
                 ORDER BY created_at DESC LIMIT 1`,
                [req.user.id, party.bossId]
            );
            if (msgRes.rows.length > 0) {
                party.messageId = msgRes.rows[0].id;
            }
        }
        
        await client.query('COMMIT');

        res.json({ party, serverTime: new Date().toISOString() });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch party status' });
    } finally {
        client.release();
    }
});


// POST /api/hunting/create - Create a new party
router.post('/create', authenticateToken, async (req: any, res: any) => {
    const { bossId, maxMembers, isGuildParty, autoJoin } = req.body;
    
    try {
        const towerRes = await pool.query("SELECT 1 FROM tower_runs WHERE user_id = $1 AND status = 'IN_PROGRESS'", [req.user.id]);
        if (towerRes.rows.length > 0) {
            return res.status(400).json({ message: 'Nie możesz polować będąc w Wieży Mroku.' });
        }

        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;
        const hasLoneWolf = (char.learnedSkills || []).includes('lone-wolf');
        
        let guildId: number | null = null;
        if (isGuildParty) {
            const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
            if (memberRes.rows.length === 0) return res.status(403).json({ message: 'Nie należysz do gildii.' });
            guildId = memberRes.rows[0].guild_id;

            if (maxMembers < 2) {
                return res.status(400).json({ message: 'Polowania gildyjne wymagają minimum 2 osób.' });
            }
            
            // Verify Boss is Guild Boss
            const gameDataRes = await pool.query("SELECT data FROM game_data WHERE key = 'enemies'");
            const enemies = gameDataRes.rows[0].data;
            const boss = enemies.find((e: any) => e.id === bossId);
            if (!boss || !boss.isGuildBoss) {
                 return res.status(400).json({ message: 'To nie jest boss gildyjny.' });
            }

        } else {
            // Regular party logic
             if (maxMembers === 1 && !hasLoneWolf) {
                return res.status(400).json({ message: 'Aby wyruszyć samotnie, musisz posiadać zdolność "Samotny Wilk".' });
            }
            
            // Verify Boss is NOT a Guild Boss
            const gameDataRes = await pool.query("SELECT data FROM game_data WHERE key = 'enemies'");
            const enemies = gameDataRes.rows[0].data;
            const boss = enemies.find((e: any) => e.id === bossId);
            if (boss && boss.isGuildBoss) {
                 return res.status(400).json({ message: 'Ten boss jest dostępny tylko w polowaniach gildyjnych.' });
            }
        }
        
        if (char.stats.currentHealth <= 0) {
            return res.status(400).json({ message: 'Nie możesz założyć grupy, gdy masz 0 punktów życia. Ulecz swoją postać.' });
        }

        if (maxMembers < 1 || maxMembers > 5) {
             return res.status(400).json({ message: 'Rozmiar grupy musi być pomiędzy 1 a 5.' });
        }

        const existingParty = await getPartyByMember(req.user.id);
        if (existingParty) return res.status(400).json({ message: 'Jesteś już w grupie.' });

        const initialMembers = [{
            userId: req.user.id,
            characterName: char.name,
            level: char.level,
            race: char.race,
            characterClass: char.characterClass,
            status: PartyMemberStatus.Leader
        }];

        await pool.query(`
            INSERT INTO hunting_parties (leader_id, boss_id, max_members, members, guild_id, auto_join)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.user.id, bossId, maxMembers, JSON.stringify(initialMembers), guildId, !!autoJoin]);

        res.status(201).json({ message: 'Created' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Nie udało się stworzyć grupy' });
    }
});

// POST /api/hunting/join/:partyId
router.post('/join/:partyId', authenticateToken, async (req: any, res: any) => {
    const partyId = req.params.partyId;
    try {
        const towerRes = await pool.query("SELECT 1 FROM tower_runs WHERE user_id = $1 AND status = 'IN_PROGRESS'", [req.user.id]);
        if (towerRes.rows.length > 0) {
            return res.status(400).json({ message: 'Nie możesz polować będąc w Wieży Mroku.' });
        }

        const existingParty = await getPartyByMember(req.user.id);
        if (existingParty) return res.status(400).json({ message: 'Jesteś już w grupie.' });

        const partyRes = await pool.query('SELECT * FROM hunting_parties WHERE id = $1 FOR UPDATE', [partyId]);
        if (partyRes.rows.length === 0) return res.status(404).json({ message: 'Grupa nie znaleziona.' });
        
        const party = partyRes.rows[0];
        if (party.status !== 'FORMING') return res.status(400).json({ message: 'Grupa nie przyjmuje już członków.' });
        
        const members = party.members;
        if (members.length >= party.max_members) return res.status(400).json({ message: 'Grupa jest pełna.' });
        
        // Guild Party Check
        if (party.guild_id) {
            const memberRes = await pool.query('SELECT guild_id FROM guild_members WHERE user_id = $1', [req.user.id]);
            if (memberRes.rows.length === 0 || memberRes.rows[0].guild_id !== party.guild_id) {
                return res.status(403).json({ message: 'To jest prywatne polowanie gildyjne.' });
            }
        }

        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;

        if (char.stats.currentHealth <= 0) {
            return res.status(400).json({ message: 'Nie możesz dołączyć do grupy, gdy masz 0 punktów życia. Ulecz swoją postać.' });
        }

        // Auto Join Logic
        const memberStatus = party.auto_join ? PartyMemberStatus.Member : PartyMemberStatus.Pending;

        members.push({
            userId: req.user.id,
            characterName: char.name,
            level: char.level,
            race: char.race,
            characterClass: char.characterClass,
            status: memberStatus
        });

        let newStatus = party.status;
        let startTime = party.start_time;

        // If AutoJoin is on, check if party is now FULL to auto-start timer
        if (party.auto_join) {
             const acceptedCount = members.filter((m: any) => m.status !== PartyMemberStatus.Pending).length;
             if (acceptedCount >= party.max_members) {
                 newStatus = 'PREPARING';
                 startTime = new Date().toISOString();
             }
        }

        await pool.query('UPDATE hunting_parties SET members = $1, status = $2, start_time = $3 WHERE id = $4', [JSON.stringify(members), newStatus, startTime, partyId]);
        res.status(200).json({ message: 'Joined' });
    } catch (err) {
        res.status(500).json({ message: 'Nie udało się dołączyć do grupy' });
    }
});

// POST /api/hunting/respond - Leader accepts/rejects
router.post('/respond', authenticateToken, async (req: any, res: any) => {
    const { userId, action } = req.body; // action: 'accept' | 'reject' | 'kick'
    try {
        // Fix: Filter out FINISHED parties to prevent leader ID conflict if they left a previous finished party without disbanding
        const partyRes = await pool.query("SELECT * FROM hunting_parties WHERE leader_id = $1 AND status != 'FINISHED' FOR UPDATE", [req.user.id]);
        if (partyRes.rows.length === 0) return res.status(404).json({ message: 'Nie jesteś liderem żadnej aktywnej grupy.' });
        
        const party = partyRes.rows[0];
        let members = party.members as any[];
        
        if (action === 'reject' || action === 'kick') {
            members = members.filter(m => m.userId !== userId);
        } else if (action === 'accept') {
            const memberIndex = members.findIndex(m => m.userId === userId);
            if (memberIndex !== -1) {
                members[memberIndex].status = PartyMemberStatus.Member;
            }
        }

        // Check if full to start timer
        const acceptedCount = members.filter(m => m.status !== PartyMemberStatus.Pending).length;
        let newStatus = party.status;
        let startTime = party.start_time;

        // Auto-start if full
        if (acceptedCount >= party.max_members && party.status === 'FORMING') {
            newStatus = 'PREPARING';
            startTime = new Date().toISOString();
        } else if (acceptedCount < party.max_members && party.status === 'PREPARING') {
            // Revert to FORMING if someone left/kicked during PREPARING and not full anymore
            // (Assuming we enforce full party for auto-start, manual start requires >= 2)
            newStatus = 'FORMING';
            startTime = null;
        }

        await pool.query('UPDATE hunting_parties SET members = $1, status = $2, start_time = $3 WHERE id = $4', 
            [JSON.stringify(members), newStatus, startTime, party.id]);

        res.status(200).json({ message: 'Responded' });
    } catch (err) {
        res.status(500).json({ message: 'Nie udało się zaktualizować statusu członka' });
    }
});

// POST /api/hunting/start - Leader manually starts if full (e.g. for solo)
router.post('/start', authenticateToken, async (req: any, res: any) => {
    try {
        // Fix: Filter out FINISHED parties
        const partyRes = await pool.query("SELECT * FROM hunting_parties WHERE leader_id = $1 AND status != 'FINISHED' FOR UPDATE", [req.user.id]);
        if (partyRes.rows.length === 0) return res.status(404).json({ message: 'Nie jesteś liderem żadnej aktywnej grupy.' });
        
        const party = partyRes.rows[0];
        
        if (party.status !== 'FORMING') return res.status(400).json({ message: 'Grupa nie jest w stanie formowania.' });
        
        const members = party.members as any[];
        const acceptedCount = members.filter(m => m.status !== PartyMemberStatus.Pending).length;
        
        // Changed Requirement: Minimum 2 players to start manually (unless Solo specific perks exist handled elsewhere, or 1 player allowed if specifically logic allows)
        // Original logic was max_members. Now 2.
        const minToStart = 2;

        // Exception for explicit 1-player party created with Lone Wolf (max_members would be 1)
        const effectiveMin = party.max_members === 1 ? 1 : minToStart;

        if (acceptedCount < effectiveMin) {
            return res.status(400).json({ message: `Grupa musi mieć minimum ${effectiveMin} członków, aby wystartować.` });
        }

        const newStatus = 'PREPARING';
        const startTime = new Date().toISOString();

        await pool.query('UPDATE hunting_parties SET status = $1, start_time = $2 WHERE id = $3', 
            [newStatus, startTime, party.id]);

        res.status(200).json({ message: 'Started' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Nie udało się rozpocząć polowania' });
    }
});

// POST /api/hunting/cancel - Leader cancels a preparing hunt
router.post('/cancel', authenticateToken, async (req: any, res: any) => {
    try {
        // Fix: Filter out FINISHED parties
        const partyRes = await pool.query("SELECT * FROM hunting_parties WHERE leader_id = $1 AND status != 'FINISHED' FOR UPDATE", [req.user.id]);
        if (partyRes.rows.length === 0) {
            return res.status(403).json({ message: 'Nie jesteś liderem żadnej aktywnej grupy.' });
        }
        
        const party = partyRes.rows[0];
        
        if (party.status !== 'PREPARING') {
            return res.status(400).json({ message: 'Polowanie można anulować tylko na etapie przygotowań.' });
        }

        await pool.query(
            "UPDATE hunting_parties SET status = 'FORMING', start_time = NULL WHERE id = $1",
            [party.id]
        );

        res.status(200).json({ message: 'Cancelled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Nie udało się anulować polowania.' });
    }
});

// POST /api/hunting/leave
router.post('/leave', authenticateToken, async (req: any, res: any) => {
    try {
        const partyRes = await pool.query(`
            SELECT id, members, leader_id, status, start_time, max_members 
            FROM hunting_parties 
            WHERE members @> jsonb_build_array(jsonb_build_object('userId', $1::int))
            FOR UPDATE
        `, [req.user.id]);

        if (partyRes.rows.length === 0) return res.status(404).json({ message: 'Nie jesteś w grupie.' });
        const party = partyRes.rows[0];
        const isLeader = party.leader_id === req.user.id;
        const isFinished = party.status === 'FINISHED';

        if (isLeader && !isFinished) {
            await pool.query('DELETE FROM hunting_parties WHERE id = $1', [party.id]);
        } else {
            let members = party.members.filter((m: any) => m.userId !== req.user.id);

            if (members.length === 0) {
                await pool.query('DELETE FROM hunting_parties WHERE id = $1', [party.id]);
            } else {
                let newStatus = party.status;
                let startTime = party.start_time;
                
                // If leaving during PREPARING, check if we dropped below full.
                // If we drop below full, stop timer? Or keep it running if >= 2?
                // Usually PREPARING implies "Ready to go", if someone leaves, we should probably pause to fill spot 
                // OR let it continue if it was manual start.
                // The current logic was "If not max members, go back to forming".
                // Let's adapt: If manually started (>=2) it's fine, but if it was auto-started due to full, and now not full...
                // Simplification: Any leave during PREPARING stops the timer to allow leader to decide.
                if (party.status === 'PREPARING') {
                     newStatus = 'FORMING';
                     startTime = null;
                }

                await pool.query('UPDATE hunting_parties SET members = $1, status = $2, start_time = $3 WHERE id = $4', 
                    [JSON.stringify(members), newStatus, startTime, party.id]);
            }
        }

        res.status(200).json({ message: 'Left' });
    } catch (err) {
        res.status(500).json({ message: 'Nie udało się opuścić grupy' });
    }
});

export default router;
