
import React, { useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { Race } from '../types';
import { ShieldIcon } from './icons/ShieldIcon';

interface CharacterCreationProps {
    onCharacterCreate: (data: { name: string; race: Race }) => void;
}

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreate }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [race, setRace] = useState<Race>(Race.Human);
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        
        setIsCreating(true);
        onCharacterCreate({ name, race });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4" style={{ backgroundImage: "url('/login_background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative z-10 w-full max-w-md bg-slate-800/90 border border-slate-700 rounded-2xl shadow-2xl p-8">
                <div className="text-center mb-8">
                    <ShieldIcon className="h-16 w-16 text-indigo-500 mx-auto mb-4" />
                    <h2 className="text-3xl font-bold text-white">{t('characterCreation.title')}</h2>
                    <p className="text-gray-400 mt-2">{t('auth.joinAdventure')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('characterCreation.nameLabel')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            placeholder={t('characterCreation.namePlaceholder')}
                            required
                            minLength={3}
                            maxLength={20}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {t('characterCreation.raceLabel')}
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {Object.values(Race).map((r) => (
                                <label 
                                    key={r} 
                                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                        race === r 
                                            ? 'bg-indigo-900/50 border-indigo-500 ring-1 ring-indigo-500' 
                                            : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="race"
                                        value={r}
                                        checked={race === r}
                                        onChange={() => setRace(r)}
                                        className="sr-only"
                                    />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <span className={`font-bold ${race === r ? 'text-indigo-300' : 'text-gray-200'}`}>
                                                {t(`race.${r}`)}
                                            </span>
                                        </div>
                                        {race === r && (
                                            <p className="text-xs text-gray-400 mt-1 leading-relaxed animate-fade-in">
                                                {t(`raceBonuses.${r}`)}
                                            </p>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isCreating || !name.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-lg shadow-lg transform transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isCreating ? t('characterCreation.creating') : t('characterCreation.button')}
                    </button>
                </form>
            </div>
        </div>
    );
};
