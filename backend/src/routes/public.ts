import express from 'express';
import { pool } from '../db.js';
import { PartyMember, PartyMemberStatus, RaidParticipant, ExpeditionRewardSummary, CombatLogEntry } from '../types.js';

const router = express.Router();

// GET /api/public/report/:id - Get a specific report by message ID
router.get('/report/:id', async (req, res) => {
    const { id } = req.params;

    if (isNaN(Number(id))) {
        return res.status(400).json({ message: 'Invalid report ID.' });
    }

    try {
        const result = await pool.query(
            "SELECT message_type, body, subject, sender_name FROM messages WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found or has been deleted.' });
        }

        const message = result.rows[0];

        // Ensure it's a report type before returning
        if (message.message_type !== 'expedition_report' && message.message_type !== 'pvp_report' && message.message_type !== 'raid_report') {
            return res.status(403).json({ message: 'This message is not a shareable report.' });
        }

        res.json(message);
    } catch (err) {
        console.error(`Error fetching public report ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch report data.' });
    }
});

// GET /api/public/raid/:id - Get a specific raid report by RAID ID
router.get('/raid/:id', async (req, res) => {
    const { id } = req.params;

    if (isNaN(Number(id))) {
        return res.status(400).json({ message: 'Invalid raid ID.' });
    }

    try {
        const result = await pool.query(
            `SELECT 
                gr.combat_log, gr.loot, gr.winner_guild_id, 
                gr.attacker_participants, gr.defender_participants,
                gr.attacker_guild_id, gr.defender_guild_id,
                ag.name as "attackerGuildName",
                dg.name as "defenderGuildName"
             FROM guild_raids gr
             JOIN guilds ag ON gr.attacker_guild_id = ag.id
             JOIN guilds dg ON gr.defender_guild_id = dg.id
             WHERE gr.id = $1 AND gr.status = 'FINISHED'`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Raid report not found.' });
        }

        const raid = result.rows[0];
        
        // Safely parse combat log, which might be a string from the DB
        let combatLog: CombatLogEntry[] = [];
        if (typeof raid.combat_log === 'string') {
            try {
                const parsed = JSON.parse(raid.combat_log);
                if (Array.isArray(parsed)) combatLog = parsed;
            } catch (e) { 
                console.error(`Error parsing public raid combat log for raid ${id}:`, e); 
            }
        } else if (Array.isArray(raid.combat_log)) {
            combatLog = raid.combat_log;
        }

        const initialStats = combatLog?.[0]?.partyMemberStats || {};

        // Helper to map participants for frontend, now including their stats.
        const mapToPartyMember = (p: RaidParticipant): PartyMember => ({
             userId: p.userId,
             characterName: p.name,
             level: p.level,
             race: p.race,
             characterClass: p.characterClass,
             status: PartyMemberStatus.Member,
             stats: initialStats[p.name] || undefined
        });

        const attackerParticipants: RaidParticipant[] = typeof raid.attacker_participants === 'string' 
            ? JSON.parse(raid.attacker_participants) 
            : raid.attacker_participants;
            
        const defenderParticipants: RaidParticipant[] = typeof raid.defender_participants === 'string' 
            ? JSON.parse(raid.defender_participants) 
            : raid.defender_participants;

        const friendlyMembers = attackerParticipants.map(mapToPartyMember);
        const opponentMembers = defenderParticipants.map(mapToPartyMember);

        const isAttackerWinner = raid.winner_guild_id === raid.attacker_guild_id;
        const loot = raid.loot || { gold: 0, essences: {} };

        const summary: ExpeditionRewardSummary & { opponents: any[] } = {
            isVictory: isAttackerWinner,
            totalGold: loot.gold,
            totalExperience: 0,
            itemsFound: [],
            essencesFound: loot.essences || {},
            combatLog: combatLog,
            rewardBreakdown: [],
            huntingMembers: friendlyMembers,
            opponents: opponentMembers
        };
        
        res.json({
            message_type: 'raid_report',
            body: summary,
            subject: `Raport z Rajdu: ${raid.attackerGuildName} vs ${raid.defenderGuildName}`,
            sender: 'System'
        });

    } catch (err) {
        console.error(`Error fetching public raid report ${id}:`, err);
        res.status(500).json({ message: 'Failed to fetch raid data.' });
    }
});

export default router;
