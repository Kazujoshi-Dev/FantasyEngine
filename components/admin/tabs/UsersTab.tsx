
import React, { useState } from 'react';
import { AdminCharacterInfo, PlayerCharacter, GameData } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { CharacterInspectorModal } from '../editors/CharacterInspectorModal';

interface UsersTabProps {
  allCharacters: AdminCharacterInfo[];
  gameData: GameData;
  onHealCharacter: (userId: number) => void;
  onResetCharacterStats: (userId: number) => void;
  onDeleteCharacter: (userId: number) => void;
  onUpdateCharacterGold: (userId: number, gold: number) => Promise<void>;
  onRegenerateCharacterEnergy: (userId: number) => Promise<void>;
  onChangeUserPassword: (userId: number, newPassword: string) => Promise<void>;
  onInspectCharacter: (userId: number) => Promise<PlayerCharacter>;
  onDeleteCharacterItem: (userId: number, itemUniqueId: string) => Promise<PlayerCharacter>;
}

export const UsersTab: React.FC<UsersTabProps> = (props) => {
  const { t } = useTranslation();
  const [inspectingChar, setInspectingChar] = useState<AdminCharacterInfo | null>(null);

  const validCharacters = Array.isArray(props.allCharacters)
    ? props.allCharacters.filter(char => char && typeof char === 'object' && char.user_id != null)
    : [];

  return (
    <>
      {inspectingChar && (
        <CharacterInspectorModal 
          characterInfo={inspectingChar}
          gameData={props.gameData}
          onClose={() => setInspectingChar(null)}
          onHealCharacter={props.onHealCharacter}
          onRegenerateCharacterEnergy={props.onRegenerateCharacterEnergy}
          onResetCharacterStats={props.onResetCharacterStats}
          onDeleteCharacter={props.onDeleteCharacter}
          onChangeUserPassword={props.onChangeUserPassword}
          onInspectCharacter={props.onInspectCharacter}
          onDeleteCharacterItem={props.onDeleteCharacterItem}
          onUpdateCharacterGold={props.onUpdateCharacterGold}
        />
      )}
      <div className="animate-fade-in">
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.manageCharacters')}</h3>
        {validCharacters.length === 0 ? (
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
                {validCharacters.map(char => (
                  <tr key={char.user_id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="p-3">{char.user_id}</td>
                    <td className="p-3">{char.username ?? 'N/A'}</td>
                    <td className="p-3 font-semibold">{char.name ?? 'N/A'}</td>
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
