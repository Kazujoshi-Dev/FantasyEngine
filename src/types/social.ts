
import { CurrencyType } from './common.js';
import { ItemInstance, ItemTemplate } from './items.js';
import { CharacterStats } from './character.js';
import { EquipmentSlot } from './items.js';

export type MessageType = 'player_message' | 'system' | 'expedition_report' | 'pvp_report' | 'market_notification' | 'guild_invite' | 'raid_report';

export interface Message {
    id: number;
    recipient_id: number;
    sender_id?: number;
    sender_name?: string;
    message_type: MessageType;
    subject: string;
    body: any; // JSON
    is_read: boolean;
    is_saved: boolean;
    created_at: string;
}

export interface PlayerMessageBody {
    content: string;
}

export interface MarketNotificationBody {
    type: 'SOLD' | 'BOUGHT' | 'WON' | 'EXPIRED' | 'ITEM_RETURNED' | 'OUTBID';
    itemName: string;
    price?: number;
    currency?: CurrencyType;
    item?: ItemInstance;
    listingId?: number;
}

export interface GuildInviteBody {
    guildId: number;
    guildName: string;
}

export interface TavernMessage {
    id: number;
    user_id: number;
    character_name: string;
    content: string;
    created_at: string;
}

export enum ListingType {
    BuyNow = 'buy_now',
    Auction = 'auction'
}

export interface MarketListing {
    id: number;
    seller_id: number;
    seller_name: string;
    item_data: ItemInstance;
    listing_type: ListingType;
    currency: CurrencyType;
    buy_now_price?: number;
    start_bid_price?: number;
    current_bid_price?: number;
    highest_bidder_id?: number;
    highest_bidder_name?: string;
    created_at: string;
    expires_at: string;
    status: 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'CANCELLED' | 'CLAIMED';
    bid_count: number;
}

export interface TraderInventoryData {
    regularItems: ItemInstance[];
    specialOfferItems: ItemInstance[];
}

export interface TraderData {
    lastRefresh: number;
    regularItems: ItemInstance[];
    specialOfferItems: ItemInstance[];
}

export interface SpyReportResult {
    success: boolean;
    targetName: string;
    gold?: number;
    stats?: CharacterStats;
    equipment?: Record<EquipmentSlot, ItemInstance | null>;
    inventoryCount?: number;
}

export interface ItemSearchResult {
    item: ItemInstance;
    template: ItemTemplate;
    locations: { userId: number; ownerName: string; location: string }[];
}

export interface DuplicationAuditResult {
    uniqueId: string;
    itemName: string;
    instances: { ownerName: string; location: string }[];
}

export interface OrphanAuditResult {
    userId: number;
    characterName: string;
    orphans: { uniqueId: string; templateId: string; location: string }[];
}
