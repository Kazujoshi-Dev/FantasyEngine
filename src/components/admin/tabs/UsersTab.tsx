
import React, { useState, useEffect } from 'react';
import { AdminCharacterInfo, PlayerCharacter, GameData } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { CharacterInspectorModal } from '../editors/CharacterInspectorModal';
import { api } from '../../../api';

interface UsersTabProps {
  gameData: GameData;
}

export const UsersTab: React.FC<UsersTabProps> = ({ gameData }) => {
  const { t } = useTranslation();
  const [characters, setCharacters] = useState<AdminCharacterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectingChar, setInspectingChar] = useState<AdminCharacterInfo | null>(null);

  const fetchUsers = async () => {
      setLoading(true);
      try {
          const data = await api.getAllCharacters();
          setCharacters(data);
      } catch (e) {
          console.error("Failed to fetch characters for admin", e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchUsers();
  }, []);

  const handleDeleteCharacter = async (id: number) => {
      try {
          await api.deleteCharacter(id);
          setCharacters(prev => prev.filter(c => c.user_id !== id));
          if (inspectingChar?.user_id === id) setInspectingChar(null);
      } catch (e: any) {
          alert(e.message);
      }
  };

  const renderText = (val: any) => {
      if (typeof val === 'string' || typeof val === 'number') return val;
      return 'N/A';
  };

  return (
    <>
      {inspectingChar && (
        <CharacterInspectorModal 
          characterInfo={inspectingChar}
          gameData={gameData}
          onClose={() => setInspectingChar(null)}
          onHealCharacter={api.adminHealCharacter}
          onRegenerateCharacterEnergy={api.regenerateCharacterEnergy}
          onResetCharacterStats={api.resetCharacterStats}
          onResetCharacterProgress={api.resetCharacterProgress}
          onDeleteCharacter={handleDeleteCharacter}
          onChangeUserPassword={api.changeUserPassword}
          onInspectCharacter={api.inspectCharacter}
          onDeleteCharacterItem={api.deleteCharacterItem}
          onUpdateCharacterGold={api.updateCharacterGold}
        />
      )}
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-indigo-400">{t('admin.manageCharacters')}</h3>
            <button onClick={fetchUsers} className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded">Odśwież</button>
        </div>
        
        {loading ? <p>Ładowanie...</p> : characters.length === 0 ? (
          <p className="text-gray-500">{t('admin.noCharacters')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">{t('admin.owner')}</th>
                  <th className="p-3">{t('admin.general.name')}</th>
                  <th className="p-3">{t('statistics.level')}</th>
                  <th className="p-3">{t('resources.gold')}</th>
                  <th className="p-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {characters.map(char => (
                  <tr key={char.user_id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="p-3">{char.user_id}</td>
                    <td className="p-3">{renderText(char.username)}</td>
                    <td className="p-3 font-semibold">{renderText(char.name)}</td>
                    <td className="p-3">{char.level ?? 0}</td>
                    <td className="p-3 font-mono">{(char.gold ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button 
                        onClick={() => setInspectingChar(char)}
                        className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700"
                      >
                        Zarządzaj
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
