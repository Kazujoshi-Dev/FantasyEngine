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

const ItemComparisonTooltip: React.FC<{
    hoveredItem: ItemInstance;
    character: PlayerCharacter;
    gameData: GameData;
}> = ({ hoveredItem, character, gameData }) => {
    const { t } = useTranslation();
    
    const hoveredTemplate = gameData.itemTemplates.find(t => t.id === hoveredItem.templateId);
    if (!hoveredTemplate) return null;

    const equippedItemsToCompare: { item: ItemInstance | null, slotName: string }[] = [];
    if (hoveredTemplate.slot === 'ring') {
        equippedItemsToCompare.push({ item: character.equipment.ring1, slotName: t('equipment.slot.ring1') });
        equippedItemsToCompare.push({ item: character.equipment.ring2, slotName: t('equipment.slot.ring2') });
    } else if (hoveredTemplate.slot === EquipmentSlot.TwoHand) {
        // Compare 2H with current 1H main hand and offhand
        equippedItemsToCompare.push({ item: character.equipment.mainHand, slotName: t('equipment.slot.mainHand') });
        equippedItemsToCompare.push({ item: character.equipment.offHand, slotName: t('equipment.slot.offHand') });
    } else if (hoveredTemplate.slot === EquipmentSlot.MainHand || hoveredTemplate.slot === EquipmentSlot.OffHand) {
        // Compare 1H with current 2H or the specific 1H slot
        if (character.equipment.twoHand) {
            equippedItemsToCompare.push({ item: character.equipment.twoHand, slotName: t('equipment.slot.twoHand') });
        } else {
             equippedItemsToCompare.push({ item: character.equipment[hoveredTemplate.slot], slotName: t(`equipment.slot.${hoveredTemplate.slot}`) });
        }
    } else if (hoveredTemplate.slot !== 'consumable') {
        const slot = hoveredTemplate.slot as EquipmentSlot;
        equippedItemsToCompare.push({ item: character.equipment[slot], slotName: t(`equipment.slot.${slot}`) });
    }

    return (
        <div className="fixed inset-0 z-30 flex justify-center items-center pointer-events-none animate-fade-in">
            <div className="flex gap-4 p-4 bg-slate-900/95 border border-slate-700 rounded-lg shadow-2xl pointer-events-auto backdrop-blur-sm max-w-5xl">
                <div className="w-72 flex-shrink-0">
                    <ItemDetailsPanel 
                        item={hoveredItem} 
                        template={hoveredTemplate} 
                        affixes={gameData.affixes} 
                        character={character} 
                        size="small"
                        title={t('equipment.itemToEquip')}
                    />
                </div>
                {equippedItemsToCompare.map(({ item, slotName }, index) => {
                    const equippedTemplate = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;
                    return (
                        <div key={index} className="w-72 flex-shrink-0">
                            <ItemDetailsPanel
                                item={item}
                                template={equippedTemplate}
                                affixes={gameData.affixes}
                                character={character}
                                size="small"
                                title={item ? `${t('equipment.equipped')}: ${slotName}` : slotName}
                            />
                        </div>
                    );
                })}
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
                                        meetsRequirements={meetsRequirements(item)}
                                        onDragStart={() => handleDragStart(item, 'inventory')}
                                        onMouseEnter={(e) => { setHoveredItem(item); }}
                                        onMouseLeave={() => { setHoveredItem(null); }}
                                    />;
                        })}
                    </div>
                </div>
            </div>

            {hoveredItem && (
                <ItemComparisonTooltip 
                    hoveredItem={hoveredItem}
                    character={character}
                    gameData={gameData}
                />
            )}
        </ContentPanel>
    );
};