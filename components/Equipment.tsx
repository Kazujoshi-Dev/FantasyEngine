
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate, GameData, CharacterStats, ItemRarity, Affix, RolledAffixStats } from '../types';
import { ItemDetailsPanel, ItemListItem, EmptySlotListItem, rarityStyles, getGrammaticallyCorrectFullName } from './shared/ItemSlot';
import { ContextMenu } from './shared/ContextMenu';

interface EquipmentProps {
  character: PlayerCharacter;
  baseCharacter: PlayerCharacter;
  gameData: GameData;
  onEquipItem: (item: ItemInstance) => void;
  onUnequipItem: (item: ItemInstance, fromSlot: EquipmentSlot) => void;
}

const slotOrder: EquipmentSlot[] = [
    EquipmentSlot.Head,
    EquipmentSlot.Neck,
    EquipmentSlot.Chest,
    EquipmentSlot.MainHand,
    EquipmentSlot.OffHand,
    EquipmentSlot.Hands,
    EquipmentSlot.Waist,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
    EquipmentSlot.Ring1,
    EquipmentSlot.Ring2,
    EquipmentSlot.TwoHand,
];

const StatDisplayRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-center py-0.5 px-2 rounded-lg text-sm hover:bg-slate-800/50">
        <span className="font-medium text-gray-400">{label}</span>
        <span className="font-mono font-bold text-white flex items-baseline">{value}</span>
    </div>
);

const CombatStatsPanel: React.FC<{ character: PlayerCharacter; baseCharacter: PlayerCharacter; }> = ({ character, baseCharacter }) => {
    const { t } = useTranslation();
    const stats = character.stats;

    const baseStatKeys: (keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-bold text-indigo-400 mb-2 px-2">{t('statistics.combatStats')}</h3>
            <div className="flex-grow overflow-y-auto pr-2 space-y-1">

                <h4 className="font-semibold text-gray-300 text-xs px-2 mt-2 mb-0.5 uppercase tracking-wider">{t('statistics.baseAttributes')}</h4>
                {baseStatKeys.map(key => {
                    const total = character.stats[key];
                    const base = baseCharacter.stats[key];
                    const bonus = total - base;
                    return (
                        <StatDisplayRow 
                            key={key}
                            label={t(`statistics.${key}`)} 
                            value={
                                <>
                                    <span className="text-gray-300">{base}</span>
                                    {bonus > 0 && 
                                        <>
                                            <span className="text-green-400 ml-1">(+{bonus})</span>
                                            <span className="text-sky-400 ml-1">({total})</span>
                                        </>
                                    }
                                </>
                            } 
                        />
                    )
                })}
                
                <h4 className="font-semibold text-gray-300 text-xs px-2 mt-4 mb-0.5 uppercase tracking-wider">{t('statistics.vitals')}</h4>
                <StatDisplayRow label={t('statistics.health')} value={`${stats.currentHealth.toFixed(0)} / ${stats.maxHealth}`} />
                <StatDisplayRow label={t('statistics.mana')} value={`${stats.currentMana.toFixed(0)} / ${stats.maxMana}`} />
                <StatDisplayRow label={t('statistics.energyLabel')} value={`${stats.currentEnergy} / ${stats.maxEnergy}`} />

                <h4 className="font-semibold text-gray-300 text-xs px-2 mt-4 mb-0.5 uppercase tracking-wider">{t('statistics.combatStats')}</h4>
                <StatDisplayRow label={t('statistics.physicalDamage')} value={`${stats.minDamage} - ${stats.maxDamage}`} />
                <StatDisplayRow label={t('statistics.magicDamage')} value={`${stats.magicDamageMin} - ${stats.magicDamageMax}`} />
                <StatDisplayRow label={t('statistics.armor')} value={stats.armor} />
                <StatDisplayRow label={t('statistics.critChance')} value={`${stats.critChance.toFixed(1)}%`} />
                <StatDisplayRow label={t('statistics.critDamageModifier')} value={`${stats.critDamageModifier}%`} />
                <StatDisplayRow label={t('statistics.attacksPerTurn')} value={stats.attacksPerRound} />
                <StatDisplayRow label={t('statistics.dodgeChance')} value={`${stats.dodgeChance.toFixed(1)}%`} />
                <StatDisplayRow label={t('statistics.manaRegen')} value={stats.manaRegen} />
                <StatDisplayRow label={t('statistics.armorPenetration')} value={`${stats.armorPenetrationPercent}% / ${stats.armorPenetrationFlat}`} />
                <StatDisplayRow label={t('statistics.lifeSteal')} value={`${stats.lifeStealPercent}% / ${stats.lifeStealFlat}`} />
                <StatDisplayRow label={t('statistics.manaSteal')} value={`${stats.manaStealPercent}% / ${stats.manaStealFlat}`} />
            </div>
        </div>
    );
};

