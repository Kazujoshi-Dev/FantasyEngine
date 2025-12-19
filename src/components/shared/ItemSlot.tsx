
import React, { useMemo, useState, useEffect } from 'react';
import { ItemRarity, ItemTemplate, ItemInstance, EquipmentSlot, PlayerCharacter, CharacterStats, Affix, RolledAffixStats, GrammaticalGender } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon'; 
import { ShieldIcon } from '../icons/ShieldIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { HandshakeIcon } from '../icons/HandshakeIcon';

export const rarityStyles = {
    [ItemRarity.Common]: { border: 'border-slate-700', bg: 'bg-slate-800', shadow: 'shadow-none', text: 'text-gray-300' },
    [ItemRarity.Uncommon]: { border: 'border-green-700', bg: 'bg-green-950', shadow: 'shadow-md shadow-green-500/10', text: 'text-green-400' },
    [ItemRarity.Rare]: { border: 'border-sky-700', bg: 'bg-sky-950', shadow: 'shadow-md shadow-sky-500/10', text: 'text-sky-400' },
    [ItemRarity.Epic]: { border: 'border-purple-700', bg: 'bg-purple-950', shadow: 'shadow-md shadow-purple-500/10', text: 'text-purple-400' },
    [ItemRarity.Legendary]: { border: 'border-amber-600', bg: 'bg-amber-950', shadow: 'shadow-md shadow-amber-500/10', text: 'text-amber-400' },
};

const getItemTotalStats = (item: ItemInstance, template: ItemTemplate) => {
    const stats: any = {
        damageMin: 0, damageMax: 0, armorBonus: 0, maxHealthBonus: 0,
        critChanceBonus: 0, critDamageModifierBonus: 0, attacksPerRound: 0, attacksPerRoundBonus: 0,
        dodgeChanceBonus: 0, magicDamageMin: 0, magicDamageMax: 0,
        armorPenetrationPercent: 0, armorPenetrationFlat: 0,
        lifeStealPercent: 0, lifeStealFlat: 0,
        manaStealPercent: 0, manaStealFlat: 0,
        statsBonus: {} as any
    };

    const upgradeFactor = (item.upgradeLevel || 0) * 0.1;
    const affixUpgradeFactor = Math.min(item.upgradeLevel || 0, 5) * 0.1;

    // Podstawa szybkości ataku zawsze z szablonu
    stats.attacksPerRound = template.attacksPerRound || 0;

    const applySource = (source: RolledAffixStats | undefined, factor: number) => {
        if (!source) return;
        if (source.damageMin) stats.damageMin += source.damageMin * (1 + factor);
        if (source.damageMax) stats.damageMax += source.damageMax * (1 + factor);
        if (source.armorBonus) stats.armorBonus += source.armorBonus * (1 + factor);
        if (source.maxHealthBonus) stats.maxHealthBonus += source.maxHealthBonus * (1 + factor);
        if (source.critChanceBonus) stats.critChanceBonus += source.critChanceBonus * (1 + factor);
        if (source.critDamageModifierBonus) stats.critDamageModifierBonus += source.critDamageModifierBonus * (1 + factor);
        if (source.attacksPerRoundBonus) stats.attacksPerRoundBonus += source.attacksPerRoundBonus * (1 + factor);
        if (source.dodgeChanceBonus) stats.dodgeChanceBonus += source.dodgeChanceBonus * (1 + factor);
        if (source.magicDamageMin) stats.magicDamageMin += source.magicDamageMin * (1 + factor);
        if (source.magicDamageMax) stats.magicDamageMax += source.magicDamageMax * (1 + factor);
        
        if (source.statsBonus) {
            Object.entries(source.statsBonus).forEach(([k, v]) => {
                stats.statsBonus[k] = (stats.statsBonus[k] || 0) + (v as number) * (1 + factor);
            });
        }
    };

    applySource(item.rolledBaseStats, upgradeFactor);
    applySource(item.rolledPrefix, affixUpgradeFactor);
    applySource(item.rolledSuffix, affixUpgradeFactor);

    return stats;
};

