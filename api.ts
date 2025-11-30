
import { GameData, PlayerCharacter, MarketListing, Message, Guild, GuildArmoryItem, PublicCharacterProfile, PublicGuildProfile } from './types';

const API_URL = '/api';

export const getAuthToken = () => localStorage.getItem('token');

const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    
    if (response.status === 204) return;

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
        throw new Error(data.message || 'An error occurred');
    }
    
    return data;
};

export const api = {
    getAuthToken,
    
    // Auth
    async login(credentials: any): Promise<{ token: string }> {
        return fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    },
    async register(credentials: any): Promise<any> {
        return fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(credentials) });
    },
    async changePassword(oldPassword: string, newPassword: string): Promise<any> {
        return fetchApi('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
    },

    // Game Data & Character
    async getGameData(): Promise<GameData> {
        return fetchApi('/game-data');
    },
    async getCharacter(): Promise<PlayerCharacter> {
        return fetchApi('/character');
    },
    async getCharacterNames(): Promise<string[]> {
        return fetchApi('/character/names');
    },
    async getCharacterProfile(name: string): Promise<PublicCharacterProfile> {
        return fetchApi(`/character/profile/${name}`);
    },

    // Admin
    async deleteUser(userId: number): Promise<void> {
        return fetchApi(`/admin/users/${userId}`, { method: 'DELETE' });
    },
    async deleteCharacter(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}`, {
            method: 'DELETE',
        });
    },
    async resetCharacterStats(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/reset-stats`, { method: 'POST' });
    },
    async resetCharacterProgress(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/reset-progress`, { method: 'POST' });
    },
    async adminHealCharacter(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/heal`, { method: 'POST' });
    },
    async updateCharacterGold(userId: number, gold: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/gold`, { method: 'POST', body: JSON.stringify({ gold }) });
    },
    
    // Other Admin methods inferred from usage
    async getDbTables(): Promise<string[]> { return fetchApi('/admin/db/tables'); },
    async getDbTableData(table: string, page: number, limit: number): Promise<any> { return fetchApi(`/admin/db/table/${table}?page=${page}&limit=${limit}`); },
    async updateDbRow(table: string, data: any): Promise<void> { return fetchApi(`/admin/db/table/${table}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteDbRow(table: string, id: any): Promise<void> { return fetchApi(`/admin/db/table/${table}/${id}`, { method: 'DELETE' }); },
    async runCharacterDataAudit(): Promise<any> { return fetchApi('/admin/audit/character-data', { method: 'POST' }); },
    async runGoldAudit(): Promise<any> { return fetchApi('/admin/audit/gold', { method: 'POST' }); },
    async runValuesAudit(): Promise<any> { return fetchApi('/admin/audit/values', { method: 'POST' }); },
    async runAttributesAudit(): Promise<any> { return fetchApi('/admin/audit/attributes', { method: 'POST' }); },
    async wipeGameData(): Promise<any> { return fetchApi('/admin/wipe', { method: 'POST' }); },
    async runDuplicationAudit(): Promise<any> { return fetchApi('/admin/audit/duplication', { method: 'POST' }); },
    async resolveDuplications(): Promise<any> { return fetchApi('/admin/audit/duplication/resolve', { method: 'POST' }); },
    async runOrphanAudit(): Promise<any> { return fetchApi('/admin/audit/orphans', { method: 'POST' }); },
    async resolveOrphans(): Promise<any> { return fetchApi('/admin/audit/orphans/resolve', { method: 'POST' }); },
    async findItemById(itemId: string): Promise<any> { return fetchApi(`/admin/items/find/${itemId}`); },

    // Market
    async getMarketListings(): Promise<MarketListing[]> {
        return fetchApi('/market/listings');
    },
    async getMyMarketListings(): Promise<MarketListing[]> {
        return fetchApi('/market/my-listings');
    },
    async createMarketListing(data: any): Promise<PlayerCharacter> {
        return fetchApi('/market/listings', { method: 'POST', body: JSON.stringify(data) });
    },
    async buyMarketListing(listingId: number): Promise<PlayerCharacter> {
        return fetchApi('/market/buy', { method: 'POST', body: JSON.stringify({ listingId }) });
    },
    async bidOnMarketListing(listingId: number, amount: number): Promise<MarketListing> {
        return fetchApi('/market/bid', { method: 'POST', body: JSON.stringify({ listingId, amount }) });
    },
    async cancelMarketListing(listingId: number): Promise<PlayerCharacter> {
        return fetchApi(`/market/listings/${listingId}/cancel`, { method: 'POST' });
    },
    async claimMarketListing(listingId: number): Promise<PlayerCharacter> {
        return fetchApi(`/market/listings/${listingId}/claim`, { method: 'POST' });
    },

    // Guilds
    async getMyGuild(): Promise<Guild | null> {
        return fetchApi('/guilds/my-guild');
    },
    async getGuildProfile(id: number): Promise<PublicGuildProfile> {
        return fetchApi(`/guilds/profile/${id}`);
    },
    async getGuildList(): Promise<any[]> {
        return fetchApi('/guilds/list');
    },
    async createGuild(name: string, tag: string, description: string): Promise<any> {
        return fetchApi('/guilds/create', { method: 'POST', body: JSON.stringify({ name, tag, description }) });
    },
    async updateGuild(description: string, crestUrl: string, minLevel: number, isPublic: boolean): Promise<any> {
        return fetchApi('/guilds/update', { method: 'POST', body: JSON.stringify({ description, crestUrl, minLevel, isPublic }) });
    },
    async joinGuild(guildId: number): Promise<any> {
        return fetchApi(`/guilds/join/${guildId}`, { method: 'POST' });
    },
    async leaveGuild(): Promise<any> {
        return fetchApi('/guilds/leave', { method: 'POST' });
    },
    async manageGuildMember(targetUserId: number, action: 'kick' | 'promote' | 'demote'): Promise<any> {
        return fetchApi('/guilds/manage-member', { method: 'POST', body: JSON.stringify({ targetUserId, action }) });
    },
    async inviteToGuild(characterName: string): Promise<any> {
        return fetchApi('/guilds/invite', { method: 'POST', body: JSON.stringify({ characterName }) });
    },
    async acceptGuildInvite(messageId: number): Promise<any> {
        return fetchApi('/guilds/accept-invite', { method: 'POST', body: JSON.stringify({ messageId }) });
    },
    async rejectGuildInvite(messageId: number): Promise<any> {
        return fetchApi('/guilds/reject-invite', { method: 'POST', body: JSON.stringify({ messageId }) });
    },
    async guildBankTransaction(type: string, currency: string, amount: number): Promise<any> {
        return fetchApi('/guilds/bank', { method: 'POST', body: JSON.stringify({ type, currency, amount }) });
    },
    async upgradeGuildBuilding(buildingType: string): Promise<any> {
        return fetchApi('/guilds/upgrade-building', { method: 'POST', body: JSON.stringify({ buildingType }) });
    },
    async getGuildArmory(): Promise<{ armoryItems: GuildArmoryItem[], borrowedItems: GuildArmoryItem[] }> {
        return fetchApi('/guilds/armory');
    },
    async depositToArmory(itemId: string): Promise<any> {
        return fetchApi('/guilds/armory/deposit', { method: 'POST', body: JSON.stringify({ itemId }) });
    },
    async borrowFromArmory(armoryId: number): Promise<any> {
        return fetchApi('/guilds/armory/borrow', { method: 'POST', body: JSON.stringify({ armoryId }) });
    },
    async recallFromMember(targetUserId: number, itemUniqueId: string): Promise<any> {
        return fetchApi('/guilds/armory/recall', { method: 'POST', body: JSON.stringify({ targetUserId, itemUniqueId }) });
    },
    async deleteFromArmory(armoryId: number): Promise<any> {
        return fetchApi(`/guilds/armory/${armoryId}`, { method: 'DELETE' });
    },
    async getGuildRanking(): Promise<any[]> {
        return fetchApi('/ranking/guilds');
    },

    // Messages
    async getMessages(): Promise<Message[]> {
        return fetchApi('/messages');
    },
    async sendMessage(data: { recipientName: string; subject: string; content: string }): Promise<Message> {
        return fetchApi('/messages', { method: 'POST', body: JSON.stringify(data) });
    },
    async markMessageAsRead(id: number): Promise<void> {
        return fetchApi(`/messages/${id}`, { method: 'PUT' });
    },
    async deleteMessage(id: number): Promise<void> {
        return fetchApi(`/messages/${id}`, { method: 'DELETE' });
    },
    async deleteBulkMessages(type: string): Promise<any> {
        return fetchApi('/messages/bulk-delete', { method: 'POST', body: JSON.stringify({ type }) });
    },
    async claimMarketReturn(id: number): Promise<PlayerCharacter> {
        return fetchApi(`/messages/claim-return/${id}`, { method: 'POST' });
    },

    // Hunting
    async getHuntingParties(): Promise<any[]> {
        return fetchApi('/hunting/parties');
    },
    async getMyParty(): Promise<any> {
        return fetchApi('/hunting/my-party');
    },
    async createParty(bossId: string, maxMembers: number): Promise<any> {
        return fetchApi('/hunting/create', { method: 'POST', body: JSON.stringify({ bossId, maxMembers }) });
    },
    async joinParty(partyId: number): Promise<any> {
        return fetchApi(`/hunting/join/${partyId}`, { method: 'POST' });
    },
    async leaveParty(): Promise<any> {
        return fetchApi('/hunting/leave', { method: 'POST' });
    },
    async respondToJoinRequest(userId: number, action: 'accept' | 'reject' | 'kick'): Promise<any> {
        return fetchApi('/hunting/respond', { method: 'POST', body: JSON.stringify({ userId, action }) });
    },
    async startParty(): Promise<any> {
        return fetchApi('/hunting/start', { method: 'POST' });
    },
    async resetHuntingParties(): Promise<any> {
        // Assuming this endpoint exists in admin based on usage in HuntingTab
        return fetchApi('/admin/reset-hunting', { method: 'POST' });
    },
};
