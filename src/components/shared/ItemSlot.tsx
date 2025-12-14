
import React, { useMemo } from 'react';
import { ItemRarity, ItemTemplate, ItemInstance, EquipmentSlot, PlayerCharacter, CharacterStats, Affix, RolledAffixStats, GrammaticalGender } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon'; // For +level display
import { ShieldIcon } from '../icons/ShieldIcon';

export const rarityStyles = {
    [ItemRarity.Common]: { border: 'border-slate-700', bg: 'bg-slate-800', shadow: 'shadow-none', text: 'text-gray-300' },
    [ItemRarity.Uncommon]: { border: 'border-green-700', bg: 'bg-green-950', shadow: 'shadow-md shadow-green-500/10', text: 'text-green-400' },
    [ItemRarity.Rare]: { border: 'border-sky-700', bg: 'bg-sky-950', shadow: 'shadow-md shadow-sky-500/10', text: 'text-sky-400' },
    [ItemRarity.Epic]: { border: 'border-purple-700', bg: 'bg-purple-950', shadow: 'shadow-md shadow-purple-500/10', text: 'text-purple-400' },
    [ItemRarity.Legendary]: { border: 'border-amber-600', bg: 'bg-amber-950', shadow: 'shadow-md shadow-amber-500/10', text: 'text-amber-400' },
};

export const getGrammaticallyCorrectFullName = (item: ItemInstance, template: ItemTemplate, affixes: Affix[]): string => {
    const safeAffixes = affixes || [];
    const prefixAffix = safeAffixes.find(a => a.id === item.prefixId);
    const suffixAffix = safeAffixes.find(a => a.id === item.suffixId);
    
    let genderKey: 'masculine' | 'feminine' | 'neuter' = 'masculine';
    if (template.gender === GrammaticalGender.Feminine) {
        genderKey = 'feminine';
    } else if (template.gender === GrammaticalGender.Neuter) {
        genderKey = 'neuter';
    }
    
    const getName = (affix: Affix | undefined) => {
        if (!affix) return '';
        if (typeof affix.name === 'string') return affix.name;
        return (affix.name as any)[genderKey] || affix.name.masculine || '';
    };

    const prefixName = getName(prefixAffix);
    const suffixName = getName(suffixAffix);

    return [prefixName, template.name, suffixName].filter(Boolean).join(' ');
}


// ===================================================================================
//                                Item Details Panel
// ===================================================================================

