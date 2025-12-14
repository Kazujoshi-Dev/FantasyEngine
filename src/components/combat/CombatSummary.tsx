
import React, { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { ExpeditionRewardSummary, ItemTemplate, Affix, Enemy, PartyMember, PvpRewardSummary, EssenceType, ItemRarity, PlayerCharacter, CombatLogEntry } from '../../types';
import { CombatLogRow } from './CombatLog';
import { ItemListItem, rarityStyles } from '../shared/ItemSlot';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';

interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary | (ExpeditionRewardSummary & { opponents?: any[] });
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    enemies: Enemy[];
    
    // Context flags
    isHunting?: boolean;
    isRaid?: boolean;
    isPvp?: boolean;
    
    // Additional Data
    huntingMembers?: PartyMember[];
    opponents?: PartyMember[]; // For raids
    allRewards?: any;
    bossName?: string;
    messageId?: number | null;
    raidId?: number | null;
    pvpData?: { attacker: PlayerCharacter; defender: PlayerCharacter };
    isDefenderView?: boolean;
    backgroundImage?: string;
    initialEnemy?: Enemy;
}

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({
    reward,
    onClose,
    characterName,
    itemTemplates,
    affixes,
    enemies,
    isHunting,
    isRaid,
    huntingMembers,
    opponents,
    allRewards,
    bossName,
    messageId,
    raidId,
    isPvp,
    pvpData,
    isDefenderView,
    backgroundImage,
    initialEnemy
}) => {
    const { t } = useTranslation();
    
    const isVictory = reward.isVictory;
    const title = isPvp 
        ? (isVictory ? t('expedition.victory') : t('expedition.defeat')) 
        : (isVictory ? t('expedition.victory') : t('expedition.defeat'));
    
    const titleColor = isVictory ? 'text-green-500' : 'text-red-500';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-slate-800 w-full max-w-7xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative border border-slate-700" 
                onClick={e => e.stopPropagation()}
                style={{
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                {/* Overlay for readability if bg image */}
                {backgroundImage && <div className="absolute inset-0 bg-slate-900/90 pointer-events-none"></div>}

                <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <div>
                            <h2 className={`text-3xl font-bold ${titleColor} uppercase tracking-wider`}>{title}</h2>
                            {bossName && <p className="text-gray-400 mt-1">vs {bossName}</p>}
                            {isPvp && pvpData && <p className="text-gray-400 mt-1">vs {isDefenderView ? pvpData.attacker.name : pvpData.defender.name}</p>}
                            {isRaid && <p className="text-gray-400 mt-1">Bitwa Gildyjna</p>}
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-4xl leading-none">&times;</button>
                    </div>

                    {/* Content Grid */}
                    <div className="flex-grow overflow-hidden p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                            
                            {/* Left Column: Rewards / Stats */}
                            <div className="lg:col-span-3 bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col overflow-y-auto">
                                <h3 className="text-lg font-bold text-amber-400 mb-4 border-b border-slate-700 pb-2">{t('expedition.totalRewards')}</h3>
                                
                                <div className="space-y-4">
                                    <div className="bg-slate-800/50 p-3 rounded">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-gray-300 flex items-center"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400"/> {t('resources.gold')}</span>
                                            <span className="font-mono font-bold text-white">+{reward.totalGold}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-300 flex items-center"><StarIcon className="h-4 w-4 mr-2 text-sky-400"/> {t('expedition.experience')}</span>
                                            <span className="font-mono font-bold text-white">+{reward.totalExperience}</span>
                                        </div>
                                    </div>

                                    {(reward.itemsFound && reward.itemsFound.length > 0) && (
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-400 mb-2">{t('expedition.itemsFound')}</h4>
                                            <div className="space-y-2">
                                                {reward.itemsFound.map((item, index) => {
                                                    const template = itemTemplates.find(t => t.id === item.templateId);
                                                    if (!template) return null;
                                                    return (
                                                        <ItemListItem 
                                                            key={index} 
                                                            item={item} 
                                                            template={template} 
                                                            affixes={affixes} 
                                                            isSelected={false} 
                                                            onClick={() => {}} 
                                                            showPrimaryStat={false} 
                                                            className="text-xs"
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    
                                     {reward.essencesFound && Object.keys(reward.essencesFound).length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-400 mb-2">{t('expedition.essencesFound')}</h4>
                                            <div className="space-y-1 bg-slate-800/50 p-2 rounded">
                                                {Object.entries(reward.essencesFound).map(([type, amount]) => (
                                                    <div key={type} className="flex justify-between items-center text-xs">
                                                        <span className={rarityStyles[essenceToRarityMap[type as EssenceType]].text}>{t(`resources.${type}`)}</span>
                                                        <span className="font-mono font-bold text-white">x{amount}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Middle Column: Combat Log */}
                            <div className="lg:col-span-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col h-full overflow-hidden">
                                <h3 className="text-lg font-bold text-indigo-400 mb-4 border-b border-slate-700 pb-2">{t('expedition.combatLog.title') || 'Raport Bitewny'}</h3>
                                <div className="flex-grow overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                                    {reward.combatLog.map((log, index) => {
                                        const prevLog = index > 0 ? reward.combatLog[index - 1] : null;
                                        const isNewTurn = log.turn > 0 && (!prevLog || prevLog.turn !== log.turn);
                                        
                                        return (
                                            <React.Fragment key={index}>
                                                {isNewTurn && (
                                                    <div className="flex items-center gap-4 my-3 py-1">
                                                        <div className="h-px bg-slate-700/50 flex-grow"></div>
                                                        <span className="text-slate-500 font-bold text-xs uppercase tracking-widest font-mono">
                                                            {t('expedition.turn')} {log.turn}
                                                        </span>
                                                        <div className="h-px bg-slate-700/50 flex-grow"></div>
                                                    </div>
                                                )}
                                                <CombatLogRow 
                                                    log={log} 
                                                    characterName={characterName} 
                                                    isHunting={isHunting || isRaid} 
                                                    huntingMembers={huntingMembers || (isRaid && opponents ? [...(huntingMembers || []), ...(opponents || [])] : [])} 
                                                />
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Column: Participants / Stats */}
                            <div className="lg:col-span-3 bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col overflow-y-auto">
                                <h3 className="text-lg font-bold text-gray-300 mb-4 border-b border-slate-700 pb-2">
                                    {isRaid ? 'Uczestnicy' : (isPvp ? 'Pojedynek' : 'Drużyna')}
                                </h3>
                                
                                {isPvp && pvpData && (
                                    <div className="space-y-6">
                                        <div className="bg-slate-800/50 p-3 rounded text-center border border-slate-600">
                                            <p className="text-xs text-gray-400 uppercase">Atakujący</p>
                                            <p className="font-bold text-white text-lg">{pvpData.attacker.name}</p>
                                            <div className="text-xs text-gray-500 mt-1">Lvl {pvpData.attacker.level} {t(`class.${pvpData.attacker.characterClass}`)}</div>
                                        </div>
                                        <div className="flex justify-center"><SwordsIcon className="h-8 w-8 text-red-500" /></div>
                                        <div className="bg-slate-800/50 p-3 rounded text-center border border-slate-600">
                                            <p className="text-xs text-gray-400 uppercase">Obrońca</p>
                                            <p className="font-bold text-white text-lg">{pvpData.defender.name}</p>
                                            <div className="text-xs text-gray-500 mt-1">Lvl {pvpData.defender.level} {t(`class.${pvpData.defender.characterClass}`)}</div>
                                        </div>
                                    </div>
                                )}

                                {(isHunting || isRaid) && huntingMembers && (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-sm font-bold text-green-400 mb-2">Twoja Drużyna ({huntingMembers.length})</h4>
                                            <div className="space-y-2">
                                                {huntingMembers.map((m, i) => (
                                                    <div key={i} className="flex justify-between items-center bg-slate-800/50 p-2 rounded text-sm">
                                                        <span className={m.characterName === characterName ? 'text-amber-400 font-bold' : 'text-gray-300'}>{m.characterName}</span>
                                                        <span className="text-xs text-gray-500">Lvl {m.level}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {isRaid && opponents && (
                                            <div>
                                                <h4 className="text-sm font-bold text-red-400 mb-2">Przeciwnicy ({opponents.length})</h4>
                                                <div className="space-y-2">
                                                    {opponents.map((m, i) => (
                                                        <div key={i} className="flex justify-between items-center bg-slate-800/50 p-2 rounded text-sm">
                                                            <span className="text-gray-300">{m.characterName}</span>
                                                            <span className="text-xs text-gray-500">Lvl {m.level}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end">
                        <button onClick={onClose} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">
                            Zamknij
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
