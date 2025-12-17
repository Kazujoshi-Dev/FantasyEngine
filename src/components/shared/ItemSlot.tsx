
import React, { useMemo } from 'react';
import { ItemRarity, ItemTemplate, ItemInstance, EquipmentSlot, PlayerCharacter, CharacterStats, Affix, RolledAffixStats, GrammaticalGender, PlayerRank } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { HandshakeIcon } from '../icons/HandshakeIcon';
import { useCharacter } from '@/contexts/CharacterContext';

export const rarityStyles = {
    [ItemRarity.Common]: { border: 'border-slate-700', bg: 'bg-slate-800', shadow: 'shadow-none', text: 'text-gray-300' },
    [ItemRarity.Uncommon]: { border: 'border-green-700', bg: 'bg-green-950', shadow: 'shadow-md shadow-green-500/10', text: 'text-green-400' },
    [ItemRarity.Rare]: { border: 'border-sky-700', bg: 'bg-sky-950', shadow: 'shadow-md shadow-sky-500/10', text: 'text-sky-400' },
    [ItemRarity.Epic]: { border: 'border-purple-700', bg: 'bg-purple-950', shadow: 'shadow-md shadow-purple-500/10', text: 'text-purple-400' },
    [ItemRarity.Legendary]: { border: 'border-amber-600', bg: 'bg-amber-950', shadow: 'shadow-md shadow-amber-500/10', text: 'text-amber-400' },
};

export const getGrammaticallyCorrectFullName = (item: ItemInstance, template: ItemTemplate, affixes: Affix[]): string => {
    const prefix = affixes.find(a => a.id === item.prefixId);
    const suffix = affixes.find(a => a.id === item.suffixId);
    let g: 'masculine' | 'feminine' | 'neuter' = 'masculine';
    if (template.gender === GrammaticalGender.Feminine) g = 'feminine'; else if (template.gender === GrammaticalGender.Neuter) g = 'neuter';
    const getName = (a: Affix | undefined) => a ? (typeof a.name === 'string' ? a.name : a.name[g]) : '';
    return [getName(prefix), template.name, getName(suffix)].filter(Boolean).join(' ');
};

// Fix: Added missing props to ItemListItem interface for compatibility
export const ItemListItem: React.FC<{
    item: ItemInstance;
    template: ItemTemplate;
    affixes: Affix[];
    isSelected?: boolean;
    onClick: (e: React.MouseEvent) => void;
    isEquipped?: boolean;
    onDoubleClick?: (e: React.MouseEvent) => void;
    showPrimaryStat?: boolean;
    meetsRequirements?: boolean;
    draggable?: string;
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
}> = ({ item, template, affixes, isSelected, onClick, isEquipped, onDoubleClick, showPrimaryStat, meetsRequirements = true, draggable, onDragStart, className }) => {
    const fullName = getGrammaticallyCorrectFullName(item, template, affixes);
    const style = rarityStyles[template.rarity];
    return (
        <div 
            onClick={onClick} 
            onDoubleClick={onDoubleClick}
            draggable={draggable === "true"}
            onDragStart={onDragStart as any}
            className={`p-2 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${style.border} ${style.bg}/20 hover:${style.bg}/40 ${isSelected ? 'ring-2 ring-indigo-500' : ''} ${!meetsRequirements ? 'opacity-50 grayscale' : ''} ${className || ''}`}
        >
            <div className={`w-10 h-10 rounded bg-slate-900 flex items-center justify-center border ${style.border}`}>
                {template.icon ? <img src={template.icon} className="w-8 h-8 object-contain" alt={template.name} /> : '?'}
            </div>
            <div className="flex-grow overflow-hidden">
                <p className={`text-xs font-bold truncate ${style.text}`}>{fullName}</p>
                <div className="flex gap-2 text-[10px] text-gray-500">
                    <span className={!meetsRequirements ? 'text-red-400 font-bold' : ''}>Lvl {template.requiredLevel}</span>
                    {item.upgradeLevel ? <span className="text-amber-500">+{item.upgradeLevel}</span> : null}
                </div>
            </div>
            {isEquipped && <span className="text-[10px] bg-indigo-900 text-indigo-300 px-1 rounded border border-indigo-700">E</span>}
            {item.isBorrowed && <HandshakeIcon className="w-3 h-3 text-indigo-400" />}
        </div>
    );
};

