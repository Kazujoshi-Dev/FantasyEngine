
import React from 'react';
import { Tab, PlayerCharacter, Location, GameSettings } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

// Import individual icons
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
import { CrossIcon } from './icons/CrossIcon';
import { GlobeIcon } from './icons/GlobeIcon';

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
    onLogout,
    hasUnreadMessages,
    hasNewTavernMessages,
    onOpenNews,
    hasNewNews,
    settings
}) => {
    const { t } = useTranslation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    // Locking logic for Tower Run
    const isLocked = !!playerCharacter.activeTowerRun;

    const menuItems: { tab: Tab; icon: any; label: string; notification?: boolean }[] = [
        { tab: Tab.Statistics, icon: IconShield, label: t('sidebar.statistics') },
        { tab: Tab.Equipment, icon: IconSwords, label: t('sidebar.equipment') },
        { tab: Tab.Expedition, icon: IconMap, label: t('sidebar.expedition') },
        { tab: Tab.Tower, icon: IconMap, label: 'Wieża Mroku' },
        { tab: Tab.Hunting, icon: CrossIcon, label: t('sidebar.hunting') },
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

    const defaultOrder = [
        Tab.Statistics, Tab.Equipment, Tab.Expedition, Tab.Tower, Tab.Hunting, Tab.Quests,
        Tab.Camp, Tab.Location, Tab.Guild, Tab.University, Tab.Resources,
        Tab.Ranking, Tab.Messages, Tab.Tavern, Tab.Market, Tab.Trader,
        Tab.Blacksmith, Tab.Options, Tab.Admin
    ];

    const sortedMenuItems = [...menuItems].sort((a, b) => {
        const order = settings?.sidebarOrder || defaultOrder;
        const indexA = order.indexOf(a.tab);
        const indexB = order.indexOf(b.tab);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    const healthPercent = Math.max(0, Math.min(100, (playerCharacter.stats.currentHealth / playerCharacter.stats.maxHealth) * 100));

    return (
        <>
            <button 
                className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-slate-800 rounded-md text-white border border-slate-600 shadow-xl"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                {isMobileMenuOpen ? "✕" : "☰"}
            </button>

            <div 
                className={`
                    fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[#121826] border-r border-fantasy-gold/20 flex flex-col transition-transform duration-500 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    shadow-[5px_0_30px_rgba(0,0,0,0.5)]
                `}
            >
                <div className="relative z-10 flex flex-col h-full">
                    {/* Header: Game Identity */}
                    <div className="p-8 border-b border-white/5 flex flex-col items-center">
                        <div className="relative mb-4">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-150"></div>
                            {settings?.logoUrl ? (
                                <img src={settings.logoUrl} alt="Logo" className="w-32 h-auto relative object-contain drop-shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                            ) : (
                                <div className="h-16 w-16 bg-gradient-to-br from-indigo-600 to-slate-900 rounded-2xl flex items-center justify-center border border-fantasy-gold/30 shadow-2xl relative rotate-3 group-hover:rotate-0 transition-transform">
                                    <IconShield className="text-fantasy-gold w-10 h-10" />
                                </div>
                            )}
                        </div>
                        <h1 className="text-2xl fantasy-header font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 text-center drop-shadow-md">
                            {t('sidebar.title')}
                        </h1>
                        
                        {/* Compact Character Stats Card */}
                        <div className="mt-6 w-full bg-[#1a2133] rounded-2xl p-4 border border-white/5 shadow-inner">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-medieval text-fantasy-amber text-xs tracking-widest">Lvl {playerCharacter.level}</span>
                                <span className="text-white font-bold truncate max-w-[140px] font-medieval" title={playerCharacter.name}>{playerCharacter.name}</span>
                            </div>
                            
                            {/* Health Bar */}
                            <div className="mb-2 relative w-full h-4 bg-slate-950 rounded-lg overflow-hidden border border-white/5 shadow-lg group">
                                <div 
                                    className="h-full bg-gradient-to-r from-red-900 via-red-600 to-red-500 transition-all duration-1000 ease-out" 
                                    style={{ width: `${healthPercent}%` }}
                                >
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-md">
                                    {Math.ceil(playerCharacter.stats.currentHealth)} / {playerCharacter.stats.maxHealth}
                                </div>
                            </div>

                            {/* Currency & Energy Row */}
                            <div className="flex justify-between mt-3 text-xs font-mono pt-3 border-t border-white/5">
                                <span className="flex items-center text-fantasy-amber font-bold">
                                    <IconCoins className="h-3.5 w-3.5 mr-1.5" /> {playerCharacter.resources.gold.toLocaleString()}
                                </span>
                                <span className="flex items-center text-sky-400 font-bold">
                                    <IconBolt className="h-3.5 w-3.5 mr-1.5" /> {playerCharacter.stats.currentEnergy}/{playerCharacter.stats.maxEnergy}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {isLocked && (
                        <div className="p-3 bg-red-950/40 border-y border-red-500/20 text-center">
                            <span className="text-[10px] text-red-400 font-black uppercase animate-pulse tracking-widest font-medieval">
                                Klątwa Wieży Mroku Aktywna
                            </span>
                        </div>
                    )}

                    {/* Navigation Scrollable */}
                    <nav className="flex-1 overflow-y-auto py-6 space-y-1.5 px-4 custom-scrollbar">
                        {sortedMenuItems.map((item) => {
                            const Icon = item.icon || IconShield;
                            const isTowerTab = item.tab === Tab.Tower;
                            const isOptionsTab = item.tab === Tab.Options;
                            const isDisabled = isLocked && !isTowerTab && !isOptionsTab;
                            const isActive = activeTab === item.tab;

                            return (
                                <button
                                    key={item.tab}
                                    onClick={() => { 
                                        if (!isDisabled) {
                                            setActiveTab(item.tab); 
                                            setIsMobileMenuOpen(false); 
                                        }
                                    }}
                                    disabled={isDisabled}
                                    className={`
                                        group w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300
                                        ${isActive 
                                            ? 'bg-indigo-600/20 text-white border border-fantasy-gold/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
                                            : isDisabled 
                                                ? 'text-gray-700 cursor-not-allowed grayscale'
                                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                >
                                    <div className="flex items-center">
                                        <div className={`mr-3 p-1.5 rounded-lg transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800/50 text-gray-500 group-hover:text-gray-300'}`}>
                                            <Icon className="h-4.5 w-4.5" />
                                        </div>
                                        <span className={isActive ? 'font-medieval' : ''}>{item.label}</span>
                                    </div>
                                    {item.notification && !isDisabled && (
                                        <span className="h-2 w-2 rounded-full bg-fantasy-amber shadow-[0_0_8px_#fbbf24] animate-pulse"></span>
                                    )}
                                    {isActive && (
                                        <div className="absolute left-0 w-1 h-6 bg-fantasy-gold rounded-r-full"></div>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-white/5 bg-[#0e121d] space-y-3">
                        <button
                            onClick={onOpenNews}
                            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-slate-800 hover:text-white transition-all border border-white/5 group relative"
                        >
                            <span className="group-hover:scale-110 transition-transform">{t('sidebar.news')}</span>
                            {hasNewNews && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 ring-4 ring-[#0e121d] animate-bounce"></span>}
                        </button>
                        
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-red-400/70 hover:bg-red-900/20 hover:text-red-400 transition-all border border-red-500/10 group"
                        >
                            <LogoutIcon className="h-4 w-4 mr-2 group-hover:translate-x-1 transition-transform" />
                            {t('sidebar.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// Fix for missing NewsModal exported member referenced in ModalManager.tsx
export const NewsModal: React.FC<{ isOpen: boolean; onClose: () => void; content: string }> = ({ isOpen, onClose, content }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in" onClick={onClose}>
            <div className="bg-[#1a2133] border border-white/10 rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-3xl font-black fantasy-header text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-6 border-b border-white/5 pb-4">{t('news.title')}</h2>
                <div className="flex-grow overflow-y-auto pr-4 custom-scrollbar text-gray-300 whitespace-pre-wrap leading-relaxed italic font-serif">
                    {content || "W kronikach nie odnotowano jeszcze nowych wieści..."}
                </div>
                <div className="mt-8 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        {t('news.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
