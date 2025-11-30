import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';
import { AdminCharacterInfo, PlayerCharacter, GameData, ItemInstance } from '../../../types';
import { ItemListItem } from '../../shared/ItemSlot';

interface CharacterInspectorModalProps {
  characterInfo: AdminCharacterInfo;
  gameData: GameData;
  onClose: () => void;
  onHealCharacter: (userId: number) => void;
  onRegenerateCharacterEnergy: (userId: number) => Promise<void>;
  onResetCharacterStats: (userId: number) => void;
  onDeleteCharacter: (userId: number) => void;
  onChangeUserPassword: (userId: number, newPassword: string) => Promise<void>;
  onInspectCharacter: (userId: number) => Promise<PlayerCharacter>;
  onDeleteCharacterItem: (userId: number, itemUniqueId: string) => Promise<PlayerCharacter>;
  onUpdateCharacterGold: (userId: number, gold: number) => Promise<void>;
}

export const CharacterInspectorModal: React.FC<CharacterInspectorModalProps> = (props) => {
  const { t } = useTranslation();
  const [fullCharacter, setFullCharacter] = useState<PlayerCharacter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [goldAmount, setGoldAmount] = useState<string>(String(props.characterInfo.gold || 0));


  const fetchCharacter = useCallback(async () => {
    setIsLoading(true);
    try {
      const charData = await props.onInspectCharacter(props.characterInfo.user_id);
      setFullCharacter(charData);
      setGoldAmount(String(charData.resources.gold || 0));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [props.onInspectCharacter, props.characterInfo.user_id]);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  const handleAction = async (action: (userId: number) => void | Promise<void>) => {
    if(window.confirm('Czy na pewno chcesz wykonać tę akcję?')) {
        await action(props.characterInfo.user_id);
        alert('Akcja wykonana pomyślnie.');
        fetchCharacter(); // Refresh data
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      alert('Hasło nie może być puste.');
      return;
    }
    if (window.confirm('Czy na pewno chcesz zmienić hasło dla tego użytkownika?')) {
      await props.onChangeUserPassword(props.characterInfo.user_id, newPassword);
      alert('Hasło zostało zmienione.');
      setNewPassword('');
    }
  };

  const handleUpdateGold = async () => {
      const gold = parseInt(goldAmount, 10);
      if (isNaN(gold)) {
          alert('Nieprawidłowa ilość złota.');
          return;
      }
      if (window.confirm(`Ustawić złoto dla ${props.characterInfo.name} na ${gold}?`)) {
          await props.onUpdateCharacterGold(props.characterInfo.user_id, gold);
          alert('Złoto zaktualizowane.');
          fetchCharacter();
      }
  };
  
  const handleDeleteItem = async (item: ItemInstance) => {
      if(window.confirm(t('admin.characterInspector.deleteItemConfirm'))) {
          try {
              const updatedChar = await props.onDeleteCharacterItem(props.characterInfo.user_id, item.uniqueId);
              setFullCharacter(updatedChar);
          } catch(err) {
              // The error alert is already shown in the App.tsx handler
          }
      }
  };

  const renderItemList = (title: string, items: (ItemInstance | null)[]) => (
    <div>
      <h4 className="font-semibold text-gray-300 mb-2">{title}</h4>
      <div className="space-y-1 max-h-60 overflow-y-auto bg-slate-800/50 p-2 rounded-md">
        {items.filter((i): i is ItemInstance => i !== null).map(item => {
          const template = props.gameData.itemTemplates.find(t => t.id === item.templateId);
          if (!template) return null;
          return (
            <div key={item.uniqueId} className="flex items-center gap-2">
              <div className="flex-grow">
                <ItemListItem item={item} template={template} affixes={props.gameData.affixes} isSelected={false} onClick={() => {}} />
              </div>
              <button onClick={() => handleDeleteItem(item)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">X</button>
            </div>
          );
        })}
         {items.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Brak przedmiotów</p>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={props.onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-indigo-400">{t('admin.characterInspector.title', { characterName: props.characterInfo.name })}</h2>
        
        {isLoading ? <p>Ładowanie...</p> : fullCharacter ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Actions & Account */}
            <div className="space-y-6">
              <div className="bg-slate-900/40 p-4 rounded-xl">
                <h3 className="font-bold text-lg mb-3 text-gray-200">Akcje na Postaci</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleAction(props.onHealCharacter)} className="px-3 py-2 text-sm rounded bg-green-700 hover:bg-green-600">Ulecz</button>
                  <button onClick={() => handleAction(props.onRegenerateCharacterEnergy)} className="px-3 py-2 text-sm rounded bg-sky-700 hover:bg-sky-600">Zregeneruj Energię</button>
                  <button onClick={() => handleAction(props.onResetCharacterStats)} className="px-3 py-2 text-sm rounded bg-amber-700 hover:bg-amber-600">Resetuj Statystyki</button>
                  <button onClick={() => handleAction(props.onDeleteCharacter)} className="px-3 py-2 text-sm rounded bg-red-800 hover:bg-red-700">Usuń Postać</button>
                </div>
              </div>

               <div className="bg-slate-900/40 p-4 rounded-xl">
                <h3 className="font-bold text-lg mb-3 text-gray-200">Zarządzanie Złotem</h3>
                <div className="flex gap-2">
                  <input type="number" value={goldAmount} onChange={e => setGoldAmount(e.target.value)} className="flex-grow bg-slate-700 p-2 rounded-md" />
                  <button onClick={handleUpdateGold} className="px-4 py-2 text-sm rounded bg-green-700 hover:bg-green-600">Ustaw Złoto</button>
                </div>
              </div>

              <div className="bg-slate-900/40 p-4 rounded-xl">
                <h3 className="font-bold text-lg mb-3 text-gray-200">Zarządzanie Kontem</h3>
                <div className="flex gap-2">
                  <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nowe hasło..." className="flex-grow bg-slate-700 p-2 rounded-md" />
                  <button onClick={handleChangePassword} disabled={!newPassword} className="px-4 py-2 text-sm rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600">Zmień Hasło</button>
                </div>
              </div>
            </div>

            {/* Right Column: Items */}
            <div className="bg-slate-900/40 p-4 rounded-xl space-y-4">
               {renderItemList(t('admin.characterInspector.equipment'), Object.values(fullCharacter.equipment))}
               {renderItemList(t('admin.characterInspector.inventory'), fullCharacter.inventory)}
            </div>
          </div>
        ) : <p>Nie można załadować danych postaci.</p>}
        
        <div className="text-right mt-6">
          <button onClick={props.onClose} className="px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 font-semibold">Zamknij</button>
        </div>
      </div>
    </div>
  );
};