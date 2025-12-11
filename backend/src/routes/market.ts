
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { PlayerCharacter, MarketListing, MarketNotificationBody, ItemTemplate } from '../types.js';
import { processExpiredListings } from '../logic/tasks.js';
import { getBackpackCapacity, enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

const getItemName = async (client: any, templateId: string): Promise<string> => {
    const res = await client.query("SELECT data FROM game_data WHERE key = 'itemTemplates'");
    const templates: ItemTemplate[] = res.rows[0]?.data || [];
    return templates.find(t => t.id === templateId)?.name || 'Nieznany przedmiot';
}

// GET all active listings
router.get('/listings', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await processExpiredListings(client);
        
        // Updated query: Join characters table instead of users to get character names from JSON data
        const result = await client.query(
            `SELECT 
                ml.*, 
                c_seller.data->>'name' as seller_name, 
                c_bidder.data->>'name' as highest_bidder_name, 
                COUNT(mb.id) as bid_count
             FROM market_listings ml
             JOIN characters c_seller ON ml.seller_id = c_seller.user_id
             LEFT JOIN characters c_bidder ON ml.highest_bidder_id = c_bidder.user_id
             LEFT JOIN market_bids mb ON ml.id = mb.listing_id
             WHERE ml.status = 'ACTIVE'
             GROUP BY ml.id, c_seller.data, c_bidder.data
             ORDER BY ml.expires_at ASC`
        );
        
        await client.query('COMMIT');
        res.json(result.rows);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch market listings' });
    } finally {
        client.release();
    }
});

// GET user's listings
router.get('/my-listings', authenticateToken, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await processExpiredListings(client);
        const result = await client.query(
            "SELECT * FROM market_listings WHERE seller_id = $1 AND status != 'CLAIMED' ORDER BY created_at DESC",
            [req.user!.id]
        );
        await client.query('COMMIT');
        res.json(result.rows);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to fetch your listings' });
    } finally {
        client.release();
    }
});

// POST a new listing
router.post('/listings', authenticateToken, async (req: any, res: any) => {
    const { itemId, listingType, currency, price, durationHours } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user!.id]);
        let character: PlayerCharacter = charRes.rows[0].data;

        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in inventory.' });
        }
        const itemData = character.inventory[itemIndex];
        
        if (itemData.isBorrowed) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Cannot list borrowed items.' });
        }

        character.inventory.splice(itemIndex, 1);

        const expires_at = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
        const query = listingType === 'buy_now'
            ? 'INSERT INTO market_listings (seller_id, item_data, listing_type, currency, buy_now_price, expires_at) VALUES ($1, $2, $3, $4, $5, $6)'
            : 'INSERT INTO market_listings (seller_id, item_data, listing_type, currency, start_bid_price, expires_at) VALUES ($1, $2, $3, $4, $5, $6)';

        await client.query(query, [req.user!.id, itemData, listingType, currency, price, expires_at]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, req.user!.id]);

        await client.query('COMMIT');
        res.status(201).json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to create listing' });
    } finally {
        client.release();
    }
});

router.post('/buy', authenticateToken, async (req: any, res: any) => {
    const { listingId } = req.body;
    const buyerId = req.user!.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const listingRes = await client.query("SELECT * FROM market_listings WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE", [listingId]);
        if (listingRes.rows.length === 0) {
            return res.status(404).json({ message: "Listing not found or already sold." });
        }
        const listing: MarketListing = listingRes.rows[0];

        if (listing.seller_id === buyerId) return res.status(400).json({ message: "You cannot buy your own item." });
        if (listing.listing_type !== 'buy_now' || !listing.buy_now_price) return res.status(400).json({ message: "This is not a 'buy now' listing." });

        const buyerRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [buyerId]);
        let buyer: PlayerCharacter = buyerRes.rows[0].data;

        if (getBackpackCapacity(buyer) <= buyer.inventory.length) {
            return res.status(400).json({ message: "Your inventory is full." });
        }

        if (listing.currency === 'gold') {
            if (buyer.resources.gold < listing.buy_now_price) return res.status(400).json({ message: "Not enough gold." });
            buyer.resources.gold -= listing.buy_now_price;
        } else {
            if ((buyer.resources[listing.currency] || 0) < listing.buy_now_price) return res.status(400).json({ message: "Not enough essence." });
            (buyer.resources[listing.currency] as number) -= listing.buy_now_price;
        }

        buyer.inventory.push(listing.item_data);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [buyer, buyerId]);

        await client.query("UPDATE market_listings SET status = 'SOLD', highest_bidder_id = $1, current_bid_price = $2, updated_at = NOW() WHERE id = $3", [buyerId, listing.buy_now_price, listingId]);

        const itemName = await getItemName(client, listing.item_data.templateId);
        const sellerNotification: MarketNotificationBody = { type: 'SOLD', itemName, price: listing.buy_now_price, currency: listing.currency };
        
        await enforceInboxLimit(client, listing.seller_id);
        await client.query(`INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Przedmiot sprzedany!', $2)`, [listing.seller_id, JSON.stringify(sellerNotification)]);

        await client.query('COMMIT');
        res.json(buyer);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to buy item.' });
    } finally {
        client.release();
    }
});


