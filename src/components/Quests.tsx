
import React, { useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { Quest, QuestType, Enemy, ItemTemplate, EssenceType, ItemRarity, ItemInstance, Affix } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { QuestIcon } from './icons/QuestIcon';
import { rarityStyles, ItemTooltip } from './shared/ItemSlot';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';

const getObjectiveText = (quest: Quest, progress: number, enemies: Enemy[], itemTemplates: ItemTemplate[], t: (key: string, options?: any) => string) => {
    const { objective } = quest;
    if (!objective) {
        return "Zadanie w przygotowaniu (brak celu)";
    }
    const targetName =
        objective.type === QuestType.Kill ? enemies.find(e => e.id === objective.targetId)?.name :
        objective.type === QuestType.Gather ? itemTemplates.find(it => it.id === objective.targetId)?.name :
        objective.type === QuestType.GatherResource ? t(`resources.${objective.targetId}`) : '';
    
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
}> = ({ quest, isAccepted }) => {
    const { character, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();

    if (!character || !gameData) return null;
    const { enemies, itemTemplates, affixes } = gameData;
    
    const onAcceptQuest = async (questId: string) => {
        try {
            const updatedChar = await api.acceptQuest(questId);
            updateCharacter(updatedChar);
        } catch (e: any) {
            if (e.message === 'Invalid token') {
                window.location.reload();
            } else {
                alert(e.message);
            }
        }
    };
    const onCompleteQuest = async (questId: string) => {
        try {
            const updatedChar = await api.completeQuest(questId);
            updateCharacter(updatedChar);
        } catch (e: any) {
             if (e.message === 'Invalid token') {
                window.location.reload();
            } else {
                alert(e.message);
            }
        }
    };

    const progressData = character.questProgress?.find(p => p.questId === quest.id) || { progress: 0, completions: 0 };
    const canStillComplete = quest.repeatable === 0 || progressData.completions < quest.repeatable;
    
    if (!quest.objective) {
        return (
            <div className="bg-slate-900/40 p-6 rounded-xl border border-red-900/50">
                <h3 className="text-lg font-bold text-red-400">{quest.name}</h3>
                <p className="text-gray-500 text-sm">Błąd danych zadania: Brak zdefiniowanego celu.</p>
            </div>
        );
    }

    const { objective } = quest;

    const currentProgress = useMemo(() => {
        if (!isAccepted) return 0;
        switch (objective.type) {
            case QuestType.Kill:
                return progressData.progress;
            case QuestType.Gather:
                return (character.inventory || []).filter(i => i && i.templateId === objective.targetId).length;
            case QuestType.GatherResource:
                return (character.resources as any)[objective.targetId as EssenceType] || 0;
            case QuestType.PayGold:
                return character.resources.gold;
            default:
                return 0;
        }
    }, [character, objective, isAccepted, progressData]);

    const isObjectiveMet = currentProgress >= objective.amount;

    const progressPercentage = objective.amount > 0 ? (currentProgress / objective.amount) * 100 : 0;
    
    const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
        [EssenceType.Common]: ItemRarity.Common,
        [EssenceType.Uncommon]: ItemRarity.Uncommon,
        [EssenceType.Rare]: ItemRarity.Rare,
        [EssenceType.Epic]: ItemRarity.Epic,
        [EssenceType.Legendary]: ItemRarity.Legendary,
    };

    return (
        <div key={quest.id} className="bg-slate-900/40 p-6 rounded-xl border border-slate-700/50">
            <h3 className="text-2xl font-bold text-indigo-400 mb-2 flex items-center">
                <QuestIcon className="h-5 w-5 mr-3"/>
                {quest.name}
            </h3>
            <p className="text-gray-400 mb-4 text-sm italic">{quest.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold text-gray-300 mb-2">{t('quests.objective')}</h4>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <p className="text-white">{getObjectiveText(quest, progressData.progress, enemies, itemTemplates, t)}</p>
                        {isAccepted && canStillComplete && (
                             <div className="mt-2">
                                <div className="w-full bg-slate-700 rounded-full h-2.5">
                                    <div className="bg-amber-400 h-2.5 rounded-full" style={{width: `${Math.min(100, progressPercentage)}%`}}></div>
                                </div>
                                <p className="text-right text-sm font-mono text-gray-400">{Math.min(currentProgress, objective.amount)} / {objective.amount}</p>
                            </div>
                        )}
                    </div>
                    {quest.repeatable !== 1 && <p className="text-xs text-gray-500 mt-2">{t('quests.completions', { count: progressData.completions, total: quest.repeatable === 0 ? '∞' : quest.repeatable })}</p>}
                </div>
                <div>
                    <h4 className="font-semibold text-gray-300 mb-2">{t('quests.rewards')}</h4>
                    <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                        {(quest.rewards?.gold || 0) > 0 && (
                            <p className="flex items-center text-amber-400 font-semibold"><CoinsIcon className="h-5 w-5 mr-2"/> {quest.rewards.gold.toLocaleString()} {t('resources.gold')}</p>
                        )}
                        {(quest.rewards?.experience || 0) > 0 && (
                            <p className="flex items-center text-sky-400 font-semibold"><StarIcon className="h-5 w-5 mr-2"/> {quest.rewards.experience.toLocaleString()} XP</p>
                        )}
                        {(quest.rewards?.itemRewards || []).map((reward, index) => {
                            const template = itemTemplates.find(t => t.id === reward.templateId);
                            if (!template) return null;
                            const dummyInstance: ItemInstance = { uniqueId: `quest-reward-${index}-${template.id}`, templateId: template.id };
                            return (
                                <div key={`item-${index}`} className="relative group flex items-center">
                                    <p className={`font-semibold text-sm cursor-help ${rarityStyles[template.rarity].text}`}>
                                        {(reward.quantity || 1)}x {template.name}
                                    </p>
                                    <ItemTooltip instance={dummyInstance} template={template} affixes={affixes} />
                                </div>
                            );
                        })}
                        {(quest.rewards?.resourceRewards || []).map((reward, index) => {
                            const rarity = essenceToRarityMap[reward.resource];
                            const colorClass = rarityStyles[rarity]?.text || 'text-gray-300';
                            return (
                                <p key={`resource-${index}`} className={`flex items-center font-semibold text-sm ${colorClass}`}>
                                    {(reward.quantity || 1)}x {t(`resources.${reward.resource}`)}
                                </p>
                            );
                        })}
                        {quest.rewards?.lootTable && quest.rewards.lootTable.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-slate-700/50">
                                <p className="text-xs text-gray-400 mb-1">Możliwe łupy:</p>
                                {quest.rewards.lootTable.map((drop, index) => {
                                    const template = itemTemplates.find(t => t.id === drop.templateId);
                                    if (!template) return null;
                                    return (
                                        <p key={`loot-${index}`} className={`text-sm ${rarityStyles[template.rarity].text}`}>
                                            {template.name} ({drop.chance}%)
                                        </p>
                                    )
                                })}
                            </div>
                        )}
                        {(!quest.rewards || (
                            (quest.rewards.gold || 0) === 0 && 
                            (quest.rewards.experience || 0) === 0 && 
                            (!quest.rewards.itemRewards || quest.rewards.itemRewards.length === 0) &&
                            (!quest.rewards.resourceRewards || quest.rewards.resourceRewards.length === 0) &&
                            (!quest.rewards.lootTable || quest.rewards.lootTable.length === 0)
                        )) && <p className="text-gray-500 text-sm text-center italic">Brak nagród</p>}
                    </div>
                </div>
            </div>
            
            <div className="mt-6 text-right">
                {isAccepted ? (
                    <>
                        <button
                            onClick={() => onCompleteQuest(quest.id)}
                            disabled={!isObjectiveMet || !canStillComplete}
                            className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            {canStillComplete ? t('quests.complete') : t('quests.completed')}
                        </button>
                        {!isObjectiveMet && quest.objective?.type === QuestType.Gather && <p className="text-red-400 text-sm mt-2">{t('quests.notEnoughItems')}</p>}
                        {!isObjectiveMet && quest.objective?.type === QuestType.PayGold && <p className="text-red-400 text-sm mt-2">{t('quests.notEnoughGold')}</p>}
                        {!isObjectiveMet && quest.objective?.type === QuestType.GatherResource && <p className="text-red-400 text-sm mt-2">{t('quests.notEnoughEssence')}</p>}
                    </>
                ) : (
                     <button
                        onClick={() => onAcceptQuest(quest.id)}
                        disabled={!canStillComplete}
                        className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors duration-200 disabled:bg-slate-600"
                    >
                        {canStillComplete ? t('quests.accept') : t('quests.completed')}
                    </button>
                )}
            </div>
        </div>
    );
};


export const Quests: React.FC = () => {
    const { character, gameData } = useCharacter();
    const { t } = useTranslation();
    
    if (!character || !gameData) return null;
    const { quests } = gameData;
    
    const locationQuests = quests.filter(q => (q.locationIds || []).includes(character.currentLocationId));

    const acceptedQuests = locationQuests.filter(q => {
        const progress = character.questProgress?.find(p => p.questId === q.id);
        const isRepeatableForever = q.repeatable === 0;
        const hasCompletionsLeft = progress ? progress.completions < q.repeatable : true;
        return (character.acceptedQuests || []).includes(q.id) && (isRepeatableForever || hasCompletionsLeft);
    });
    
    const availableQuests = locationQuests.filter(q => {
        if ((character.acceptedQuests || []).includes(q.id)) return false;
        const progress = character.questProgress?.find(p => p.questId === q.id);
        if (!progress) return true;
        if (q.repeatable === 0) return true;
        if (progress.completions < q.repeatable) return true;
        return false;
    });

    const completedQuests = locationQuests.filter(q => {
        if (q.repeatable === 0) return false;
        const progress = character.questProgress?.find(p => p.questId === q.id);
        return progress && progress.completions >= q.repeatable;
    });

    return (
        <ContentPanel title={t('quests.title')}>
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-4">{t('quests.acceptedQuests')}</h2>
                    {acceptedQuests.length > 0 ? (
                        <div className="space-y-6">
                            {acceptedQuests.map(quest => <QuestCard key={quest.id} quest={quest} isAccepted={true} />)}
                        </div>
                    ) : (
                        <p className="text-gray-500">{t('quests.noQuests')}</p>
                    )}
                </div>
                <div className="border-t border-slate-700/50"></div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-4">{t('quests.availableQuests')}</h2>
                    {availableQuests.length > 0 ? (
                        <div className="space-y-6">
                            {availableQuests.map(quest => <QuestCard key={quest.id} quest={quest} isAccepted={false} />)}
                        </div>
                    ) : (
                        <p className="text-gray-500">{t('quests.noQuests')}</p>
                    )}
                </div>
                 <div className="border-t border-slate-700/50"></div>
                 <div>
                    <h2 className="text-2xl font-bold text-white mb-4">{t('quests.completedQuests')}</h2>
                    {completedQuests.length > 0 ? (
                         <div className="space-y-2">
                             {completedQuests.map(quest => (
                                 <div key={quest.id} className="bg-slate-900/40 p-3 rounded-md">
                                     <p className="text-gray-500 line-through">{quest.name}</p>
                                 </div>
                             ))}
                         </div>
                    ) : (
                         <p className="text-gray-500">{t('quests.noQuests')}</p>
                    )}
                 </div>
            </div>
        </ContentPanel>
    );
};
