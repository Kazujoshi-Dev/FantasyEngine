
import React, { useMemo } from 'react';
import { Tab, PlayerCharacter, Location, GameSettings } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

// Icons
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
import { BookOpenIcon as IconBook } from './icons/BookOpenIcon';
import { CrossIcon } from './icons/CrossIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';

interface SidebarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    playerCharacter: PlayerCharacter;
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

    const isLocked = !!playerCharacter.activeTowerRun;

    const menuItems = useMemo(() => [
        { tab: Tab.Statistics, icon: IconShield, label: t('sidebar.statistics') },
        { tab: Tab.Equipment, icon: IconSwords, label: t('sidebar.equipment') },
        { tab: Tab.Expedition, icon: IconMap, label: t('sidebar.expedition') },
        { tab: Tab.Tower, icon: IconMap, label: 'Wieża Mroku' },
        { tab: Tab.Hunting, icon: IconShield, label: t('sidebar.hunting') }, // Changed from CrossIcon to IconShield as a generic sword/shield theme
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
        { tab: Tab.Admin, icon: IconSettings, label: t('sidebar.admin') },
    ], [t, hasUnreadMessages, hasNewTavernMessages]);

    const visibleMenuItems = useMemo(() => {
        const isAdmin = playerCharacter.name === 'Kazujoshi';
        return menuItems.filter(item => {
            if (item.tab === Tab.Admin && !isAdmin) {
                return false;
            }
            return true;
        });
    }, [menuItems, playerCharacter.name]);

    const healthPercent = Math.max(0, Math.min(100, (playerCharacter.stats.currentHealth / playerCharacter.stats.maxHealth) * 100));
    const expPercent = Math.max(0, Math.min(100, (playerCharacter.experience / playerCharacter.experienceToNextLevel) * 100));

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
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Character Hub Header */}
                    <div className="p-6 border-b border-white/5 bg-[#0e121d]">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="relative">
                                <div className="h-14 w-14 bg-gradient-to-br from-indigo-600 to-slate-900 rounded-xl flex items-center justify-center border border-fantasy-gold/30 shadow-2xl overflow-hidden">
                                    {playerCharacter.avatarUrl ? (
                                        <img src={playerCharacter.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <IconShield className="text-fantasy-gold w-8 h-8" />
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-fantasy-gold text-slate-950 text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-[#0e121d]">
                                    {playerCharacter.level}
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg fantasy-header font-black text-white truncate leading-tight">
                                    {playerCharacter.name}
                                </h1>
                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-tighter">
                                    {t(`race.${playerCharacter.race}`)} {playerCharacter.characterClass && `| ${t(`class.${playerCharacter.characterClass}`)}`}
                                </p>
                            </div>
                        </div>

                        {/* Status Bars (HP & EXP) */}
                        <div className="space-y-4 mb-4">
                            {/* Health Bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter text-gray-400">
                                    <span className="text-red-400/80">Punkty Życia</span>
                                    <span>{Math.ceil(playerCharacter.stats.currentHealth)} / {playerCharacter.stats.maxHealth}</span>
                                </div>
                                <div className="relative w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-red-900 via-red-600 to-red-500 transition-all duration-1000 ease-out" 
                                        style={{ width: `${healthPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* Experience Bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter text-gray-400">
                                    <span className="text-sky-400/80">Doświadczenie</span>
                                    <span>{playerCharacter.experience.toLocaleString()} / {playerCharacter.experienceToNextLevel.toLocaleString()}</span>
                                </div>
                                <div className="relative w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-sky-900 via-sky-600 to-sky-400 transition-all duration-1000 ease-out" 
                                        style={{ width: `${expPercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Currency Chips */}
                        <div className="flex gap-2">
                            <div className="flex-1 bg-slate-950/50 rounded-lg p-2 border border-white/5 flex items-center justify-center gap-2">
                                <IconCoins className="h-3 w-3 text-fantasy-gold" />
                                <span className="font-mono text-xs font-bold text-fantasy-gold">{playerCharacter.resources.gold.toLocaleString()}</span>
                            </div>
                            <div className="flex-1 bg-slate-950/50 rounded-lg p-2 border border-white/5 flex items-center justify-center gap-2">
                                <IconBolt className="h-3 w-3 text-sky-400" />
                                <span className="font-mono text-xs font-bold text-sky-400">{playerCharacter.stats.currentEnergy}</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Scrollable */}
                    <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3 custom-scrollbar">
                        {visibleMenuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.tab;
                            const isDisabled = isLocked && item.tab !== Tab.Tower && item.tab !== Tab.Options;

                            return (
                                <button
                                    key={item.tab}
                                    disabled={isDisabled}
                                    onClick={() => { setActiveTab(item.tab); setIsMobileMenuOpen(false); }}
                                    className={`
                                        group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                                        ${isActive 
                                            ? 'bg-indigo-600/20 text-white border border-fantasy-gold/20 shadow-[0_0_15px_rgba(212,175,55,0.05)]' 
                                            : isDisabled 
                                                ? 'text-gray-700 cursor-not-allowed grayscale opacity-50'
                                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-md transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800/50 text-gray-500 group-hover:text-gray-300'}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <span className="font-medieval">{item.label}</span>
                                    </div>
                                    {item.notification && !isDisabled && (
                                        <span className="h-2 w-2 rounded-full bg-fantasy-amber shadow-[0_0_8px_#fbbf24] animate-pulse"></span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-white/5 bg-[#0e121d] flex flex-col gap-2">
                        <button
                            onClick={onOpenNews}
                            className="flex-1 flex items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-slate-800 hover:text-white transition-all border border-white/5 relative"
                        >
                            <span>{t('sidebar.news')}</span>
                            {hasNewNews && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-bounce"></span>}
                        </button>
                        
                        <a
                            href={settings?.buyCoffeeUrl || "https://suppi.pl/kazujoshi-dev"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-amber-300/70 hover:bg-amber-900/20 hover:text-amber-300 transition-all border border-amber-500/20 bg-amber-950/10 group"
                        >
                            <CoffeeIcon className="h-3 w-3 mr-1.5 group-hover:animate-bounce" />
                            {t('sidebar.buyCoffee')}
                        </a>

                        <button
                            onClick={onLogout}
                            className="flex-1 flex items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-400/70 hover:bg-red-900/20 hover:text-red-400 transition-all border border-red-500/10"
                        >
                            <LogoutIcon className="h-3 w-3 mr-1.5" />
                            {t('sidebar.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
