
import React from 'react';
import { Guild, GuildRole } from '../../types';
import { api } from '../../api';

interface GuildMembersProps {
    guild: Guild;
    myRole?: GuildRole;
    onUpdate: () => void;
}

export const GuildMembers: React.FC<GuildMembersProps> = ({ guild, myRole, onUpdate }) => {
    const canManage = myRole === GuildRole.LEADER || myRole === GuildRole.OFFICER;
    const isLeader = myRole === GuildRole.LEADER;

    const handleAction = async (targetUserId: number, action: 'kick' | 'promote' | 'demote') => {
        if (!confirm(`Czy na pewno chcesz wykonać akcję: ${action}?`)) return;
        try {
            await api.manageGuildMember(targetUserId, action);
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const roleOrder = { [GuildRole.LEADER]: 0, [GuildRole.OFFICER]: 1, [GuildRole.MEMBER]: 2, [GuildRole.RECRUIT]: 3 };
    const sortedMembers = [...(guild.members || [])].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    return (
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/80 text-gray-400">
                    <tr>
                        <th className="p-3">Gracz</th>
                        <th className="p-3">Rola</th>
                        <th className="p-3 text-center">Poziom</th>
                        <th className="p-3 text-right">Akcje</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                    {sortedMembers.map(m => (
                        <tr key={m.userId} className="hover:bg-slate-800/30">
                            <td className="p-3 font-medium text-white flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${m.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} title={m.isOnline ? 'Online' : 'Offline'}></span>
                                {m.name}
                            </td>
                            <td className={`p-3 font-bold ${m.role === 'LEADER' ? 'text-amber-400' : m.role === 'OFFICER' ? 'text-indigo-400' : 'text-gray-400'}`}>
                                {m.role}
                            </td>
                            <td className="p-3 text-center">{m.level}</td>
                            <td className="p-3 text-right space-x-2">
                                {canManage && m.role !== 'LEADER' && roleOrder[myRole!] < roleOrder[m.role] && (
                                    <>
                                        <button onClick={() => handleAction(m.userId, 'kick')} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-900 rounded">Wyrzuć</button>
                                        {isLeader && (
                                            <>
                                                {m.role !== 'OFFICER' && <button onClick={() => handleAction(m.userId, 'promote')} className="text-green-400 hover:text-green-300 text-xs px-2 py-1 border border-green-900 rounded">Awansuj</button>}
                                                {m.role !== 'RECRUIT' && <button onClick={() => handleAction(m.userId, 'demote')} className="text-yellow-400 hover:text-yellow-300 text-xs px-2 py-1 border border-yellow-900 rounded">Degraduj</button>}
                                            </>
                                        )}
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
