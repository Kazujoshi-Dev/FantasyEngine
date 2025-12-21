
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
import { MarketListing, PlayerCharacter, ItemInstance, ItemTemplate } from '../types.js';
import { enforceInboxLimit } from '../logic/helpers.js';

const router = express.Router();

// GET /listings - Browse active listings
router.get('/listings', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(
            "SELECT m.*, c.data->>'name' as seller_name FROM market_listings m JOIN characters c ON m.seller_id = c.user_id WHERE status = 'ACTIVE' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 100"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching listings' });
    }
});

// GET /my-listings - Hide CLAIMED listings so they "disappear" from the user view
router.get('/my-listings', authenticateToken, async (req: any, res: any) => {
    try {
        const result = await pool.query(
            "SELECT m.*, c.data->>'name' as seller_name FROM market_listings m JOIN characters c ON m.seller_id = c.user_id WHERE seller_id = $1 AND status != 'CLAIMED' ORDER BY created_at DESC",
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching listings' });
    }
});

// POST /listings - Create Listing
router.post('/listings', authenticateToken, async (req: any, res: any) => {
    const { itemUniqueId, price, currency, durationHours, listingType, startBid } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const charRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const character: PlayerCharacter = charRes.rows[0].data;
        
        const itemIndex = character.inventory.findIndex(i => i.uniqueId === itemUniqueId);
        if (itemIndex === -1) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: 'Item not found' });
        }
        const item = character.inventory[itemIndex];
        if (item.isBorrowed) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Cannot sell borrowed items' });
        }

        // Remove item from inventory
        character.inventory.splice(itemIndex, 1);
        
        const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
        
        await client.query(
            `INSERT INTO market_listings (seller_id, item_data, listing_type, currency, buy_now_price, start_bid_price, current_bid_price, expires_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')`,
            [req.user.id, JSON.stringify(item), listingType, currency, price, startBid, startBid || 0, expiresAt]
        );
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(character), req.user.id]);
        
        await client.query('COMMIT');
        res.status(201).json({ message: 'Listing created' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /buy
router.post('/buy', authenticateToken, async (req: any, res: any) => {
    const { listingId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const listingRes = await client.query("SELECT * FROM market_listings WHERE id = $1 FOR UPDATE", [listingId]);
        if (listingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Listing not found' });
        }
        const listing = listingRes.rows[0];
        
        if (listing.status !== 'ACTIVE' || new Date(listing.expires_at) < new Date()) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Listing not active' });
        }
        
        if (listing.seller_id === req.user.id) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Cannot buy your own item' });
        }

        const buyerRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const buyer: PlayerCharacter = buyerRes.rows[0].data;
        
        const price = listing.buy_now_price;
        const currency = listing.currency;
        
        if ((buyer.resources as any)[currency] < price) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough resources' });
        }
        
        // Deduct from buyer
        (buyer.resources as any)[currency] -= price;
        buyer.inventory.push(listing.item_data);
        
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(buyer), req.user.id]);
        await client.query("UPDATE market_listings SET status = 'SOLD', highest_bidder_id = $1, current_bid_price = $2 WHERE id = $3", [req.user.id, price, listingId]);
        
        // Notify Seller
        await enforceInboxLimit(client, listing.seller_id);
        const notificationBody = { type: 'SOLD', itemName: listing.item_data.templateId, price, currency }; // templateId is placeholder for name logic in frontend if needed, ideally resolved here but simplified
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Przedmiot sprzedany!', $2)`,
            [listing.seller_id, JSON.stringify(notificationBody)]
        );

        await client.query('COMMIT');
        res.json({ message: 'Bought' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /bid
router.post('/bid', authenticateToken, async (req: any, res: any) => {
    const { listingId, amount } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const listingRes = await client.query("SELECT * FROM market_listings WHERE id = $1 FOR UPDATE", [listingId]);
        if (listingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Listing not found' });
        }
        const listing = listingRes.rows[0];
        
        if (listing.status !== 'ACTIVE' || new Date(listing.expires_at) < new Date()) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Listing not active' });
        }
        
        if (amount <= listing.current_bid_price) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Bid too low' });
        }
        
        const buyerRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [req.user.id]);
        const buyer: PlayerCharacter = buyerRes.rows[0].data;
        
        if ((buyer.resources as any)[listing.currency] < amount) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: 'Not enough resources' });
        }

        // Return funds to previous bidder
        if (listing.highest_bidder_id) {
             const prevBidderRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [listing.highest_bidder_id]);
             if (prevBidderRes.rows.length > 0) {
                 const prevBidder = prevBidderRes.rows[0].data;
                 (prevBidder.resources as any)[listing.currency] += listing.current_bid_price;
                 await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(prevBidder), listing.highest_bidder_id]);
                 
                 // Notify outbid
                 await enforceInboxLimit(client, listing.highest_bidder_id);
                 await client.query(
                    `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Zostałeś przelicytowany!', $2)`,
                    [listing.highest_bidder_id, JSON.stringify({ type: 'OUTBID', itemName: 'Przedmiot', price: amount, currency: listing.currency })]
                );
             }
        }

        // Deduct from new bidder
        (buyer.resources as any)[listing.currency] -= amount;
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(buyer), req.user.id]);
        
        await client.query("UPDATE market_listings SET highest_bidder_id = $1, current_bid_price = $2 WHERE id = $3", [req.user.id, amount, listingId]);
        
        // Log bid
        await client.query("INSERT INTO market_bids (listing_id, bidder_id, amount) VALUES ($1, $2, $3)", [listingId, req.user.id, amount]);

        await client.query('COMMIT');
        res.json({ message: 'Bid placed' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /listings/:id/cancel
router.post('/listings/:id/cancel', authenticateToken, async (req: any, res: any) => {
    const listingId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const listingRes = await client.query("SELECT * FROM market_listings WHERE id = $1 AND seller_id = $2 FOR UPDATE", [listingId, req.user.id]);
        if (listingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Listing not found or not yours' });
        }
        const listing = listingRes.rows[0];
        
        if (listing.status !== 'ACTIVE') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot cancel non-active listing' });
        }
        
        // If auction has bids, maybe prevent cancel? Or penalty?
        // Simple logic: Cancel and return item to seller via message system to avoid inventory overflow here
        
        await client.query("UPDATE market_listings SET status = 'CANCELLED' WHERE id = $1", [listingId]);
        
        // Send item back via message
        await enforceInboxLimit(client, req.user.id);
        const notificationBody = { type: 'ITEM_RETURNED', itemName: 'Anulowana oferta', item: listing.item_data, listingId: listing.id };
        await client.query(
            `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body)
                VALUES ($1, 'Rynek', 'market_notification', 'Anulowano ofertę', $2)`,
            [req.user.id, JSON.stringify(notificationBody)]
        );
        
        // Return funds to highest bidder if any
         if (listing.highest_bidder_id) {
             const prevBidderRes = await client.query('SELECT data FROM characters WHERE user_id = $1 FOR UPDATE', [listing.highest_bidder_id]);
             if (prevBidderRes.rows.length > 0) {
                 const prevBidder = prevBidderRes.rows[0].data;
                 (prevBidder.resources as any)[listing.currency] += listing.current_bid_price;
                 await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [JSON.stringify(prevBidder), listing.highest_bidder_id]);
                 
                  await enforceInboxLimit(client, listing.highest_bidder_id);
                  await client.query(
                    `INSERT INTO messages (recipient_id, sender_name, message_type, subject, body) VALUES ($1, 'Rynek', 'market_notification', 'Aukcja anulowana (Zwrot środków)', $2)`,
                    [listing.highest_bidder_id, JSON.stringify({ type: 'OUTBID', itemName: 'Anulowana aukcja', price: listing.current_bid_price, currency: listing.currency })]
                );
             }
        }

        await client.query('COMMIT');
        res.json({ message: 'Cancelled' });
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// POST /listings/:id/claim
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
                (character.resources as any)[listing.currency] = (Number((character.resources as any)[listing.currency]) || 0) + salePrice;
            }
        } 
        
        await client.query("UPDATE market_listings SET status = 'CLAIMED', updated_at = NOW() WHERE id = $1", [listingId]);
        await client.query('UPDATE characters SET data = $1 WHERE user_id = $2', [character, sellerId]);
        
        await client.query('COMMIT');
        res.json(character);
    } catch (err: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to claim from listing.' });
    } finally {
        client.release();
    }
});

export default router;
