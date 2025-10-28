

import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Location as LocationType } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { MapIcon } from './icons/MapIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface LocationProps {
  playerCharacter: PlayerCharacter;
  onCharacterUpdate: (character: PlayerCharacter) => void;
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
            <p className="text-lg text-gray-400 mb-6">{t('location.arrivesIn')}</p>
            <div className="text-6xl font-mono font-bold text-amber-400 mb-8">{formatTimeLeft(timeLeft)}</div>
        </div>
    );
};


export const Location: React.FC<LocationProps> = ({ playerCharacter, onCharacterUpdate, locations }) => {
  const { t } = useTranslation();
  const currentLocation = locations.find(loc => loc.id === playerCharacter.currentLocationId);
  const otherLocations = locations.filter(loc => loc.id !== playerCharacter.currentLocationId);

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
      onCharacterUpdate(updatedCharacter);
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
                <span className="font-semibold text-gray-300">{t('statistics.energyLabel')}:</span>
                <span className="font-mono text-lg font-bold text-white">{playerCharacter.stats.currentEnergy} / {playerCharacter.stats.maxEnergy}</span>
            </div>
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/40 p-6 rounded-xl">
          <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('location.currentLocation')}</h3>
          <p className="text-4xl font-extrabold text-white">{currentLocation.name}</p>
          <p className="text-gray-400 mt-4 italic">{currentLocation.description}</p>
        </div>

        <div className="bg-slate-900/40 p-6 rounded-xl">
          <h3 className="text-2xl font-bold text-indigo-400 mb-4 flex items-center">
            <MapIcon className="h-6 w-6 mr-2" /> {t('location.travels')}
          </h3>
          {otherLocations.length > 0 ? (
            <ul className="space-y-4">
              {otherLocations.map(loc => (
                <li key={loc.id} className="bg-slate-800/50 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-white">{loc.name}</p>
                    <p className="text-sm italic text-gray-400 mt-1">{loc.description}</p>
                    <div className="flex items-center text-sm mt-2 space-x-4">
                      <div className="flex items-center text-amber-400">
                        <CoinsIcon className="h-4 w-4 mr-1" />
                        <span>{loc.travelCost}</span>
                      </div>
                       <div className="flex items-center text-sky-400">
                        <BoltIcon className="h-4 w-4 mr-1" />
                        <span>{loc.travelEnergyCost}</span>
                      </div>
                      <div className="flex items-center text-gray-400">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        <span>{loc.travelTime}s</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartTravel(loc.id)}
                    disabled={playerCharacter.resources.gold < loc.travelCost || playerCharacter.stats.currentEnergy < loc.travelEnergyCost}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed"
                  >
                    {t('location.travel')}
                  </button>
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