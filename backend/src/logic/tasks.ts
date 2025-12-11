
import { pool } from '../db.js';
import { ItemTemplate, MarketNotificationBody } from '../types.js';
import { enforceInboxLimit } from './helpers.js';

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
        const template = allItemTemplates.find(t => t.id === listing.item_data.templateId);
        const itemName = template?.name || 'Unknown Item';

        // Case 1: Auction won
        if (listing.listing_type === 'auction' && listing.highest_bidder_id) {
            await client.query("UPDATE market_listings SET status = 'SOLD' WHERE id = $1", [listing.id]);
            
            // Notify seller
            const sellerNotification: MarketNotificationBody = { type: 'SOLD', itemName, price: listing.current_bid_price, currency: listing.currency };
            
            await enforceInboxLimit(client, listing.seller_id);
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Przedmiot sprzedany na aukcji!', $2)`,
                [listing.seller_id, JSON.stringify(sellerNotification)]
            );
            
            // Notify winner and send item
            const winnerNotification: MarketNotificationBody = { type: 'WON', itemName, price: listing.current_bid_price, currency: listing.currency, item: listing.item_data };
            
            await enforceInboxLimit(client, listing.highest_bidder_id);
            await client.query(
                `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Wygrałeś aukcję!', $2)`,
                [listing.highest_bidder_id, JSON.stringify(winnerNotification)]
            );
        
        // Case 2: Unsold item (Buy Now or Auction with no bids)
        } else {
            await client.query("UPDATE market_listings SET status = 'EXPIRED' WHERE id = $1", [listing.id]);
            const notificationBody: MarketNotificationBody = {
                type: 'ITEM_RETURNED',
                itemName,
                item: listing.item_data,
                listingId: listing.id
            };
            
            await enforceInboxLimit(client, listing.seller_id);
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
