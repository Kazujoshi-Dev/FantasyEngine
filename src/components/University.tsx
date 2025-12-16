

import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { Skill, SkillCategory, SkillCost, SkillRequirements, SkillType, CharacterStats, EssenceType } from '../types';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';

type MainTab = 'universal' | 'racial';
type UniversalSubTab = 'passive' | 'active';
type RacialSubTab = 'races' | 'classes';

export const University: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [mainTab, setMainTab] = useState<MainTab>('universal');
    const [universalSubTab, setUniversalSubTab] = useState<UniversalSubTab>('passive');
    const [racialSubTab, setRacialSubTab] = useState<RacialSubTab>('races');

    if (!character || !gameData) return null;

    const skills = gameData.skills || [];

    // Define the display order for requirements
    const statOrder: (keyof SkillRequirements)[] = ['level', 'strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];

    const handleLearnSkill = async (skillId: string) => {
        try {
            const updatedChar = await api.learnSkill(skillId);
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const renderSkill = (skill: Skill) => {
        const isLearned = (character.learnedSkills || []).includes(skill.id);
        
        // Check requirements
        const reqsMet = Object.entries(skill.requirements).every(([req, val]) => {
            const playerVal = req === 'level' 
                ? character.level 
                : (character.stats[req as keyof CharacterStats] || 0);
            return playerVal >= val!;
        });

        const costMet = (Object.entries(skill.cost)).every(([key, costValue]) => {
            if (costValue === undefined) return true;
            const resourceKey = key as keyof SkillCost;
            // resourceKey maps to CharacterResources keys directly (gold, commonEssence, etc)
            // CharacterResources has 'gold' and EssenceType values.
            return (character.resources[resourceKey as keyof typeof character.resources] || 0) >= costValue;
        });

        const canBuy = !isLearned && reqsMet && costMet;

        return (
            <div key={skill.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col">
                <h4 className="text-xl font-bold text-amber-400 mb-2">{skill.name}</h4>
                <p className="text-sm text-gray-300 flex-grow mb-4">{skill.description}</p>
                <div className="text-xs space-y-2 mb-4">
                    <div>
                        <p className="font-semibold text-gray-400 uppercase tracking-wider">Wymagania</p>
                        {statOrder.map(req => {
                            const val = skill.requirements[req];
                            if (val === undefined) return null;

                            const playerVal = req === 'level' 
                                ? character.level 
                                : (character.stats[req as keyof CharacterStats] || 0);
                            
                            const isMet = playerVal >= val;

                            return (
                                <p key={req} className={`flex justify-between ${isMet ? 'text-green-400' : 'text-red-400'}`}>
                                    <span>{t(`statistics.${req}` as any)}: {val}</span>
                                    <span>(Masz: {playerVal})</span>
                                </p>
                            );
                        })}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-400 uppercase tracking-wider">Koszt</p>
                        {(Object.entries(skill.cost)).map(([key, val]) => {
                            if (!val) return null;
                            const resourceKey = key as keyof SkillCost;
                            const hasEnough = (character.resources[resourceKey as keyof typeof character.resources] || 0) >= val;
                            return (
                                <p key={resourceKey} className={`flex justify-between ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                                    <span>{t(`resources.${resourceKey as any}`)}: {val}</span>
                                    <span>(Masz: {character.resources[resourceKey as keyof typeof character.resources] || 0})</span>
                                </p>
                            );
                        })}
                    </div>
                </div>

                <button 
                    onClick={() => handleLearnSkill(skill.id)}
                    disabled={!canBuy}
                    className="mt-auto w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    {isLearned ? "Nauczono" : "Naucz się"}
                </button>
            </div>
        );
    };

    const renderContent = () => {
        if (mainTab === 'universal') {
            if (universalSubTab === 'passive') {
                const passiveSkills = skills.filter(s => s.type === SkillType.Universal && s.category === SkillCategory.Passive);
                // Also include class skills in passive list for now to ensure visibility as discussed
                const classPassiveSkills = skills.filter(s => s.type === SkillType.Class && s.category === SkillCategory.Passive);
                const combined = [...passiveSkills, ...classPassiveSkills];
                
                if (combined.length === 0) return <p className="text-gray-500">{t('university.underConstruction')}</p>;
                return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{combined.map(renderSkill)}</div>;
            }
            if (universalSubTab === 'active') {
                 const activeSkills = skills.filter(s => s.type === SkillType.Universal && s.category === SkillCategory.Active);
                 const classActiveSkills = skills.filter(s => s.type === SkillType.Class && s.category === SkillCategory.Active);
                 const combined = [...activeSkills, ...classActiveSkills];

                 if (combined.length === 0) return <p className="text-gray-500">{t('university.underConstruction')}</p>;
                 return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{combined.map(renderSkill)}</div>;
            }
        }
        return <p className="text-gray-500">{t('university.underConstruction')}</p>;
    };

    return (
        <ContentPanel title={t('university.title')}>
            <div className="flex border-b border-slate-700 mb-6">
                <button
                    onClick={() => setMainTab('universal')}
                    className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${mainTab === 'universal' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    {t('university.universal')}
                </button>
                <button
                    onClick={() => setMainTab('racial')}
                    className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${mainTab === 'racial' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    {t('university.racial')}
                </button>
            </div>

            <div className="h-[72vh] overflow-y-auto pr-2">
                <div className="bg-slate-900/40 p-6 rounded-xl mb-6">
                    <p className="text-gray-400 italic whitespace-pre-line text-center">{t('university.description')}</p>
                </div>

                {mainTab === 'universal' && (
                    <div className="flex border-b border-slate-800 mb-6">
                        <button
                            onClick={() => setUniversalSubTab('passive')}
                            className={`px-4 py-2 text-xs font-medium ${universalSubTab === 'passive' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('university.passive')}
                        </button>
                        <button
                            onClick={() => setUniversalSubTab('active')}
                            className={`px-4 py-2 text-xs font-medium ${universalSubTab === 'active' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('university.active')}
                        </button>
                    </div>
                )}

                {mainTab === 'racial' && (
                    <div className="flex border-b border-slate-800 mb-6">
                        <button
                            onClick={() => setRacialSubTab('races')}
                            className={`px-4 py-2 text-xs font-medium ${racialSubTab === 'races' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('university.races')}
                        </button>
                        <button
                            onClick={() => setRacialSubTab('classes')}
                            className={`px-4 py-2 text-xs font-medium ${racialSubTab === 'classes' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {t('university.classes')}
                        </button>
                    </div>
                )}
                
                <div className="bg-slate-900/40 p-6 rounded-xl">
                    {renderContent()}
                </div>
            </div>
        </ContentPanel>
    );
};
