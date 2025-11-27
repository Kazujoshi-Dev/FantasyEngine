






import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api, getAuthToken } from '../api';
import { Guild as GuildType, GuildRole, GuildTransaction, GuildMember, GuildChatMessage, EssenceType, GuildArmoryItem, ItemInstance, ItemTemplate, Affix } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { UsersIcon } from './icons/UsersIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { StarIcon } from './icons/StarIcon';
import { MessageSquareIcon } from './icons/MessageSquareIcon';
import { HomeIcon } from './icons/HomeIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { io, Socket } from 'socket.io-client';
import { rarityStyles, ItemListItem, getGrammaticallyCorrectFullName, ItemTooltip } from './shared/ItemSlot';

const rolePriority = {
    [GuildRole.LEADER]: 3,
    [GuildRole.OFFICER]: 2,
    [GuildRole.MEMBER]: 1,
    [GuildRole.RECRUIT]: 0
};

// ... (GuildChat component remains same) ...
const GuildChat: React.FC<{ guildId: number, messages: GuildChatMessage[], onMessageReceived: (msg: GuildChatMessage) => void }> = ({ guildId, messages, onMessageReceived }) => {
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
            onMessageReceived(msg);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [guildId]); // Removed onMessageReceived dependency to prevent reconnect loops if parent function reference changes unsteadily (though usually fine)

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

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

