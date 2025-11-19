
import React, { useState } from 'react';
import { GameData, Quest } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { QuestEditor } from '../editors/QuestEditor';

interface QuestsTabProps {
  gameData: GameData;
  onGameDataUpdate: (key: 'quests', data: Quest[]) => void;
}

export const QuestsTab: React.FC<QuestsTabProps> = ({ gameData, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingQuest, setEditingQuest] = useState<Partial<Quest> | null>(null);

  const handleSaveData = (itemFromEditor: Quest | null) => {
    if (!itemFromEditor) {
        setEditingQuest(null);
        return;
    }

    // Safeguard: gameData.quests might be undefined initially in unsafe contexts
    const safeQuests = gameData.quests || [];

    const itemExists = itemFromEditor.id ? safeQuests.some(d => d.id === itemFromEditor.id) : false;
    let updatedData;

    if (itemExists) {
        updatedData = safeQuests.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
    } else {
        updatedData = [...safeQuests, { ...itemFromEditor, id: itemFromEditor.id || crypto.randomUUID() }];
    }
    onGameDataUpdate('quests', updatedData);
    setEditingQuest(null);
  };

  const handleDeleteData = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
        const updatedData = (gameData.quests || []).filter(item => item.id !== id);
        onGameDataUpdate('quests', updatedData);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-indigo-400">{t('admin.quest.manage')}</h3>
          <button onClick={() => setEditingQuest({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.quest.add')}</button>
      </div>
      {editingQuest ? (
          <QuestEditor quest={editingQuest} onSave={handleSaveData} onCancel={() => setEditingQuest(null)} isEditing={!!editingQuest.id} gameData={gameData} />
      ) : (
          <div className="space-y-2">
              {(gameData.quests || []).map(quest => (
                   <div key={quest.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                      <div><p className="font-semibold">{quest.name}</p></div>
                      <div className="space-x-2">
                          <button onClick={() => setEditingQuest(quest)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                          <button onClick={() => handleDeleteData(quest.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
