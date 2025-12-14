
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';
import { AdminCharacterInfo, PlayerCharacter, GameData, ItemInstance, Race, CharacterClass } from '../../../types';
import { ItemListItem } from '../../shared/ItemSlot';
import { api } from '../../../api'; // Ensure api is imported directly if not passed via props fully

interface CharacterInspectorModalProps {
  characterInfo: AdminCharacterInfo;
  gameData: GameData;
  onClose: () => void;
  onHealCharacter: (userId: number) => void;
  onRegenerateCharacterEnergy: (userId: number) => Promise<void>;
  onResetCharacterStats: (userId: number) => void;
  onResetCharacterProgress: (userId: number) => Promise<void>;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [goldAmount, setGoldAmount] = useState<string>('0');

  // Edit details state
  const [editName, setEditName] = useState<string>('');
  const [editRace, setEditRace] = useState<Race>(Race.Human);
  const [editClass, setEditClass] = useState<string>('');
  const [editLevel, setEditLevel] = useState<string>('1');

  const fetchCharacter = useCallback(async (resetForm: boolean = true) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const charData = await props.onInspectCharacter(props.characterInfo.user_id);
      if (!charData) throw new Error("Puste dane postaci");
      
      setFullCharacter(charData);
      
      // Reset form fields ONLY if explicitly requested (e.g. initial load)
      // This prevents overwriting user input when refreshing data after an action
      if (resetForm) {
          // Safe access with optional chaining
          setGoldAmount(String(charData.resources?.gold || 0));
          
          // Init edit fields safely
          setEditName(charData.name || '');
          setEditRace(charData.race || Race.Human);
          setEditClass(charData.characterClass || '');
          setEditLevel(String(charData.level || 1));
      }

    } catch (err: any) {
      setLoadError(err.message || "Błąd ładowania");
    } finally {
      setIsLoading(false);
    }
  }, [props.onInspectCharacter, props.characterInfo.user_id]);

  useEffect(() => {
    // Only fetch on mount or if user ID changes.
    // We intentionally exclude fetchCharacter from deps to prevent re-fetching when parent re-renders.
    fetchCharacter(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.characterInfo.user_id]);

  const handleAction = async (action: (userId: number) => void | Promise<void>) => {
    if(window.confirm('Czy na pewno chcesz wykonać tę akcję?')) {
        await action(props.characterInfo.user_id);
        alert('Akcja wykonana pomyślnie.');
        fetchCharacter(false); // Refresh data but keep form input
    }
  };

  const handleSoftReset = async () => {
      if (window.confirm(`NAPRAWA (SOFT RESET): To przywróci postać do poziomu 1 i zresetuje statystyki do bezpiecznych wartości, ale ZACHOWA ekwipunek i złoto. Użyj tego, jeśli postać jest zbugowana.`)) {
          try {
              await api.softResetCharacter(props.characterInfo.user_id);
              alert('Postać została naprawiona.');
              fetchCharacter(true);
          } catch (e: any) {
              alert(e.message);
          }
      }
  };

  const handleResetProgress = async () => {
      if (window.confirm(`JESTEŚ PEWIEN? To zresetuje postać ${props.characterInfo.name} do poziomu 1, usunie ekwipunek i zresetuje historię. Tej akcji NIE MOŻNA cofnąć.`)) {
          if (window.confirm(`Potwierdź ostatecznie: RESET POSTĘPU dla ${props.characterInfo.name}.`)) {
              try {
                  await props.onResetCharacterProgress(props.characterInfo.user_id);
                  alert('Postęp postaci został zresetowany.');
                  fetchCharacter(true);
              } catch(e: any) {
                  alert(e.message);
              }
          }
      }
  }

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
          fetchCharacter(false);
      }
  };
  
  const handleUpdateDetails = async () => {
      if (!editName.trim()) {
          alert('Nazwa postaci nie może być pusta.');
          return;
      }
      if (window.confirm('UWAGA: Zmiana poziomu zresetuje statystyki. Zmiana nazwy, rasy lub klasy wpłynie na grę. Kontynuować?')) {
          try {
              await api.updateCharacterDetails(props.characterInfo.user_id, {
                  name: editName.trim(),
                  race: editRace,
                  characterClass: editClass || undefined,
                  level: parseInt(editLevel, 10)
              });
              alert('Dane postaci zaktualizowane.');
              fetchCharacter(true); // Reset form with new values from server
          } catch(e: any) {
              alert(e.message);
          }
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
          if (!template) return <div key={item.uniqueId} className="text-red-500 text-xs">Błąd: Brak szablonu ({item.templateId})</div>;
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

  // Defensive check for character data
  const hasData = !!fullCharacter;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={props.onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-indigo-400">{t('admin.characterInspector.title', { characterName: props.characterInfo.name })}</h2>
        
        {isLoading && <p>Ładowanie...</p>}
        
        {loadError && (
            <div className="bg-red-900/50 p-4 rounded border border-red-700 mb-4">
                <p className="font-bold text-red-300">Błąd odczytu postaci: {loadError}</p>
                <p className="text-sm text-gray-400">Postać może być uszkodzona. Spróbuj użyć "Soft Reset".</p>
                <button onClick={handleSoftReset} className="mt-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-white font-bold">Napraw (Soft Reset)</button>
            </div>
        )}

        {/* Render UI even if partial data, using fallbacks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Actions & Account */}
            <div className="space-y-6">
              
               <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold text-lg mb-3 text-gray-200">Edycja Danych</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">Nazwa Postaci</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-700 p-2 rounded text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Rasa</label>
                        <select value={editRace} onChange={e => setEditRace(e.target.value as Race)} className="w-full bg-slate-700 p-2 rounded text-sm">
                            {Object.values(Race).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Klasa</label>
                        <select value={editClass} onChange={e => setEditClass(e.target.value)} className="w-full bg-slate-700 p-2 rounded text-sm">
                            <option value="">Brak (Novice)</option>
                            {Object.values(CharacterClass).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                     <div className="col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">Poziom</label>
                        <input type="number" min="1" value={editLevel} onChange={e => setEditLevel(e.target.value)} className="w-full bg-slate-700 p-2 rounded text-sm" />
                        <p className="text-[10px] text-gray-500 mt-1">Zmiana poziomu zresetuje statystyki i ustawi odpowiednie PD.</p>
                    </div>
                </div>
                <button onClick={handleUpdateDetails} className="mt-4 w-full px-4 py-2 text-sm rounded bg-indigo-600 hover:bg-indigo-500 font-semibold">Zapisz Zmiany</button>
              </div>

              <div className="bg-slate-900/40 p-4 rounded-xl">
                <h3 className="font-bold text-lg mb-3 text-gray-200">Akcje na Postaci</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleAction(props.onHealCharacter)} className="px-3 py-2 text-sm rounded bg-green-700 hover:bg-green-600">Ulecz</button>
                  <button onClick={() => handleAction(props.onRegenerateCharacterEnergy)} className="px-3 py-2 text-sm rounded bg-sky-700 hover:bg-sky-600">Zregeneruj Energię</button>
                  <button onClick={() => handleAction(props.onResetCharacterStats)} className="px-3 py-2 text-sm rounded bg-amber-700 hover:bg-amber-600">Resetuj Statystyki</button>
                  
                  {/* NEW SOFT RESET BUTTON */}
                  <button onClick={handleSoftReset} className="px-3 py-2 text-sm rounded bg-emerald-700 hover:bg-emerald-600 font-bold text-white border border-emerald-500" title="Resetuje poziom do 1 i naprawia strukturę, ale zachowuje przedmioty.">Naprawa (Soft Reset)</button>

                  <button onClick={handleResetProgress} className="px-3 py-2 text-sm rounded bg-orange-800 hover:bg-orange-700 font-bold text-orange-100 border border-orange-600">Wyczyść wszystko (Hard)</button>
                  <button onClick={() => handleAction(props.onDeleteCharacter)} className="px-3 py-2 text-sm rounded bg-red-800 hover:bg-red-700 col-span-2 mt-2 border border-red-600">Usuń Postać</button>
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

            {/* Right Column: Items - Only render if data is present to avoid crashes */}
            <div className="bg-slate-900/40 p-4 rounded-xl space-y-4">
               {hasData ? (
                   <>
                    {renderItemList(t('admin.characterInspector.equipment'), Object.values(fullCharacter!.equipment || {}))}
                    {renderItemList(t('admin.characterInspector.inventory'), fullCharacter!.inventory || [])}
                   </>
               ) : (
                   <p className="text-gray-500 italic text-center">Brak danych przedmiotów (uszkodzona postać?)</p>
               )}
            </div>
          </div>
        
        <div className="text-right mt-6">
          <button onClick={props.onClose} className="px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 font-semibold">Zamknij</button>
        </div>
      </div>
    </div>
  );
};
