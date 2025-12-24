
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { Skill, SkillCategory, SkillType, CharacterStats, EssenceType, CharacterClass } from '../types';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { rarityStyles } from './shared/ItemSlot';
import { BookOpenIcon } from './icons/BookOpenIcon';

const SkillCard: React.FC<{
    skill: Skill;
    character: any;
    t: any;
    onLearn: (id: string) => void;
}> = ({ skill, character, t, onLearn }) => {
    const isLearned = (character.learnedSkills || []).includes(skill.id);
    
    // Check Stats Requirements
    const statOrder: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
    const statsReqsMet = statOrder.every((req) => {
        const val = (skill.requirements as any)[req];
        if (val === undefined) return true;
        const playerVal = (character.stats[req] || 0);
        return playerVal >= val;
    });

    const levelMatch = character.level >= (skill.requirements.level || 0);

    // Check Class/Race
    const reqClass = skill.requirements.characterClass;
    const reqRace = skill.requirements.race;
    
    let classMatch = !reqClass || character.characterClass === reqClass;
    // Special handling for multi-class skills like Dual Wield
    if (skill.id === 'dual-wield-mastery') {
        const allowed = [CharacterClass.Warrior, CharacterClass.Rogue, CharacterClass.Berserker, CharacterClass.Thief];
        classMatch = !!character.characterClass && allowed.includes(character.characterClass);
    }
    
    const raceMatch = !reqRace || character.race === reqRace;
    const reqsMet = statsReqsMet && classMatch && raceMatch && levelMatch;

    // Check Costs
    const costMet = (Object.entries(skill.cost)).every(([key, val]) => {
        if (val === undefined) return true;
        return (character.resources[key as keyof typeof character.resources] || 0) >= val;
    });

    const canBuy = !isLearned && reqsMet && costMet;

    return (
        <div className={`p-5 rounded-xl border transition-all duration-300 ${isLearned ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="text-lg font-bold text-white mb-0.5">{skill.name}</h4>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${skill.category === SkillCategory.Passive ? 'bg-amber-900/30 border-amber-700 text-amber-500' : 'bg-sky-900/30 border-sky-700 text-sky-500'}`}>
                        {skill.category === SkillCategory.Passive ? t('university.passive') : t('university.active')}
                    </span>
                </div>
                {isLearned && (
                    <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest bg-green-900/20 px-2 py-1 rounded border border-green-800">Opanowano</span>
                )}
            </div>

            <p className="text-sm text-gray-400 italic mb-6 leading-relaxed">
                {skill.description}
            </p>

            <div className="space-y-4 mb-6">
                <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Wymagania</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {skill.requirements.level && (
                             <p className={`text-xs ${levelMatch ? 'text-gray-400' : 'text-red-500 font-bold'}`}>Poziom: {skill.requirements.level}</p>
                        )}
                        {(reqClass || skill.id === 'dual-wield-mastery') && (
                            <p className={`text-xs ${classMatch ? 'text-gray-400' : 'text-red-500 font-bold'}`}>
                                Klasa: {skill.id === 'dual-wield-mastery' ? 'Wojownik, Łotrzyk, Berserker, Złodziej' : t(`class.${reqClass}`)}
                            </p>
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

                {!isLearned && (
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Koszt Nauki</p>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(skill.cost).map(([res, val]) => {
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
                )}
            </div>

            {!isLearned && (
                <button 
                    onClick={() => onLearn(skill.id)}
                    disabled={!canBuy}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-gray-500 rounded-lg text-white font-bold text-xs transition-all shadow-lg active:scale-95"
                >
                    NAUCZ SIĘ
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

    const handleLearnSkill = async (skillId: string) => {
        try {
            const updatedChar = await api.learnSkill(skillId);
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message); }
    };

    return (
        <ContentPanel title={t('university.title')}>
            {/* Przeniesiony Opis Uniwersytetu na Górę */}
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-indigo-500/20 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BookOpenIcon className="h-24 w-24 text-indigo-400" />
                </div>
                <div className="relative z-10">
                    <h4 className="text-indigo-400 font-black uppercase tracking-widest text-[11px] mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                        Kronika Uniwersytetu
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed italic whitespace-pre-wrap max-w-4xl">
                        {t('university.description')}
                    </p>
                </div>
            </div>

            {/* Nawigacja Zakładkami */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-700 mb-8 gap-4">
                <div className="flex gap-2">
                    {Object.values(SkillType).map(type => (
                        <button
                            key={type}
                            onClick={() => setMainTab(type)}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${mainTab === type ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            {t(`university.${type.toLowerCase()}` as any)}
                        </button>
                    ))}
                </div>
                
                <div className="flex gap-2 mb-2 md:mb-0">
                    <button 
                        onClick={() => setCategoryFilter('all')} 
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all ${categoryFilter === 'all' ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-800 text-gray-600 hover:text-gray-400'}`}
                    >
                        Wszystkie
                    </button>
                    <button 
                        onClick={() => setCategoryFilter(SkillCategory.Passive)} 
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all ${categoryFilter === SkillCategory.Passive ? 'bg-amber-900/40 border-amber-600 text-amber-400' : 'bg-slate-900 border-slate-800 text-gray-600 hover:text-gray-400'}`}
                    >
                        Pasywne
                    </button>
                    <button 
                        onClick={() => setCategoryFilter(SkillCategory.Active)} 
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all ${categoryFilter === SkillCategory.Active ? 'bg-sky-900/40 border-sky-600 text-sky-400' : 'bg-slate-900 border-slate-800 text-gray-600 hover:text-gray-400'}`}
                    >
                        Aktywne
                    </button>
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
                                onLearn={handleLearnSkill} 
                            />
                        ))}
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
