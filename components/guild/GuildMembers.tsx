
import React, { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, GuildRole } from '../../types';

const rolePriority = {
    [GuildRole.LEADER]: 3,
    [GuildRole.OFFICER]: 2,
    [GuildRole.MEMBER]: 1,
    [GuildRole.RECRUIT]: 0
};

export const GuildMembers: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
    const effectiveRole = myRole || GuildRole.RECRUIT;
    const canManage = rolePriority[effectiveRole] >= rolePriority[GuildRole.OFFICER];
    const [showPermissions, setShowPermissions] = useState(false);

    const handleAction = async (targetId: number, action: 'kick' | 'promote' | 'demote') => {
        if (!confirm('Czy na pewno?')) return;
        try {
            await api.manageGuildMember(targetId, action);
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleInvite = async () => {
        const name = prompt('Podaj nazwę gracza:');
        if (name) {
            try {
                await api.inviteToGuild(name);
                alert('Zaproszenie wysłane.');
            } catch (e: any) {
                alert(e.message);
            }
        }
    }

    const members = guild.members || [];

    return (
        <div className="space-y-4">
            {/* Permissions Legend Toggle */}
            <div className="bg-slate-800/50 p-3 rounded-lg cursor-pointer flex justify-between items-center hover:bg-slate-800/80 transition-colors" onClick={() => setShowPermissions(!showPermissions)}>
                <span className="font-bold text-indigo-400">{t('guild.permissions.title')}</span>
                <span className="text-gray-400">{showPermissions ? '▲' : '▼'}</span>
            </div>
            
            {showPermissions && (
                <div className="bg-slate-900/60 p-4 rounded-lg text-sm space-y-2 border border-slate-700 animate-fade-in">
                    <p><span className="text-amber-400 font-bold">{t('guild.roles.LEADER')}:</span> <span className="text-gray-300">{t('guild.permissions.LEADER')}</span></p>
                    <p><span className="text-indigo-400 font-bold">{t('guild.roles.OFFICER')}:</span> <span className="text-gray-300">{t('guild.permissions.OFFICER')}</span></p>
                    <p><span className="text-gray-400 font-bold">{t('guild.roles.MEMBER')}:</span> <span className="text-gray-300">{t('guild.permissions.MEMBER')}</span></p>
                    <p><span className="text-gray-500 font-bold">{t('guild.roles.RECRUIT')}:</span> <span className="text-gray-300">{t('guild.permissions.RECRUIT')}</span></p>
                </div>
            )}

            <div className="bg-slate-800/50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Członkowie ({members.length}/{guild.maxMembers})</h3>
                    {canManage && <button onClick={handleInvite} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm font-bold">Zaproś</button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-gray-400">
                            <tr>
                                <th className="p-2">Nazwa</th>
                                <th className="p-2">Rola</th>
                                <th className="p-2">Poziom</th>
                                <th className="p-2">Rasa</th>
                                <th className="p-2">Klasa</th>
                                <th className="p-2 text-right">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(m => (
                                <tr key={m.userId} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="p-2 font-medium text-white flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${m.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} title={m.isOnline ? 'Online' : 'Offline'}></span>
                                        {m.name}
                                    </td>
                                    <td className={`p-2 font-bold ${m.role === GuildRole.LEADER ? 'text-amber-400' : m.role === GuildRole.OFFICER ? 'text-indigo-400' : 'text-gray-400'}`}>
                                        {t(`guild.roles.${m.role}`)}
                                    </td>
                                    <td className="p-2 text-gray-300">{m.level}</td>
                                    <td className="p-2 text-gray-300">{t(`race.${m.race}`)}</td>
                                    <td className="p-2 text-gray-300">{m.characterClass ? t(`class.${m.characterClass}`) : '-'}</td>
                                    <td className="p-2 text-right">
                                        {canManage && m.userId !== guild.leaderId && (
                                            <div className="flex gap-1 justify-end">
                                                {/* Promote button: Only if my role is strictly higher than (target role + 1). 
                                                    This ensures Officers (2) cannot promote Member (1) to Officer (2). */}
                                                {rolePriority[effectiveRole] > rolePriority[m.role] + 1 && (
                                                    <button onClick={() => handleAction(m.userId, 'promote')} className="px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded text-xs" title="Awansuj">▲</button>
                                                )}
                                                
                                                {/* Demote/Kick: Standard strict hierarchy check */}
                                                {rolePriority[effectiveRole] > rolePriority[m.role] && (
                                                    <>
                                                        <button onClick={() => handleAction(m.userId, 'demote')} className="px-2 py-1 bg-orange-700 hover:bg-orange-600 rounded text-xs" title="Degraduj">▼</button>
                                                        <button onClick={() => handleAction(m.userId, 'kick')} className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs" title="Wyrzuć">✕</button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
