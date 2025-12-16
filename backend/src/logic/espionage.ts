
import { pool } from '../db.js';
import { EspionageEntry, CharacterResources } from '../types.js';

// Processes active espionage missions that have completed
export const processPendingEspionage = async (): Promise<void> => {
    const client = await pool.connect();
    try {
        const now = new Date();
        
        // Find missions that are IN_PROGRESS and end_time has passed
        const missionsRes = await client.query(`
            SELECT id, defender_guild_id 
            FROM guild_espionage 
            WHERE status = 'IN_PROGRESS' AND end_time <= $1
            FOR UPDATE SKIP LOCKED
        `, [now]);

        if (missionsRes.rows.length === 0) {
            await client.query('ROLLBACK'); // Nothing to do
            return;
        }

        await client.query('BEGIN');

        for (const mission of missionsRes.rows) {
            // Snapshot the target guild's resources at this moment
            const guildRes = await client.query('SELECT resources FROM guilds WHERE id = $1', [mission.defender_guild_id]);
            
            let resources: CharacterResources = { gold: 0, commonEssence: 0, uncommonEssence: 0, rareEssence: 0, epicEssence: 0, legendaryEssence: 0 };
            
            if (guildRes.rows.length > 0) {
                resources = guildRes.rows[0].resources || resources;
            }

            await client.query(
                `UPDATE guild_espionage 
                 SET status = 'COMPLETED', result_snapshot = $1 
                 WHERE id = $2`,
                [JSON.stringify(resources), mission.id]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error processing espionage:', err);
    } finally {
        client.release();
    }
};
