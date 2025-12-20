
import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';
import { useCharacter } from '../contexts/CharacterContext';
import { Tower as TowerType, ActiveTowerRun, ExpeditionRewardSummary, ItemInstance, EssenceType, Enemy } from '../types';

interface TowerGameState {
    towers: TowerType[];
    activeRun: ActiveTowerRun | null;
    activeTower: TowerType | null;
    loading: boolean;
    isMoving: boolean;
    progress: number;
    floorReport: ExpeditionRewardSummary | null;
    endGameSummary: {
        outcome: 'VICTORY' | 'DEFEAT' | 'RETREAT';
        rewards: { gold: number, experience: number, items: ItemInstance[], essences: any };
    } | null;
    pendingFinalVictory: {
        outcome: 'VICTORY' | 'DEFEAT';
        rewards: { gold: number, experience: number, items: ItemInstance[], essences: any };
    } | null;
}

export const useTowerGame = () => {
    const { character, updateCharacter, gameData } = useCharacter();
    const [state, setState] = useState<TowerGameState>({
        towers: [],
        activeRun: null,
        activeTower: null,
        loading: true,
        isMoving: false,
        progress: 0,
        floorReport: null,
        endGameSummary: null,
        pendingFinalVictory: null
    });

    const fetchData = useCallback(async () => {
        if (state.endGameSummary || state.floorReport || state.pendingFinalVictory) return;

        setState(prev => ({ ...prev, loading: true }));
        try {
            const data = await api.getTowers();
            setState(prev => ({
                ...prev,
                towers: data.activeRun ? [] : (data.towers || []),
                activeRun: data.activeRun || null,
                activeTower: data.tower || null,
                loading: false
            }));
        } catch (e) {
            console.error(e);
            setState(prev => ({ ...prev, loading: false }));
        }
    }, [state.endGameSummary, state.floorReport, state.pendingFinalVictory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const startTower = async (towerId: string) => {
        setState(prev => ({ ...prev, loading: true }));
        try {
            const res = await api.startTower(towerId);
            setState(prev => ({
                ...prev,
                activeRun: res.activeRun,
                activeTower: res.tower,
                loading: false
            }));
            api.getCharacter().then(updateCharacter); 
        } catch (e: any) {
            alert(e.message);
            setState(prev => ({ ...prev, loading: false }));
        }
    };

    const performFight = async () => {
        if (!state.activeTower || !state.activeRun || !gameData) return;
        
        try {
            const res = await api.fightTower();
            
            // Pobieramy przeciwników dla aktualnego piętra do raportu
            const floorConfig = state.activeTower.floors.find(f => f.floorNumber === state.activeRun!.currentFloor);
            const floorEnemies: Enemy[] = floorConfig 
                ? floorConfig.enemies.map(fe => gameData.enemies.find(e => e.id === fe.enemyId)).filter(Boolean) as Enemy[]
                : [];

            if (res.victory) {
                const newFloor = res.currentFloor || state.activeRun.currentFloor + (res.isTowerComplete ? 0 : 1);
                const updatedRun = {
                    ...state.activeRun,
                    currentFloor: newFloor,
                    currentHealth: Math.max(0, res.combatLog[res.combatLog.length - 1].playerHealth),
                    currentMana: Math.max(0, res.combatLog[res.combatLog.length - 1].playerMana),
                    accumulatedRewards: res.rewards 
                };
                setState(prev => ({ ...prev, activeRun: updatedRun }));
                api.getCharacter().then(updateCharacter);

                if (res.isTowerComplete) {
                    setState(prev => ({
                        ...prev,
                        pendingFinalVictory: {
                            outcome: 'VICTORY',
                            rewards: res.rewards || { gold: 0, experience: 0, items: [], essences: {} }
                        },
                        floorReport: {
                            isVictory: true,
                            totalGold: 0, 
                            totalExperience: 0,
                            itemsFound: [], 
                            essencesFound: {},
                            combatLog: res.combatLog,
                            rewardBreakdown: [{ source: `Finałowa Walka: ${state.activeTower?.name}`, gold: 0, experience: 0 }],
                            encounteredEnemies: floorEnemies
                        }
                    }));
                } else {
                    setState(prev => ({
                        ...prev,
                        floorReport: {
                            isVictory: true,
                            totalGold: 0, 
                            totalExperience: 0,
                            itemsFound: [], 
                            essencesFound: {},
                            combatLog: res.combatLog,
                            rewardBreakdown: [{ source: `Ukończono Piętro ${state.activeRun?.currentFloor}`, gold: 0, experience: 0 }],
                            encounteredEnemies: floorEnemies
                        }
                    }));
                }
            } else {
                setState(prev => ({
                    ...prev,
                    pendingFinalVictory: {
                        outcome: 'DEFEAT',
                        rewards: { gold: 0, experience: 0, items: [], essences: {} }
                    },
                    floorReport: {
                        isVictory: false,
                        totalGold: 0,
                        totalExperience: 0,
                        itemsFound: [],
                        essencesFound: {},
                        combatLog: res.combatLog,
                        rewardBreakdown: [],
                        encounteredEnemies: floorEnemies
                    }
                }));
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setState(prev => ({ ...prev, isMoving: false, progress: 0 }));
        }
    };

    const handleFightClick = (floorCost: number, durationSeconds: number) => {
        if (!character) return;
        if (character.stats.currentEnergy < floorCost) {
            alert('Brak energii.');
            return;
        }

        if (durationSeconds > 0) {
            setState(prev => ({ ...prev, isMoving: true, progress: 0 }));
            const interval = 100;
            const steps = (durationSeconds * 1000) / interval;
            let currentStep = 0;

            const timer = setInterval(() => {
                currentStep++;
                const newProgress = Math.min((currentStep / steps) * 100, 100);
                setState(prev => ({ ...prev, progress: newProgress }));

                if (currentStep >= steps) {
                    clearInterval(timer);
                    performFight();
                }
            }, interval);
        } else {
            performFight();
        }
    };

    const handleRetreat = async () => {
        if (!confirm('Czy na pewno chcesz uciec z wieży? Zabierzesz ze sobą wszystkie zgromadzone dotąd łupy.')) return;
        try {
            const res = await api.retreatTower();
            setState(prev => ({
                ...prev,
                endGameSummary: {
                    outcome: 'RETREAT',
                    rewards: res.rewards || { gold: 0, experience: 0, items: [], essences: {} }
                },
                activeRun: null
            }));
            api.getCharacter().then(updateCharacter);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const closeFloorReport = () => {
        setState(prev => {
            const newState = { ...prev, floorReport: null };
            if (prev.pendingFinalVictory) {
                newState.endGameSummary = { ...prev.pendingFinalVictory, outcome: prev.pendingFinalVictory.outcome === 'VICTORY' ? 'VICTORY' : 'DEFEAT' };
                newState.pendingFinalVictory = null;
                newState.activeRun = null;
            }
            return newState;
        });
    };

    const closeSummary = () => {
        setState(prev => ({ ...prev, endGameSummary: null }));
        fetchData();
        api.getCharacter().then(updateCharacter);
    };

    return {
        ...state,
        startTower,
        handleFightClick,
        handleRetreat,
        closeFloorReport,
        closeSummary,
        refresh: fetchData
    };
};
