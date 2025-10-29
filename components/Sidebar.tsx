import React from 'react';
import { Tab, PlayerCharacter, Location } from '../types';
import { BarChartIcon } from './icons/BarChartIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { MapIcon } from './icons/MapIcon';
import { HomeIcon } from './icons/HomeIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { CoinsIcon } from './icons/CoinsIcon';
import { TrophyIcon } from './icons/TrophyIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { HandshakeIcon } from './icons/HandshakeIcon';
import { AnvilIcon } from './icons/AnvilIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { BoltIcon } from './icons/BoltIcon';
import { MailIcon } from './icons/MailIcon';
import { QuestIcon } from './icons/QuestIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';
import { MessageSquareIcon } from './icons/MessageSquareIcon';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  playerCharacter: PlayerCharacter | null;
  currentLocation: Location | undefined;
  onLogout: () => void;
  hasUnreadMessages: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, playerCharacter, currentLocation, onLogout, hasUnreadMessages }) => {
  const { t } = useTranslation();

  const allMenuItems = [
    { id: Tab.Statistics, label: t('sidebar.statistics'), icon: <BarChartIcon className="h-5 w-5" />, alwaysVisible: true },
    { id: Tab.Equipment, label: t('sidebar.equipment'), icon: <ShieldIcon className="h-5 w-5" />, alwaysVisible: true },
    { id: Tab.Expedition, label: t('sidebar.expedition'), icon: <MapIcon className="h-5 w-5" /> },
    { id: Tab.Quests, label: t('sidebar.quests'), icon: <QuestIcon className="h-5 w-5" /> },
    { id: Tab.Tavern, label: t('sidebar.tavern'), icon: <MessageSquareIcon className="h-5 w-5" />, alwaysVisible: true },
    { id: Tab.Trader, label: t('sidebar.trader'), icon: <HandshakeIcon className="h-5 w-5" /> },
    { id: Tab.Blacksmith, label: t('sidebar.blacksmith'), icon: <AnvilIcon className="h-5 w-5" /> },
    { id: Tab.Camp, label: t('sidebar.camp'), icon: <HomeIcon className="h-5 w-5" /> },
    { id: Tab.Location, label: t('sidebar.location'), icon: <GlobeIcon className="h-5 w-5" /> },
    { id: Tab.Resources, label: t('sidebar.resources'), icon: <CoinsIcon className="h-5 w-5" /> },
    { id: Tab.Ranking, label: t('sidebar.ranking'), icon: <TrophyIcon className="h-5 w-5" />, alwaysVisible: true },
    { id: Tab.Messages, label: t('sidebar.messages'), icon: <MailIcon className="h-5 w-5" />, alwaysVisible: true, notification: hasUnreadMessages },
    { id: Tab.Admin, label: t('sidebar.admin'), icon: <SettingsIcon className="h-5 w-5" /> },
  ];

  const visibleMenuItems = allMenuItems.filter(item => {
    if (item.id === Tab.Admin) {
      return playerCharacter?.username === 'Kazujoshi';
    }
    return item.alwaysVisible || (currentLocation && currentLocation.availableTabs.includes(item.id));
  });

  return (
    <aside className="w-56 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 flex-shrink-0 flex flex-col">
      <div className="p-6 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-white tracking-wider mb-2">
          {t('sidebar.title')}
        </h1>
        {playerCharacter && (
          <div className="text-center bg-slate-900/50 rounded-lg p-2">
            <p className="font-semibold text-lg text-indigo-400">{playerCharacter.name}</p>
            <p className="text-sm text-gray-400">{t(`race.${playerCharacter.race}`)} - {t('statistics.level')} {playerCharacter.level}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {visibleMenuItems.map((item) => {
          const isResting = playerCharacter?.isResting;
          const isTraveling = !!playerCharacter?.activeTravel;

          const isRestricted = 
            (isResting && (item.id === Tab.Expedition || item.id === Tab.Location || item.id === Tab.Trader || item.id === Tab.Blacksmith || item.id === Tab.Quests)) ||
            (isTraveling && (item.id === Tab.Expedition || item.id === Tab.Camp || item.id === Tab.Trader || item.id === Tab.Blacksmith || item.id === Tab.Quests));
            
          const showEnergy = (item.id === Tab.Expedition || item.id === Tab.Location) && playerCharacter;
          
          return (
            <button
              key={item.id}
              onClick={() => !isRestricted && setActiveTab(item.id)}
              disabled={isRestricted}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ease-in-out relative
                ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-400 hover:bg-slate-700 hover:text-white'
                }
                ${isRestricted ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}
              `}
              title={isRestricted ? t('sidebar.actionBlockedWarning') : ""}
            >
              <div className="flex items-center space-x-3">
                {item.icon}
                <span>{item.label}</span>
                 {item.notification && (
                    <span className="absolute left-2 top-2.5 h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </div>
              {showEnergy && (
                <div className="flex items-center text-xs bg-slate-700/50 px-2 py-0.5 rounded-full">
                    <BoltIcon className="h-3 w-3 mr-1 text-sky-400" />
                    <span className="font-mono text-white">
                        {playerCharacter.stats.currentEnergy}/{playerCharacter.stats.maxEnergy}
                    </span>
                </div>
              )}
            </button>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-700/50">
         <a
            href="https://suppi.pl/kazujoshi-dev"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ease-in-out text-gray-400 hover:bg-amber-800/50 hover:text-white mb-2"
          >
            <CoffeeIcon className="h-5 w-5" />
            <span>{t('sidebar.buyCoffee')}</span>
          </a>
         <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ease-in-out text-gray-400 hover:bg-red-800/50 hover:text-white"
          >
            <LogoutIcon className="h-5 w-5" />
            <span>{t('sidebar.logout')}</span>
          </button>
      </div>
    </aside>
  );
};