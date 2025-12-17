
import React from 'react';
import { PlayerCharacter, Race, CharacterClass } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';

export const ProgressionPanel: React.FC<{
    character: PlayerCharacter;
    updateCharacter: (c: PlayerCharacter) => void;
}> = ({ character, updateCharacter }) => {
    const { t } = useTranslation();

    const classOptions: Record<Race, CharacterClass[]> = {
        [Race.Human]: [CharacterClass.Mage, CharacterClass.Warrior, CharacterClass.Rogue],
        [Race.Elf]: [CharacterClass.Wizard, CharacterClass.Hunter, CharacterClass.Druid],
        [Race.Orc]: [CharacterClass.Shaman, CharacterClass.Warrior, CharacterClass.Berserker],
        [Race.Dwarf]: [CharacterClass.Warrior, CharacterClass.Blacksmith, CharacterClass.DungeonHunter],
        [Race.Gnome]: [CharacterClass.Thief, CharacterClass.Engineer, CharacterClass.Warrior],
    };

    const handleClassSelect = async (charClass: CharacterClass) => {
        if (!window.confirm(t('class.confirmMessage', { className: t(`class.${charClass}`) }))) return;
        try {
            const updated = await api.selectClass(charClass);
            updateCharacter(updated);
        } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-indigo-400 mb-2">{t('statistics.racialBonusTitle')}</h3>
                <p className="text-amber-400 font-bold">{t(`race.${character.race}`)}</p>
                <p className="text-gray-400 mt-2 italic">{t(`raceBonuses.${character.race}`)}</p>
            </div>

            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                {character.characterClass ? (
                    <div>
                        <h3 className="text-xl font-bold text-indigo-400 mb-2">{t('class.currentClass')}</h3>
                        <p className="text-amber-400 font-bold text-lg">{t(`class.${character.characterClass}`)}</p>
                        <p className="text-gray-400 mt-2 italic">{t(`class.${character.characterClass}Description`)}</p>
                    </div>
                ) : character.level >= 10 ? (
                    <div>
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('class.title')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {classOptions[character.race].map(cls => (
                                <div key={cls} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-white mb-1">{t(`class.${cls}`)}</h4>
                                        <p className="text-xs text-gray-400">{t(`class.${cls}Description`)}</p>
                                    </div>
                                    <button onClick={() => handleClassSelect(cls)} className="mt-4 py-2 bg-indigo-600 rounded-md font-bold hover:bg-indigo-500">Wybierz</button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500 text-center">{t('characterCreation.classSelectionNote')}</p>
                )}
            </div>
        </div>
    );
};
