import { pool } from '../db.js';
import { GuildRaid, RaidStatus, RaidType, RaidParticipant, GuildRole, PlayerCharacter, GameData, EssenceType, CombatLogEntry } from '../types.js';
import { calculateDerivedStatsOnServer } from './stats.js';
import { simulateTeamVsTeamCombat } from './combat/simulations/index.js';

// Constants
const PREP_TIME_MINUTES = 15;

export const getActiveRaids = async (guildId: number): Promise<{ incoming: GuildRaid[], outgoing: GuildRaid[] }> => {
    const incomingRes = await pool.query(
        `SELECT gr.*, ag.name as "attackerGuildName", dg.name as "defenderGuildName" 
         FROM guild_raids gr
         JOIN guilds ag ON gr.attacker_guild_id = ag.id
         JOIN guilds dg ON gr.defender_guild_id = dg.id
         WHERE gr.defender_guild_id = $1 AND gr.status IN ('PREPARING', 'FIGHTING')
         ORDER BY gr.start_time ASC`,
        [guildId]
    );

    const outgoingRes = await pool.query(
        `SELECT gr.*, ag.name as "attackerGuildName", dg.name as "defenderGuildName" 
         FROM guild_raids gr
         JOIN guilds ag ON gr.attacker_guild_id = ag.id
         JOIN guilds dg ON gr.defender_guild_id = dg.id
         WHERE gr.attacker_guild_id = $1 AND gr.status IN ('PREPARING', 'FIGHTING')
         ORDER BY gr.start_time ASC`,
        [guildId]
    );
    
    // Map JSONB arrays to TS objects if needed (pg does this automatically usually)
    return {
        incoming: incomingRes.rows,
        outgoing: outgoingRes.rows
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
            `SELECT c.user_id, c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race, c.data->>'characterClass' as "characterClass"
             FROM guilds g JOIN characters c ON g.leader_id = c.user_id WHERE g.id = $1`,
            [attackerGuildId]
        );
        const defenderLeaderRes = await client.query(
            `SELECT c.user_id, c.data->>'name' as name, (c.data->>'level')::int as level, c.data->>'race' as race, c.data->>'characterClass' as "characterClass"
             FROM guilds g JOIN characters c ON g.leader_id = c.user_id WHERE g.id = $1`,
            [defenderGuildId]
        );
        
        const attackerParticipants: RaidParticipant[] = [];
        if (attackerLeaderRes.rows.length > 0) attackerParticipants.push(attackerLeaderRes.rows[0]);
        
        const defenderParticipants: RaidParticipant[] = [];
        if (defenderLeaderRes.rows.length > 0) defenderParticipants.push(defenderLeaderRes.rows[0]);

        // 4. Create Raid
        const startTime = new Date(Date.now() + PREP_TIME_MINUTES * 60 * 1000);
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
        const notificationBody = JSON.stringify({ content: `Gildia ${attackerName} wypowiedziała nam wojnę! Przygotuj się do obrony! (Start za ${PREP_TIME_MINUTES} min)` });
        
        for (const row of defenderMembersRes.rows) {
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'guild_invite', 'WOJNA GILDII!', $2)`,
                [row.user_id, notificationBody] // Reusing guild_invite type for generic system msg structure or change to system
            );
             // Actually better to use 'system' type
             await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', 'WOJNA GILDII!', $2)`,
                [row.user_id, notificationBody]
            );
        }

        await client.query('COMMIT');
        return { id: insertRes.rows[0].id } as any; // Simplified return

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
        const currentList = raid[column] as RaidParticipant[];
        
        if (currentList.some(p => p.userId === userId)) throw new Error('Już dołączyłeś do tej bitwy.');
        
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
        // Fetch raids ready to start
        const raidsRes = await client.query(`
            SELECT * FROM guild_raids 
            WHERE status = 'PREPARING' AND start_time <= NOW()
        `);
        
        if (raidsRes.rows.length === 0) return;

        // Pre-fetch Game Data
        const gameDataRes = await client.query("SELECT key, data FROM game_data");
        const gameData: GameData = gameDataRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.data }), {} as GameData);

        for (const raid of raidsRes.rows) {
            try {
                await client.query('BEGIN');
                
                // Lock raid row
                const raidLock = await client.query('SELECT status FROM guild_raids WHERE id = $1 FOR UPDATE', [raid.id]);
                if (raidLock.rows[0].status !== 'PREPARING') {
                    await client.query('ROLLBACK');
                    continue;
                }

                await client.query("UPDATE guild_raids SET status = 'FIGHTING' WHERE id = $1", [raid.id]);

                // Fetch participants full data
                const attackerIds = (raid.attacker_participants as RaidParticipant[]).map(p => p.userId);
                const defenderIds = (raid.defender_participants as RaidParticipant[]).map(p => p.userId);
                
                const getFullChars = async (ids: number[]) => {
                    const res = await client.query(`
                        SELECT c.data, g.buildings 
                        FROM characters c
                        LEFT JOIN guild_members gm ON c.user_id = gm.user_id
                        LEFT JOIN guilds g ON gm.guild_id = g.id
                        WHERE c.user_id = ANY($1)
                    `, [ids]);
                    return res.rows.map(r => {
                         const barracks = r.buildings?.barracks || 0;
                         const shrine = r.buildings?.shrine || 0;
                         return calculateDerivedStatsOnServer(r.data, gameData.itemTemplates, gameData.affixes, barracks, shrine, gameData.skills);
                    });
                };

                const attackersFull = await getFullChars(attackerIds);
                const defendersFull = await getFullChars(defenderIds);
                
                // Simulate Combat
                const { combatLog, winner } = simulateTeamVsTeamCombat(attackersFull, defendersFull, gameData);
                
                const winnerGuildId = winner === 'attacker' ? raid.attacker_guild_id : raid.defender_guild_id;
                const isAttackerWinner = winner === 'attacker';
                
                let loot = { gold: 0, essences: {} as Record<string, number> };
                
                // Process Loot (Resources Mode)
                if (raid.raid_type === RaidType.RESOURCES && isAttackerWinner) {
                    const defenderGuildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [raid.defender_guild_id]);
                    const defenderResources = defenderGuildRes.rows[0].resources;
                    
                    // Calculate 25%
                    loot.gold = Math.floor(defenderResources.gold * 0.25);
                    
                    // Object.keys iteration for essences
                    for (const key of Object.keys(defenderResources)) {
                        if (key !== 'gold') {
                             const amount = Math.floor((defenderResources[key] || 0) * 0.25);
                             if (amount > 0) {
                                 loot.essences[key] = amount;
                                 defenderResources[key] -= amount;
                             }
                        }
                    }
                    defenderResources.gold -= loot.gold;
                    
                    // Update Defender Bank
                    await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(defenderResources), raid.defender_guild_id]);
                    
                    // Update Attacker Bank
                    const attackerGuildRes = await client.query('SELECT resources FROM guilds WHERE id = $1 FOR UPDATE', [raid.attacker_guild_id]);
                    const attackerResources = attackerGuildRes.rows[0].resources;
                    
                    attackerResources.gold += loot.gold;
                    for (const [key, val] of Object.entries(loot.essences)) {
                        attackerResources[key] = (attackerResources[key] || 0) + val;
                    }
                    
                    await client.query('UPDATE guilds SET resources = $1 WHERE id = $2', [JSON.stringify(attackerResources), raid.attacker_guild_id]);
                    
                    // Log Bank History
                    if (loot.gold > 0) {
                        await client.query(`INSERT INTO guild_bank_history (guild_id, type, currency, amount) VALUES ($1, 'LOOT', 'gold', $2)`, [raid.attacker_guild_id, loot.gold]);
                    }
                }

                // Update Raid Status
                await client.query(
                    `UPDATE guild_raids 
                     SET status = 'FINISHED', combat_log = $1, winner_guild_id = $2, loot = $3 
                     WHERE id = $4`,
                    [JSON.stringify(combatLog), winnerGuildId, JSON.stringify(loot), raid.id]
                );
                
                // Send Reports (To leaders only for now to reduce spam, or all participants?)
                // Let's send to all participants
                const allParticipants = [...attackerIds, ...defenderIds];
                const subject = `Raport z Rajdu: ${isAttackerWinner ? 'Zwycięstwo' : 'Porażka'}`; // Simplified
                
                // For simplicity in this context, we don't construct the full body here, 
                // the user can view the full log in the Guild Raid tab history.
                // But let's send a notification.
                 for (const uid of allParticipants) {
                    await client.query(
                        `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'System', 'system', $2, $3)`,
                        [uid, subject, JSON.stringify({ content: `Bitwa zakończona! Zwycięzca: ${winner === 'attacker' ? 'Atakujący' : 'Obrońcy'}. Sprawdź zakładkę Rajdy w gildii po szczegóły.` })]
                    );
                }

                await client.query('COMMIT');
            } catch (raidErr) {
                await client.query('ROLLBACK');
                console.error(`Error processing raid ${raid.id}:`, raidErr);
            }
        }
    } catch (err) {
        console.error('Error in processPendingRaids:', err);
    } finally {
        client.release();
    }
}