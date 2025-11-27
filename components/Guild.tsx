
import React, { useState, useEffect, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, Guild, GuildRole, EssenceType, ItemInstance, ItemTemplate } from '../types';
import { api } from '../api';
import { UsersIcon } from './icons/UsersIcon';
import { CoinsIcon } from './icons/CoinsIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { ItemList, ItemDetailsPanel } from './shared/ItemSlot';

interface GuildProps {
    // Component handles its own data fetching for simplicity via api.ts
}

const CreateGuildPanel: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [tag, setTag] = useState('');
    const [desc, setDesc] = useState('');

    const handleCreate = async () => {
        try {
            await api.createGuild(name, tag, desc);
            alert('Gildia utworzona!');
            onCreated();
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl max-w-md mx-auto">
            <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('guild.create')}</h3>
            <div className="space-y-4">
                <input type="text" placeholder={t('guild.createName')} value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 p-2 rounded" />
                <input type="text" placeholder={t('guild.createTag')} maxLength={5} value={tag} onChange={e => setTag(e.target.value)} className="w-full bg-slate-800 p-2 rounded" />
                <textarea placeholder={t('guild.createDesc')} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-800 p-2 rounded h-24" />
                <button onClick={handleCreate} className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-bold text-white">{t('guild.createBtn')}</button>
            </div>
        </div>
    );
};

