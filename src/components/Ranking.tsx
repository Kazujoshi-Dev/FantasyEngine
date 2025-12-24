
import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, RankingPlayer, GuildRankingEntry, SpyReportResult } from '../types';
import { TrophyIcon } from './icons/TrophyIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon';
import { MailIcon } from './icons/MailIcon';
import { UsersIcon } from './icons/UsersIcon';
import { EyeIcon } from './icons/EyeIcon';
import { StarIcon } from './icons/StarIcon';
import { InfoIcon } from './icons/InfoIcon';
// Added ShieldIcon import to fix missing component error
import { ShieldIcon } from './icons/ShieldIcon';
import { api } from '../api';
import { CharacterCard } from './shared/CharacterCard';
import { GuildCard } from './shared/GuildCard';
import { SpyReportModal } from './SpyReportModal';
import { useCharacter } from '@/contexts/CharacterContext';
import { calculatePvPRange } from '@/logic/stats';

interface RankingProps {
  ranking: RankingPlayer[];
  isLoading: boolean;
  onAttack: (defenderId: number) => void;
  onComposeMessage: (recipientName: string) => void;
}

const CooldownTimer: React.FC<{ until: number }> = ({ until }) => {
    const [timeLeft, setTimeLeft] = useState(until - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = until - Date.now();
            if (remaining > 0) {
                setTimeLeft(remaining);
            } else {
                setTimeLeft(0);
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [until]);

    if (timeLeft <= 0) return null;

    const minutes = Math.floor(timeLeft / 1000 / 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    return (
        <span className="flex items-center text-xs text-gray-400 ml-2">
            <ClockIcon className="h-3 w-3 mr-1" />
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </span>
    );
};

export const Ranking: React.FC<RankingProps> = ({ ranking, isLoading, onAttack, onComposeMessage }) => {
  const { character: currentPlayer, updateCharacter, gameData } = useCharacter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'PLAYERS' | 'GUILDS'>('PLAYERS');
  const [guildRanking, setGuildRanking] = useState<GuildRankingEntry[]>([]);
  const [isGuildLoading, setIsGuildLoading] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  
  const [viewingProfileName, setViewingProfileName] = useState<string | null>(null);
  const [viewingGuildId, setViewingGuildId] = useState<number | null>(null);
  const [spyReport, setSpyReport] = useState<SpyReportResult | null>(null);
  const [isSpying, setIsSpying] = useState<number | null>(null);

  const hasEspionageSkill = (currentPlayer?.learnedSkills || []).includes('espionage-mastery');

  useEffect(() => {
      if (activeTab === 'GUILDS') {
          setIsGuildLoading(true);
          api.getGuildRanking()
            .then(setGuildRanking)
            .catch(console.error)
            .finally(() => setIsGuildLoading(false));
      }
  }, [activeTab]);
  
  if (!currentPlayer) return null;

  const currentPvPRange = calculatePvPRange(currentPlayer.level);

  const handleSpy = async (targetId: number, targetLevel: number) => {
      const cost = Math.max(100, targetLevel * 50);
      if (currentPlayer.stats.currentEnergy < 5) {
          alert('Brak energii (wymagane 5).');
          return;
      }
      if (currentPlayer.resources.gold < cost) {
          alert(`Brak złota (wymagane ${cost}).`);
          return;
      }

      if (!confirm(`Czy na pewno chcesz szpiegować gracza? Koszt: 5 Energii i ${cost} Złota.`)) return;

      setIsSpying(targetId);
      try {
          const response = await api.spyOnPlayer(targetId);
          if (response.updatedCharacter) updateCharacter(response.updatedCharacter);
          if (response.result.success) {
              setSpyReport(response.result);
          } else {
              alert('Szpiegowanie nie powiodło się! Cel okazał się zbyt sprytny lub miałeś pecha.');
          }
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSpying(null);
      }
  };

  const getAttackDisabledReason = (target: RankingPlayer): string | null => {
      if (target.id === currentPlayer.id) return t('pvp.cannotAttackSelf');
      if (Math.abs(target.level - currentPlayer.level) > currentPvPRange) return `Różnica poziomów jest zbyt duża (Twój zakres to +/- ${currentPvPRange}).`;
      if (currentPlayer.stats.currentEnergy < 3) return t('pvp.notEnoughEnergy');
      const protectionEnds = new Date(target.pvpProtectionUntil).getTime();
      if (protectionEnds > Date.now()) {
          const timeLeft = Math.ceil((protectionEnds - Date.now()) / 1000 / 60);
          return t('pvp.targetProtected', { minutes: timeLeft });
      }
      return null;
  };

  return (
    <ContentPanel title={t('ranking.title')}>
      {viewingProfileName && (
          <CharacterCard 
            characterName={viewingProfileName} 
            onClose={() => setViewingProfileName(null)} 
          />
      )}
      
      {viewingGuildId && (
          <GuildCard 
            guildId={viewingGuildId} 
            onClose={() => setViewingGuildId(null)} 
          />
      )}

      {spyReport && gameData && (
          <SpyReportModal 
             report={spyReport}
             onClose={() => setSpyReport(null)}
             gameData={gameData}
          />
      )}
      
      <div className="bg-slate-900/40 p-6 rounded-xl h-[75vh] flex flex-col">
         {/* COLLAPSIBLE LEGEND */}
         <div className="mb-6 bg-slate-800/40 border border-indigo-500/20 rounded-lg overflow-hidden transition-all duration-300">
            <button 
                onClick={() => setIsLegendOpen(!isLegendOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/60 transition-colors"
            >
                <div className="flex items-center gap-2 text-indigo-300 font-bold uppercase tracking-widest text-xs">
                    <InfoIcon className="h-4 w-4" />
                    {t('ranking.legendTitle')}
                </div>
                <div className={`transform transition-transform duration-300 ${isLegendOpen ? 'rotate-180' : ''}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </button>
            
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isLegendOpen ? 'max-h-96 opacity-100 p-4 pt-0' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                    <div className="bg-slate-900/50 p-3 rounded border border-white/5">
                        <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter flex items-center gap-2 mb-1">
                            <StarIcon className="h-3 w-3" /> {t('ranking.rules.honor.title')}
                        </h5>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{t('ranking.rules.honor.desc')}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded border border-white/5">
                        <h5 className="text-[10px] font-black text-red-400 uppercase tracking-tighter flex items-center gap-2 mb-1">
                            <CrossedSwordsIcon className="h-3 w-3" /> {t('ranking.rules.pvp.title')}
                        </h5>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{t('ranking.rules.pvp.desc')}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded border border-white/5">
                        <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter flex items-center gap-2 mb-1">
                            <EyeIcon className="h-3 w-3" /> {t('ranking.rules.espionage.title')}
                        </h5>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{t('ranking.rules.espionage.desc')}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded border border-white/5">
                        <h5 className="text-[10px] font-black text-sky-400 uppercase tracking-tighter flex items-center gap-2 mb-1">
                            <ShieldIcon className="h-3 w-3" /> {t('ranking.rules.protection.title')}
                        </h5>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{t('ranking.rules.protection.desc')}</p>
                    </div>
                </div>
            </div>
         </div>

         <div className="flex justify-between items-center mb-6 flex-shrink-0">
             <div className="flex gap-4">
                 <button 
                    onClick={() => setActiveTab('PLAYERS')}
                    className={`flex items-center px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'PLAYERS' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}
                 >
                    <TrophyIcon className="h-5 w-5 mr-2"/> {t('ranking.player')}
                 </button>
                 <button 
                    onClick={() => setActiveTab('GUILDS')}
                    className={`flex items-center px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'GUILDS' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}
                 >
                    <UsersIcon className="h-5 w-5 mr-2"/> {t('sidebar.guild')}
                 </button>
             </div>
             {(isLoading || isGuildLoading) && <div className="text-sm text-gray-400">{t('ranking.refreshing')}</div>}
        </div>

        {activeTab === 'PLAYERS' && (
            <div className="overflow-auto flex-grow">
            <table className="w-full text-left">
                <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider sticky top-0 z-10">
                <tr>
                    <th scope="col" className="p-4 w-16 text-center bg-slate-900/90">{t('ranking.rank')}</th>
                    <th scope="col" className="p-4 bg-slate-900/90">{t('ranking.player')}</th>
                    <th scope="col" className="p-4 bg-slate-900/90">{t('ranking.race')}</th>
                    <th scope="col" className="p-4 bg-slate-900/90">{t('ranking.class')}</th>
                    <th scope="col" className="p-4 text-center bg-slate-900/90">{t('ranking.level')}</th>
                    <th scope="col" className="p-4 text-center bg-slate-900/90">Honor</th>
                    <th scope="col" className="p-4 text-center bg-slate-900/90">{t('ranking.wins')}</th>
                    <th scope="col" className="p-4 text-right bg-slate-900/90">{t('ranking.experience')}</th>
                    <th scope="col" className="p-4 text-center bg-slate-900/90">{t('ranking.action')}</th>
                </tr>
                </thead>
                <tbody>
                {ranking.map((player, index) => {
                    const isCurrentUser = player.id === currentPlayer.id;
                    const disabledReason = getAttackDisabledReason(player);
                    const isProtected = player.pvpProtectionUntil > Date.now();
                    const isAdmin = player.id === 1 || player.name === 'Kazujoshi';
                    
                    return (
                    <tr 
                        key={index} 
                        className={`border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors duration-200
                        ${isCurrentUser ? 'bg-indigo-900/30 ring-2 ring-indigo-500 rounded-lg' : ''}
                        `}
                    >
                        <td className="p-4 font-bold text-lg text-center text-amber-400">
                        {index + 1}
                        </td>
                        <td className="p-4 font-medium text-white">
                            <div className="flex items-center">
                                <span className={`h-2.5 w-2.5 rounded-full mr-2 flex-shrink-0 ${player.isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={player.isOnline ? 'Online' : 'Offline'}></span>
                                <span 
                                    className="cursor-pointer hover:text-indigo-400 hover:underline"
                                    onClick={() => setViewingProfileName(player.name)}
                                >
                                    {player.guildTag && <span className="text-amber-400 font-mono mr-1">[{player.guildTag}]</span>}
                                    {player.name}
                                </span>
                                {isAdmin && (
                                    <span className="ml-2 text-xs font-bold text-amber-400 bg-amber-900/50 px-2 py-0.5 rounded-full">
                                        {t('ranking.administrator')}
                                    </span>
                                )}
                                {!isCurrentUser && (
                                    <button
                                        onClick={() => onComposeMessage(player.name)}
                                        className="ml-2 text-gray-400 hover:text-white transition-colors"
                                        title={t('messages.compose.title')}
                                    >
                                        <MailIcon className="h-4 w-4" />
                                    </button>
                                )}
                                {hasEspionageSkill && !isCurrentUser && (
                                     <button
                                        onClick={() => handleSpy(player.id, player.level)}
                                        disabled={isSpying === player.id}
                                        className="ml-2 text-gray-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
                                        title={`Szpieguj (Koszt: ${Math.max(100, player.level * 50)} złota)`}
                                    >
                                        <EyeIcon className="h-4 w-4" />
                                    </button>
                                )}
                                {isProtected && !isCurrentUser && <CooldownTimer until={player.pvpProtectionUntil} />}
                            </div>
                        </td>
                        <td className="p-4 text-gray-300">
                        {t(`race.${player.race}`)}
                        </td>
                        <td className="p-4 text-gray-300">
                        {player.characterClass ? t(`class.${player.characterClass}`) : '-'}
                        </td>
                        <td className="p-4 text-lg font-mono text-center text-gray-300">
                        {player.level}
                        </td>
                        <td className={`p-4 text-lg font-mono text-center font-bold ${player.honor > 0 ? 'text-indigo-400' : player.honor < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {player.honor > 0 ? `+${player.honor}` : player.honor}
                        </td>
                        <td className="p-4 text-lg font-mono text-center text-green-400">
                            {player.pvpWins || 0}
                        </td>
                        <td className="p-4 text-lg font-mono text-right text-sky-400">
                        {player.experience.toLocaleString()}
                        </td>
                        <td className="p-4 text-center">
                            <button
                                onClick={() => onAttack(player.id)}
                                disabled={!!disabledReason}
                                title={disabledReason || ''}
                                className="px-3 py-1.5 rounded-md bg-red-800/70 hover:bg-red-700 text-white font-semibold text-sm transition-colors duration-200 flex items-center justify-center mx-auto disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-gray-400"
                            >
                                <CrossedSwordsIcon className="h-4 w-4 mr-1"/>
                                <span className="mr-1">{t('ranking.attack')}</span>
                                <BoltIcon className="h-4 w-4 text-sky-400"/>
                                <span className="font-bold">3</span>
                            </button>
                        </td>
                    </tr>
                    )
                })}
                </tbody>
            </table>
            {ranking.length === 0 && !isLoading && (
                <p className="text-center text-gray-500 py-8">{t('ranking.noPlayers')}</p>
            )}
            </div>
        )}

        {activeTab === 'GUILDS' && (
            <div className="overflow-auto flex-grow">
            <table className="w-full text-left">
                <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider sticky top-0 z-10">
                <tr>
                    <th scope="col" className="p-4 w-16 text-center bg-slate-900/90">{t('ranking.rank')}</th>
                    <th scope="col" className="p-4 bg-slate-900/90">Gildia</th>
                    <th scope="col" className="p-4 text-center bg-slate-900/90">Członków</th>
                    <th scope="col" className="p-4 text-right bg-slate-900/90">Suma Poziomów (Punkty)</th>
                </tr>
                </thead>
                <tbody>
                {guildRanking.map((guild, index) => (
                    <tr 
                        key={guild.id} 
                        className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors duration-200"
                    >
                        <td className="p-4 font-bold text-lg text-center text-amber-400">
                        {index + 1}
                        </td>
                        <td className="p-4 font-medium text-white">
                            <span 
                                className="cursor-pointer hover:text-indigo-400 hover:underline flex items-center"
                                onClick={() => setViewingGuildId(guild.id)}
                            >
                                <span className="text-amber-400 font-mono mr-2">[{guild.tag}]</span>
                                {guild.name}
                            </span>
                        </td>
                        <td className="p-4 text-center text-gray-300">
                            {guild.memberCount}
                        </td>
                        <td className="p-4 text-lg font-mono text-right text-sky-400">
                            {guild.totalLevel}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
            {guildRanking.length === 0 && !isGuildLoading && (
                <p className="text-center text-gray-500 py-8">Brak gildii w rankingu.</p>
            )}
            </div>
        )}
      </div>
    </ContentPanel>
  );
};
