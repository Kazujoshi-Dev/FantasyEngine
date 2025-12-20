
import React from 'react';
import { ContentPanel } from './ContentPanel';
import { useCharacter } from '@/contexts/CharacterContext';
import { useTowerGame } from '../hooks/useTowerGame';
import { TowerSummaryView } from './tower/TowerSummaryView';
import { TowerLobby } from './tower/TowerLobby';
import { ActiveRunView } from './tower/ActiveRunView';
import { ExpeditionSummaryModal } from './combat/CombatSummary';

export const Tower: React.FC = () => {
    const { character, gameData } = useCharacter();
    const { 
        towers, 
        activeRun, 
        activeTower, 
        loading, 
        isMoving, 
        progress, 
        floorReport, 
        endGameSummary, 
        pendingFinalVictory, 
        startTower, 
        handleFightClick, 
        handleRetreat, 
        closeFloorReport, 
        closeSummary
    } = useTowerGame();

    // 1. END GAME SUMMARY (Highest Priority)
    if (endGameSummary && !floorReport) {
        return (
            <ContentPanel title={endGameSummary.outcome === 'VICTORY' ? 'Zwycięstwo!' : 'Koniec Wyprawy'}>
                <TowerSummaryView 
                    outcome={endGameSummary.outcome}
                    rewards={endGameSummary.rewards}
                    onClose={closeSummary}
                    itemTemplates={gameData?.itemTemplates || []}
                    affixes={gameData?.affixes || []}
                />
            </ContentPanel>
        );
    }
    
    if (loading && !floorReport && !pendingFinalVictory) {
        return <ContentPanel title="Wieża Mroku"><p className="text-gray-500">Ładowanie...</p></ContentPanel>;
    }
    
    if (!character || !gameData) return null;

    // 2. ACTIVE RUN VIEW
    if (activeRun && activeTower) {
        return (
            <ContentPanel title={`Wieża Mroku: ${activeTower.name}`}>
                {floorReport && (
                     <ExpeditionSummaryModal 
                        reward={floorReport}
                        onClose={closeFloorReport}
                        characterName={character.name}
                        itemTemplates={gameData.itemTemplates}
                        affixes={gameData.affixes}
                        enemies={gameData.enemies}
                        isHunting={false}
                        backgroundImage={gameData.settings?.reportBackgroundUrl}
                    />
                )}

                <ActiveRunView 
                    activeRun={activeRun}
                    activeTower={activeTower}
                    character={character}
                    gameData={gameData}
                    onFight={handleFightClick}
                    onRetreat={handleRetreat}
                    isMoving={isMoving}
                    progress={progress}
                />
            </ContentPanel>
        );
    }

    // 3. LOBBY VIEW
    return (
        <ContentPanel title="Wieża Mroku">
            <TowerLobby 
                towers={towers} 
                character={character} 
                gameData={gameData} 
                onStart={startTower} 
            />
        </ContentPanel>
    );
};
