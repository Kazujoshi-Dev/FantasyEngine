
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate, GameData, CharacterStats, ItemRarity, Affix, RolledAffixStats, EquipmentLoadout } from '../types';
import { ItemDetailsPanel, ItemListItem, EmptySlotListItem, rarityStyles, getGrammaticallyCorrectFullName, ItemTooltip } from './shared/ItemSlot';
import { ContextMenu } from './shared/ContextMenu';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { StarIcon } from './icons/StarIcon';
import { SaveIcon } from './icons/SaveIcon'; // Add this icon if available or use generic
import { EditIcon } from './icons/EditIcon'; // Add this icon if available or use generic

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

    const baseStatKeys: (keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy' | 'luck'>)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-bold text-indigo-400 mb-2 px-2">{t('statistics.combatStats')}</h3>
            <div className="flex-grow overflow-y-auto pr-2 space-y-1">

                <h4 className="font-semibold text-gray-300 text-xs px-2 mt-2 mb-0.5 uppercase tracking-wider">{t('statistics.baseAttributes')}</h4>
                {baseStatKeys.map(key => {
                    const total = character.stats[key] || 0;
                    const base = baseCharacter.stats[key] || 0;
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
    
    const hoveredTemplate = (gameData.itemTemplates || []).find(t => t.id === hoveredItem.templateId);
    if (!hoveredTemplate) return null;

    const equippedItemsToCompare: { item: ItemInstance | null, slotName: string }[] = [];
    if (hoveredTemplate.slot === 'ring') {
        equippedItemsToCompare.push({ item: character.equipment.ring1, slotName: t('equipment.slot.ring1') });
        equippedItemsToCompare.push({ item: character.equipment.ring2, slotName: t('equipment.slot.ring2') });
    } else if (hoveredTemplate.slot === EquipmentSlot.TwoHand) {
        if (character.equipment.twoHand) {
            equippedItemsToCompare.push({ item: character.equipment.twoHand, slotName: t('equipment.slot.twoHand') });
        } else {
            if (character.equipment.mainHand) {
                equippedItemsToCompare.push({ item: character.equipment.mainHand, slotName: t('equipment.slot.mainHand') });
            }
            if (character.equipment.offHand) {
                equippedItemsToCompare.push({ item: character.equipment.offHand, slotName: t('equipment.slot.offHand') });
            }
        }
    } else if (hoveredTemplate.slot === EquipmentSlot.MainHand || hoveredTemplate.slot === EquipmentSlot.OffHand) {
        if (character.equipment.twoHand) {
            equippedItemsToCompare.push({ item: character.equipment.twoHand, slotName: t('equipment.slot.twoHand') });
        } else {
             const slotToCompare = hoveredTemplate.slot;
             equippedItemsToCompare.push({ item: character.equipment[slotToCompare], slotName: t(`equipment.slot.${slotToCompare}`) });
        }
    } else if (hoveredTemplate.slot !== 'consumable') {
        const slot = hoveredTemplate.slot as EquipmentSlot;
        equippedItemsToCompare.push({ item: character.equipment[slot], slotName: t(`equipment.slot.${slot}`) });
    }

    return (
        <div className="fixed inset-0 z-30 flex justify-center items-center pointer-events-none animate-fade-in">
            <div className="flex gap-4">
                {equippedItemsToCompare.map(({ item, slotName }, index) => {
                    const equippedTemplate = item ? (gameData.itemTemplates || []).find(t => t.id === item.templateId) : null;
                    return (
                        <div key={index} className="w-72 flex-shrink-0 p-4 bg-slate-900/95 border border-slate-700 rounded-lg shadow-2xl pointer-events-auto backdrop-blur-sm">
                            <ItemDetailsPanel
                                item={item}
                                template={equippedTemplate}
                                affixes={gameData.affixes || []}
                                character={character}
                                size="small"
                                title={item ? `${t('equipment.equipped')}: ${slotName}` : slotName}
                            />
                        </div>
                    );
                })}
                <div className="w-72 flex-shrink-0 p-4 bg-slate-900/95 border border-slate-700 rounded-lg shadow-2xl pointer-events-auto backdrop-blur-sm">
                    <ItemDetailsPanel item={hoveredItem} template={hoveredTemplate} affixes={gameData.affixes || []} character={character} size="small" title={t('equipment.itemToEquip')} />
                </div>
            </div>
        </div>
    );
};


export const Equipment: React.FC = () => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<{ item: ItemInstance; source: 'equipment' | 'inventory'; fromSlot?: EquipmentSlot } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot } | null>(null);
    const [hoveredInventoryItem, setHoveredInventoryItem] = useState<ItemInstance | null>(null);
    const [hoveredEquippedItem, setHoveredEquippedItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');
    const [hideUnusable, setHideUnusable] = useState(false);
    const [isLoadoutLoading, setIsLoadoutLoading] = useState(false);

    if (!character || !baseCharacter || !gameData) {
        return null;
    }

    const backpackCapacity = getBackpackCapacity(character);

    const validInventoryCount = useMemo(() => 
        (character.inventory || []).filter(item => item && (gameData.itemTemplates || []).find(t => t.id === item.templateId)).length,
        [character.inventory, gameData.itemTemplates]
    );

    const equipmentSlotOptions = useMemo(() => {
        const slots: {value: string, label: string}[] = (Object.values(EquipmentSlot) as string[])
            .filter(slot => slot !== EquipmentSlot.Ring1 && slot !== EquipmentSlot.Ring2)
            .map((slot) => ({ value: slot, label: t(`equipment.slot.${slot}`) }));
        
        return slots.concat([{ value: 'ring', label: t('item.slot.ring') }])
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [t]);

    const meetsRequirements = useCallback((item: ItemInstance): boolean => {
        const template = (gameData.itemTemplates || []).find(t => t.id === item.templateId);
        if (!template) return true;

        if (character.level < template.requiredLevel) {
            return false;
        }

        if (template.requiredStats) {
            for (const stat of Object.keys(template.requiredStats)) {
                const key = stat as keyof CharacterStats;
                const reqValue = template.requiredStats[key as keyof typeof template.requiredStats] || 0;
                if (character.stats[key] < reqValue) {
                    return false;
                }
            }
        }
        return true;
    }, [character, gameData.itemTemplates]);

    const filteredInventory = useMemo(() => {
        return (character.inventory || []).filter(item => {
            if (!item) return false;
            const template = (gameData.itemTemplates || []).find(t => t.id === item.templateId);
            if (!template) return false;

            if (hideUnusable && !meetsRequirements(item)) {
                return false;
            }
            
            const rarityMatch = rarityFilter === 'all' || template.rarity === rarityFilter;
            if (!rarityMatch) return false;

            if (filterSlot === 'all') return true;
            if (filterSlot === 'consumable') return template.slot === 'consumable';
            
            if (filterSlot === 'ring') {
                return template.slot === 'ring' || template.slot === EquipmentSlot.Ring1 || template.slot === EquipmentSlot.Ring2;
            }

            return template.slot === filterSlot;
        });
    }, [character.inventory, filterSlot, rarityFilter, hideUnusable, gameData.itemTemplates, meetsRequirements]);

    const handleItemClick = (item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot) => {
        setSelectedItem({ item, source, fromSlot });
    };

    const handleRightClick = (e: React.MouseEvent, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item, source, fromSlot });
    };
    
    const handleEquip = useCallback(async (item: ItemInstance) => {
        try {
            const updatedChar = await api.equipItem(item.uniqueId);
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message || t('error.title'));
        }
    }, [updateCharacter, t]);

    const handleUnequip = useCallback(async (item: ItemInstance, slot: EquipmentSlot) => {
        try {
            const updatedChar = await api.unequipItem(slot);
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message || t('error.title'));
        }
    }, [updateCharacter, t]);

    const handleSaveLoadout = async (id: number) => {
        const name = prompt("Podaj nazwę zestawu:", character.loadouts?.find(l=>l.id===id)?.name || `Zestaw ${id+1}`);
        if (name === null) return;
        try {
            const updated = await api.saveLoadout(id, name);
            updateCharacter(updated);
            alert("Zestaw zapisany!");
        } catch (e: any) { alert(e.message); }
    };

    const handleLoadLoadout = async (id: number) => {
        setIsLoadoutLoading(true);
        try {
            const updated = await api.loadLoadout(id);
            updateCharacter(updated);
        } catch (e: any) { alert(e.message); }
        finally { setIsLoadoutLoading(false); }
    };

    const handleRenameLoadout = async (id: number) => {
        const current = character.loadouts?.find(l=>l.id===id);
        const name = prompt("Nowa nazwa zestawu:", current?.name || "");
        if (name) {
            try {
                const updated = await api.renameLoadout(id, name);
                updateCharacter(updated);
            } catch (e: any) { alert(e.message); }
        }
    };

    const contextMenuOptions = useMemo(() => {
        if (!contextMenu) return [];
        if (contextMenu.source === 'inventory') {
            return [{ label: t('equipment.equip'), action: () => handleEquip(contextMenu.item) }];
        }
        const fromSlot = contextMenu.fromSlot;
        if (contextMenu.source === 'equipment' && fromSlot) {
            return [{ label: t('equipment.unequip'), action: () => handleUnequip(contextMenu.item, fromSlot) }];
        }
        return [];
    }, [contextMenu, t, handleEquip, handleUnequip]);

    const selectedTemplate = useMemo(() => {
        if (!selectedItem) return null;
        return (gameData.itemTemplates || []).find(t => t.id === selectedItem.item.templateId) || null;
    }, [selectedItem, gameData.itemTemplates]);

    const handleDragStart = (e: React.DragEvent, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot) => {
        e.dataTransfer.setData('itemUniqueId', item.uniqueId);
        e.dataTransfer.setData('source', source);
        if (fromSlot) {
            e.dataTransfer.setData('fromSlot', fromSlot);
        }
    };
    
    const handleDrop = (e: React.DragEvent, target: 'inventory' | { slot: EquipmentSlot }) => {
        e.preventDefault();
        e.stopPropagation();
        const itemUniqueId = e.dataTransfer.getData('itemUniqueId');
        const source = e.dataTransfer.getData('source') as 'equipment' | 'inventory';
        const fromSlot = e.dataTransfer.getData('fromSlot') as EquipmentSlot;
    
        if (!itemUniqueId) return;
    
        let itemToMove: ItemInstance | null | undefined = null;
        if (source === 'inventory') {
            itemToMove = (character.inventory || []).find(i => i && i.uniqueId === itemUniqueId);
        } else if (source === 'equipment' && fromSlot) {
            itemToMove = character.equipment[fromSlot];
        }
    
        if (!itemToMove) return;
    
        if (target === 'inventory') {
            if (source === 'equipment' && fromSlot) {
                handleUnequip(itemToMove, fromSlot);
            }
        } else {
            handleEquip(itemToMove);
        }
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    
    return (
        <ContentPanel title={t('equipment.title')}>
            {/* Loadout Section */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 mb-6 flex flex-wrap items-center gap-4 animate-fade-in">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-2">Zestawy:</span>
                <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map(id => {
                        const loadout = character.loadouts?.find(l => l.id === id);
                        return (
                            <div key={id} className="group relative flex items-center bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                <button 
                                    onClick={() => handleLoadLoadout(id)}
                                    disabled={!loadout || isLoadoutLoading}
                                    title={loadout ? `Załóż: ${loadout.name}` : "Zestaw pusty"}
                                    className={`px-3 py-2 text-sm font-bold transition-colors ${loadout ? 'text-white hover:bg-indigo-600' : 'text-gray-600 cursor-default'}`}
                                >
                                    {loadout ? loadout.name : `Zestaw ${id+1}`}
                                </button>
                                <button 
                                    onClick={() => handleSaveLoadout(id)}
                                    title="Zapisz obecny sprzęt"
                                    className="px-2 py-2 bg-slate-700 hover:bg-green-700 text-gray-400 hover:text-white border-l border-slate-600 transition-colors"
                                >
                                    💾
                                </button>
                                {loadout && (
                                    <button 
                                        onClick={() => handleRenameLoadout(id)}
                                        title="Zmień nazwę"
                                        className="px-2 py-2 bg-slate-700 hover:bg-sky-700 text-gray-400 hover:text-white border-l border-slate-600 transition-colors"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                {isLoadoutLoading && <span className="text-xs text-indigo-400 animate-pulse font-bold">Zmieniam zestaw...</span>}
            </div>

            <div 
                className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]"
            >
                {/* Equipped Items */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('equipment.equipped')}</h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                        {slotOrder.map(slot => {
                            const item = character.equipment ? character.equipment[slot] : null;
                            const template = (item && typeof item === 'object') ? (gameData.itemTemplates || []).find(t => t.id === item.templateId) : null;
                             if (slot === EquipmentSlot.TwoHand && character.equipment?.mainHand) {
                                return null;
                            }
                             if ((slot === EquipmentSlot.MainHand || slot === EquipmentSlot.OffHand) && character.equipment?.twoHand) {
                                return null;
                            }
                            return (
                                item && template ? (
                                    <div 
                                        key={slot} 
                                        onContextMenu={(e) => handleRightClick(e, item, 'equipment', slot)}
                                        className="relative group cursor-help"
                                        onDrop={(e) => handleDrop(e, { slot })}
                                        onDragOver={handleDragOver}
                                        onMouseEnter={() => setHoveredEquippedItem({ item, template })}
                                        onMouseLeave={() => setHoveredEquippedItem(null)}
                                    >
                                        <ItemListItem
                                            item={item}
                                            template={template}
                                            affixes={gameData.affixes || []}
                                            isSelected={selectedItem?.item.uniqueId === item.uniqueId}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleItemClick(item, 'equipment', slot);
                                            }}
                                            onDoubleClick={() => handleUnequip(item, slot)}
                                            showPrimaryStat={false}
                                            draggable="true"
                                            onDragStart={(e) => handleDragStart(e, item, 'equipment', slot)}
                                        />
                                    </div>
                                ) : (
                                    <div key={slot} onDrop={(e) => handleDrop(e, { slot })} onDragOver={handleDragOver}>
                                        <EmptySlotListItem key={slot} slotName={t(`equipment.slot.${slot}`)} />
                                    </div>
                                )
                            );
                        })}
                    </div>
                </div>

                {/* Details/Stats Panel */}
                <div 
                    className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <CombatStatsPanel character={character} baseCharacter={baseCharacter} />
                </div>

                {/* Inventory */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="text-xl font-bold text-indigo-400">{t('equipment.backpack')}</h3>
                        <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                            {validInventoryCount} / {backpackCapacity}
                        </div>
                    </div>
                    <div 
                        className="px-2 mb-4 space-y-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2">
                                <label htmlFor="item-filter" className="text-sm text-gray-400 flex-shrink-0">{t('equipment.filterByType')}:</label>
                                <select
                                    id="item-filter"
                                    value={filterSlot}
                                    onChange={(e) => {
                                        setFilterSlot(e.target.value);
                                        setSelectedItem(null);
                                    }}
                                    className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
                                >
                                    <option value="all">{t('equipment.showAll')}</option>
                                    {equipmentSlotOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                    <option value="consumable">{t('item.slot.consumable')}</option>
                                </select>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label htmlFor="rarity-filter" className="text-sm text-gray-400 flex-shrink-0">{t('market.browse.filters.rarity')}:</label>
                                <select
                                    id="rarity-filter"
                                    value={rarityFilter}
                                    onChange={(e) => setRarityFilter(e.target.value as ItemRarity | 'all')}
                                    className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
                                >
                                    <option value="all">{t('market.browse.filters.all')}</option>
                                    {Object.values(ItemRarity).map((r: string) => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                                </select>
                            </div>
                        </div>
                        <label className="flex items-center space-x-2 text-sm text-gray-400">
                            <input type="checkbox" checked={hideUnusable} onChange={(e) => setHideUnusable(e.target.checked)} className="form-checkbox h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/>
                            <span>{t('equipment.hideUnusable')}</span>
                        </label>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-1" onMouseLeave={() => setHoveredInventoryItem(null)} onDrop={(e) => handleDrop(e, 'inventory')} onDragOver={handleDragOver}>
                        {filteredInventory.map(item => {
                            const template = (gameData.itemTemplates || []).find(t => t.id === item.templateId);
                            if (!template) return null;
                            const isSelected = selectedItem?.item.uniqueId === item.uniqueId;
                            return (
                                <div 
                                    key={item.uniqueId} 
                                    onMouseEnter={() => setHoveredInventoryItem(item)}
                                    onContextMenu={(e) => handleRightClick(e, item, 'inventory')}
                                >
                                    <ItemListItem
                                        item={item}
                                        template={template}
                                        affixes={gameData.affixes || []}
                                        isSelected={isSelected}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleItemClick(item, 'inventory');
                                        }}
                                        onDoubleClick={() => handleEquip(item)}
                                        showPrimaryStat={false}
                                        meetsRequirements={meetsRequirements(item)}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, item, 'inventory')}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {contextMenu && <ContextMenu {...contextMenu} options={contextMenuOptions} onClose={() => setContextMenu(null)} />}
            {hoveredInventoryItem && <ItemComparisonTooltip hoveredItem={hoveredInventoryItem} character={character} gameData={gameData} />}

            {hoveredEquippedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-fade-in">
                    <div className="w-80 bg-slate-900/95 border-2 border-slate-600 rounded-xl shadow-2xl p-4 backdrop-blur-sm pointer-events-auto">
                         <ItemDetailsPanel 
                            item={hoveredEquippedItem.item} 
                            template={hoveredEquippedItem.template} 
                            affixes={gameData.affixes || []} 
                            character={character} 
                         />
                    </div>
                </div>
            )}

        </ContentPanel>
    );
};
