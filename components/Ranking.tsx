




import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, RankingPlayer } from '../types';
import { TrophyIcon } from './icons/TrophyIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon';
import { MailIcon } from './icons/MailIcon';

interface RankingProps {
  ranking: RankingPlayer[];
  currentPlayer: PlayerCharacter;
  onRefresh: () => void;
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

export const Ranking: React.FC<RankingProps> = ({ ranking, currentPlayer, onRefresh, isLoading, onAttack, onComposeMessage }) => {
  const { t } = useTranslation();
  
  const getAttackDisabledReason = (target: RankingPlayer): string | null => {
      if (target.id === currentPlayer.id) return t('pvp.cannotAttackSelf');
      if (Math.abs(target.level - currentPlayer.level) > 3) return t('pvp.levelRangeError');
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
      <div className="bg-slate-900/40 p-6 rounded-xl">
         <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold text-indigo-400 flex items-center">
                <TrophyIcon className="h-5 w-5 mr-2 text-amber-400"/> {t('ranking.header')}
             </h3>
             <button 
                onClick={onRefresh} 
                disabled={isLoading}
                className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors duration-200 disabled:opacity-50"
             >
                {isLoading ? t('ranking.refreshing') : t('ranking.refresh')}
             </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                <th scope="col" className="p-4 w-16 text-center">{t('ranking.rank')}</th>
                <th scope="col" className="p-4">{t('ranking.player')}</th>
                <th scope="col" className="p-4 text-center">{t('ranking.level')}</th>
                <th scope="col" className="p-4 text-center">{t('ranking.wins')}</th>
                <th scope="col" className="p-4 text-center">{t('ranking.losses')}</th>
                <th scope="col" className="p-4 text-right">{t('ranking.experience')}</th>
                <th scope="col" className="p-4 text-center">{t('ranking.action')}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((player, index) => {
                const isCurrentUser = player.id === currentPlayer.id;
                const disabledReason = getAttackDisabledReason(player);
                const isProtected = player.pvpProtectionUntil > Date.now();
                
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
                        <div className="flex flex-col">
                            <div className="flex items-center">
                                <span>{player.name}</span>
                                {!isCurrentUser && (
                                    <button
                                        onClick={() => onComposeMessage(player.name)}
                                        className="ml-2 text-gray-400 hover:text-white transition-colors"
                                        title={t('messages.compose.title')}
                                    >
                                        <MailIcon className="h-4 w-4" />
                                    </button>
                                )}
                                {isProtected && !isCurrentUser && <CooldownTimer until={player.pvpProtectionUntil} />}
                            </div>
                            <span className="text-sm text-gray-400">{t(`race.${player.race}`)}</span>
                        </div>
                    </td>
                    <td className="p-4 text-lg font-mono text-center text-gray-300">
                      {player.level}
                    </td>
                    <td className="p-4 text-lg font-mono text-center text-green-400">
                        {player.pvpWins || 0}
                    </td>
                    <td className="p-4 text-lg font-mono text-center text-red-400">
                        {player.pvpLosses || 0}
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
      </div>
    </ContentPanel>
  );
};
