
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { useCharacter } from '@/contexts/CharacterContext';
import { AttributePanel } from './stats/AttributePanel';
import { ProgressionPanel } from './stats/ProgressionPanel';
import { KnowledgePanel } from './stats/KnowledgePanel';
import { SkillsPanel } from './stats/SkillsPanel';
import { SparklesIcon } from './icons/SparklesIcon';

type StatTab = 'stats' | 'progression' | 'skills' | 'knowledge';

export const Statistics: React.FC = () => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<StatTab>('stats');

    if (!character || !baseCharacter || !gameData) return null;

    const experiencePercentage = (character.experience / character.experienceToNextLevel) * 100;

    return (
        <ContentPanel title={t('statistics.title')}>
            <div className="flex border-b border-white/5 mb-8 overflow-x-auto gap-4">
                {[
                    { id: 'stats', label: t('statistics.tabs.stats') },
                    { id: 'progression', label: t('statistics.tabs.developmentPath') },
                    { id: 'skills', label: t('statistics.tabs.skills') },
                    { id: 'knowledge', label: t('statistics.tabs.knowledge') }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as StatTab)} 
                        className={`
                            px-6 py-4 text-xs font-black transition-all whitespace-nowrap uppercase tracking-widest fantasy-header
                            ${activeTab === tab.id ? 'text-fantasy-amber border-b-2 border-fantasy-amber bg-white/5' : 'text-gray-500 hover:text-gray-300'}
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Experience Card */}
            <div className="mb-8 bg-[#1a2133]/60 p-6 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-sky-500 group-hover:h-1/2 transition-all"></div>
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Poziom Bohatera</span>
                        <span className="font-medieval text-4xl text-white tracking-tighter">Level {character.level}</span>
                    </div>
                    <div className="text-right">
                        <span className="font-mono text-sm font-bold text-sky-400">
                            {character.experience.toLocaleString()} <span className="text-gray-600">/</span> {character.experienceToNextLevel.toLocaleString()} XP
                        </span>
                    </div>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-white/5 p-[1px]">
                    <div 
                        className="bg-gradient-to-r from-sky-900 to-sky-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(56,189,248,0.5)]" 
                        style={{ width: `${experiencePercentage}%` }}
                    />
                </div>
                <div className="mt-3 flex justify-between items-center">
                     <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{Math.floor(experiencePercentage)}% Postępu do awansu</span>
                     <SparklesIcon className="h-4 w-4 text-sky-500/50 animate-pulse" />
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
