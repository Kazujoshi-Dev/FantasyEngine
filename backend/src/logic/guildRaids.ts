
import { pool } from '../db.js';
import { GuildRaid, RaidStatus, RaidType, RaidParticipant, GuildRole, PlayerCharacter, GameData, EssenceType, CombatLogEntry, ExpeditionRewardSummary, PartyMember, PartyMemberStatus, CharacterStats, GuildBuff } from '../types.js';
import { calculateDerivedStatsOnServer } from './stats.js';
import { simulateTeamVsTeamCombat } from './combat/simulations/index.js';
import { enforceInboxLimit } from './helpers.js';

// Constants
const PREP_TIME_MINUTES = 3;

// Helper to safely parse JSONB columns which might be double-stringified or raw objects
const safeParseParticipants = (data: any): RaidParticipant[] => {
    let list: any[] = [];
    if (Array.isArray(data)) {
        list = data;
    } else if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) list = parsed;
        } catch (e) {
            console.error("Error parsing participants JSON:", e);
            return [];
        }
    }

    if (!Array.isArray(list)) return [];
    
    // Ensure userId is a number
    return list.map(p => {
        if (p && typeof p === 'object' && p.userId !== undefined) {
            return { ...p, userId: Number(p.userId) };
        }
        return null;
    }).filter((p): p is RaidParticipant => p !== null && !isNaN(p.userId));
};

// ... (getActiveRaids unchanged)
export const getActiveRaids = async (guildId: number): Promise<{ incoming: GuildRaid[], outgoing: GuildRaid[], history: GuildRaid[] }> => {
    // Using explicit aliasing to match frontend types (camelCase)
    const incomingRes = await pool.query(
        `SELECT 
            gr.id,
            gr.attacker_guild_id as "attackerGuildId",
            gr.defender_guild_id as "defenderGuildId",
            gr.status,
            gr.raid_type as "type",
            gr.start_time as "startTime",
            gr.created_at as "createdAt",
            gr.attacker_participants as "attackerParticipants",
            gr.defender_participants as "defenderParticipants",
            gr.winner_guild_id as "winnerGuildId",
            gr.loot,
            ag.name as "attackerGuildName", 
            dg.name as "defenderGuildName" 
         FROM guild_raids gr
         JOIN guilds ag ON gr.attacker_guild_id = ag.id
         JOIN guilds dg ON gr.defender_guild_id = dg.id
         WHERE gr.defender_guild_id = $1 AND gr.status IN ('PREPARING', 'FIGHTING')
         ORDER BY gr.start_time ASC`,
        [guildId]
    );

    const outgoingRes = await pool.query(
        `SELECT 
            gr.id,
            gr.attacker_guild_id as "attackerGuildId",
            gr.defender_guild_id as "defenderGuildId",
            gr.status,
            gr.raid_type as "type",
            gr.start_time as "startTime",
            gr.created_at as "createdAt",
            gr.attacker_participants as "attackerParticipants",
            gr.defender_participants as "defenderParticipants",
            gr.winner_guild_id as "winnerGuildId",
            gr.loot,
            ag.name as "attackerGuildName", 
            dg.name as "defenderGuildName" 
         FROM guild_raids gr
         JOIN guilds ag ON gr.attacker_guild_id = ag.id
         JOIN guilds dg ON gr.defender_guild_id = dg.id
         WHERE gr.attacker_guild_id = $1 AND gr.status IN ('PREPARING', 'FIGHTING')
         ORDER BY gr.start_time ASC`,
        [guildId]
    );

    // Fetch History (Last 10)
    const historyRes = await pool.query(
        `SELECT 
            gr.id,
            gr.attacker_guild_id as "attackerGuildId",
            gr.defender_guild_id as "defenderGuildId",
            gr.status,
            gr.raid_type as "type",
            gr.start_time as "startTime",
            gr.created_at as "createdAt",
            gr.attacker_participants as "attackerParticipants",
            gr.defender_participants as "defenderParticipants",
            gr.winner_guild_id as "winnerGuildId",
            gr.combat_log as "combatLog",
            gr.loot,
            ag.name as "attackerGuildName", 
            dg.name as "defenderGuildName" 
         FROM guild_raids gr
         JOIN guilds ag ON gr.attacker_guild_id = ag.id
         JOIN guilds dg ON gr.defender_guild_id = dg.id
         WHERE (gr.attacker_guild_id = $1 OR gr.defender_guild_id = $1) 
         AND gr.status IN ('FINISHED', 'CANCELLED')
         ORDER BY gr.start_time DESC
         LIMIT 10`,
        [guildId]
    );
    
    return {
        incoming: incomingRes.rows,
        outgoing: outgoingRes.rows,
        history: historyRes.rows
    };
};