router.post('/bid', authenticateToken, async (req: any, res: any) => {
    const { listingId, amount } = req.body;
    const bidderId = req.user!.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const listingRes = await client.query("SELECT * FROM market_listings WHERE id = $1 AND status = 'ACTIVE' AND expires_at > NOW() FOR UPDATE", [listingId]);
        if (listingRes.rows.length === 0) return res.status(404).json({ message: "Auction not found or has ended." });
        const listing: MarketListing = listingRes.rows[0];

        if (listing.seller_id === bidderId) return res.status(400).json({ message: "You cannot bid on your own item." });
        if (listing.listing_type !== 'auction') return res.status(400).json({ message: "This is not an auction." });

        // Logic: Bid must be at least 5% higher than current bid (rounded up)
        const currentPrice = Number(listing.current_bid_price || 0);
        const minBid = listing.current_bid_price 
            ? Math.ceil(currentPrice * 1.05) 
            : Number(listing.start_bid_price!);

        if (amount < minBid) return res.status(400).json({ message: `Bid too low. Minimum bid is ${minBid}.` });

        const bidderRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [bidderId]);
        let bidder: PlayerCharacter = bidderRes.rows[0].data;

        if (listing.currency === 'gold') {
            if (bidder.resources.gold < amount) return res.status(400).json({ message: "Not enough gold." });
            bidder.resources.gold -= amount;
        } else {
            if ((bidder.resources[listing.currency] || 0) < amount) return res.status(400).json({ message: "Not enough essence." });
            (bidder.resources[listing.currency] as number) -= amount;
        }

        if (listing.highest_bidder_id) {
            const prevBidderRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [listing.highest_bidder_id]);
            if (prevBidderRes.rows.length > 0) {
                let prevBidder: PlayerCharacter = prevBidderRes.rows[0].data;
                if (listing.currency === 'gold') prevBidder.resources.gold += listing.current_bid_price!;
                else (prevBidder.resources[listing.currency] as number) += listing.current_bid_price!;
                await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [prevBidder, listing.highest_bidder_id]);

                const itemName = await getItemName(client, listing.item_data.templateId);
                const outbidNotification: MarketNotificationBody = { type: 'OUTBID', itemName, listingId };
                
                await enforceInboxLimit(client, listing.highest_bidder_id);
                await client.query(`INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Zostałeś przelicytowany!', $2)`, [listing.highest_bidder_id, JSON.stringify(outbidNotification)]);
            }
        }
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [bidder, bidderId]);
        
        // Return the updated listing structure, fetching names again to ensure frontend consistency immediately
        await client.query("UPDATE market_listings SET current_bid_price = $1, highest_bidder_id = $2, updated_at = NOW() WHERE id = $3", [amount, bidderId, listingId]);
        await client.query("INSERT INTO market_bids (listing_id, bidder_id, amount) VALUES ($1, $2, $3)", [listingId, bidderId, amount]);
        
        // Re-fetch the listing with names joined for the response
        const updatedListingRes = await client.query(
            `SELECT ml.*, c_seller.data->>'name' as seller_name, c_bidder.data->>'name' as highest_bidder_name, COUNT(mb.id) as bid_count
             FROM market_listings ml
             JOIN characters c_seller ON ml.seller_id = c_seller.user_id
             LEFT JOIN characters c_bidder ON ml.highest_bidder_id = c_bidder.user_id
             LEFT JOIN market_bids mb ON ml.id = mb.listing_id
             WHERE ml.id = $1
             GROUP BY ml.id, c_seller.data, c_bidder.data`,
            [listingId]
        );

        await client.query('COMMIT');
        res.json(updatedListingRes.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to place bid.' });
    } finally {
        client.release();
    }
});

