
import React, { useState } from 'react';
import { Expedition, Location, Enemy, ItemTemplate } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { ExpeditionEditor } from '../editors/ExpeditionEditor';

interface ExpeditionsTabProps {
  expeditions: Expedition[];
  locations: Location[];
  enemies: Enemy[];
  itemTemplates: ItemTemplate[];
  onGameDataUpdate: (key: string, data: any) => void;
}

export const ExpeditionsTab: React.FC<ExpeditionsTabProps> = ({ expeditions, locations, enemies, itemTemplates, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingExpedition, setEditingExpedition] = useState<Partial<Expedition> | null>(null);

  // Safe expedition list
  const safeExpeditions = (expeditions || []).filter(e => e && typeof e === 'object');

  const handleSaveData = (itemFromEditor: Expedition | null) => {
    if (!itemFromEditor) {
        setEditingExpedition(null);
        return;
    }

    const itemExists = itemFromEditor.id ? safeExpeditions.some(d => d.id === itemFromEditor.id) : false;
    let updatedData;

    if (itemExists) {
        updatedData = safeExpeditions.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
    } else {
        updatedData = [...safeExpeditions, { ...itemFromEditor, id: itemFromEditor.id || crypto.randomUUID() }];
    }
    onGameDataUpdate('expeditions', updatedData);
    setEditingExpedition(null);
  };

  const handleDeleteData = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
        const updatedData = safeExpeditions.filter(item => item.id !== id);
        onGameDataUpdate('expeditions', updatedData);
    }
  };

  return (
    <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-indigo-400">{t('admin.expedition.manage')}</h3>
            <button onClick={() => setEditingExpedition({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.expedition.add')}</button>
        </div>
        {editingExpedition ? (
            <ExpeditionEditor 
              expedition={editingExpedition} 
              onSave={handleSaveData} 
              onCancel={() => setEditingExpedition(null)} 
              isEditing={!!editingExpedition.id} 
              allLocations={locations} 
              allEnemies={enemies} 
              allItemTemplates={itemTemplates} 
            />
        ) : (
             <div className="space-y-2">
                {safeExpeditions.length === 0 && <p className="text-gray-500 text-center py-4">Brak zdefiniowanych wypraw.</p>}
                {safeExpeditions.map(exp => (
                     <div key={exp.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{exp.name || 'Bez nazwy'}</p>
                            <p className="text-sm text-gray-400">{exp.description}</p>
                        </div>
                        <div className="space-x-2">
                            <button onClick={() => setEditingExpedition(exp)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                            <button onClick={() => handleDeleteData(exp.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};
