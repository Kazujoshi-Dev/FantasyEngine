import React, { useState } from 'react';
import { AdminCharacterInfo } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface UsersTabProps {
  allCharacters: AdminCharacterInfo[];
  onHealCharacter: (userId: number) => void;
  onResetCharacterStats: (userId: number) => void;
  onDeleteCharacter: (userId: number) => void;
  onUpdateCharacterGold: (userId: number, gold: number) => Promise<void>;
}

export const UsersTab: React.FC<UsersTabProps> = ({ allCharacters, onHealCharacter, onResetCharacterStats, onDeleteCharacter, onUpdateCharacterGold }) => {
  const { t } = useTranslation();
  const [goldChanges, setGoldChanges] = useState<Record<number, string>>({});

  // Filter out any invalid character entries to prevent crashes from bad data
  const validCharacters = Array.isArray(allCharacters)
    ? allCharacters.filter(char => char && typeof char === 'object' && char.user_id != null)
    : [];

  const handleGoldChange = (userId: number, value: string) => {
    setGoldChanges(prev => ({ ...prev, [userId]: value }));
  };

  const handleSaveGold = async (userId: number) => {
    const newGoldString = goldChanges[userId];
    if (newGoldString === undefined) return;

    const newGold = parseInt(newGoldString, 10);
    if (isNaN(newGold) || newGold < 0) {
      alert("Invalid gold amount.");
      return;
    }

    await onUpdateCharacterGold(userId, newGold);
    setGoldChanges(prev => {
      const newChanges = { ...prev };
      delete newChanges[userId];
      return newChanges;
    });
  };

  const handleResetStats = (userId: number, name: string) => {
    if (window.confirm(t('admin.resetStatsConfirm', { name }))) {
      onResetCharacterStats(userId);
    }
  };
  
  const handleDelete = (userId: number, name: string) => {
    if (window.confirm(t('admin.deleteCharacterConfirm', { name }))) {
      onDeleteCharacter(userId);
    }
  };
  
  const handleHeal = (userId: number, name: string) => {
      if(window.confirm(t('admin.healCharacterConfirm', { name }))) {
          onHealCharacter(userId);
      }
  }

  return (
    <div className="animate-fade-in">
      <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.manageCharacters')}</h3>
      {validCharacters.length === 0 && !allCharacters && (
        <p className="text-gray-500">{t('loading')}</p>
      )}
       {validCharacters.length === 0 && allCharacters && (
        <p className="text-gray-500">{t('admin.noCharacters')}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">{t('admin.owner')}</th>
              <th className="p-3">{t('admin.general.name')}</th>
              <th className="p-3">{t('statistics.level')}</th>
              <th className="p-3 w-48">{t('resources.gold')}</th>
              <th className="p-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {validCharacters.map(char => {
              const hasGoldChanged = goldChanges[char.user_id] !== undefined;
              const newGoldValue = parseInt(goldChanges[char.user_id], 10);
              const isGoldValid = hasGoldChanged && !isNaN(newGoldValue) && newGoldValue >= 0;

              return (
                <tr key={char.user_id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="p-3">{char.user_id}</td>
                  <td className="p-3">{char.username ?? 'N/A'}</td>
                  <td className="p-3 font-semibold">{char.name ?? 'N/A'}</td>
                  <td className="p-3">{char.level ?? 0}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={hasGoldChanged ? goldChanges[char.user_id] : (char.gold ?? 0)}
                      onChange={(e) => handleGoldChange(char.user_id, e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                        {hasGoldChanged && (
                          <button 
                            onClick={() => handleSaveGold(char.user_id)} 
                            disabled={!isGoldValid}
                            className="px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
                          >
                            {t('admin.general.save')}
                          </button>
                        )}
                        <button onClick={() => handleHeal(char.user_id, char.name)} className="px-2 py-1 text-xs rounded bg-green-700 hover:bg-green-600">{t('admin.heal')}</button>
                        <button onClick={() => handleResetStats(char.user_id, char.name)} className="px-2 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600">{t('admin.resetStats')}</button>
                        <button onClick={() => handleDelete(char.user_id, char.name)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};