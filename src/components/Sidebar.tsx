
import React from 'react';
import { Tab, PlayerCharacter, Location, GameSettings } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { 
    CoinsIcon, BoltIcon, SwordsIcon, ShieldIcon, MapIcon, HomeIcon, 
    TrophyIcon, MailIcon, HandshakeIcon, AnvilIcon, MessageSquareIcon, 
    ScaleIcon, SettingsIcon, LogOutIcon, SparklesIcon, SkullIcon,
    UsersIcon, StarIcon, BookOpenIcon, MenuIcon, XIcon, GlobeIcon
} from './icons/AllIcons'; // Zakładam, że ikony mogą być importowane pojedynczo lub stworzę plik pomocniczy, tu użyję inline importów jeśli trzeba, ale dla czystości zakładam istnienie plików

// Import individual icons if AllIcons doesn't exist (most safe approach based on provided files)
import { CoinsIcon as IconCoins } from './icons/CoinsIcon';
import { BoltIcon as IconBolt } from './icons/BoltIcon';
import { SwordsIcon as IconSwords } from './icons/SwordsIcon';
import { ShieldIcon as IconShield } from './icons/ShieldIcon';
import { MapIcon as IconMap } from './icons/MapIcon';
import { HomeIcon as IconHome } from './icons/HomeIcon';
import { TrophyIcon as IconTrophy } from './icons/TrophyIcon';
import { MailIcon as IconMail } from './icons/MailIcon';
import { HandshakeIcon as IconHandshake } from './icons/HandshakeIcon';
import { AnvilIcon as IconAnvil } from './icons/AnvilIcon';
import { MessageSquareIcon as IconMessage } from './icons/MessageSquareIcon';
import { ScaleIcon as IconScale } from './icons/ScaleIcon';
import { SettingsIcon as IconSettings } from './icons/SettingsIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { SparklesIcon as IconSparkles } from './icons/SparklesIcon';
import { QuestIcon } from './icons/QuestIcon';
import { UsersIcon as IconUsers } from './icons/UsersIcon';
import { InfoIcon } from './icons/InfoIcon';
import { BookOpenIcon as IconBook } from './icons/BookOpenIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';
import { CrossIcon } from './icons/CrossIcon'; // Placeholder if needed