export const createRaid = async (attackerGuildId: number, attackerUserId: number, defenderGuildId: number, raidType: RaidType): Promise<GuildRaid> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Validate User Role
        const memberRes = await client.query('SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2', [attackerGuildId, attackerUserId]);
        if (memberRes.rows.length === 0 || (memberRes.rows[0].role !== GuildRole.LEADER && memberRes.rows[0].role !== GuildRole.OFFICER)) {
            throw new Error('Tylko Lider lub Oficer może wypowiedzieć wojnę.');
        }

        // 2. Validate Defender
        if (attackerGuildId === defenderGuildId) {
            throw new Error('Nie możesz zaatakować własnej gildii.');
        }
        
        // Check if already attacking/defending against this guild? (Optional: limit 1 raid per pair)
        const existingRaid = await client.query(
            `SELECT 1 FROM guild_raids WHERE 
            ((attacker_guild_id = $1 AND defender_guild_id = $2) OR (attacker_guild_id = $2 AND defender_guild_id = $1))
            AND status = 'PREPARING'`,
            [attackerGuildId, defenderGuildId]
        );
        if (existingRaid.rows.length > 0) {
            throw new Error('Bitwa między tymi gildiami jest już w toku.');
        }
        
        // 3. Setup Participants (Auto-add Leaders)
        const attackerLeaderRes = await client.query(
            `SELECT c.user_id as "userId", c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race, c.data->>'characterClass' as "characterClass"
             FROM guilds g JOIN characters c ON g.leader_id = c.user_id WHERE g.id = $1`,
            [attackerGuildId]
        );
        const defenderLeaderRes = await client.query(
            `SELECT c.user_id as "userId", c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race, c.data->>'characterClass' as "characterClass"
             FROM guilds g JOIN characters c ON g.leader_id = c.user_id WHERE g.id = $1`,
            [defenderGuildId]
        );
        
        const attackerParticipants: RaidParticipant[] = [];
        if (attackerLeaderRes.rows.length > 0) attackerParticipants.push(attackerLeaderRes.rows[0]);
        
        const defenderParticipants: RaidParticipant[] = [];
        if (defenderLeaderRes.rows.length > 0) defenderParticipants.push(defenderLeaderRes.rows[0]);

        // 4. Create Raid
        const startTime = new Date(Date.now() + PREP_TIME_MINUTES * 60 * 1000);
        // IMPORTANT: Pass objects directly for JSONB columns, pg handles stringification
        const insertRes = await client.query(
            `INSERT INTO guild_raids 
             (attacker_guild_id, defender_guild_id, status, raid_type, start_time, attacker_participants, defender_participants)
             VALUES ($1, $2, 'PREPARING', $3, $4, $5, $6)
             RETURNING id`,
            [attackerGuildId, defenderGuildId, raidType, startTime, JSON.stringify(attackerParticipants), JSON.stringify(defenderParticipants)]
        );

        // 5. Notify Defender
        const attackerGuildNameRes = await client.query('SELECT name FROM guilds WHERE id = $1', [attackerGuildId]);
        const defenderMembersRes = await client.query('SELECT user_id FROM guild_members WHERE guild_id = $1', [defenderGuildId]);
        
        const attackerName = attackerGuildNameRes.rows[0].name;
        const notificationBody = JSON.stringify({ content: `Gildia ${attackerName} wypowiedziała nam wojnę! Przygotuj się do obrony! (Start za ${PREP_TIME_MINUTES} min). Przejdź do zakładki Gildia -> Rajdy, aby dołączyć.` });
        
        for (const row of defenderMembersRes.rows) {
             await enforceInboxLimit(client, row.user_id);
             await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', 'WOJNA GILDII!', $2)`,
                [row.user_id, notificationBody]
            );
        }

        await client.query('COMMIT');
        return { id: insertRes.rows[0].id } as any;

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const joinRaid = async (raidId: number, userId: number, guildId: number): Promise<void> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const raidRes = await client.query('SELECT * FROM guild_raids WHERE id = $1 FOR UPDATE', [raidId]);
        if (raidRes.rows.length === 0) throw new Error('Rajd nie istnieje.');
        const raid = raidRes.rows[0];
        
        if (raid.status !== 'PREPARING') throw new Error('Bitwa już się rozpoczęła lub zakończyła.');
        
        const isAttacker = raid.attacker_guild_id === guildId;
        const isDefender = raid.defender_guild_id === guildId;
        
        if (!isAttacker && !isDefender) throw new Error('Twoja gildia nie bierze udziału w tej bitwie.');
        
        const charRes = await client.query(`SELECT data FROM characters WHERE user_id = $1`, [userId]);
        const charData = charRes.rows[0].data;
        const participant: RaidParticipant = {
            userId,
            name: charData.name,
            level: charData.level,
            race: charData.race,
            characterClass: charData.characterClass
        };
        
        const column = isAttacker ? 'attacker_participants' : 'defender_participants';
        const rawList = raid[isAttacker ? 'attacker_participants' : 'defender_participants'];
        const currentList = safeParseParticipants(rawList);
        
        // Strict Number comparison to avoid ID mismatch
        if (currentList.some(p => Number(p.userId) === Number(userId))) {
            throw new Error('Już dołączyłeś do tej bitwy.');
        }
        
        currentList.push(participant);
        
        await client.query(`UPDATE guild_raids SET ${column} = $1 WHERE id = $2`, [JSON.stringify(currentList), raidId]);
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

