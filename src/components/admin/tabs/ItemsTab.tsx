

import React, { useState, useMemo } from 'react';
import { ItemTemplate, ItemRarity, EquipmentSlot } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { ItemEditor } from '../editors/ItemEditor';
import { rarityStyles } from '../../shared/ItemSlot';

interface ItemsTabProps {
  itemTemplates: ItemTemplate[];
  onGameDataUpdate: (key: string, data: any) => void;
}

export const ItemsTab: React.FC<ItemsTabProps> = ({ itemTemplates, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingItem, setEditingItem] = useState<Partial<ItemTemplate> | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemRarityFilter, setItemRarityFilter] = useState<ItemRarity | 'all'>('all');
  const [itemSlotFilter, setItemSlotFilter] = useState<string>('all');
  
  const handleSaveData = (itemFromEditor: ItemTemplate | null) => {
    if (!itemFromEditor) {
        setEditingItem(null);
        return;
    }

    const safeItemTemplates = itemTemplates || [];
    const itemExists = itemFromEditor.id ? safeItemTemplates.some(d => d.id === itemFromEditor.id) : false;
    let updatedData;

    if (itemExists) {
        updatedData = safeItemTemplates.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
    } else {
        updatedData = [...safeItemTemplates, { ...itemFromEditor, id: itemFromEditor.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }) }];
    }
    onGameDataUpdate('itemTemplates', updatedData);
    setEditingItem(null);
  };

  const handleDeleteData = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
        const updatedData = (itemTemplates || []).filter(item => item.id !== id);
        onGameDataUpdate('itemTemplates', updatedData);
    }
  };

  const filteredItems = useMemo(() => {
    return (itemTemplates || []).filter(item => {
        if (!item || !item.name || typeof item.name !== 'string') return false;
        const nameMatch = item.name.toLowerCase().includes(itemSearch.toLowerCase());
        const rarityMatch = itemRarityFilter === 'all' || item.rarity === itemRarityFilter;
        const slotMatch = itemSlotFilter === 'all' || item.slot === itemSlotFilter;
        return nameMatch && rarityMatch && slotMatch;
    }).sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [itemTemplates, itemSearch, itemRarityFilter, itemSlotFilter]);

  return (
    <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-indigo-400">{t('admin.manageItems')}</h3>
            <button onClick={() => setEditingItem({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.item.add')}</button>
        </div>
        {editingItem ? (
             <ItemEditor item={editingItem} onSave={handleSaveData} onCancel={() => setEditingItem(null)} isEditing={!!editingItem.id} />
        ) : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-800/50 rounded-lg">
                    <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder={t('admin.general.searchByName') as string} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/>
                    <select value={itemRarityFilter} onChange={e => setItemRarityFilter(e.target.value as ItemRarity | 'all')} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2">
                        <option value="all">{t('admin.item.allRarities')}</option>
                        {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                    </select>
                    <select value={itemSlotFilter} onChange={e => setItemSlotFilter(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2">
                        <option value="all">{t('admin.item.allSlots')}</option>
                        {Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="ring">ring</option>
                    </select>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                     {filteredItems.map(item => (
                         <div key={item.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                            <div className="flex-1">
                                <p className={`font-semibold ${rarityStyles[item.rarity]?.text || 'text-gray-300'}`}>{item.name}</p>
                                <div className="flex gap-4 text-xs text-gray-400 mt-1">
                                    {(item.damageMin || item.damageMax) && <span>DMG: {item.damageMin}-{item.damageMax}</span>}
                                    {item.armorBonus && <span>ARM: {item.armorBonus}</span>}
                                    <span>Lvl: {item.requiredLevel}</span>
                                    <span className="italic">{item.slot}</span>
                                </div>
                            </div>
                            <div className="space-x-2 flex-shrink-0">
                                <button onClick={() => setEditingItem(item)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                                <button onClick={() => handleDeleteData(item.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}
    </div>
  );
};