interface SidebarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    playerCharacter: PlayerCharacter;
    currentLocation?: Location;
    onLogout: () => void;
    hasUnreadMessages: boolean;
    hasNewTavernMessages: boolean;
    onOpenNews: () => void;
    hasNewNews: boolean;
    settings?: GameSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    setActiveTab,
    playerCharacter,
    currentLocation,
    onLogout,
    hasUnreadMessages,
    hasNewTavernMessages,
    onOpenNews,
    hasNewNews,
    settings
}) => {
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const menuItems = [
        { tab: Tab.Statistics, icon: IconShield, label: t('sidebar.statistics') },
        { tab: Tab.Equipment, icon: IconSwords, label: t('sidebar.equipment') },
        { tab: Tab.Expedition, icon: IconMap, label: t('sidebar.expedition') },
        { tab: Tab.Hunting, icon: CrossIcon, label: t('sidebar.hunting') }, // Use CrossIcon or similar for hunting
        { tab: Tab.Quests, icon: QuestIcon, label: t('sidebar.quests') },
        { tab: Tab.Camp, icon: IconHome, label: t('sidebar.camp') },
        { tab: Tab.Location, icon: GlobeIcon, label: t('sidebar.location') },
        { tab: Tab.Guild, icon: IconUsers, label: t('sidebar.guild') },
        { tab: Tab.University, icon: IconBook, label: t('university.title') },
        { tab: Tab.Resources, icon: IconSparkles, label: t('sidebar.resources') },
        { tab: Tab.Ranking, icon: IconTrophy, label: t('sidebar.ranking') },
        { tab: Tab.Messages, icon: IconMail, label: t('sidebar.messages'), notification: hasUnreadMessages },
        { tab: Tab.Tavern, icon: IconMessage, label: t('sidebar.tavern'), notification: hasNewTavernMessages },
        { tab: Tab.Market, icon: IconScale, label: t('sidebar.market') },
        { tab: Tab.Trader, icon: IconHandshake, label: t('sidebar.trader') },
        { tab: Tab.Blacksmith, icon: IconAnvil, label: t('sidebar.blacksmith') },
        { tab: Tab.Options, icon: IconSettings, label: t('sidebar.options') },
    ];

    if (playerCharacter.username === 'Kazujoshi') {
        menuItems.push({ tab: Tab.Admin, icon: InfoIcon, label: t('sidebar.admin') });
    }

    // Default sorting if not provided in settings
    const defaultOrder = [
        Tab.Statistics, Tab.Equipment, Tab.Expedition, Tab.Hunting, Tab.Quests,
        Tab.Camp, Tab.Location, Tab.Guild, Tab.University, Tab.Resources,
        Tab.Ranking, Tab.Messages, Tab.Tavern, Tab.Market, Tab.Trader,
        Tab.Blacksmith, Tab.Options, Tab.Admin
    ];

    const sortedMenuItems = [...menuItems].sort((a, b) => {
        const order = settings?.sidebarOrder || defaultOrder;
        return order.indexOf(a.tab) - order.indexOf(b.tab);
    });

    const sidebarStyle = settings?.sidebarBackgroundUrl 
        ? { backgroundImage: `url(${settings.sidebarBackgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
        : {};

    return (
        <>
            {/* Mobile Toggle */}
            <button 
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-md text-white border border-slate-600"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                {isMobileMenuOpen ? "X" : "Menu"}
            </button>

            {/* Sidebar Container */}
            <div 
                className={`
                    fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-700/50 flex flex-col transition-transform duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                style={sidebarStyle}
            >
                {/* Overlay for readability if bg image exists */}
                <div className={`absolute inset-0 ${settings?.sidebarBackgroundUrl ? 'bg-slate-900/85' : ''} pointer-events-none`}></div>

                <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-700/50 flex flex-col items-center">
                        {settings?.logoUrl && (
                            <img src={settings.logoUrl} alt="Logo" className="w-32 h-auto mb-3 object-contain drop-shadow-lg" />
                        )}
                        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 text-center">
                            {t('sidebar.title')}
                        </h1>
                        <div className="mt-4 w-full bg-slate-800/80 rounded-lg p-3 border border-slate-700">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-gray-400">Lvl {playerCharacter.level}</span>
                                <span className="text-white font-bold">{playerCharacter.name}</span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className="bg-sky-500 h-full" 
                                    style={{ width: `${(playerCharacter.experience / playerCharacter.experienceToNextLevel) * 100}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between mt-2 text-xs font-mono">
                                <span className="flex items-center text-amber-400">
                                    <IconCoins className="h-3 w-3 mr-1" /> {playerCharacter.resources.gold.toLocaleString()}
                                </span>
                                <span className="flex items-center text-sky-400">
                                    <IconBolt className="h-3 w-3 mr-1" /> {playerCharacter.stats.currentEnergy}/{playerCharacter.stats.maxEnergy}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-1 px-3 custom-scrollbar">
                        {sortedMenuItems.map((item) => {
                            const Icon = item.icon || InfoIcon; // Fallback icon
                            return (
                                <button
                                    key={item.tab}
                                    onClick={() => { setActiveTab(item.tab); setIsMobileMenuOpen(false); }}
                                    className={`
                                        w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                                        ${activeTab === item.tab 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                            : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                                        }
                                    `}
                                >
                                    <div className="flex items-center">
                                        <Icon className={`h-5 w-5 mr-3 ${activeTab === item.tab ? 'text-white' : 'text-gray-500'}`} />
                                        {item.label}
                                    </div>
                                    {item.notification && (
                                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-700/50 space-y-2 bg-slate-900/50">
                        <button
                            onClick={onOpenNews}
                            className="w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-slate-800 hover:text-white transition-colors relative"
                        >
                            {t('sidebar.news')}
                            {hasNewNews && <span className="absolute top-2 right-4 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
                        </button>
                        
                        <a 
                            href="https://buymeacoffee.com/kazujoshi" 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-900/20 transition-colors gap-2"
                        >
                            <CoffeeIcon className="h-4 w-4" />
                            {t('sidebar.buyCoffee')}
                        </a>

                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                            <LogoutIcon className="h-4 w-4 mr-2" />
                            {t('sidebar.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export const NewsModal: React.FC<{ isOpen: boolean; onClose: () => void; content: string }> = ({ isOpen, onClose, content }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">{t('news.title')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        ✕
                    </button>
                </div>
                <div className="p-6 overflow-y-auto prose prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                </div>
                <div className="p-4 border-t border-slate-700 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold">
                        {t('news.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