export const getGrammaticallyCorrectAffixName = (affix: Affix | undefined, template: ItemTemplate): string => {
    if (!affix) return '';
    let genderKey: 'masculine' | 'feminine' | 'neuter' = 'masculine';
    if (template.gender === GrammaticalGender.Feminine) {
        genderKey = 'feminine';
    } else if (template.gender === GrammaticalGender.Neuter) {
        genderKey = 'neuter';
    }
    
    if (typeof affix.name === 'string') return affix.name;
    return (affix.name as any)[genderKey] || affix.name.masculine || '';
};

export const getGrammaticallyCorrectFullName = (item: ItemInstance, template: ItemTemplate, affixes: Affix[]): string => {
    const safeAffixes = affixes || [];
    const prefixAffix = safeAffixes.find(a => a.id === item.prefixId);
    const suffixAffix = safeAffixes.find(a => a.id === item.suffixId);
    
    return [
        getGrammaticallyCorrectAffixName(prefixAffix, template),
        template.name,
        getGrammaticallyCorrectAffixName(suffixAffix, template)
    ].filter(Boolean).join(' ');
}

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
    compareWith?: ItemInstance | null;
    itemTemplates?: ItemTemplate[];
}> = ({ item, template, affixes, children, showIcon = true, character, size, hideAffixes, title, compact = false, compareWith, itemTemplates = [] }) => {
    const { t } = useTranslation();
    const isSmall = size === 'small';
    const safeAffixes = affixes || [];
    
    const compareTotalStats = useMemo(() => {
        // Blokada porównywania, jeśli to ten sam przedmiot (uniqueId match)
        if (!compareWith || !itemTemplates || itemTemplates.length === 0 || !item || compareWith.uniqueId === item.uniqueId) return null;
        const compTemplate = itemTemplates.find(t => t.id === compareWith.templateId);
        return compTemplate ? getItemTotalStats(compareWith, compTemplate) : null;
    }, [compareWith, itemTemplates, item]);

    if (!item || !template) {
        return <div className="flex items-center justify-center h-full text-slate-500">{title ? null : t('equipment.selectItemPrompt')}</div>;
    }

    const upgradeLevel = item.upgradeLevel || 0;
    const prefix = safeAffixes.find(a => a.id === item?.prefixId);
    const suffix = safeAffixes.find(a => a.id === item?.suffixId);

    const StatSection: React.FC<{title?: string, source: RolledAffixStats | ItemTemplate, metadata: ItemTemplate | Affix, isAffix: boolean}> = ({title, source, metadata, isAffix}) => {
        const upgradeFactor = isAffix ? Math.min(upgradeLevel, 5) * 0.1 : upgradeLevel * 0.1;
        const s = source as any;

        const checkPerfect = (key: string, value: number, isAttribute: boolean = false): boolean => {
            if (!metadata) return false;
            let metaVal = isAttribute ? (metadata as any).statsBonus?.[key] : (metadata as any)[key];
            if (!metaVal) return false;
            if (typeof metaVal !== 'object' || metaVal === null) return false;
            const maxVal = metaVal.max || 0;
            return value >= maxVal;
        };

        const renderStat = (label: string, value: number | [number, number], compareKey: string | [string, string], isPercent = false, isAttribute = false) => {
            const isRange = Array.isArray(value);
            const val1 = isRange ? value[0] : value;
            const val2 = isRange ? value[1] : 0;
            
            // WYMUSZONE ZAOKRĄGLENIE DO LICZB CAŁKOWITYCH
            const finalVal1 = Math.round(val1 * (1 + upgradeFactor));
            const finalVal2 = isRange ? Math.round(val2 * (1 + upgradeFactor)) : 0;
            
            const isPerfect = isRange 
                ? (checkPerfect((compareKey as [string, string])[0], val1) && checkPerfect((compareKey as [string, string])[1], val2))
                : checkPerfect(compareKey as string, val1, isAttribute);

            let delta = 0;
            if (compareTotalStats) {
                if (isRange) {
                    const ck = compareKey as [string, string];
                    const compVal1 = Math.round((compareTotalStats[ck[0]] || 0));
                    const compVal2 = Math.round((compareTotalStats[ck[1]] || 0));
                    delta = (finalVal1 + finalVal2) / 2 - (compVal1 + compVal2) / 2;
                } else {
                    const ck = compareKey as string;
                    const compVal = isAttribute 
                        ? (compareTotalStats.statsBonus?.[ck] || 0)
                        : (compareTotalStats[ck] || 0);
                    delta = finalVal1 - Math.round(compVal);
                }
            }

            const perfectClasses = "text-amber-400 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse";

            return (
                <div key={label} className={`flex justify-between items-center py-0.5 ${isPerfect ? 'relative' : ''}`}>
                    <span className={`flex items-center gap-1 ${isPerfect ? 'text-amber-300 font-semibold' : 'text-gray-400'}`}>
                        {label}:
                    </span>
                    <span className={`font-mono flex items-center gap-1 ${isPerfect ? perfectClasses : 'text-gray-200'}`}>
                        {isRange 
                            ? `${finalVal1} - ${finalVal2}`
                            : isPercent ? `${finalVal1}%` : finalVal1}
                        
                        {compareTotalStats && Math.round(delta) !== 0 && (
                            <span className={`text-[10px] font-bold ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                ({delta > 0 ? '+' : ''}{Math.round(delta)})
                            </span>
                        )}
                        {isPerfect && <SparklesIcon className="h-3 w-3 text-amber-400 ml-1" />}
                    </span>
                </div>
            );
        };

        const entries = [];
        // Primary Attributes
        if (s.statsBonus) {
            Object.entries(s.statsBonus).forEach(([k, v]) => {
                if (v) entries.push(renderStat(t(`statistics.${k}`), v as number, k, false, true));
            });
        }
        
        // Base Combat Stats
        if (s.damageMin !== undefined && s.damageMax !== undefined) entries.push(renderStat(t('item.damage'), [s.damageMin, s.damageMax], ['damageMin', 'damageMax']));
        if (s.magicDamageMin !== undefined && s.magicDamageMax > 0) entries.push(renderStat(t('statistics.magicDamage'), [s.magicDamageMin, s.magicDamageMax], ['magicDamageMin', 'magicDamageMax']));
        
        // SZYBKOŚĆ ATAKU - Naprawione pobieranie z szablonu bazy i bonusów afiksów
        if (!isAffix && (metadata as ItemTemplate).attacksPerRound) {
            entries.push(renderStat(t('item.attacksPerRound'), (metadata as ItemTemplate).attacksPerRound!, 'attacksPerRound'));
        }
        if (s.attacksPerRoundBonus && s.attacksPerRoundBonus > 0) {
            entries.push(renderStat(t('item.attacksPerRoundBonus'), s.attacksPerRoundBonus, 'attacksPerRoundBonus'));
        }

        // Obrona i Inne
        if (s.armorBonus !== undefined && s.armorBonus > 0) entries.push(renderStat(t('statistics.armor'), s.armorBonus, 'armorBonus'));
        if (s.dodgeChanceBonus !== undefined && s.dodgeChanceBonus > 0) entries.push(renderStat(t('statistics.dodgeChance'), s.dodgeChanceBonus, 'dodgeChanceBonus', true));
        
        // Krytyki i Zdrowie
        if (s.critChanceBonus !== undefined && s.critChanceBonus > 0) entries.push(renderStat(t('statistics.critChance'), s.critChanceBonus, 'critChanceBonus', true));
        if (s.critDamageModifierBonus !== undefined && s.critDamageModifierBonus > 0) entries.push(renderStat(t('statistics.critDamageModifier'), s.critDamageModifierBonus, 'critDamageModifierBonus', true));
        if (s.maxHealthBonus !== undefined && s.maxHealthBonus > 0) entries.push(renderStat(t('statistics.health'), s.maxHealthBonus, 'maxHealthBonus'));
        
        // Zaawansowane (Leech & Pen)
        if (s.armorPenetrationPercent !== undefined && s.armorPenetrationPercent > 0) entries.push(renderStat(t('item.armorPenetrationPercent'), s.armorPenetrationPercent, 'armorPenetrationPercent', true));
        if (s.lifeStealPercent !== undefined && s.lifeStealPercent > 0) entries.push(renderStat(t('item.lifeStealPercent'), s.lifeStealPercent, 'lifeStealPercent', true));
        if (s.manaStealPercent !== undefined && s.manaStealPercent > 0) entries.push(renderStat(t('item.manaStealPercent'), s.manaStealPercent, 'manaStealPercent', true));
        
        if (entries.length === 0) return null;

        return (
            <div className={`bg-slate-900/60 p-3 rounded-lg mt-2 border border-white/5 ${isSmall ? 'text-xs' : 'text-sm'}`}>
                {title && <h5 className="font-black uppercase text-[9px] tracking-widest text-indigo-400 border-b border-white/5 mb-2 pb-1">{title}</h5>}
                <div className="space-y-0.5">{entries}</div>
            </div>
        );
    };

    return (
        <div className={`flex flex-col ${compact ? '' : 'h-full'}`}>
            <div className={`${compact ? '' : 'flex-grow overflow-y-auto'} ${isSmall ? 'pr-1' : 'pr-2'}`}>
                {title && <h5 className="text-center font-black uppercase text-[10px] tracking-widest text-gray-500 mb-2">{title}</h5>}
                <h4 className={`font-bold text-center ${rarityStyles[template.rarity].text} ${isSmall ? 'text-lg mb-1' : 'text-xl mb-2'}`}>
                    {getGrammaticallyCorrectFullName(item, template, safeAffixes)} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </h4>
                
                {showIcon && template.icon && (
                    <div className="relative group mb-4">
                        <img src={template.icon} alt={template.name} className="w-32 h-32 object-contain mx-auto bg-slate-900 rounded-lg p-2 border border-white/5 shadow-inner" />
                        {item.crafterName && (
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-lg whitespace-nowrap border border-amber-400/50">
                                WYKUTY PRZEZ: {item.crafterName.toUpperCase()}
                            </div>
                        )}
                    </div>
                )}
                
                <StatSection source={item.rolledBaseStats || template} metadata={template} isAffix={false} />
                {!hideAffixes && item.rolledPrefix && prefix && (
                    <StatSection 
                        title={`PREFIKS: ${getGrammaticallyCorrectAffixName(prefix, template).toUpperCase()}`} 
                        source={item.rolledPrefix} 
                        metadata={prefix} 
                        isAffix={true} 
                    />
                )}
                {!hideAffixes && item.rolledSuffix && suffix && (
                    <StatSection 
                        title={`SUFIKS: ${getGrammaticallyCorrectAffixName(suffix, template).toUpperCase()}`} 
                        source={item.rolledSuffix} 
                        metadata={suffix} 
                        isAffix={true} 
                    />
                )}
            </div>
        </div>
    );
};

export const ItemListItem: React.FC<{
    item: ItemInstance;
    template: ItemTemplate;
    affixes: Affix[];
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick?: () => void;
    showPrimaryStat?: boolean;
    isEquipped?: boolean;
    meetsRequirements?: boolean;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    className?: string;
    price?: number;
}> = ({ item, template, affixes, isSelected, onClick, onDoubleClick, isEquipped, meetsRequirements = true, onMouseEnter, onMouseLeave, className, price }) => {
    const style = rarityStyles[template.rarity];
    const upgradeLevel = item.upgradeLevel || 0;

    return (
        <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`flex items-center p-2 rounded-lg cursor-pointer border transition-all duration-200 ${
                isSelected ? 'ring-2 ring-indigo-500 bg-indigo-900/20' : 'bg-slate-800/50 hover:bg-slate-700/50 border-transparent'
            } ${!meetsRequirements ? 'opacity-50 grayscale' : ''} ${className || ''}`}
        >
            <div className={`w-10 h-10 rounded border ${style.border} ${style.bg} flex items-center justify-center mr-3 relative shadow-inner`}>
                {template.icon ? <img src={template.icon} alt="" className="w-8 h-8 object-contain" /> : <ShieldIcon className="w-6 h-6 text-slate-600" />}
                {isEquipped && <div className="absolute -top-1 -left-1 bg-green-500 rounded-full p-0.5 shadow-md border border-slate-900"><ShieldIcon className="w-2 h-2 text-white" /></div>}
            </div>
            <div className="flex-grow min-w-0">
                <p className={`text-sm font-bold truncate ${style.text}`}>{getGrammaticallyCorrectFullName(item, template, affixes)} {upgradeLevel > 0 && `+${upgradeLevel}`}</p>
                <div className="flex justify-between items-center">
                    <p className="text-[9px] text-gray-500 uppercase tracking-tighter">{template.slot}</p>
                    {price !== undefined && (
                        <div className="flex items-center gap-0.5 text-amber-400 font-mono text-[10px] font-bold">
                            {price.toLocaleString()} <CoinsIcon className="h-2.5 w-2.5" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const EmptySlotListItem: React.FC<{ slotName: string }> = ({ slotName }) => (
    <div className="flex items-center p-2 rounded-lg bg-slate-900/20 border border-dashed border-slate-800 opacity-40">
        <div className="w-10 h-10 rounded border border-slate-800 bg-slate-950 flex items-center justify-center mr-3">
            <ShieldIcon className="w-5 h-5 text-slate-800" />
        </div>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{slotName}</p>
    </div>
);

export const ItemTooltip: React.FC<{
    instance: ItemInstance;
    template: ItemTemplate;
    affixes: Affix[];
    character?: PlayerCharacter;
    compareWith?: ItemInstance | null;
    x?: number;
    y?: number;
    itemTemplates?: ItemTemplate[];
    isCentered?: boolean;
}> = ({ instance, template, affixes, character, compareWith, x, y, itemTemplates = [], isCentered }) => {
    const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
    
    useEffect(() => {
        if (isCentered) {
            const tooltipWidth = compareWith ? 620 : 300;
            setStyle({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                visibility: 'inherit',
                width: `${tooltipWidth}px`,
                zIndex: 10000,
                pointerEvents: 'none'
            });
            return;
        }

        if (x === undefined || y === undefined) {
            setStyle({ visibility: 'inherit', width: '300px' });
            return;
        }

        // Jeśli najeżdżamy na ten sam przedmiot, szerokość powinna być standardowa (brak porównania)
        const isSameItem = compareWith?.uniqueId === instance.uniqueId;
        const tooltipWidth = (compareWith && !isSameItem) ? 620 : 300;
        let finalX = x + 20;
        let finalY = y + 20;

        if (finalX + tooltipWidth > window.innerWidth) finalX = x - tooltipWidth - 20;
        if (finalY + 450 > window.innerHeight) finalY = window.innerHeight - 470;

        setStyle({ left: `${finalX}px`, top: `${finalY}px`, visibility: 'visible', width: `${tooltipWidth}px` });
    }, [x, y, compareWith, instance.uniqueId, isCentered]);

    const isSameItem = compareWith?.uniqueId === instance.uniqueId;
    const actualCompareWith = isSameItem ? null : compareWith;
    const compareTemplate = actualCompareWith ? itemTemplates.find(t => t.id === actualCompareWith.templateId) : null;

    return (
        <div 
            className={`${isCentered ? 'fixed' : (x !== undefined ? 'fixed' : 'absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block')} z-[9999] bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-4 pointer-events-none backdrop-blur-md animate-fade-in flex gap-4`}
            style={style}
        >
            {actualCompareWith && compareTemplate && (
                <div className="w-[280px] border-r border-white/5 pr-4">
                    <ItemDetailsPanel 
                        item={actualCompareWith} 
                        template={compareTemplate} 
                        affixes={affixes} 
                        size="small" 
                        compact={true} 
                        title="OBECNIE ZAŁOŻONY"
                        itemTemplates={itemTemplates}
                    />
                </div>
            )}
            <div className={actualCompareWith ? 'w-[280px]' : 'w-full'}>
                <ItemDetailsPanel 
                    item={instance} 
                    template={template} 
                    affixes={affixes} 
                    size="small" 
                    compact={true} 
                    character={character} 
                    compareWith={actualCompareWith} 
                    itemTemplates={itemTemplates} 
                    title={actualCompareWith ? "NOWY PRZEDMIOT" : undefined}
                />
            </div>
        </div>
    );
};

export const ItemList: React.FC<{
    items: ItemInstance[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    selectedItem: ItemInstance | null;
    onSelectItem: (item: ItemInstance) => void;
    selectedIds?: Set<string>;
    priceSelector?: (item: ItemInstance) => number;
}> = ({ items, itemTemplates, affixes, selectedItem, onSelectItem, selectedIds, priceSelector }) => (
    <div className="space-y-1">
        {items.map(item => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            if (!template) return null;
            return (
                <ItemListItem
                    key={item.uniqueId}
                    item={item}
                    template={template}
                    affixes={affixes}
                    isSelected={selectedItem?.uniqueId === item.uniqueId || !!selectedIds?.has(item.uniqueId)}
                    onClick={() => onSelectItem(item)}
                    price={priceSelector ? priceSelector(item) : undefined}
                />
            );
        })}
    </div>
);
