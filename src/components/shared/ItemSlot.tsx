
import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ItemRarity, ItemTemplate, ItemInstance, EquipmentSlot, PlayerCharacter, CharacterStats, Affix, RolledAffixStats, GrammaticalGender, ItemSet, Gender } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon'; 
import { ShieldIcon } from '../icons/ShieldIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { HandshakeIcon } from '../icons/HandshakeIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { MinusIcon } from '../icons/MinusIcon';
import { useCharacter } from '../../contexts/CharacterContext';

export const rarityStyles = {
    [ItemRarity.Common]: { 
        border: 'border-slate-700', 
        bg: 'bg-slate-800', 
        shadow: 'shadow-none', 
        text: 'text-gray-300',
        glow: 'shadow-[0_0_15px_rgba(51,65,85,0.3)]'
    },
    [ItemRarity.Uncommon]: { 
        border: 'border-green-700', 
        bg: 'bg-green-950', 
        shadow: 'shadow-md shadow-green-500/10', 
        text: 'text-green-400',
        glow: 'shadow-[0_0_20px_rgba(21,128,61,0.3)]'
    },
    [ItemRarity.Rare]: { 
        border: 'border-sky-700', 
        bg: 'bg-sky-950', 
        shadow: 'shadow-md shadow-sky-500/10', 
        text: 'text-sky-400',
        glow: 'shadow-[0_0_25px_rgba(3,105,161,0.4)]'
    },
    [ItemRarity.Epic]: { 
        border: 'border-purple-700', 
        bg: 'bg-purple-950', 
        shadow: 'shadow-md shadow-purple-500/10', 
        text: 'text-purple-400',
        glow: 'shadow-[0_0_30px_rgba(126,34,206,0.4)]'
    },
    [ItemRarity.Legendary]: { 
        border: 'border-amber-600', 
        bg: 'bg-amber-950', 
        shadow: 'shadow-md shadow-amber-500/10', 
        text: 'text-amber-400',
        glow: 'shadow-[0_0_40px_rgba(217,119,6,0.5)]'
    },
};

