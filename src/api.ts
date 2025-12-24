
import { CharacterStats, Race, CharacterClass, EssenceType, EquipmentSlot, ItemRarity, RaidType } from './types';

const API_URL = '/api';

export const getAuthToken = () => localStorage.getItem('token');

const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/'; 
    throw new Error('Invalid token');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `API Error: ${response.statusText}`);
  }

  if (response.status === 204) return null;

  return response.json();
};

let serverTimeOffset = 0;

export const api = {
    getAuthToken,
    getServerTime: () => Date.now() + serverTimeOffset,
    synchronizeTime: async () => {
        try {
            const start = Date.now();
            const { time } = await fetchApi('/time');
            const end = Date.now();
            const latency = (end - start) / 2;
            
            // Obliczamy różnicę między czasem serwera a lokalnym, uwzględniając opóźnienie sieci.
            // Nie dodajemy ręcznie przesunięć stref czasowych, bo Date() obsłuży to przy wyświetlaniu.
            serverTimeOffset = time - (Date.now() - latency);
            
            return serverTimeOffset;
        } catch { return 0; }
    },
    
    // Auth
    register: (data: any) => fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: any) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (email: string) => fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, newPassword: string) => fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
    changePassword: (oldPassword: string, newPassword: string) => fetchApi('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
    logout: (token: string) => fetchApi('/auth/logout', { method: 'POST' }),
    sendHeartbeat: () => fetchApi('/auth/session/heartbeat', { method: 'POST' }),

    // Game Data
    getGameData: () => fetchApi('/game-data'),
    updateGameData: (key: string, data: any) => fetchApi('/game-data', { method: 'PUT', body: JSON.stringify({ key, data }) }),
    updateGameSettings: (settings: any) => fetchApi('/game-data', { method: 'PUT', body: JSON.stringify({ key: 'settings', data: settings }) }),

    // Character
    getCharacter: () => fetchApi('/character'),
    createCharacter: (name: string, race: Race, startLocationId: string) => fetchApi('/character', { method: 'POST', body: JSON.stringify({ name, race, startLocationId }) }),
    updateCharacter: (data: any) => fetchApi('/character/update-profile', { method: 'POST', body: JSON.stringify(data) }),
    equipItem: (itemId: string) => fetchApi('/character/equip', { method: 'POST', body: JSON.stringify({ itemId }) }),
    unequipItem: (slot: string) => fetchApi('/character/unequip', { method: 'POST', body: JSON.stringify({ slot }) }),
    
    // Loadouts
    saveLoadout: (loadoutId: number, name?: string) => fetchApi('/character/loadouts/save', { method: 'POST', body: JSON.stringify({ loadoutId, name }) }),
    loadLoadout: (loadoutId: number) => fetchApi('/character/loadouts/load', { method: 'POST', body: JSON.stringify({ loadoutId }) }),
    renameLoadout: (loadoutId: number, name: string) => fetchApi('/character/loadouts/rename', { method: 'PUT', body: JSON.stringify({ loadoutId, name }) }),

    upgradeCamp: () => fetchApi('/character/camp/upgrade', { method: 'POST' }),
    
    // Treasury & Warehouse (Fixed paths with /storage prefix)
    upgradeChest: () => fetchApi('/character/storage/treasury/upgrade', { method: 'POST' }),
    chestDeposit: (amount: number) => fetchApi('/character/storage/treasury/deposit', { method: 'POST', body: JSON.stringify({ amount }) }),
    chestWithdraw: (amount: number) => fetchApi('/character/storage/treasury/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
    
    upgradeWarehouse: () => fetchApi('/character/storage/warehouse/upgrade', { method: 'POST' }),
    warehouseDeposit: (itemId: string) => fetchApi('/character/storage/warehouse/deposit', { method: 'POST', body: JSON.stringify({ itemId }) }),
    warehouseWithdraw: (itemId: string) => fetchApi('/character/storage/warehouse/withdraw', { method: 'POST', body: JSON.stringify({ itemId }) }),
    
    upgradeBackpack: () => fetchApi('/character/camp/backpack-upgrade', { method: 'POST' }),
    healCharacter: () => fetchApi('/character/camp/heal', { method: 'POST' }),

    distributeStatPoints: (stats: Partial<CharacterStats>) => fetchApi('/character/stats', { method: 'POST', body: JSON.stringify({ stats }) }),
    resetAttributes: () => fetchApi('/character/reset-stats', { method: 'POST' }),
    
    learnSkill: (skillId: string) => fetchApi('/character/skills/learn', { method: 'POST', body: JSON.stringify({ skillId }) }),
    completeLearningSkill: () => fetchApi('/character/skills/complete-learning', { method: 'POST' }),
    toggleSkill: (skillId: string, isActive: boolean) => fetchApi('/character/skills/toggle', { method: 'POST', body: JSON.stringify({ skillId, isActive }) }),
    selectClass: (characterClass: CharacterClass) => fetchApi('/character/class', { method: 'POST', body: JSON.stringify({ characterClass }) }),
    convertEssence: (fromType: EssenceType) => fetchApi('/character/skills/convert-essence', { method: 'POST', body: JSON.stringify({ fromType }) }),

    startTravel: (destinationLocationId: string) => fetchApi('/character/travel/start', { method: 'POST', body: JSON.stringify({ destinationLocationId }) }),
    completeTravel: () => fetchApi('/character/travel/complete', { method: 'POST' }),
    getCharacterNames: () => fetchApi('/character/names'),

    // Expedition
    startExpedition: (expeditionId: string) => fetchApi('/expedition/start', { method: 'POST', body: JSON.stringify({ expeditionId }) }),
    completeExpedition: () => fetchApi('/expedition/complete', { method: 'POST' }),
    cancelExpedition: () => fetchApi('/expedition/cancel', { method: 'POST' }),

    // PvP
    attackPlayer: (defenderId: number) => fetchApi(`/pvp/attack/${defenderId}`, { method: 'POST' }),
    spyOnPlayer: (defenderId: number) => fetchApi(`/espionage/${defenderId}`, { method: 'POST' }),
    
    // Ranking
    getRanking: () => fetchApi('/ranking'),
    getGuildRanking: () => fetchApi('/ranking/guilds'),
    getCharacterProfile: (name: string) => fetchApi(`/public/profile/${name}`),

    // Trader & Blacksmith
    getTraderInventory: (force = false) => fetchApi(`/trader/inventory?force=${force}`),
    buyItem: (itemId: string) => fetchApi('/trader/buy', { method: 'POST', body: JSON.stringify({ itemId }) }),
    buySpecialItem: (itemId: string) => fetchApi('/trader/buy-special', { method: 'POST', body: JSON.stringify({ itemId }) }),
    sellItems: (itemIds: string[]) => fetchApi('/trader/sell', { method: 'POST', body: JSON.stringify({ itemIds }) }),
    disenchantItem: (itemId: string) => fetchApi('/blacksmith/disenchant', { method: 'POST', body: JSON.stringify({ itemId }) }),
    upgradeItem: (itemId: string) => fetchApi('/blacksmith/upgrade', { method: 'POST', body: JSON.stringify({ itemId }) }),
    
    // Workshop (NEW)
    upgradeWorkshop: () => fetchApi('/workshop/upgrade', { method: 'POST' }),
    craftItem: (slot: EquipmentSlot | 'ring' | 'consumable', rarity: ItemRarity) => fetchApi('/workshop/craft', { method: 'POST', body: JSON.stringify({ slot, rarity }) }),
    reforgeItem: (itemId: string, type: 'values' | 'affixes') => fetchApi('/workshop/reforge', { method: 'POST', body: JSON.stringify({ itemId, type }) }),

    // Messages
    getMessages: () => fetchApi('/messages'),
    getUnreadMessagesStatus: () => fetchApi('/messages/status/unread').then((res: any) => res.hasUnread),
    sendMessage: (data: { recipientName: string, subject: string, content: string }) => fetchApi('/messages', { method: 'POST', body: JSON.stringify(data) }),
    deleteMessage: (id: number) => fetchApi(`/messages/${id}`, { method: 'DELETE' }),
    markMessageAsRead: (id: number) => fetchApi(`/messages/${id}`, { method: 'PUT' }),
    toggleMessageSaved: (id: number) => fetchApi(`/messages/${id}/save`, { method: 'PUT' }),
    deleteBulkMessages: (type: string) => fetchApi('/messages/bulk-delete', { method: 'POST', body: JSON.stringify({ type }) }),
    
    // Tavern
    getTavernMessages: () => fetchApi('/tavern/messages'),
    sendTavernMessage: (content: string) => fetchApi('/tavern/messages', { method: 'POST', body: JSON.stringify({ content }) }),

    // Market
    getMarketListings: () => fetchApi('/market/listings'),
    getMyMarketListings: () => fetchApi('/market/my-listings'),
    createMarketListing: (data: any) => fetchApi('/market/listings', { method: 'POST', body: JSON.stringify(data) }),
    buyMarketListing: (listingId: number) => fetchApi('/market/buy', { method: 'POST', body: JSON.stringify({ listingId }) }),
    bidOnMarketListing: (listingId: number, amount: number) => fetchApi('/market/bid', { method: 'POST', body: JSON.stringify({ listingId, amount }) }),
    cancelMarketListing: (listingId: number) => fetchApi(`/market/listings/${listingId}/cancel`, { method: 'POST' }),
    claimMarketListing: (listingId: number) => fetchApi(`/market/listings/${listingId}/claim`, { method: 'POST' }),
    claimMarketReturn: (messageId: number) => fetchApi(`/messages/claim-return/${messageId}`, { method: 'POST' }),

    // Quests
    acceptQuest: (questId: string) => fetchApi('/quests/accept', { method: 'POST', body: JSON.stringify({ questId }) }),
    completeQuest: (questId: string) => fetchApi('/quests/complete', { method: 'POST', body: JSON.stringify({ questId }) }),

    // Guilds
    getGuildList: () => fetchApi('/guilds/list'),
    getMyGuild: () => fetchApi('/guilds/my-guild'),
    createGuild: (name: string, tag: string, description: string) => fetchApi('/guilds/create', { method: 'POST', body: JSON.stringify({ name, tag, description }) }),
    joinGuild: (id: number) => fetchApi(`/guilds/join/${id}`, { method: 'POST' }),
    leaveGuild: () => fetchApi('/guilds/leave', { method: 'POST' }),
    updateGuild: (data: any) => fetchApi('/guilds/update', { method: 'POST', body: JSON.stringify(data) }),
    manageGuildMember: (targetUserId: number, action: string) => fetchApi('/guilds/manage-member', { method: 'POST', body: JSON.stringify({ targetUserId, action }) }),
    upgradeGuildBuilding: (buildingType: string) => fetchApi('/guilds/upgrade-building', { method: 'POST', body: JSON.stringify({ buildingType }) }),
    getGuildArmory: () => fetchApi('/guilds/armory'),
    depositToArmory: (itemId: string) => fetchApi('/guilds/armory/deposit', { method: 'POST', body: JSON.stringify({ itemId }) }),
    borrowFromArmory: (armoryId: number) => fetchApi('/guilds/armory/borrow', { method: 'POST', body: JSON.stringify({ armoryId }) }),
    recallFromMember: (targetUserId: number, itemUniqueId: string) => fetchApi('/guilds/armory/recall', { method: 'POST', body: JSON.stringify({ targetUserId, itemUniqueId }) }),
    deleteFromArmory: (armoryId: number) => fetchApi(`/guilds/armory/${armoryId}`, { method: 'DELETE' }),
    guildBankTransaction: (type: string, currency: string, amount: number) => fetchApi('/guilds/bank', { method: 'POST', body: JSON.stringify({ type, currency, amount }) }),
    performAltarSacrifice: (ritualId: string) => fetchApi('/guilds/altar/sacrifice', { method: 'POST', body: JSON.stringify({ ritualId }) }),
    acceptGuildInvite: (messageId: number) => fetchApi('/guilds/accept-invite', { method: 'POST', body: JSON.stringify({ messageId }) }),
    rejectGuildInvite: (messageId: number) => fetchApi('/guilds/reject-invite', { method: 'POST', body: JSON.stringify({ messageId }) }),
    getGuildProfile: (id: number) => fetchApi(`/guilds/profile/${id}`),
    
    // Guild Espionage
    getEspionage: () => fetchApi('/guilds/espionage'),
    startEspionage: (targetGuildId: number) => fetchApi('/guilds/espionage/start', { method: 'POST', body: JSON.stringify({ targetGuildId }) }),
    getGuildTargets: () => fetchApi('/guilds/targets'), 

    // Guild Raids
    getRaids: () => fetchApi('/guilds/raids'),
    createRaid: (targetGuildId: number, raidType: RaidType) => fetchApi('/guilds/raids/create', { method: 'POST', body: JSON.stringify({ targetGuildId, raidType }) }),
    joinRaid: (raidId: number) => fetchApi('/guilds/raids/join', { method: 'POST', body: JSON.stringify({ raidId }) }),

    // Towers
    getTowers: () => fetchApi('/towers'),
    startTower: (towerId: string) => fetchApi('/towers/start', { method: 'POST', body: JSON.stringify({ towerId }) }),
    fightTower: () => fetchApi('/towers/fight', { method: 'POST' }),
    retreatTower: () => fetchApi('/towers/retreat', { method: 'POST' }),
    
    // Hunting
    getHuntingParties: () => fetchApi('/hunting/parties'),
    getGuildHuntingParties: () => fetchApi('/hunting/guild-parties'),
    createParty: (bossId: string, maxMembers: number, isGuildParty: boolean, autoJoin: boolean) => fetchApi('/hunting/create', { method: 'POST', body: JSON.stringify({ bossId, maxMembers, isGuildParty, autoJoin }) }),
    joinParty: (partyId: number) => fetchApi(`/hunting/join/${partyId}`, { method: 'POST' }),
    getMyParty: () => fetchApi('/hunting/my-party'),
    leaveParty: () => fetchApi('/hunting/leave', { method: 'POST' }),
    respondToJoinRequest: (userId: number, action: string) => fetchApi('/hunting/respond', { method: 'POST', body: JSON.stringify({ userId, action }) }),
    startParty: () => fetchApi('/hunting/start', { method: 'POST' }),
    cancelParty: () => fetchApi('/hunting/cancel', { method: 'POST' }),
    resetHuntingParties: () => fetchApi('/hunting/reset', { method: 'POST' }), 

    // Admin
    sendGlobalMessage: (data: any) => fetchApi('/admin/global-message', { method: 'POST', body: JSON.stringify(data) }),
    adminGetGuilds: () => fetchApi('/admin/guilds'),
    adminUpdateGuildBuildings: (guildId: number, buildings: any) => fetchApi(`/admin/guilds/${guildId}/buildings`, { method: 'PUT', body: JSON.stringify({ buildings }) }),
    getAllCharacters: () => fetchApi('/admin/characters/all'),
    adminHealCharacter: (id: number) => fetchApi(`/admin/characters/${id}/heal`, { method: 'POST' }),
    regenerateCharacterEnergy: (id: number) => fetchApi(`/admin/characters/${id}/regenerate-energy`, { method: 'POST' }),
    resetCharacterStats: (id: number) => fetchApi(`/admin/characters/${id}/reset-stats`, { method: 'POST' }),
    resetCharacterProgress: (id: number) => fetchApi(`/admin/characters/${id}/reset-progress`, { method: 'POST' }),
    deleteCharacter: (id: number) => fetchApi(`/admin/characters/${id}`, { method: 'DELETE' }),
    updateCharacterDetails: (id: number, data: any) => fetchApi(`/admin/character/${id}/update-details`, { method: 'POST', body: JSON.stringify(data) }),
    changeUserPassword: (id: number, newPassword: string) => fetchApi(`/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    inspectCharacter: (id: number) => fetchApi(`/admin/characters/${id}/inspect`),
    deleteCharacterItem: (userId: number, uniqueId: string) => fetchApi(`/admin/characters/${userId}/items/${uniqueId}`, { method: 'DELETE' }),
    updateCharacterGold: (id: number, gold: number) => fetchApi(`/admin/character/${id}/update-gold`, { method: 'POST', body: JSON.stringify({ gold }) }),
    findItemById: (id: string) => fetchApi(`/admin/items/find/${id}`),
    runAttributesAudit: () => fetchApi('/admin/audit/fix-attributes', { method: 'POST' }),
    runCharacterDataAudit: () => fetchApi('/admin/audit/fix-characters', { method: 'POST' }),
    runGoldAudit: () => fetchApi('/admin/audit/fix-gold', { method: 'POST' }),
    runValuesAudit: () => fetchApi('/admin/audit/fix-values', { method: 'POST' }),
    runDuplicationAudit: () => fetchApi('/admin/audit/duplicates'),
    resolveDuplications: () => fetchApi('/admin/resolve-duplicates', { method: 'POST' }),
    runOrphanAudit: () => fetchApi('/admin/audit/orphans'),
    resolveOrphans: () => fetchApi('/admin/resolve-orphans', { method: 'POST' }),
    wipeGameData: () => fetchApi('/admin/wipe-game-data', { method: 'POST' }),
    resetAllPvpCooldowns: () => fetchApi('/admin/pvp/reset-cooldowns', { method: 'POST' }),

    // DB Editor
    getDbTables: () => fetchApi('/admin/db/tables'),
    getDbTableData: (table: string, page: number, limit: number) => fetchApi(`/admin/db/table/${table}?page=${page}&limit=${limit}`),
    updateDbRow: (table: string, row: any) => fetchApi(`/admin/db/table/${table}`, { method: 'PUT', body: JSON.stringify(row) }),
    deleteDbRow: (table: string, id: any) => fetchApi(`/admin/db/table/${table}/${id}`, { method: 'DELETE' }),
    
    softResetCharacter: (id: number) => fetchApi(`/admin/characters/${id}/soft-reset`, { method: 'POST' }),
    adminGiveItem: (userId: number, itemData: any) => fetchApi('/admin/give-item', { method: 'POST', body: JSON.stringify({ userId, ...itemData }) }),
};
