
import React, { useMemo } from 'react';
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
            return {
                ...item.rolledBaseStats,
                attacksPerRound: template.attacksPerRound,
                manaCost: template.manaCost,
                magicAttackType: template.magicAttackType
            };
        }
        return template;
    }, [item, template]);

    const prefix = useMemo(() => safeAffixes.find(a => a.id === item?.prefixId), [safeAffixes, item?.prefixId]);
    const suffix = useMemo(() => safeAffixes.find(a => a.id === item?.suffixId), [safeAffixes, item?.suffixId]);

    // Helper to get affix name based on item gender
    const getName = (affix: Affix | undefined) => {
        if (!affix || !template) return '';
        if (typeof affix.name === 'string') return affix.name;
        
        let genderKey: 'masculine' | 'feminine' | 'neuter' = 'masculine';
        if (template.gender === GrammaticalGender.Feminine) {
            genderKey = 'feminine';
        } else if (template.gender === GrammaticalGender.Neuter) {
            genderKey = 'neuter';
        }
        return (affix.name as any)[genderKey] || affix.name.masculine || '';
    };

    // Calculate totalValue including affixes
    const totalValue = useMemo(() => {
        if (!template) return 0;
        let val = Number(template.value) || 0;
        if (prefix) val += Number(prefix.value) || 0;
        if (suffix) val += Number(suffix.value) || 0;
        return val;
    }, [template, prefix, suffix]);

    if (!item || !template) {
        return <div className="flex items-center justify-center h-full text-slate-500">{title ? null : t('equipment.selectItemPrompt')}</div>;
    }

    const upgradeLevel = item.upgradeLevel || 0;
    const baseUpgradeFactor = upgradeLevel * 0.1;
    const affixUpgradeFactor = Math.min(upgradeLevel, 5) * 0.1;
    
    const fullName = getGrammaticallyCorrectFullName(item, template, safeAffixes);

    const StatSection: React.FC<{title?: string, source: RolledAffixStats | ItemTemplate, metadata: any, isAffix: boolean}> = ({title, source, metadata, isAffix}) => {
        const bonusFactor = isAffix ? affixUpgradeFactor : baseUpgradeFactor;
        
        const getValue = (val: any): number => {
            if (typeof val === 'number') return val;
            if (val && typeof val.max === 'number') return val.max;
            return 0;
        };

        const checkPerfect = (key: string, rolledVal: any): boolean => {
            if (rolledVal === undefined || !metadata) return false;
            let metaVal = metadata[key];
            if (key.startsWith('statsBonus.')) {
                const statKey = key.split('.')[1];
                metaVal = metadata.statsBonus?.[statKey];
            }
            if (!metaVal) return false;
            const maxPossible = getValue(metaVal);
            return maxPossible > 0 && rolledVal >= maxPossible;
        };

        const calculateStat = (base?: any) => {
             const val = getValue(base);
             return val !== undefined ? val + Math.round(val * bonusFactor) : undefined;
        }

        const calculateFloatStat = (base?: any) => {
             const val = getValue(base);
             return val !== undefined ? val + val * bonusFactor : undefined;
        }
        
        const s = source as any;
        
        const entries = [
            ...(s.statsBonus ? Object.entries(s.statsBonus).filter(([,v])=>v).map(([k,v]) => ({
                label: t(`statistics.${k}`), 
                value: `+${calculateStat(v)}`, 
                isPerfect: checkPerfect(`statsBonus.${k}`, v),
                color: 'text-green-300'
            })) : []),
            (s.damageMin !== undefined) && {label: t('item.damage'), value: `${calculateStat(s.damageMin)}-${calculateStat(s.damageMax)}`, isPerfect: checkPerfect('damageMax', s.damageMax)},
            (s.attacksPerRound !== undefined || s.attacksPerRoundBonus !== undefined) && { label: t('statistics.attacksPerTurn'), value: s.attacksPerRound || `+${s.attacksPerRoundBonus}` },
            (s.armorBonus !== undefined) && {label: t('statistics.armor'), value: `+${calculateStat(s.armorBonus)}`, isPerfect: checkPerfect('armorBonus', s.armorBonus)},
            (s.critChanceBonus !== undefined) && {label: t('statistics.critChance'), value: `+${(calculateFloatStat(s.critChanceBonus))?.toFixed(1)}%`, isPerfect: checkPerfect('critChanceBonus', s.critChanceBonus)},
            (s.maxHealthBonus !== undefined) && {label: t('statistics.health'), value: `+${calculateStat(s.maxHealthBonus)}`, isPerfect: checkPerfect('maxHealthBonus', s.maxHealthBonus)},
            (s.critDamageModifierBonus !== undefined) && {label: t('statistics.critDamageModifier'), value: `+${calculateStat(s.critDamageModifierBonus)}%`, isPerfect: checkPerfect('critDamageModifierBonus', s.critDamageModifierBonus)},
            (s.armorPenetrationPercent || s.armorPenetrationFlat) && {label: t('statistics.armorPenetration'), value: `${s.armorPenetrationPercent ? getValue(s.armorPenetrationPercent) : 0}% / ${calculateStat(s.armorPenetrationFlat)}`},
            (s.lifeStealPercent || s.lifeStealFlat) && {label: t('statistics.lifeSteal'), value: `${s.lifeStealPercent ? getValue(s.lifeStealPercent) : 0}% / ${calculateStat(s.lifeStealFlat)}`},
            (s.manaStealPercent || s.manaStealFlat) && {label: t('statistics.manaSteal'), value: `${s.manaStealPercent ? getValue(s.manaStealPercent) : 0}% / ${calculateStat(s.manaStealFlat)}`},
            (s.magicDamageMin !== undefined) && {label: t('statistics.magicDamage'), value: `${calculateStat(s.magicDamageMin)}-${calculateStat(s.magicDamageMax)}`, isPerfect: checkPerfect('magicDamageMax', s.magicDamageMax), color: 'text-purple-300'},
            (s.manaCost?.min !== undefined) && {label: t('item.manaCost'), value: s.manaCost.min === s.manaCost.max ? `${s.manaCost.min}` : `${s.manaCost.min}-${s.manaCost.max}`, color: 'text-cyan-300'},
            (s.magicAttackType !== undefined) && {label: t('item.magicAttackType'), value: t(`item.magic.${s.magicAttackType}`), color: 'text-purple-300', valueClass: 'font-semibold'},
            (s.dodgeChanceBonus !== undefined) && {label: t('item.dodgeChanceBonus'), value: `+${calculateFloatStat(s.dodgeChanceBonus)?.toFixed(1)}%`, isPerfect: checkPerfect('dodgeChanceBonus', s.dodgeChanceBonus)},
        ].filter(Boolean);

        if (entries.length === 0) return null;
        
        return (
             <div className={`bg-slate-800/50 p-2 rounded-lg mt-2 ${isSmall ? 'text-xs space-y-0.5' : 'text-sm space-y-1'}`}>
                {title && <h5 className={`font-semibold text-gray-400 ${isSmall ? 'text-sm' : 'text-base'}`}>{title}</h5>}
                {entries.map((e: any, i: number) => (
                    <p key={i} className={`flex justify-between ${e.color || ''}`}>
                        <span className="flex items-center gap-1">
                            {e.label}:
                            {/* Fixed: title prop not supported directly on SVG component in some configs, wrapped in span */}
                            {e.isPerfect && <span title="Maksymalna wartość!"><SparklesIcon className="h-3 w-3 text-amber-400 animate-pulse" /></span>}
                        </span> 
                        <span className={`${e.valueClass || 'font-mono'} ${e.isPerfect ? 'text-amber-400 font-bold drop-shadow-[0_0_3px_rgba(251,191,36,0.6)]' : ''}`}>
                            {e.value}
                        </span>
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
                        <span>{t('item.slotLabel')}:</span> <span className="font-semibold text-white">{t(`equipment.slot.${template.slot}`)}</span>
                    </p>
                    <p className={`flex justify-between ${isSmall ? 'text-xs' : 'text-sm'}`}>
                        {/* Fixed: totalValue missing error */}
                        <span>{t('item.value')}:</span> <span className="font-mono text-amber-400 flex items-center">{totalValue} <CoinsIcon className="h-4 w-4 ml-1"/></span>
                    </p>
                </div>

                {baseStatsSource && <StatSection source={baseStatsSource} metadata={template} isAffix={false} />}
                {/* Fixed: getName missing error */}
                {!hideAffixes && item.rolledPrefix && prefix && <StatSection title={`${getName(prefix)} (${t('admin.affix.prefix')})`} source={item.rolledPrefix} metadata={prefix} isAffix={true} />}
                {!hideAffixes && item.rolledSuffix && suffix && <StatSection title={`${getName(suffix)} (${t('admin.affix.suffix')})`} source={item.rolledSuffix} metadata={suffix} isAffix={true} />}

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
                                const meetsReq = character ? character.stats[stat as keyof CharacterStats] >= (value as number) : true;
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
            
            {item.crafterName && (
                <div className={`mt-3 pt-2 border-t border-slate-700/50 text-right ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
                    <span className="text-gray-500">{t('item.createdBy')}: </span>
                    <span className="text-amber-500 font-bold italic">{item.crafterName}</span>
                </div>
            )}

            {children && <div className="flex-shrink-0">{children}</div>}
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
    draggable?: string;
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
}> = ({ item, template, affixes, isSelected, onClick, onDoubleClick, isEquipped, meetsRequirements = true, ...props }) => {
    const { t } = useTranslation();
    const fullName = getGrammaticallyCorrectFullName(item, template, affixes);
    const style = rarityStyles[template.rarity];
    const upgradeLevel = item.upgradeLevel || 0;

    return (
        <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            className={`flex items-center p-2 rounded-lg cursor-pointer border transition-all duration-200 ${
                isSelected ? 'ring-2 ring-indigo-500 bg-indigo-900/20' : 'bg-slate-800/50 hover:bg-slate-700/50 border-transparent'
            } ${!meetsRequirements ? 'opacity-50 grayscale' : ''} ${props.className || ''}`}
            draggable={props.draggable}
            onDragStart={props.onDragStart}
        >
            <div className={`w-10 h-10 rounded border ${style.border} ${style.bg} flex items-center justify-center mr-3 relative`}>
                {template.icon ? (
                    <img src={template.icon} alt={template.name} className="w-8 h-8 object-contain" />
                ) : (
                    <ShieldIcon className="w-6 h-6 text-slate-500" />
                )}
                {isEquipped && (
                    <div className="absolute -top-1 -left-1 bg-green-500 rounded-full p-0.5 shadow-sm">
                        <ShieldIcon className="w-2.5 h-2.5 text-white" />
                    </div>
                )}
            </div>
            <div className="flex-grow min-w-0">
                <p className={`text-sm font-bold truncate ${style.text}`}>
                    {fullName} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </p>
                <p className="text-[10px] text-gray-500 uppercase">{t(`equipment.slot.${template.slot}`)}</p>
            </div>
            {item.isBorrowed && (
                <div className="ml-2 text-indigo-400" title="Wypożyczony">
                    <HandshakeIcon className="h-4 w-4" />
                </div>
            )}
        </div>
    );
};

export const EmptySlotListItem: React.FC<{ slotName: string }> = ({ slotName }) => (
    <div className="flex items-center p-2 rounded-lg bg-slate-800/30 border border-dashed border-slate-700 opacity-50">
        <div className="w-10 h-10 rounded border border-slate-700 bg-slate-900/50 flex items-center justify-center mr-3">
            <ShieldIcon className="w-6 h-6 text-slate-800" />
        </div>
        <div className="flex-grow">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{slotName}</p>
        </div>
    </div>
);

export const ItemTooltip: React.FC<{
    instance: ItemInstance;
    template: ItemTemplate;
    affixes: Affix[];
}> = ({ instance, template, affixes }) => {
    return (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <ItemDetailsPanel item={instance} template={template} affixes={affixes} size="small" compact={true} />
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
    showPrice?: 'buy' | 'buy-special' | 'sell' | ((item: ItemInstance) => 'buy' | 'buy-special' | 'sell' | null);
}> = ({ items, itemTemplates, affixes, selectedItem, onSelectItem, selectedIds }) => {
    return (
        <div className="space-y-1">
            {items.map(item => {
                const template = itemTemplates.find(t => t.id === item.templateId);
                if (!template) return null;
                const isSelected = selectedItem?.uniqueId === item.uniqueId || (selectedIds && selectedIds.has(item.uniqueId));
                
                return (
                    <ItemListItem
                        key={item.uniqueId}
                        item={item}
                        template={template}
                        affixes={affixes}
                        isSelected={!!isSelected}
                        onClick={() => onSelectItem(item)}
                    />
                );
            })}
        </div>
    );
};
