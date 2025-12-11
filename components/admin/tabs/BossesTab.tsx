

import React, { useState } from 'react';
import { Enemy, ItemTemplate } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { BossEditor } from '../editors/BossEditor';

interface BossesTabProps {
  enemies: Enemy[];
  itemTemplates: ItemTemplate[];
  onGameDataUpdate: (key: string, data: any) => void;
}

export const BossesTab: React.FC<BossesTabProps> = ({ enemies, itemTemplates, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingBoss, setEditingBoss] = useState<Partial<Enemy> | null>(null);

  // Filter only bosses, safeguard against undefined/null enemies array or elements
  const bosses = (enemies || [])
    .filter(e => e && typeof e === 'object')
    .filter(e => e.isBoss);

  const handleSaveData = (itemFromEditor: Enemy | null) => {
    if (!itemFromEditor) {
        setEditingBoss(null);
        return;
    }

    const safeEnemies = enemies || [];
    const itemExists = itemFromEditor.id ? safeEnemies.some(d => d.id === itemFromEditor.id) : false;
    let updatedData;

    if (itemExists) {
        updatedData = safeEnemies.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
    } else {
        updatedData = [...safeEnemies, { ...itemFromEditor, id: itemFromEditor.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }), isBoss: true }];
    }
    onGameDataUpdate('enemies', updatedData);
    setEditingBoss(null);
  };

  const handleDeleteData = (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć tego Bossa?')) {
        const updatedData = (enemies || []).filter(item => item.id !== id);
        onGameDataUpdate('enemies', updatedData);
    }
  };

  const renderText = (text: any, fallback = '') => {
      if (typeof text === 'string') return text;
      if (typeof text === 'object' && text !== null) return '[Invalid Object]';
      return fallback;
  };

  const getImageUrl = (url: string | undefined): string | undefined => {
      if (!url) return undefined;
      if (url.startsWith('http') || url.startsWith('/api/uploads/')) return url;
      const uploadsIndex = url.indexOf('uploads/');
      if (uploadsIndex > -1) {
          return `/api/${url.substring(uploadsIndex)}`;
      }
      return url;
  }

  return (
    <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-amber-400">Zarządzanie Bossami</h3>
            <button onClick={() => setEditingBoss({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">Dodaj Bossa</button>
        </div>
        {editingBoss ? (
            <BossEditor boss={editingBoss} onSave={handleSaveData} onCancel={() => setEditingBoss(null)} isEditing={!!editingBoss.id} allItemTemplates={itemTemplates} />
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bosses.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">Brak zdefiniowanych bossów.</p>}
                {bosses.map(boss => (
                     <div key={boss.id} className="bg-slate-800/50 p-4 rounded-lg border border-amber-900/30 hover:border-amber-600/50 transition-colors flex flex-col">
                        <div className="flex gap-4 mb-3">
                             {boss.image ? (
                                 <img src={getImageUrl(boss.image)} alt={renderText(boss.name)} className="w-16 h-16 object-cover rounded-lg border border-slate-600" />
                             ) : (
                                 <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-xs text-gray-500">Brak foto</div>
                             )}
                             <div>
                                 <p className="font-bold text-lg text-white">{renderText(boss.name, 'Bez nazwy')}</p>
                                 <p className="text-xs text-gray-400">HP: {boss.stats?.maxHealth || 0} | DMG: {boss.stats?.minDamage || 0}-{boss.stats?.maxDamage || 0}</p>
                             </div>
                        </div>
                        <p className="text-sm text-gray-400 italic mb-4 flex-grow line-clamp-2">{renderText(boss.description, 'Brak opisu')}</p>
                        <div className="flex justify-end space-x-2 mt-auto">
                            <button onClick={() => setEditingBoss(boss)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                            <button onClick={() => handleDeleteData(boss.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};