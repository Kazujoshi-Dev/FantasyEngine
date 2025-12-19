
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

// Pomocnicza funkcja do wyciągania sumarycznych statystyk instancji przedmiotu
const getItemTotalStats = (item: ItemInstance, template: ItemTemplate) => {
    const stats: any = {
        damageMin: 0, damageMax: 0, armorBonus: 0, maxHealthBonus: 0,
        critChanceBonus: 0, critDamageModifierBonus: 0, attacksPerRoundBonus: 0,
        dodgeChanceBonus: 0, magicDamageMin: 0, magicDamageMax: 0,
        statsBonus: {} as any
    };

    const upgradeFactor = (item.upgradeLevel || 0) * 0.1;
    const affixUpgradeFactor = Math.min(item.upgradeLevel || 0, 5) * 0.1;

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

    return [getName(prefixAffix), template.name, getName(suffixAffix)].filter(Boolean).join(' ');
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
    itemTemplates?: ItemTemplate[]; // Added prop to fix missing lookup
}> = ({ item, template, affixes, children, showIcon = true, character, size, hideAffixes, title, compact = false, compareWith, itemTemplates = [] }) => {
    const { t } = useTranslation();
    const isSmall = size === 'small';
    const safeAffixes = affixes || [];
    
    // Total stats calculation moved inside to fix context reference if needed
    const itemTotalStats = useMemo(() => item && template ? getItemTotalStats(item, template) : null, [item, template]);
    
    // Fixed: Use itemTemplates prop instead of non-existent gameData
    const compareTotalStats = useMemo(() => {
        if (!compareWith || !itemTemplates || itemTemplates.length === 0) return null;
        const compTemplate = itemTemplates.find(t => t.id === compareWith.templateId);
        return compTemplate ? getItemTotalStats(compareWith, compTemplate) : null;
    }, [compareWith, itemTemplates]);

    if (!item || !template) {
        return <div className="flex items-center justify-center h-full text-slate-500">{title ? null : t('equipment.selectItemPrompt')}</div>;
    }

    const upgradeLevel = item.upgradeLevel || 0;
    const prefix = safeAffixes.find(a => a.id === item?.prefixId);
    const suffix = safeAffixes.find(a => a.id === item?.suffixId);

    const StatSection: React.FC<{title?: string, source: RolledAffixStats | ItemTemplate, metadata: any, isAffix: boolean}> = ({title, source, metadata, isAffix}) => {
        const upgradeFactor = isAffix ? Math.min(upgradeLevel, 5) * 0.1 : upgradeLevel * 0.1;
        const s = source as any;

        const renderStat = (label: string, value: number, compareKey: string, isPercent = false, isAttribute = false) => {
            const finalVal = Math.round(value * (1 + upgradeFactor) * 10) / 10;
            let delta = 0;
            
            if (compareTotalStats) {
                const compVal = isAttribute 
                    ? (compareTotalStats.statsBonus?.[compareKey] || 0)
                    : (compareTotalStats[compareKey] || 0);
                delta = finalVal - Math.round(compVal * 10) / 10;
            }

            return (
                <p key={label} className="flex justify-between items-center">
                    <span>{label}:</span>
                    <span className="font-mono flex items-center gap-1">
                        {isPercent ? `${finalVal.toFixed(1)}%` : Math.round(finalVal)}
                        {compareTotalStats && delta !== 0 && (
                            <span className={`text-[10px] font-bold ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                ({delta > 0 ? '+' : ''}{isPercent ? delta.toFixed(1) : Math.round(delta)})
                            </span>
                        )}
                    </span>
                </p>
            );
        };

        const entries = [];
        if (s.statsBonus) {
            Object.entries(s.statsBonus).forEach(([k, v]) => {
                if (v) entries.push(renderStat(t(`statistics.${k}`), v as number, k, false, true));
            });
        }
        if (s.damageMin !== undefined) entries.push(renderStat(t('item.damage'), s.damageMax, 'damageMax'));
        if (s.armorBonus !== undefined) entries.push(renderStat(t('statistics.armor'), s.armorBonus, 'armorBonus'));
        if (s.critChanceBonus !== undefined) entries.push(renderStat(t('statistics.critChance'), s.critChanceBonus, 'critChanceBonus', true));
        if (s.maxHealthBonus !== undefined) entries.push(renderStat(t('statistics.health'), s.maxHealthBonus, 'maxHealthBonus'));
        
        if (entries.length === 0) return null;

        return (
            <div className={`bg-slate-800/50 p-2 rounded-lg mt-2 ${isSmall ? 'text-xs space-y-0.5' : 'text-sm space-y-1'}`}>
                {title && <h5 className="font-semibold text-gray-400 border-b border-white/5 mb-1">{title}</h5>}
                {entries}
            </div>
        );
    };

    return (
        <div className={`flex flex-col ${compact ? '' : 'h-full'}`}>
            <div className={`${compact ? '' : 'flex-grow overflow-y-auto'} ${isSmall ? 'pr-1' : 'pr-2'}`}>
                <h4 className={`font-bold text-center ${rarityStyles[template.rarity].text} ${isSmall ? 'text-lg mb-1' : 'text-xl mb-2'}`}>
                    {getGrammaticallyCorrectFullName(item, template, safeAffixes)} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </h4>
                {showIcon && template.icon && <img src={template.icon} alt={template.name} className="w-32 h-32 object-contain mx-auto mb-4 bg-slate-900 rounded-lg p-2 border border-white/5" />}
                
                <StatSection source={item.rolledBaseStats || template} metadata={template} isAffix={false} />
                {!hideAffixes && item.rolledPrefix && prefix && <StatSection title={t('admin.affix.prefix')} source={item.rolledPrefix} metadata={prefix} isAffix={true} />}
                {!hideAffixes && item.rolledSuffix && suffix && <StatSection title={t('admin.affix.suffix')} source={item.rolledSuffix} metadata={suffix} isAffix={true} />}
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
    price?: number; // Added prop for price display
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
    itemTemplates?: ItemTemplate[]; // Added prop to support comparison lookups
}> = ({ instance, template, affixes, character, compareWith, x, y, itemTemplates = [] }) => {
    const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
    
    useEffect(() => {
        if (x === undefined || y === undefined) {
            setStyle({ visibility: 'inherit', width: '300px' });
            return;
        }

        const tooltipWidth = 300;
        let finalX = x + 20;
        let finalY = y + 20;

        if (finalX + tooltipWidth > window.innerWidth) finalX = x - tooltipWidth - 20;
        if (finalY + 400 > window.innerHeight) finalY = window.innerHeight - 420;

        setStyle({ left: `${finalX}px`, top: `${finalY}px`, visibility: 'visible', width: `${tooltipWidth}px` });
    }, [x, y]);

    return (
        <div 
            className={`${x !== undefined ? 'fixed' : 'absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block'} z-[9999] bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-4 pointer-events-none backdrop-blur-md animate-fade-in`}
            style={style}
        >
            <ItemDetailsPanel 
                item={instance} 
                template={template} 
                affixes={affixes} 
                size="small" 
                compact={true} 
                character={character} 
                compareWith={compareWith} 
                itemTemplates={itemTemplates} 
            />
            {compareWith && (
                <div className="mt-3 pt-2 border-t border-white/10 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Tryb Porównania Aktywny</span>
                </div>
            )}
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
    priceSelector?: (item: ItemInstance) => number; // Added prop for price calculation
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
