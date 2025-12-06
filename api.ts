
    updateCharacterGold: (id: number, gold: number) => fetchApi(`/admin/character/${id}/update-gold`, { method: 'POST', body: JSON.stringify({ gold }) }),
    updateCharacterDetails: (id: number, data: { race?: string, characterClass?: string, level?: number }) => fetchApi(`/admin/character/${id}/update-details`, { method: 'POST', body: JSON.stringify(data) }),
    regenerateCharacterEnergy: (id: number) => fetchApi(`/admin/characters/${id}/regenerate-energy`, { method: 'POST' }),
    softResetCharacter: (id: number) => fetchApi(`/admin/characters/${id}/soft-reset`, { method: 'POST' }),
    changeUserPassword: (id: number, newPass: string) => fetchApi(`/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ newPassword: newPass }) }),
