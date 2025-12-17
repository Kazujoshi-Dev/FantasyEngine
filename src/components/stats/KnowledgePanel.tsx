
import React, { useState } from 'react';
import { MagicAttackType, Race, CharacterClass } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';

export const KnowledgePanel: React.FC = () => {
    const { t } = useTranslation();
    const [subTab, setSubTab] = useState<'magic' | 'races' | 'classes'>('magic');

    return (
        <div className="animate-fade-in">
            <div className="flex gap-4 mb-6 border-b border-slate-700">
                <button onClick={() => setSubTab('magic')} className={`pb-2 px-2 text-sm font-bold ${subTab === 'magic' ? 'border-b-2 border-purple-500 text-white' : 'text-gray-500'}`}>Magia</button>
                <button onClick={() => setSubTab('races')} className={`pb-2 px-2 text-sm font-bold ${subTab === 'races' ? 'border-b-2 border-purple-500 text-white' : 'text-gray-500'}`}>Rasy</button>
                <button onClick={() => setSubTab('classes')} className={`pb-2 px-2 text-sm font-bold ${subTab === 'classes' ? 'border-b-2 border-purple-500 text-white' : 'text-gray-500'}`}>Klasy</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subTab === 'magic' && Object.values(MagicAttackType).map(type => (
                    <div key={type} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                        <h4 className="font-bold text-purple-400 mb-1">{t(`item.magic.${type}`)}</h4>
                        <p className="text-xs text-gray-400">{t(`item.magicDescriptions.${type}`)}</p>
                    </div>
                ))}
                {subTab === 'races' && Object.values(Race).map(r => (
                    <div key={r} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                        <h4 className="font-bold text-amber-400 mb-1">{t(`race.${r}`)}</h4>
                        <p className="text-xs text-gray-400">{t(`raceBonuses.${r}`)}</p>
                    </div>
                ))}
                {subTab === 'classes' && Object.values(CharacterClass).map(c => (
                    <div key={c} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                        <h4 className="font-bold text-indigo-400 mb-1">{t(`class.${c}`)}</h4>
                        <p className="text-xs text-gray-400">{t(`class.${c}Description`)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
