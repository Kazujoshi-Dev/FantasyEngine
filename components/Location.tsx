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

interface LocationProps {
  playerCharacter: PlayerCharacter;
  onCharacterUpdate: (character: PlayerCharacter, immediate?: boolean) => void;
  locations: LocationType[];
}

const formatTimeLeft = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const TravelInProgressPanel: React.FC<{
    playerCharacter: PlayerCharacter;
    locations: LocationType[];
}> = ({ playerCharacter, locations }) => {
    const { t } = useTranslation();
    const { activeTravel } = playerCharacter;
    const [timeLeft, setTimeLeft] = useState(0);

    const destination = locations.find(l => l.id === activeTravel?.destinationLocationId);

    useEffect(() => {
        if (activeTravel) {
            const updateTimer = () => {
                const remaining = Math.max(0, Math.floor((activeTravel.finishTime - Date.now()) / 1000));
                setTimeLeft(remaining);
            };

            updateTimer();
            const intervalId = setInterval(updateTimer, 1000);
            return () => clearInterval(intervalId);
        }
    }, [activeTravel]);

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


export const Location: React.FC<LocationProps> = ({ playerCharacter, onCharacterUpdate, locations }) => {
  const { t } = useTranslation();
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
      const updatedCharacter: PlayerCharacter = {
        ...playerCharacter,
        resources: {
          ...playerCharacter.resources,
          gold: playerCharacter.resources.gold - destination.travelCost,
        },
        stats: {
          ...playerCharacter.stats,
          currentEnergy: playerCharacter.stats.currentEnergy - destination.travelEnergyCost,
        },
        activeTravel: {
          destinationLocationId: destination.id,
          finishTime: Date.now() + destination.travelTime * 1000,
        }
      };
      onCharacterUpdate(updatedCharacter, true);
    } else {
      let message = `${t('location.cannotTravel')}. `;
      if (!hasEnoughGold) message += `${t('location.lackGold')}. `;
      if (!hasEnoughEnergy) message += `${t('location.lackEnergy')}.`;
      alert(message.trim());
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
              <TravelInProgressPanel playerCharacter={playerCharacter} locations={locations} />
          </ContentPanel>
      );
  }

  return (
    <ContentPanel title={t('location.title')}>
        <div className="flex justify-end items-center mb-4">
            <div className="flex items-center space-x-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700/50">
                <BoltIcon className="h-5 w-5 text-sky-400" />
                <span className="font-mono text-lg text-white">{playerCharacter.stats.currentEnergy} / {playerCharacter.stats.maxEnergy}</span>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Current Location */}
            <div className="md:col-span-1 bg-slate-900/40 p-6 rounded-xl">
                <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('location.currentLocation')}</h3>
                <p className="text-xl font-semibold text-white mb-4">{currentLocation.name}</p>
                {currentLocation.image && <img src={currentLocation.image} alt={currentLocation.name} className="w-full h-40 object-cover rounded-lg mb-4" />}
                <p className="text-sm text-gray-400 italic mb-6">{currentLocation.description}</p>
                
                <h4 className="font-semibold text-gray-300 mb-2">{t('location.availableFacilities')}</h4>
                <div className="space-y-2">
                    {currentLocation.availableTabs.map(tabId => {
                        const tabInfo = tabInfoMap[tabId];
                        if (!tabInfo) return null;
                        const icon = React.cloneElement(tabInfo.icon as React.ReactElement<any>, { className: 'h-5 w-5 mr-3' });
                        return (
                            <div key={tabId} className="flex items-center bg-slate-800/50 p-2 rounded-md">
                                {icon}
                                <span className="text-sm">{tabInfo.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Travel Options */}
            <div className="md:col-span-2">
                <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('location.travels')}</h3>
                <div className="space-y-4">
                    {otherLocations.length > 0 ? otherLocations.map(loc => {
                        const canAfford = playerCharacter.resources.gold >= loc.travelCost && playerCharacter.stats.currentEnergy >= loc.travelEnergyCost;
                        return (
                            <div key={loc.id} className="bg-slate-900/40 p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <h4 className="text-lg font-semibold text-white">{loc.name}</h4>
                                    <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                                        <span className="flex items-center"><ClockIcon className="h-4 w-4 mr-1"/> {loc.travelTime}s</span>
                                        <span className={`flex items-center ${playerCharacter.resources.gold < loc.travelCost ? 'text-red-400' : ''}`}><CoinsIcon className="h-4 w-4 mr-1"/> {loc.travelCost}</span>
                                        <span className={`flex items-center ${playerCharacter.stats.currentEnergy < loc.travelEnergyCost ? 'text-red-400' : ''}`}><BoltIcon className="h-4 w-4 mr-1"/> {loc.travelEnergyCost}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleStartTravel(loc.id)}
                                    disabled={!canAfford}
                                    className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed"
                                >
                                    {t('location.travel')}
                                </button>
                            </div>
                        )
                    }) : <p className="text-gray-500">{t('location.noLocations')}</p>}
                </div>
            </div>
        </div>
    </ContentPanel>
  );
};
