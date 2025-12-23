
import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Location as LocationType, Tab } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { MapIcon } from './icons/MapIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { HandshakeIcon } from './icons/HandshakeIcon';
import { AnvilIcon } from './icons/AnvilIcon';
import { QuestIcon } from './icons/QuestIcon';
import { MessageSquareIcon } from './icons/MessageSquareIcon';
import { ScaleIcon } from './icons/ScaleIcon';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';

const formatTimeLeft = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
};

const TravelInProgressPanel: React.FC<{ playerCharacter: PlayerCharacter, locations: LocationType[], onArrived: () => void }> = ({ playerCharacter, locations, onArrived }) => {
    const { t } = useTranslation();
    const { activeTravel } = playerCharacter;
    const [timeLeft, setTimeLeft] = useState(0);

    const destination = locations.find(l => l.id === activeTravel?.destinationLocationId);

    useEffect(() => {
        if (activeTravel) {
            const updateTimer = () => {
                const remaining = Math.max(0, Math.floor((activeTravel.finishTime - api.getServerTime()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    onArrived();
                }
            };

            updateTimer();
            const intervalId = setInterval(updateTimer, 1000);
            return () => clearInterval(intervalId);
        }
    }, [activeTravel, onArrived]);

    if (!activeTravel || !destination) return null;

    return (
        <div className="bg-slate-900/40 p-8 rounded-xl text-center">
            <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('location.travelingTitle')}</h3>
            <p className="text-4xl font-extrabold text-white mb-4">{destination.name}</p>
            {destination.image && <img src={destination.image} alt={destination.name} className="w-full h-48 object-cover rounded-lg my-4 border border-slate-700/50" />}
            <p className="text-lg text-gray-400 mb-6">{t('location.arrivesIn')}</p>
            <div className="text-6xl font-mono font-bold text-amber-400 mb-8">{formatTimeLeft(timeLeft)}</div>
        </div>
    );
};


export const Location: React.FC = () => {
  const { character: playerCharacter, baseCharacter, gameData, updateCharacter, setCharacter } = useCharacter();
  const { t } = useTranslation();

  if (!playerCharacter || !baseCharacter || !gameData) {
      return null;
  }
  const { locations } = gameData;
  const currentLocation = locations.find(loc => loc.id === playerCharacter.currentLocationId);
  const otherLocations = locations.filter(loc => loc.id !== playerCharacter.currentLocationId);

  const tabInfoMap: Partial<Record<Tab, { icon: React.ReactElement; label: string }>> = {
    [Tab.Expedition]: { icon: <MapIcon />, label: t('sidebar.expedition') },
    [Tab.Quests]: { icon: <QuestIcon />, label: t('sidebar.quests') },
    [Tab.Tavern]: { icon: <MessageSquareIcon />, label: t('sidebar.tavern') },
    [Tab.Trader]: { icon: <HandshakeIcon />, label: t('sidebar.trader') },
    [Tab.Blacksmith]: { icon: <AnvilIcon />, label: t('sidebar.blacksmith') },
    [Tab.Market]: { icon: <ScaleIcon />, label: t('sidebar.market') },
  };

  const handleStartTravel = (destinationId: string) => {
    const destination = locations.find(loc => loc.id === destinationId);
    if (!destination || playerCharacter.activeTravel) return;

    const hasEnoughGold = playerCharacter.resources.gold >= destination.travelCost;
    const hasEnoughEnergy = playerCharacter.stats.currentEnergy >= destination.travelEnergyCost;

    if (hasEnoughGold && hasEnoughEnergy) {
        api.startTravel(destination.id).then(updated => {
            setCharacter(updated);
        }).catch(err => {
            alert(err.message);
        });
    } else {
      let message = `${t('location.cannotTravel')}. `;
      if (!hasEnoughGold) message += `${t('location.lackGold')}. `;
      if (!hasEnoughEnergy) message += `${t('location.lackEnergy')}.`;
      alert(message.trim());
    }
  };

  const handleArrived = async () => {
      try {
          const updated = await api.completeTravel();
          setCharacter(updated);
      } catch (err) {
          console.error("Błąd podczas kończenia podróży:", err);
      }
  };

  if (!currentLocation) {
    return (
      <ContentPanel title={t('location.title')}>
        <p className="text-red-400">{t('location.error')}</p>
      </ContentPanel>
    );
  }
  
  if (playerCharacter.activeTravel) {
      return (
          <ContentPanel title={t('location.title')}>
              <TravelInProgressPanel playerCharacter={playerCharacter} locations={locations} onArrived={handleArrived} />
          </ContentPanel>
      );
  }

  return (
    <ContentPanel title={t('location.title')}>
        <div className="flex justify-end items-center mb-4">
            <div className="flex items-center space-x-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700/50">
                <BoltIcon className="h-5 w-5 text-sky-400" />
                <span className="font-semibold text-gray-300">{t('statistics.energyLabel')}:</span>
                <span className="font-mono text-lg font-bold text-white">{playerCharacter.stats.currentEnergy} / {playerCharacter.stats.maxEnergy}</span>
            </div>
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/40 p-6 rounded-xl">
          <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('location.currentLocation')}</h3>
          <p className="text-4xl font-extrabold text-white">{currentLocation.name}</p>
          {currentLocation.image && <img src={currentLocation.image} alt={currentLocation.name} className="w-full h-48 object-cover rounded-lg my-4 border border-slate-700/50" />}
          <p className="text-gray-400 mt-4 italic">{currentLocation.description}</p>
          
          <div className="mt-8 pt-6 border-t border-slate-700/50">
             <div className="grid grid-cols-1 gap-6">
                {/* Dostępne udogodnienia */}
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-4">{t('location.availableFacilities')}</h4>
                   <div className="flex flex-wrap gap-3">
                      {Object.keys(tabInfoMap).map(tabKey => {
                        const tabId = tabKey as Tab;
                        const isAvailable = currentLocation.availableTabs?.includes(tabId);
                        if (!isAvailable) return null;
                        const info = tabInfoMap[tabId]!;
                        return (
                          <div key={tabId} className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-2 rounded-lg text-indigo-200">
                             {React.cloneElement(info.icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
                             <span className="text-sm font-bold">{info.label}</span>
                          </div>
                        );
                      })}
                   </div>
                </div>

                {/* Niedostępne udogodnienia */}
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">{t('location.unavailableFacilities')}</h4>
                   <div className="flex flex-wrap gap-3">
                      {Object.keys(tabInfoMap).map(tabKey => {
                        const tabId = tabKey as Tab;
                        const isAvailable = currentLocation.availableTabs?.includes(tabId);
                        if (isAvailable) return null;
                        const info = tabInfoMap[tabId]!;
                        return (
                          <div key={tabId} className="flex items-center gap-2 bg-slate-800/20 border border-slate-700/50 px-3 py-2 rounded-lg text-slate-500 opacity-60 grayscale">
                             {React.cloneElement(info.icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
                             <span className="text-sm font-medium">{info.label}</span>
                          </div>
                        );
                      })}
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="bg-slate-900/40 p-6 rounded-xl">
          <h3 className="text-2xl font-bold text-indigo-400 mb-4 flex items-center">
            <MapIcon className="h-6 w-6 mr-2" /> {t('location.travels')}
          </h3>
          {otherLocations.length > 0 ? (
            <ul className="space-y-4">
              {otherLocations.map(loc => (
                <li key={loc.id} className="bg-slate-800/50 p-4 rounded-lg flex justify-between items-start">
                  <div className="flex items-start gap-4 flex-grow">
                     {loc.image && <img src={loc.image} alt={loc.name} className="w-24 h-24 object-cover rounded-md flex-shrink-0" />}
                     <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start">
                            <p className="text-lg font-semibold text-white">{loc.name}</p>
                            <button
                                onClick={() => handleStartTravel(loc.id)}
                                disabled={playerCharacter.resources.gold < loc.travelCost || playerCharacter.stats.currentEnergy < loc.travelEnergyCost}
                                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:bg-slate-600 disabled:cursor-not-allowed ml-4"
                            >
                                {t('location.travel')}
                            </button>
                        </div>
                        <p className="text-sm italic text-gray-400 mt-1">{loc.description}</p>
                        <div className="flex items-center text-xs mt-2 space-x-3">
                          <div className="flex items-center text-amber-400 font-mono">
                            <CoinsIcon className="h-3 w-3 mr-1" />
                            <span>{loc.travelCost}</span>
                          </div>
                           <div className="flex items-center text-sky-400 font-mono">
                            <BoltIcon className="h-3 w-3 mr-1" />
                            <span>{loc.travelEnergyCost}</span>
                          </div>
                          <div className="flex items-center text-gray-400 font-mono">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            <span>{formatDuration(loc.travelTime)}</span>
                          </div>
                        </div>

                        {/* Podsumowanie udogodnień w lokacji docelowej */}
                        <div className="mt-4 pt-3 border-t border-slate-700/50">
                            <div className="space-y-3">
                                {/* Dostępne (Małe ikony) */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {Object.keys(tabInfoMap).map(tabKey => {
                                        const tabId = tabKey as Tab;
                                        if (!loc.availableTabs?.includes(tabId)) return null;
                                        const info = tabInfoMap[tabId]!;
                                        return (
                                            <div key={tabId} title={info.label} className="flex items-center gap-1 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 text-indigo-300">
                                                {React.cloneElement(info.icon as React.ReactElement<{ className?: string }>, { className: 'h-3 w-3' })}
                                                <span className="text-[9px] font-black uppercase tracking-tighter">{info.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Niedostępne (Bardzo małe ikony, przyciemnione) */}
                                <div className="flex flex-wrap items-center gap-2 opacity-40">
                                    {Object.keys(tabInfoMap).map(tabKey => {
                                        const tabId = tabKey as Tab;
                                        if (loc.availableTabs?.includes(tabId)) return null;
                                        const info = tabInfoMap[tabId]!;
                                        return (
                                            <div key={tabId} title={`Brak: ${info.label}`} className="flex items-center gap-1 grayscale text-slate-500">
                                                {React.cloneElement(info.icon as React.ReactElement<{ className?: string }>, { className: 'h-2.5 w-2.5' })}
                                                <span className="text-[8px] font-bold uppercase tracking-tighter">{info.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                      </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">{t('location.noLocations')}</p>
          )}
        </div>
      </div>
    </ContentPanel>
  );
};
