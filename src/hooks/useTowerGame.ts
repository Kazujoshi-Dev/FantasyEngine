
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
        if (state.endGameSummary || state.pendingFinalVictory) return;

        setState(prev => ({ ...prev, loading: prev.towers.length === 0 })); 
        try {
            const data = await api.getTowers();
            setState(prev => ({
                ...prev,
                towers: data.towers || [],
                activeRun: data.activeRun || null,
                activeTower: data.tower || null,
                loading: false
            }));
        } catch (e) {
            console.error(e);
            setState(prev => ({ ...prev, loading: false }));
        }
    }, [state.endGameSummary, state.pendingFinalVictory]);

    useEffect(() => {
        fetchData();
    }, [fetchData, character?.currentLocationId]);

    const startTower = async (towerId: string) => {
        setState(prev => ({ ...prev, loading: true }));
        try {
            const res = await api.startTower(towerId);
            
            // CRITICAL FIX: Use raw character from backend to avoid double-boosting bug
            if (res.updatedCharacter) {
                updateCharacter(res.updatedCharacter);
            }

            setState(prev => ({
                ...prev,
                activeRun: res.activeRun,
                activeTower: res.tower,
                loading: false
            }));
            
            // Refresh to ensure full sync
            await fetchData();
        } catch (e: any) {
            alert(e.message);
            setState(prev => ({ ...prev, loading: false }));
        }
    };

    const performFight = async () => {
        if (!state.activeTower || !state.activeRun || !gameData) return;
        
        try {
            const res = await api.fightTower();
            
            // Sync character state with raw data from backend
            if (res.updatedCharacter) {
                updateCharacter(res.updatedCharacter);
            }

            const encounteredEnemies: Enemy[] = res.enemies || [];

            if (res.victory) {
                // Rely on backend for next state
                const data = await api.getTowers();
                setState(prev => ({ ...prev, activeRun: data.activeRun }));

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
                            encounteredEnemies: encounteredEnemies
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
                            encounteredEnemies: encounteredEnemies
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
                        encounteredEnemies: encounteredEnemies
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
            
            if (res.updatedCharacter) {
                updateCharacter(res.updatedCharacter);
            }

            setState(prev => ({
                ...prev,
                endGameSummary: {
                    outcome: 'RETREAT',
                    rewards: res.rewards || { gold: 0, experience: 0, items: [], essences: {} }
                },
                activeRun: null
            }));
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
        api.getTowers().then(data => {
            setState(p => ({ ...p, towers: data.towers || [], loading: false }));
        });
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
