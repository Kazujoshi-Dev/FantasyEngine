import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate, GameData, CharacterStats, ItemRarity } from '../types';
import { ItemDetailsPanel, ItemListItem, EmptySlotListItem } from './shared/ItemSlot';

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
    EquipmentSlot.Hands,
    EquipmentSlot.Waist,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
    EquipmentSlot.Ring1,
    EquipmentSlot.Ring2,
    EquipmentSlot.MainHand,
    EquipmentSlot.OffHand,
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

interface HoveredItemInfo {
    item: ItemInstance;
    source: 'inventory' | EquipmentSlot;
    element: HTMLElement;
}

const ComparisonTooltips: React.FC<{
    hoveredInfo: HoveredItemInfo;
    character: PlayerCharacter;
    gameData: GameData;
}> = ({ hoveredInfo, character, gameData }) => {
    const { t } = useTranslation();
    const tooltipContainerRef = useRef<HTMLDivElement>(null);

    const { hoveredItem, hoveredTemplate, equippedItemsAndTemplates } = useMemo(() => {
        const hoveredTemplate = gameData.itemTemplates.find(t => t.id === hoveredInfo.item.templateId);
        if (!hoveredTemplate) {
            return { hoveredItem: null, hoveredTemplate: null, equippedItemsAndTemplates: [] };
        }

        const equippedItems: { item: ItemInstance; template: ItemTemplate; slotName: string }[] = [];

        if (hoveredInfo.source === 'inventory') { // Only do comparison when hovering backpack
            if (hoveredTemplate.slot === 'ring') {
                if (character.equipment.ring1) {
                    const template1 = gameData.itemTemplates.find(t => t.id === character.equipment.ring1!.templateId);
                    if (template1) {
                        equippedItems.push({ item: character.equipment.ring1, template: template1, slotName: t('equipment.slot.ring1') });
                    }
                }
                if (character.equipment.ring2) {
                    const template2 = gameData.itemTemplates.find(t => t.id === character.equipment.ring2!.templateId);
                    if (template2) {
                        equippedItems.push({ item: character.equipment.ring2, template: template2, slotName: t('equipment.slot.ring2') });
                    }
                }
            }
        }
        return { hoveredItem: hoveredInfo.item, hoveredTemplate, equippedItemsAndTemplates: equippedItems };
    }, [hoveredInfo, character, gameData, t]);

    // FIX: This component implementation is incomplete in the provided file. Returning null to fix the compilation error.
    return null;
};

const getBackpackCapacity = (character: PlayerCharacter): number => 40 + ((character.backpack?.level || 1) - 1) * 10;

