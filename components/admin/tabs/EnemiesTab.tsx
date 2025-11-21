

import React, { useState } from 'react';
import { Enemy, ItemTemplate } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { EnemyEditor } from '../editors/EnemyEditor';

interface EnemiesTabProps {
  enemies: Enemy[];
  itemTemplates: ItemTemplate[];
  onGameDataUpdate: (key: string, data: any) => void;
}

export const EnemiesTab: React.FC<EnemiesTabProps> = ({ enemies, itemTemplates, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingEnemy, setEditingEnemy] = useState<Partial<Enemy> | null>(null);

  // Filter OUT bosses, safeguard array against nulls inside
  const standardEnemies = (enemies || [])
    .filter(e => e && typeof e === 'object')
    .filter(e => !e.isBoss);

  const handleSaveData = (itemFromEditor: Enemy | null) => {
    if (!itemFromEditor) {
        setEditingEnemy(null);
        return;
    }

    const safeEnemies = enemies || [];
    const itemExists = itemFromEditor.id ? safeEnemies.some(d => d.id === itemFromEditor.id) : false;
    let updatedData;

    if (itemExists) {
        updatedData = safeEnemies.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
    } else {
        // Ensure isBoss is false for this tab
        updatedData = [...safeEnemies, { ...itemFromEditor, id: itemFromEditor.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }), isBoss: false }];
    }
    onGameDataUpdate('enemies', updatedData);
    setEditingEnemy(null);
  };

  const handleDeleteData = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
        const updatedData = (enemies || []).filter(item => item.id !== id);
        onGameDataUpdate('enemies', updatedData);
    }
  };
  
  const renderName = (name: any) => {
      if (typeof name === 'string') return name;
      if (typeof name === 'object' && name !== null) return '[Invalid Object]';
      return 'Bez nazwy';
  };

  return (
    <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-indigo-400">{t('admin.enemy.manage')}</h3>
            <button onClick={() => setEditingEnemy({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.enemy.add')}</button>
        </div>
        {editingEnemy ? (
            <EnemyEditor enemy={editingEnemy} onSave={handleSaveData} onCancel={() => setEditingEnemy(null)} isEditing={!!editingEnemy.id} allItemTemplates={itemTemplates} />
        ) : (
            <div className="space-y-2">
                {standardEnemies.length === 0 && <p className="text-gray-500 text-center py-4">Brak zdefiniowanych przeciwników.</p>}
                {standardEnemies.map(enemy => (
                     <div key={enemy.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                        <div><p className="font-semibold">{renderName(enemy.name)}</p></div>
                        <div className="space-x-2">
                            <button onClick={() => setEditingEnemy(enemy)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                            <button onClick={() => handleDeleteData(enemy.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};