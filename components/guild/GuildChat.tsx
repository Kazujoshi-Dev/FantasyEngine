
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../../api';
import { GuildChatMessage, GuildRole } from '../../types';

export const GuildChat: React.FC<{ guildId: number, messages: GuildChatMessage[], onMessageReceived: (msg: GuildChatMessage) => void }> = ({ guildId, messages, onMessageReceived }) => {
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState<any | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const socketUrl = window.location.port === '3000' ? 'http://localhost:3001' : '/';
        const token = getAuthToken();
        
        // FORCED POLLING: Using strict polling to prevent "WebSocket connection failed" errors
        // on environments where WSS isn't properly proxied (e.g. standard Nginx proxy_pass without upgrade).
        const newSocket: any = io(socketUrl, {
            transports: ['polling'], 
            upgrade: false, // Crucial: Tells the client NOT to try upgrading to WebSocket
            withCredentials: true,
            auth: {
                token: token
            }
        });

        newSocket.on('connect', () => {
            newSocket.emit('join_guild', guildId, token);
        });

        newSocket.on('receive_guild_message', (msg: GuildChatMessage) => {
            onMessageReceived(msg);
        });
        
        newSocket.on('connect_error', (err: any) => {
             console.debug("Guild Chat socket connection issue:", err.message);
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

    const renderContentWithLinks = (content: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = content.split(urlRegex);
        
        return parts.map((part, index) => {
            if (part.match(urlRegex)) {
                return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="flex flex-col h-[500px] bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex-grow overflow-y-auto p-4 space-y-2" ref={scrollRef}>
                {messages.map(msg => (
                    <div key={msg.id} className="text-sm">
                        <span className={`font-bold ${msg.role === GuildRole.LEADER ? 'text-amber-400' : msg.role === GuildRole.OFFICER ? 'text-indigo-400' : 'text-gray-300'}`}>
                            {msg.characterName}:
                        </span>
                        <span className="text-gray-200 ml-2 break-all">{renderContentWithLinks(msg.content)}</span>
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