const getBackpackCapacity = (character: PlayerCharacter): number => 40 + ((character.backpack?.level || 1) - 1) * 10;

const getItemStats = (item: ItemInstance | null, template: ItemTemplate | null, affixes: Affix[]) => {
    const stats: Record<string, number> = {};
    if (!item || !template) return stats;

    const sources: (ItemTemplate | RolledAffixStats)[] = [template];
    if (item.rolledPrefix) sources.push(item.rolledPrefix);
    if (item.rolledSuffix) sources.push(item.rolledSuffix);
    
    const upgradeBonusFactor = (item.upgradeLevel || 0) * 0.1;

    for (const source of sources) {
        if ('statsBonus' in source && source.statsBonus) {
            for (const [key, value] of Object.entries(source.statsBonus)) {
                let statValue = 0;
                if (source === template) { // is base item
                    const base = typeof value === 'number' ? value : value?.max || 0;
                    statValue = base + Math.round(base * upgradeBonusFactor);
                } else { // is affix
                    statValue = typeof value === 'number' ? value : value?.max || 0;
                }
                stats[key] = (stats[key] || 0) + statValue;
            }
        }
    }
    return stats;
}


const ItemComparisonTooltip: React.FC<{
    hoveredItem: ItemInstance;
    character: PlayerCharacter;
    gameData: GameData;
    position: { x: number, y: number };
}> = ({ hoveredItem, character, gameData, position }) => {
    const { t } = useTranslation();
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({
        opacity: 0,
        position: 'fixed',
        top: position.y + 20,
        left: position.x + 20,
    });
    
    const hoveredTemplate = gameData.itemTemplates.find(t => t.id === hoveredItem.templateId);
    if (!hoveredTemplate) return null;

    let equippedItems: { item: ItemInstance | null, slotName: string }[] = [];
    if (hoveredTemplate.slot === 'ring') {
        equippedItems.push({ item: character.equipment.ring1, slotName: t('equipment.slot.ring1') });
        equippedItems.push({ item: character.equipment.ring2, slotName: t('equipment.slot.ring2') });
    } else {
        equippedItems.push({ item: character.equipment[hoveredTemplate.slot as EquipmentSlot], slotName: t(`equipment.slot.${hoveredTemplate.slot}`) });
    }

    const hoveredStats = getItemStats(hoveredItem, hoveredTemplate, gameData.affixes);
    const allStatKeys = new Set([...Object.keys(hoveredStats)]);
    equippedItems.forEach(({ item }) => {
        if (item) {
            const equippedTemplate = gameData.itemTemplates.find(t => t.id === item.templateId);
            const equippedStats = getItemStats(item, equippedTemplate, gameData.affixes);
            Object.keys(equippedStats).forEach(key => allStatKeys.add(key));
        }
    });

    const StatComparison: React.FC<{ title: string; equippedItem: ItemInstance | null }> = ({ title, equippedItem }) => {
        const equippedTemplate = equippedItem ? gameData.itemTemplates.find(t => t.id === equippedItem.templateId) : null;
        const equippedStats = getItemStats(equippedItem, equippedTemplate, gameData.affixes);

        return (
            <div className="flex-1">
                <h4 className="text-center font-bold text-gray-400 text-sm mb-2">{title}</h4>
                {Array.from(allStatKeys).map(statKey => {
                    const hoveredValue = hoveredStats[statKey] || 0;
                    const equippedValue = equippedStats[statKey] || 0;
                    const diff = hoveredValue - equippedValue;
                    if (hoveredValue === 0 && equippedValue === 0) return null;

                    let color = 'text-gray-400';
                    let sign = '';
                    if (diff > 0) { color = 'text-green-400'; sign = '+'; }
                    if (diff < 0) { color = 'text-red-400'; sign = ''; }

                    return (
                        <div key={statKey} className="flex justify-between text-xs">
                            <span>{t(`statistics.${statKey}`)}</span>
                            <span className={`font-mono ${color}`}>{sign}{diff}</span>
                        </div>
                    );
                })}
            </div>
        )
    };
    
    // Adjust position to stay within viewport
    useEffect(() => {
        if (tooltipRef.current) {
            const rect = tooltipRef.current.getBoundingClientRect();
            let newX = position.x + 20;
            let newY = position.y + 20;

            if (newX + rect.width > window.innerWidth) {
                newX = position.x - rect.width - 20;
            }
            if (newY + rect.height > window.innerHeight) {
                newY = position.y - rect.height - 20;
            }
            
            setStyle({
                opacity: 1,
                position: 'fixed',
                top: newY,
                left: newX,
                transition: 'opacity 0.2s ease-in-out'
            });
        }
    }, [position]);

    return (
        <div ref={tooltipRef} style={style} className="z-30 w-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 pointer-events-none">
            <h3 className="text-lg font-bold text-center text-indigo-400 mb-2">{t('equipment.comparison')}</h3>
            <div className="flex gap-4">
                {equippedItems.map(({ item, slotName }) => (
                    <StatComparison key={slotName} title={slotName} equippedItem={item} />
                ))}
            </div>
        </div>
    );
};

