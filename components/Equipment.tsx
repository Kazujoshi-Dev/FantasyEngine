import React, { useState, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate } from '../types';
import { ItemList, ItemDetailsPanel, ItemListItem, EmptySlotListItem } from './shared/ItemSlot';

interface EquipmentProps {
  character: PlayerCharacter;
  itemTemplates: ItemTemplate[];
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

export const Equipment: React.FC<EquipmentProps> = ({ character, itemTemplates, onEquipItem, onUnequipItem }) => {
  const { t } = useTranslation();
  
  const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);
  const [draggedItemInfo, setDraggedItemInfo] = useState<{ item: ItemInstance; sourceSlot: EquipmentSlot | 'inventory' } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<EquipmentSlot | 'inventory' | null>(null);

  const selectedTemplate = useMemo(() => {
    if (!selectedItem) return null;
    return itemTemplates.find(t => t.id === selectedItem.templateId) || null;
  }, [selectedItem, itemTemplates]);

  // --- Drag and Drop Handlers ---

  const handleDragStart = (e: React.DragEvent, item: ItemInstance, sourceSlot: EquipmentSlot | 'inventory') => {
    setDraggedItemInfo({ item, sourceSlot });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.uniqueId); // Necessary for Firefox compatibility
  };

  const handleDragEnd = () => {
    setDraggedItemInfo(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // This is crucial to allow dropping
  };
  
  const handleDragEnter = (target: EquipmentSlot | 'inventory') => {
    if(draggedItemInfo) {
      setDragOverTarget(target);
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (target: EquipmentSlot | 'inventory') => {
    if (!draggedItemInfo || !dragOverTarget) return;

    const { item, sourceSlot } = draggedItemInfo;

    // Case 1: Unequipping (Equipped -> Inventory)
    if (sourceSlot !== 'inventory' && target === 'inventory') {
      onUnequipItem(item, sourceSlot);
    } 
    // Case 2: Equipping (Inventory -> Equipment Slot or Equipped -> Equipment Slot)
    else if (target !== 'inventory') {
       const template = itemTemplates.find(t => t.id === item.templateId);
       if (!template) return;
       
       const isCompatible = template.slot === target || (template.slot === 'ring' && (target === EquipmentSlot.Ring1 || target === EquipmentSlot.Ring2));
       
       if (isCompatible) {
         onEquipItem(item);
       }
    }

    handleDragEnd(); // Reset state after drop
  };
  
  const getDropZoneClassName = (target: EquipmentSlot | 'inventory'): string => {
    if (!draggedItemInfo || dragOverTarget !== target) return '';

    const { item, sourceSlot } = draggedItemInfo;
    const template = itemTemplates.find(t => t.id === item.templateId);
    if (!template) return 'bg-red-900/50';

    let isValid = false;
    // Dragging from equipped to inventory (unequip)
    if (sourceSlot !== 'inventory' && target === 'inventory') {
      isValid = character.inventory.length < 40; // MAX_PLAYER_INVENTORY_SIZE
    } 
    // Dragging to an equipment slot (equip or swap)
    else if (target !== 'inventory') {
      isValid = template.slot === target || (template.slot === 'ring' && (target === EquipmentSlot.Ring1 || target === EquipmentSlot.Ring2));
    }
    
    return isValid ? 'bg-green-900/50' : 'bg-red-900/50';
  };

  return (
    <ContentPanel title={t('equipment.title')}>
       <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">
        
        {/* Equipped Items List */}
        <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
          <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('equipment.equipped')}</h3>
          <div className="flex-grow overflow-y-auto pr-2 space-y-1">
            {slotOrder.map(slot => {
                const item = character.equipment[slot];
                const template = item ? itemTemplates.find(t => t.id === item.templateId) : null;
                const dropZoneClassName = getDropZoneClassName(slot);
                
                return (
                    <div
                        key={slot}
                        onDrop={() => handleDrop(slot)}
                        onDragOver={handleDragOver}
                        onDragEnter={() => handleDragEnter(slot)}
                        onDragLeave={handleDragLeave}
                        className={`rounded-lg transition-colors duration-150 ${dropZoneClassName}`}
                    >
                        {item && template ? (
                            <ItemListItem
                                item={item}
                                template={template}
                                isSelected={selectedItem?.uniqueId === item.uniqueId}
                                onClick={() => setSelectedItem(item)}
                                draggable
                                onDragStart={e => handleDragStart(e, item, slot)}
                                onDragEnd={handleDragEnd}
                                className={draggedItemInfo?.item.uniqueId === item.uniqueId ? 'opacity-40' : ''}
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

        {/* Details Panel - No buttons needed anymore */}
        <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
           <ItemDetailsPanel item={selectedItem} template={selectedTemplate} />
        </div>

        {/* Backpack List */}
        <div 
            className={`bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 transition-colors duration-150 ${getDropZoneClassName('inventory')}`}
            onDrop={() => handleDrop('inventory')}
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter('inventory')}
            onDragLeave={handleDragLeave}
        >
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-xl font-bold text-indigo-400">{t('equipment.backpack')}</h3>
          </div>
          <div className="flex-grow overflow-y-auto pr-2 space-y-1">
              {character.inventory.map(item => {
                  const template = itemTemplates.find(t => t.id === item.templateId);
                  if (!template) return null;
                  return (
                      <ItemListItem
                          key={item.uniqueId}
                          item={item}
                          template={template}
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
