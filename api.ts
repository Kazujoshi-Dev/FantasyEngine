import { PlayerCharacter, Location, Expedition, Enemy, Race, CharacterStats, Tab, GameData, RankingPlayer, GameSettings, User, AdminCharacterInfo, EquipmentSlot, ItemTemplate, ItemInstance, Message, PvpRewardSummary, ExpeditionRewardSummary, TavernMessage, Affix, MarketListing, ListingType, CurrencyType, DuplicationAuditResult, CharacterClass, EssenceType, Language, OrphanAuditResult, ItemSearchResult } from './types';

const API_BASE_URL = '/api';

// Helper to get the token from localStorage
const getAuthToken = (): string | null => {
    return localStorage.getItem('token');
};

// Centralized fetch logic
const fetchApi = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const token = getAuthToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred.' }));
        // Map backend credential errors to more user-friendly messages
        if (response.status === 401 && errorData.message === 'Invalid credentials.') {
             throw new Error('Invalid username or password.');
        }
        if (response.status === 401 || response.status === 403) {
            throw new Error('Invalid token');
        }
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    // Handle responses that might not have a body (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    }
    return {};
};


export const api = {
    // --- Authentication ---
    async register(credentials: { username: string, password?: string }): Promise<void> {
        return fetchApi('/auth/register', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    },

    async login(credentials: { username: string, password?: string }): Promise<{ token: string }> {
        return fetchApi('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    },

    async logout(token: string): Promise<void> {
        return fetchApi('/auth/logout', {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${token}` }
        });
    },

    async sendHeartbeat(): Promise<void> {
        return fetchApi('/session/heartbeat', {
            method: 'POST',
        });
    },

    // --- Character Management ---
    async getCharacter(): Promise<PlayerCharacter> {
        return fetchApi('/character');
    },

    async completeExpedition(): Promise<{ updatedCharacter: PlayerCharacter, summary: ExpeditionRewardSummary }> {
        return fetchApi('/character/complete-expedition', {
            method: 'POST',
        });
    },
    
    async createCharacter(name: string, race: Race, startLocationId: string): Promise<PlayerCharacter> {
        const initialStats: CharacterStats = {
          strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0,
          statPoints: 10,
          currentHealth: 50, maxHealth: 50, currentEnergy: 10, maxEnergy: 10,
          currentMana: 20, maxMana: 20,
          minDamage: 0, maxDamage: 0,
          magicDamageMin: 0, magicDamageMax: 0,
          critChance: 0,
          critDamageModifier: 200,
          armor: 0,
          armorPenetrationPercent: 0,
          armorPenetrationFlat: 0,
          attacksPerRound: 1,
          manaRegen: 0,
          lifeStealPercent: 0,
          lifeStealFlat: 0,
          manaStealPercent: 0,
          manaStealFlat: 0,
          dodgeChance: 0,
        };
        
        const now = Date.now();
        // Align the initial timestamp to the beginning of the current hour.
        const lastFullHourTimestamp = Math.floor(now / (1000 * 60 * 60)) * (1000 * 60 * 60);

        const newCharacterData: Omit<PlayerCharacter, 'username' | 'id'> = {
            name,
            race,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            stats: initialStats,
            resources: { 
                gold: 50,
                commonEssence: 0,
                uncommonEssence: 0,
                rareEssence: 0,
                epicEssence: 0,
                legendaryEssence: 0,
            },
            currentLocationId: startLocationId,
            activeExpedition: null,
            activeTravel: null,
            camp: { level: 1 },
            chest: { level: 1, gold: 0 },
            backpack: { level: 1 },
            isResting: false,
            restStartHealth: 0,
            lastEnergyUpdateTime: lastFullHourTimestamp,
            equipment: {
                [EquipmentSlot.Head]: null,
                [EquipmentSlot.Chest]: null,
                [EquipmentSlot.Legs]: null,
                [EquipmentSlot.Feet]: null,
                [EquipmentSlot.Hands]: null,
                [EquipmentSlot.Waist]: null,
                [EquipmentSlot.Neck]: null,
                [EquipmentSlot.Ring1]: null,
                [EquipmentSlot.Ring2]: null,
                [EquipmentSlot.MainHand]: null,
                [EquipmentSlot.OffHand]: null,
                [EquipmentSlot.TwoHand]: null,
            },
            inventory: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0,
            questProgress: [],
            acceptedQuests: [],
            freeStatResetUsed: false,
            settings: { language: Language.PL },
        };

        return fetchApi('/character', {
            method: 'POST',
            body: JSON.stringify(newCharacterData),
        });
    },

    async updateCharacter(character: PlayerCharacter): Promise<PlayerCharacter> {
        return fetchApi('/character', {
            method: 'PUT',
            body: JSON.stringify(character),
        });
    },

    async selectClass(characterClass: CharacterClass): Promise<PlayerCharacter> {
        return fetchApi('/character/select-class', {
            method: 'POST',
            body: JSON.stringify({ characterClass }),
        });
    },

    async getAllCharacters(): Promise<AdminCharacterInfo[]> {
        return fetchApi('/admin/characters/all');
    },

    async getCharacterNames(): Promise<string[]> {
        return fetchApi('/characters/names');
    },

    async deleteCharacter(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}`, {
            method: 'DELETE',
        });
    },

    async resetCharacterStats(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/reset-stats`, { method: 'POST' });
    },

    async healCharacter(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/heal`, { method: 'POST' });
    },

    async updateCharacterGold(userId: number, gold: number): Promise<void> {
        return fetchApi(`/admin/character/${userId}/update-gold`, { 
            method: 'POST',
            body: JSON.stringify({ gold }) 
        });
    },
    
    // --- Game Data ---
    async getGameData(): Promise<GameData> {
        return fetchApi('/game-data');
    },
    
    async updateGameData(key: keyof GameData, data: any): Promise<void> {
        return fetchApi(`/game-data`, {
            method: 'PUT',
            body: JSON.stringify({ key, data })
        });
    },

    async updateGameSettings(settings: GameSettings): Promise<void> {
        return fetchApi(`/game-data`, {
            method: 'PUT',
            body: JSON.stringify({ key: 'settings', data: settings })
        });
    },

    // --- Ranking ---
    async getRanking(): Promise<RankingPlayer[]> {
        return fetchApi('/ranking');
    },
    
    // --- Trader ---
    async getTraderInventory(forceRefresh = false): Promise<ItemInstance[]> {
        return fetchApi(`/trader/inventory${forceRefresh ? '?force=true' : ''}`);
    },
    
    async buyItem(itemId: string): Promise<PlayerCharacter> {
        return fetchApi('/trader/buy', {
            method: 'POST',
            body: JSON.stringify({ itemId }),
        });
    },

    async sellItems(itemIds: string[]): Promise<PlayerCharacter> {
        return fetchApi('/trader/sell', {
            method: 'POST',
            body: JSON.stringify({ itemIds }),
        });
    },

    // --- Blacksmith ---
    async disenchantItem(itemId: string): Promise<{ updatedCharacter: PlayerCharacter, result: { success: boolean; amount?: number; essenceType?: EssenceType } }> {
        return fetchApi('/blacksmith/disenchant', {
            method: 'POST',
            body: JSON.stringify({ itemId }),
        });
    },

    async upgradeItem(itemId: string): Promise<{ updatedCharacter: PlayerCharacter, result: { success: boolean; messageKey: string; level?: number } }> {
        return fetchApi('/blacksmith/upgrade', {
            method: 'POST',
            body: JSON.stringify({ itemId }),
        });
    },

    // --- PvP ---
    async attackPlayer(defenderId: number): Promise<{ summary: PvpRewardSummary, updatedAttacker: PlayerCharacter }> {
        return fetchApi(`/pvp/attack/${defenderId}`, {
            method: 'POST',
        });
    },

    // --- Messages ---
    async getMessages(): Promise<Message[]> {
        return fetchApi('/messages');
    },

    async sendMessage(data: { recipientName: string; subject: string; content: string }): Promise<Message> {
        return fetchApi('/messages', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async markMessageAsRead(messageId: number): Promise<void> {
        return fetchApi(`/messages/${messageId}`, {
            method: 'PUT',
        });
    },

    async deleteMessage(messageId: number): Promise<void> {
        return fetchApi(`/messages/${messageId}`, {
            method: 'DELETE',
        });
    },
    
    async claimMarketReturn(messageId: number): Promise<PlayerCharacter> {
        return fetchApi(`/messages/claim-return/${messageId}`, {
            method: 'POST',
        });
    },
    
    async deleteBulkMessages(type: 'read' | 'all' | 'expedition_reports'): Promise<{ deletedCount: number }> {
        return fetchApi('/messages/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ type }),
        });
    },

    // --- Tavern ---
    async getTavernMessages(): Promise<TavernMessage[]> {
        return fetchApi('/tavern/messages');
    },

    async sendTavernMessage(content: string): Promise<TavernMessage> {
        return fetchApi('/tavern/messages', {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    },
    
    // --- Market ---
    async getMarketListings(): Promise<MarketListing[]> {
        return fetchApi('/market/listings');
    },

    async getMyMarketListings(): Promise<MarketListing[]> {
        return fetchApi('/market/my-listings');
    },
    
    async createMarketListing(data: {
        itemId: string;
        listingType: ListingType;
        currency: CurrencyType;
        price: number;
        durationHours: number;
    }): Promise<PlayerCharacter> {
        return fetchApi('/market/listings', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async buyMarketListing(listingId: number): Promise<PlayerCharacter> {
        return fetchApi(`/market/buy`, {
            method: 'POST',
            body: JSON.stringify({ listingId }),
        });
    },

    async bidOnMarketListing(listingId: number, amount: number): Promise<MarketListing> {
        return fetchApi(`/market/bid`, {
            method: 'POST',
            body: JSON.stringify({ listingId, amount }),
        });
    },
    
    async cancelMarketListing(listingId: number): Promise<PlayerCharacter> {
        return fetchApi(`/market/listings/${listingId}/cancel`, {
            method: 'POST',
        });
    },
    
    async claimMarketListing(listingId: number): Promise<PlayerCharacter> {
        return fetchApi(`/market/listings/${listingId}/claim`, {
            method: 'POST',
        });
    },

    // --- Admin ---
    async getUsers(): Promise<User[]> {
        return fetchApi('/admin/users');
    },
    
    async deleteUser(userId: number): Promise<void> {
        return fetchApi(`/admin/users/${userId}`, {
            method: 'DELETE',
        });
    },
    
    async changeUserPassword(userId: number, newPassword: string): Promise<void> {
        return fetchApi(`/admin/users/${userId}/password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword }),
        });
    },

    async regenerateCharacterEnergy(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/regenerate-energy`, { method: 'POST' });
    },

    async inspectCharacter(userId: number): Promise<PlayerCharacter> {
        return fetchApi(`/admin/characters/${userId}/inspect`);
    },

    async deleteCharacterItem(userId: number, itemUniqueId: string): Promise<PlayerCharacter> {
        return fetchApi(`/admin/characters/${userId}/items/${itemUniqueId}`, { method: 'DELETE' });
    },

    async resetAllPvpCooldowns(): Promise<void> {
        return fetchApi('/admin/pvp/reset-cooldowns', {
            method: 'POST',
        });
    },

    async sendGlobalMessage(data: { subject: string; content: string }): Promise<void> {
        return fetchApi('/admin/messages/global', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    
    async runDuplicationAudit(): Promise<DuplicationAuditResult[]> {
        return fetchApi('/admin/audit/duplicates');
    },

    async resolveDuplications(): Promise<{ resolvedSets: number, itemsDeleted: number }> {
        return fetchApi('/admin/resolve-duplicates', { method: 'POST' });
    },

    async runOrphanAudit(): Promise<OrphanAuditResult[]> {
        return fetchApi('/admin/audit/orphans');
    },

    async resolveOrphans(): Promise<{ charactersAffected: number, itemsRemoved: number }> {
        return fetchApi('/admin/resolve-orphans', { method: 'POST' });
    },
    
    async findItemById(uniqueId: string): Promise<ItemSearchResult> {
        return fetchApi(`/admin/find-item/${uniqueId}`);
    },
};