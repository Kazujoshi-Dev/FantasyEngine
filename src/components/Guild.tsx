
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api, getAuthToken } from '../api';
import { Guild as GuildType, GuildRole, ItemTemplate, Affix, PlayerCharacter, Enemy, GameData } from '../types';
import { ShieldIcon } from './icons/ShieldIcon';
import { GuildChat } from './guild/GuildChat';
import { GuildMembers } from './guild/GuildMembers';
import { GuildBuildings } from './guild/GuildBuildings';
import { GuildArmory } from './guild/GuildArmory';
import { GuildBank } from './guild/GuildBank';
import { GuildSettings } from './guild/GuildSettings';
import { GuildHunting } from './guild/GuildHunting';
import { FormattedText } from './guild/GuildSettings';
import { GuildRaids } from './guild/GuildRaids';
import { GuildAltar } from './guild/GuildAltar';
import { io, Socket } from 'socket.io-client';

interface GuildProps {
    onCharacterUpdate?: () => void;
}

export const Guild: React.FC<GuildProps> = ({ onCharacterUpdate }) => {
    const { t } = useTranslation();
    const [guild, setGuild] = useState<GuildType | null>(null);
    const [character, setCharacter] = useState<PlayerCharacter | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'OVERVIEW' | 'MEMBERS' | 'BUILDINGS' | 'ARMORY' | 'BANK' | 'HUNTING' | 'RAIDS' | 'ALTAR' | 'CHAT' | 'SETTINGS'>('OVERVIEW');
    const [availableGuilds, setAvailableGuilds] = useState<any[]>([]);
    
    // Game Data for Armory display
    const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>([]);
    const [affixes, setAffixes] = useState<Affix[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [gameData, setGameData] = useState<GameData | null>(null);

    // Create Form State
    const [newName, setNewName] = useState('');
    const [newTag, setNewTag] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const socketRef = useRef<Socket | null>(null);

    // Stable fetch function
    const fetchGuild = useCallback(async (isBackgroundUpdate = false) => {
        if (!isBackgroundUpdate) setLoading(true);
        try {
            const [data, charData, fullGameData] = await Promise.all([
                api.getMyGuild(),
                api.getCharacter(),
                api.getGameData()
            ]);
            setGuild(data);
            setCharacter(charData);
            setGameData(fullGameData);
            setItemTemplates(fullGameData.itemTemplates);
            setAffixes(fullGameData.affixes);
            setEnemies(fullGameData.enemies);

            if (!data) {
                const list = await api.getGuildList();
                setAvailableGuilds(list);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (!isBackgroundUpdate) setLoading(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        fetchGuild();
    }, [fetchGuild]);

    // Socket.IO Listener for Guild Updates
    useEffect(() => {
        if (!guild?.id) return;

        // Prevent multiple connections
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        const socketUrl = window.location.port === '3000' ? 'http://localhost:3001' : '/';
        const token = getAuthToken();
        
        const socket = io(socketUrl, {
            transports: ['polling'], 
            upgrade: false, 
            withCredentials: true,
            auth: { token }
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join_guild', guild.id, token);
        });
        
        socket.on('connect_error', (err: any) => {
            console.debug('Guild socket connection issue:', err.message);
        });

        // Listen for general guild updates (bank, armory, buildings)
        socket.on('guild_update', () => {
            console.log('Guild update received via socket, refreshing data...');
            fetchGuild(true); // Pass true to fetch in background (no full spinner)
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [guild?.id, fetchGuild]);

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

    const handleNewChatMessage = (msg: any) => {
        setGuild(prev => {
            if (!prev) return null;
            if (prev.chatHistory?.some(m => m.id === msg.id)) return prev;
            return {
                ...prev,
                chatHistory: [...(prev.chatHistory || []), msg]
            };
        });
    };

    if (loading && !guild && availableGuilds.length === 0) return <ContentPanel title={t('guild.title')}><p className="text-gray-400">Ładowanie...</p></ContentPanel>;

    if (!guild) {
        return (
            <ContentPanel title={t('guild.title')}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[72vh] overflow-y-auto pr-2">
                    {/* Create Guild */}
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 h-fit">
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
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 h-fit">
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">Dołącz do Gildii</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {availableGuilds.length === 0 && <p className="text-gray-500">Brak dostępnych gildii.</p>}
                            {availableGuilds.map(g => {
                                const isFull = g.member_count >= g.max_members;
                                return (
                                    <div key={g.id} className="bg-slate-800 p-3 rounded flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-white flex items-center gap-2">
                                                [{g.tag}] {g.name}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                Członków: {g.member_count}/{g.max_members} | Min. Lvl: {g.min_level}
                                            </div>
                                        </div>
                                        {g.is_public && !isFull ? (
                                            <button onClick={() => handleJoin(g.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold">Dołącz</button>
                                        ) : (
                                            <span className="text-gray-500 text-sm px-3 border border-gray-700 rounded bg-slate-900/50 cursor-not-allowed">
                                                {isFull ? 'Pełna' : 'Zamknięta'}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
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
                <button onClick={() => setTab('HUNTING')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'HUNTING' ? 'border-purple-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Polowania</button>
                <button onClick={() => setTab('RAIDS')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'RAIDS' ? 'border-red-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Rajdy</button>
                <button onClick={() => setTab('ALTAR')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'ALTAR' ? 'border-purple-600 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Ołtarz Mroku</button>
                <button onClick={() => setTab('ARMORY')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'ARMORY' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Zbrojownia</button>
                <button onClick={() => setTab('BANK')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'BANK' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Bank</button>
                <button onClick={() => setTab('CHAT')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'CHAT' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Czat</button>
                {isLeader && <button onClick={() => setTab('SETTINGS')} className={`px-4 py-2 border-b-2 transition-colors ${tab === 'SETTINGS' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Ustawienia</button>}
            </div>

            {tab === 'OVERVIEW' && (
                <div className="h-[70vh] overflow-y-auto pr-2">
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
                        <div className="flex flex-col items-center justify-center bg-slate-900/20 p-6 rounded-xl border border-slate-700/30 h-fit">
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
                </div>
            )}

            {tab === 'MEMBERS' && (
                <div className="h-[70vh] overflow-y-auto pr-2">
                    <GuildMembers guild={guild} myRole={guild.myRole} onUpdate={fetchGuild} />
                </div>
            )}
            
            {tab === 'BUILDINGS' && (
                <div className="h-[70vh] overflow-y-auto pr-2">
                    <GuildBuildings guild={guild} myRole={guild.myRole} onUpdate={fetchGuild} />
                </div>
            )}
            
            {tab === 'HUNTING' && (
                 <div className="h-[70vh] overflow-y-auto pr-2">
                    <GuildHunting />
                </div>
            )}
            
            {tab === 'RAIDS' && (
                 <div className="h-[70vh] overflow-y-auto pr-2">
                    <GuildRaids 
                        myGuildId={guild.id} 
                        myRole={guild.myRole} 
                        myUserId={character?.id}
                        itemTemplates={itemTemplates}
                        affixes={affixes}
                        enemies={enemies}
                    />
                </div>
            )}
            
            {tab === 'ALTAR' && <GuildAltar guild={guild} onUpdate={fetchGuild} />}

            {/* GuildArmory handles its own scrolling layout */}
            {tab === 'ARMORY' && <GuildArmory guild={guild} character={character} onUpdate={fetchGuild} templates={itemTemplates} affixes={affixes} />}

            {/* GuildBank handles its own scrolling layout */}
            {tab === 'BANK' && <GuildBank guild={guild} character={character} onTransaction={fetchGuild} />}

            {/* GuildChat handles its own scrolling layout */}
            {tab === 'CHAT' && <GuildChat guildId={guild.id} messages={guild.chatHistory || []} onMessageReceived={handleNewChatMessage} />}

            {tab === 'SETTINGS' && isLeader && (
                <div className="h-[70vh] overflow-y-auto pr-2">
                    <GuildSettings guild={guild} onUpdate={fetchGuild} />
                </div>
            )}

        </ContentPanel>
    );
};
