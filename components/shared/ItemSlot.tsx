import React, { useRef, useLayoutEffect, useState } from 'react';
import { ItemRarity, ItemTemplate, ItemInstance, EquipmentSlot } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon'; // For +level display

export const rarityStyles: Record<ItemRarity, { border: string; bg: string; shadow: string; text: string; }> = {
    [ItemRarity.Common]: { border: 'border-slate-700', bg: 'bg-slate-800', shadow: 'shadow-none', text: 'text-gray-300' },
    [ItemRarity.Uncommon]: { border: 'border-green-700', bg: 'bg-green-950', shadow: 'shadow-md shadow-green-500/10', text: 'text-green-400' },
    [ItemRarity.Rare]: { border: 'border-sky-700', bg: 'bg-sky-950', shadow: 'shadow-md shadow-sky-500/10', text: 'text-sky-400' },
    [ItemRarity.Epic]: { border: 'border-purple-700', bg: 'bg-purple-950', shadow: 'shadow-md shadow-purple-500/10', text: 'text-purple-400' },
    [ItemRarity.Legendary]: { border: 'border-amber-600', bg: 'bg-amber-950', shadow: 'shadow-md shadow-amber-500/10', text: 'text-amber-400' },
};

// ===================================================================================
//                                Item Details Panel
// ===================================================================================