// ... (GuildBank, GuildMembers, getBuildingCost, GuildBuildings) ...
const GuildBank: React.FC<{ guild: GuildType, onTransaction: () => void }> = ({ guild, onTransaction }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'gold' | EssenceType>('gold');
    const [type, setType] = useState<'DEPOSIT'>('DEPOSIT');
    
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
                        <span className="text-gray-400">{t('resources.gold')}</span>
                        <span className="font-mono font-bold text-amber-400">{guild.resources.gold.toLocaleString()}</span>
                    </div>
                    {Object.values(EssenceType).map(et => (
                        <div key={et} className="flex justify-between border-b border-slate-700 pb-2">
                            <span className={essenceToRarityMap[et].text}>{t(`resources.${et}`)}</span>
                            <span className="font-mono font-bold text-white">{guild.resources[et as keyof typeof guild.resources]}</span>
                        </div>
                    ))}
                </div>
                
                <div className="mt-6 space-y-3">
                    <p className="text-sm text-gray-400 mb-2">Wpłać zasoby</p>
                    <select className="w-full bg-slate-700 p-2 rounded border border-slate-600" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                        <option value="gold">{t('resources.gold')}</option>
                        {Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}
                    </select>
                    <input type="number" className="w-full bg-slate-700 p-2 rounded border border-slate-600" placeholder="Ilość" value={amount} onChange={e => setAmount(e.target.value)} />
                    <button onClick={handleSubmit} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold">Wpłać</button>
                </div>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg flex flex-col h-[400px]">
                <h3 className="text-lg font-bold text-gray-300 mb-2">Historia Transakcji</h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {(guild.transactions || []).map(tx => (
                        <div key={tx.id} className="text-xs bg-slate-900/30 p-2 rounded flex justify-between items-center">
                            <div>
                                <span className={tx.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'}>{tx.type === 'DEPOSIT' ? 'Wpłata' : 'Wypłata'}</span>
                                <span className="text-gray-400 mx-2">|</span>
                                <span className="font-bold text-gray-200">{tx.characterName}</span>
                            </div>
                            <div className="font-mono">
                                {tx.amount} <span className="text-gray-500">{tx.currency === 'gold' ? t('resources.gold') : t(`resources.${tx.currency as EssenceType}`)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const GuildMembers: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
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
        </div>
    );
};

const getBuildingCost = (type: string, level: number) => {
    if (type === 'headquarters') {
        const gold = Math.floor(5000 * Math.pow(1.5, level));
        const essenceTypes = [EssenceType.Common, EssenceType.Uncommon, EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const essenceType = essenceTypes[Math.min(Math.floor(level / 5), 4)];
        const essenceAmount = 5 + (level % 5);
        return { gold, essenceType, essenceAmount };
    }
    if (type === 'armory') {
        const gold = Math.floor(10000 * Math.pow(1.6, level));
        const essenceTypes = [EssenceType.Rare, EssenceType.Epic, EssenceType.Legendary];
        const essenceType = essenceTypes[Math.min(Math.floor(level / 3), 2)];
        const essenceAmount = 5 + (level % 3) * 2;
        return { gold, essenceType, essenceAmount };
    }
    return { gold: Infinity, essenceType: EssenceType.Common, essenceAmount: Infinity };
}

const GuildBuildings: React.FC<{ guild: GuildType, myRole: GuildRole | undefined, onUpdate: () => void }> = ({ guild, myRole, onUpdate }) => {
    const { t } = useTranslation();
    const canManage = myRole === GuildRole.LEADER || myRole === GuildRole.OFFICER;
    const headquartersLevel = (guild.buildings && guild.buildings['headquarters']) || 0;
    const armoryLevel = (guild.buildings && guild.buildings['armory']) || 0;
    
    const renderBuilding = (type: 'headquarters' | 'armory', level: number) => {
        const cost = getBuildingCost(type, level);
        const hasGold = guild.resources.gold >= cost.gold;
        const hasEssence = (guild.resources[cost.essenceType] || 0) >= cost.essenceAmount;
        
        const handleUpgrade = async () => {
            try {
                await api.upgradeGuildBuilding(type);
                onUpdate();
            } catch (e: any) {
                alert(e.message);
            }
        }
        
        let icon = <HomeIcon className="h-8 w-8 text-amber-400" />;
        if (type === 'armory') icon = <ShieldIcon className="h-8 w-8 text-indigo-400" />;

        let effect = t('guild.buildings.maxMembers', { count: 10 + level });
        if (type === 'armory') effect = `Pojemność: ${10 + level}`;

        return (
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    {icon}
                    <div>
                        <h4 className="text-xl font-bold text-white">{t(`guild.buildings.${type}`)}</h4>
                        <p className="text-xs text-gray-400">{t(`guild.buildings.${type}Desc`)}</p>
                    </div>
                </div>
                
                <div className="flex-grow space-y-4">
                    <div className="bg-slate-900/50 p-3 rounded">
                        <p className="text-sm text-gray-400">{t('guild.buildings.level')}: <span className="text-white font-bold">{level}</span></p>
                        <p className="text-sm text-gray-400">{t('guild.buildings.currentEffect')}: <span className="text-green-400 font-bold">{effect}</span></p>
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
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderBuilding('headquarters', headquartersLevel)}
            {renderBuilding('armory', armoryLevel)}
        </div>
    );
};

// ... (FormattedText, GuildSettings) ...
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    // Simple parser for custom tags or just safe rendering of standard text
    // Replace newline with <br/>
    const lines = text.split('\n');
    return (
        <div className="text-gray-400 italic mb-4 whitespace-pre-wrap">
            {lines.map((line, i) => {
                // Basic parser for [b], [i], [color=code]
                let parts: (string | React.ReactNode)[] = [line];
                // Bold
                parts = parts.flatMap(p => typeof p === 'string' ? p.split(/(\[b\].*?\[\/b\])/g) : [p]).map(p => {
                    if (typeof p === 'string' && p.startsWith('[b]') && p.endsWith('[/b]')) {
                        return <b key={Math.random()} className="text-white not-italic">{p.slice(3, -4)}</b>;
                    }
                    return p;
                });
                // Italic (already italic wrapper, but nested maybe)
                parts = parts.flatMap(p => typeof p === 'string' ? p.split(/(\[i\].*?\[\/i\])/g) : [p]).map(p => {
                    if (typeof p === 'string' && p.startsWith('[i]') && p.endsWith('[/i]')) {
                        return <i key={Math.random()}>{p.slice(3, -4)}</i>;
                    }
                    return p;
                });
                // Color [color=red]text[/color]
                parts = parts.flatMap(p => typeof p === 'string' ? p.split(/(\[color=[a-z]+\][\s\S]*?\[\/color\])/g) : [p]).map(p => {
                    if (typeof p === 'string' && p.startsWith('[color=')) {
                        const match = p.match(/\[color=([a-z]+)\](.*?)\[\/color\]/);
                        if (match) {
                            const colorClass = 
                                match[1] === 'red' ? 'text-red-400' : 
                                match[1] === 'green' ? 'text-green-400' :
                                match[1] === 'blue' ? 'text-blue-400' :
                                match[1] === 'yellow' ? 'text-amber-400' :
                                match[1] === 'purple' ? 'text-purple-400' : 'text-white';
                            return <span key={Math.random()} className={`${colorClass} not-italic`}>{match[2]}</span>;
                        }
                    }
                    return p;
                });

                return <span key={i}>{parts}<br/></span>;
            })}
        </div>
    );
};

const GuildSettings: React.FC<{ guild: GuildType, onUpdate: () => void }> = ({ guild, onUpdate }) => {
    const { t } = useTranslation();
    const [desc, setDesc] = useState(guild.description || '');
    const [crest, setCrest] = useState(guild.crestUrl || '');
    const [minLevel, setMinLevel] = useState(guild.minLevel || 1);
    const [isPublic, setIsPublic] = useState(guild.isPublic || false);
    const [saving, setSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateGuild(desc, crest, minLevel, isPublic);
            onUpdate();
            alert('Zapisano ustawienia.');
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDisband = async () => {
        if (!confirm(t('guild.settings.disbandConfirm'))) return;
        try {
            await api.leaveGuild(); // For leader this means disband
            window.location.reload(); // Refresh to reset state
        } catch (e: any) {
            alert(e.message);
        }
    };

    const insertTag = (tagStart: string, tagEnd: string) => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const text = textareaRef.current.value;
            const before = text.substring(0, start);
            const selection = text.substring(start, end);
            const after = text.substring(end);
            const newText = before + tagStart + selection + tagEnd + after;
            setDesc(newText);
            // Must wait for render to set selection back
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.selectionStart = start + tagStart.length;
                    textareaRef.current.selectionEnd = end + tagStart.length;
                }
            }, 0);
        }
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">{t('guild.settings.title')}</h3>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.description')}</label>
                    <div className="flex gap-2 mb-2">
                        <button type="button" onClick={() => insertTag('[b]', '[/b]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white">B</button>
                        <button type="button" onClick={() => insertTag('[i]', '[/i]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs italic text-white">I</button>
                        <button type="button" onClick={() => insertTag('[color=red]', '[/color]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-red-400">Red</button>
                        <button type="button" onClick={() => insertTag('[color=green]', '[/color]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-green-400">Green</button>
                        <button type="button" onClick={() => insertTag('[color=blue]', '[/color]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-blue-400">Blue</button>
                    </div>
                    <textarea 
                        ref={textareaRef}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-32 text-sm font-mono" 
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        placeholder="Opisz swoją gildię..."
                    />
                    <div className="mt-2 text-xs text-gray-500">
                        {t('guild.settings.preview')}:
                        <div className="p-2 border border-slate-700 rounded bg-slate-900/50 mt-1">
                            <FormattedText text={desc || 'Brak opisu'} />
                        </div>
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.crestUrl')}</label>
                    <input 
                        type="text"
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                        value={crest}
                        onChange={e => setCrest(e.target.value)}
                        placeholder="https://example.com/crest.png"
                    />
                    {crest && (
                        <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">{t('guild.settings.preview')}:</p>
                            <img src={crest} alt="Crest Preview" className="h-24 w-24 object-contain border border-slate-600 bg-slate-900 rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.minLevel')}</label>
                        <input 
                            type="number"
                            min="1"
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                            value={minLevel}
                            onChange={e => setMinLevel(parseInt(e.target.value))}
                        />
                    </div>
                    
                    <div className="flex items-center">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={isPublic}
                                onChange={e => setIsPublic(e.target.checked)}
                                className="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-0 bg-slate-700 border-slate-600" 
                            />
                            <span className="text-sm font-medium text-gray-300">{t('guild.settings.isPublic')}</span>
                        </label>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                    <button onClick={handleDisband} className="px-4 py-2 bg-red-900/80 hover:bg-red-800 text-red-200 rounded font-bold">
                        {t('guild.settings.disband')}
                    </button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-bold disabled:bg-slate-600">
                        {saving ? 'Zapisywanie...' : t('guild.settings.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const GuildArmory: React.FC<{ guild: GuildType, onUpdate: () => void, templates: ItemTemplate[], affixes: Affix[] }> = ({ guild, onUpdate, templates, affixes }) => {
    const { t } = useTranslation();
    const [armoryData, setArmoryData] = useState<{ armoryItems: GuildArmoryItem[], borrowedItems: GuildArmoryItem[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [myItems, setMyItems] = useState<ItemInstance[]>([]);
    const [userId, setUserId] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.getGuildArmory(),
            api.getCharacter()
        ]).then(([armory, char]) => {
            setArmoryData(armory);
            setMyItems(char.inventory.filter(i => !i.isBorrowed)); // Filter out items I already borrowed to prevent re-depositing weirdness
            setUserId(char.id || null);
        }).catch(console.error).finally(() => setLoading(false));
    }, [guild.id]); // Refresh when guild ID changes (or mount)

    const canManage = guild.myRole === GuildRole.LEADER || guild.myRole === GuildRole.OFFICER;
    const armoryLevel = guild.buildings?.armory || 0;
    const capacity = 10 + armoryLevel;

    const handleDeposit = async (item: ItemInstance) => {
        if (!confirm('Czy na pewno chcesz zdeponować ten przedmiot w zbrojowni gildii? Tracisz do niego prawo własności na rzecz gildii.')) return;
        try {
            await api.depositToArmory(item.uniqueId);
            onUpdate(); // Trigger parent refresh if needed, but mainly reload local data
            // Reload local
            const [armory, char] = await Promise.all([api.getGuildArmory(), api.getCharacter()]);
            setArmoryData(armory);
            setMyItems(char.inventory.filter(i => !i.isBorrowed));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleBorrow = async (armoryId: number, item: ItemInstance) => {
        const template = templates.find(t => t.id === item.templateId);
        const value = template?.value || 0; // Simplified for tax check display
        const tax = Math.ceil(value * 0.1);
        
        if (!confirm(`Wypożyczenie kosztuje 10% wartości przedmiotu (${tax} złota). Złoto trafi do banku gildii. Kontynuować?`)) return;

        try {
            await api.borrowFromArmory(armoryId);
            const [armory, char] = await Promise.all([api.getGuildArmory(), api.getCharacter()]);
            setArmoryData(armory);
            setMyItems(char.inventory.filter(i => !i.isBorrowed));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRecall = async (targetUserId: number, itemUniqueId: string) => {
        if (!confirm('Czy na pewno chcesz wymusić zwrot przedmiotu do zbrojowni?')) return;
        try {
            await api.recallFromMember(targetUserId, itemUniqueId);
            const armory = await api.getGuildArmory();
            setArmoryData(armory);
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (loading || !armoryData) return <p className="text-gray-400">Ładowanie zbrojowni...</p>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Armory Contents */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col h-[500px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldIcon className="h-5 w-5 text-indigo-400"/> Zbrojownia</h3>
                        <span className="text-sm text-gray-400">{armoryData.armoryItems.length} / {capacity}</span>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {armoryData.armoryItems.length === 0 && <p className="text-gray-500 text-center text-sm py-4">Zbrojownia jest pusta.</p>}
                        {armoryData.armoryItems.map(entry => {
                            const template = templates.find(t => t.id === entry.item.templateId);
                            if (!template) return null;
                            const tax = Math.ceil((template.value || 0) * 0.1);
                            
                            return (
                                <div key={entry.id} className="bg-slate-900/50 p-2 rounded border border-slate-700/50 relative group">
                                    <div className="flex justify-between items-center">
                                        <ItemListItem item={entry.item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} />
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs text-gray-500">od {entry.ownerName}</span>
                                            <button onClick={() => handleBorrow(entry.id, entry.item)} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white">
                                                Wypożycz ({tax}g)
                                            </button>
                                        </div>
                                    </div>
                                    <ItemTooltip instance={entry.item} template={template} affixes={affixes} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* My Backpack (Deposit) */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col h-[500px]">
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Mój Plecak (Depozyt)</h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {myItems.length === 0 && <p className="text-gray-500 text-center text-sm py-4">Brak przedmiotów do zdeponowania.</p>}
                        {myItems.map(item => {
                            const template = templates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            return (
                                <div key={item.uniqueId} className="bg-slate-900/50 p-2 rounded border border-slate-700/50 relative group">
                                    <div className="flex justify-between items-center">
                                        <ItemListItem item={item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} />
                                        <button onClick={() => handleDeposit(item)} className="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-xs font-bold text-white ml-2">
                                            Włóż
                                        </button>
                                    </div>
                                    <ItemTooltip instance={item} template={template} affixes={affixes} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Borrowed Items Management (Leader/Officer/Owner view) */}
            {(canManage || (userId && armoryData.borrowedItems.some(i => i.ownerId === userId))) && (
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-amber-400 mb-4">Wypożyczone Przedmioty</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900/50 text-gray-400">
                                <tr>
                                    <th className="p-2">Przedmiot</th>
                                    <th className="p-2">Właściciel</th>
                                    <th className="p-2">Wypożyczone przez</th>
                                    <th className="p-2 text-right">Akcja</th>
                                </tr>
                            </thead>
                            <tbody>
                                {armoryData.borrowedItems.map((entry, idx) => {
                                    const template = templates.find(t => t.id === entry.item.templateId);
                                    
                                    return (
                                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                            <td className="p-2">
                                                {template ? getGrammaticallyCorrectFullName(entry.item, template, affixes) : 'Unknown'}
                                            </td>
                                            <td className="p-2 text-gray-300">{entry.ownerName}</td>
                                            <td className="p-2 text-sky-400 font-bold">{entry.borrowedBy}</td>
                                            <td className="p-2 text-right">
                                                <button onClick={() => handleRecall(entry.userId!, entry.item.uniqueId)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs text-white">
                                                    Wymuś Zwrot
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {armoryData.borrowedItems.length === 0 && (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-500">Brak wypożyczonych przedmiotów.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        * Liderzy, Oficerowie oraz prawowici właściciele mogą wymusić zwrot przedmiotu do zbrojowni w każdej chwili.
                    </p>
                </div>
            )}
        </div>
    );
};

export const Guild: React.FC = () => {
    const { t } = useTranslation();
    const [guild, setGuild] = useState<GuildType | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'OVERVIEW' | 'MEMBERS' | 'BUILDINGS' | 'ARMORY' | 'BANK' | 'CHAT' | 'SETTINGS'>('OVERVIEW');
    const [availableGuilds, setAvailableGuilds] = useState<any[]>([]);
    
    // Game Data for Armory display
    const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>([]);
    const [affixes, setAffixes] = useState<Affix[]>([]);

    // Create Form State
    const [newName, setNewName] = useState('');
    const [newTag, setNewTag] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const fetchGuild = async () => {
        setLoading(true);
        try {
            const [data, gameData] = await Promise.all([
                api.getMyGuild(),
                api.getGameData()
            ]);
            setGuild(data);
            setItemTemplates(gameData.itemTemplates);
            setAffixes(gameData.affixes);

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

    // Callback to update local state when a new message arrives via Socket
    const handleNewChatMessage = (msg: GuildChatMessage) => {
        setGuild(prev => {
            if (!prev) return null;
            // Avoid duplicates
            if (prev.chatHistory?.some(m => m.id === msg.id)) return prev;
            
            return {
                ...prev,
                chatHistory: [...(prev.chatHistory || []), msg]
            };
        });
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
                                            Członków: {g.member_count}/{g.max_members} | Min. Lvl: {g.min_level}
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

    const isLeader = guild.myRole === GuildRole.LEADER;

    return (
        <ContentPanel title={`${guild.name} [${guild.tag}]`}>
            <div className="flex border-b border-slate-700 mb-6 gap-2 overflow-x-auto">
                <button onClick={() => setTab('OVERVIEW')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'OVERVIEW' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Przegląd</button>
                <button onClick={() => setTab('MEMBERS')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'MEMBERS' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Członkowie</button>
                <button onClick={() => setTab('BUILDINGS')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'BUILDINGS' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Budynki</button>
                <button onClick={() => setTab('ARMORY')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'ARMORY' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Zbrojownia</button>
                <button onClick={() => setTab('BANK')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'BANK' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Bank</button>
                <button onClick={() => setTab('CHAT')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'CHAT' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Czat</button>
                {isLeader && <button onClick={() => setTab('SETTINGS')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'SETTINGS' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Ustawienia</button>}
            </div>

            {tab === 'OVERVIEW' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/40 p-6 rounded-xl">
                        <h3 className="text-xl font-bold text-gray-200 mb-4">Informacje</h3>
                        <FormattedText text={guild.description || 'Brak opisu.'} />
                        <div className="space-y-2 text-sm mt-4 pt-4 border-t border-slate-700">
                            <p className="flex justify-between"><span className="text-gray-500">Lider:</span> <span className="text-white">{(guild.members || []).find(m => m.role === GuildRole.LEADER)?.name}</span></p>
                            <p className="flex justify-between"><span className="text-gray-500">Członków:</span> <span className="text-white">{guild.memberCount}/{guild.maxMembers}</span></p>
                            <p className="flex justify-between"><span className="text-gray-500">Założona:</span> <span className="text-white">{new Date(guild.createdAt).toLocaleDateString()}</span></p>
                            <p className="flex justify-between"><span className="text-gray-500">Rekrutacja:</span> <span className={guild.isPublic ? "text-green-400" : "text-red-400"}>{guild.isPublic ? "Otwarta" : "Zamknięta"}</span></p>
                            {guild.isPublic && <p className="flex justify-between"><span className="text-gray-500">Min. Poziom:</span> <span className="text-white">{guild.minLevel}</span></p>}
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-700">
                            {!isLeader && (
                                <button onClick={handleLeave} className="w-full py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-200 rounded">
                                    Opuść Gildię
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-slate-900/20 p-6 rounded-xl border border-slate-700/30">
                        {guild.crestUrl ? (
                            <img src={guild.crestUrl} alt="Guild Crest" className="max-w-full max-h-64 object-contain drop-shadow-xl" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-500">
                                <ShieldIcon className="h-32 w-32 mb-2 opacity-20" />
                                <p className="text-sm">Brak herbu gildii</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'MEMBERS' && <GuildMembers guild={guild} myRole={guild.myRole} onUpdate={fetchGuild} />}
            
            {tab === 'BUILDINGS' && <GuildBuildings guild={guild} myRole={guild.myRole} onUpdate={fetchGuild} />}

            {tab === 'ARMORY' && <GuildArmory guild={guild} onUpdate={fetchGuild} templates={itemTemplates} affixes={affixes} />}

            {tab === 'BANK' && <GuildBank guild={guild} onTransaction={fetchGuild} />}

            {tab === 'CHAT' && <GuildChat guildId={guild.id} messages={guild.chatHistory || []} onMessageReceived={handleNewChatMessage} />}

            {tab === 'SETTINGS' && isLeader && <GuildSettings guild={guild} onUpdate={fetchGuild} />}

        </ContentPanel>
    );
};