export const Equipment: React.FC<EquipmentProps> = ({ character, baseCharacter, gameData, onEquipItem, onUnequipItem }) => {
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<{ item: ItemInstance, from: 'inventory' | EquipmentSlot } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: ItemInstance, from: 'inventory' | EquipmentSlot } | null>(null);
    const [hoveredInfo, setHoveredInfo] = useState<HoveredItemInfo | null>(null);
    const hoverTimeoutRef = useRef<number | null>(null);
    const [hideUnusable, setHideUnusable] = useState(false);

    const handleItemClick = (item: ItemInstance, from: 'inventory' | EquipmentSlot) => {
        setSelectedItem({ item, from });
    };

    const handleContextMenu = (e: React.MouseEvent, item: ItemInstance, from: 'inventory' | EquipmentSlot) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item, from });
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
        character.inventory.filter(item => gameData.itemTemplates.find(t => t.id === item.templateId)),
        [character.inventory, gameData.itemTemplates]
    );

    const filteredInventory = useMemo(() => {
        if (!hideUnusable) {
            return validInventory;
        }
        return validInventory.filter(item => meetsRequirements(item));
    }, [validInventory, hideUnusable, meetsRequirements]);

    const selectedTemplate = useMemo(() => {
        if (!selectedItem) return null;
        return gameData.itemTemplates.find(t => t.id === selectedItem.item.templateId) || null;
    }, [selectedItem, gameData.itemTemplates]);

    const contextMenuOptions = useMemo(() => {
        if (!contextMenu) return [];
        const { item, from } = contextMenu;
        
        if (from === 'inventory') {
            return [{ label: t('equipment.equip'), action: () => onEquipItem(item) }];
        } else {
            return [{ label: t('equipment.unequip'), action: () => onUnequipItem(item, from) }];
        }
    }, [contextMenu, onEquipItem, onUnequipItem, t]);

    const handleMouseEnter = (e: React.MouseEvent, item: ItemInstance, source: 'inventory' | EquipmentSlot) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = window.setTimeout(() => {
            setHoveredInfo({ item, source, element: e.currentTarget as HTMLElement });
        }, 500);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setHoveredInfo(null);
    };


    return (
        <ContentPanel title={t('equipment.title')}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">
                
                {/* Equipped Items Panel */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('equipment.equipped')}</h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                        {slotOrder.map(slot => {
                            const item = character.equipment[slot];
                            const template = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;
                            if (item && template) {
                                return (
                                    <ItemListItem
                                        key={slot}
                                        item={item}
                                        template={template}
                                        affixes={gameData.affixes}
                                        isSelected={selectedItem?.item.uniqueId === item.uniqueId}
                                        onClick={() => handleItemClick(item, slot)}
                                        onContextMenu={(e) => handleContextMenu(e, item, slot)}
                                        onMouseEnter={(e) => handleMouseEnter(e, item, slot)}
                                        onMouseLeave={handleMouseLeave}
                                    />
                                );
                            }
                            // Don't show offhand if two-hand is equipped, and vice-versa
                            if (slot === EquipmentSlot.OffHand && character.equipment.twoHand) return null;
                            if ((slot === EquipmentSlot.MainHand || slot === EquipmentSlot.TwoHand) && character.equipment.twoHand && slot !== EquipmentSlot.TwoHand) return null;

                            return <EmptySlotListItem key={slot} slotName={t(`equipment.slot.${slot}`)} />;
                        })}
                    </div>
                </div>

                {/* Details Panel */}
                <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
                    <ItemDetailsPanel item={selectedItem?.item || null} template={selectedTemplate} affixes={gameData.affixes} character={character}>
                         {selectedItem && (
                            <div className="mt-4">
                                {selectedItem.from === 'inventory' ? (
                                    <button onClick={() => onEquipItem(selectedItem.item)} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg">{t('equipment.equip')}</button>
                                ) : (
                                    // FIX: Add a type guard to ensure `selectedItem.from` is of type EquipmentSlot before calling onUnequipItem.
                                    <button onClick={() => {
                                        if (selectedItem.from !== 'inventory') {
                                            onUnequipItem(selectedItem.item, selectedItem.from);
                                        }
                                    }} className="w-full bg-slate-600 text-white font-bold py-2 rounded-lg">{t('equipment.unequip')}</button>
                                )}
                            </div>
                        )}
                    </ItemDetailsPanel>
                </div>
                
                {/* Backpack Panel */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="text-xl font-bold text-indigo-400">{t('equipment.backpack')}</h3>
                        <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                            {validInventory.length} / {getBackpackCapacity(character)}
                        </div>
                    </div>
                    <div className="px-2 mb-2">
                         <label className="flex items-center space-x-2 text-sm text-gray-400">
                            <input
                                type="checkbox"
                                checked={hideUnusable}
                                onChange={(e) => setHideUnusable(e.target.checked)}
                                className="form-checkbox h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{t('equipment.hideUnusable')}</span>
                        </label>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                        {filteredInventory.map(item => {
                            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            const isSelected = selectedItem?.item.uniqueId === item.uniqueId;
                            return (
                                <ItemListItem
                                    key={item.uniqueId}
                                    item={item}
                                    template={template}
                                    affixes={gameData.affixes}
                                    isSelected={isSelected}
                                    onClick={() => handleItemClick(item, 'inventory')}
                                    onContextMenu={(e) => handleContextMenu(e, item, 'inventory')}
                                    onMouseEnter={(e) => handleMouseEnter(e, item, 'inventory')}
                                    onMouseLeave={handleMouseLeave}
                                    meetsRequirements={meetsRequirements(item)}
                                />
                            );
                        })}
                    </div>
                </div>

                 {/* Combat Stats Panel */}
                <div className="bg-slate-900/40 p-4 rounded-xl xl:col-span-3">
                   <CombatStatsPanel character={character} baseCharacter={baseCharacter}/>
                </div>
            </div>

            {contextMenu && (
                <div
                    className="absolute z-20"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="bg-slate-900 border border-slate-700 rounded-md shadow-lg py-1 w-32">
                        {contextMenuOptions.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => { option.action(); setContextMenu(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {hoveredInfo && <ComparisonTooltips hoveredInfo={hoveredInfo} character={character} gameData={gameData} />}
        </ContentPanel>
    );
};