export const ItemDetailsPanel: React.FC<{ item: ItemInstance | null; template: ItemTemplate | null; children?: React.ReactNode; showIcon?: boolean }> = ({ item, template, children, showIcon = true }) => {
    const { t } = useTranslation();
    
    if (!item || !template) {
        return <div className="flex items-center justify-center h-full text-slate-500">{t('equipment.selectItemPrompt')}</div>;
    }

    const upgradeLevel = item.upgradeLevel || 0;
    const upgradeBonusFactor = upgradeLevel * 0.1;
    
    const calculateUpgradedStat = (base?: number): number | undefined => {
        if (base === undefined) return undefined;
        return base + Math.round(base * upgradeBonusFactor);
    };

    const weaponSlots: (EquipmentSlot | 'consumable' | 'ring')[] = [
        EquipmentSlot.MainHand,
        EquipmentSlot.TwoHand,
    ];
    const isWeapon = weaponSlots.includes(template.slot);
    const attacksPerRound = template.attacksPerRound ?? (isWeapon ? 1 : undefined);

    const finalDamageMin = calculateUpgradedStat(template.damageMin);
    const finalDamageMax = calculateUpgradedStat(template.damageMax);
    const finalMagicDamageMin = calculateUpgradedStat(template.magicDamageMin);
    const finalMagicDamageMax = calculateUpgradedStat(template.magicDamageMax);
    const finalArmorBonus = calculateUpgradedStat(template.armorBonus);
    const finalCritChanceBonus = template.critChanceBonus !== undefined ? (template.critChanceBonus + template.critChanceBonus * upgradeBonusFactor) : undefined;
    const finalMaxHealthBonus = calculateUpgradedStat(template.maxHealthBonus);

    const statBonusEntries = Object.entries(template.statsBonus)
        .filter(([, value]) => value)
        .map(([key, value]) => ({ key, value: calculateUpgradedStat(value as number) }));

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto pr-2">
                <h4 className={`font-bold text-2xl mb-2 text-center ${rarityStyles[template.rarity].text}`}>
                    {template.name} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </h4>
                {showIcon && template.icon && <img src={template.icon} alt={template.name} className="w-48 h-48 object-contain border border-slate-600 rounded-md bg-slate-800 mx-auto mb-4" />}
                <p className="text-sm text-gray-400 italic mb-4 text-center">{template.description}</p>
                
                <div className="space-y-1 text-sm">
                    {/* Primary Stats */}
                    {(finalDamageMin !== undefined || (attacksPerRound && attacksPerRound > 0) || finalArmorBonus || finalCritChanceBonus || finalMaxHealthBonus) && (
                        <div className="space-y-1 bg-slate-800/50 p-2 rounded-lg">
                            {finalDamageMin !== undefined && <p className="flex justify-between"><span>{t('item.damage')}:</span> <span className="font-mono">{finalDamageMin}-{finalDamageMax}</span></p>}
                            {attacksPerRound && attacksPerRound > 0 && <p className="flex justify-between"><span>{t('item.attacksPerRound')}:</span> <span className="font-mono">{attacksPerRound}</span></p>}
                            {finalArmorBonus && <p className="flex justify-between"><span>{t('statistics.armor')}:</span> <span className="font-mono">+{finalArmorBonus}</span></p>}
                            {finalCritChanceBonus && <p className="flex justify-between"><span>{t('statistics.critChance')}:</span> <span className="font-mono">+{finalCritChanceBonus.toFixed(1)}%</span></p>}
                            {finalMaxHealthBonus && <p className="flex justify-between"><span>{t('statistics.health')}:</span> <span className="font-mono">+{finalMaxHealthBonus}</span></p>}
                        </div>
                    )}
                    {/* Magic Stats */}
                    {template.isMagical && (
                        <div className="space-y-1 bg-purple-950/30 p-2 rounded-lg text-purple-300 mt-2">
                             {finalMagicDamageMin !== undefined && <p className="flex justify-between"><span>{t('statistics.magicDamage')}:</span> <span className="font-mono">{finalMagicDamageMin}-{finalMagicDamageMax}</span></p>}
                             {template.magicAttackType && <p className="flex justify-between"><span>{t('item.magicAttackType')}:</span> <span className="font-mono">{t(`item.magic.${template.magicAttackType}`)}</span></p>}
                             {template.manaCost && <p className="flex justify-between"><span>{t('item.manaCost')}:</span> <span className="font-mono">{template.manaCost}</span></p>}
                        </div>
                    )}
                    {/* Stat Bonuses */}
                    {statBonusEntries.length > 0 && (
                        <div className="space-y-1 bg-green-950/30 p-2 rounded-lg text-green-300 mt-2">
                            {statBonusEntries.map(({ key, value }) => (
                                <p key={key} className="flex justify-between"><span>{t(`statistics.${key}`)}</span> <span className="font-mono">+{value}</span></p>
                            ))}
                        </div>
                    )}
                    {/* Secondary Combat Bonuses */}
                    {(template.critDamageModifierBonus || template.armorPenetrationPercent || template.armorPenetrationFlat || template.lifeStealPercent || template.lifeStealFlat || template.manaStealPercent || template.manaStealFlat) && (
                        <div className="space-y-1 bg-sky-950/30 p-2 rounded-lg text-sky-300 mt-2">
                            {template.critDamageModifierBonus ? (
                                <p className="flex justify-between">
                                    <span>{t('statistics.critDamageModifier')}</span>
                                    <span className="font-mono">+{template.critDamageModifierBonus}%</span>
                                </p>
                            ) : null}
                            {(template.armorPenetrationPercent || template.armorPenetrationFlat) ? (
                                <p className="flex justify-between">
                                    <span>{t('statistics.armorPenetration')}</span>
                                    <span className="font-mono">{template.armorPenetrationPercent || 0}% / {template.armorPenetrationFlat || 0}</span>
                                </p>
                            ) : null}
                            {(template.lifeStealPercent || template.lifeStealFlat) ? (
                                <p className="flex justify-between">
                                    <span>{t('statistics.lifeSteal')}</span>
                                    <span className="font-mono">{template.lifeStealPercent || 0}% / {template.lifeStealFlat || 0}</span>
                                </p>
                            ) : null}
                            {(template.manaStealPercent || template.manaStealFlat) ? (
                                <p className="flex justify-between">
                                    <span>{t('statistics.manaSteal')}</span>
                                    <span className="font-mono">{template.manaStealPercent || 0}% / {template.manaStealFlat || 0}</span>
                                </p>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* General Info */}
                <div className="border-t border-slate-700/50 mt-4 pt-2 text-sm text-gray-400 space-y-1">
                    <p className="flex justify-between"><span>{t('item.levelRequirement')}:</span> <span>{template.requiredLevel}</span></p>
                    <p className="flex justify-between items-center"><span>{t('item.value')}:</span> <span className="text-amber-400 flex items-center">{template.value} <CoinsIcon className="h-4 w-4 ml-1"/></span></p>
                </div>
            </div>
            {children}
        </div>
    );
};

// ===================================================================================
//                                Item List Item
// ===================================================================================

interface ItemListItemProps {
    item: ItemInstance;
    template: ItemTemplate;
    isSelected: boolean;
    onClick: () => void;
    price?: number;
    showPrimaryStat?: boolean;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    className?: string;
}

export const ItemListItem: React.FC<ItemListItemProps> = ({ item, template, isSelected, onClick, price, showPrimaryStat = true, draggable, onDragStart, onDragEnd, className }) => {
    const { t } = useTranslation();
    const upgradeLevel = item.upgradeLevel || 0;
    
    let primaryStat = '';
    if (showPrimaryStat) {
        if (template.damageMin !== undefined) primaryStat = `${template.damageMin}-${template.damageMax} ${t('item.damage')}`;
        else if (template.armorBonus) primaryStat = `+${template.armorBonus} ${t('statistics.armor')}`;
    }
    
    return (
        <div
            onClick={onClick}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-2 p-1 rounded-lg cursor-pointer transition-all duration-150 ${
                isSelected ? 'bg-indigo-600/30 ring-2 ring-indigo-500' : 'hover:bg-slate-700/50'
            } ${className}`}
        >
            <div className={`relative flex-shrink-0 w-10 h-10 rounded-md border-2 flex items-center justify-center ${rarityStyles[template.rarity].border} ${rarityStyles[template.rarity].bg}`}>
                {template.icon ? <img src={template.icon} alt={template.name} className="h-full w-full object-contain" /> : <span className="text-xs text-slate-500">?</span>}
                {upgradeLevel > 0 && (
                     <div className="absolute -top-1 -right-1 flex items-center bg-black/70 rounded-full px-1 py-0.5 text-xs font-bold text-amber-300">
                        <StarIcon className="h-3 w-3" />
                        <span>{upgradeLevel}</span>
                    </div>
                )}
            </div>
            <div className="flex-grow overflow-hidden">
                <p className={`font-semibold truncate text-sm ${rarityStyles[template.rarity].text}`}>{template.name}</p>
                {(primaryStat || price !== undefined) && (
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-400">{primaryStat}</p>
                        {price !== undefined && (
                            <p className="text-xs text-amber-400 font-semibold flex items-center">
                                {price} <CoinsIcon className="h-3 w-3 ml-1" />
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ===================================================================================
//                                  Empty Slot
// ===================================================================================

export const EmptySlotListItem: React.FC<{
  slotName: string;
  onClick: () => void;
}> = ({ slotName, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-2 p-1 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-slate-700/50"
  >
    <div className="relative flex-shrink-0 w-10 h-10 rounded-md border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800/50">
      {/* A placeholder icon could go here */}
    </div>
    <div className="flex-grow overflow-hidden">
      <p className="font-semibold truncate text-slate-500 text-sm">{slotName}</p>
    </div>
  </div>
);


// ===================================================================================
//                                  Item List
// ===================================================================================

interface ItemListProps {
    items: ItemInstance[];
    itemTemplates: ItemTemplate[];
    selectedItem: ItemInstance | null;
    onSelectItem: (item: ItemInstance) => void;
    showPrice?: 'buy' | 'sell';
}

export const ItemList: React.FC<ItemListProps> = ({ items, itemTemplates, selectedItem, onSelectItem, showPrice }) => {
    return (
        <div className="flex-grow overflow-y-auto pr-2 space-y-1">
            {items.map(item => {
                const template = itemTemplates.find(t => t.id === item.templateId);
                if (!template) return null;
                
                const price = showPrice 
                    ? (showPrice === 'buy' ? template.value * 2 : template.value) 
                    : undefined;

                return (
                    <ItemListItem
                        key={item.uniqueId}
                        item={item}
                        template={template}
                        isSelected={selectedItem?.uniqueId === item.uniqueId}
                        onClick={() => onSelectItem(item)}
                        price={price}
                    />
                );
            })}
        </div>
    );
};

export const ItemTooltip: React.FC<{ instance: ItemInstance, template: ItemTemplate }> = ({ instance, template }) => {
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});

    useLayoutEffect(() => {
        if (!tooltipRef.current || !tooltipRef.current.parentElement) return;

        const parentRect = tooltipRef.current.parentElement.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();

        const spaceAbove = parentRect.top;
        const spaceBelow = window.innerHeight - parentRect.bottom;
        const spaceRight = window.innerWidth - parentRect.right;
        const spaceLeft = parentRect.left;

        const newStyle: React.CSSProperties = {};
        const transforms: string[] = [];

        // Vertical positioning
        if (spaceBelow < tooltipRect.height && spaceAbove > tooltipRect.height) {
            newStyle.bottom = '100%';
            newStyle.marginBottom = '0.5rem';
            // Center horizontally
            newStyle.left = '50%';
            transforms.push('translateX(-50%)');
        } else { // Default to side positioning
            newStyle.top = '50%';
            transforms.push('translateY(-50%)');
            
            // Horizontal positioning
            if (spaceRight < tooltipRect.width && spaceLeft > tooltipRect.width) {
                newStyle.right = '100%';
                newStyle.marginRight = '0.5rem';
            } else {
                newStyle.left = '100%';
                newStyle.marginLeft = '0.5rem';
            }
        }
        
        if (transforms.length > 0) {
            newStyle.transform = transforms.join(' ');
        }

        setStyle(newStyle);
    }, []);

    return (
        <div
            ref={tooltipRef}
            style={style}
            className="absolute w-72 p-3 bg-slate-900 border border-slate-700 text-gray-300 text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20"
        >
            <ItemDetailsPanel item={instance} template={template} />
        </div>
    );
};