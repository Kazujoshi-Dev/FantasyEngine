import React, { useState, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate, GameData } from '../types';
import { ItemList, ItemDetailsPanel, ItemListItem, EmptySlotListItem } from './shared/ItemSlot';

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
    <div className="flex justify-between items-center py-1 px-2 rounded-lg text-sm hover:bg-slate-800/50">
        <span className="font-medium text-gray-400">{label}</span>
        <span className="font-mono font-bold text-white">{value}</span>
    </div>
);

const CombatStatsPanel: React.FC<{ character: PlayerCharacter }> = ({ character }) => {
    const { t } = useTranslation();
    const stats = character.stats;

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('statistics.combatStats')}</h3>
            <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                <h4 className="font-semibold text-gray-300 text-sm px-2 mt-2 mb-1">{t('statistics.vitals')}</h4>
                <StatDisplayRow label={t('statistics.health')} value={`${stats.currentHealth.toFixed(0)} / ${stats.maxHealth}`} />
                <StatDisplayRow label={t('statistics.mana')} value={`${stats.currentMana.toFixed(0)} / ${stats.maxMana}`} />
                <StatDisplayRow label={t('statistics.energyLabel')} value={`${stats.currentEnergy} / ${stats.maxEnergy}`} />

                <h4 className="font-semibold text-gray-300 text-sm px-2 mt-4 mb-1">{t('statistics.combatStats')}</h4>
                <StatDisplayRow label={t('statistics.physicalDamage')} value={`${stats.minDamage} - ${stats.maxDamage}`} />
                <StatDisplayRow label={t('statistics.magicDamage')} value={`${stats.magicDamageMin} - ${stats.magicDamageMax}`} />
                <StatDisplayRow label={t('statistics.armor')} value={stats.armor} />
                <StatDisplayRow label={t('statistics.critChance')} value={`${stats.critChance.toFixed(1)}%`} />
                <StatDisplayRow label={t('statistics.critDamageModifier')} value={`${stats.critDamageModifier}%`} />
                <StatDisplayRow label={t('statistics.attacksPerTurn')} value={stats.attacksPerRound} />
                <StatDisplayRow label={t('statistics.manaRegen')} value={stats.manaRegen} />
                <StatDisplayRow label={t('statistics.armorPenetration')} value={`${stats.armorPenetrationPercent}% / ${stats.armorPenetrationFlat}`} />
                <StatDisplayRow label={t('statistics.lifeSteal')} value={`${stats.lifeStealPercent}% / ${stats.lifeStealFlat}`} />
                <StatDisplayRow label={t('statistics.manaSteal')} value={`${stats.manaStealPercent}% / ${stats.manaStealFlat}`} />
            </div>
        </div>
    );
};


export const Equipment: React.FC<EquipmentProps> = ({ character, baseCharacter, gameData, onEquipItem, onUnequipItem }) => {
  const { t } = useTranslation();
  
  const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);
  const [draggedItemInfo, setDraggedItemInfo] = useState<{ item: ItemInstance; sourceSlot: EquipmentSlot | 'inventory' } | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<'equipped' | 'inventory' | null>(null);

  const selectedTemplate = useMemo(() => {
    if (!selectedItem) return null;
    return gameData.itemTemplates.find(t => t.id === selectedItem.templateId) || null;
  }, [selectedItem, gameData.itemTemplates]);

  // --- Drag and Drop Handlers ---

  const handleDragStart = (e: React.DragEvent, item: ItemInstance, sourceSlot: EquipmentSlot | 'inventory') => {
    setDraggedItemInfo({ item, sourceSlot });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.uniqueId); // Necessary for Firefox compatibility
  };

  const handleDragEnd = () => {
    setDraggedItemInfo(null);
    setDragOverPanel(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // This is crucial to allow dropping
  };

  const handleDropOnPanel = (panel: 'equipped' | 'inventory') => {
    if (!draggedItemInfo) return;

    const { item, sourceSlot } = draggedItemInfo;

    // Case 1: Unequipping (Equipped item -> Inventory panel)
    if (panel === 'inventory' && sourceSlot !== 'inventory') {
      onUnequipItem(item, sourceSlot as EquipmentSlot);
    } 
    // Case 2: Equipping (Inventory item -> Equipped panel)
    else if (panel === 'equipped' && sourceSlot === 'inventory') {
       onEquipItem(item);
    }
    // Case 3: Swapping equipped items by dropping on the panel
    else if (panel === 'equipped' && sourceSlot !== 'inventory') {
      onEquipItem(item);
    }

    handleDragEnd(); // Reset state after drop
  };
  
  const getPanelDropZoneClassName = (panel: 'equipped' | 'inventory'): string => {
    if (!draggedItemInfo || dragOverPanel !== panel) return '';

    const { sourceSlot } = draggedItemInfo;
    
    let isValid = false;
    // Dragging to inventory panel (unequipping)
    if (panel === 'inventory') {
      if (sourceSlot !== 'inventory') {
        isValid = character.inventory.length < 40; // MAX_PLAYER_INVENTORY_SIZE
      }
    } 
    // Dragging to equipment panel (equipping/swapping)
    else if (panel === 'equipped') {
      isValid = true; // Always allow the attempt, App.tsx will alert if validation fails
    }
    
    return isValid ? 'bg-green-900/50' : 'bg-red-900/50';
  };

  return (
    <ContentPanel title={t('equipment.title')}>
       <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[75vh]">
        
        {/* Equipped Items Panel - NOW A DROPZONE */}
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
                                isSelected={selectedItem?.uniqueId === item.uniqueId}
                                onClick={() => setSelectedItem(item)}
                                draggable
                                onDragStart={e => handleDragStart(e, item, slot)}
                                onDragEnd={handleDragEnd}
                                className={draggedItemInfo?.item.uniqueId === item.uniqueId ? 'opacity-40' : ''}
                                showPrimaryStat={false}
                            />
                        ) : (
                            <EmptySlotListItem
                                slotName={t(`equipment.slot.${slot}`)}
                                onClick={() => setSelectedItem(null)}
                            />
                        )}
                    </div>
                );
            })}
          </div>
        </div>

        {/* Details Panel */}
        <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
           <ItemDetailsPanel item={selectedItem} template={selectedTemplate} affixes={gameData.affixes} character={character} />
        </div>

        {/* Combat Stats Panel */}
        <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
            <CombatStatsPanel character={character} />
        </div>


        {/* Backpack Panel - NOW A DROPZONE */}
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
                {character.inventory.length} / 40
            </div>
          </div>
          <div className="flex-grow overflow-y-auto pr-2 space-y-1">
              {character.inventory.map(item => {
                  const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                  if (!template) return null;
                  return (
                      <ItemListItem
                          key={item.uniqueId}
                          item={item}
                          template={template}
                          affixes={gameData.affixes}
                          isSelected={selectedItem?.uniqueId === item.uniqueId}
                          onClick={() => setSelectedItem(item)}
                          draggable
                          onDragStart={e => handleDragStart(e, item, 'inventory')}
                          onDragEnd={handleDragEnd}
                          className={draggedItemInfo?.item.uniqueId === item.uniqueId ? 'opacity-40' : ''}
                      />
                  );
              })}
          </div>
        </div>
      </div>
    </ContentPanel>
  );
};