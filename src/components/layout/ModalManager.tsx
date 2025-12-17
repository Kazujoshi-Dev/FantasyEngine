
import React from 'react';
import { ExpeditionRewardSummary, PvpRewardSummary, GameData, PlayerCharacter } from '../../types';
import { ExpeditionSummaryModal } from '../combat/CombatSummary';
import { NewsModal } from '../Sidebar';

interface ModalManagerProps {
    expeditionReport: { summary: ExpeditionRewardSummary; messageId: number } | null;
    pvpReport: PvpRewardSummary | null;
    news: { open: boolean, content: string };
    gameData: GameData;
    character: PlayerCharacter;
    onCloseExpedition: () => void;
    onClosePvp: () => void;
    onCloseNews: () => void;
}

export const ModalManager: React.FC<ModalManagerProps> = ({
    expeditionReport, pvpReport, news, gameData, character,
    onCloseExpedition, onClosePvp, onCloseNews
}) => {
    return (
        <>
            {expeditionReport && (
                <ExpeditionSummaryModal
                    reward={expeditionReport.summary}
                    onClose={onCloseExpedition}
                    characterName={character.name}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    enemies={gameData.enemies}
                    messageId={expeditionReport.messageId}
                    backgroundImage={gameData.settings?.reportBackgroundUrl}
                />
            )}
            
            {pvpReport && (
                <ExpeditionSummaryModal
                    reward={{
                        combatLog: pvpReport.combatLog,
                        isVictory: pvpReport.isVictory,
                        totalGold: pvpReport.gold,
                        totalExperience: pvpReport.experience,
                        rewardBreakdown: [],
                        itemsFound: [],
                        essencesFound: {}
                    }}
                    onClose={onClosePvp}
                    characterName={character.name}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    enemies={gameData.enemies}
                    isPvp={true}
                    pvpData={{ attacker: pvpReport.attacker, defender: pvpReport.defender }}
                    isDefenderView={pvpReport.defender.id === character.id}
                    backgroundImage={gameData.settings?.reportBackgroundUrl}
                />
            )}

            <NewsModal 
                isOpen={news.open} 
                onClose={onCloseNews} 
                content={news.content}
            />
        </>
    );
};