// --- CRON JOB FUNCTION ---
export const processPendingRaids = async (): Promise<void> => {
    const client = await pool.connect();
    try {
        const now = new Date();
        // Fetch raids ready to start and guild names
        const raidsRes = await client.query(`
            SELECT 
                gr.*,
                ag.name as "attackerGuildName",
                dg.name as "defenderGuildName"
            FROM guild_raids gr
            JOIN guilds ag ON gr.attacker_guild_id = ag.id
            JOIN guilds dg ON gr.defender_guild_id = dg.id
            WHERE gr.status = 'PREPARING' AND gr.start_time <= $1
        `, [now]);
        
        if (raidsRes.rows.length === 0) return;

        // Pre-fetch Game Data
        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);

        for (const raid of raidsRes.rows) {
            try {
                await client.query('BEGIN');
                
                // Lock raid row to prevent double processing
                const raidLock = await client.query('SELECT status FROM guild_raids WHERE id = $1 FOR UPDATE', [raid.id]);
                if (raidLock.rows[0].status !== 'PREPARING') {
                    await client.query('ROLLBACK');
                    continue;
                }

                // Mark as fighting (though we resolve it immediately, this prevents re-selection if logic is slow)
                await client.query("UPDATE guild_raids SET status = 'FIGHTING' WHERE id = $1", [raid.id]);

                // Parse participants safely and force numbers for IDs
                const attackerList = safeParseParticipants(raid.attacker_participants);
                const defenderList = safeParseParticipants(raid.defender_participants);

                const attackerIds = attackerList.map(p => p.userId);
                const defenderIds = defenderList.map(p => p.userId);
                
                const getFullChars = async (ids: number[]) => {
                    if (ids.length === 0) return [];
                    // AUDIT FIX: Fetch active_buffs to include Altar bonuses
                    const res = await client.query(`
                        SELECT c.user_id, c.data, g.buildings, g.active_buffs
                        FROM characters c
                        LEFT JOIN guild_members gm ON c.user_id = gm.user_id
                        LEFT JOIN guilds g ON gm.guild_id = g.id
                        WHERE c.user_id = ANY($1)
                    `, [ids]);
                    
                    return res.rows.map(r => {
                         const barracks = r.buildings?.barracks || 0;
                         const shrine = r.buildings?.shrine || 0;
                         
                         // AUDIT FIX: Process active_buffs
                         const rawBuffs = r.active_buffs || [];
                         const activeBuffs = Array.isArray(rawBuffs) 
                            ? (rawBuffs as GuildBuff[]).filter(b => b.expiresAt > Date.now()) 
                            : [];
                         
                         return calculateDerivedStatsOnServer(
                             {...r.data, id: r.user_id}, 
                             gameData.itemTemplates, 
                             gameData.affixes, 
                             barracks, 
                             shrine, 
                             gameData.skills,
                             activeBuffs // Pass active buffs
                         );
                    });
                };

                const attackersFull = await getFullChars(attackerIds);
                const defendersFull = await getFullChars(defenderIds);
                
                // Walkover Logic (if one side has no valid characters after fetching)
                if (attackersFull.length === 0 || defendersFull.length === 0) {
                    const isAttackerWinner = attackersFull.length > 0;
                    const winnerGuildId = isAttackerWinner ? raid.attacker_guild_id : raid.defender_guild_id;
                    
                    const walkoverLog: CombatLogEntry[] = [{
                        turn: 0,
                        attacker: 'System',
                        defender: 'System',
                        action: 'walkover',
                        playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0
                    }];

                    await client.query(
                        `UPDATE guild_raids 
                         SET status = 'FINISHED', combat_log = $1, winner_guild_id = $2, loot = '{}'::jsonb 
                         WHERE id = $3`,
                        [JSON.stringify(walkoverLog), winnerGuildId, raid.id]
                    );
                    
                    await client.query('COMMIT');
                    continue;
                }

                // Simulate Combat
                // AUDIT FIX: Logic for Druid heal is now inside simulateTeamVsTeamCombat via 'finalPlayers'
                const { combatLog, winner, finalPlayers } = simulateTeamVsTeamCombat(attackersFull, defendersFull, gameData);
                
                // Modify first log entry with guild names
                if (combatLog.length > 0 && combatLog[0].action === 'starts a fight with') {
                    combatLog[0].attacker = raid.attackerGuildName;
                    combatLog[0].defender = raid.defenderGuildName;
                }

                const winnerGuildId = winner === 'attacker' ? raid.attacker_guild_id : raid.defender_guild_id;
                const isAttackerWinner = winner === 'attacker';
                
                let loot = { gold: 0, essences: {} as Record<string, number> };
                
                // Process Loot (Resources Mode)
                if (raid.raid_type === RaidType.RESOURCES && isAttackerWinner) {
                    // AUDIT FIX: Sort IDs to prevent deadlock when locking two guilds
                    const id1 = raid.attacker_guild_id;
                    const id2 = raid.defender_guild_id;
                    const firstLock = id1 < id2 ? id1 : id2;
                    const secondLock = id1 < id2 ? id2 : id1;

                    // Lock both rows in order
                    await client.query('SELECT 1 FROM guilds WHERE id = $1 FOR UPDATE', [firstLock]);
                    await client.query('SELECT 1 FROM guilds WHERE id = $1 FOR UPDATE', [secondLock]);

                    // Now safe to fetch and update
                    const defenderGuildRes = await client.query('SELECT resources, leader_id FROM guilds WHERE id = $1', [raid.defender_guild_id]);
                    const attackerGuildRes = await client.query('SELECT resources, leader_id FROM guilds WHERE id = $1', [raid.attacker_guild_id]);

                    if (defenderGuildRes.rows.length > 0 && attackerGuildRes.rows.length > 0) {
                        const defenderResources = defenderGuildRes.rows[0].resources || { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
                        const defenderLeaderId = defenderGuildRes.rows[0].leader_id;

                        const attackerResources = attackerGuildRes.rows[0].resources || { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
                        const attackerLeaderId = attackerGuildRes.rows[0].leader_id;
                        
                        // Calculate 25% loot
                        loot.gold = Math.floor((defenderResources.gold || 0) * 0.25);
                        
                        for (const key of Object.keys(defenderResources)) {
                            if (key !== 'gold') {
                                 const amount = Math.floor((defenderResources[key] || 0) * 0.25);
                                 if (amount > 0) {
                                     loot.essences[key] = amount;
                                     defenderResources[key] = (defenderResources[key] || 0) - amount;
                                 }
                            }
                        }
                        defenderResources.gold = (defenderResources.gold || 0) - loot.gold;
                        
                        // Update Defender Bank
                        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(defenderResources), raid.defender_guild_id]);
                        
                        // AUDIT FIX: Log loss for Defender
                        if (loot.gold > 0) {
                            await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'WAR_LOSS', 'gold', $3)`, [raid.defender_guild_id, defenderLeaderId, loot.gold]);
                        }
                        for (const [essence, amount] of Object.entries(loot.essences)) {
                            if (amount > 0) {
                                await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'WAR_LOSS', $3, $4)`, [raid.defender_guild_id, defenderLeaderId, essence, amount]);
                            }
                        }

                        // Update Attacker Bank
                        attackerResources.gold = (attackerResources.gold || 0) + loot.gold;
                        for (const [key, val] of Object.entries(loot.essences)) {
                            attackerResources[key] = (attackerResources[key] || 0) + val;
                        }
                        await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(attackerResources), raid.attacker_guild_id]);
                        
                        // Log gain for Attacker
                        if (loot.gold > 0) {
                            await client.query(`INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'LOOT', 'gold', $3)`, [raid.attacker_guild_id, attackerLeaderId, loot.gold]);
                        }
                        for (const [essence, amount] of Object.entries(loot.essences)) {
                            if (amount > 0) {
                                await client.query(
                                    `INSERT INTO guild_bank_history (guild_id, user_id, type, currency, amount) VALUES ($1, $2, 'LOOT', $3, $4)`,
                                    [raid.attacker_guild_id, attackerLeaderId, essence, amount]
                                );
                            }
                        }
                    }
                }

                // Update Raid Status to FINISHED
                await client.query(
                    `UPDATE guild_raids 
                     SET status = 'FINISHED', combat_log = $1, winner_guild_id = $2, loot = $3 
                     WHERE id = $4`,
                    [JSON.stringify(combatLog), winnerGuildId, JSON.stringify(loot), raid.id]
                );

                // AUDIT FIX: Update Player State in Database (HP/Mana/Dead)
                // This ensures the battle has real consequences for players
                if (finalPlayers && finalPlayers.length > 0) {
                    for (const playerState of finalPlayers) {
                         // Fetch fresh to avoid overwriting unrelated data, or use JSONB_SET logic if preferred. 
                         // Here we assume simple update of stats object keys.
                         // But we need to be careful not to overwrite inventory if it changed (unlikely during raid lock).
                         const charId = playerState.data.id;
                         if (!charId) continue;

                         const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [charId]);
                         if (charRes.rows.length > 0) {
                             const charData = charRes.rows[0].data;
                             charData.stats.currentHealth = Math.max(0, Math.floor(playerState.currentHealth));
                             charData.stats.currentMana = Math.max(0, Math.floor(playerState.currentMana));
                             // Note: We do not set isDead permanently on char, game logic handles 0 HP.
                             
                             await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(charData), charId]);
                         }
                    }
                }
                
                // Send Reports via Messages
                const allParticipants = [...attackerIds, ...defenderIds];
                const uniqueParticipants = Array.from(new Set(allParticipants));

                const subject = `Raport z Rajdu: ${isAttackerWinner ? 'Zwycięstwo' : 'Porażka'}`;
                
                // Helper to map RaidParticipant to PartyMember for Summary, now including stats
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
                    
                    const summary: ExpeditionRewardSummary & { opponents: any[] } = {
                        isVictory: myGuildWon,
                        totalGold: myGuildWon ? loot.gold : 0,
                        totalExperience: 0, 
                        itemsFound: [],
                        essencesFound: myGuildWon ? loot.essences : {},
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
            } catch (raidErr: any) {
                // CRITICAL ERROR HANDLING:
                await client.query('ROLLBACK');
                console.error(`CRITICAL: Error processing raid ${raid.id}. Marking as FINISHED to prevent loop.`, raidErr);
                
                try {
                    await client.query('BEGIN');
                    const errorLog: CombatLogEntry[] = [{
                        turn: 0,
                        attacker: 'System',
                        defender: 'System',
                        action: 'system_error', // Changed to strict key for frontend recognition
                        playerHealth: 0, playerMana: 0, enemyHealth: 0, enemyMana: 0
                    }];
                    await client.query(
                        "UPDATE guild_raids SET status = 'FINISHED', combat_log = $1 WHERE id = $2",
                        [JSON.stringify(errorLog), raid.id]
                    );
                    await client.query('COMMIT');
                } catch (e) {
                    await client.query('ROLLBACK');
                    console.error("Double fault while trying to close raid:", e);
                }
            }
        }
    } catch (err) {
        console.error('Error in processPendingRaids loop:', err);
    } finally {
        client.release();
    }
};
