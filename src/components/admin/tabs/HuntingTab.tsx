

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