

import React, { useState } from 'react';
import { Race, CharacterClass } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

interface CharacterCreationProps {
  onCharacterCreate: (character: { name: string, race: Race }) => Promise<void>;
}

const races = Object.values(Race);

const RaceTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="absolute bottom-full mb-2 w-56 p-3 bg-slate-900 text-gray-300 text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-300 pointer-events-none z-10">
      <p className="font-bold text-sm text-white mb-1">Bonusy Rasowe:</p>
      <p style={{ whiteSpace: 'pre-line' }}>{text}</p>
    </div>
);


export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreate }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const raceClassMap: Record<Race, CharacterClass[]> = {
    [Race.Human]: [CharacterClass.Mage, CharacterClass.Warrior, CharacterClass.Rogue],
    [Race.Elf]: [CharacterClass.Wizard, CharacterClass.Hunter, CharacterClass.Druid],
    [Race.Orc]: [CharacterClass.Shaman, CharacterClass.Warrior, CharacterClass.Berserker],
    [Race.Dwarf]: [CharacterClass.Warrior, CharacterClass.Blacksmith, CharacterClass.DungeonHunter],
    [Race.Gnome]: [CharacterClass.Thief, CharacterClass.Engineer, CharacterClass.Warrior],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && selectedRace && !isLoading) {
      setIsLoading(true);
      try {
        await onCharacterCreate({
          name: name.trim(),
          race: selectedRace,
        });
        // On success, the component will be unmounted, so no need to reset loading state.
      } catch (error) {
        // The parent component already shows an alert.
        // We just need to re-enable the button for another attempt.
        setIsLoading(false);
      }
    }
  };
  
  const raceBonuses: Record<Race, string> = {
    [Race.Human]: t('raceBonuses.Human'),
    [Race.Elf]: t('raceBonuses.Elf'),
    [Race.Orc]: t('raceBonuses.Orc'),
    [Race.Gnome]: t('raceBonuses.Gnome'),
    [Race.Dwarf]: t('raceBonuses.Dwarf'),
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans">
      <div className="w-full max-w-5xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl p-8 lg:p-12 text-white">
        <h2 className="text-4xl font-bold text-center mb-8">{t('characterCreation.title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label htmlFor="characterName" className="block text-lg font-medium text-gray-300 mb-2">
              {t('characterCreation.nameLabel')}
            </label>
            <input
              type="text"
              id="characterName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('characterCreation.namePlaceholder')}
              className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-300 mb-4">{t('characterCreation.raceLabel')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {races.map((race) => (
                 <div key={race} className="relative flex flex-col items-center group">
                    <RaceTooltip text={raceBonuses[race]} />
                    <button
                      type="button"
                      onClick={() => !isLoading && setSelectedRace(race)}
                      disabled={isLoading}
                      className={`p-4 border-2 rounded-lg text-center font-semibold transition-all duration-200 ease-in-out transform hover:scale-105 w-full h-20 flex items-center justify-center
                        ${
                          selectedRace === race
                            ? 'bg-indigo-600 border-indigo-400 shadow-lg'
                            : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                        }
                        ${isLoading ? 'cursor-not-allowed opacity-70' : ''}
                      `}
                    >
                      {t(`race.${race}`)}
                    </button>
                 </div>
              ))}
            </div>
          </div>
           {selectedRace && (
            <div className="animate-fade-in">
                <h3 className="text-lg font-medium text-gray-300 mb-2">{t('characterCreation.availableClassesFor', { raceName: t(`race.${selectedRace}`) })}</h3>
                <p className="text-sm text-gray-400 italic mb-4">{t('characterCreation.classSelectionNote')}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {raceClassMap[selectedRace].map(charClass => (
                        <div key={charClass} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col">
                            <h4 className="text-xl font-bold text-amber-400 mb-2">{t(`class.${charClass}`)}</h4>
                            <p className="text-sm text-gray-300 flex-grow">{t(`class.${charClass}Description`)}</p>
                        </div>
                    ))}
                </div>
            </div>
          )}
          <button
            type="submit"
            disabled={!name.trim() || !selectedRace || isLoading}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg text-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 ease-in-out shadow-lg disabled:shadow-none"
          >
            {isLoading ? t('characterCreation.creating') : t('characterCreation.button')}
          </button>
        </form>
      </div>
    </div>
  );
};
