import { pool } from '../db.js';
import { GuildRaid, RaidStatus, RaidParticipant, ExpeditionRewardSummary, PartyMember, PartyMemberStatus, PlayerCharacter, RaidType } from '../types.js';
import { simulateTeamVsTeamCombat } from './combat/simulations/index.js';
import { enforceInboxLimit } from './helpers.js';

/**
 * Logic for managing guild-vs-guild raids.
 */

export const getActiveRaids = async (guildId: number) => {
    const active = await pool.query(
        "SELECT r.*, g1.name as attacker_guild_name, g2.name as defender_guild_name FROM guild_raids r JOIN guilds g1 ON r.attacker_guild_id = g1.id JOIN guilds g2 ON r.defender_guild_id = g2.id WHERE (attacker_guild_id = $1 OR defender_guild_id = $1) AND status != 'FINISHED' AND status != 'CANCELLED'",
        [guildId]
    );
    const history = await pool.query(
        "SELECT r.*, g1.name as attacker_guild_name, g2.name as defender_guild_name FROM guild_raids r JOIN guilds g1 ON r.attacker_guild_id = g1.id JOIN guilds g2 ON r.defender_guild_id = g2.id WHERE (attacker_guild_id = $1 OR defender_guild_id = $1) AND (status = 'FINISHED' OR status = 'CANCELLED') ORDER BY created_at DESC LIMIT 20",
        [guildId]
    );
    return { active: active.rows, history: history.rows };
};

export const createRaid = async (attackerGuildId: number, leaderId: number, defenderGuildId: number, type: RaidType) => {
    if (attackerGuildId === defenderGuildId) throw new Error("Cannot raid yourself");
    
    const targetRes = await pool.query('SELECT 1 FROM guilds WHERE id = $1', [defenderGuildId]);
    if (targetRes.rowCount === 0) throw new Error("Target guild not found");

    const existing = await pool.query(
        "SELECT 1 FROM guild_raids WHERE status = 'PREPARING' AND ((attacker_guild_id = $1 AND defender_guild_id = $2) OR (attacker_guild_id = $2 AND defender_guild_id = $1))",
        [attackerGuildId, defenderGuildId]
    );
    if (existing.rowCount! > 0) throw new Error("A raid is already being prepared between these guilds");

    const startTime = new Date(Date.now() + 30 * 60 * 1000); 
    
    const leaderChar = await pool.query('SELECT data FROM characters WHERE user_id = $1', [leaderId]);
    const char = leaderChar.rows[0].data;
    const participant: RaidParticipant = {
        userId: leaderId,
        name: char.name,
        level: char.level,
        race: char.race,
        characterClass: char.characterClass
    };

    const res = await pool.query(
        `INSERT INTO guild_raids (attacker_guild_id, defender_guild_id, status, raid_type, start_time, attacker_participants) 
         VALUES ($1, $2, 'PREPARING', $3, $4, $5) RETURNING *`,
        [attackerGuildId, defenderGuildId, type, startTime, JSON.stringify([participant])]
    );
    return res.rows[0];
};

