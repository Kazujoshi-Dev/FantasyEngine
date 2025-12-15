import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { Tower as TowerType, ActiveTowerRun, ExpeditionRewardSummary, EssenceType, ItemRarity } from '../types';
import { ExpeditionSummaryModal } from './combat/CombatSummary';
import { CoinsIcon } from './icons/CoinsIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { rarityStyles, ItemListItem } from './shared/ItemSlot';
import { StarIcon } from './icons/StarIcon';
import { BoltIcon } from './icons/BoltIcon';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const Tower: React.FC = () => {
    const { t } = useTranslation();
    const { character, gameData, updateCharacter } = useCharacter();
    
    const [towers, setTowers] = useState<TowerType[]>([]);
    const [activeRun, setActiveRun] = useState<ActiveTowerRun | null>(null);
    const [selectedTower, setSelectedTower] = useState<TowerType | null>(null);
    const [loading, setLoading] = useState(true);
    
    const [fightResult, setFightResult] = useState<{ summary: ExpeditionRewardSummary, isTowerComplete: boolean } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.getTowers();
            if (res.activeRun) {
                setActiveRun(res.activeRun);
                setSelectedTower(res.tower);
            } else {
                setTowers(res.towers || []);
                setActiveRun(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleStart = async (towerId: string) => {
        try {
            const res = await api.startTower(towerId);
            setActiveRun(res.activeRun);
            setSelectedTower(res.tower);
            const updatedChar = await api.getCharacter();
            updateCharacter(updatedChar);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleFight = async () => {
        try {
            const res = await api.fightTower();
            const updatedChar = await api.getCharacter();
            updateCharacter(updatedChar);

            const summary: ExpeditionRewardSummary = {
                isVictory: res.victory,
                combatLog: res.combatLog,
                totalGold: res.rewards?.gold || 0,
                totalExperience: res.rewards?.experience || 0,
                itemsFound: res.rewards?.items || [],
                essencesFound: res.rewards?.essences || {},
                rewardBreakdown: [] 
            };

            setFightResult({ summary, isTowerComplete: res.isTowerComplete });
            
            if (res.victory && !res.isTowerComplete) {
                 setActiveRun(prev => prev ? ({
                     ...prev,
                     currentFloor: res.currentFloor,
                     currentHealth: updatedChar.stats.currentHealth,
                     currentMana: updatedChar.stats.currentMana,
                     accumulatedRewards: res.rewards
                 }) : null);
            } else if (!res.victory || res.isTowerComplete) {
                setActiveRun(null);
                fetchData();
            }

        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRetreat = async () => {
        if(!confirm('Czy na pewno chcesz się wycofać? Zachowasz dotychczasowe nagrody.')) return;
        try {
            await api.retreatTower();
            const updatedChar = await api.getCharacter();
            updateCharacter(updatedChar);
            setActiveRun(null);
            fetchData();
        } catch(e:any) {
            alert(e.message);
        }
    };

    if (!gameData || !character) return null;

    return (
        <ContentPanel title="Wieża Mroku">
           {fightResult && (
               <ExpeditionSummaryModal 
                    reward={fightResult.summary}
                    onClose={() => setFightResult(null)}
                    characterName={character.name}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    enemies={gameData.enemies}
               />
           )}

           {loading ? <p className="text-gray-500">Ładowanie...</p> : (
               activeRun && selectedTower ? (
                   <div className="flex flex-col h-full gap-6">
                        {/* Active Run Header */}
                        <div className="bg-slate-900/50 p-6 rounded-xl border border-red-900/50 flex justify-between items-center relative overflow-hidden">
                             <div className="absolute inset-0 bg-red-900/5 pointer-events-none animate-pulse"></div>
                             <div>
                                 <h3 className="text-2xl font-bold text-red-400 mb-1">{selectedTower.name}</h3>
                                 <p className="text-gray-400">Piętro <span className="text-white font-bold text-xl">{activeRun.currentFloor}</span> / {selectedTower.totalFloors}</p>
                             </div>
                             <div className="text-right z-10">
                                 <p className="text-sm text-gray-400 mb-1">Twoje Zdrowie</p>
                                 <p className="text-xl font-mono font-bold text-green-400">{Math.ceil(activeRun.currentHealth)} / {character.stats.maxHealth}</p>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow min-h-0">
                            {/* Current Floor Status */}
                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center">
                                <SwordsIcon className="h-16 w-16 text-red-500 mb-4 opacity-80" />
                                <h4 className="text-xl font-bold text-white mb-2">Przeciwnicy Czekają</h4>
                                <p className="text-gray-400 max-w-sm">
                                    Za drzwiami czają się potwory. Pokonaj je, aby przejść dalej i zgarnąć łupy.
                                </p>
                                {selectedTower.floors[activeRun.currentFloor - 1]?.energyCost ? (
                                     <p className="mt-4 text-sky-400 flex items-center gap-2 font-bold bg-slate-800 px-3 py-1 rounded-full">
                                        <BoltIcon className="h-4 w-4"/> Koszt: {selectedTower.floors[activeRun.currentFloor - 1].energyCost} Energii
                                     </p>
                                ) : null}
                                <button 
                                    onClick={handleFight} 
                                    className="mt-6 px-8 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg shadow-lg shadow-red-900/20 transition-all hover:scale-105"
                                >
                                    WALCZ!
                                </button>
                            </div>

                            {/* Rewards So Far */}
                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col">
                                <h4 className="text-lg font-bold text-amber-400 mb-4 border-b border-slate-700 pb-2">Zgromadzone Nagrody</h4>
                                <div className="space-y-3 flex-grow overflow-y-auto pr-2 custom-scrollbar">
                                     <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                                         <span className="text-gray-400 text-sm">Złoto</span>
                                         <span className="text-amber-400 font-mono font-bold">{activeRun.accumulatedRewards.gold.toLocaleString()}</span>
                                     </div>
                                     <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                                         <span className="text-gray-400 text-sm">Doświadczenie</span>
                                         <span className="text-sky-400 font-mono font-bold">{activeRun.accumulatedRewards.experience.toLocaleString()} XP</span>
                                     </div>
                                     {Object.entries(activeRun.accumulatedRewards.essences || {}).map(([key, val]) => (
                                         <div key={key} className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                                             <span className={`${rarityStyles[essenceToRarityMap[key as EssenceType]].text} text-sm`}>{t(`resources.${key}`)}</span>
                                             <span className="text-white font-mono font-bold">x{val}</span>
                                         </div>
                                     ))}
                                     {activeRun.accumulatedRewards.items && activeRun.accumulatedRewards.items.length > 0 && (
                                         <div className="mt-4">
                                             <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Przedmioty ({activeRun.accumulatedRewards.items.length})</p>
                                             <div className="space-y-1">
                                                 {activeRun.accumulatedRewards.items.map((item, idx) => {
                                                     const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                                                     if(!template) return null;
                                                     return (
                                                         <div key={idx} className="scale-90 origin-left">
                                                            <ItemListItem item={item} template={template} affixes={gameData.affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} />
                                                         </div>
                                                     )
                                                 })}
                                             </div>
                                         </div>
                                     )}
                                </div>
                                <button 
                                    onClick={handleRetreat} 
                                    className="mt-4 w-full py-2 border border-slate-600 text-gray-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                                >
                                    Uciekaj z nagrodami
                                </button>
                            </div>
                        </div>
                   </div>
               ) : (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                       {/* Left: Tower List */}
                       <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl border border-slate-700 overflow-y-auto">
                           <h3 className="text-lg font-bold text-gray-200 mb-4">Dostępne Wieże</h3>
                           <div className="space-y-3">
                               {towers.length === 0 && <p className="text-gray-500">Brak dostępnych wież w tej lokacji.</p>}
                               {towers.map(tower => (
                                   <div 
                                        key={tower.id} 
                                        onClick={() => setSelectedTower(tower)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTower?.id === tower.id ? 'bg-indigo-900/40 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                                    >
                                       <h4 className="font-bold text-white">{tower.name}</h4>
                                       <p className="text-xs text-gray-400">{tower.totalFloors} Pięter</p>
                                   </div>
                               ))}
                           </div>
                       </div>

                       {/* Right: Details */}
                       <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center">
                           {selectedTower ? (
                               <>
                                   {selectedTower.image && <img src={selectedTower.image} alt={selectedTower.name} className="w-full max-w-md h-48 object-cover rounded-lg border border-slate-600 mb-6 shadow-lg" />}
                                   <h3 className="text-3xl font-bold text-white mb-2">{selectedTower.name}</h3>
                                   <p className="text-gray-400 italic mb-6 max-w-lg">{selectedTower.description}</p>
                                   
                                   <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 mb-8 w-full max-w-lg text-left">
                                       <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2"><CoinsIcon className="h-5 w-5"/> Główna Nagroda</h4>
                                       <div className="grid grid-cols-2 gap-4 text-sm">
                                           {selectedTower.grandPrize.gold > 0 && <p className="text-gray-300">Złoto: <span className="text-amber-400 font-mono font-bold">{selectedTower.grandPrize.gold.toLocaleString()}</span></p>}
                                           {selectedTower.grandPrize.experience > 0 && <p className="text-gray-300">XP: <span className="text-sky-400 font-mono font-bold">{selectedTower.grandPrize.experience.toLocaleString()}</span></p>}
                                           {Object.entries(selectedTower.grandPrize.essences || {}).map(([k,v]) => (
                                               <p key={k} className={`${rarityStyles[essenceToRarityMap[k as EssenceType]].text}`}>{t(`resources.${k}`)}: {v}</p>
                                           ))}
                                       </div>
                                       <div className="mt-2 text-xs">
                                             {selectedTower.grandPrize.items && selectedTower.grandPrize.items.length > 0 && (
                                                  <p className="text-gray-400 mb-1">Unikalne Przedmioty: <span className="text-white">{selectedTower.grandPrize.items.length}</span></p>
                                              )}
                                             {selectedTower.grandPrize.randomItemRewards && selectedTower.grandPrize.randomItemRewards.map((reward, idx) => (
                                                  <p key={idx} className={`${rarityStyles[reward.rarity].text} italic opacity-80`}>
                                                      Losowy {t(`rarity.${reward.rarity}`)} przedmiot x{reward.amount}
                                                  </p>
                                              ))}
                                       </div>
                                   </div>

                                   <button 
                                        onClick={() => handleStart(selectedTower.id)} 
                                        className="px-8 py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg shadow-lg shadow-green-900/20 transition-all hover:scale-105"
                                   >
                                       Rozpocznij Wyzwanie
                                   </button>
                               </>
                           ) : (
                               <div className="text-gray-500">Wybierz wieżę, aby zobaczyć szczegóły.</div>
                           )}
                       </div>
                   </div>
               )
           )}
        </ContentPanel>
    );
};