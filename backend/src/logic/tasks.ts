
import { pool } from '../db.js';
import { ItemTemplate, MarketNotificationBody } from '../types.js';

export async function processExpiredListings(client: any) { // Can be PoolClient or Pool
    const expiredRes = await client.query(
        "SELECT * FROM market_listings WHERE status = 'ACTIVE' AND expires_at <= NOW() FOR UPDATE"
    );

    if (expiredRes.rows.length === 0) {
        return;
    }

    const gameDataRes = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
    const allItemTemplates: ItemTemplate[] = gameDataRes.rows[0]?.data || [];

    for (const listing of expiredRes.rows) {
        const isUnsold = listing.listing_type === 'buy_now' || (listing.listing_type === 'auction' && !listing.highest_bidder_id);
        
        if (isUnsold) {
            await client.query("UPDATE market_listings SET status = 'EXPIRED' WHERE id = $1", [listing.id]);

            const template = allItemTemplates.find(t => t.id === listing.item_data.templateId);
            const notificationBody: MarketNotificationBody = {
                type: 'ITEM_RETURNED',
                itemName: template?.name || 'Unknown Item',
                item: listing.item_data,
                listingId: listing.id
            };
            
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                 VALUES ($1, 'Rynek', 'market_notification', 'Twoja oferta wygasła', $2)`,
                [listing.seller_id, JSON.stringify(notificationBody)]
            );
        }
    }
}

export async function cleanupOldTavernMessages() {
    const client = await pool.connect();
    try {
        const result = await client.query(
            "DELETE FROM tavern_messages WHERE created_at < NOW() - INTERVAL '12 hours'"
        );
        if (result.rowCount && result.rowCount > 0) {
            console.log(`[TAVERN CLEANUP] Removed ${result.rowCount} old tavern messages.`);
        }
    } catch (err) {
        console.error('[TAVERN CLEANUP] Error removing old tavern messages:', err);
    } finally {
        client.release();
    }
}