export const joinRaid = async (raidId: number, userId: number, guildId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const raidRes = await client.query('SELECT * FROM guild_raids WHERE id = $1 FOR UPDATE', [raidId]);
        if (raidRes.rowCount === 0) throw new Error("Raid not found");
        const raid = raidRes.rows[0];
        
        if (raid.status !== 'PREPARING') throw new Error("Raid is no longer in preparation phase");

        const isAttacker = Number(raid.attacker_guild_id) === Number(guildId);
        const isDefender = Number(raid.defender_guild_id) === Number(guildId);
        
        if (!isAttacker && !isDefender) throw new Error("Your guild is not part of this raid");

        const field = isAttacker ? 'attacker_participants' : 'defender_participants';
        const participants: RaidParticipant[] = raid[field] || [];
        
        if (participants.some(p => p.userId === userId)) throw new Error("Already joined");
        
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1', [userId]);
        const char = charRes.rows[0].data;
        
        participants.push({
            userId,
            name: char.name,
            level: char.level,
            race: char.race,
            characterClass: char.characterClass
        });

        await client.query(`UPDATE guild_raids SET ${field} = $1 WHERE id = $2`, [JSON.stringify(participants), raidId]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const processPendingRaids = async () => {
    const client = await pool.connect();
    try {
        const raidsRes = await client.query(
            "SELECT * FROM guild_raids WHERE status = 'PREPARING' AND start_time <= NOW() FOR UPDATE SKIP LOCKED"
        );
        
        if (raidsRes.rowCount === 0) return;

        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as any);

        for (const raid of raidsRes.rows) {
            await client.query('BEGIN');
            try {
                const attackerList: RaidParticipant[] = raid.attacker_participants || [];
                const defenderList: RaidParticipant[] = raid.defender_participants || [];
                
                if (attackerList.length === 0) {
                    await client.query("UPDATE guild_raids SET status = 'CANCELLED' WHERE id = $1", [raid.id]);
                    await client.query('COMMIT');
                    continue;
                }

                const attackerIds = attackerList.map(p => p.userId);
                const defenderIds = defenderList.map(p => p.userId);

                const getFullChars = async (ids: number[]) => {
                    if (ids.length === 0) return [];
                    const res = await client.query('SELECT user_id, data FROM characters WHERE user_id = ANY($1)', [ids]);
                    return res.rows.map(r => ({ ...r.data, id: r.user_id }));
                };

                const attackersData = await getFullChars(attackerIds);
                const defendersData = await getFullChars(defenderIds);

                const { combatLog, winner, finalPlayers } = simulateTeamVsTeamCombat(attackersData, defendersData, gameData);
                const isAttackerWinner = winner === 'attacker';
                const winnerGuildId = isAttackerWinner ? raid.attacker_guild_id : raid.defender_guild_id;

                let loot = { gold: 0, essences: {} as Record<string, number> };
                if (raid.raid_type === 'RESOURCES') {
                    const loserGuildId = isAttackerWinner ? raid.defender_guild_id : raid.attacker_guild_id;
                    const loserGuildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [loserGuildId]);
                    if (loserGuildRes.rowCount! > 0) {
                        const resObj = loserGuildRes.rows[0].resources;
                        const goldStolen = Math.floor(resObj.gold * 0.1);
                        resObj.gold -= goldStolen;
                        loot.gold = goldStolen;
                        
                        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(resObj), loserGuildId]);
                        
                        const winnerGuildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [winnerGuildId]);
                        const winResObj = winnerGuildRes.rows[0].resources;
                        winResObj.gold += goldStolen;
                        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(winResObj), winnerGuildId]);
                    }
                }

                await client.query(
                    "UPDATE guild_raids SET status = 'FINISHED', winner_guild_id = $1, loot = $2, combat_log = $3 WHERE id = $4",
                    [winnerGuildId, JSON.stringify(loot), JSON.stringify(combatLog), raid.id]
                );

                for (const fp of finalPlayers) {
                    await client.query(
                        "UPDATE characters SET data = jsonb_set(jsonb_set(data, '{stats,currentHealth}', $1), '{stats,currentMana}', $2) WHERE user_id = $3",
                        [fp.currentHealth, fp.currentMana, fp.data.id]
                    );
                }

                const allParticipants = [...attackerIds, ...defenderIds];
                const uniqueParticipants = Array.from(new Set(allParticipants));

                const initialStats = combatLog?.[0]?.partyMemberStats || {};
                const mapToPartyMember = (p: RaidParticipant): PartyMember => ({
                    userId: p.userId,
                    characterName: p.name,
                    level: p.level,
                    race: p.race,
                    characterClass: p.characterClass,
                    status: PartyMemberStatus.Member,
                    stats: initialStats[p.name] || undefined
                });

                const attackerPartyMembers = attackerList.map(mapToPartyMember);
                const defenderPartyMembers = defenderList.map(mapToPartyMember);

                for (const uid of uniqueParticipants) {
                    const isAttackerSide = attackerIds.includes(uid);
                    const myGuildWon = (isAttackerSide && isAttackerWinner) || (!isAttackerSide && !isAttackerWinner);
                    const subject = `Raport z Rajdu: ${myGuildWon ? 'Zwycięstwo' : 'Porażka'}`;

                    const summary: ExpeditionRewardSummary & { opponents: any[] } = {
                        isVictory: myGuildWon,
                        totalGold: loot.gold,
                        totalExperience: 0,
                        itemsFound: [],
                        essencesFound: loot.essences || {},
                        combatLog: combatLog,
                        rewardBreakdown: [],
                        huntingMembers: isAttackerSide ? attackerPartyMembers : defenderPartyMembers,
                        opponents: isAttackerSide ? defenderPartyMembers : attackerPartyMembers
                    };

                    await enforceInboxLimit(client, uid);
                    await client.query(
                        `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'raid_report', $2, $3)`,
                        [uid, subject, JSON.stringify(summary)]
                    );
                }

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("Error processing raid:", err);
            }
        }
    } finally {
        client.release();
    }
};
