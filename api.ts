import { PlayerCharacter, Location, Expedition, Enemy, Race, CharacterStats, Tab, GameData, RankingPlayer, GameSettings, User, AdminCharacterInfo, EquipmentSlot, ItemTemplate, ItemInstance, Message, PvpRewardSummary, ExpeditionRewardSummary, TavernMessage, Affix } from './types';

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

    // --- Character Management ---
    async getCharacter(): Promise<PlayerCharacter & { expeditionSummary?: ExpeditionRewardSummary }> {
        return fetchApi('/character');
    },
    
    async createCharacter(name: string, race: Race, startLocationId: string): Promise<PlayerCharacter> {
        // FIX: The `initialStats` object was missing properties required by the `CharacterStats` type. Added `armorPenetrationFlat`, `lifeStealFlat`, and `manaStealFlat` to resolve the type error.
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
                // FIX: Added missing TwoHand slot to conform to the EquipmentSlot enum.
                [EquipmentSlot.TwoHand]: null,
            },
            inventory: [],
            pvpWins: 0,
            pvpLosses: 0,
            pvpProtectionUntil: 0,
            questProgress: [],
            acceptedQuests: [],
            freeStatResetUsed: false,
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

    async getAllCharacters(): Promise<AdminCharacterInfo[]> {
        return fetchApi('/characters/all');
    },

    async getCharacterNames(): Promise<string[]> {
        return fetchApi('/characters/names');
    },

    async deleteCharacter(userId: number): Promise<void> {
        return fetchApi(`/characters/${userId}`, {
            method: 'DELETE',
        });
    },

    async resetCharacterStats(userId: number): Promise<void> {
        return fetchApi(`/characters/${userId}/reset-stats`, {
            method: 'POST',
        });
    },

    async healCharacter(userId: number): Promise<void> {
        return fetchApi(`/characters/${userId}/heal`, {
            method: 'POST',
        });
    },
    
    // --- User Management (Admin) ---
    async getUsers(): Promise<User[]> {
        return fetchApi('/users');
    },

    async deleteUser(userId: number): Promise<void> {
        return fetchApi(`/users/${userId}`, {
            method: 'DELETE',
        });
    },
    
    // --- Ranking ---
    async getRanking(): Promise<RankingPlayer[]> {
        return fetchApi('/ranking');
    },

    // --- Game Data Management ---
    async getGameData(): Promise<GameData> {
        // This endpoint is public, so we call fetch directly without auth
        const response = await fetch(`${API_BASE_URL}/game-data`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred fetching game data.' }));
            throw new Error(errorData.message);
        }
        return response.json();
    },

    async updateGameData(key: keyof Omit<GameData, 'settings'>, data: any): Promise<void> {
       return fetchApi('/game-data', {
            method: 'PUT',
            body: JSON.stringify({ key, data }),
       });
    },

    async updateGameSettings(settings: GameSettings): Promise<void> {
        return fetchApi('/game-data', {
            method: 'PUT',
            body: JSON.stringify({ key: 'settings', data: settings }),
        });
    },

    // --- Trader ---
    async getTraderInventory(forceRefresh = false): Promise<ItemInstance[]> {
        const endpoint = forceRefresh ? '/trader/inventory?force=true' : '/trader/inventory';
        return fetchApi(endpoint);
    },
    
    async buyItem(itemId: string): Promise<PlayerCharacter> {
        return fetchApi('/trader/buy', {
            method: 'POST',
            body: JSON.stringify({ itemId }),
        });
    },

    // --- PvP ---
    async attackPlayer(defenderId: number): Promise<PvpRewardSummary> {
        return fetchApi(`/pvp/attack/${defenderId}`, {
            method: 'POST',
        });
    },

    async resetAllPvpCooldowns(): Promise<void> {
        return fetchApi('/admin/pvp/reset-cooldowns', {
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

    async sendGlobalMessage(data: { subject: string; content: string }): Promise<void> {
        return fetchApi('/admin/global-message', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async markMessageAsRead(messageId: number): Promise<void> {
        return fetchApi(`/messages/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_read: true }),
        });
    },

    async deleteMessage(messageId: number): Promise<void> {
        return fetchApi(`/messages/${messageId}`, {
            method: 'DELETE',
        });
    },

    // --- Tavern (Chat) ---
    async getTavernMessages(): Promise<TavernMessage[]> {
        return fetchApi('/tavern/messages');
    },

    async sendTavernMessage(content: string): Promise<TavernMessage> {
        return fetchApi('/tavern/messages', {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    },
};
