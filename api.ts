
import { PlayerCharacter, Location, Expedition, Enemy, Race, CharacterStats, Tab, GameData, RankingPlayer, GameSettings, User, AdminCharacterInfo, EquipmentSlot, ItemTemplate, ItemInstance, Message, PvpRewardSummary, ExpeditionRewardSummary, TavernMessage, Affix, MarketListing, ListingType, CurrencyType, DuplicationAuditResult, CharacterClass, EssenceType, Language, OrphanAuditResult, ItemSearchResult, TraderInventoryData, HuntingParty } from './types';

// Helper to determine API URL based on environment
const getApiBaseUrl = () => {
    // Check if running on typical dev port 3000 (Vite) or 8000 (esbuild)
    if (typeof window !== 'undefined') {
        if (window.location.port === '8000' || window.location.port === '3000') {
            return 'http://localhost:3001/api';
        }
    }
    return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Helper to get the token from localStorage
const getAuthToken = (): string | null => {
    return localStorage.getItem('token');
};

// Centralized fetch logic with timeout
const fetchApi = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const token = getAuthToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // If body is FormData (for file uploads), remove Content-Type so browser sets it with boundary
    if (options.body instanceof FormData) {
        delete (headers as any)['Content-Type'];
    }
    
    const controller = new AbortController();
    // Shorter timeout (8s) to fail fast if server is dead or token is stuck
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const config: RequestInit = {
        ...options,
        headers,
        signal: controller.signal,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred.' }));
            console.error(`Fetch failed for ${endpoint}:`, response.status, errorData); // Log specific failure
            // Map backend credential errors to more user-friendly messages
            if (response.status === 401 && errorData.message === 'Invalid credentials.') {
                 throw new Error('Invalid username or password.');
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error('Invalid token');
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const json = await response.json();
            return json; // Return exactly what was parsed, even if null
        }
        
        // If we get HTML text (like index.html fallback from SPA), it means the API route is missing or server is misconfigured
        if (contentType && contentType.includes("text/html")) {
             console.error(`API Error: Received HTML instead of JSON for ${endpoint}. Base URL: ${API_BASE_URL}. This usually means the backend is unreachable or the route is 404.`);
             throw new Error("Server returned HTML instead of JSON. Check API configuration.");
        }

        return null; // Return null for empty/non-json successful responses instead of empty object
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`API Error [${endpoint}]:`, error);
        if ((error as Error).name === 'AbortError') {
             throw new Error('Request timed out. Server is slow or unreachable.');
        }
        throw error;
    }
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
        return fetchApi('/auth/session/heartbeat', {
            method: 'POST',
        });
    },

    // --- Character Management ---
    async getCharacter(): Promise<PlayerCharacter> {
        return fetchApi('/character');
    },

    async completeExpedition(): Promise<{ updatedCharacter: PlayerCharacter, summary: ExpeditionRewardSummary, messageId: number }> {
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
            learnedSkills: [],
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

    async learnSkill(skillId: string): Promise<PlayerCharacter> {
        return fetchApi('/character/learn-skill', {
            method: 'POST',
            body: JSON.stringify({ skillId }),
        });
    },

    async completeQuest(questId: string): Promise<PlayerCharacter> {
        return fetchApi('/character/complete-quest', {
            method: 'POST',
            body: JSON.stringify({ questId }),
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

    // Use this for Admin actions on other users
    async adminHealCharacter(userId: number): Promise<void> {
        return fetchApi(`/admin/characters/${userId}/heal`, { method: 'POST' });
    },

    // Use this for Player self-healing
    async healCharacter(userId?: number): Promise<void> {
         if (userId) {
             // If userId is provided, it might be legacy code or admin panel usage.
             // For simplicity in this refactor, we route explicit ID calls to the admin endpoint.
             return fetchApi(`/admin/characters/${userId}/heal`, { method: 'POST' });
         }
         // If no ID, it's a self-heal action.
         return fetchApi('/character/heal', { method: 'POST' });
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
    async getTraderInventory(forceRefresh = false): Promise<TraderInventoryData> {
        return fetchApi(`/trader/inventory${forceRefresh ? '?force=true' : ''}`);
    },
    
    async buyItem(itemId: string): Promise<PlayerCharacter> {
        return fetchApi('/trader/buy', {
            method: 'POST',
            body: JSON.stringify({ itemId }),
        });
    },

    async buyMysteriousItem(): Promise<PlayerCharacter> {
        return fetchApi('/trader/buy-mysterious', {
            method: 'POST',
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
    async getTavernMessages(): Promise<{ messages: TavernMessage[], activeUsers: string[] }> {
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

    // --- Hunting (New) ---
    async getHuntingParties(): Promise<any[]> {
        return fetchApi('/hunting/parties');
    },

    async getMyParty(): Promise<{ party: HuntingParty | null, serverTime: string }> {
        return fetchApi('/hunting/my-party');
    },

    async createParty(bossId: string, maxMembers: number): Promise<void> {
        return fetchApi('/hunting/create', {
            method: 'POST',
            body: JSON.stringify({ bossId, maxMembers })
        });
    },

    async joinParty(partyId: number): Promise<void> {
        return fetchApi(`/hunting/join/${partyId}`, {
            method: 'POST'
        });
    },

    async respondToJoinRequest(userId: number, action: 'accept' | 'reject' | 'kick'): Promise<void> {
        return fetchApi('/hunting/respond', {
            method: 'POST',
            body: JSON.stringify({ userId, action })
        });
    },

    async leaveParty(): Promise<void> {
        return fetchApi('/hunting/leave', {
            method: 'POST'
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
    
    async resetHuntingParties(): Promise<void> {
        return fetchApi('/admin/hunting/reset', {
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

    async runCharacterDataAudit(): Promise<{ checked: number, fixed: number }> {
        return fetchApi('/admin/audit/fix-characters', {
            method: 'POST',
        });
    },

    async runGoldAudit(): Promise<{ checked: number, fixed: number }> {
        return fetchApi('/admin/audit/fix-gold', {
            method: 'POST',
        });
    },
    
    async runValuesAudit(): Promise<{ itemsChecked: number, itemsFixed: number, affixesChecked: number, affixesFixed: number }> {
        return fetchApi('/admin/audit/fix-values', {
            method: 'POST',
        });
    },

    async wipeGameData(): Promise<{ message: string }> {
        return fetchApi('/admin/wipe-game-data', {
            method: 'POST',
        });
    },
    
    // DB Editor
    async getDbTables(): Promise<string[]> {
        return fetchApi('/admin/db/tables');
    },

    async getDbTableData(tableName: string, page: number, limit: number): Promise<{ rows: any[], total: number }> {
        return fetchApi(`/admin/db/table/${tableName}?page=${page}&limit=${limit}`);
    },

    async updateDbRow(tableName: string, rowData: any): Promise<void> {
        return fetchApi(`/admin/db/table/${tableName}`, {
            method: 'PUT',
            body: JSON.stringify(rowData),
        });
    },

    async deleteDbRow(tableName: string, primaryKeyValue: any): Promise<void> {
        return fetchApi(`/admin/db/table/${tableName}`, {
            method: 'DELETE',
            body: JSON.stringify({ primaryKeyValue }),
        });
    },
};