// Fix: Added hideAffixes to ItemDetailsPanel interface
export const ItemDetailsPanel: React.FC<{
    item: ItemInstance | null;
    template: ItemTemplate | null;
    affixes: Affix[];
    character?: PlayerCharacter;
    size?: 'small';
    title?: string;
    compact?: boolean;
    showIcon?: boolean;
    hideAffixes?: boolean;
}> = ({ item, template, affixes, character, size, title, compact, showIcon = true, hideAffixes }) => {
    const { t } = useTranslation();
    const { gameData } = useCharacter();
    if (!item || !template) return <div className="text-gray-500 text-center py-10">{t('equipment.selectItemPrompt')}</div>;
    const fullName = getGrammaticallyCorrectFullName(item, template, affixes);
    const style = rarityStyles[template.rarity];
    const crafterRank = (item as any).crafterRankId && gameData?.playerRanks ? gameData.playerRanks.find(r => r.id === (item as any).crafterRankId) : null;

    return (
        <div className={`flex flex-col ${compact ? '' : 'h-full'}`}>
            <div className="flex-grow overflow-y-auto">
                <h4 className={`font-bold text-center ${style.text} ${size === 'small' ? 'text-lg' : 'text-2xl'}`}>{fullName} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}</h4>
                {showIcon && template.icon && <img src={template.icon} className="w-32 h-32 mx-auto my-4 object-contain" alt={template.name} />}
                <p className="italic text-gray-400 text-center text-xs px-2 mb-4">{template.description}</p>
                <div className="border-t border-slate-700 pt-2 space-y-1 px-2 text-sm">
                    <p className="flex justify-between"><span>Slot:</span> <span className="text-white font-bold">{template.slot}</span></p>
                    <p className="flex justify-between"><span>Wartość:</span> <span className="text-amber-400 font-bold">{template.value} <CoinsIcon className="inline h-3 w-3" /></span></p>
                </div>
            </div>
            {item.crafterName && (
                <div className="mt-3 pt-2 border-t border-slate-700 text-right px-2">
                    <span className="text-gray-500 text-[10px]">Wykuty przez: </span>
                    {crafterRank && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-white/5 shadow-sm mr-1" style={{ 
                            backgroundImage: crafterRank.backgroundImageUrl ? `url(${crafterRank.backgroundImageUrl})` : 'none',
                            backgroundColor: crafterRank.backgroundImageUrl ? 'transparent' : '#312e81',
                            backgroundSize: 'cover',
                            color: crafterRank.textColor,
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                        }}>{crafterRank.name}</span>
                    )}
                    <span className="text-amber-500 font-bold italic text-xs">{item.crafterName}</span>
                </div>
            )}
        </div>
    );
};

// Fix: Added showPrice to ItemList interface
export const ItemList: React.FC<{
    items: ItemInstance[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    selectedItem: ItemInstance | null;
    onSelectItem: (i: ItemInstance) => void;
    selectedIds?: Set<string>;
    showPrice?: string | ((item: ItemInstance) => string);
}> = ({ items, itemTemplates, affixes, selectedItem, onSelectItem, selectedIds, showPrice }) => (
    <div className="space-y-1">
        {items.map(i => {
            const t = itemTemplates.find(tmpl => tmpl.id === i.templateId);
            if (!t) return null;
            return (
                <ItemListItem 
                    key={i.uniqueId} 
                    item={i} 
                    template={t} 
                    affixes={affixes} 
                    isSelected={selectedItem?.uniqueId === i.uniqueId || selectedIds?.has(i.uniqueId)} 
                    onClick={() => onSelectItem(i)} 
                />
            );
        })}
    </div>
);

export const EmptySlotListItem: React.FC<{slotName: string}> = ({ slotName }) => (
    <div className="p-2 rounded-lg border-2 border-slate-800 bg-slate-900/50 flex items-center gap-3 opacity-40">
        <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center">?</div>
        <p className="text-xs font-bold text-gray-600 uppercase">{slotName}</p>
    </div>
);

export const ItemTooltip: React.FC<{instance: ItemInstance, template: ItemTemplate, affixes: Affix[]}> = ({ instance, template, affixes }) => (
    <div className="absolute z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-900 border border-slate-700 p-2 rounded shadow-2xl w-64 bottom-full mb-2">
        <ItemDetailsPanel item={instance} template={template} affixes={affixes} compact size="small" />
    </div>
);