router.post('/listings/:id/cancel', authenticateToken, async (req: any, res: any) => {
    const listingId = req.params.id;
    const sellerId = req.user!.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const listingRes = await client.query("SELECT * FROM market_listings WHERE id = $1 AND seller_id = $2 AND status = 'ACTIVE' FOR UPDATE", [listingId, sellerId]);
        if (listingRes.rows.length === 0) return res.status(404).json({ message: "Listing not found or not yours." });
        
        const listing: MarketListing = listingRes.rows[0];
        if (listing.listing_type === 'auction' && listing.highest_bidder_id) {
            return res.status(400).json({ message: "Cannot cancel an auction that has bids." });
        }

        await client.query("UPDATE market_listings SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [listingId]);

        const itemName = await getItemName(client, listing.item_data.templateId);
        const notificationBody: MarketNotificationBody = { type: 'ITEM_RETURNED', itemName, item: listing.item_data };
        
        await enforceInboxLimit(client, sellerId);
        await client.query(`INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Oferta anulowana', $2)`, [sellerId, JSON.stringify(notificationBody)]);

        await client.query('COMMIT');
        const charRes = await pool.query('SELECT data FROM characters WHERE user_id = $1', [sellerId]);
        res.json(charRes.rows[0].data);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to cancel listing.' });
    } finally {
        client.release();
    }
});


router.post('/listings/:id/claim', authenticateToken, async (req: any, res: any) => {
    const listingId = req.params.id;
    const sellerId = req.user!.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const listingRes = await client.query("SELECT * FROM market_listings WHERE id = $1 AND seller_id = $2 AND status IN ('SOLD', 'EXPIRED', 'CANCELLED') FOR UPDATE", [listingId, sellerId]);
        if (listingRes.rows.length === 0) return res.status(404).json({ message: "Claimable listing not found." });
        
        const listing: MarketListing = listingRes.rows[0];
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [sellerId]);
        let character: PlayerCharacter = charRes.rows[0].data;

        if (listing.status === 'SOLD') {
            const salePrice = Number(listing.current_bid_price || listing.buy_now_price || 0);

            if (listing.currency === 'gold') {
                // Calculate Commission
                const gameDataRes = await client.query("SELECT key, data FROM game_data WHERE key IN ('itemTemplates', 'affixes')");
                const itemTemplates = gameDataRes.rows.find(r => r.key === 'itemTemplates')?.data || [];
                const affixes = gameDataRes.rows.find(r => r.key === 'affixes')?.data || [];

                const template = itemTemplates.find((t: any) => t.id === listing.item_data.templateId);
                let itemValue = Number(template?.value) || 0;
                
                if (listing.item_data.prefixId) {
                    const prefix = affixes.find((a: any) => a.id === listing.item_data.prefixId);
                    itemValue += Number(prefix?.value) || 0;
                }
                if (listing.item_data.suffixId) {
                    const suffix = affixes.find((a: any) => a.id === listing.item_data.suffixId);
                    itemValue += Number(suffix?.value) || 0;
                }

                const commission = Math.ceil(itemValue * 0.15);
                const finalGold = Math.max(0, salePrice - commission);
                
                character.resources.gold = (Number(character.resources.gold) || 0) + finalGold;
            } else {
                (character.resources[listing.currency] as number) = (Number(character.resources[listing.currency]) || 0) + salePrice;
            }
        } else { // EXPIRED or CANCELLED
            if (getBackpackCapacity(character) <= character.inventory.length) {
                return res.status(400).json({ message: "Your inventory is full." });
            }
            character.inventory.push(listing.item_data);
        }

        await client.query("UPDATE market_listings SET status = 'CLAIMED', updated_at = NOW() WHERE id = $1", [listingId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, sellerId]);
        
        await client.query('COMMIT');
        res.json(character);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to claim from listing.' });
    } finally {
        client.release();
    }
});


export default router;
