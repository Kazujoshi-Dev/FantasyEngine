import React, { useState } from 'react';
import { AdminCharacterInfo } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface UsersTabProps {
  allCharacters: AdminCharacterInfo[];
  onUpdateCharacterGold: (userId: number, gold: number) => Promise<void>;
  onHealCharacter: (userId: number) => void;
  onResetCharacterStats: (userId: number) => void;
  onDeleteCharacter: (userId: number) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({ allCharacters, onUpdateCharacterGold, onHealCharacter, onResetCharacterStats, onDeleteCharacter }) => {
  const { t } = useTranslation();
  const [goldInputs, setGoldInputs] = useState<Record<number, string>>({});

  const handleGoldInputChange = (userId: number, value: string) => {
    setGoldInputs(prev => ({ ...prev, [userId]: value }));
  };

  const handleSetGold = async (userId: number) => {
    const amountStr = goldInputs[userId];
    if (amountStr === undefined || amountStr.trim() === '') return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid, non-negative number for gold.');
        return;
    }
    try {
        await onUpdateCharacterGold(userId, amount);
        handleGoldInputChange(userId, ''); // Clear input on success
    } catch (err) {
        console.error("Failed to set gold:", err);
    }
  };

  const handleResetGold = async (userId: number) => {
    if (window.confirm('Are you sure you want to reset this character\'s gold to 0?')) {
        try {
            await onUpdateCharacterGold(userId, 0);
        } catch (err) {
            // Error is already alerted in App.tsx
        }
    }
  };
  
  return (
    <div className="animate-fade-in">
      <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.manageCharacters')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">{t('admin.owner')}</th>
              <th className="p-3">{t('admin.general.name')}</th>
              <th className="p-3">{t('statistics.level')}</th>
              <th className="p-3">{t('resources.gold')}</th>
              <th className="p-3">Zarządzaj Złotem</th>
              <th className="p-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {allCharacters.map(char => (
              <tr key={char.user_id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                <td className="p-3">{char.user_id}</td>
                <td className="p-3">{char.username}</td>
                <td className="p-3 font-semibold">{char.name}</td>
                <td className="p-3">{char.level}</td>
                <td className="p-3 font-mono">{Number(char.gold ?? 0).toLocaleString()}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={goldInputs[char.user_id] || ''}
                      onChange={(e) => handleGoldInputChange(char.user_id, e.target.value)}
                      className="w-24 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm"
                      placeholder="Ilość"
                    />
                    <button onClick={() => handleSetGold(char.user_id)} className="px-2 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">Ustaw</button>
                    <button onClick={() => handleResetGold(char.user_id)} className="px-2 py-1 text-xs rounded bg-amber-800 hover:bg-amber-700">Wyzeruj</button>
                  </div>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                      <button onClick={() => onHealCharacter(char.user_id)} className="px-2 py-1 text-xs rounded bg-green-700 hover:bg-green-600">Ulecz</button>
                      <button onClick={() => onResetCharacterStats(char.user_id)} className="px-2 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600">Resetuj Staty</button>
                      <button onClick={() => onDeleteCharacter(char.user_id)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">Usuń</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};