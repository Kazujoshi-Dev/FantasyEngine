import React from 'react';
import { Tab, PlayerCharacter } from '../types';
import { BarChartIcon } from './icons/BarChartIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { MapIcon } from './icons/MapIcon';
import { HomeIcon } from './icons/HomeIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { CoinsIcon } from './icons/CoinsIcon';
import { TrophyIcon } from './icons/TrophyIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { HandshakeIcon } from './icons/HandshakeIcon';
import { AnvilIcon } from './icons/AnvilIcon';
import { MailIcon } from './icons/MailIcon';
import { QuestIcon } from './icons/QuestIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';
import { ScaleIcon } from './icons/ScaleIcon';


interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  playerCharacter: PlayerCharacter | null;
  availableTabs: Tab[];
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, playerCharacter, availableTabs, onLogout }) => {
  const { t } = useTranslation();

  const alwaysAvailableTabs = [Tab.Statistics, Tab.Equipment, Tab.Resources, Tab.Ranking, Tab.Options, Tab.Messages];

  const menuItems = [
    { id: Tab.Statistics, label: t('sidebar.statistics'), icon: <BarChartIcon className="h-5 w-5" /> },
    { id: Tab.Equipment, label: t('sidebar.equipment'), icon: <ShieldIcon className="h-5 w-5" /> },
    { id: Tab.Location, label: t('sidebar.location'), icon: <GlobeIcon className="h-5 w-5" /> },
    { id: Tab.Camp, label: t('sidebar.camp'), icon: <HomeIcon className="h-5 w-5" /> },
    { id: Tab.Expedition, label: t('sidebar.expedition'), icon: <MapIcon className="h-5 w-5" /> },
    { id: Tab.Quests, label: t('sidebar.quests'), icon: <QuestIcon className="h-5 w-5" /> },
    { id: Tab.Tavern, label: t('sidebar.tavern'), icon: <CoffeeIcon className="h-5 w-5" /> },
    { id: Tab.Trader, label: t('sidebar.trader'), icon: <HandshakeIcon className="h-5 w-5" /> },
    { id: Tab.Blacksmith, label: t('sidebar.blacksmith'), icon: <AnvilIcon className="h-5 w-5" /> },
    { id: Tab.Market, label: t('sidebar.market'), icon: <ScaleIcon className="h-5 w-5" /> },
    { id: Tab.Resources, label: t('sidebar.resources'), icon: <CoinsIcon className="h-5 w-5" /> },
    { id: Tab.Ranking, label: t('sidebar.ranking'), icon: <TrophyIcon className="h-5 w-5" /> },
    { id: Tab.Messages, label: t('sidebar.messages'), icon: <MailIcon className="h-5 w-5" /> },
  ];

  const isDisabled = (tab: Tab) => !alwaysAvailableTabs.includes(tab) && !availableTabs.includes(tab);

  return (
    <aside className="w-56 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 flex-shrink-0 flex flex-col">
      <div className="p-6 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-white tracking-wider mb-2">
          {t('sidebar.title')}
        </h1>
        {playerCharacter && (
          <div className="text-center bg-slate-900/50 rounded-lg p-3">
            <p className="font-semibold text-lg text-indigo-400">{playerCharacter.name}</p>
            <p className="text-sm text-gray-400">{t(`race.${playerCharacter.race}`)} - {t('statistics.level')} {playerCharacter.level}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            disabled={isDisabled(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ease-in-out
              ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-slate-700 hover:text-white'}
              ${isDisabled(item.id) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700/50">
        <button 
            onClick={() => setActiveTab(Tab.Options)}
            className={`w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ease-in-out
            ${activeTab === Tab.Options ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-slate-700 hover:text-white'}`}
        >
          <SettingsIcon className="h-5 w-5" />
          <span>{t('sidebar.options')}</span>
        </button>
         <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ease-in-out text-gray-400 hover:bg-red-800/50 hover:text-white mt-2"
        >
          <LogoutIcon className="h-5 w-5" />
          <span>{t('sidebar.logout')}</span>
        </button>
      </div>
    </aside>
  );
};