const getItemTotalStats = (item: ItemInstance, template: ItemTemplate) => {
    const stats: any = {
        damageMin: 0, damageMax: 0, armorBonus: 0, maxHealthBonus: 0,
        critChanceBonus: 0, critDamageModifierBonus: 0, attacksPerRound: 0, attacksPerRoundBonus: 0,
        dodgeChanceBonus: 0, blockChanceBonus: 0, magicDamageMin: 0, magicDamageMax: 0,
        armorPenetrationPercent: 0, armorPenetrationFlat: 0,
        lifeStealPercent: 0, lifeStealFlat: 0,
        manaStealPercent: 0, manaStealFlat: 0,
        statsBonus: {} as any
    };

    const upgradeLevel = item.upgradeLevel || 0;
    const upgradeFactor = upgradeLevel * 0.1;
    const affixUpgradeFactor = Math.min(upgradeLevel, 5) * 0.1;

    stats.attacksPerRound = template.attacksPerRound || 0;

    const applySource = (source: RolledAffixStats | undefined, factor: number) => {
        if (!source) return;
        if (source.damageMin) stats.damageMin += source.damageMin * (1 + factor);
        if (source.damageMax) stats.damageMax += source.damageMax * (1 + factor);
        if (source.armorBonus) stats.armorBonus += source.armorBonus * (1 + factor);
        if (source.maxHealthBonus) stats.maxHealthBonus += source.maxHealthBonus * (1 + factor);
        if (source.critChanceBonus) stats.critChanceBonus += source.critChanceBonus * (1 + factor);
        if (source.blockChanceBonus) stats.blockChanceBonus += source.blockChanceBonus * (1 + factor);
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
    if (template.gender === GrammaticalGender.Feminine) genderKey = 'feminine';
    else if (template.gender === GrammaticalGender.Neuter) genderKey = 'neuter';
    
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
    const { gameData, derivedCharacter } = useCharacter();
    const isSmall = size === 'small';
    const safeAffixes = affixes || [];
    
    const compareTotalStats = useMemo(() => {
        if (!compareWith || !itemTemplates || itemTemplates.length === 0 || !item || compareWith.uniqueId === item.uniqueId) return null;
        const compTemplate = itemTemplates.find(t => t.id === compareWith.templateId);
        return compTemplate ? getItemTotalStats(compareWith, compTemplate) : null;
    }, [compareWith, itemTemplates, item]);

    if (!item || !template) return null;

    const style = rarityStyles[template.rarity];
    const upgradeLevel = item.upgradeLevel || 0;
    const prefix = safeAffixes.find(a => a.id === item?.prefixId);
    const suffix = safeAffixes.find(a => a.id === item?.suffixId);

    const activeSets = useMemo(() => {
        if (!gameData?.itemSets) return [];
        return gameData.itemSets.filter(set => set.affixId === item.prefixId || set.affixId === item.suffixId);
    }, [gameData?.itemSets, item.prefixId, item.suffixId]);

    const getSetCount = (affixId: string) => {
        if (!derivedCharacter) return 0;
        let count = 0;
        Object.values(derivedCharacter.equipment).forEach(eqItem => {
            if (eqItem && (eqItem.prefixId === affixId || eqItem.suffixId === affixId)) {
                count++;
            }
        });
        return count;
    };

    const RequirementsSection: React.FC = () => {
        const reqs = [];
        
        // 1. Level Requirement
        if (template.requiredLevel > 1) {
            const levelMet = !character || character.level >= template.requiredLevel;
            reqs.push(<div key="req-lvl" className="flex justify-between items-center py-0.5"><span className="text-gray-500">{t('statistics.level')}:</span><span className={`font-mono font-bold ${levelMet ? 'text-gray-300' : 'text-red-500 animate-pulse'}`}>{template.requiredLevel}</span></div>);
        }

        // 2. Gender Requirement
        if (template.requiredGender) {
            const genderMet = !character || character.gender === template.requiredGender;
            reqs.push(
                <div key="req-gender" className="flex justify-between items-center py-0.5">
                    <span className="text-gray-500">{t('item.requiredGender')}:</span>
                    <span className={`font-mono font-bold ${genderMet ? 'text-gray-300' : 'text-red-500 animate-pulse'}`}>
                        {t(`gender.${template.requiredGender}`)}
                    </span>
                </div>
            );
        }

        // 3. Stats Requirements
        if (template.requiredStats) {
            Object.entries(template.requiredStats).forEach(([stat, val]) => {
                if (val && val > 0) {
                    const playerVal = character ? (character.stats as any)[stat] : 0;
                    const statMet = !character || playerVal >= val;
                    reqs.push(<div key={`req-${stat}`} className="flex justify-between items-center py-0.5"><span className="text-gray-500">{t(`statistics.${stat}`)}:</span><span className={`font-mono font-bold ${statMet ? 'text-gray-300' : 'text-red-500 animate-pulse'}`}>{val}</span></div>);
                }
            });
        }
        
        if (reqs.length === 0) return null;
        return <div className={`bg-red-950/20 p-3 rounded-lg mt-3 border border-red-900/20 ${isSmall ? 'text-xs' : 'text-sm'}`}><h5 className="font-black uppercase text-[9px] tracking-widest text-red-400/60 border-b border-red-900/20 mb-2 pb-1">Wymagania</h5><div className="space-y-0.5">{reqs}</div></div>;
    };

    const StatSection: React.FC<{title?: string, source: any, metadata: any, isAffix: boolean}> = ({title, source, metadata, isAffix}) => {
        const upgradeFactor = isAffix ? Math.min(upgradeLevel, 5) * 0.1 : upgradeLevel * 0.1;
        const s = source as any;

        const checkPerfect = (key: string, value: number, isAttribute: boolean = false): boolean => {
            if (!metadata) return false;
            let metaVal = isAttribute ? (metadata as any).statsBonus?.[key] : (metadata as any)[key];
            if (!metaVal || typeof metaVal !== 'object') return false;
            return value >= (metaVal.max || 0);
        };

        const renderStat = (label: string, value: number | [number, number], compareKey: string | [string, string], isPercent = false, isAttribute = false, noScale = false) => {
            const isRange = Array.isArray(value);
            const val1 = isRange ? value[0] : value;
            const val2 = isRange ? value[1] : 0;
            const currentFactor = noScale ? 0 : upgradeFactor;
            const formatValue = (v: number) => {
                const scaled = v * (1 + currentFactor);
                if (noScale || isPercent) return parseFloat(scaled.toFixed(2));
                return Math.round(scaled);
            };
            const finalVal1 = formatValue(val1);
            const finalVal2 = isRange ? formatValue(val2) : 0;
            const isPerfect = isRange ? (checkPerfect((compareKey as [string, string])[0], val1) && checkPerfect((compareKey as [string, string])[1], val2)) : checkPerfect(compareKey as string, val1, isAttribute);
            let delta = 0;
            if (compareTotalStats) {
                if (isRange) {
                    const ck = compareKey as [string, string];
                    const compVal1 = formatValue(compareTotalStats[ck[0]] || 0);
                    const compVal2 = formatValue(compareTotalStats[ck[1]] || 0);
                    delta = (finalVal1 + finalVal2) / 2 - (compVal1 + compVal2) / 2;
                } else {
                    const ck = compareKey as string;
                    const compValRaw = isAttribute ? (compareTotalStats.statsBonus?.[ck] || 0) : (compareTotalStats[ck] || 0);
                    const finalCompVal = formatValue(compValRaw);
                    delta = finalVal1 - finalCompVal;
                }
            }

            return (
                <div key={label} className="flex justify-between items-center py-0.5">
                    <span className={`flex items-center gap-1 ${isPerfect ? 'text-amber-300 font-semibold' : 'text-gray-400'}`}>{label}:</span>
                    <span className={`font-mono flex items-center gap-1 ${isPerfect ? 'text-amber-400 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse' : 'text-gray-200'}`}>
                        {isRange ? `${finalVal1} - ${finalVal2}` : isPercent ? `${finalVal1}%` : finalVal1}
                        {compareTotalStats && Math.abs(delta) >= 0.01 && (<span className={`text-[10px] font-bold ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>({delta > 0 ? '+' : ''}{noScale || isPercent ? parseFloat(delta.toFixed(2)) : Math.round(delta)})</span>)}
                        {isPerfect && <SparklesIcon className="h-3 w-3 text-amber-400 ml-1" />}
                    </span>
                </div>
            );
        };

        const entries = [];
        if (s.statsBonus) { Object.entries(s.statsBonus).forEach(([k, v]) => { if (v) entries.push(renderStat(t(`statistics.${k}`), v as number, k, false, true)); }); }
        if (s.damageMin !== undefined && s.damageMax !== undefined) entries.push(renderStat(t('item.damage'), [s.damageMin, s.damageMax], ['damageMin', 'damageMax']));
        if (s.magicDamageMin !== undefined && s.magicDamageMax > 0) entries.push(renderStat(t('statistics.magicDamage'), [s.magicDamageMin, s.magicDamageMax], ['magicDamageMin', 'magicDamageMax']));
        if (!isAffix && (metadata as ItemTemplate).attacksPerRound) entries.push(renderStat(t('item.attacksPerRound'), (metadata as ItemTemplate).attacksPerRound!, 'attacksPerRound', false, false, true));
        if (s.attacksPerRoundBonus && s.attacksPerRoundBonus > 0) entries.push(renderStat(t('item.attacksPerRoundBonus'), s.attacksPerRoundBonus, 'attacksPerRoundBonus', false, false, true));
        if (s.armorBonus !== undefined && s.armorBonus > 0) entries.push(renderStat(t('statistics.armor'), s.armorBonus, 'armorBonus'));
        if (s.dodgeChanceBonus !== undefined && s.dodgeChanceBonus > 0) entries.push(renderStat(t('statistics.dodgeChance'), s.dodgeChanceBonus, 'dodgeChanceBonus', true));
        if (s.blockChanceBonus !== undefined && s.blockChanceBonus > 0) entries.push(renderStat(t('item.blockChanceBonus'), s.blockChanceBonus, 'blockChanceBonus', true));
        if (s.critChanceBonus !== undefined && s.critChanceBonus > 0) entries.push(renderStat(t('statistics.critChance'), s.critChanceBonus, 'critChanceBonus', true));
        if (s.critDamageModifierBonus !== undefined && s.critDamageModifierBonus > 0) entries.push(renderStat(t('statistics.critDamageModifier'), s.critDamageModifierBonus, 'critDamageModifierBonus', true));
        if (s.maxHealthBonus !== undefined && s.maxHealthBonus > 0) entries.push(renderStat(t('statistics.health'), s.maxHealthBonus, 'maxHealthBonus'));
        if (s.armorPenetrationPercent !== undefined && s.armorPenetrationPercent > 0) entries.push(renderStat(t('item.armorPenetrationPercent'), s.armorPenetrationPercent, 'armorPenetrationPercent', true));
        if (s.lifeStealPercent !== undefined && s.lifeStealPercent > 0) entries.push(renderStat(t('item.lifeStealPercent'), s.lifeStealPercent, 'lifeStealPercent', true));
        if (s.manaStealPercent !== undefined && s.manaStealPercent > 0) entries.push(renderStat(t('item.manaStealPercent'), s.manaStealPercent, 'manaStealPercent', true));
        
        if (entries.length === 0) return null;
        return <div className={`bg-slate-900/60 p-2.5 rounded-lg mt-2 border border-white/5 ${isSmall ? 'text-xs' : 'text-sm'}`}>{title && <h5 className="font-black uppercase text-[9px] tracking-widest text-indigo-400 border-b border-white/5 mb-2 pb-1">{title}</h5>}<div className="space-y-0.5">{entries}</div></div>;
    };

    return (
        <div className={`flex flex-col w-full ${compact ? '' : 'h-full'}`}>
            <div className={`${compact ? '' : 'flex-grow overflow-y-auto'} ${isSmall ? 'pr-0.5' : 'pr-1'}`}>
                {title && <h5 className="text-center font-black uppercase text-[10px] tracking-widest text-gray-500 mb-1">{title}</h5>}
                <h4 className={`font-bold text-center leading-tight ${style.text} ${isSmall ? 'text-base mb-1' : 'text-lg mb-2'}`}>
                    {getGrammaticallyCorrectFullName(item, template, safeAffixes)} {upgradeLevel > 0 && `+${upgradeLevel}`}
                </h4>
                {showIcon && template.icon && (
                    <div className="relative group mb-5 mt-2">
                        <div className={`
                            w-60 h-60 mx-auto rounded-xl p-0.5 transition-all duration-700
                            ${style.bg} ${style.border} ${style.glow}
                            ${(template.rarity === ItemRarity.Rare || template.rarity === ItemRarity.Epic || template.rarity === ItemRarity.Legendary) ? 'animate-pulse' : ''}
                        `}>
                            <img src={template.icon} alt={template.name} className="w-full h-full object-contain bg-slate-950 rounded-lg p-2 shadow-inner" />
                        </div>
                        {item.crafterName && (<div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-lg whitespace-nowrap border border-amber-400/50 z-10">WYKUTY PRZEZ: {item.crafterName.toUpperCase()}</div>)}
                    </div>
                )}

                {template.isShield && (
                    <div className="bg-amber-950/20 p-2 rounded-lg mt-1 border border-amber-900/30 flex items-center justify-center gap-2">
                        <ShieldIcon className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-black uppercase text-amber-400 tracking-widest">{t('item.isShield')}</span>
                    </div>
                )}
                
                <StatSection title="STATYSTYKI BAZOWE" source={item.rolledBaseStats || template} metadata={template} isAffix={false} />
                
                {template.isMagical && template.magicAttackType && (
                    <div className={`bg-purple-950/20 p-3 rounded-lg mt-2 border border-purple-900/30 ${isSmall ? 'text-xs' : 'text-sm'}`}>
                        <h5 className="font-black uppercase text-[9px] tracking-widest text-purple-400 border-b border-purple-900/30 mb-2 pb-1">
                            Atak Magiczny: {t(`item.magic.${template.magicAttackType}`)}
                        </h5>
                        <p className="text-gray-300 italic mb-2 leading-relaxed text-[11px]">
                            {t(`item.magicDescriptions.${template.magicAttackType}`)}
                        </p>
                        {template.manaCost && (
                            <div className="flex justify-between items-center text-[10px] font-bold text-purple-300 uppercase tracking-tighter pt-1 border-t border-purple-900/20">
                                <span>Koszt Many:</span>
                                <span className="font-mono">{template.manaCost.min} - {template.manaCost.max}</span>
                            </div>
                        )}
                    </div>
                )}

                {!hideAffixes && item.rolledPrefix && prefix && <StatSection title={`PREFIKS: ${getGrammaticallyCorrectAffixName(prefix, template).toUpperCase()}`} source={item.rolledPrefix} metadata={prefix} isAffix={true} />}
                {!hideAffixes && item.rolledSuffix && suffix && <StatSection title={`SUFIKS: ${getGrammaticallyCorrectAffixName(suffix, template).toUpperCase()}`} source={item.rolledSuffix} metadata={suffix} isAffix={true} />}
                
                {activeSets.map(set => {
                    const currentCount = getSetCount(set.affixId);
                    return (
                        <div key={set.id} className="mt-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-2.5">
                            <div className="flex justify-between items-center border-b border-emerald-500/20 pb-1 mb-2">
                                <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">ZESTAW: {set.name.toUpperCase()}</h5>
                                <span className="text-[9px] font-mono text-emerald-500 font-bold">({currentCount} / {Math.max(...set.tiers.map(t => t.requiredPieces))})</span>
                            </div>
                            <div className="space-y-2">
                                {set.tiers.map((tier, tidx) => {
                                    const isActive = currentCount >= tier.requiredPieces;
                                    return (
                                        <div key={tidx} className={`text-[10px] ${isActive ? 'text-emerald-300' : 'text-gray-600 grayscale'}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]' : 'bg-gray-700'}`}></div>
                                                <span className="font-bold">({tier.requiredPieces}) Części:</span>
                                            </div>
                                            <div className="pl-3 space-y-0.5">
                                                {Object.entries(tier.bonuses).map(([bKey, bVal]) => {
                                                    if (!bVal) return null;
                                                    let label = t(`statistics.${bKey}` as any);
                                                    let valStr = `+${bVal}`;
                                                    if (bKey === 'expBonusPercent') label = 'Bonus Doświadczenia';
                                                    if (bKey === 'goldBonusPercent') label = 'Więcej Złota';
                                                    if (bKey === 'damageBonusPercent') label = 'Zwiększone Obrażenia';
                                                    if (bKey === 'damageReductionPercent') label = 'Redukcja Obrażeń';
                                                    if (bKey.toLowerCase().includes('percent')) valStr = `+${bVal}%`;
                                                    return <div key={bKey} className="flex justify-between"><span>{label}</span><span className="font-mono">{valStr}</span></div>;
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
                <RequirementsSection />
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
    onMouseMove?: (e: React.MouseEvent) => void; 
    className?: string; 
    price?: number; 
    source?: 'inventory' | 'equipment'; 
    fromSlot?: EquipmentSlot;
    onAction?: (e: React.MouseEvent) => void;
    actionType?: 'equip' | 'unequip';
}> = ({ item, template, affixes, isSelected, onClick, onDoubleClick, isEquipped, meetsRequirements = true, onMouseEnter, onMouseLeave, onMouseMove, className, price, source, fromSlot, onAction, actionType }) => { 
    const style = rarityStyles[template.rarity]; 
    const upgradeLevel = item.upgradeLevel || 0; 
    
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ 
            uniqueId: item.uniqueId, 
            source,
            fromSlot 
        }));
        const target = e.target as HTMLElement;
        target.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.target as HTMLElement;
        target.style.opacity = '1';
    };

    const handleActionClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onAction) onAction(e);
    };

    return ( 
        <div 
            draggable={!!source}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={onClick} 
            onDoubleClick={onDoubleClick} 
            onMouseEnter={onMouseEnter} 
            onMouseLeave={onMouseLeave} 
            onMouseMove={onMouseMove}
            className={`flex items-center p-2 rounded-lg cursor-grab active:cursor-grabbing border transition-all duration-200 group ${ isSelected ? 'ring-2 ring-indigo-500 bg-indigo-900/20' : 'bg-slate-800/50 hover:bg-slate-700/50 border-transparent' } ${!meetsRequirements ? 'opacity-50 grayscale' : ''} ${className || ''}`} 
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

            {onAction && (
                <button
                    onClick={handleActionClick}
                    className={`ml-2 p-1.5 rounded-md transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center justify-center border ${
                        actionType === 'equip' 
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 hover:bg-emerald-600 hover:text-white' 
                        : 'bg-rose-600/20 border-rose-500 text-rose-400 hover:bg-rose-600 hover:text-white'
                    }`}
                    title={actionType === 'equip' ? 'Załóż' : 'Zdejmij'}
                >
                    {actionType === 'equip' ? <PlusIcon className="h-3 w-3" /> : <MinusIcon className="h-3 w-3" />}
                </button>
            )}
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
    onClose?: () => void; 
    onMouseEnter?: () => void; 
    onMouseLeave?: () => void; 
}> = ({ instance, template, affixes, character, compareWith, x, y, itemTemplates = [], isCentered, onClose, onMouseEnter, onMouseLeave }) => { 
    const [style, setStyle] = useState<React.CSSProperties>({ width: '300px' }); 
    const tooltipRef = useRef<HTMLDivElement>(null);
    
    const isSameItem = compareWith?.uniqueId === instance.uniqueId; 
    const actualCompareWith = isSameItem ? null : compareWith; 
    const compareTemplate = actualCompareWith ? itemTemplates.find(t => t.id === actualCompareWith.templateId) : null;

    useLayoutEffect(() => { 
        const tooltipWidth = actualCompareWith ? 600 : 300;
        setStyle({ width: `${tooltipWidth}px` });
    }, [actualCompareWith]); 

    return ( 
        <div 
            className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 animate-fade-in ${onClose ? 'bg-black/60 backdrop-blur-sm pointer-events-auto' : 'pointer-events-none'}`} 
            onClick={onClose} 
        > 
            <div 
                ref={tooltipRef}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                className="bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-3 flex gap-3 max-h-[90vh] relative z-10 overflow-hidden transition-opacity duration-200 shadow-purple-500/20" 
                style={{ width: style.width, maxWidth: '95vw', pointerEvents: 'auto' }} 
                onClick={e => e.stopPropagation()} 
            > 
                {onClose && ( <button onClick={onClose} className="absolute top-1.5 right-2 text-gray-500 hover:text-white transition-colors z-20"> ✕ </button> )} 
                {actualCompareWith && compareTemplate && ( 
                    <div className="w-1/2 border-r border-white/5 pr-3 hidden md:flex flex-col max-h-full"> 
                        <div className="flex-grow overflow-y-auto custom-scrollbar"> 
                            <ItemDetailsPanel item={actualCompareWith} template={compareTemplate} affixes={affixes} size="small" compact={true} title="OBECNIE ZAŁOŻONY" itemTemplates={itemTemplates} /> 
                        </div> 
                    </div> 
                )} 
                <div className={`${actualCompareWith ? 'w-1/2' : 'w-full'} flex flex-col max-h-full`}> 
                    <div className="flex-grow overflow-y-auto custom-scrollbar"> 
                        <ItemDetailsPanel item={instance} template={template} affixes={affixes} size="small" compact={true} character={character} compareWith={actualCompareWith} itemTemplates={itemTemplates} title={actualCompareWith ? "NOWY PRZEDMIOT" : undefined} /> 
                    </div> 
                </div> 
            </div> 
        </div> 
    ); 
};

export const ItemList: React.FC<{ items: ItemInstance[]; itemTemplates: ItemTemplate[]; affixes: Affix[]; selectedItem: ItemInstance | null; onSelectItem: (item: ItemInstance) => void; selectedIds?: Set<string>; priceSelector?: (item: ItemInstance) => number; }> = ({ items, itemTemplates, affixes, selectedItem, onSelectItem, selectedIds, priceSelector }) => ( 
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