export const ItemDetailsPanel: React.FC<{
    item: ItemInstance | null;
    template: ItemTemplate | null;
    affixes: Affix[];
    children?: React.ReactNode;
    showIcon?: boolean;
    character?: PlayerCharacter;
    size?: 'small';
    hideAffixes?: boolean;
    title?: string;
    compact?: boolean;
}> = ({ item, template, affixes, children, showIcon = true, character, size, hideAffixes, title, compact = false }) => {
    const { t } = useTranslation();
    const isSmall = size === 'small';
    const safeAffixes = affixes || [];
    
    const baseStatsSource = useMemo(() => {
        if (!item || !template) return null;
        if (item.rolledBaseStats) {
            // Inject static stats from template that are not rolled but needed for display (like attacksPerRound)
            return {
                ...item.rolledBaseStats,
                attacksPerRound: template.attacksPerRound,
                manaCost: template.manaCost,
                magicAttackType: template.magicAttackType
            };
        }
        return template;
    }, [item, template]);

    if (!item || !template) {
        return <div className="flex items-center justify-center h-full text-slate-500">{title ? null : t('equipment.selectItemPrompt')}</div>;
    }

    const upgradeLevel = item.upgradeLevel || 0;
    // Base stats scale infinitely (10% per level)
    const baseUpgradeFactor = upgradeLevel * 0.1;
    // Affixes scale max +5 (50%)
    const affixUpgradeFactor = Math.min(upgradeLevel, 5) * 0.1;
    
    const prefix = safeAffixes.find(a => a.id === item.prefixId);
    const suffix = safeAffixes.find(a => a.id === item.suffixId);
    const fullName = getGrammaticallyCorrectFullName(item, template, safeAffixes);
    
    let genderKey: 'masculine' | 'feminine' | 'neuter' = 'masculine';
    if (template.gender === GrammaticalGender.Feminine) {
        genderKey = 'feminine';
    } else if (template.gender === GrammaticalGender.Neuter) {
        genderKey = 'neuter';
    }
    
    const getName = (affix: Affix | undefined) => {
        if (!affix) return '';
        if (typeof affix.name === 'string') return affix.name;
        return (affix.name as any)[genderKey] || affix.name.masculine || '';
    };

    const prefixName = getName(prefix);
    const suffixName = getName(suffix);

    const totalValue = (() => {
        if (!template) return 0;
        let value = Number(template.value) || 0;
        if (prefix) value += Number(prefix.value) || 0;
        if (suffix) value += Number(suffix.value) || 0;
        return value;
    })();

    const StatSection: React.FC<{title?: string, source: RolledAffixStats | ItemTemplate, isAffix: boolean}> = ({title, source, isAffix}) => {
        const bonusFactor = isAffix ? affixUpgradeFactor : baseUpgradeFactor;
        const calculateStat = (base?: number) => base !== undefined ? base + Math.round(base * bonusFactor) : undefined;
        const calculateFloatStat = (base?: number) => base !== undefined ? base + base * bonusFactor : undefined;
        
        const s = source as any; // To access properties dynamically
        
        const entries = [
            ...(s.statsBonus ? Object.entries(s.statsBonus).filter(([,v])=>v).map(([k,v]) => ({label: t(`statistics.${k}`), value: `+${calculateStat(v as number)}`, color: 'text-green-300'})) : []),
            (s.damageMin !== undefined) && {label: t('item.damage'), value: `${calculateStat(s.damageMin)}-${calculateStat(s.damageMax)}`},
            (s.attacksPerRound !== undefined || s.attacksPerRoundBonus !== undefined) && { label: t('statistics.attacksPerTurn'), value: s.attacksPerRound || `+${s.attacksPerRoundBonus}` },
            (s.armorBonus !== undefined) && {label: t('statistics.armor'), value: `+${calculateStat(s.armorBonus)}`},
            (s.critChanceBonus !== undefined) && {label: t('statistics.critChance'), value: `+${(calculateFloatStat(s.critChanceBonus))?.toFixed(1)}%`},
            (s.maxHealthBonus !== undefined) && {label: t('statistics.health'), value: `+${calculateStat(s.maxHealthBonus)}`},
            (s.critDamageModifierBonus !== undefined) && {label: t('statistics.critDamageModifier'), value: `+${calculateStat(s.critDamageModifierBonus)}%`},
            (s.armorPenetrationPercent || s.armorPenetrationFlat) && {label: t('statistics.armorPenetration'), value: `${s.armorPenetrationPercent || 0}% / ${calculateStat(s.armorPenetrationFlat)}`},
            (s.lifeStealPercent || s.lifeStealFlat) && {label: t('statistics.lifeSteal'), value: `${s.lifeStealPercent || 0}% / ${calculateStat(s.lifeStealFlat)}`},
            (s.manaStealPercent || s.manaStealFlat) && {label: t('statistics.manaSteal'), value: `${s.manaStealPercent || 0}% / ${calculateStat(s.manaStealFlat)}`},
            (s.magicDamageMin !== undefined) && {label: t('statistics.magicDamage'), value: `${calculateStat(s.magicDamageMin)}-${calculateStat(s.magicDamageMax)}`, color: 'text-purple-300'},
            (s.manaCost?.min !== undefined) && {label: t('item.manaCost'), value: s.manaCost.min === s.manaCost.max ? `${s.manaCost.min}` : `${s.manaCost.min}-${s.manaCost.max}`, color: 'text-cyan-300'},
            (s.magicAttackType !== undefined) && {label: t('item.magicAttackType'), value: t(`item.magic.${s.magicAttackType}`), color: 'text-purple-300', valueClass: 'font-semibold'},
            (s.dodgeChanceBonus !== undefined) && {label: t('item.dodgeChanceBonus'), value: `+${s.dodgeChanceBonus.toFixed(1)}%`},
        ].filter(Boolean);

        if (entries.length === 0) return null;
        
        return (
             <div className={`bg-slate-800/50 p-2 rounded-lg mt-2 ${isSmall ? 'text-xs space-y-0.5' : 'text-sm space-y-1'}`}>
                {title && <h5 className={`font-semibold text-gray-400 ${isSmall ? 'text-sm' : 'text-base'}`}>{title}</h5>}
                {entries.map((e, i) => (
                    <p key={i} className={`flex justify-between ${(e as { color?: string }).color || ''}`}>
                        <span>{e.label}:</span> 
                        <span className={`${(e as { valueClass?: string }).valueClass || 'font-mono'}`}>{e.value}</span>
                    </p>
                ))}
            </div>
        )
    }

    const totalRequiredLevel = Math.max(template.requiredLevel || 0, prefix?.requiredLevel || 0, suffix?.requiredLevel || 0);
    const allRequiredStats: Partial<CharacterStats> = {...template.requiredStats, ...prefix?.requiredStats, ...suffix?.requiredStats};

    return (
        <div className={`flex flex-col ${compact ? '' : 'h-full'}`}>
            <div className={`${compact ? '' : 'flex-grow overflow-y-auto'} ${isSmall ? 'pr-1' : 'pr-2'}`}>
                {title && <h5 className={`text-center font-bold mb-2 ${isSmall ? 'text-base' : 'text-lg'} text-sky-300`}>{title}</h5>}
                <h4 className={`font-bold text-center ${rarityStyles[template.rarity].text} ${isSmall ? 'text-xl mb-1' : 'text-2xl mb-2'}`}>
                    {fullName} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </h4>
                {showIcon && template.icon && <img src={template.icon} alt={template.name} className="w-48 h-48 object-contain border border-slate-600 rounded-md bg-slate-800 mx-auto mb-4" />}
                <p className={`italic text-center ${isSmall ? 'text-xs text-gray-400 mb-2' : 'text-sm text-gray-400 mb-4'}`}>{template.description}</p>
                
                {item.isBorrowed && (
                    <div className="bg-indigo-900/50 text-indigo-300 border border-indigo-700 p-2 rounded text-center mb-2 text-xs font-bold">
                        WYPOŻYCZONY OD GILDII<br/>
                        <span className="font-normal text-gray-400">Właściciel: {item.originalOwnerName || 'Nieznany'}</span>
                    </div>
                )}

                <div className="border-t border-slate-700/50 pt-2">
                    <p className={`flex justify-between ${isSmall ? 'text-xs' : 'text-sm'}`}>
                        {/* Use equipment.slot translations here */}
                        <span>{t('item.slotLabel')}:</span> <span className="font-semibold text-white">{t(`equipment.slot.${template.slot}`)}</span>
                    </p>
                    <p className={`flex justify-between ${isSmall ? 'text-xs' : 'text-sm'}`}>
                        <span>{t('item.value')}:</span> <span className="font-mono text-amber-400 flex items-center">{totalValue} <CoinsIcon className="h-4 w-4 ml-1"/></span>
                    </p>
                </div>

                {baseStatsSource && <StatSection source={baseStatsSource} isAffix={false} />}
                {!hideAffixes && item.rolledPrefix && prefix && <StatSection title={`${prefixName} (${t('admin.affix.prefix')})`} source={item.rolledPrefix} isAffix={true} />}
                {!hideAffixes && item.rolledSuffix && suffix && <StatSection title={`${suffixName} (${t('admin.affix.suffix')})`} source={item.rolledSuffix} isAffix={true} />}

                {(totalRequiredLevel > 1 || Object.keys(allRequiredStats).length > 0) && (
                    <div className={`border-t border-slate-700/50 pt-2 mt-2 ${isSmall ? 'text-xs' : 'text-sm'}`}>
                        <h5 className="font-semibold text-gray-400 mb-1">{t('item.requirements')}:</h5>
                        <div className="space-y-0.5">
                            {totalRequiredLevel > 1 && (
                                <p className={`flex justify-between ${character && character.level < totalRequiredLevel ? 'text-red-400' : 'text-gray-300'}`}>
                                    <span>{t('item.levelRequirement')}:</span> <span>{totalRequiredLevel}</span>
                                </p>
                            )}
                            {Object.entries(allRequiredStats).map(([stat, value]) => {
                                const meetsReq = character ? character.stats[stat as keyof CharacterStats] >= value : true;
                                return (
                                    <p key={stat} className={`flex justify-between ${!meetsReq ? 'text-red-400' : 'text-gray-300'}`}>
                                        <span>{t(`statistics.${stat}`)}:</span> <span>{value}</span>
                                    </p>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
            {children && <div className="flex-shrink-0">{children}</div>}
        </div>
    );
};

// ===================================================================================
//                                  Item Tooltip
// ===================================================================================
export const ItemTooltip: React.FC<{
  instance: ItemInstance;
  template: ItemTemplate;
  affixes: Affix[];
}> = ({ instance, template, affixes }) => {
    return (
        <div
            className="absolute left-full top-0 ml-2 z-20 w-72 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-300 pointer-events-none"
        >
            <ItemDetailsPanel item={instance} template={template} affixes={affixes} size="small" compact={true} />
        </div>
    );
};

// ===================================================================================
//                                Item List Components
// ===================================================================================
interface ItemListItemProps extends React.HTMLAttributes<HTMLDivElement> {
    item: ItemInstance;
    template: ItemTemplate;
    affixes: Affix[];
    isSelected: boolean;
    isEquipped?: boolean;
    price?: number;
    showPrimaryStat?: boolean;
    meetsRequirements?: boolean;
    onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const ItemListItem: React.FC<ItemListItemProps> = ({ item, template, affixes, isSelected, isEquipped, price, showPrimaryStat = true, meetsRequirements = true, onDragStart, ...divProps }) => {
    const { t } = useTranslation();
    const upgradeLevel = item.upgradeLevel || 0;
    const { border, text, bg, shadow } = rarityStyles[template.rarity];
    const safeAffixes = affixes || [];
    const fullName = getGrammaticallyCorrectFullName(item, template, safeAffixes);
    const finalBorder = meetsRequirements ? border : 'border-red-500';
    
    const borrowedStyle = item.isBorrowed ? 'ring-2 ring-indigo-500 bg-indigo-900/20' : '';
    // Styling for multiple selections (e.g. in Trader Sell Tab)
    const selectedStyle = isSelected ? 'bg-amber-700/40 ring-2 ring-amber-500' : `${bg}/50 hover:bg-slate-700/50`;
    // Fallback for single selection (e.g. inventory/equip) usually uses indigo
    const singleSelectedStyle = isSelected ? 'bg-indigo-600/30 ring-2 ring-indigo-500' : `${bg}/50 hover:bg-slate-700/50`;

    // Determine which style to use. If divProps.className contains specific overrides, those might apply, 
    // but here we check context indirectly. For now, we'll assume the parent component controls `isSelected` logic
    // and we just need a generic "active" look. 
    // However, if we want distinct looks for "Multi-selected for Sell" vs "Single clicked for details", 
    // we might need a prop like `selectionMode`. 
    // For this implementation, I will stick to a unified active state but use conditional classes based on usage.

    return (
         <div
            draggable="true"
            onDragStart={onDragStart}
            {...divProps}
            className={`p-2 rounded-lg border flex items-start gap-3 transition-all duration-150 ${
               isSelected ? 'bg-indigo-600/30 ring-2 ring-indigo-500' : `${bg}/50 hover:bg-slate-700/50`
            } ${finalBorder} ${shadow} ${borrowedStyle} ${divProps.className || ''}`}
        >
            {template.icon && <img src={template.icon} alt={template.name} className="w-12 h-12 object-contain bg-slate-800/50 rounded-md flex-shrink-0" />}
            <div className="flex-grow">
                <p className={`font-semibold ${text} ${!meetsRequirements ? 'text-red-500 line-through' : ''}`}>
                    {fullName} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </p>
                <div className="flex justify-between items-center text-xs mt-1">
                    {/* Use equipment.slot translations here */}
                    <span className="text-gray-400">{t(`equipment.slot.${template.slot}`)}</span>
                    {price !== undefined && <span className="font-mono text-amber-400 flex items-center">{price} <CoinsIcon className="h-3 w-3 ml-1"/></span>}
                    {isEquipped && <span className="text-sky-400 font-semibold">{t('equipment.equipped')}</span>}
                    {item.isBorrowed && <span className="text-indigo-400 font-bold ml-1" title={`Od: ${item.originalOwnerName}`}>[Wypożyczony]</span>}
                </div>
            </div>
        </div>
    );
};

export const EmptySlotListItem: React.FC<{ slotName: string, onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void }> = ({ slotName, onMouseEnter }) => (
    <div className={`p-2 rounded-lg border border-slate-800 flex items-center gap-3 bg-slate-900/30`} onMouseEnter={onMouseEnter}>
        <div className="w-12 h-12 bg-slate-800/50 rounded-md flex-shrink-0 flex items-center justify-center">
            <ShieldIcon className="h-6 w-6 text-slate-600" />
        </div>
        <div className="flex-grow">
            <p className="font-semibold text-slate-600">{slotName}</p>
        </div>
    </div>
);


interface ItemListProps {
    items: ItemInstance[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    selectedItem: ItemInstance | null;
    selectedIds?: Set<string>; // New prop for multi-select
    onSelectItem: (item: ItemInstance) => void;
    showPrice?: 'buy' | 'sell' | 'buy-special' | ((item: any) => 'buy' | 'sell' | 'buy-special');
    meetsRequirements?: (item: ItemInstance) => boolean;
}

export const ItemList: React.FC<ItemListProps> = ({ items, itemTemplates, affixes, selectedItem, selectedIds, onSelectItem, showPrice, meetsRequirements }) => {
    return (
        <div className="flex-grow overflow-y-auto pr-2 space-y-1">
            {items.map(item => {
                const template = itemTemplates.find(t => t.id === item.templateId);
                if (!template) return null;
                
                // Determine selection status: either match single selected item OR be present in selectedIds set
                const isSelected = selectedItem?.uniqueId === item.uniqueId || (selectedIds ? selectedIds.has(item.uniqueId) : false);
                
                let price;
                if (showPrice) {
                    let itemValue = Number(template.value) || 0;
                    if (item.prefixId && affixes) {
                        const prefix = affixes.find(a => a.id === item.prefixId);
                        itemValue += Number(prefix?.value) || 0;
                    }
                    if (item.suffixId && affixes) {
                        const suffix = affixes.find(a => a.id === item.suffixId);
                        itemValue += Number(suffix?.value) || 0;
                    }
                    const priceType = typeof showPrice === 'function' ? showPrice(item) : showPrice;
                    const multiplier = priceType === 'buy' ? 2 : priceType === 'buy-special' ? 5 : 1;
                    price = itemValue * multiplier;
                }
                
                // Extra styling for multi-selected items in sell mode
                const multiSelectClass = (selectedIds && selectedIds.has(item.uniqueId)) ? 'ring-2 ring-amber-500 bg-amber-900/20' : '';

                return (
                    <ItemListItem
                        key={item.uniqueId}
                        item={item}
                        template={template}
                        affixes={affixes}
                        isSelected={isSelected}
                        onClick={() => onSelectItem(item)}
                        price={price}
                        showPrimaryStat={false}
                        meetsRequirements={meetsRequirements ? meetsRequirements(item) : true}
                        className={multiSelectClass}
                    />
                );
            })}
        </div>
    );
};
