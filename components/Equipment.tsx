import React from 'react';
import { ContentPanel } from './ContentPanel';
// fix: Add ItemTemplate and Affix to imports
import { PlayerCharacter, EquipmentSlot, ItemTemplate, Affix } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
// fix: Import helper function to get item name
import { getGrammaticallyCorrectFullName } from './shared/ItemSlot';

interface EquipmentProps {
  character: PlayerCharacter;
  // fix: Add missing props to look up item names
  itemTemplates: ItemTemplate[];
  affixes: Affix[];
}

const EquipmentSlotDisplay: React.FC<{ slotName: string; itemName: string | null }> = ({ slotName, itemName }) => (
  <div className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
    <span className="font-semibold text-gray-400">{slotName}</span>
    <span className="text-white font-medium">{itemName || '---'}</span>
  </div>
);

export const Equipment: React.FC<EquipmentProps> = ({ character, itemTemplates, affixes }) => {
  const { t } = useTranslation();
  const { equipment, inventory } = character;

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
  ];

  return (
    <ContentPanel title={t('equipment.title')}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Equipped Items */}
        <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl">
          <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('equipment.equipped')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slotOrder.map(slot => {
              // fix: Look up item name from template
              const item = equipment[slot];
              const template = item ? itemTemplates.find(t => t.id === item.templateId) : null;
              const itemName = item && template ? getGrammaticallyCorrectFullName(item, template, affixes || []) : null;
              return (
                <EquipmentSlotDisplay
                  key={slot}
                  slotName={t(`equipment.slot.${slot}`)}
                  itemName={itemName}
                />
              );
            })}
          </div>
        </div>

        {/* Backpack */}
        <div className="bg-slate-900/40 p-6 rounded-xl">
          <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('equipment.backpack')}</h3>
          {inventory.length > 0 ? (
            <ul className="space-y-2">
              {inventory.map(item => {
                // fix: Look up item name from template
                const template = itemTemplates.find(t => t.id === item.templateId);
                const name = template ? getGrammaticallyCorrectFullName(item, template, affixes || []) : t('item.unknown');
                return (
                  <li key={item.uniqueId} className="bg-slate-800/50 p-3 rounded-lg text-white">
                    {name}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500 italic">Plecak jest pusty.</p>
          )}
        </div>
      </div>
    </ContentPanel>
  );
};