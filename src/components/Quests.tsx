
import React, { useMemo, useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { Quest, QuestType, QuestCategory, Enemy, ItemTemplate, EssenceType, ItemRarity, ItemInstance, Affix } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { QuestIcon } from './icons/QuestIcon';
import { ClockIcon } from './icons/ClockIcon';
import { CheckIcon } from './icons/CheckIcon';
import { rarityStyles, ItemTooltip } from './shared/ItemSlot';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';

const getObjectiveText = (quest: Quest, progress: number, enemies: Enemy[], itemTemplates: ItemTemplate[], t: (key: string, options?: any) => string) => {
    const { objective } = quest;
    if (!objective) return "Zadanie w przygotowaniu (brak celu)";
    
    let targetName = '';
    if (objective.type === QuestType.Kill) {
        targetName = enemies.find(e => e.id === objective.targetId)?.name || objective.targetId;
    } else if (objective.type === QuestType.Gather) {
        targetName = itemTemplates.find(it => it.id === objective.targetId)?.name || objective.targetId;
    } else if (objective.type === QuestType.GatherResource) {
        targetName = t(`resources.${objective.targetId}`);
    }
    
    let textKey = '';
    switch (objective.type) {
        case QuestType.Kill: textKey = 'quests.objectiveKill'; break;
        case QuestType.Gather: textKey = 'quests.objectiveGather'; break;
        case QuestType.GatherResource: textKey = 'quests.objectiveGatherResource'; break;
        case QuestType.PayGold: textKey = 'quests.objectivePayGold'; break;
        default: return "Nieznany cel";
    }

    return t(textKey, { amount: objective.amount, targetName: targetName || '???' });
};

const QuestCard: React.FC<{
    quest: Quest;
    isAccepted: boolean;
    isCompletedArchive?: boolean;
}> = ({ quest, isAccepted, isCompletedArchive }) => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();

    if (!character || !gameData) return null;
    const { enemies, itemTemplates, affixes } = gameData;
    
    const onAcceptQuest = async (questId: string) => {
        try {
            const updatedChar = await api.acceptQuest(questId);
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message); }
    };

    const onCompleteQuest = async (questId: string) => {
        try {
            const updatedChar = await api.completeQuest(questId);
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message); }
    };

    const progressData = character.questProgress?.find(p => p.questId === quest.id) || { progress: 0, completions: 0 };
    
    // Sprawdzanie czy ukończono DZISIAJ (Reset 00:00 UTC)
    const lastReset = new Date();
    lastReset.setUTCHours(0, 0, 0, 0);
    const completedToday = quest.category === QuestCategory.Daily && progressData.lastCompletedAt && progressData.lastCompletedAt >= lastReset.getTime();
    
    // Zadanie dzienne można robić raz dziennie, zwykłe wg limitu repeatable
    const canStillComplete = !completedToday && (quest.category === QuestCategory.Daily || quest.repeatable === 0 || progressData.completions < quest.repeatable);
    
    if (!quest.objective) return null;
    const { objective } = quest;

    const currentProgress = useMemo(() => {
        if (!isAccepted) return 0;
        switch (objective.type) {
            case QuestType.Kill: return progressData.progress;
            case QuestType.Gather: return (character.inventory || []).filter(i => i && i.templateId === objective.targetId && !i.isBorrowed).length;
            case QuestType.GatherResource: return (character.resources as any)[objective.targetId as EssenceType] || 0;
            case QuestType.PayGold: return character.resources.gold;
            default: return 0;
        }
    }, [character, objective, isAccepted, progressData]);

    const isObjectiveMet = currentProgress >= objective.amount;
    const progressPercentage = objective.amount > 0 ? (currentProgress / objective.amount) * 100 : 0;

    if (isCompletedArchive) {
        return (
            <div className="bg-slate-900/20 p-4 rounded-lg border border-slate-800/50 flex justify-between items-center opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-900/20 rounded-full border border-green-500/20">
                        <CheckIcon className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-300">{quest.name}</h4>
                        <p className="text-[10px] text-slate-500 italic line-clamp-1">{quest.description}</p>
                    </div>
                </div>
                <div className="text-[10px] font-mono text-slate-600 uppercase font-bold">
                    {t('quests.completions', { count: progressData.completions, total: quest.repeatable === 0 ? '∞' : quest.repeatable })}
                </div>
            </div>
        );
    }

    return (
        <div key={quest.id} className={`bg-slate-900/40 rounded-xl border transition-all duration-300 overflow-hidden ${isAccepted ? 'border-indigo-500/50 ring-1 ring-indigo-500/10' : 'border-slate-700/50'} ${completedToday ? 'opacity-50 grayscale' : ''}`}>
            {quest.image && (
                <div className="relative w-full h-32 md:h-40 overflow-hidden border-b border-slate-700/50">
                    <img src={quest.image} alt={quest.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent"></div>
                </div>
            )}
            
            <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-bold text-indigo-400 flex items-center">
                        <QuestIcon className="h-5 w-5 mr-3"/>
                        {quest.name}
                    </h3>
                    {quest.category === QuestCategory.Daily && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-900/30 border border-amber-600/30 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-400">
                            <ClockIcon className="h-3 w-3" /> Zadanie Dniowe
                        </span>
                    )}
                </div>
                <p className="text-gray-400 mb-4 text-sm italic leading-relaxed">{quest.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 border-b border-slate-700 pb-1">{t('quests.objective')}</h4>
                        <div className="bg-slate-800/50 p-4 rounded-lg">
                            <p className="text-white text-sm">{getObjectiveText(quest, progressData.progress, enemies, itemTemplates, t)}</p>
                            {isAccepted && canStillComplete && (
                                <div className="mt-3">
                                    <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-500" style={{width: `${Math.min(100, progressPercentage)}%`}}></div>
                                    </div>
                                    <p className="text-right text-[10px] font-mono text-gray-500 mt-1 uppercase tracking-tighter font-bold">
                                        Postęp: {Math.min(currentProgress, objective.amount)} / {objective.amount}
                                    </p>
                                </div>
                            )}
                            {completedToday && (
                                <p className="text-xs text-amber-500 mt-2 font-bold uppercase tracking-tight text-center italic">Zadanie ukończone. Wróć jutro!</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 border-b border-slate-700 pb-1">{t('quests.rewards')}</h4>
                        <div className="bg-slate-800/50 p-4 rounded-lg flex flex-wrap gap-3">
                            {(quest.rewards?.gold || 0) > 0 && (
                                <div className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded border border-amber-900/20">
                                    <CoinsIcon className="h-4 w-4 text-amber-400"/>
                                    <span className="text-amber-400 font-mono font-bold text-xs">{quest.rewards.gold.toLocaleString()}</span>
                                </div>
                            )}
                            {(quest.rewards?.experience || 0) > 0 && (
                                <div className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded border border-sky-900/20">
                                    <StarIcon className="h-4 w-4 text-sky-400"/>
                                    <span className="text-sky-400 font-mono font-bold text-xs">{quest.rewards.experience.toLocaleString()} XP</span>
                                </div>
                            )}
                            {(quest.rewards?.itemRewards || []).map((reward, index) => {
                                const template = itemTemplates.find(t => t.id === reward.templateId);
                                if (!template) return null;
                                const dummyInstance: ItemInstance = { uniqueId: `quest-reward-${index}-${template.id}`, templateId: template.id };
                                return (
                                    <div key={`item-${index}`} className="relative group flex items-center bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                                        <p className={`font-bold text-[10px] uppercase cursor-help ${rarityStyles[template.rarity].text}`}>
                                            {(reward.quantity || 1)}x {template.name}
                                        </p>
                                        <ItemTooltip instance={dummyInstance} template={template} affixes={affixes} itemTemplates={itemTemplates} />
                                    </div>
                                );
                            })}
                            {(quest.rewards?.randomItemRewards || []).map((reward, index) => (
                                <div key={`rand-${index}`} className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                                    <span className={`font-bold text-[10px] uppercase ${rarityStyles[reward.rarity].text}`}>
                                        {reward.quantity}x Losowy {t(`rarity.${reward.rarity}`)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                    {isAccepted ? (
                        <button
                            onClick={() => onCompleteQuest(quest.id)}
                            disabled={!isObjectiveMet || !canStillComplete}
                            className="px-8 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:bg-slate-700 disabled:text-gray-500"
                        >
                            {canStillComplete ? t('quests.complete') : (completedToday ? 'Ukończono dziś' : t('quests.completed'))}
                        </button>
                    ) : (
                        <button
                            onClick={() => onAcceptQuest(quest.id)}
                            disabled={!canStillComplete}
                            className="px-8 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:bg-slate-700 disabled:text-gray-500"
                        >
                            {canStillComplete ? t('quests.accept') : t('quests.completed')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const Quests: React.FC = () => {
    const { character, gameData } = useCharacter();
    const { t } = useTranslation();
    const [timeToReset, setTimeToReset] = useState('');

    // Licznik do północy UTC opartej o CZAS SERWERA (api.getServerTime())
    useEffect(() => {
        const updateTimer = () => {
            const serverNow = api.getServerTime();
            const nextReset = new Date(serverNow);
            nextReset.setUTCHours(24, 0, 0, 0); 
            
            const diff = nextReset.getTime() - serverNow;
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);
            
            setTimeToReset(`${hours}h ${minutes}m ${seconds}s`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    if (!character || !gameData) return null;

    const { quests } = gameData;
    const acceptedIds = character.acceptedQuests || [];

    const activeQuests = quests.filter(q => acceptedIds.includes(q.id));

    const availableQuests = quests.filter(q => {
        if (acceptedIds.includes(q.id)) return false;
        if (q.locationIds && q.locationIds.length > 0 && !q.locationIds.includes(character.currentLocationId)) return false;
        
        const progress = character.questProgress?.find(p => p.questId === q.id);
        if (progress) {
            const lastReset = new Date(api.getServerTime());
            lastReset.setUTCHours(0, 0, 0, 0);
            const completedToday = progress.lastCompletedAt && progress.lastCompletedAt >= lastReset.getTime();

            if (q.category === QuestCategory.Daily) {
                // Zadania dzienne: dostępne jeśli nie ukończone DZISIAJ
                if (completedToday) return false;
            } else {
                // Zadania normalne: dostępne jeśli nie przekroczono limitu powtórzeń
                const limit = q.repeatable === 0 ? Infinity : (q.repeatable || 1);
                if (progress.completions >= limit) return false;
            }
        }
        return true;
    });

    const completedInLocation = quests.filter(q => {
        const progress = character.questProgress?.find(p => p.questId === q.id);
        if (!progress || progress.completions === 0) return false;
        
        const isInLocation = q.locationIds?.includes(character.currentLocationId) || !q.locationIds || q.locationIds.length === 0;
        return isInLocation;
    });

    return (
        <ContentPanel title={t('quests.title')}>
            <div className="space-y-12 pb-12 pr-2">
                <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-amber-600/20">
                    <div className="flex items-center gap-3">
                        <ClockIcon className="h-5 w-5 text-amber-400" />
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Nowe zadania dzienne za:</p>
                            <p className="font-mono text-xl font-bold text-amber-400">{timeToReset}</p>
                        </div>
                    </div>
                    <div className="text-right">
                         <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Czas Świata:</p>
                         <p className="text-sm font-mono text-gray-300">
                            {new Date(api.getServerTime()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                         </p>
                    </div>
                </div>

                <section>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 mb-6 px-2 border-b border-white/5 pb-3 flex justify-between items-center">
                        <span>{t('quests.acceptedQuests')}</span>
                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-slate-800 px-3 py-1 rounded-full border border-white/5">{activeQuests.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {activeQuests.length === 0 && <p className="text-gray-500 text-center py-10 italic text-sm">Brak aktywnych zadań w dzienniku.</p>}
                        {activeQuests.map(quest => (
                            <QuestCard key={quest.id} quest={quest} isAccepted={true} />
                        ))}
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-green-400 mb-6 px-2 border-b border-white/5 pb-3 flex justify-between items-center">
                        <span>{t('quests.availableQuests')}</span>
                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-slate-800 px-3 py-1 rounded-full border border-white/5">{availableQuests.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {availableQuests.length === 0 && <p className="text-gray-500 text-center py-10 italic text-sm">{t('quests.noQuests')}</p>}
                        {availableQuests.map(quest => (
                            <QuestCard key={quest.id} quest={quest} isAccepted={false} />
                        ))}
                    </div>
                </section>

                {completedInLocation.length > 0 && (
                    <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 px-2 border-b border-white/5 pb-3 flex justify-between items-center">
                            <span>Ukończone w tej lokacji</span>
                            <span className="text-[10px] font-mono font-bold text-gray-600 bg-slate-800/50 px-3 py-1 rounded-full border border-white/5">{completedInLocation.length}</span>
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {completedInLocation.map(quest => (
                                <QuestCard key={quest.id} quest={quest} isAccepted={false} isCompletedArchive={true} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </ContentPanel>
    );
};
