
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { useCharacter } from '@/contexts/CharacterContext';
import { AttributePanel } from './stats/AttributePanel';
import { ProgressionPanel } from './stats/ProgressionPanel';
import { KnowledgePanel } from './stats/KnowledgePanel';
import { SkillsPanel } from './stats/SkillsPanel';

type StatTab = 'stats' | 'progression' | 'skills' | 'knowledge';

export const Statistics: React.FC = () => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<StatTab>('stats');

    if (!character || !baseCharacter || !gameData) return null;

    const experiencePercentage = (character.experience / character.experienceToNextLevel) * 100;

    return (
        <ContentPanel title={t('statistics.title')}>
            <div className="flex border-b border-slate-700 mb-6 overflow-x-auto">
                <button onClick={() => setActiveTab('stats')} className={`px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'stats' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {t('statistics.tabs.stats')}
                </button>
                <button onClick={() => setActiveTab('progression')} className={`px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'progression' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {t('statistics.tabs.developmentPath')}
                </button>
                <button onClick={() => setActiveTab('skills')} className={`px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'skills' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {t('statistics.tabs.skills')}
                </button>
                <button onClick={() => setActiveTab('knowledge')} className={`px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'knowledge' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {t('statistics.tabs.knowledge')}
                </button>
            </div>

            <div className="mb-6 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-bold text-gray-400 uppercase tracking-widest">{t('statistics.level')} {character.level}</span>
                    <span className="font-mono text-sky-400">{character.experience.toLocaleString()} / {character.experienceToNextLevel.toLocaleString()} XP</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 shadow-inner">
                    <div className="bg-sky-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${experiencePercentage}%` }}></div>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {activeTab === 'stats' && <AttributePanel character={character} baseCharacter={baseCharacter} gameData={gameData} updateCharacter={updateCharacter} />}
                {activeTab === 'progression' && <ProgressionPanel character={character} updateCharacter={updateCharacter} />}
                {activeTab === 'skills' && <SkillsPanel />}
                {activeTab === 'knowledge' && <KnowledgePanel />}
            </div>
        </ContentPanel>
    );
};
