
import React, { useState } from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';

export const DataIntegrityTab: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isGoldLoading, setIsGoldLoading] = useState(false);
  const [goldResultMessage, setGoldResultMessage] = useState<string | null>(null);
  const [isValueAuditLoading, setIsValueAuditLoading] = useState(false);
  const [valueAuditMessage, setValueAuditMessage] = useState<string | null>(null);
  const [isAttributesAuditLoading, setIsAttributesAuditLoading] = useState(false);
  const [attributesAuditMessage, setAttributesAuditMessage] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);

  const handleRunAudit = async () => {
    setIsLoading(true);
    setResultMessage(null);
    try {
      const result = await api.runCharacterDataAudit();
      setResultMessage(t('admin.dataIntegrity.successMessage', { checked: result.checked, fixed: result.fixed }));
    } catch (err: any) {
      alert(`Audit failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRunGoldAudit = async () => {
    setIsGoldLoading(true);
    setGoldResultMessage(null);
    try {
      const result = await api.runGoldAudit();
      setGoldResultMessage(t('admin.dataIntegrity.goldSuccessMessage', { checked: result.checked, fixed: result.fixed }));
    } catch (err: any) {
      alert(`Gold audit failed: ${err.message}`);
    } finally {
      setIsGoldLoading(false);
    }
  };

  const handleRunValuesAudit = async () => {
    setIsValueAuditLoading(true);
    setValueAuditMessage(null);
    try {
      const result = await api.runValuesAudit();
      setValueAuditMessage(t('admin.dataIntegrity.valuesAuditSuccess', { 
        itemsChecked: result.itemsChecked, 
        itemsFixed: result.itemsFixed,
        affixesChecked: result.affixesChecked,
        affixesFixed: result.affixesFixed
      }));
    } catch (err: any) {
      alert(`Values audit failed: ${err.message}`);
    } finally {
      setIsValueAuditLoading(false);
    }
  };

  const handleRunAttributesAudit = async () => {
    setIsAttributesAuditLoading(true);
    setAttributesAuditMessage(null);
    try {
      const result = await api.runAttributesAudit();
      setAttributesAuditMessage(`Sprawdzono ${result.checked} postaci. Naprawiono (zresetowano) statystyki dla ${result.fixed} postaci.`);
    } catch (err: any) {
      alert(`Attributes audit failed: ${err.message}`);
    } finally {
      setIsAttributesAuditLoading(false);
    }
  };

  const handleWipe = async () => {
    if (window.confirm('JESTEŚ PEWIEN? Spowoduje to usunięcie WSZYSTKICH postaci, wiadomości i przedmiotów na rynku. Konta użytkowników ZOSTANĄ zachowane. Ta akcja jest NIEODWRACALNA.')) {
        setIsWiping(true);
        try {
            const result = await api.wipeGameData();
            alert(result.message);
            // Reload the page to force re-authentication and character creation
            window.location.reload();
        } catch (err: any) {
            alert(`Wipe failed: ${err.message}`);
        } finally {
            setIsWiping(false);
        }
    }
  };

  return (
    <div className="animate-fade-in">
      <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.dataIntegrity.title')}</h3>
      <p className="text-sm text-gray-400 mb-4">
        {t('admin.dataIntegrity.description')}
      </p>
      <div className="flex flex-col items-start gap-4">
        <button 
          onClick={handleRunAudit} 
          disabled={isLoading} 
          className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600"
        >
          {isLoading ? t('admin.dataIntegrity.running') : t('admin.dataIntegrity.run')}
        </button>
        {resultMessage && (
          <div className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg">
            {resultMessage}
          </div>
        )}
      </div>

       <div className="border-t border-slate-700/50 mt-6 pt-6">
          <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.dataIntegrity.goldTitle')}</h3>
          <p className="text-sm text-gray-400 mb-4">
              {t('admin.dataIntegrity.goldDescription')}
          </p>
          <div className="flex flex-col items-start gap-4">
              <button onClick={handleRunGoldAudit} disabled={isGoldLoading} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
                  {isGoldLoading ? t('admin.dataIntegrity.goldRunning') : t('admin.dataIntegrity.goldRun')}
              </button>
              {goldResultMessage && (
                  <div className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg">
                      {goldResultMessage}
                  </div>
              )}
          </div>
      </div>
       <div className="border-t border-slate-700/50 mt-6 pt-6">
          <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.dataIntegrity.valuesAuditTitle')}</h3>
          <p className="text-sm text-gray-400 mb-4">
              {t('admin.dataIntegrity.valuesAuditDescription')}
          </p>
          <div className="flex flex-col items-start gap-4">
              <button onClick={handleRunValuesAudit} disabled={isValueAuditLoading} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
                  {isValueAuditLoading ? t('admin.dataIntegrity.runningValuesAudit') : t('admin.dataIntegrity.runValuesAudit')}
              </button>
              {valueAuditMessage && (
                  <div className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg">
                      {valueAuditMessage}
                  </div>
              )}
          </div>
      </div>

      <div className="border-t border-slate-700/50 mt-6 pt-6">
          <h3 className="text-xl font-bold text-indigo-400 mb-4">Audyt i Naprawa Atrybutów</h3>
          <p className="text-sm text-gray-400 mb-4">
              Narzędzie to sprawdza, czy suma atrybutów postaci (bazowe statystyki + wolne punkty) nie przekracza dozwolonego limitu wynikającego z poziomu postaci. Jeśli wykryje nieprawidłowość (zbyt dużo punktów), <strong>zresetuje statystyki postaci do 0 i zwróci poprawną liczbę punktów do rozdania</strong>.
          </p>
          <div className="flex flex-col items-start gap-4">
              <button onClick={handleRunAttributesAudit} disabled={isAttributesAuditLoading} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
                  {isAttributesAuditLoading ? 'Sprawdzanie i naprawianie...' : 'Uruchom audyt atrybutów'}
              </button>
              {attributesAuditMessage && (
                  <div className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg">
                      {attributesAuditMessage}
                  </div>
              )}
          </div>
      </div>

      <div className="border-t border-red-700/50 mt-8 pt-6">
          <h3 className="text-2xl font-bold text-red-500 mb-4">Strefa Niebezpieczna</h3>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-red-900/50">
              <h4 className="text-lg font-semibold text-red-400">Wyczyść dane gry (Wipe)</h4>
              <p className="text-sm text-gray-400 my-2">
                  Ta operacja usunie wszystkie postacie, wiadomości, oferty na rynku i wiadomości w tawernie.
                  Konta użytkowników (loginy i hasła) zostaną zachowane. Użyj tej opcji, aby rozpocząć
                  "nowy sezon" lub zresetować serwer do stanu początkowego.
              </p>
              <p className="font-bold text-red-400">UWAGA: TEJ AKCJI NIE MOŻNA COFNĄĆ.</p>
              <button
                  onClick={handleWipe}
                  disabled={isWiping}
                  className="mt-4 px-4 py-2 rounded-md bg-red-800 hover:bg-red-700 font-semibold disabled:bg-slate-600"
              >
                  {isWiping ? 'Wyczyszczanie...' : 'Wyczyść dane gry (Wipe)'}
              </button>
          </div>
      </div>
    </div>
  );
};
