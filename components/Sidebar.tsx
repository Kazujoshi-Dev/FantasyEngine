import React from 'react';
import { Tab, PlayerCharacter, Location, GameSettings } from '../types';
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
import { SparklesIcon } from './icons/SparklesIcon';
import { ScaleIcon } from './icons/ScaleIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { UsersIcon } from './icons/UsersIcon';

export const NewsModal: React.FC<{ isOpen: boolean; onClose: () => void; content: string }> = ({ isOpen, onClose, content }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-2xl w-full relative" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    ✕
                </button>
                <h2 className="text-2xl font-bold text-indigo-400 mb-4">{t('news.title')}</h2>
                <div className="prose prose-invert max-w-none max-h-[60vh] overflow-y-auto">
                    <p className="whitespace-pre-wrap text-gray-300">{content}</p>
                </div>
                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        {t('news.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  playerCharacter: PlayerCharacter | null;
  currentLocation: Location | undefined;
  onLogout: () => void;
  hasUnreadMessages: boolean;
  hasNewTavernMessages: boolean;
  onOpenNews: () => void;
  hasNewNews: boolean;
  settings?: GameSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, playerCharacter, currentLocation, onLogout, hasUnreadMessages, hasNewTavernMessages, onOpenNews, hasNewNews, settings }) => {
  const { t } = useTranslation();

  const menuItemsConfig: Record<Tab, { label: string; icon: React.ReactElement; alwaysVisible?: boolean; notification?: boolean }> = {
      [Tab.Statistics]: { label: t('sidebar.statistics'), icon: <BarChartIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.Equipment]: { label: t('sidebar.equipment'), icon: <ShieldIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.Expedition]: { label: t('sidebar.expedition'), icon: <MapIcon className="h-5 w-5" /> },
      [Tab.Quests]: { label: t('sidebar.quests'), icon: <QuestIcon className="h-5 w-5" /> },
      [Tab.Hunting]: { label: t('sidebar.hunting'), icon: <CrossedSwordsIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.Tavern]: { label: t('sidebar.tavern'), icon: <MessageSquareIcon className="h-5 w-5" />, alwaysVisible: true, notification: hasNewTavernMessages },
      [Tab.Guild]: { label: t('sidebar.guild'), icon: <UsersIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.Trader]: { label: t('sidebar.trader'), icon: <HandshakeIcon className="h-5 w-5" /> },
      [Tab.Blacksmith]: { label: t('sidebar.blacksmith'), icon: <AnvilIcon className="h-5 w-5" /> },
      [Tab.Market]: { label: t('sidebar.market'), icon: <ScaleIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.Camp]: { label: t('sidebar.camp'), icon: <HomeIcon className="h-5 w-5" /> },
      [Tab.Location]: { label: t('sidebar.location'), icon: <GlobeIcon className="h-5 w-5" /> },
      [Tab.Resources]: { label: t('sidebar.resources'), icon: <CoinsIcon className="h-5 w-5" /> },
      [Tab.Ranking]: { label: t('sidebar.ranking'), icon: <TrophyIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.University]: { label: t('sidebar.university'), icon: <BookOpenIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.Messages]: { label: t('sidebar.messages'), icon: <MailIcon className="h-5 w-5" />, alwaysVisible: true, notification: hasUnreadMessages },
      [Tab.Options]: { label: t('sidebar.options'), icon: <SettingsIcon className="h-5 w-5" />, alwaysVisible: true },
      [Tab.Admin]: { label: t('sidebar.admin'), icon: <SettingsIcon className="h-5 w-5" /> },
  };

  const defaultOrder: Tab[] = [
      Tab.Statistics, Tab.Equipment, Tab.Expedition, Tab.Quests, Tab.Hunting, Tab.Tavern, Tab.Guild, Tab.Trader,
      Tab.Blacksmith, Tab.Market, Tab.Camp, Tab.Location, Tab.Resources, Tab.Ranking,
      Tab.University, Tab.Messages, Tab.Options, Tab.Admin
  ];

  // Determine the base order from settings or default
  const savedOrder = settings?.sidebarOrder && settings.sidebarOrder.length > 0 ? settings.sidebarOrder : defaultOrder;
  
  // Clone to avoid mutation of props/state
  const order = [...savedOrder];

  // ROBUSTNESS FIX: Ensure ALL tabs from defaultOrder are present in the final list.
  // This fixes the issue where a database save with missing tabs (e.g. from older version or corruption)
  // causes users to lose access to features like Guilds, Hunting or University.
  defaultOrder.forEach(tab => {
      if (!order.includes(tab)) {
          // If Tab.Admin is in the list, insert new tabs BEFORE it. Otherwise push to end.
          const adminIndex = order.indexOf(Tab.Admin);
          if (adminIndex !== -1) {
              order.splice(adminIndex, 0, tab);
          } else {
              order.push(tab);
          }
      }
  });

  const visibleMenuItems = order
    .filter(tabId => menuItemsConfig[tabId]) 
    .map(tabId => ({ id: tabId, ...menuItemsConfig[tabId] }))
    .filter(item => {
        if (item.id === Tab.Admin) {
            return playerCharacter?.username === 'Kazujoshi';
        }
        return item.alwaysVisible || (currentLocation && currentLocation.availableTabs.includes(item.id));
    });

  const sidebarStyle: React.CSSProperties = settings?.sidebarBackgroundUrl
    ? {
        backgroundImage: `url(${settings.sidebarBackgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};

  return (
    <aside 
        className="w-56 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 flex-shrink-0 flex flex-col relative z-0"
        style={sidebarStyle}
    >
        {/* Overlay if image is present to ensure text readability */}
        {settings?.sidebarBackgroundUrl && (
            <div className="absolute inset-0 bg-slate-900/80 -z-10 pointer-events-none" />
        )}

      <div className="p-6 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-white tracking-wider mb-2">
          Kroniki Mroku
        </h1>
        {playerCharacter && (
          <div className="text-center bg-slate-900/50 rounded-lg p-3 relative mt-6">
            {playerCharacter.avatarUrl && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-2 border-slate-600 bg-slate-800 overflow-hidden shadow-lg">
                    <img src={playerCharacter.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                </div>
            )}
            <div className={playerCharacter.avatarUrl ? "mt-8" : ""}>
                <p className="font-semibold text-lg text-indigo-400">{playerCharacter.name}</p>
                <p className="text-sm text-gray-400 mb-2">{t(`race.${playerCharacter.race}`)} - {t('statistics.level')} {playerCharacter.level}</p>
                <div title={`HP: ${Math.floor(playerCharacter.stats.currentHealth)} / ${playerCharacter.stats.maxHealth}`} className="w-full bg-slate-700 rounded-full h-2 border border-slate-600">
                    <div 
                        className="bg-red-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(playerCharacter.stats.currentHealth / playerCharacter.stats.maxHealth) * 100}%` }}
                    ></div>
                </div>
                <div title={`XP: ${playerCharacter.experience} / ${playerCharacter.experienceToNextLevel}`} className="w-full bg-slate-700 rounded-full h-2 border border-slate-600 mt-1.5">
                    <div 
                        className="bg-sky-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(playerCharacter.experience / playerCharacter.experienceToNextLevel) * 100}%` }}
                    ></div>
                </div>
                <div title={t('resources.gold')} className="mt-2 flex items-center justify-center gap-2 text-amber-400">
                    <CoinsIcon className="h-4 w-4" />
                    <span className="font-mono font-semibold text-sm">
                        {playerCharacter.resources.gold.toLocaleString()}
                    </span>
                </div>
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-2">
         <button
            onClick={onOpenNews}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-left text-sm font-medium transition-all duration-200 ease-in-out relative bg-slate-700/50 text-amber-300 hover:bg-slate-700 hover:text-amber-200"
          >
            <SparklesIcon className="h-5 w-5" />
            <span>{t('sidebar.news')}</span>
             {hasNewNews && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-2 border-t border-slate-700/50">
        {visibleMenuItems.map((item) => {
          const isResting = playerCharacter?.isResting;
          const isTraveling = !!playerCharacter?.activeTravel;
          const isExpeditionActive = !!playerCharacter?.activeExpedition;

          const isRestrictedByResting = isResting && [Tab.Expedition, Tab.Location, Tab.Trader, Tab.Blacksmith, Tab.Quests, Tab.Hunting].includes(item.id);
          const isRestrictedByTraveling = isTraveling && [Tab.Expedition, Tab.Camp, Tab.Trader, Tab.Blacksmith, Tab.Quests, Tab.Hunting].includes(item.id);
          const isRestrictedByExpedition = isExpeditionActive && ![Tab.Tavern, Tab.Resources, Tab.Messages, Tab.Expedition].includes(item.id);

          const isRestricted = isRestrictedByResting || isRestrictedByTraveling || isRestrictedByExpedition;

          let restrictionTitle = "";
          if (isRestricted) {
              if (isRestrictedByExpedition) {
                  restrictionTitle = t('sidebar.actionBlockedExpeditionWarning');
              } else {
                  restrictionTitle = t('sidebar.actionBlockedWarning');
              }
          }
            
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
              title={restrictionTitle}
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
