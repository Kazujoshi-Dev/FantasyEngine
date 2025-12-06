
    async upgradeBackpack(): Promise<PlayerCharacter> {
        return fetchApi('/character/upgrade-backpack', { method: 'POST' });
    },

    // Secure Chest Operations
    async chestDeposit(amount: number): Promise<PlayerCharacter> {
        return fetchApi('/character/chest/deposit', {
            method: 'POST',
            body: JSON.stringify({ amount }),
        });
    },

    async chestWithdraw(amount: number): Promise<PlayerCharacter> {
        return fetchApi('/character/chest/withdraw', {
            method: 'POST',
            body: JSON.stringify({ amount }),
        });
    },

    // Secure Equip
    async equipItem(itemId: string): Promise<PlayerCharacter> {
        return fetchApi('/character/equip', {
