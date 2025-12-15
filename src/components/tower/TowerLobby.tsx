
import React, { useState, useEffect } from 'react';
import { Tower as TowerType, PlayerCharacter, GameData } from '../../types';
import { BoltIcon } from '../icons/BoltIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { SwordsIcon } from '../icons/SwordsIcon';
import { StarIcon } from '../icons/StarIcon';
import { rarityStyles } from '../shared/ItemSlot';
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

    useEffect(() => {
        if (towers.length > 0 && !selectedTowerId) {
            setSelectedTowerId(towers[0].id);
        }
    }, [towers, selectedTowerId]);

    const selectedTower = towers.find(t => t.id === selectedTowerId);

    const handleStartClick = () => {
        if (!selectedTower) return;
        const floor1Cost = selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0;
        
        if (!confirm('Czy na pewno chcesz wejść do Wieży? Pamiętaj: zdrowie się nie regeneruje, a porażka oznacza utratę łupów!')) return;
        
        if (character.stats.currentEnergy < floor1Cost) {
            alert('Brak energii.');
            return;
        }

        onStart(selectedTower.id, floor1Cost);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[75vh]">
            {/* Left Column: Tower List */}
            <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl border border-slate-700 flex flex-col min-h-0">
                <h3 className="text-xl font-bold text-gray-300 mb-4 px-2">Dostępne Wieże</h3>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                    {towers.length === 0 && <p className="text-gray-500 text-center py-8">Brak wież w tej lokacji.</p>}
                    {towers.map(tower => {
                        const isSelected = selectedTowerId === tower.id;
                        const floor1Cost = tower.floors.find(f => f.floorNumber === 1)?.energyCost || 0;
                        return (
                            <button
                                key={tower.id}
                                onClick={() => setSelectedTowerId(tower.id)}
                                className={`w-full text-left p-4 rounded-lg border transition-all duration-200 flex justify-between items-center ${isSelected ? 'bg-indigo-900/50 border-indigo-500 shadow-md' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'}`}
                            >
                                <div>
                                    <h4 className={`font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>{tower.name}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{tower.totalFloors} Pięter</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-sm font-mono font-bold ${character.stats.currentEnergy >= floor1Cost ? 'text-sky-400' : 'text-red-500'}`}>
                                        {floor1Cost} <BoltIcon className="h-3 w-3 inline"/>
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right Column: Details & Actions */}
            <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col min-h-0 relative overflow-hidden">
                {selectedTower ? (
                    <>
                        {/* Background Image Effect */}
                        {selectedTower.image && (
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <img src={selectedTower.image} alt={selectedTower.name} className="w-full h-full object-cover mix-blend-overlay opacity-80" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/10 to-transparent"></div>
                            </div>
                        )}

                        {/* Header Section */}
                        <div className="relative z-10 mb-6 text-center">
                            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2 drop-shadow-sm">
                                {selectedTower.name}
                            </h2>
                            <p className="text-gray-400 italic max-w-2xl mx-auto">{selectedTower.description}</p>
                        </div>

                        {/* Info Grid */}
                        <div className="relative z-10 grid grid-cols-3 gap-4 mb-8">
                            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Poziom Trudności</p>
                                <p className="text-white font-bold">{selectedTower.totalFloors} Pięter</p>
                            </div>
                            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Lokacja</p>
                                <p className="text-indigo-300 font-bold">{gameData.locations.find(l => l.id === selectedTower.locationId)?.name}</p>
                            </div>
                            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-center backdrop-blur-sm">
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Koszt Wejścia</p>
                                <p className="text-sky-400 font-bold font-mono flex items-center justify-center gap-1">
                                    {(selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0)} <BoltIcon className="h-4 w-4"/>
                                </p>
                            </div>
                        </div>

                        {/* Rewards Box */}
                        {selectedTower.grandPrize && (
                            <div className="relative z-10 bg-amber-900/10 p-5 rounded-xl border border-amber-700/30 mb-auto backdrop-blur-sm">
                                <h4 className="text-sm font-bold text-amber-500 uppercase mb-3 flex items-center gap-2">
                                    <StarIcon className="h-4 w-4"/> Nagroda Główna (za ukończenie)
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex gap-4 text-sm font-mono mb-2">
                                            <span className="text-amber-300 font-bold">{selectedTower.grandPrize.gold} <span className="text-xs font-sans text-gray-500">Złota</span></span>
                                            <span className="text-sky-300 font-bold">{selectedTower.grandPrize.experience} <span className="text-xs font-sans text-gray-500">XP</span></span>
                                        </div>
                                        {selectedTower.grandPrize.essences && (
                                             <div className="text-xs space-y-1">
                                                 {Object.entries(selectedTower.grandPrize.essences).map(([key, amount]) => (
                                                     <div key={key} className="flex gap-2">
                                                         <span className={`text-white`}>{t(`resources.${key}`)}</span>
                                                         <span className="font-bold text-white">x{amount as number}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                    </div>
                                    <div className="space-y-1 text-sm text-right">
                                         {selectedTower.grandPrize.items && selectedTower.grandPrize.items.map((item, idx) => {
                                             const tmpl = gameData.itemTemplates.find(t => t.id === item.templateId);
                                             if (!tmpl) return null;
                                             return <p key={idx} className={`${rarityStyles[tmpl.rarity].text} font-bold`}>{tmpl.name} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}</p>
                                         })}
                                         {selectedTower.grandPrize.randomItemRewards && selectedTower.grandPrize.randomItemRewards.map((reward, idx) => (
                                              <p key={idx} className={`${rarityStyles[reward.rarity].text} italic opacity-80`}>
                                                  Losowy {t(`rarity.${reward.rarity}`)} przedmiot x{reward.amount}
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
                                disabled={character.stats.currentEnergy < (selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0)}
                                className="w-full py-4 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.01] disabled:bg-slate-700 disabled:text-gray-500 disabled:transform-none flex items-center justify-center gap-3 text-lg"
                            >
                                <SwordsIcon className="h-6 w-6"/>
                                {character.stats.currentEnergy < (selectedTower.floors.find(f => f.floorNumber === 1)?.energyCost || 0) ? 'Brak Energii' : 'Wejdź do Wieży'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <ShieldIcon className="h-24 w-24 mb-4 opacity-20" />
                        <p className="text-lg">Wybierz wieżę z listy po lewej stronie, aby zobaczyć szczegóły.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
