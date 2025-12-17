
import React from 'react';
import { Guild, GuildRole } from '../../types';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';

interface GuildMembersProps {
    guild: Guild;
    myRole?: GuildRole;
    onUpdate: () => void;
}

export const GuildMembers: React.FC<GuildMembersProps> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
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

    const getRoleColor = (role: GuildRole) => {
        switch (role) {
            case GuildRole.LEADER: return 'text-amber-400';
            case GuildRole.OFFICER: return 'text-indigo-400';
            case GuildRole.MEMBER: return 'text-gray-300';
            case GuildRole.RECRUIT: return 'text-gray-500';
            default: return 'text-white';
        }
    };

    return (
        <div className="space-y-6">
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
                                <td className={`p-3 font-bold ${getRoleColor(m.role)}`}>
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

            {/* Legenda Uprawnień */}
            <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider border-b border-slate-700/50 pb-2">
                    {t('guild.permissions.title')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {Object.values(GuildRole).map(role => (
                        <div key={role} className="flex flex-col">
                            <span className={`font-bold ${getRoleColor(role)} mb-1`}>{role}</span>
                            <span className="text-gray-400 text-xs leading-relaxed">
                                {t(`guild.permissions.${role}` as any)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
