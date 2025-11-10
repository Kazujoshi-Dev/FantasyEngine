import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, ItemInstance, ItemTemplate, ItemRarity, EssenceType, EquipmentSlot, Affix } from '../types';
import { ItemList, ItemDetailsPanel, ItemListItem } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { AnvilIcon } from './icons/AnvilIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { rarityStyles } from './shared/ItemSlot';
import { StarIcon } from './icons/StarIcon';

type BlacksmithTab = 'disenchant' | 'upgrade';
type NotificationType = { message: string; type: 'success' | 'error' };

interface BlacksmithProps {
    character: PlayerCharacter;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    // FIX: Changed onDisenchantItem prop to return a Promise to match the async implementation.
    onDisenchantItem: (item: ItemInstance) => Promise<{ success: boolean; amount?: number; essenceType?: EssenceType }>;
    // FIX: Changed onUpgradeItem prop to return a Promise to match the async implementation.
    onUpgradeItem: (item: ItemInstance) => Promise<{ success: boolean; messageKey: string; level?: number }>;
}

const getPotentialYield = (rarity: ItemRarity): [string, EssenceType | null] => {
    switch (rarity) {
        case ItemRarity.Common: return ['1-4', EssenceType.Common];
        case ItemRarity.Uncommon: return ['1-2', EssenceType.Uncommon];
        case ItemRarity.Rare: return ['1-2', EssenceType.Rare];
        case ItemRarity.Epic: return ['1', EssenceType.Epic];
        case ItemRarity.Legendary: return ['0-1 (50%)', EssenceType.Legendary];
        default: return ['', null];
    }
};

const DisenchantPanel: React.FC<{
    character: PlayerCharacter;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    onDisenchantItem: BlacksmithProps['onDisenchantItem'];
    setNotification: (notification: NotificationType | null) => void;
}> = ({ character, itemTemplates, affixes, onDisenchantItem, setNotification }) => {
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);

    const validInventory = useMemo(() => 
        character.inventory.filter(item => itemTemplates.find(t => t.id === item.templateId)),
        [character.inventory, itemTemplates]
    );
    const backpackCapacity = 40 + ((character.backpack?.level || 1) - 1) * 10;

    const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
        [EssenceType.Common]: ItemRarity.Common,
        [EssenceType.Uncommon]: ItemRarity.Uncommon,
        [EssenceType.Rare]: ItemRarity.Rare,
        [EssenceType.Epic]: ItemRarity.Epic,
        [EssenceType.Legendary]: ItemRarity.Legendary,
    };

    // FIX: Made handler async and used await to handle the Promise returned by onDisenchantItem.
    const handleDisenchantClick = async () => {
        if (!selectedItem) return;
        
        const result = await onDisenchantItem(selectedItem);
        
        if (result.success && result.amount && result.essenceType) {
            setNotification({
                message: t('blacksmith.disenchantSuccess', { amount: result.amount, essenceName: t(`resources.${result.essenceType}`) }),
                type: 'success'
            });
        } else if (result.success === false && result.amount === undefined) {
            // This case handles API errors where no result is returned.
            // The alert is already shown in App.tsx, so we just do nothing here.
        }
        else {
            setNotification({
                message: t('blacksmith.disenchantFailure'),
                type: 'error'
            });
        }
        setSelectedItem(null);
    };
    
    const selectedTemplate = selectedItem ? itemTemplates.find(t=> t.id === selectedItem.templateId) : null;
    const disenchantCost = selectedTemplate ? Math.round(selected