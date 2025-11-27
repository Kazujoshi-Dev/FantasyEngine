


import React, { useState, useEffect, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api, getAuthToken } from '../api';
import { Guild as GuildType, GuildRole, GuildTransaction, GuildMember, GuildChatMessage, EssenceType } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { UsersIcon } from './icons/UsersIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { StarIcon } from './icons/StarIcon';
import { MessageSquareIcon } from './icons/MessageSquareIcon';
import { HomeIcon } from './icons/HomeIcon';
import { io, Socket } from 'socket.io-client';
import { rarityStyles } from './shared/ItemSlot';

const rolePriority = {
    [GuildRole.LEADER]: 3,
    [GuildRole.OFFICER]: 2,
    [GuildRole.MEMBER]: 1,
    [GuildRole.RECRUIT]: 0
};

const GuildChat: React.FC<{ guildId: number, initialMessages: GuildChatMessage[] }> = ({ guildId, initialMessages }) => {
    const [messages, setMessages] = useState<GuildChatMessage[]>(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState<Socket | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Use relative path or dynamic from environment for socket url
        const socketUrl = window.location.port === '3000' ? 'http://localhost:3001' : '/';
        const newSocket = io(socketUrl);
        const token = getAuthToken();

        newSocket.on('connect', () => {
            newSocket.emit('join_guild', guildId, token);
        });

        newSocket.on('receive_guild_message', (msg: GuildChatMessage) => {
            setMessages(prev => [...prev, msg]);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [guildId]);

    useEffect(() => {
        if(scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;
        const token = getAuthToken();
        socket.emit('send_guild_message', { guildId, content: newMessage, token });
        setNewMessage('');
    };

    return (
        <div className="flex flex-col h-[500px] bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex-grow overflow-y-auto p-4 space-y-2" ref={scrollRef}>
                {messages.map(msg => (
                    <div key={msg.id} className="text-sm">
                        <span className={`font-bold ${msg.role === GuildRole.LEADER ? 'text-amber-400' : msg.role === GuildRole.OFFICER ? 'text-indigo-400' : 'text-gray-300'}`}>
                            {msg.characterName}:
                        </span>
                        <span className="text-gray-200 ml-2 break-all">{msg.content}</span>
                        <span className="text-xs text-gray-600 ml-2">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                ))}
            </div>
            <form onSubmit={handleSend} className="p-2 border-t border-slate-700 flex gap-2">
                <input 
                    className="flex-grow bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-indigo-500" 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Wiadomość do gildii..."
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white">Wyślij</button>
            </form>
        </div>
    );
};

const GuildBank: React.FC<{ guild: GuildType, onTransaction: () => void }> = ({ guild, onTransaction }) => {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'gold' | EssenceType>('gold');
    const [type, setType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
    
    const handleSubmit = async () => {
        const val = parseInt(amount);
        if (isNaN(val) || val <= 0) return;
        try {
            await api.guildBankTransaction(type, currency, val);
            setAmount('');
            onTransaction();
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2"><CoinsIcon className="h-5 w-5"/> Zasoby Gildii</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between border-b border-slate-700 pb-2">
                        <span className="text-gray-400">Złoto</span>
                        <span className="font-mono font-bold text-amber-400">{guild.resources.gold.toLocaleString()}</span>
                    </div>
                    {Object.values(EssenceType).map(et => (
                        <div key={et} className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-gray-400">{et}</span>
                            <span className="font-mono font-bold text-sky-400">{guild.resources[et as keyof typeof guild.resources]}</span>
                        </div>
                    ))}
                </div>
                
                <div className="mt-6 space-y-3">
                    <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg">
                        <button onClick={() => setType('DEPOSIT')} className={`flex-1 py-2 rounded ${type === 'DEPOSIT' ? 'bg-green-700 text-white' : 'text-gray-400 hover:bg-slate-700'}`}>Wpłać</button>
                        <button onClick={() => setType('WITHDRAW')} className={`flex-1 py-2 rounded ${type === 'WITHDRAW' ? 'bg-red-700 text-white' : 'text-gray-400 hover:bg-slate-700'}`}>Wypłać</button>
                    </div>
                    <select className="w-full bg-slate-700 p-2 rounded border border-slate-600" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                        <option value="gold">Złoto</option>
                        {Object.values(EssenceType).map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <input type="number" className="w-full bg-slate-700 p-2 rounded border border-slate-600" placeholder="Ilość" value={amount} onChange={e => setAmount(e.target.value)} />
                    <button onClick={handleSubmit} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold">Wykonaj</button>
                </div>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg flex flex-col h-[400px]">
                <h3 className="text-lg font-bold text-gray-300 mb-2">Historia Transakcji</h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {(guild.transactions || []).map(t => (
                        <div key={t.id} className="text-xs bg-slate-900/30 p-2 rounded flex justify-between items-center">
                            <div>
                                <span className={t.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'}>{t.type === 'DEPOSIT' ? 'Wpłata' : 'Wypłata'}</span>
                                <span className="text-gray-400 mx-2">|</span>
                                <span className="font-bold text-gray-200">{t.characterName}</span>
                            </div>
                            <div className="font-mono">
                                {t.amount} <span className="text-gray-500">{t.currency === 'gold' ? 'Złoto' : 'Ess.'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const GuildMembers: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    // If myRole is undefined, default to RECRUIT (safe fallback)
    const effectiveRole = myRole || GuildRole.RECRUIT;
    const canManage = rolePriority[effectiveRole] >= rolePriority[GuildRole.OFFICER];

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
        <div className="bg-slate-800/50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-indigo-400">Członkowie ({members.length}/{guild.maxMembers})</h3>
                {canManage && <button onClick={handleInvite} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm font-bold">Zaproś</button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 text-gray-400">
                        <tr>
                            <th className="p-2">Nazwa</th>
                            <th className="p-2">Rola</th>
                            <th className="p-2">Poziom</th>
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
                                <td className={`p-2 font-bold ${m.role === GuildRole.LEADER ? 'text-amber-400' : m.role === GuildRole.OFFICER ? 'text-indigo-400' : 'text-gray-400'}`}>{m.role}</td>
                                <td className="p-2 text-gray-300">{m.level}</td>
                                <td className="p-2 text-right">
                                    {canManage && m.userId !== guild.leaderId && rolePriority[effectiveRole] > rolePriority[m.role] && (
                                        <div className="flex gap-1 justify-end">
                                            <button onClick={() => handleAction(m.userId, 'promote')} className="px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded text-xs" title="Awansuj">▲</button>
                                            <button onClick={() => handleAction(m.userId, 'demote')} className="px-2 py-1 bg-orange-700 hover:bg-orange-600 rounded text-xs" title="Degraduj">▼</button>
                                            <button onClick={() => handleAction(m.userId, 'kick')} className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs" title="Wyrzuć">✕</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const getBuildingCost = (level: number) => {
    const gold = Math.floor(5000 * Math.pow(1.5, level));
    const essenceTypes = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
    const essenceType = essenceTypes[Math.min(Math.floor(level / 5), 4)];
    const essenceAmount = 5 + (level % 5);
    return { gold, essenceType, essenceAmount };
}

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

const GuildBuildings: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
    const canManage = myRole === GuildRole.LEADER || myRole === GuildRole.OFFICER;
    const headquartersLevel = (guild.buildings && guild.buildings['headquarters']) || 0;
    
    const cost = getBuildingCost(headquartersLevel);
    const hasGold = guild.resources.gold >= cost.gold;
    const hasEssence = (guild.resources[cost.essenceType] || 0) >= cost.essenceAmount;
    
    const handleUpgrade = async () => {
        try {
            await api.upgradeGuildBuilding('headquarters');
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    <HomeIcon className="h-8 w-8 text-amber-400" />
                    <div>
                        <h4 className="text-xl font-bold text-white">{t('guild.buildings.headquarters')}</h4>
                        <p className="text-xs text-gray-400">{t('guild.buildings.headquartersDesc')}</p>
                    </div>
                </div>
                
                <div className="flex-grow space-y-4">
                    <div className="bg-slate-900/50 p-3 rounded">
                        <p className="text-sm text-gray-400">{t('guild.buildings.level')}: <span className="text-white font-bold">{headquartersLevel}</span></p>
                        <p className="text-sm text-gray-400">{t('guild.buildings.currentEffect')}: <span className="text-green-400 font-bold">{t('guild.buildings.maxMembers', { count: 10 + headquartersLevel })}</span></p>
                    </div>
                    
                    <div className="border-t border-slate-700 pt-4">
                        <p className="text-sm font-bold text-gray-300 mb-2">{t('guild.buildings.upgradeCost')}:</p>
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-gray-400">Złoto</span>
                            <span className={`font-mono font-bold ${hasGold ? 'text-amber-400' : 'text-red-400'}`}>{cost.gold.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className={`${essenceToRarityMap[cost.essenceType].text}`}>{t(`resources.${cost.essenceType}`)}</span>
                            <span className={`font-mono font-bold ${hasEssence ? 'text-sky-400' : 'text-red-400'}`}>{cost.essenceAmount}</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleUpgrade} 
                    disabled={!canManage || !hasGold || !hasEssence}
                    className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white disabled:bg-slate-700 disabled:text-gray-500"
                >
                    {t('guild.buildings.upgrade')}
                </button>
            </div>
        </div>
    );
};

export const Guild: React.FC = () => {
    const { t } = useTranslation();
    const [guild, setGuild] = useState<GuildType | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'OVERVIEW' | 'MEMBERS' | 'BUILDINGS' | 'BANK' | 'CHAT'>('OVERVIEW');
    const [availableGuilds, setAvailableGuilds] = useState<any[]>([]);

    // Create Form State
    const [newName, setNewName] = useState('');
    const [newTag, setNewTag] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const fetchGuild = async () => {
        setLoading(true);
        try {
            const data = await api.getMyGuild();
            setGuild(data);
            if (!data) {
                const list = await api.getGuildList();
                setAvailableGuilds(list);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGuild();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createGuild(newName, newTag, newDesc);
            fetchGuild();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleJoin = async (id: number) => {
        try {
            await api.joinGuild(id);
            fetchGuild();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleLeave = async () => {
        if (!confirm('Czy na pewno chcesz opuścić gildię?')) return;
        try {
            await api.leaveGuild();
            setGuild(null);
            fetchGuild();
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (loading) return <ContentPanel title={t('guild.title')}><p className="text-gray-400">Ładowanie...</p></ContentPanel>;

    if (!guild) {
        return (
            <ContentPanel title={t('guild.title')}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Create Guild */}
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-xl font-bold text-amber-400 mb-4">Załóż Gildię</h3>
                        <p className="text-sm text-gray-400 mb-4">Koszt założenia gildii: <span className="text-amber-400 font-bold">1000 Złota</span></p>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input className="w-full bg-slate-800 p-2 rounded border border-slate-600" placeholder="Nazwa Gildii" value={newName} onChange={e => setNewName(e.target.value)} required />
                            <input className="w-full bg-slate-800 p-2 rounded border border-slate-600" placeholder="Tag (max 5 znaków)" value={newTag} onChange={e => setNewTag(e.target.value)} maxLength={5} required />
                            <textarea className="w-full bg-slate-800 p-2 rounded border border-slate-600" placeholder="Opis" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} />
                            <button type="submit" className="w-full py-2 bg-green-700 hover:bg-green-600 rounded font-bold text-white">Stwórz</button>
                        </form>
                    </div>

                    {/* Join Guild */}
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">Dołącz do Gildii</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {availableGuilds.length === 0 && <p className="text-gray-500">Brak otwartych gildii.</p>}
                            {availableGuilds.map(g => (
                                <div key={g.id} className="bg-slate-800 p-3 rounded flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            [{g.tag}] {g.name}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            Członków: {g.member_count}/{g.max_members} | Lider: {g.leader_name}
                                        </div>
                                    </div>
                                    <button onClick={() => handleJoin(g.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold">Dołącz</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    return (
        <ContentPanel title={`${guild.name} [${guild.tag}]`}>
            <div className="flex border-b border-slate-700 mb-6 gap-2 overflow-x-auto">
                <button onClick={() => setTab('OVERVIEW')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'OVERVIEW' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Przegląd</button>
                <button onClick={() => setTab('MEMBERS')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'MEMBERS' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Członkowie</button>
                <button onClick={() => setTab('BUILDINGS')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'BUILDINGS' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Budynki</button>
                <button onClick={() => setTab('BANK')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'BANK' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Bank</button>
                <button onClick={() => setTab('CHAT')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'CHAT' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Czat</button>
            </div>

            {tab === 'OVERVIEW' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/40 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-gray-200 mb-4">Informacje</h3>
                        <p className="text-gray-400 italic mb-4 whitespace-pre-wrap">{guild.description || 'Brak opisu.'}</p>
                        <div className="space-y-2 text-sm">
                            <p className="flex justify-between"><span className="text-gray-500">Lider:</span> <span className="text-white">{(guild.members || []).find(m => m.role === GuildRole.LEADER)?.name}</span></p>
                            <p className="flex justify-between"><span className="text-gray-500">Członków:</span> <span className="text-white">{guild.memberCount}/{guild.maxMembers}</span></p>
                            <p className="flex justify-between"><span className="text-gray-500">Założona:</span> <span className="text-white">{new Date(guild.createdAt).toLocaleDateString()}</span></p>
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-700">
                            <button onClick={handleLeave} className="w-full py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-200 rounded">
                                {guild.myRole === GuildRole.LEADER ? 'Rozwiąż Gildię' : 'Opuść Gildię'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2"><MessageSquareIcon className="h-5 w-5"/> Szybki Czat</h3>
                        <GuildChat guildId={guild.id} initialMessages={guild.chatHistory || []} />
                    </div>
                </div>
            )}

            {tab === 'MEMBERS' && <GuildMembers guild={guild} myRole={guild.myRole} onUpdate={fetchGuild} />}
            
            {tab === 'BUILDINGS' && <GuildBuildings guild={guild} myRole={guild.myRole} onUpdate={fetchGuild} />}

            {tab === 'BANK' && <GuildBank guild={guild} onTransaction={fetchGuild} />}

            {tab === 'CHAT' && <GuildChat guildId={guild.id} initialMessages={guild.chatHistory || []} />}

        </ContentPanel>
    );
};