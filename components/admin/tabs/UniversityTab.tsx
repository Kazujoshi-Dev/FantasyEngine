

import React, { useState } from 'react';
import { GameData, Skill } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { SkillEditor } from '../editors/SkillEditor';

interface UniversityTabProps {
  skills: Skill[];
  onGameDataUpdate: (key: string, data: any) => void;
}

export const UniversityTab: React.FC<UniversityTabProps> = ({ skills, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingSkill, setEditingSkill] = useState<Partial<Skill> | null>(null);

  // Safely filter skills
  const safeSkills = (skills || []).filter(s => s && typeof s === 'object');

  const handleSaveData = (itemFromEditor: Skill | null) => {
    if (!itemFromEditor) {
        setEditingSkill(null);
        return;
    }

    const itemExists = itemFromEditor.id ? safeSkills.some(d => d.id === itemFromEditor.id) : false;
    let updatedData;

    if (itemExists) {
        updatedData = safeSkills.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
    } else {
        updatedData = [...safeSkills, { ...itemFromEditor, id: itemFromEditor.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }) }];
    }
    onGameDataUpdate('skills', updatedData);
    setEditingSkill(null);
  };

  const handleDeleteData = (id: string) => {
    if (window.confirm('Are you sure you want to delete this skill?')) {
        const updatedData = safeSkills.filter(item => item.id !== id);
        onGameDataUpdate('skills', updatedData);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-indigo-400">Zarządzaj Umiejętnościami</h3>
          <button onClick={() => setEditingSkill({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">Dodaj Umiejętność</button>
      </div>
      {editingSkill ? (
          <SkillEditor skill={editingSkill} onSave={handleSaveData} onCancel={() => setEditingSkill(null)} isEditing={!!editingSkill.id} />
      ) : (
          <div className="space-y-2">
              {safeSkills.map(skill => (
                   <div key={skill.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                      <div><p className="font-semibold">{skill.name || 'Bez nazwy'}</p></div>
                      <div className="space-x-2">
                          <button onClick={() => setEditingSkill(skill)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                          <button onClick={() => handleDeleteData(skill.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};