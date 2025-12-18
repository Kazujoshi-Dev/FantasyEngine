
import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { Skill, SkillCategory } from '@/types';
import { api } from '@/api';
import { SparklesIcon } from '../icons/SparklesIcon';
import { BoltIcon } from '../icons/BoltIcon';

export const SkillsPanel: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();

    if (!character || !gameData) return null;

    const learnedSkills = (gameData.skills || []).filter(s => 
        (character.learnedSkills || []).includes(s.id)
    );

    const passiveSkills = learnedSkills.filter(s => s.category === SkillCategory.Passive);
    const activeSkills = learnedSkills.filter(s => s.category === SkillCategory.Active);

    const handleToggleSkill = async (skillId: string, currentState: boolean) => {
        try {
            const updatedChar = await api.toggleSkill(skillId, !currentState);
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            {/* Umiejętności Pasywne */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2 px-2">
                    <SparklesIcon className="h-5 w-5" />
                    {t('university.passive')}
                </h3>
                <div className="space-y-3">
                    {passiveSkills.length === 0 && (
                        <p className="text-gray-500 italic px-2">Brak nauczonych umiejętności pasywnych.</p>
                    )}
                    {passiveSkills.map(skill => (
                        <div key={skill.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                            <h4 className="font-bold text-white mb-1">{skill.name}</h4>
                            <p className="text-sm text-gray-400 italic">{skill.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Umiejętności Aktywne */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-sky-400 flex items-center gap-2 px-2">
                    <BoltIcon className="h-5 w-5" />
                    {t('university.active')}
                </h3>
                <div className="space-y-3">
                    {activeSkills.length === 0 && (
                        <p className="text-gray-500 italic px-2">Brak nauczonych umiejętności aktywnych.</p>
                    )}
                    {activeSkills.map(skill => {
                        const isActive = (character.activeSkills || []).includes(skill.id);
                        return (
                            <div key={skill.id} className={`p-4 rounded-xl border transition-all duration-300 ${isActive ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-800/50 border-slate-700/50 opacity-80'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-white">{skill.name}</h4>
                                    <button
                                        onClick={() => handleToggleSkill(skill.id, isActive)}
                                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                                            isActive 
                                            ? 'bg-green-600 hover:bg-green-500 text-white' 
                                            : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
                                        }`}
                                    >
                                        {isActive ? 'WŁĄCZONA' : 'WYŁĄCZONA'}
                                    </button>
                                </div>
                                <p className="text-sm text-gray-400 italic mb-2">{skill.description}</p>
                                {skill.manaMaintenanceCost && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                        <BoltIcon className="h-3 w-3" />
                                        Koszt utrzymania: {skill.manaMaintenanceCost} Many
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {activeSkills.length > 0 && (
                    <p className="text-[10px] text-gray-500 px-2 italic">
                        * Aktywne umiejętności zużywają punkty many z Twojego limitu, dopóki są włączone.
                    </p>
                )}
            </div>
        </div>
    );
};