export const Equipment: React.FC<EquipmentProps> = ({ character, baseCharacter, gameData, onEquipItem, onUnequipItem }) => {
    const { t } = useTranslation();
    const [draggedItemInfo, setDraggedItemInfo] = useState<{ item: ItemInstance, from: 'inventory' | EquipmentSlot } | null>(null);
    const [hideUnusable, setHideUnusable] = useState(false);
    const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');
    const [slotFilter, setSlotFilter] = useState<string>('all');
    
    const [hoveredItem, setHoveredItem] = useState<ItemInstance | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number, y: number } | null>(null);

    const handleDragStart = (item: ItemInstance, from: 'inventory' | EquipmentSlot) => {
        setDraggedItemInfo({ item, from });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    
    const handleSmartDrop = () => {
        if (!draggedItemInfo || draggedItemInfo.from !== 'inventory') return;
        onEquipItem(draggedItemInfo.item);
        setDraggedItemInfo(null);
    }

    const handleDropOnBackpack = () => {
        if (draggedItemInfo && draggedItemInfo.from !== 'inventory') {
            onUnequipItem(draggedItemInfo.item, draggedItemInfo.from);
        }
        setDraggedItemInfo(null);
    };

    const meetsRequirements = useCallback((item: ItemInstance): boolean => {
        const template = gameData.itemTemplates.find(t => t.id === item.templateId);
        if (!template) return true;

        if (character.level < template.requiredLevel) {
            return false;
        }

        if (template.requiredStats) {
            for (const stat in template.requiredStats) {
                const key = stat as keyof CharacterStats;
                if (character.stats[key] < (template.requiredStats[key] || 0)) {
                    return false;
                }
            }
        }
        return true;
    }, [character, gameData.itemTemplates]);

    const validInventory = useMemo(() => 
        character.inventory
            .filter(item => {
                const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                if (!template) return false;
                if (hideUnusable && !meetsRequirements(item)) return false;
                if (rarityFilter !== 'all' && template.rarity !== rarityFilter) return false;
                
                const slotToCheck = template.slot === 'ring' ? 'ring' : template.slot;
                if (slotFilter !== 'all' && slotToCheck !== slotFilter) return false;

                return true;
            }),
        [character.inventory, gameData.itemTemplates, hideUnusable, meetsRequirements, rarityFilter, slotFilter]
    );

    const backpackCapacity = getBackpackCapacity(character);

    return (
        <ContentPanel title={t('equipment.title')}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">

                {/* Column 1: Equipped Items */}
                <div 
                    onDragOver={handleDragOver}
                    onDrop={handleSmartDrop}
                    className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0"
                >
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('equipment.equipped')}</h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                        {slotOrder.map(slot => {
                            const item = character.equipment[slot];
                            const template = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;

                            return (
                                <div key={slot}>
                                    {item && template ? (
                                        <ItemListItem 
                                            item={item} 
                                            template={template} 
                                            affixes={gameData.affixes} 
                                            isSelected={false} 
                                            onClick={() => onUnequipItem(item, slot)}
                                            onDragStart={() => handleDragStart(item, slot)}
                                        />
                                    ) : (
                                        <>
                                            {slot === EquipmentSlot.TwoHand && (character.equipment.mainHand || character.equipment.offHand) ? null :
                                            (slot === EquipmentSlot.MainHand || slot === EquipmentSlot.OffHand) && character.equipment.twoHand ? null :
                                            <EmptySlotListItem slotName={t(`equipment.slot.${slot}`)} />}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Column 2: Details / Stats */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <CombatStatsPanel character={character} baseCharacter={baseCharacter} />
                </div>

                {/* Column 3: Backpack */}
                <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDropOnBackpack}
                    className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0"
                >
                    <div className="flex justify-between items-center mb-2 px-2">
                        <h3 className="text-xl font-bold text-indigo-400">{t('equipment.backpack')}</h3>
                        <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">{validInventory.length} / {backpackCapacity}</div>
                    </div>
                     <div className="grid grid-cols-2 gap-2 mb-2 px-2">
                        <select value={rarityFilter} onChange={e => setRarityFilter(e.target.value as ItemRarity | 'all')} className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs">
                            <option value="all">{t('admin.item.allRarities')}</option>
                            {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                        </select>
                         <select value={slotFilter} onChange={e => setSlotFilter(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs">
                            <option value="all">{t('admin.item.allSlots')}</option>
                            {Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{t(`equipment.slot.${s}`)}</option>)}
                            <option value="ring">{t('item.slot.ring')}</option>
                        </select>
                    </div>
                    <div className="mb-2 px-2">
                        <label className="flex items-center text-sm space-x-2">
                            <input type="checkbox" checked={hideUnusable} onChange={(e) => setHideUnusable(e.target.checked)} className="form-checkbox h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/>
                            <span>{t('equipment.hideUnusable')}</span>
                        </label>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-1 border border-transparent rounded-lg">
                        {validInventory.map(item => {
                            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            return <ItemListItem 
                                        key={item.uniqueId} 
                                        item={item} 
                                        template={template} 
                                        affixes={gameData.affixes} 
                                        isSelected={false} 
                                        onClick={() => onEquipItem(item)}
                                        meetsRequirements={meetsRequirements(item)}
                                        onDragStart={() => handleDragStart(item, 'inventory')}
                                        onMouseEnter={(e) => { setHoveredItem(item); setTooltipPosition({ x: e.clientX, y: e.clientY }); }}
                                        onMouseLeave={() => { setHoveredItem(null); setTooltipPosition(null); }}
                                    />;
                        })}
                    </div>
                </div>
            </div>

            {hoveredItem && tooltipPosition && (
                <ItemComparisonTooltip 
                    hoveredItem={hoveredItem}
                    character={character}
                    gameData={gameData}
                    position={tooltipPosition}
                />
            )}
        </ContentPanel>
    );
};