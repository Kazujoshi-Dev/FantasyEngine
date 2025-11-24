

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PartyStatus, PartyMemberStatus, HuntingParty, GameData, PlayerCharacter } from '../types.js';
import { getPartyByLeader, getPartyByMember, processPartyCombat } from '../logic/hunting.js';
import { calculateDerivedStatsOnServer } from '../logic/stats.js';

const router = express.Router();

const getGameData = async (): Promise<GameData> => {
    const gameDataRes = await pool.query("SELECT key, data FROM game_data");
    return gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);
};

// GET /api/hunting/parties - List open parties (FORMING)
router.get('/parties', authenticateToken, async (req: any, res: any) => {
    try {
        // Show parties that are forming and not full, include leader name
        const result = await pool.query(`
            SELECT hp.id, hp.leader_id, hp.boss_id, hp.max_members, hp.status, hp.members, c.data->>'name' as leader_name
            FROM hunting_parties hp
            JOIN characters c ON hp.leader_id = c.user_id
            WHERE hp.status = 'FORMING' 
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
            leaderName: row.leader_name
        }));
        
        res.json(parties);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch parties' });
    }
});

// GET /api/hunting/my-party - Get current user's party status
router.get('/my-party', authenticateToken, async (req: any, res: any) => {
    try {
        let party = await getPartyByMember(req.user.id);
        
        if (!party) {
            return res.json({ party: null, serverTime: new Date().toISOString() });
        }
        
        const gameData = await getGameData();
        const boss = gameData.enemies.find(e => e.id === party.bossId);
        const preparationTimeSeconds = boss?.preparationTimeSeconds ?? 30; // Default 30s
        const PREPARATION_DURATION_MS = preparationTimeSeconds * 1000;

        // Check if fight should start (Logic check on read)
        if (party.status === PartyStatus.Preparing && party.startTime) {
             const fightStartTime = new Date(party.startTime).getTime() + PREPARATION_DURATION_MS;
             
             if (new Date().getTime() >= fightStartTime) {
                 // Atomic Lock: Try to update status to FIGHTING. 
                 // Only one request will succeed (rowCount === 1).
                 const lockResult = await pool.query(
                     "UPDATE hunting_parties SET status = 'FIGHTING' WHERE id = $1 AND status = 'PREPARING'",
                     [party.id]
                 );

                 if (lockResult.rowCount === 1) {
                     // We won the race. Process combat.
                     // processPartyCombat updates DB to FINISHED at the end.
                     party = await processPartyCombat(party, gameData);
                 } else {
                     // We lost the race (someone else is processing) or it's already finished.
                     // Fetch the updated state from DB.
                     const updatedParty = await getPartyByMember(req.user.id);
                     if (updatedParty) party = updatedParty;
                 }
             }
        }
        
        // Ensure party is not null before proceeding
        if (!party) {
            return res.json({ party: null, serverTime: new Date().toISOString() });
        }

        // Inject rewards specific to this user if finished
        if (party.status === PartyStatus.Finished) {
            // Re-fetch rewards if we came from the "lost race" branch above to ensure we have the data
            const rewardsRes = await pool.query('SELECT rewards FROM hunting_parties WHERE id = $1', [party.id]);
            const rewardsRaw = rewardsRes.rows[0]?.rewards;
            
            // Personal rewards
            if (rewardsRaw && rewardsRaw[req.user.id]) {
                party.myRewards = rewardsRaw[req.user.id];
            }
            
            // All rewards summary (for leaderboard)
            if (rewardsRaw) {
                 const allRewards: Record<string, { gold: number; experience: number }> = {};
                 party.members.forEach(member => {
                     if(rewardsRaw[member.userId]) {
                         allRewards[member.characterName] = {
                             gold: rewardsRaw[member.userId].gold,
                             experience: rewardsRaw[member.userId].experience
                         }
                     }
                 });
                 party.allRewards = allRewards;
            }
        }

        // Hydrate members with derived stats for Tooltips
        // We need to fetch the current character state for each member to calculate accurate stats
        // Note: This adds DB load but is necessary for the UI to show correct values.
        for (const member of party.members) {
            const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [member.userId]);
            if (charRes.rows.length > 0) {
                const rawChar: PlayerCharacter = charRes.rows[0].data;
                const derivedChar = calculateDerivedStatsOnServer(rawChar, gameData.itemTemplates, gameData.affixes);
                member.stats = derivedChar.stats;
            }
        }

        res.json({ party, serverTime: new Date().toISOString() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch party status' });
    }
});

// POST /api/hunting/create - Create a new party
router.post('/create', authenticateToken, async (req: any, res: any) => {
    const { bossId, maxMembers } = req.body;
    
    if (maxMembers < 2 || maxMembers > 5) {
        return res.status(400).json({ message: 'Party size must be between 2 and 5.' });
    }

    try {
        const existingParty = await getPartyByMember(req.user.id);
        if (existingParty) return res.status(400).json({ message: 'You are already in a party.' });

        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;

        const initialMembers = [{
            userId: req.user.id,
            characterName: char.name,
            level: char.level,
            race: char.race,
            characterClass: char.characterClass,
            status: PartyMemberStatus.Leader
        }];

        await pool.query(`
            INSERT INTO hunting_parties (leader_id, boss_id, max_members, members)
            VALUES ($1, $2, $3, $4)
        `, [req.user.id, bossId, maxMembers, JSON.stringify(initialMembers)]);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create party' });
    }
});

// POST /api/hunting/join/:partyId
router.post('/join/:partyId', authenticateToken, async (req: any, res: any) => {
    const partyId = req.params.partyId;
    try {
        const existingParty = await getPartyByMember(req.user.id);
        if (existingParty) return res.status(400).json({ message: 'You are already in a party.' });

        const partyRes = await pool.query('SELECT * FROM hunting_parties WHERE id = $1 FOR UPDATE', [partyId]);
        if (partyRes.rows.length === 0) return res.status(404).json({ message: 'Party not found.' });
        
        const party = partyRes.rows[0];
        if (party.status !== 'FORMING') return res.status(400).json({ message: 'Party is no longer accepting members.' });
        
        const members = party.members;
        if (members.length >= party.max_members) return res.status(400).json({ message: 'Party is full.' });

        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [req.user.id]);
        const char: PlayerCharacter = charRes.rows[0].data;

        members.push({
            userId: req.user.id,
            characterName: char.name,
            level: char.level,
            race: char.race,
            characterClass: char.characterClass,
            status: PartyMemberStatus.Pending
        });

        await pool.query('UPDATE hunting_parties SET members = $1 WHERE id = $2', [JSON.stringify(members), partyId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to join party' });
    }
});

// POST /api/hunting/respond - Leader accepts/rejects
router.post('/respond', authenticateToken, async (req: any, res: any) => {
    const { userId, action } = req.body; // action: 'accept' | 'reject' | 'kick'
    try {
        const partyRes = await pool.query('SELECT * FROM hunting_parties WHERE leader_id = $1 FOR UPDATE', [req.user.id]);
        if (partyRes.rows.length === 0) return res.status(404).json({ message: 'You are not a leader of any party.' });
        
        const party = partyRes.rows[0];
        let members = party.members as any[];
        
        if (action === 'reject' || action === 'kick') {
            members = members.filter(m => m.userId !== userId);
            // If full and someone kicked, ensure status is FORMING (in case it was PREPARING)
            // Though PREPARING usually implies full accepted.
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

        if (acceptedCount >= party.max_members && party.status === 'FORMING') {
            newStatus = 'PREPARING';
            startTime = new Date().toISOString();
        } else if (acceptedCount < party.max_members && party.status === 'PREPARING') {
            // Someone left/kicked during countdown
            newStatus = 'FORMING';
            startTime = null;
        }

        await pool.query('UPDATE hunting_parties SET members = $1, status = $2, start_time = $3 WHERE id = $4', 
            [JSON.stringify(members), newStatus, startTime, party.id]);

        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update member status' });
    }
});

// POST /api/hunting/leave
router.post('/leave', authenticateToken, async (req: any, res: any) => {
    try {
        const partyRes = await pool.query(`
            SELECT id, members, leader_id, status, start_time 
            FROM hunting_parties 
            WHERE members @> jsonb_build_array(jsonb_build_object('userId', $1::int))
            FOR UPDATE
        `, [req.user.id]);

        if (partyRes.rows.length === 0) return res.status(404).json({ message: 'Not in a party.' });
        const party = partyRes.rows[0];
        const isLeader = party.leader_id === req.user.id;
        const isFinished = party.status === 'FINISHED';

        // Leader leaves a FORMING or PREPARING party -> Dissolve
        if (isLeader && !isFinished) {
            await pool.query('DELETE FROM hunting_parties WHERE id = $1', [party.id]);
        } else {
            // Member leaves, OR Leader leaves a FINISHED party
            let members = party.members.filter((m: any) => m.userId !== req.user.id);

            if (members.length === 0) {
                // Last member is leaving, delete the party record.
                await pool.query('DELETE FROM hunting_parties WHERE id = $1', [party.id]);
            } else {
                let newStatus = party.status;
                let startTime = party.start_time;
                // If a member leaves during PREPARING, revert to FORMING.
                if (party.status === 'PREPARING') {
                     newStatus = 'FORMING';
                     startTime = null;
                }

                await pool.query('UPDATE hunting_parties SET members = $1, status = $2, start_time = $3 WHERE id = $4', 
                    [JSON.stringify(members), newStatus, startTime, party.id]);
            }
        }

        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to leave party' });
    }
});


export default router;