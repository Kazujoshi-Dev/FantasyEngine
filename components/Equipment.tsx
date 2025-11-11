import React, { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
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
    const [style, setStyle] = useState<React.CSSProperties>({});

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
            } else {
                const slotToCompare = hoveredTemplate.slot as EquipmentSlot;
                const equippedItem = character.equipment[slotToCompare];
                if (equippedItem) {
                    const equippedTemplate = gameData.itemTemplates.find(t => t.id === equippedItem.templateId);
                    if (equippedTemplate) {
                         equippedItems.push({ item: equippedItem, template: equippedTemplate, slotName: t(`equipment.slot.${slotToCompare}`) });
                    }
                }
            }
        }
        
        return {
            hoveredItem: hoveredInfo.item,
            hoveredTemplate,
            equippedItemsAndTemplates: equippedItems,
        };
    }, [hoveredInfo, character, gameData, t]);

    useLayoutEffect(() => {
        if (!tooltipContainerRef.current) return;
        
        const rect = hoveredInfo.element.getBoundingClientRect();
        
        const numTooltips = 1 + equippedItemsAndTemplates.length;
        const singleTooltipWidth = 288; // w-72
        const gap = 16; // gap-4
        const estimatedWidth = (numTooltips * singleTooltipWidth) + ((numTooltips - 1) * gap);
        
        let top = rect.top;
        let left = rect.right + 15; // Default position to the right

        if (left + estimatedWidth > window.innerWidth - 15) {
            left = rect.left - estimatedWidth - 15;
        }

        if (left < 15) {
            left = 15;
        }

        const tooltipHeight = tooltipContainerRef.current.offsetHeight;
        if (top + tooltipHeight > window.innerHeight - 10) {
            top = window.innerHeight - tooltipHeight - 10;
        }
        
        if (top < 10) {
            top = 10;
        }

        setStyle({ top: `${top}px`, left: `${left}px`, position: 'fixed' });

    }, [hoveredInfo, equippedItemsAndTemplates]);

    if (!hoveredTemplate) return null;

    return (
        <div ref={tooltipContainerRef} style={style} className="z-20 flex gap-4 pointer-events-none">
            {equippedItemsAndTemplates.map(({ item, template, slotName }) => (
                <div key={item.uniqueId} className="w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 animate-fade-in">
                    <ItemDetailsPanel
                        item={item}
                        template={template}
                        affixes={gameData.affixes}
                        character={character}
                        size="small"
                        title={`${t('equipment.equipped')} (${slotName})`}
                    />
                </div>
            ))}
            <div className="w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 animate-fade-in">
                <ItemDetailsPanel
                    item={hoveredItem!}
                    template={hoveredTemplate}
                    affixes={gameData.affixes}
                    character={character}
                    size="small"
                />
            </div>
        </div>
    );
};


