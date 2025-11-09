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
import { SparklesIcon } from './icons/SparklesIcon';
import { ScaleIcon } from './icons/ScaleIcon';

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
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, playerCharacter, currentLocation, onLogout, hasUnreadMessages, hasNewTavernMessages, onOpenNews, hasNewNews }) => {
  const { t } = useTranslation();

  const allMenuItems = [
    { id: Tab.Statistics, label: t('sidebar.statistics'), icon: <BarChartIcon className="h-5 w-5" />, alwaysVisible: true },
    { id: Tab.Equipment, label: t('sidebar.equipment'), icon: <ShieldIcon className="h-5 w-5" />, alwaysVisible: true },
    { id: Tab.Expedition, label: t('sidebar.expedition'), icon: <MapIcon className="h-5 w-5" /> },
    { id: Tab.Quests, label: t('sidebar.quests'), icon: <QuestIcon className="h-5 w-5" /> },
    { id: Tab.Tavern, label: t('sidebar.tavern'), icon: <MessageSquareIcon className="h-5 w-5" />, alwaysVisible: true, notification: hasNewTavernMessages },
    { id: Tab.Trader, label: t('sidebar.trader'), icon: <HandshakeIcon className="h-5 w-5" /> },
    { id: Tab.Blacksmith, label: t('sidebar.blacksmith'), icon: <AnvilIcon className="h-5 w-5" /> },
    { id: Tab.Market, label: t('sidebar.market'), icon: <ScaleIcon className="h-5 w-5" />, alwaysVisible: true },
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
          <div className="text-center bg-slate-900/50 rounded-lg p-3">
            <p className="font-semibold text-lg text-indigo-400">{playerCharacter.name}</p>
            <p className="text-sm text-gray-400 mb-2">{t(`race.${playerCharacter.race}`)} - {t('statistics.level')} {playerCharacter.level}</p>
             <div title={`HP: ${Math.floor(playerCharacter.stats.currentHealth)} / ${playerCharacter.stats.maxHealth}`} className="w-full bg-slate-700 rounded-full h-2 border border-slate-600">
                <div 
                    className="bg-red-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${(playerCharacter.stats.currentHealth / playerCharacter.stats.maxHealth) * 100}%` }}
                ></div>
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

          const isRestrictedByResting = isResting && [Tab.Expedition, Tab.Location, Tab.Trader, Tab.Blacksmith, Tab.Quests].includes(item.id);
          const isRestrictedByTraveling = isTraveling && [Tab.Expedition, Tab.Camp, Tab.Trader, Tab.Blacksmith, Tab.Quests].includes(item.id);
          const isRestrictedByExpedition = isExpeditionActive && ![Tab.Tavern, Tab.Resources, Tab.Messages].includes(item.id);

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

interface NewsModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
}

const parseNewsContent = (content: string): string => {
    if (!content) return '';

    let html = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Links: [text](url)
    html = html.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">$1</a>');
    
    // Color: [color=#hex or colorname]text[/color]
    html = html.replace(/\[color=([#\w\d]{3,7})\](.*?)\[\/color\]/gs, (match, color, text) => {
        if (/^#([0-9a-f]{3}){1,2}$/i.test(color) || /^[a-z]+$/i.test(color)) {
            return `<span style="color: ${color};">${text}</span>`;
        }
        return text;
    });

    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>');
    
    // Italic: *text*
    html = html.replace(/\*(.*?)\*/gs, '<em>$1</em>');

    // Lists: - item
    html = html.replace(/^\s*-\s(.*)/gm, '<div class="flex items-start"><span class="mr-2 mt-1">•</span><span class="flex-1">$1</span></div>');

    return html.replace(/\n/g, '<br />');
};


export const NewsModal: React.FC<NewsModalProps> = ({ isOpen, onClose, content }) => {
    const { t } = useTranslation();

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                <h2 className="text-3xl font-bold mb-6 text-indigo-400 text-center">{t('news.title')}</h2>
                <div 
                    className="bg-slate-900/50 p-6 rounded-lg max-h-[60vh] overflow-y-auto text-gray-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: parseNewsContent(content) }}
                >
                </div>
                <div className="text-center mt-6">
                    <button
                        onClick={onClose}
                        className="px-8 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    >
                        {t('news.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