const GuildList: React.FC<{ onJoin: () => void }> = ({ onJoin }) => {
    const { t } = useTranslation();
    const [guilds, setGuilds] = useState<any[]>([]);

    useEffect(() => {
        api.getGuildList().then(setGuilds);
    }, []);

    const handleJoin = async (id: number, name: string) => {
        if (!confirm(t('guild.joinConfirm', { name }))) return;
        try {
            await api.joinGuild(id);
            onJoin();
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl">
            <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('guild.listTitle')}</h3>
            <div className="space-y-2">
                {guilds.length === 0 && <p>{t('guild.noGuilds')}</p>}
                {guilds.map(g => (
                    <div key={g.id} className="bg-slate-800/50 p-4 rounded flex justify-between items-center">
                        <div>
                            <span className="font-bold text-white">{g.name}</span> <span className="text-amber-400 font-mono">[{g.tag}]</span>
                            <p className="text-xs text-gray-400">{g.description}</p>
                            <div className="text-xs text-gray-500 mt-1 flex gap-4">
                                <span>{t('guild.membersCount')}: {g.memberCount}/{g.maxMembers}</span>
                                <span>{t('guild.minLevel')}: {g.minLevel}</span>
                                <span>{g.isPublic ? t('guild.public') : t('guild.private')}</span>
                            </div>
                        </div>
                        {g.isPublic && <button onClick={() => handleJoin(g.id, g.name)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-bold">Dołącz</button>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ArmoryPanel: React.FC = () => {
    const { t } = useTranslation();
    const [armoryData, setArmoryData] = useState<{ armoryItems: any[], borrowedItems: any[] }>({ armoryItems: [], borrowedItems: [] });
    const [character, setCharacter] = useState<PlayerCharacter | null>(null);
    const [templates, setTemplates] = useState<ItemTemplate[]>([]);
    
    useEffect(() => {
        Promise.all([
            api.getGuildArmory(),
            api.getCharacter(),
            api.getGameData().then(d => d.itemTemplates)
        ]).then(([armory, char, tpls]) => {
            setArmoryData(armory);
            setCharacter(char);
            setTemplates(tpls || []);
        });
    }, []);

    const handleDeposit = async (item: ItemInstance) => {
        if (!confirm(t('guild.armory.depositConfirm'))) return;
        try {
            await api.depositToArmory(item.uniqueId);
            const [armory, char] = await Promise.all([api.getGuildArmory(), api.getCharacter()]);
            setArmoryData(armory);
            setCharacter(char);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleBorrow = async (armoryId: number, item: ItemInstance, e: React.MouseEvent) => {
        e.stopPropagation();
        const template = templates.find(t => t.id === item.templateId);
        const value = template?.value || 0; // Simplified for tax check display
        const tax = Math.ceil(value * 0.3); // Updated to 30%
        
        if (!confirm(t('guild.armory.borrowConfirm', { value: tax }))) return;

        try {
            await api.borrowFromArmory(armoryId);
            const [armory, char] = await Promise.all([api.getGuildArmory(), api.getCharacter()]);
            setArmoryData(armory);
            setCharacter(char);
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (!character) return <p>Loading...</p>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[60vh]">
            <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col">
                <h4 className="font-bold text-indigo-400 mb-2">{t('guild.armory.title')}</h4>
                <div className="flex-grow overflow-y-auto space-y-2">
                    {armoryData.armoryItems.length === 0 && <p className="text-gray-500">{t('guild.armory.empty')}</p>}
                    {armoryData.armoryItems.map((entry) => {
                        const template = templates.find(t => t.id === entry.item.templateId);
                        if (!template) return null;
                        return (
                            <div key={entry.id} className="relative group">
                                <div className="absolute right-2 top-2 z-10">
                                    <button onClick={(e) => handleBorrow(entry.id, entry.item, e)} className="px-2 py-1 bg-green-700 rounded text-xs hover:bg-green-600">{t('guild.armory.borrow')}</button>
                                </div>
                                <div className="opacity-80 hover:opacity-100 transition-opacity">
                                    {/* Using a simplified item view */}
                                    <div className="bg-slate-800 p-2 rounded border border-slate-700 text-sm">
                                        <p className="font-bold text-white">{template.name}</p>
                                        <p className="text-xs text-gray-400">Od: {entry.ownerName}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col">
                <h4 className="font-bold text-indigo-400 mb-2">{t('guild.armory.myBackpack')}</h4>
                <div className="flex-grow overflow-y-auto space-y-1">
                    {character.inventory.map(item => {
                        const template = templates.find(t => t.id === item.templateId);
                        if (!template) return null;
                        return (
                            <div key={item.uniqueId} className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                <span className="text-sm">{template.name}</span>
                                {!item.isBorrowed && <button onClick={() => handleDeposit(item)} className="px-2 py-1 bg-blue-700 rounded text-xs hover:bg-blue-600">{t('guild.armory.deposit')}</button>}
                                {item.isBorrowed && <span className="text-xs text-indigo-400">{t('guild.armory.itemBorrowed')}</span>}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export const Guild: React.FC<GuildProps> = () => {
    const { t } = useTranslation();
    const [guild, setGuild] = useState<Guild | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'DASHBOARD' | 'MEMBERS' | 'BANK' | 'ARMORY'>('DASHBOARD');
    const [chatMsg, setChatMsg] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const refreshGuild = () => {
        api.getMyGuild().then(setGuild).catch(() => setGuild(null));
    };

    useEffect(() => {
        refreshGuild();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [guild?.chatHistory]);

    const handleLeave = async () => {
        if (!confirm(t('guild.leaveConfirm'))) return;
        await api.leaveGuild();
        setGuild(null);
    };

    const handleSendChat = async (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app this would emit socket, here we assume direct update or socket listener elsewhere
        // Since we don't have socket hook here, we rely on refresh or simple optimistic UI if implemented
        // For now, let's just assume no op or a simple reload for MVP chat without socket context
    };

    if (!guild) {
        return (
            <ContentPanel title={t('guild.title')}>
                <div className="flex gap-4 mb-6">
                    <button onClick={() => setActiveSubTab('DASHBOARD')} className={`px-4 py-2 rounded ${activeSubTab === 'DASHBOARD' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('guild.join')}</button>
                    <button onClick={() => setActiveSubTab('BANK')} className={`px-4 py-2 rounded ${activeSubTab === 'BANK' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('guild.create')}</button>
                </div>
                {activeSubTab === 'DASHBOARD' && <GuildList onJoin={refreshGuild} />}
                {activeSubTab === 'BANK' && <CreateGuildPanel onCreated={refreshGuild} />}
            </ContentPanel>
        );
    }

    return (
        <ContentPanel title={`${t('guild.title')}: ${guild.name} [${guild.tag}]`}>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                <button onClick={() => setActiveSubTab('DASHBOARD')} className={`px-4 py-2 rounded whitespace-nowrap ${activeSubTab === 'DASHBOARD' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('guild.dashboard')}</button>
                <button onClick={() => setActiveSubTab('MEMBERS')} className={`px-4 py-2 rounded whitespace-nowrap ${activeSubTab === 'MEMBERS' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('guild.members')}</button>
                <button onClick={() => setActiveSubTab('BANK')} className={`px-4 py-2 rounded whitespace-nowrap ${activeSubTab === 'BANK' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('guild.bank')}</button>
                <button onClick={() => setActiveSubTab('ARMORY')} className={`px-4 py-2 rounded whitespace-nowrap ${activeSubTab === 'ARMORY' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('guild.armory.title')}</button>
            </div>

            {activeSubTab === 'DASHBOARD' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/40 p-4 rounded-xl">
                        <h4 className="font-bold text-indigo-400 mb-2">{t('guild.chat')}</h4>
                        <div className="h-64 overflow-y-auto bg-slate-800/50 rounded p-2 mb-2 space-y-2">
                            {guild.chatHistory?.map(msg => (
                                <div key={msg.id} className="text-sm">
                                    <span className="font-bold text-amber-400">{msg.characterName}:</span> <span className="text-gray-300">{msg.content}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        {/* Chat input placeholder as socket logic is external */}
                        <p className="text-xs text-gray-500">Czat na żywo dostępny przez Socket.IO</p>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-slate-900/40 p-4 rounded-xl">
                            <h4 className="font-bold text-white">Opis</h4>
                            <p className="text-gray-400 text-sm mt-1">{guild.description}</p>
                        </div>
                        <button onClick={handleLeave} className="w-full py-2 bg-red-800 hover:bg-red-700 rounded font-bold text-white">{t('guild.leave')}</button>
                    </div>
                </div>
            )}

            {activeSubTab === 'MEMBERS' && (
                <div className="bg-slate-900/40 p-4 rounded-xl">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-gray-400 border-b border-slate-700">
                                <th className="p-2">Nazwa</th>
                                <th className="p-2">Rola</th>
                                <th className="p-2">Poziom</th>
                                <th className="p-2">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {guild.members?.map(m => (
                                <tr key={m.userId} className="border-b border-slate-700/50">
                                    <td className="p-2 font-bold text-white">{m.name}</td>
                                    <td className="p-2 text-gray-300">{m.role}</td>
                                    <td className="p-2 text-gray-300">{m.level}</td>
                                    <td className="p-2">
                                        {/* Actions like kick/promote would go here for leaders */}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeSubTab === 'BANK' && (
                <div className="bg-slate-900/40 p-4 rounded-xl">
                    <div className="flex items-center gap-4 mb-6">
                        <CoinsIcon className="h-8 w-8 text-amber-400" />
                        <span className="text-2xl font-mono text-white">{guild.resources.gold.toLocaleString()}</span>
                    </div>
                    {/* Simplified bank UI - full impl would duplicate Resources.tsx logic for deposit */}
                    <p className="text-gray-500 italic">Historia transakcji i wpłaty/wypłaty dostępne wkrótce.</p>
                </div>
            )}

            {activeSubTab === 'ARMORY' && <ArmoryPanel />}
        </ContentPanel>
    );
};
