import React from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, Quest, QuestType, Enemy, ItemTemplate, EssenceType, ItemRarity, ItemInstance } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { StarIcon } from './icons/StarIcon';
import { QuestIcon } from './icons/QuestIcon';
import { rarityStyles, ItemTooltip } from './shared/ItemSlot';

interface QuestsProps {
    character: PlayerCharacter;
    quests: Quest[];
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    onAcceptQuest: (questId: string) => void;
    onCompleteQuest: (questId: string) => void;
}

const getObjectiveText = (quest: Quest, progress: number, enemies: Enemy[], itemTemplates: ItemTemplate[], t: (key: string, options?: any) => string) => {
    const { objective } = quest;
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
    }

    return t(textKey, { amount: objective.amount, targetName });
};

const QuestCard: React.FC<{
    quest: Quest;
    character: PlayerCharacter;
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    isAccepted: boolean;
    onAccept: (id: string) => void;
    onComplete: (id: string) => void;
}> = ({ quest, character, enemies, itemTemplates, isAccepted, onAccept, onComplete }) => {
    const { t } = useTranslation();
    const progress = character.questProgress.find(p => p.questId === quest.id) || { progress: 0, completions: 0 };
    const canStillComplete = quest.repeatable === 0 || progress.completions < quest.repeatable;
    
    const isObjectiveMet = (
        quest.objective.type === QuestType.Kill ? progress.progress >= quest.objective.amount :
        quest.objective.type === QuestType.Gather ? character.inventory.filter(i => i.templateId === quest.objective.targetId).length >= quest.objective.amount :
        quest.objective.type === QuestType.GatherResource ? (character.resources[quest.objective.targetId as EssenceType] || 0) >= quest.objective.amount :
        quest.objective.type === QuestType.PayGold ? character.resources.gold >= quest.objective.amount :
        false
    );

    let canAfford = true;
    if (quest.objective.type === QuestType.Gather) {
        canAfford = character.inventory.filter(i => i.templateId === quest.objective.targetId).length >= quest.objective.amount;
    } else if (quest.objective.type === QuestType.PayGold) {
        canAfford = character.resources.gold >= quest.objective.amount;
    } else if (quest.objective.type === QuestType.GatherResource) {
        canAfford = (character.resources[quest.objective.targetId as EssenceType] || 0) >= quest.objective.amount;
    }


    const progressPercentage = (progress.progress / quest.objective.amount) * 100;
    
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
                        <p className="text-white">{getObjectiveText(quest, progress.progress, enemies, itemTemplates, t)}</p>
                        {isAccepted && quest.objective.type === QuestType.Kill && canStillComplete && (
                             <div className="mt-2">
                                <div className="w-full bg-slate-700 rounded-full h-2.5">
                                    <div className="bg-amber-400 h-2.5 rounded-full" style={{width: `${progressPercentage}%`}}></div>
                                </div>
                                <p className="text-right text-sm font-mono text-gray-400">{progress.progress} / {quest.objective.amount}</p>
                            </div>
                        )}
                    </div>
                    {quest.repeatable !== 1 && <p className="text-xs text-gray-500 mt-2">{t('quests.completions', { count: progress.completions, total: quest.repeatable === 0 ? '∞' : quest.repeatable })}</p>}
                </div>
                <div>
                    <h4 className="font-semibold text-gray-300 mb-2">{t('quests.rewards')}</h4>
                    <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                        {quest.rewards.gold > 0 && (
                            <p className="flex items-center text-amber-400 font-semibold"><CoinsIcon className="h-5 w-5 mr-2"/> {quest.rewards.gold.toLocaleString()} {t('resources.gold')}</p>
                        )}
                        {quest.rewards.experience > 0 && (
                            <p className="flex items-center text-sky-400 font-semibold"><StarIcon className="h-5 w-5 mr-2"/> {quest.rewards.experience.toLocaleString()} XP</p>
                        )}
                        {quest.rewards.itemRewards?.map((reward, index) => {
                            const template = itemTemplates.find(t => t.id === reward.templateId);
                            if (!template) return null;
                            const dummyInstance: ItemInstance = { uniqueId: `quest-reward-${index}-${template.id}`, templateId: template.id };
                            return (
                                <div key={`item-${index}`} className="relative group flex items-center">
                                    <p className={`font-semibold text-sm cursor-help ${rarityStyles[template.rarity].text}`}>
                                        {reward.quantity}x {template.name}
                                    </p>
                                    <ItemTooltip instance={dummyInstance} template={template} />
                                </div>
                            );
                        })}
                        {quest.rewards.resourceRewards?.map((reward, index) => {
                            const rarity = essenceToRarityMap[reward.resource];
                            const colorClass = rarityStyles[rarity]?.text || 'text-gray-300';
                            return (
                                <p key={`resource-${index}`} className={`flex items-center font-semibold text-sm ${colorClass}`}>
                                    {reward.quantity}x {t(`resources.${reward.resource}`)}
                                </p>
                            );
                        })}
                        {quest.rewards.lootTable && quest.rewards.lootTable.length > 0 && (
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
                    </div>
                </div>
            </div>
            
            <div className="mt-6 text-right">
                {isAccepted ? (
                    <>
                        <button
                            onClick={() => onComplete(quest.id)}
                            disabled={!isObjectiveMet || !canStillComplete || !canAfford}
                            className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            {canStillComplete ? t('quests.complete') : t('quests.completed')}
                        </button>
                        {!canAfford && quest.objective.type === QuestType.Gather && <p className="text-red-400 text-sm mt-2">{t('quests.notEnoughItems')}</p>}
                        {!canAfford && quest.objective.type === QuestType.PayGold && <p className="text-red-400 text-sm mt-2">{t('quests.notEnoughGold')}</p>}
                        {!canAfford && quest.objective.type === QuestType.GatherResource && <p className="text-red-400 text-sm mt-2">{t('quests.notEnoughEssence')}</p>}
                    </>
                ) : (
                     <button
                        onClick={() => onAccept(quest.id)}
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


export const Quests: React.FC<QuestsProps> = ({ character, quests, enemies, itemTemplates, onAcceptQuest, onCompleteQuest }) => {
    const { t } = useTranslation();
    
    const locationQuests = quests.filter(q => q.locationIds.includes(character.currentLocationId));

    const acceptedQuests = locationQuests.filter(q => {
        const progress = character.questProgress.find(p => p.questId === q.id);
        const isRepeatableForever = q.repeatable === 0;
        const hasCompletionsLeft = progress ? progress.completions < q.repeatable : true;
        
        return character.acceptedQuests.includes(q.id) && (isRepeatableForever || hasCompletionsLeft);
    });
    
    const availableQuests = locationQuests.filter(q => {
        if (character.acceptedQuests.includes(q.id)) return false; // Already accepted
        
        const progress = character.questProgress.find(p => p.questId === q.id);
        if (!progress) return true; // Never done, so it's available

        if (q.repeatable === 0) return true; // Infinitely repeatable
        if (progress.completions < q.repeatable) return true; // Has completions left

        return false;
    });

    const completedQuests = locationQuests.filter(q => {
        if (q.repeatable === 0) return false; // Infinitely repeatable quests are never "completed"
        const progress = character.questProgress.find(p => p.questId === q.id);
        return progress && progress.completions >= q.repeatable;
    });

    return (
        <ContentPanel title={t('quests.title')}>
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-4">{t('quests.acceptedQuests')}</h2>
                    {acceptedQuests.length > 0 ? (
                        <div className="space-y-6">
                            {acceptedQuests.map(quest => (
                                <QuestCard
                                    key={quest.id}
                                    quest={quest}
                                    character={character}
                                    enemies={enemies}
                                    itemTemplates={itemTemplates}
                                    isAccepted={true}
                                    onAccept={onAcceptQuest}
                                    onComplete={onCompleteQuest}
                                />
                            ))}
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
                            {availableQuests.map(quest => (
                                <QuestCard
                                    key={quest.id}
                                    quest={quest}
                                    character={character}
                                    enemies={enemies}
                                    itemTemplates={itemTemplates}
                                    isAccepted={false}
                                    onAccept={onAcceptQuest}
                                    onComplete={onCompleteQuest}
                                />
                            ))}
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