import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Language } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

interface OptionsProps {
  character: PlayerCharacter;
  onCharacterUpdate: (character: PlayerCharacter, immediate?: boolean) => void;
}

export const Options: React.FC<OptionsProps> = ({ character, onCharacterUpdate }) => {
  const { t } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(character.settings?.language || Language.PL);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSave = () => {
    setSaveStatus('saving');
    const updatedChar: PlayerCharacter = {
      ...character,
      settings: {
        ...character.settings,
        language: selectedLang,
      },
    };
    // The onCharacterUpdate will trigger a state change in App.tsx, which in turn
    // updates the LanguageContext, causing the whole UI to re-render with the new language.
    onCharacterUpdate(updatedChar, true); 
    
    // Provide visual feedback
    setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 300);
  };

  return (
    <ContentPanel title={t('options.title')}>
      <div className="bg-slate-900/40 p-6 rounded-xl max-w-md mx-auto">
        <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('options.languageSettings')}</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="language-select" className="block text-sm font-medium text-gray-300 mb-1">{t('options.language')}</label>
            <select
              id="language-select"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as Language)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"
            >
              <option value={Language.PL}>{t('languages.pl')}</option>
              <option value={Language.EN}>{t('languages.en')}</option>
            </select>
          </div>
          <div className="flex justify-end items-center h-10">
             {saveStatus === 'saved' && <p className="text-green-400 mr-4 animate-fade-in">{t('options.saveSuccess')}</p>}
            <button
              onClick={handleSave}
              disabled={saveStatus !== 'idle' || selectedLang === (character.settings?.language || Language.PL)}
              className="px-6 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 font-bold disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
              {saveStatus === 'saving' ? t('admin.general.saving') + '...' : t('options.save')}
            </button>
          </div>
        </div>
      </div>
    </ContentPanel>
  );
};
