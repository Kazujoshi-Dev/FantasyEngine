
import React, { useState } from 'react';
import { GameSettings } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';

interface HuntingTabProps {
  settings: GameSettings;
  onSettingsUpdate: (settings: GameSettings) => void;
}

export const HuntingTab: React.FC<HuntingTabProps> = ({ settings: initialSettings, onSettingsUpdate }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [isReseting, setIsReseting] = useState(false);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'huntingDurationMinutes') {
        setSettings(prev => ({ ...prev, huntingDurationMinutes: parseInt(value, 10) || 5 }));
    }
  };

  const handleSaveSettings = () => {
    onSettingsUpdate(settings);
  };

  const handleResetAllHunts = async () => {
    if (window.confirm('Czy na pewno chcesz anulować WSZYSTKIE aktywne polowania? Ta operacja usunie wszystkie grupy.')) {
        setIsReseting(true);
        try {
            await api.resetHuntingParties();
            alert('Pomyślnie zresetowano polowania.');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsReseting(false);
        }
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-indigo-400 mb-4">Zarządzanie Polowaniami</h3>
          <div className="max-w-md space-y-4">
               <div>
                  <label htmlFor="huntingDurationMinutes" className="block text-sm font-medium text-gray-300 mb-1">Czas trwania polowania (minuty)</label>
                  <input type="number" id="huntingDurationMinutes" name="huntingDurationMinutes" value={settings.huntingDurationMinutes || 5} onChange={handleSettingsChange} className="w-full bg-slate-700 p-2 rounded-md" />
                  <p className="text-xs text-gray-500 mt-1">Czas od momentu zebrania pełnej grupy do zakończenia walki.</p>
              </div>
               <button onClick={handleSaveSettings} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
          </div>
        </div>
        
        <div className="border-t border-slate-700/50 pt-6">
          <h3 className="text-xl font-bold text-red-500 mb-4">Strefa Niebezpieczna</h3>
          <button onClick={handleResetAllHunts} disabled={isReseting} className="px-4 py-2 rounded-md bg-red-800 hover:bg-red-700 text-white font-semibold disabled:bg-slate-600">
              {isReseting ? 'Resetowanie...' : 'Anuluj/Zresetuj wszystkie polowania'}
          </button>
           <p className="text-xs text-gray-500 mt-2">Użyj tego przycisku, jeśli polowania się zawiesiły lub chcesz wyczyścić wszystkie grupy.</p>
        </div>
    </div>
  );
};
