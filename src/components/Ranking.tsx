
import React, { useState, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { RankingPlayer, PlayerRank } from '../types';
import { TrophyIcon } from './icons/TrophyIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { CrossedSwordsIcon } from './icons/CrossedSwordsIcon';
import { MailIcon } from './icons/MailIcon';
import { UsersIcon } from './icons/UsersIcon';
import { api } from '../api';
import { CharacterCard } from './shared/CharacterCard';
import { useCharacter } from '@/contexts/CharacterContext';

export const Ranking: React.FC<{ ranking: RankingPlayer[], isLoading: boolean, onAttack: (id: number) => void, onComposeMessage: (n: string) => void }> = ({ ranking, isLoading, onAttack, onComposeMessage }) => {
  const { character: currentPlayer, gameData } = useCharacter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'PLAYERS' | 'GUILDS'>('PLAYERS');
  const [viewingProfileName, setViewingProfileName] = useState<string | null>(null);

  const getPlayerRank = (rankId?: string): PlayerRank | null => {
      if (!rankId || !gameData?.playerRanks) return null;
      return gameData.playerRanks.find(r => r.id === rankId) || null;
  };

  return (
    <ContentPanel title={t('ranking.title')}>
      {viewingProfileName && <CharacterCard characterName={viewingProfileName} onClose={() => setViewingProfileName(null)} />}
      <div className="bg-slate-900/40 p-6 rounded-xl h-[75vh] flex flex-col">
        <div className="flex gap-4 mb-6">
            <button onClick={() => setActiveTab('PLAYERS')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'PLAYERS' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}><TrophyIcon className="h-5 w-5 mr-2"/> {t('ranking.player')}</button>
            <button onClick={() => setActiveTab('GUILDS')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'GUILDS' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}><UsersIcon className="h-5 w-5 mr-2"/> {t('sidebar.guild')}</button>
        </div>

        <div className="overflow-auto flex-grow">
            <table className="w-full text-left">
                <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                        <th className="p-4 text-center">#</th>
                        <th className="p-4">Gracz</th>
                        <th className="p-4">Klasa</th>
                        <th className="p-4 text-center">Lvl</th>
                        <th className="p-4 text-right">PD</th>
                        <th className="p-4 text-center">Akcja</th>
                    </tr>
                </thead>
                <tbody>
                {ranking.map((player, index) => {
                    const rank = getPlayerRank(player.activeRankId);
                    return (
                    <tr key={player.id} className={`border-b border-slate-700/50 hover:bg-slate-800/30 ${player.id === currentPlayer?.id ? 'bg-indigo-900/20 ring-1 ring-indigo-500' : ''}`}>
                        <td className="p-4 text-center font-bold text-amber-400">{index + 1}</td>
                        <td className="p-4 font-medium text-white">
                            <div className="flex items-center gap-2">
                                {rank && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-white/5 shadow-sm" style={{ 
                                        backgroundImage: rank.backgroundImageUrl ? `url(${rank.backgroundImageUrl})` : 'none',
                                        backgroundColor: rank.backgroundImageUrl ? 'transparent' : '#312e81',
                                        backgroundSize: 'cover',
                                        color: rank.textColor,
                                        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                    }}>{rank.name}</span>
                                )}
                                <span className="cursor-pointer hover:text-indigo-400" onClick={() => setViewingProfileName(player.name)}>{player.name}</span>
                                <button onClick={() => onComposeMessage(player.name)} className="text-gray-500 hover:text-white"><MailIcon className="h-3 w-3" /></button>
                            </div>
                        </td>
                        <td className="p-4 text-gray-400">{player.characterClass ? t(`class.${player.characterClass}`) : '-'}</td>
                        <td className="p-4 text-center font-mono">{player.level}</td>
                        <td className="p-4 text-right font-mono text-sky-400">{player.experience.toLocaleString()}</td>
                        <td className="p-4 text-center">
                            <button onClick={() => onAttack(player.id)} disabled={player.id === currentPlayer?.id} className="p-1.5 rounded bg-red-800/70 hover:bg-red-700 disabled:opacity-30"><CrossedSwordsIcon className="h-4 w-4"/></button>
                        </td>
                    </tr>
                )})}
                </tbody>
            </table>
        </div>
      </div>
    </ContentPanel>
  );
};
