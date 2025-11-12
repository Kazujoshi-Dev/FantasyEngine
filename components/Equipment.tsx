import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate, GameData, CharacterStats, ItemRarity, Affix } from '../types';
import { ItemDetailsPanel, ItemListItem, EmptySlotListItem } from './shared/ItemSlot';
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
    <div className="flex justify-between items-center py-0.5 px-2 rounded-lg text-xs hover:bg-slate-800/50">
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
            <div className="flex-grow overflow-y-auto pr-2">

                <h4 className="font-semibold text-gray-300 text-xs px-2 mt-2 mb-0.5">{t('statistics.baseAttributes')}</h4>
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
                                    {base}
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
                
                <h4 className="font-semibold text-gray-300 text-xs px-2 mt-2 mb-0.5">{t('statistics.vitals')}</h4>
                <StatDisplayRow label={t('statistics.health')} value={`${stats.currentHealth.toFixed(0)} / ${stats.maxHealth}`} />
                <StatDisplayRow label={t('statistics.mana')} value={`${stats.currentMana.toFixed(0)} / ${stats.maxMana}`} />
                <StatDisplayRow label={t('statistics.energyLabel')} value={`${stats.currentEnergy} / ${stats.maxEnergy}`} />

                <h4 className="font-semibold text-gray-300 text-xs px-2 mt-2 mb-0.5">{t('statistics.combatStats')}</h4>
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

