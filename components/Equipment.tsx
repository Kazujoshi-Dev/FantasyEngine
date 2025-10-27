



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
  
  const [selected, setSelected] = useState<{ item: ItemInstance; source: 'equipped' | 'inventory' } | null>(null);
  const [filterSlot, setFilterSlot] = useState<EquipmentSlot | 'consumable' | 'all'>('all');

  const selectedTemplate = useMemo(() => {
    if (!selected) return null;
    return itemTemplates.find(t => t.id === selected.item.templateId) || null;
  }, [selected, itemTemplates]);

  const filteredInventory = useMemo(() => {
    if (filterSlot === 'all') {
        return character.inventory;
    }
    return character.inventory.filter(item => {
        const template = itemTemplates.find(t => t.id === item.templateId);
        if (!template) return false;
        if (filterSlot === EquipmentSlot.Ring1 || filterSlot === EquipmentSlot.Ring2) {
            return template.slot === 'ring';
        }
        return template.slot === filterSlot;
    });
  }, [character.inventory, filterSlot, itemTemplates]);

  const handleSelectItem = (item: ItemInstance, source: 'equipped' | 'inventory') => {
    setSelected({ item, source });
  };

  const getSlotForEquippedItem = (itemInstance: ItemInstance): EquipmentSlot | undefined => {
      for (const slot in character.equipment) {
          if (character.equipment[slot as EquipmentSlot]?.uniqueId === itemInstance.uniqueId) {
              return slot as EquipmentSlot;
          }
      }
      return undefined;
  }

  return (
    <ContentPanel title={t('equipment.title')}>
       <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">
        
        {/* Equipped Items List */}
        <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
          <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('equipment.equipped')}</h3>
          <div className="flex-grow overflow-y-auto pr-2 space-y-1">
            {slotOrder.map(slot => {
                const item = character.equipment[slot];
                if (item) {
                    const template = itemTemplates.find(t => t.id === item.templateId);
                    if (!template) return null;
                    return (
                        <ItemListItem
                            key={item.uniqueId}
                            item={item}
                            template={template}
                            isSelected={selected?.item.uniqueId === item.uniqueId}
                            onClick={() => handleSelectItem(item, 'equipped')}
                        />
                    );
                } else {
                    return (
                        <EmptySlotListItem
                            key={slot}
                            slotName={t(`equipment.slot.${slot}`)}
                            onClick={() => setSelected(null)}
                        />
                    );
                }
            })}
        </div>
        </div>

        {/* Details Panel */}
        <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
           <ItemDetailsPanel item={selected?.item} template={selectedTemplate}>
              {selected && (
                <div className="mt-4">
                  {selected.source === 'inventory' ? (
                    <button 
                      onClick={() => onEquipItem(selected.item)}
                      className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-indigo-700 transition-colors"
                    >
                      {t('equipment.equip')}
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                          const fromSlot = getSlotForEquippedItem(selected.item);
                          if(fromSlot) {
                            onUnequipItem(selected.item, fromSlot);
                            setSelected(null);
                          }
                      }}
                      className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-amber-700 transition-colors"
                    >
                      {t('equipment.unequip')}
                    </button>
                  )}
                </div>
              )}
           </ItemDetailsPanel>
        </div>

        {/* Backpack List */}
        <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-xl font-bold text-indigo-400">{t('equipment.backpack')}</h3>
            <div className="flex items-center space-x-2">
                <label htmlFor="item-filter" className="text-sm text-gray-400">{t('equipment.filterByType')}:</label>
                <select
                    id="item-filter"
                    value={filterSlot}
                    onChange={(e) => {
                        setFilterSlot(e.target.value as EquipmentSlot | 'consumable' | 'all');
                        setSelected(null); // Deselect item when filter changes
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                    <option value="all">{t('equipment.showAll')}</option>
                    {Object.values(EquipmentSlot).map(slot => (
                        <option key={slot} value={slot}>{t(`equipment.slot.${slot}`)}</option>
                    ))}
                    <option value="consumable">{t('item.slot.consumable')}</option>
                </select>
            </div>
          </div>
          <ItemList
            items={filteredInventory}
            itemTemplates={itemTemplates}
            selectedItem={selected?.source === 'inventory' ? selected.item : null}
            onSelectItem={(item) => handleSelectItem(item, 'inventory')}
          />
        </div>

      </div>
    </ContentPanel>
  );
};