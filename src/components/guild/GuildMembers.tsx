
import React from 'react';
import { Guild, GuildRole, PlayerRank } from '../../types';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';
import { useCharacter } from '@/contexts/CharacterContext';

export const GuildMembers: React.FC<{ guild: Guild, myRole?: GuildRole, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
    const { gameData } = useCharacter();

    const getPlayerRank = (rankId?: string): PlayerRank | null => {
        if (!rankId || !gameData?.playerRanks) return null;
        return gameData.playerRanks.find(r => r.id === rankId) || null;
    };

    const roleOrder = { [GuildRole.LEADER]: 0, [GuildRole.OFFICER]: 1, [GuildRole.MEMBER]: 2, [GuildRole.RECRUIT]: 3 };
    const sortedMembers = [...(guild.members || [])].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    return (
        <div className="bg-slate-900/40 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/80 text-gray-400">
                    <tr><th className="p-3">Gracz</th><th className="p-3">Rola</th><th className="p-3 text-center">Poziom</th><th className="p-3 text-right">Akcje</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                    {sortedMembers.map(m => {
                        const rank = getPlayerRank((m as any).activeRankId);
                        return (
                            <tr key={m.userId} className="hover:bg-slate-800/30">
                                <td className="p-3 font-medium text-white flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${m.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                    <div className="flex items-center gap-2">
                                        {rank && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-white/5" style={{ 
                                                backgroundImage: rank.backgroundImageUrl ? `url(${rank.backgroundImageUrl})` : 'none',
                                                backgroundColor: rank.backgroundImageUrl ? 'transparent' : '#312e81',
                                                backgroundSize: 'cover',
                                                color: rank.textColor,
                                                textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                            }}>{rank.name}</span>
                                        )}
                                        {m.name}
                                    </div>
                                </td>
                                <td className="p-3 text-indigo-300 font-bold">{m.role}</td>
                                <td className="p-3 text-center font-mono">{m.level}</td>
                                <td className="p-3 text-right">
                                    {myRole === 'LEADER' && m.role !== 'LEADER' && <button onClick={async () => { if(confirm('Kick?')) { await api.manageGuildMember(m.userId, 'kick'); onUpdate(); }}} className="text-red-400 text-xs">Wyrzuć</button>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
