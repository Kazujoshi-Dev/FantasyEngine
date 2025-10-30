import React, { useRef, useLayoutEffect, useState } from 'react';
import { ItemRarity, ItemTemplate, ItemInstance, EquipmentSlot, PlayerCharacter, CharacterStats, Affix, RolledAffixStats } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon'; // For +level display
import { ShieldIcon } from '../icons/ShieldIcon';

export const rarityStyles: Record<ItemRarity, { border: string; bg: string; shadow: string; text: string; }> = {
    [ItemRarity.Common]: { border: 'border-slate-700', bg: 'bg-slate-800', shadow: 'shadow-none', text: 'text-gray-300' },
    [ItemRarity.Uncommon]: { border: 'border-green-700', bg: 'bg-green-950', shadow: 'shadow-md shadow-green-500/10', text: 'text-green-400' },
    [ItemRarity.Rare]: { border: 'border-sky-700', bg: 'bg-sky-950', shadow: 'shadow-md shadow-sky-500/10', text: 'text-sky-400' },
    [ItemRarity.Epic]: { border: 'border-purple-700', bg: 'bg-purple-950', shadow: 'shadow-md shadow-purple-500/10', text: 'text-purple-400' },
    [ItemRarity.Legendary]: { border: 'border-amber-600', bg: 'bg-amber-950', shadow: 'shadow-md shadow-amber-500/10', text: 'text-amber-400' },
};

const getFullName = (item: ItemInstance, template: ItemTemplate, affixes: Affix[]): string => {
    const prefix = affixes.find(a => a.id === item.prefixId);
    const suffix = affixes.find(a => a.id === item.suffixId);
    return [prefix?.name, template.name, suffix?.name].filter(Boolean).join(' ');
}


// ===================================================================================
//                                Item Details Panel
// ===================================================================================

export const ItemDetailsPanel: React.FC<{ item: ItemInstance | null; template: ItemTemplate | null; affixes: Affix[]; children?: React.ReactNode; showIcon?: boolean, baseCharacter?: PlayerCharacter; }> = ({ item, template, affixes, children, showIcon = true, baseCharacter }) => {
    const { t } = useTranslation();
    
    if (!item || !template) {
        return <div className="flex items-center justify-center h-full text-slate-500">{t('equipment.selectItemPrompt')}</div>;
    }

    const upgradeLevel = item.upgradeLevel || 0;
    const upgradeBonusFactor = upgradeLevel * 0.1;
    
    const prefix = affixes.find(a => a.id === item.prefixId);
    const suffix = affixes.find(a => a.id === item.suffixId);
    const fullName = getFullName(item, template, affixes);

    const StatSection: React.FC<{title?: string, source: ItemTemplate | RolledAffixStats, isItem?: boolean, isUpgrade?: boolean}> = ({title, source, isItem, isUpgrade}) => {
        const bonusFactor = isUpgrade ? upgradeBonusFactor : 0;
        const calculateStat = (base?: number) => base !== undefined ? base + Math.round(base * bonusFactor) : undefined;
        const calculateFloatStat = (base?: number) => base !== undefined ? base + base * bonusFactor : undefined;
        
        const s = source as any; // To access properties dynamically
        
        const entries = [
            ...(s.statsBonus ? Object.entries(s.statsBonus).filter(([,v])=>v).map(([k,v]) => ({label: t(`statistics.${k}`), value: `+${isItem ? calculateStat(v as number) : v}`, color: 'text-green-300'})) : []),
            (s.damageMin !== undefined) && {label: t('item.damage'), value: `${isItem ? calculateStat(s.damageMin) : s.damageMin}-${isItem ? calculateStat(s.damageMax) : s.damageMax}`},
            (s.armorBonus !== undefined) && {label: t('statistics.armor'), value: `+${isItem ? calculateStat(s.armorBonus) : s.armorBonus}`},
            (s.critChanceBonus !== undefined) && {label: t('statistics.critChance'), value: `+${(isItem ? calculateFloatStat(s.critChanceBonus) : s.critChanceBonus)?.toFixed(1)}%`},
            (s.maxHealthBonus !== undefined) && {label: t('statistics.health'), value: `+${isItem ? calculateStat(s.maxHealthBonus) : s.maxHealthBonus}`},
            (s.critDamageModifierBonus !== undefined) && {label: t('statistics.critDamageModifier'), value: `+${s.critDamageModifierBonus}%`},
            (s.armorPenetrationPercent || s.armorPenetrationFlat) && {label: t('statistics.armorPenetration'), value: `${s.armorPenetrationPercent || 0}% / ${s.armorPenetrationFlat || 0}`},
            (s.lifeStealPercent || s.lifeStealFlat) && {label: t('statistics.lifeSteal'), value: `${s.lifeStealPercent || 0}% / ${s.lifeStealFlat || 0}`},
            (s.manaStealPercent || s.manaStealFlat) && {label: t('statistics.manaSteal'), value: `${s.manaStealPercent || 0}% / ${s.manaStealFlat || 0}`},
            (s.magicDamageMin !== undefined) && {label: t('statistics.magicDamage'), value: `${isItem ? calculateStat(s.magicDamageMin) : s.magicDamageMin}-${isItem ? calculateStat(s.magicDamageMax) : s.magicDamageMax}`, color: 'text-purple-300'},
            (s.attacksPerRoundBonus !== undefined) && {label: t('item.attacksPerRoundBonus'), value: `+${s.attacksPerRoundBonus}`},
            (s.dodgeChanceBonus !== undefined) && {label: t('item.dodgeChanceBonus'), value: `+${s.dodgeChanceBonus.toFixed(1)}%`},
        ].filter(Boolean);

        if (entries.length === 0) return null;
        
        return (
             <div className="space-y-1 bg-slate-800/50 p-2 rounded-lg mt-2">
                {title && <h5 className="font-semibold text-gray-400 text-base">{title}</h5>}
                {entries.map((e, i) => <p key={i} className={`flex justify-between ${(e as { color?: string }).color || ''}`}><span>{e.label}:</span> <span className="font-mono">{e.value}</span></p>)}
            </div>
        )
    }

    const totalRequiredLevel = Math.max(template.requiredLevel || 0, prefix?.requiredLevel || 0, suffix?.requiredLevel || 0);
    const allRequiredStats: Partial<CharacterStats> = {...template.requiredStats, ...prefix?.requiredStats, ...suffix?.requiredStats};

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto pr-2">
                <h4 className={`font-bold text-2xl mb-2 text-center ${rarityStyles[template.rarity].text}`}>
                    {fullName} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </h4>
                {showIcon && template.icon && <img src={template.icon} alt={template.name} className="w-48 h-48 object-contain border border-slate-600 rounded-md bg-slate-800 mx-auto mb-4" />}
                <p className="text-sm text-gray-400 italic mb-4 text-center">{template.description}</p>
                
                <div className="space-y-1 text-sm">
                    <StatSection title="Statystyki bazowe" source={template} isItem={true} isUpgrade={true} />
                    {prefix && item.rolledPrefix && <StatSection title={`Prefiks: ${prefix.name}`} source={item.rolledPrefix} />}
                    {suffix && item.rolledSuffix && <StatSection title={`Sufiks: ${suffix.name}`} source={item.rolledSuffix} />}
                </div>

                {(totalRequiredLevel > 1 || Object.keys(allRequiredStats).length > 0) && baseCharacter && (
                     <div className="border-t border-slate-700/50 mt-4 pt-2 text-sm text-gray-300 space-y-1">
                        <h5 className="font-semibold text-gray-400 text-base mb-1">{t('item.requirements')}</h5>
                        {totalRequiredLevel > 1 && <p className={`flex justify-between ${baseCharacter.level >= totalRequiredLevel ? 'text-green-400' : 'text-red-400'}`}>
                            <span>{t('item.levelRequirement')}:</span>
                            <span>{totalRequiredLevel}</span>
                        </p>}
                        {Object.entries(allRequiredStats).map(([stat, value]) => {
                            if (!value || !baseCharacter.stats) return null;
                            const meetsReq = baseCharacter.stats[stat as keyof CharacterStats] >= value;
                            return (
                                <p key={stat} className={`flex justify-between ${meetsReq ? 'text-green-400' : 'text-red-400'}`}>
                                    <span>{t(`statistics.${stat}`)}:</span>
                                    <span>{value}</span>
                                </p>
                            )
                        })}
                     </div>
                 )}


                {/* General Info */}
                <div className="border-t border-slate-700/50 mt-4 pt-2 text-sm text-gray-400 space-y-1">
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
    affixes: Affix[];
    isSelected: boolean;
    onClick: () => void;
    price?: number;
    showPrimaryStat?: boolean;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    className?: string;
    isEquipped?: boolean;
}

