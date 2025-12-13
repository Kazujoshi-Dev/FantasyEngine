
import React, { useEffect, useRef } from 'react';
import { GuildChatMessage } from '../../types';

interface GuildChatProps {
    guildId: number;
    messages: GuildChatMessage[];
    onMessageReceived: (msg: GuildChatMessage) => void;
}

export const GuildChat: React.FC<GuildChatProps> = ({ messages }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex-grow bg-slate-900/40 p-4 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
            <h3 className="text-lg font-bold text-amber-400 mb-4 border-b border-slate-700 pb-2">Czat Gildii</h3>
            
            <div ref={chatContainerRef} className="flex-grow overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar">
                {messages.length === 0 && <p className="text-gray-500 text-center text-sm mt-10">Brak wiadomości. Rozpocznij rozmowę!</p>}
                {messages.map((msg) => (
                    <div key={msg.id} className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className={`font-bold text-sm ${msg.role === 'LEADER' ? 'text-amber-400' : msg.role === 'OFFICER' ? 'text-indigo-400' : 'text-gray-300'}`}>
                                {msg.characterName}
                            </span>
                            <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-sm text-gray-200 break-words">{msg.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
