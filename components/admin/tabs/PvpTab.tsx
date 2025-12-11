import React, { useState, useEffect } from 'react';
import { GameSettings } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface PvpTabProps {
  settings: GameSettings;
  onSettingsUpdate: (settings: GameSettings) => void;
  onResetAllPvpCooldowns: () => void;
}

export const PvpTab: React.FC<PvpTabProps> = ({ settings: initialSettings, onSettingsUpdate, onResetAllPvpCooldowns }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GameSettings>(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'pvpProtectionMinutes') {
        setSettings(prev => ({ ...prev, pvpProtectionMinutes: parseInt(value, 10) || 60 }));
    }
  };

  const handleSaveSettings = () => {
    onSettingsUpdate(settings);
  };

  return (
    <div className="animate-fade-in space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.pvp.title')}</h3>
          <div className="max-w-md space-y-4">
               <div>
                  <label htmlFor="pvpProtectionMinutes" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.pvp.protectionDuration')}</label>
                  <input type="number" id="pvpProtectionMinutes" name="pvpProtectionMinutes" value={settings.pvpProtectionMinutes || 60} onChange={handleSettingsChange} className="w-full bg-slate-700 p-2 rounded-md" />
                  <p className="text-xs text-gray-500 mt-1">{t('admin.pvp.protectionDurationDesc')}</p>
              </div>
               <button onClick={handleSaveSettings} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.pvp.actions')}</h3>
          <button onClick={onResetAllPvpCooldowns} className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white font-semibold">
              {t('admin.pvp.resetCooldowns')}
          </button>
        </div>
    </div>
  );
};