export const Equipment: React.FC<EquipmentProps> = ({ character, baseCharacter, gameData, onEquipItem, onUnequipItem }) => {
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<{ item: ItemInstance, from: 'inventory' | EquipmentSlot } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: ItemInstance, from: 'inventory' | EquipmentSlot } | null>(null);
    const [draggedItemInfo, setDraggedItemInfo] = useState<{ item: ItemInstance, from: 'inventory' | EquipmentSlot } | null>(null);
    const [hideUnusable, setHideUnusable] = useState(false);
    const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');
    const [slotFilter, setSlotFilter] = useState<string>('all');

    const handleItemClick = (item: ItemInstance, from: 'inventory' | EquipmentSlot) => {
        setSelectedItem({ item, from });
    };

    const handleContextMenu = (e: React.MouseEvent, item: ItemInstance, from: 'inventory' | EquipmentSlot) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item, from });
    };
    
    const handleDragStart = (item: ItemInstance, from: 'inventory' | EquipmentSlot) => {
        setDraggedItemInfo({ item, from });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDropOnBackpack = () => {
        if (draggedItemInfo && draggedItemInfo.from !== 'inventory') {
            onUnequipItem(draggedItemInfo.item, draggedItemInfo.from);
        }
        setDraggedItemInfo(null);
    };

    const handleDropOnSlot = (targetSlot: EquipmentSlot) => {
        if (!draggedItemInfo) return;
        
        const { item, from } = draggedItemInfo;

        // Logic for swapping items between equipment slots
        if (from !== 'inventory' && from !== targetSlot) {
            const sourceItem = item;
            const targetItem = character.equipment[targetSlot];
            const sourceTemplate = gameData.itemTemplates.find(t => t.id === sourceItem.templateId);
            const targetTemplate = targetItem ? gameData.itemTemplates.find(t => t.id === targetItem.templateId) : null;

            if (!sourceTemplate) return;

            // Check if source item can go into target slot
            const isSourceCompatible = sourceTemplate.slot === targetSlot || (sourceTemplate.slot === 'ring' && (targetSlot === EquipmentSlot.Ring1 || targetSlot === EquipmentSlot.Ring2));
            // Check if target item (if exists) can go into source slot
            const isTargetCompatible = !targetTemplate || targetTemplate.slot === from || (targetTemplate.slot === 'ring' && (from === EquipmentSlot.Ring1 || from === EquipmentSlot.Ring2));

            if (isSourceCompatible && isTargetCompatible) {
                // Perform a swap by un-equipping both and then re-equipping them in the new slots.
                // This logic should be handled in App.tsx to ensure atomicity. For now, let's just do a simple swap.
                // A full implementation would need a dedicated `swapItems(item1, slot1, item2, slot2)` API call.
                // Simplified: just unequip source, then equip it into new slot. The old item in target slot will be unequipped by `onEquipItem` logic.
                onUnequipItem(sourceItem, from);
                onEquipItem(sourceItem); // `onEquipItem` should handle finding the right slot
            }
        }
        // Logic for equipping from inventory
        else if (from === 'inventory') {
            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
            if (!template) return;

            const isCorrectSlot = template.slot === targetSlot || (template.slot === 'ring' && (targetSlot === EquipmentSlot.Ring1 || targetSlot === EquipmentSlot.Ring2));

            if (isCorrectSlot) {
                onEquipItem(item);
            }
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

    const contextMenuOptions = useMemo(() => {
        if (!contextMenu) return [];
        const { from } = contextMenu;
        if (from === 'inventory') {
            return [{ label: t('equipment.equip'), action: () => onEquipItem(contextMenu.item) }];
        } else {
            return [{ label: t('equipment.unequip'), action: () => onUnequipItem(contextMenu.item, from as EquipmentSlot) }];
        }
    }, [contextMenu, onEquipItem, onUnequipItem, t]);

    return (
        <ContentPanel title={t('equipment.title')}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">

                {/* Column 1: Equipped Items */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('equipment.equipped')}</h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                        {slotOrder.map(slot => {
                            const item = character.equipment[slot];
                            const template = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;
                             const canDrop = draggedItemInfo && (
                                (draggedItemInfo.from === 'inventory' && (gameData.itemTemplates.find(t=>t.id === draggedItemInfo.item.templateId)?.slot === slot || (gameData.itemTemplates.find(t=>t.id === draggedItemInfo.item.templateId)?.slot === 'ring' && (slot === 'ring1' || slot === 'ring2'))))
                                || (draggedItemInfo.from !== 'inventory') // allow swapping
                            );

                            return (
                                <div key={slot} onDragOver={handleDragOver} onDrop={() => handleDropOnSlot(slot)}
                                    className={`rounded-lg ${canDrop ? 'bg-indigo-500/20' : ''}`}>
                                    {item && template ? (
                                        <ItemListItem 
                                            item={item} 
                                            template={template} 
                                            affixes={gameData.affixes} 
                                            isSelected={selectedItem?.item.uniqueId === item.uniqueId} 
                                            onClick={() => handleItemClick(item, slot)} 
                                            onContextMenu={(e) => handleContextMenu(e, item, slot)}
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
                    {selectedItem ? (
                        <ItemDetailsPanel item={selectedItem.item} template={gameData.itemTemplates.find(t => t.id === selectedItem.item.templateId) || null} affixes={gameData.affixes} character={character} />
                    ) : (
                        <CombatStatsPanel character={character} baseCharacter={baseCharacter} />
                    )}
                </div>

                {/* Column 3: Backpack */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
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
                    <div onDragOver={handleDragOver} onDrop={handleDropOnBackpack} className="flex-grow overflow-y-auto pr-2 space-y-1 border border-transparent rounded-lg">
                        {validInventory.map(item => {
                            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            return <ItemListItem 
                                        key={item.uniqueId} 
                                        item={item} 
                                        template={template} 
                                        affixes={gameData.affixes} 
                                        isSelected={selectedItem?.item.uniqueId === item.uniqueId} 
                                        onClick={() => handleItemClick(item, 'inventory')} 
                                        onContextMenu={(e) => handleContextMenu(e, item, 'inventory')} 
                                        meetsRequirements={meetsRequirements(item)}
                                        onDragStart={() => handleDragStart(item, 'inventory')}
                                    />;
                        })}
                    </div>
                </div>
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={contextMenuOptions}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </ContentPanel>
    );
};
