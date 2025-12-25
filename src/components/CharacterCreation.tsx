
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { Race, CharacterClass, Gender } from '../types';
import { ShieldIcon } from './icons/ShieldIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { SwordsIcon } from './icons/SwordsIcon';

interface CharacterCreationProps {
    onCharacterCreate: (data: { name: string; race: Race; gender: Gender }) => void;
}

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreate }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [race, setRace] = useState<Race>(Race.Human);
    const [gender, setGender] = useState<Gender>(Gender.Male);
    const [isCreating, setIsCreating] = useState(false);

    // Mapowanie klas dla rasy (spójne z ProgressionPanel)
    const classOptions: Record<Race, CharacterClass[]> = {
        [Race.Human]: [CharacterClass.Mage, CharacterClass.Warrior, CharacterClass.Rogue],
        [Race.Elf]: [CharacterClass.Wizard, CharacterClass.Hunter, CharacterClass.Druid],
        [Race.Orc]: [CharacterClass.Shaman, CharacterClass.Warrior, CharacterClass.Berserker],
        [Race.Dwarf]: [CharacterClass.Warrior, CharacterClass.Blacksmith, CharacterClass.DungeonHunter],
        [Race.Gnome]: [CharacterClass.Thief, CharacterClass.Engineer, CharacterClass.Warrior],
    };

    const availableClasses = useMemo(() => classOptions[race], [race]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || name.length < 3) return;
        setIsCreating(true);
        onCharacterCreate({ name: name.trim(), race, gender });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 lg:p-8" 
             style={{ backgroundImage: "url('login_background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
            
            <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row gap-8 animate-fade-in">
                
                {/* Lewa kolumna: Formularz i Wybór Rasy */}
                <div className="flex-1 bg-slate-900/90 border border-slate-700/50 rounded-3xl shadow-2xl p-6 lg:p-10 flex flex-col">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-indigo-600/20 rounded-2xl border border-indigo-500/50">
                            <ShieldIcon className="h-8 w-8 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight">{t('characterCreation.title')}</h2>
                            <p className="text-slate-400 text-sm">{t('auth.joinAdventure')}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8 flex-grow">
                        {/* Imię */}
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                                {t('characterCreation.nameLabel')}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder={t('characterCreation.namePlaceholder')}
                                required
                                minLength={3}
                                maxLength={20}
                            />
                        </div>

                        {/* Wybór Płci */}
                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                                Wybierz Płeć
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setGender(Gender.Male)}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${
                                        gender === Gender.Male 
                                            ? 'bg-blue-600/20 border-blue-500 ring-4 ring-blue-500/10 text-blue-400' 
                                            : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-500'
                                    }`}
                                >
                                    <span className="font-black uppercase tracking-widest">{t('gender.Male')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGender(Gender.Female)}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${
                                        gender === Gender.Female 
                                            ? 'bg-rose-600/20 border-rose-500 ring-4 ring-rose-500/10 text-rose-400' 
                                            : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-500'
                                    }`}
                                >
                                    <span className="font-black uppercase tracking-widest">{t('gender.Female')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Wybór Rasy */}
                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">
                                {t('characterCreation.raceLabel')}
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                {Object.values(Race).map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRace(r)}
                                        className={`flex flex-col p-4 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group ${
                                            race === r 
                                                ? 'bg-indigo-600/10 border-indigo-500 ring-4 ring-indigo-500/10' 
                                                : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`font-black text-lg ${race === r ? 'text-indigo-400' : 'text-slate-200'}`}>
                                                {t(`race.${r}`)}
                                            </span>
                                            {race === r && <SparklesIcon className="h-5 w-5 text-indigo-400" />}
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-slate-400 group-hover:text-slate-300 transition-colors">
                                            {t(`raceBonuses.${r}`)}
                                        </p>
                                        {race === r && (
                                            <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/10 blur-2xl rounded-full"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isCreating || name.length < 3}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-950/40 transform transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-lg uppercase tracking-widest"
                        >
                            {isCreating ? t('characterCreation.creating') : t('characterCreation.button')}
                        </button>
                    </form>
                </div>

                {/* Prawa kolumna: Podgląd klas i informacji */}
                <div className="lg:w-96 flex flex-col gap-6">
                    {/* Karta informacyjna: Dostępne klasy */}
                    <div className="bg-slate-900/90 border border-slate-700/50 rounded-3xl shadow-2xl p-6 lg:p-8 animate-fade-in" key={race}>
                        <div className="flex items-center gap-3 mb-6">
                            <SwordsIcon className="h-6 w-6 text-amber-500" />
                            <h3 className="font-black text-white uppercase tracking-tight">
                                {t('characterCreation.availableClassesFor', { raceName: t(`race.${race}`) })}
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {availableClasses.map((cls) => (
                                <div key={cls} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/30 hover:border-amber-500/30 transition-all group">
                                    <h4 className="font-black text-amber-400 mb-1 group-hover:text-amber-300 transition-colors">
                                        {t(`class.${cls}`)}
                                    </h4>
                                    <p className="text-[11px] text-slate-400 italic leading-relaxed">
                                        {t(`class.${cls}Description`)}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                                {t('characterCreation.classSelectionNote')}
                            </p>
                        </div>
                    </div>

                    {/* Pro tip / Info */}
                    <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-3xl p-6">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                                <span className="font-black">!</span>
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white mb-1 uppercase tracking-tight">System Atrybutów</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    Każdy poziom to 2 punkty statystyk. Wybór rasy definiuje Twoje początkowe predyspozycje, ale to Ty zdecydujesz, jak ukształtować bohatera.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
