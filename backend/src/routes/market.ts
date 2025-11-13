


import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';
// FIX: Import `getBackpackCapacity` from the correct helper file.
import { PlayerCharacter, MarketListing } from '../types.js';
import { processExpiredListings } from '../logic/tasks.js';
import { getBackpackCapacity } from '../logic/helpers.js';

const router = express.Router();

// GET all active listings
router.get('/listings', authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        await processExpiredListings(pool);
        const result = await pool.query(
            `SELECT ml.*, u.username as seller_name, highest_bidder.username as highest_bidder_name, COUNT(mb.id) as bid_count
             FROM market_listings ml
             JOIN users u ON ml.seller_id = u.id
             LEFT JOIN users highest_bidder ON ml.highest_bidder_id = highest_bidder.id
             LEFT JOIN market_bids mb ON ml.id = mb.listing_id
             WHERE ml.status = 'ACTIVE'
             GROUP BY ml.id, u.username, highest_bidder.username
             ORDER BY ml.expires_at ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch market listings' });
    }
});

// GET user's listings
router.get('/my-listings', authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        await processExpiredListings(pool);
        const result = await pool.query(
            "SELECT * FROM market_listings WHERE seller_id = $1 AND status != 'CLAIMED' ORDER BY created_at DESC",
            [req.user!.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch your listings' });
    }
});

// POST a new listing
router.post('/listings', authenticateToken, async (req: express.Request, res: express.Response) => {
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

// POST to buy an item
router.post('/buy', authenticateToken, async (req: express.Request, res: express.Response) => {
    // Implementation for buy now
    res.status(501).json({ message: "Not implemented" });
});

// POST to bid on an item
router.post('/bid', async (req: express.Request, res: express.Response) => {
    // Implementation for bidding
    res.status(501).json({ message: "Not implemented" });
});

// POST to cancel a listing
router.post('/listings/:id/cancel', authenticateToken, async (req: express.Request, res: express.Response) => {
    // Implementation for cancelling
    res.status(501).json({ message: "Not implemented" });
});

// POST to claim a finished listing (sold, expired, cancelled)
router.post('/listings/:id/claim', authenticateToken, async (req: express.Request, res: express.Response) => {
    // Implementation for claiming
    res.status(501).json({ message: "Not implemented" });
});

export default router;