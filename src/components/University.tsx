
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { useCharacter } from '@/contexts/CharacterContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { CharacterClass, Skill, SkillType, SkillCategory, Race } from '@/types';
import { api } from '@/api';

export const University: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState<SkillType>(SkillType.Universal);

    if (!character || !gameData) return null;

    const skills = gameData.skills || [];
    const filteredSkills = skills.filter(s => s.type === selectedTab);

    const handleLearnSkill = async (skillId: string) => {
        try {
            const updatedChar = await api.learnSkill(skillId);
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <ContentPanel title={t('university.title')}>
            <div className="flex border-b border-slate-700 mb-6">
                {Object.values(SkillType).map(type => (
                    <button
                        key={type}
                        onClick={() => setSelectedTab(type)}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${selectedTab === type ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        {t(`university.${type.toLowerCase()}` as any)}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredSkills.map(skill => {
                    const isLearned = character.learnedSkills?.includes(skill.id);
                    const canAffordGold = (character.resources?.gold || 0) >= (skill.cost?.gold || 0);
                    
                    // Requirement Checks
                    const reqClass = skill.requirements.characterClass;
                    const reqRace = skill.requirements.race;
                    
                    // Special Class Logic for Dual Wield
                    let classMatch = !reqClass || character.characterClass === reqClass;
                    if (skill.id === 'dual-wield-mastery') {
                        const allowed = [CharacterClass.Warrior, CharacterClass.Rogue, CharacterClass.Berserker, CharacterClass.Thief];
                        classMatch = !!character.characterClass && allowed.includes(character.characterClass);
                    }

                    const raceMatch = !reqRace || character.race === reqRace;
                    const levelMatch = character.level >= (skill.requirements.level || 0);
                    
                    const canLearn = !isLearned && classMatch && raceMatch && levelMatch && canAffordGold;

                    return (
                        <div key={skill.id} className={`p-5 rounded-xl border ${isLearned ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-800/50 border-slate-700'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="text-lg font-bold text-white">{skill.name}</h4>
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${skill.category === SkillCategory.Passive ? 'bg-amber-900/30 text-amber-500 border border-amber-800' : 'bg-sky-900/30 text-sky-500 border border-sky-800'}`}>
                                        {t(`university.${skill.category.toLowerCase()}` as any)}
                                    </span>
                                </div>
                                {!isLearned && (
                                    <button
                                        onClick={() => handleLearnSkill(skill.id)}
                                        disabled={!canLearn}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded text-xs font-bold text-white shadow-lg transition-all"
                                    >
                                        Naucz się ({skill.cost?.gold}g)
                                    </button>
                                )}
                                {isLearned && <span className="text-green-500 font-bold text-xs uppercase tracking-widest">Opanowano</span>}
                            </div>
                            <p className="text-sm text-gray-400 italic mb-4">{skill.description}</p>
                            
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/50">
                                {skill.requirements.level && (
                                    <p className={`text-[10px] ${levelMatch ? 'text-gray-500' : 'text-red-500'}`}>Min. Poziom: {skill.requirements.level}</p>
                                )}
                                {reqClass && (
                                    <p className={`text-[10px] ${classMatch ? 'text-gray-500' : 'text-red-500'}`}>Klasa: {t(`class.${reqClass}` as any)}</p>
                                )}
                                {skill.id === 'dual-wield-mastery' && !character.characterClass && (
                                    <p className="text-[10px] text-red-500 col-span-2">Wymagana klasa bojowa.</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </ContentPanel>
    );
};