export const Equipment: React.FC<EquipmentProps> = ({ character, baseCharacter, gameData, onEquipItem, onUnequipItem }) => {
  const { t } = useTranslation();
  
  const [draggedItemInfo, setDraggedItemInfo] = useState<{ item: ItemInstance; sourceSlot: EquipmentSlot | 'inventory' } | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<'equipped' | 'inventory' | null>(null);
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');
  const [hoveredItemInfo, setHoveredItemInfo] = useState<HoveredItemInfo | null>(null);


  const backpackCapacity = 40 + ((character.backpack?.level || 1) - 1) * 10;

  const validInventory = useMemo(() => 
    character.inventory.filter(item => gameData.itemTemplates.find(t => t.id === item.templateId)),
    [character.inventory, gameData.itemTemplates]
  );

  const filteredInventory = useMemo(() => {
    return validInventory.filter(item => {
        const template = gameData.itemTemplates.find(t => t.id === item.templateId);
        if (!template) return false;

        const rarityMatch = rarityFilter === 'all' || template.rarity === rarityFilter;
        const slotMatch = slotFilter === 'all' || template.slot === slotFilter;
        
        return rarityMatch && slotMatch;
    });
  }, [validInventory, slotFilter, rarityFilter, gameData.itemTemplates]);

  const meetsRequirements = useCallback((item: ItemInstance): boolean => {
    const template = gameData.itemTemplates.find(t => t.id === item.templateId);
    if (!template) return true; // Fail safe, don't show red border if template is missing

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

  const handleDragStart = (e: React.DragEvent, item: ItemInstance, sourceSlot: EquipmentSlot | 'inventory') => {
    setDraggedItemInfo({ item, sourceSlot });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.uniqueId); 
    setHoveredItemInfo(null);
  };

  const handleDragEnd = () => {
    setDraggedItemInfo(null);
    setDragOverPanel(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleDropOnPanel = (panel: 'equipped' | 'inventory') => {
    if (!draggedItemInfo) return;

    const { item, sourceSlot } = draggedItemInfo;

    if (panel === 'inventory' && sourceSlot !== 'inventory') {
      onUnequipItem(item, sourceSlot as EquipmentSlot);
    } 
    else if (panel === 'equipped' && sourceSlot === 'inventory') {
       onEquipItem(item);
    }
    else if (panel === 'equipped' && sourceSlot !== 'inventory') {
      onEquipItem(item);
    }

    handleDragEnd(); 
  };
  
  const getPanelDropZoneClassName = (panel: 'equipped' | 'inventory'): string => {
    if (!draggedItemInfo || dragOverPanel !== panel) return '';

    const { sourceSlot } = draggedItemInfo;
    
    let isValid = false;
    if (panel === 'inventory') {
      if (sourceSlot !== 'inventory') {
        isValid = character.inventory.length < backpackCapacity;
      }
    } 
    else if (panel === 'equipped') {
      isValid = true;
    }
    
    return isValid ? 'bg-green-900/50' : 'bg-red-900/50';
  };

  const filterableSlots = [
    'head', 'neck', 'chest', 'hands', 'waist', 'legs', 'feet', 'ring', 'mainHand', 'offHand', 'twoHand'
  ];

  return (
    <ContentPanel title={t('equipment.title')}>
       <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">
        
        <div 
            className={`bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 transition-colors duration-150 ${getPanelDropZoneClassName('equipped')}`}
            onDrop={() => handleDropOnPanel('equipped')}
            onDragOver={handleDragOver}
            onDragEnter={() => setDragOverPanel('equipped')}
            onDragLeave={() => setDragOverPanel(null)}
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
                                onMouseEnter={(e, item) => setHoveredItemInfo({ item, element: e.currentTarget, source: slot })}
                                onMouseLeave={() => setHoveredItemInfo(null)}
                                draggable
                                onDragStart={e => handleDragStart(e, item, slot)}
                                onDragEnd={handleDragEnd}
                                className={draggedItemInfo?.item.uniqueId === item.uniqueId ? 'opacity-40' : ''}
                                showPrimaryStat={false}
                            />
                        ) : (
                            <EmptySlotListItem
                                slotName={t(`equipment.slot.${slot}`)}
                                onMouseEnter={() => setHoveredItemInfo(null)}
                            />
                        )}
                    </div>
                );
            })}
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
            <CombatStatsPanel character={character} baseCharacter={baseCharacter} />
        </div>


        <div 
            className={`bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 transition-colors duration-150 ${getPanelDropZoneClassName('inventory')}`}
            onDrop={() => handleDropOnPanel('inventory')}
            onDragOver={handleDragOver}
            onDragEnter={() => setDragOverPanel('inventory')}
            onDragLeave={() => setDragOverPanel(null)}
        >
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-xl font-bold text-indigo-400">{t('equipment.backpack')}</h3>
            <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                {character.inventory.length} / {backpackCapacity}
            </div>
          </div>
          <div className="px-2 mb-4 flex gap-2">
            <select
                value={slotFilter}
                onChange={e => setSlotFilter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm"
            >
                <option value="all">{t('equipment.showAll')}</option>
                {filterableSlots.map(s => (
                    <option key={s} value={s}>{t(`item.slot.${s}`)}</option>
                ))}
            </select>
            <select
                value={rarityFilter}
                onChange={e => setRarityFilter(e.target.value as ItemRarity | 'all')}
                className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm"
            >
                <option value="all">{t('market.create.allRarities')}</option>
                {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
            </select>
          </div>
          <div className="flex-grow overflow-y-auto pr-2 space-y-1">
              {filteredInventory.map(item => {
                  const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                  if (!template) return null;
                  return (
                      <ItemListItem
                          key={item.uniqueId}
                          item={item}
                          template={template}
                          affixes={gameData.affixes}
                          isSelected={false}
                          onMouseEnter={(e, item) => setHoveredItemInfo({ item, element: e.currentTarget, source: 'inventory' })}
                          onMouseLeave={() => setHoveredItemInfo(null)}
                          draggable
                          onDragStart={e => handleDragStart(e, item, 'inventory')}
                          onDragEnd={handleDragEnd}
                          className={draggedItemInfo?.item.uniqueId === item.uniqueId ? 'opacity-40' : ''}
                          meetsRequirements={meetsRequirements(item)}
                      />
                  );
              })}
          </div>
        </div>
      </div>
       {hoveredItemInfo && <ComparisonTooltips hoveredInfo={hoveredItemInfo} character={character} gameData={gameData} />}
    </ContentPanel>
  );
};