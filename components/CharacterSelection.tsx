
import React from 'react';
import { PublicCharacterProfile, Race } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

interface CharacterSelectionProps {
    characters: PublicCharacterProfile[];
    onSelect: (characterId: number) => void;
    onCreateNew: () => void;
    onLogout: () => void;
}

export const CharacterSelection: React.FC<CharacterSelectionProps> = ({ characters, onSelect, onCreateNew, onLogout }) => {
    const { t } = useTranslation();
    
    // Max 3 slots
    const slots = [0, 1, 2];

    return (
        <div className="min-h-screen flex flex-col items-center justify-center font-sans p-4 bg-gray-900 relative">
            <div className="absolute top-4 right-4">
                 <button 
                    onClick={onLogout} 
                    className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-white font-semibold shadow-lg transition-colors"
                >
                    {t('sidebar.logout')}
                </button>
            </div>

            <h2 className="text-4xl font-bold text-white mb-8 text-center tracking-wider drop-shadow-lg">Wybierz Bohatera</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                {slots.map(index => {
                    const char = characters[index];
                    // We need the ID, but PublicCharacterProfile typically doesn't expose it unless extended.
                    // Assuming api returns it and we cast it properly in parent or extend type locally.
                    // For this component, let's assume `char` has an `id` property injected by the API call wrapper.
                    const charWithId = char as (PublicCharacterProfile & { id: number });

                    if (charWithId) {
                        return (
                            <div 
                                key={charWithId.id} 
                                className="bg-slate-800/80 border-2 border-slate-600 rounded-xl p-6 flex flex-col items-center justify-between h-96 transition-transform hover:scale-105 hover:border-indigo-500 shadow-2xl cursor-pointer group"
                                onClick={() => onSelect(charWithId.id)}
                            >
                                <div className="flex flex-col items-center w-full">
                                    <div className="w-32 h-32 rounded-full border-4 border-slate-500 overflow-hidden bg-slate-900 mb-4 shadow-inner group-hover:border-indigo-400 transition-colors">
                                        {char.avatarUrl ? (
                                            <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-5xl text-gray-600 font-bold">
                                                {char.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-1">{char.name}</h3>
                                    <p className="text-indigo-300 font-medium text-lg">Lvl {char.level}</p>
                                    <div className="w-full border-t border-slate-600/50 my-3"></div>
                                    <p className="text-gray-300">{t(`race.${char.race}`)}</p>
                                    <p className="text-gray-400 text-sm">{char.characterClass ? t(`class.${char.characterClass}`) : 'Nowicjusz'}</p>
                                </div>
                                <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-white mt-4 shadow-lg transition-colors">
                                    Graj
                                </button>
                            </div>
                        );
                    } else {
                        return (
                            <div 
                                key={`empty-${index}`} 
                                className="bg-slate-900/50 border-2 border-slate-700 border-dashed rounded-xl p-6 flex flex-col items-center justify-center h-96 hover:bg-slate-800/50 hover:border-slate-500 transition-colors cursor-pointer group"
                                onClick={onCreateNew}
                            >
                                <div className="w-20 h-20 rounded-full border-2 border-slate-600 flex items-center justify-center mb-4 group-hover:border-gray-400 group-hover:scale-110 transition-all">
                                    <span className="text-4xl text-slate-500 group-hover:text-gray-300">+</span>
                                </div>
                                <p className="text-gray-400 font-semibold text-lg group-hover:text-white">Stwórz Nową Postać</p>
                            </div>
                        );
                    }
                })}
            </div>
        </div>
    );
};