export const ItemListItem: React.FC<ItemListItemProps> = ({ item, template, affixes, isSelected, onClick, price, showPrimaryStat = true, draggable, onDragStart, onDragEnd, className, isEquipped }) => {
    const { t } = useTranslation();
    const upgradeLevel = item.upgradeLevel || 0;
    const fullName = getFullName(item, template, affixes);
    
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
            className={`relative flex items-center gap-2 p-1 rounded-lg cursor-pointer transition-all duration-150 ${
                isSelected ? 'bg-indigo-600/30 ring-2 ring-indigo-500' : 'hover:bg-slate-700/50'
            } ${className}`}
        >
             {isEquipped && (
                <div className="absolute top-0 left-0 z-10" title={t('equipment.equipped') || 'Equipped'}>
                    <ShieldIcon className="h-4 w-4 text-sky-300 bg-slate-900/50 rounded-full" />
                </div>
            )}
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
                <p className={`font-semibold truncate text-sm ${rarityStyles[template.rarity].text}`}>{fullName}</p>
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
    affixes: Affix[];
    selectedItem: ItemInstance | null;
    onSelectItem: (item: ItemInstance) => void;
    showPrice?: 'buy' | 'sell';
}

export const ItemList: React.FC<ItemListProps> = ({ items, itemTemplates, affixes, selectedItem, onSelectItem, showPrice }) => {
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
                        affixes={affixes}
                        isSelected={selectedItem?.uniqueId === item.uniqueId}
                        onClick={() => onSelectItem(item)}
                        price={price}
                    />
                );
            })}
        </div>
    );
};

export const ItemTooltip: React.FC<{ instance: ItemInstance, template: ItemTemplate, affixes: Affix[], baseCharacter?: PlayerCharacter }> = ({ instance, template, affixes, baseCharacter }) => {
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
            <ItemDetailsPanel item={instance} template={template} affixes={affixes} baseCharacter={baseCharacter} />
        </div>
    );
};