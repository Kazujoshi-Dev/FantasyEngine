
import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { Skill, SkillCategory, SkillType, CharacterStats, SkillCost } from '../types';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { ClockIcon } from './icons/ClockIcon';

const formatLearningTime = (minutes: number): string => {
    if (!minutes || minutes <= 0) return 'Natychmiast';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

const SkillCard: React.FC<{
    skill: Skill;
    character: any;
    t: any;
    onLearn: (id: string) => void;
    onComplete: () => void;
}> = ({ skill, character, t, onLearn, onComplete }) => {
    const isLearned = (character.learnedSkills || []).includes(skill.id);
    const isLearning = character.activeLearning?.skillId === skill.id;
    const isOtherSkillLearning = character.activeLearning && character.activeLearning.skillId !== skill.id;

    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (!isLearning || !character.activeLearning) return;

        const updateTimer = () => {
            const now = api.getServerTime();
            const diff = Math.max(0, Math.floor((character.activeLearning.finishTime - now) / 1000));
            setTimeLeft(diff);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [isLearning, character.activeLearning]);

    // Check Stats Requirements
    const statOrder: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
    const statsReqsMet = statOrder.every((req) => {
        const val = (skill.requirements as any)[req];
        if (val === undefined) return true;
        const playerVal = (character.stats[req] || 0);
        return playerVal >= val;
    });

    const levelMatch = character.level >= (skill.requirements.level || 0);
    const classMatch = !skill.requirements.characterClass || character.characterClass === skill.requirements.characterClass;
    const raceMatch = !skill.requirements.race || character.race === skill.requirements.race;
    const reqsMet = statsReqsMet && classMatch && raceMatch && levelMatch;

    // Check Costs
    const costMet = (Object.entries(skill.cost)).every(([key, val]) => {
        if (val === undefined) return true;
        return (character.resources[key as keyof typeof character.resources] || 0) >= (val as number);
    });

    const canBuy = !isLearned && !isLearning && !isOtherSkillLearning && reqsMet && costMet;

    const formatSeconds = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h > 0 ? h + 'h ' : ''}${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    };

    return (
        <div className={`p-5 rounded-xl border transition-all duration-300 ${isLearned ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : isLearning ? 'bg-amber-900/10 border-amber-500/50' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="text-lg font-bold text-white mb-0.5">{skill.name}</h4>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${skill.category === SkillCategory.Passive ? 'bg-amber-900/30 border-amber-700 text-amber-500' : 'bg-sky-900/30 border-sky-700 text-sky-500'}`}>
                        {skill.category === SkillCategory.Passive ? t('university.passive') : t('university.active')}
                    </span>
                </div>
                {isLearned ? (
                    <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest bg-green-900/20 px-2 py-1 rounded border border-green-800 shadow-[0_0_10px_rgba(34,197,94,0.1)]">Opanowano</span>
                ) : isLearning ? (
                    <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest bg-amber-900/20 px-2 py-1 rounded border border-amber-800 animate-pulse">W trakcie nauki</span>
                ) : null}
            </div>

            <p className="text-sm text-gray-400 italic mb-6 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">
                {skill.description}
            </p>

            <div className="space-y-4 mb-6">
                <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Wymagania</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {skill.requirements.level && (
                             <p className={`text-xs ${levelMatch ? 'text-gray-400' : 'text-red-500 font-bold'}`}>Poziom: {skill.requirements.level}</p>
                        )}
                        {skill.requirements.characterClass && (
                             <p className={`text-xs ${classMatch ? 'text-gray-400' : 'text-red-500 font-bold'}`}>Klasa: {t(`class.${skill.requirements.characterClass}`)}</p>
                        )}
                        {statOrder.map(req => {
                            const val = (skill.requirements as any)[req];
                            if (val === undefined) return null;
                            const playerVal = (character.stats[req] || 0);
                            const isMet = playerVal >= val;
                            return (
                                <p key={req} className={`text-xs ${isMet ? 'text-gray-400' : 'text-red-500 font-bold'}`}>
                                    {t(`statistics.${req}` as any)}: {val}
                                </p>
                            );
                        })}
                    </div>
                </div>

                {!isLearned && !isLearning && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Koszt</p>
                            <div className="flex flex-wrap gap-3">
                                {/* Type assertion fix: Object.entries on skill.cost */}
                                {(Object.entries(skill.cost) as [keyof SkillCost, number][]).map(([res, val]) => {
                                    if (!val) return null;
                                    const hasEnough = (character.resources[res as keyof typeof character.resources] || 0) >= (val as number);
                                    const isGold = res === 'gold';
                                    return (
                                        <div key={res} className="flex items-center gap-1">
                                            {isGold ? <CoinsIcon className="h-3 w-3 text-amber-500" /> : <StarIcon className="h-3 w-3 text-sky-400" />}
                                            <span className={`text-xs font-mono font-bold ${hasEnough ? 'text-gray-300' : 'text-red-500'}`}>{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Czas nauki</p>
                            <div className="flex items-center gap-1.5 text-indigo-300">
                                <ClockIcon className="h-3 w-3" />
                                <span className="text-xs font-bold">{formatLearningTime(skill.learningTimeMinutes || 0)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isLearning ? (
                <div className="space-y-3">
                    <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-700 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-1000" 
                            style={{ width: `${100 - (timeLeft / ((skill.learningTimeMinutes || 1) * 60)) * 100}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-amber-400 font-bold">{formatSeconds(timeLeft)}</span>
                        {timeLeft === 0 && (
                            <button 
                                onClick={onComplete}
                                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white font-bold text-[10px] uppercase tracking-widest transition-all animate-bounce"
                            >
                                ZAKOŃCZ NAUKĘ
                            </button>
                        )}
                    </div>
                </div>
            ) : !isLearned && (
                <button 
                    onClick={() => onLearn(skill.id)}
                    disabled={!canBuy}
                    className={`w-full py-2.5 rounded-lg text-white font-bold text-xs transition-all shadow-lg active:scale-95 ${canBuy ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 cursor-not-allowed opacity-50'}`}
                >
                    {isOtherSkillLearning ? 'UCZYSZ SIĘ CZEGOŚ INNEGO' : 'ROZPOCZNIJ NAUKĘ'}
                </button>
            )}
        </div>
    );
};

export const University: React.FC = () => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [mainTab, setMainTab] = useState<SkillType>(SkillType.Universal);
    const [categoryFilter, setCategoryFilter] = useState<SkillCategory | 'all'>('all');

    if (!character || !gameData) return null;

    const skills = gameData.skills || [];
    const filteredSkills = skills.filter(s => {
        const tabMatch = s.type === mainTab;
        const catMatch = categoryFilter === 'all' || s.category === categoryFilter;
        return tabMatch && catMatch;
    });

    const handleStartLearning = async (skillId: string) => {
        try {
            const updatedChar = await api.learnSkill(skillId);
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message); }
    };

    const handleCompleteLearning = async () => {
        try {
            const updatedChar = await api.completeLearningSkill();
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message); }
    };

    const universityImageUrl = gameData.settings?.universityImage;

    return (
        <ContentPanel title={t('university.title')}>
            {/* Opis Uniwersytetu */}
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-indigo-500/20 mb-8 relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                    <BookOpenIcon className="h-64 w-64 text-indigo-400" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center lg:items-start">
                    <div className="flex-1">
                        <h4 className="text-indigo-400 font-black uppercase tracking-widest text-[11px] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                            Kronika Uniwersytetu
                        </h4>
                        <div className="max-h-[250px] overflow-y-auto pr-4 custom-scrollbar">
                            <p className="text-sm text-gray-300 leading-relaxed italic whitespace-pre-wrap">
                                {t('university.description')}
                            </p>
                        </div>
                    </div>

                    {universityImageUrl && (
                        <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
                            <div className="relative aspect-[4/5] md:aspect-square lg:aspect-[3/4] rounded-xl overflow-hidden border-2 border-indigo-500/30 shadow-[0_0_25px_rgba(79,70,229,0.15)] group-hover:shadow-[0_0_35px_rgba(79,70,229,0.25)] transition-all duration-500">
                                <img 
                                    src={universityImageUrl} 
                                    alt="Uniwersytet Mrocznych Rzemiosł" 
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Nawigacja */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-700 mb-8 gap-4">
                <div className="flex gap-2">
                    {/* Type assertion fix: Object.values iteration on enum */}
                    {(Object.values(SkillType) as SkillType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => setMainTab(type)}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${mainTab === type ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                        >
                            {t(`university.${type.toLowerCase()}` as any)}
                        </button>
                    ))}
                </div>
                
                <div className="flex gap-2 mb-2 md:mb-0">
                    <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all ${categoryFilter === 'all' ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-800 text-gray-600 hover:text-gray-400'}`}>Wszystkie</button>
                    <button onClick={() => setCategoryFilter(SkillCategory.Passive)} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all ${categoryFilter === SkillCategory.Passive ? 'bg-amber-900/40 border-amber-600 text-amber-400' : 'bg-slate-900 border-slate-800 text-gray-600 hover:text-gray-400'}`}>Pasywne</button>
                    <button onClick={() => setCategoryFilter(SkillCategory.Active)} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all ${categoryFilter === SkillCategory.Active ? 'bg-sky-900/40 border-sky-600 text-sky-400' : 'bg-slate-900 border-slate-800 text-gray-600 hover:text-gray-400'}`}>Aktywne</button>
                </div>
            </div>

            <div className="h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredSkills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <StarIcon className="h-16 w-16 mb-4" />
                        <p className="text-xl font-bold uppercase tracking-widest">Brak dostępnych nauk</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in pb-8">
                        {filteredSkills.map(skill => (
                            <SkillCard 
                                key={skill.id} 
                                skill={skill} 
                                character={character} 
                                t={t} 
                                onLearn={handleStartLearning} 
                                onComplete={handleCompleteLearning}
                            />
                        ))}
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
