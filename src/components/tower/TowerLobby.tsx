
import React, { useState, useEffect } from 'react';
import { Tower as TowerType, PlayerCharacter, GameData } from '../../types';
import { BoltIcon } from '../icons/BoltIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { StarIcon } from '../icons/StarIcon';
import { rarityStyles, ItemListItem, ItemTooltip } from '../shared/ItemSlot';
import { useTranslation } from '../../contexts/LanguageContext';

interface TowerLobbyProps {
    towers: TowerType[];
    character: PlayerCharacter;
    gameData: GameData;
    onStart: (towerId: string, floorCost: number) => void;
}

export const TowerLobby: React.FC<TowerLobbyProps> = ({ towers, character, gameData, onStart }) => {
    const { t } = useTranslation();
    const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);

    // Synchronizacja zaznaczenia przy zmianie listy wież
    useEffect(() => {
        if (towers.length > 0) {
            if (!selectedTowerId || !towers.find(t => t.id === selectedTowerId)) {
                setSelectedTowerId(towers[0].id);
            }
        } else {
            setSelectedTowerId(null);
        }
    }, [towers, selectedTowerId]);

    const selectedTower = towers.find(t => t.id === selectedTowerId);
    const currentLocation = gameData.locations.find(l => l.id === character.currentLocationId);

    const handleStartClick = () => {
        if (!selectedTower) return;
        const entryCost = selectedTower.entryEnergyCost || 0;
        
        if (!confirm(`Czy na pewno chcesz wejść do Wieży? Koszt wejścia: ${entryCost} Energii. Pamiętaj: zdrowie się nie regeneruje, a porażka oznacza utratę łupów!`)) return;
        
        if (character.stats.currentEnergy < entryCost) {
            alert('Brak energii na wejście.');
            return;
        }

        onStart(selectedTower.id, entryCost);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
            {/* Left Column: Tower List */}
            <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col min-h-0">
                <h3 className="text-xl font-bold text-gray-300 mb-4 px-2">Dostępne Wieże</h3>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {towers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                            <ShieldIcon className="h-12 w-12 text-slate-700 mb-3 opacity-20" />
                            <p className="text-gray-500 text-sm italic">W lokacji <span className="text-indigo-400 font-bold">{currentLocation?.name || 'Nieznanej'}</span> nie odkryto jeszcze żadnej Wieży Mroku.</p>
                            <p className="text-[10px] text-slate-600 mt-2">Sprawdź inne regiony świata.</p>
                        </div>
                    ) : (
                        towers.map(tower => {
                            const isSelected = selectedTowerId === tower.id;
                            const entryCost = tower.entryEnergyCost || 0;
                            return (
                                <button
                                    key={tower.id}
                                    onClick={() => setSelectedTowerId(tower.id)}
                                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 flex justify-between items-center ${isSelected ? 'bg-indigo-900/50 border-indigo-500 shadow-md ring-1 ring-indigo-500/30' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'}`}
                                >
                                    <div className="min-w-0">
                                        <h4 className={`font-bold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>{tower.name}</h4>
                                        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">{tower.totalFloors} Pięter</p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <span className={`text-sm font-mono font-bold flex items-center gap-1 ${character.stats.currentEnergy >= entryCost ? 'text-sky-400' : 'text-red-500'}`}>
                                            {entryCost} <BoltIcon className="h-3 w-3"/>
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Column: Details & Actions */}
            <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col min-h-0 relative overflow-hidden">
                {selectedTower ? (
                    <>
                        {/* Background Image Effect */}
                        {selectedTower.image && (
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <img src={selectedTower.image} alt={selectedTower.name} className="w-full h-full object-cover mix-blend-overlay opacity-30" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent"></div>
                            </div>
                        )}

                        {/* Header Section */}
                        <div className="relative z-10 mb-6 text-center">
                            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2 drop-shadow-sm uppercase tracking-tighter">
                                {selectedTower.name}
                            </h2>
                            <div className="h-1 w-20 bg-indigo-500/50 mx-auto mb-4 rounded-full"></div>
                            <p className="text-gray-400 italic max-w-2xl mx-auto text-sm leading-relaxed">{selectedTower.description}</p>
                        </div>

                        {/* Info Grid */}
                        <div className="relative z-10 grid grid-cols-3 gap-4 mb-8">
                            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Poziom Trudności</p>
                                <p className="text-white font-bold">{selectedTower.totalFloors} Pięter</p>
                            </div>
                            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Lokacja</p>
                                <p className="text-indigo-300 font-bold">{currentLocation?.name}</p>
                            </div>
                            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Koszt Wejścia</p>
                                <p className="text-sky-400 font-bold font-mono flex items-center justify-center gap-1">
                                    {selectedTower.entryEnergyCost || 0} <BoltIcon className="h-4 w-4"/>
                                </p>
                            </div>
                        </div>

                        {/* Rewards Box */}
                        {selectedTower.grandPrize && (
                            <div className="relative z-10 bg-amber-900/10 p-5 rounded-xl border border-amber-700/30 mb-auto backdrop-blur-sm">
                                <h4 className="text-[10px] font-black text-amber-500 uppercase mb-3 flex items-center gap-2 tracking-[0.2em]">
                                    <StarIcon className="h-4 w-4"/> Nagroda Główna
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex gap-4 text-sm font-mono bg-slate-950/50 p-2 rounded border border-white/5">
                                            <span className="text-amber-300 font-bold flex items-center gap-1">{selectedTower.grandPrize.gold.toLocaleString()} <span className="text-[9px] font-sans text-gray-500 uppercase">Złota</span></span>
                                            <span className="text-sky-300 font-bold flex items-center gap-1">{selectedTower.grandPrize.experience.toLocaleString()} <span className="text-[9px] font-sans text-gray-500 uppercase">XP</span></span>
                                        </div>
                                        {selectedTower.grandPrize.essences && Object.keys(selectedTower.grandPrize.essences).length > 0 && (
                                             <div className="grid grid-cols-2 gap-2">
                                                 {Object.entries(selectedTower.grandPrize.essences).map(([key, amount]) => (
                                                     <div key={key} className="flex justify-between bg-slate-950/30 p-1.5 rounded border border-white/5 px-2">
                                                         <span className="text-[10px] text-gray-400 uppercase">{t(`resources.${key}`).replace(' Esencja', '')}</span>
                                                         <span className="font-bold text-white text-xs">x{amount as number}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                    </div>
                                    <div className="space-y-1 text-right border-l border-slate-700/50 pl-4">
                                         {selectedTower.grandPrize.items && selectedTower.grandPrize.items.length > 0 && selectedTower.grandPrize.items.map((item, idx) => {
                                             const tmpl = gameData.itemTemplates.find(t => t.id === item.templateId);
                                             if (!tmpl) return null;
                                             return <p key={idx} className={`${rarityStyles[tmpl.rarity].text} font-bold text-xs`}>{tmpl.name} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}</p>
                                         })}
                                         {selectedTower.grandPrize.randomItemRewards && selectedTower.grandPrize.randomItemRewards.length > 0 && selectedTower.grandPrize.randomItemRewards.map((reward, idx) => (
                                              <p key={idx} className={`${rarityStyles[reward.rarity].text} italic opacity-80 text-[10px] uppercase font-black`}>
                                                  {reward.amount}x Losowy {t(`rarity.${reward.rarity}`)}
                                              </p>
                                          ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Button */}
                        <div className="relative z-10 mt-6 pt-6 border-t border-slate-700/50">
                            <button 
                                onClick={handleStartClick}
                                disabled={character.stats.currentEnergy < (selectedTower.entryEnergyCost || 0)}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-xl transition-all transform hover:scale-[1.01] active:scale-95 disabled:bg-slate-700 disabled:text-gray-500 disabled:transform-none flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
                            >
                                <SwordsIcon className="h-6 w-6"/>
                                {character.stats.currentEnergy < (selectedTower.entryEnergyCost || 0) ? 'Brak Energii' : 'Rzuć Wyzwanie'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-30">
                        <SwordsIcon className="h-24 w-24 mb-4" />
                        <p className="text-xl font-black uppercase tracking-[0.2em]">Wybierz Wieżę Mroku</p>
                    </div>
                )}
            </div>
        </div>
    );
};
