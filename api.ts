import { PlayerCharacter, GameData, ItemInstance, MarketListing, PvpRewardSummary, ExpeditionRewardSummary, Guild, PublicCharacterProfile, PublicGuildProfile, GuildRole, GuildArmoryItem, AdminCharacterInfo, Message, TavernMessage, GuildChatMessage, RankingPlayer, EssenceType } from './types';

const API_URL = '/api';

export const getAuthToken = () => localStorage.getItem('token');

const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers as any || {},
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Token invalid
        throw new Error('Invalid token');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'API request failed');
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }

    return response.json();
};

export const api = {
    getAuthToken,

    // Auth
    login: (credentials: any) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (credentials: any) => fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: (token: string) => fetchApi('/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }),
    sendHeartbeat: () => fetchApi('/auth/session/heartbeat', { method: 'POST' }),
    changePassword: (oldPassword: string, newPassword: string) => fetchApi('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),

    // General
    getGameData: (): Promise<GameData> => fetchApi('/game-data'),
    updateGameData: (key: string, data: any) => fetchApi('/game-data', { method: 'PUT', body: JSON.stringify({ key, data }) }),
    updateGameSettings: (settings: any) => fetchApi('/game-data', { method: 'PUT', body: JSON.stringify({ key: 'settings', data: settings }) }),
    synchronizeTime: async () => {
        await fetchApi('/time'); // Ping for now
        return 0; 
    },
    getServerTime: () => Date.now(),

    // Character
    getCharacter: (): Promise<PlayerCharacter> => fetchApi('/character'),
    createCharacter: (name: string, race: string, startLocationId: string) => fetchApi('/character', { method: 'POST', body: JSON.stringify({ name, race, startLocationId }) }),
    updateCharacter: (data: Partial<PlayerCharacter>) => fetchApi('/character', { method: 'PUT', body: JSON.stringify(data) }),
    selectClass: (characterClass: string) => fetchApi('/character/class', { method: 'POST', body: JSON.stringify({ characterClass }) }),
    learnSkill: (skillId: string) => fetchApi('/character/skills/learn', { method: 'POST', body: JSON.stringify({ skillId }) }),
    toggleSkill: (skillId: string, isActive: boolean) => fetchApi('/character/skills/toggle', { method: 'POST', body: JSON.stringify({ skillId, isActive }) }),
    distributeStatPoints: (stats: any) => fetchApi('/character/stats', { method: 'POST', body: JSON.stringify({ stats }) }),
    resetAttributes: () => fetchApi('/character/stats/reset', { method: 'POST' }),
    healCharacter: () => fetchApi('/character/heal', { method: 'POST' }),
    getCharacterNames: () => fetchApi('/characters/names'),
    getCharacterProfile: (name: string): Promise<PublicCharacterProfile> => fetchApi(`/character/profile/${name}`),
    
    // Camp & Inventory
    upgradeCamp: () => fetchApi('/character/camp/upgrade', { method: 'POST' }),
    upgradeChest: () => fetchApi('/character/chest/upgrade', { method: 'POST' }),
    upgradeBackpack: (): Promise<PlayerCharacter> => fetchApi('/character/upgrade-backpack', { method: 'POST' }),
    chestDeposit: (amount: number): Promise<PlayerCharacter> => fetchApi('/character/chest/deposit', { method: 'POST', body: JSON.stringify({ amount }) }),
    chestWithdraw: (amount: number): Promise<PlayerCharacter> => fetchApi('/character/chest/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
    equipItem: (itemId: string): Promise<PlayerCharacter> => fetchApi('/character/equip', { method: 'POST', body: JSON.stringify({ itemId }) }),
    unequipItem: (slot: string): Promise<PlayerCharacter> => fetchApi('/character/unequip', { method: 'POST', body: JSON.stringify({ slot }) }),
    
    // Expedition
    startExpedition: (expeditionId: string) => fetchApi('/expedition/start', { method: 'POST', body: JSON.stringify({ expeditionId }) }),
    completeExpedition: () => fetchApi('/expedition/complete', { method: 'POST' }),
    cancelExpedition: () => fetchApi('/expedition/cancel', { method: 'POST' }),
    
    // Items
    buyItem: (itemId: string) => fetchApi('/trader/buy', { method: 'POST', body: JSON.stringify({ itemId }) }),
    sellItems: (itemIds: string[]) => fetchApi('/trader/sell', { method: 'POST', body: JSON.stringify({ itemIds }) }),
    disenchantItem: (itemId: string) => fetchApi('/blacksmith/disenchant', { method: 'POST', body: JSON.stringify({ itemId }) }),
    upgradeItem: (itemId: string) => fetchApi('/blacksmith/upgrade', { method: 'POST', body: JSON.stringify({ itemId }) }),
    getTraderInventory: (force: boolean) => fetchApi(`/trader/inventory?force=${force}`),
    
    // PvP & Ranking
    getRanking: (): Promise<RankingPlayer[]> => fetchApi('/ranking'),
    attackPlayer: (defenderId: number) => fetchApi(`/pvp/attack/${defenderId}`, { method: 'POST' }),
    resetAllPvpCooldowns: () => fetchApi('/admin/pvp/reset-cooldowns', { method: 'POST' }),
    
    // Messages & Social
    getMessages: () => fetchApi('/messages'),
    getUnreadMessagesStatus: () => fetchApi('/messages/status/unread').then((res: any) => res.hasUnread),
    sendMessage: (data: any) => fetchApi('/messages', { method: 'POST', body: JSON.stringify(data) }),
    deleteMessage: (id: number) => fetchApi(`/messages/${id}`, { method: 'DELETE' }),
    markMessageAsRead: (id: number) => fetchApi(`/messages/${id}`, { method: 'PUT' }),
    toggleMessageSaved: (id: number) => fetchApi(`/messages/${id}/save`, { method: 'PUT' }),
    deleteBulkMessages: (type: string) => fetchApi('/messages/bulk-delete', { method: 'POST', body: JSON.stringify({ type }) }),
    sendGlobalMessage: (data: any) => fetchApi('/admin/messages/global', { method: 'POST', body: JSON.stringify(data) }),
    
    // Tavern
    getTavernMessages: () => fetchApi('/tavern/messages'),
    sendTavernMessage: (content: string) => fetchApi('/tavern/messages', { method: 'POST', body: JSON.stringify({ content }) }),
    
    // Market
    getMarketListings: () => fetchApi('/market/listings'),
    getMyMarketListings: () => fetchApi('/market/my-listings'),
    createMarketListing: (data: any) => fetchApi('/market/listings', { method: 'POST', body: JSON.stringify(data) }),
    buyMarketListing: (listingId: number) => fetchApi('/market/buy', { method: 'POST', body: JSON.stringify({ listingId }) }),
    bidOnMarketListing: (listingId: number, amount: number) => fetchApi('/market/bid', { method: 'POST', body: JSON.stringify({ listingId, amount }) }),
    cancelMarketListing: (id: number) => fetchApi(`/market/listings/${id}/cancel`, { method: 'POST' }),
    claimMarketListing: (id: number) => fetchApi(`/market/listings/${id}/claim`, { method: 'POST' }),
    claimMarketReturn: (messageId: number) => fetchApi(`/messages/claim-return/${messageId}`, { method: 'POST' }),

    // Quests
    acceptQuest: (questId: string) => fetchApi('/quests/accept', { method: 'POST', body: JSON.stringify({ questId }) }),
    completeQuest: (questId: string) => fetchApi('/quests/complete', { method: 'POST', body: JSON.stringify({ questId }) }),
    
    // Guilds
    getGuildList: () => fetchApi('/guilds/list'),
    createGuild: (name: string, tag: string, description: string) => fetchApi('/guilds/create', { method: 'POST', body: JSON.stringify({ name, tag, description }) }),
    joinGuild: (guildId: number) => fetchApi(`/guilds/join/${guildId}`, { method: 'POST' }),
    leaveGuild: () => fetchApi('/guilds/leave', { method: 'POST' }),
    getMyGuild: (): Promise<Guild | null> => fetchApi('/guilds/my-guild'),
    getGuildProfile: (id: number): Promise<PublicGuildProfile> => fetchApi(`/guilds/profile/${id}`),
    getGuildArmory: () => fetchApi('/guilds/armory'),
    depositToArmory: (itemId: string) => fetchApi('/guilds/armory/deposit', { method: 'POST', body: JSON.stringify({ itemId }) }),
    borrowFromArmory: (armoryId: number) => fetchApi('/guilds/armory/borrow', { method: 'POST', body: JSON.stringify({ armoryId }) }),
    recallFromMember: (targetUserId: number, itemUniqueId: string) => fetchApi('/guilds/armory/recall', { method: 'POST', body: JSON.stringify({ targetUserId, itemUniqueId }) }),
    deleteFromArmory: (armoryId: number) => fetchApi(`/guilds/armory/${armoryId}`, { method: 'DELETE' }),
    manageGuildMember: (targetUserId: number, action: 'kick' | 'promote' | 'demote') => fetchApi('/guilds/manage-member', { method: 'POST', body: JSON.stringify({ targetUserId, action }) }),
    inviteToGuild: (characterName: string) => fetchApi('/guilds/invite', { method: 'POST', body: JSON.stringify({ characterName }) }),
    acceptGuildInvite: (messageId: number) => fetchApi('/guilds/accept-invite', { method: 'POST', body: JSON.stringify({ messageId }) }),
    rejectGuildInvite: (messageId: number) => fetchApi('/guilds/reject-invite', { method: 'POST', body: JSON.stringify({ messageId }) }),
    upgradeGuildBuilding: (buildingType: string) => fetchApi('/guilds/upgrade-building', { method: 'POST', body: JSON.stringify({ buildingType }) }),
    guildBankTransaction: (type: string, currency: string, amount: number) => fetchApi('/guilds/bank', { method: 'POST', body: JSON.stringify({ type, currency, amount }) }),
    getGuildRanking: () => fetchApi('/ranking/guilds'),
    performAltarSacrifice: (ritualId: number) => fetchApi('/guilds/altar/sacrifice', { method: 'POST', body: JSON.stringify({ ritualId }) }),
    
    // Hunting
    getHuntingParties: () => fetchApi('/hunting/parties'),
    createParty: (bossId: string, maxMembers: number) => fetchApi('/hunting/create', { method: 'POST', body: JSON.stringify({ bossId, maxMembers }) }),
    joinParty: (partyId: number) => fetchApi(`/hunting/join/${partyId}`, { method: 'POST' }),
    getMyParty: () => fetchApi('/hunting/my-party'),
    leaveParty: () => fetchApi('/hunting/leave', { method: 'POST' }),
    respondToJoinRequest: (userId: number, action: string) => fetchApi('/hunting/respond', { method: 'POST', body: JSON.stringify({ userId, action }) }),
    startParty: () => fetchApi('/hunting/start', { method: 'POST' }),
    cancelParty: () => fetchApi('/hunting/cancel', { method: 'POST' }),
    resetHuntingParties: () => fetchApi('/admin/hunting/reset', { method: 'POST' }),

    // Admin
    getUsers: () => fetchApi('/admin/users'),
    getAllCharacters: () => fetchApi('/admin/characters/all'),
    deleteUser: (id: number) => fetchApi(`/admin/users/${id}`, { method: 'DELETE' }),
    deleteCharacter: (id: number) => fetchApi(`/admin/characters/${id}`, { method: 'DELETE' }),
    resetCharacterStats: (id: number) => fetchApi(`/admin/characters/${id}/reset-stats`, { method: 'POST' }),
    resetCharacterProgress: (id: number) => fetchApi(`/admin/characters/${id}/reset-progress`, { method: 'POST' }),
    adminHealCharacter: (id: number) => fetchApi(`/admin/characters/${id}/heal`, { method: 'POST' }),
    updateCharacterGold: (id: number, gold: number) => fetchApi(`/admin/character/${id}/update-gold`, { method: 'POST', body: JSON.stringify({ gold }) }),
    updateCharacterDetails: (id: number, data: { name?: string, race?: string, characterClass?: string, level?: number }) => fetchApi(`/admin/character/${id}/update-details`, { method: 'POST', body: JSON.stringify(data) }),
    regenerateCharacterEnergy: (id: number) => fetchApi(`/admin/characters/${id}/regenerate-energy`, { method: 'POST' }),
    changeUserPassword: (id: number, newPass: string) => fetchApi(`/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ newPassword: newPass }) }),
    inspectCharacter: (id: number) => fetchApi(`/admin/characters/${id}/inspect`),
    deleteCharacterItem: (userId: number, itemUniqueId: string) => fetchApi(`/admin/characters/${userId}/items/${itemUniqueId}`, { method: 'DELETE' }),
    adminGiveItem: (userId: number, data: any) => fetchApi('/admin/give-item', { method: 'POST', body: JSON.stringify({ userId, ...data }) }),
    findItemById: (uniqueId: string) => fetchApi(`/admin/find-item/${uniqueId}`),
    runDuplicationAudit: () => fetchApi('/admin/audit/duplicates'),
    resolveDuplications: () => fetchApi('/admin/resolve-duplicates', { method: 'POST' }),
    runOrphanAudit: () => fetchApi('/admin/audit/orphans'),
    resolveOrphans: () => fetchApi('/admin/resolve-orphans', { method: 'POST' }),
    runCharacterDataAudit: () => fetchApi('/admin/audit/fix-characters', { method: 'POST' }),
    runGoldAudit: () => fetchApi('/admin/audit/fix-gold', { method: 'POST' }),
    runValuesAudit: () => fetchApi('/admin/audit/fix-values', { method: 'POST' }),
    runAttributesAudit: () => fetchApi('/admin/audit/fix-attributes', { method: 'POST' }),
    wipeGameData: () => fetchApi('/admin/wipe-game-data', { method: 'POST' }),
    getDbTables: () => fetchApi('/admin/db/tables'),
    getDbTableData: (table: string, page: number, limit: number) => fetchApi(`/admin/db/table/${table}?page=${page}&limit=${limit}`),
    updateDbRow: (table: string, data: any) => fetchApi(`/admin/db/table/${table}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDbRow: (table: string, primaryKeyValue: any) => fetchApi(`/admin/db/table/${table}`, { method: 'DELETE', body: JSON.stringify({ primaryKeyValue }) }),
    softResetCharacter: (id: number) => fetchApi(`/admin/characters/${id}/soft-reset`, { method: 'POST' }),
};