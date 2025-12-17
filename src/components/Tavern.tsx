
import React, { useState, useEffect, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { TavernMessage, PlayerRank } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { StarIcon } from './icons/StarIcon';
import { useCharacter } from '@/contexts/CharacterContext';

export const Tavern: React.FC<{ messages: TavernMessage[], activeUsers: string[], onSendMessage: (c: string) => void }> = ({ messages, activeUsers, onSendMessage }) => {
    const { character, gameData } = useCharacter();
    const { t } = useTranslation();
    const [newMessage, setNewMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

    const getPlayerRank = (rankId?: string): PlayerRank | null => {
        if (!rankId || !gameData?.playerRanks) return null;
        return gameData.playerRanks.find(r => r.id === rankId) || null;
    };

    return (
        <ContentPanel title={t('tavern.title')}>
            <div className="flex gap-6 h-[75vh]">
                <div className="flex-grow bg-slate-900/40 p-4 rounded-xl flex flex-col">
                    <div ref={scrollRef} className="flex-grow overflow-y-auto space-y-4 pr-2">
                        {messages.map((msg) => {
                            const isMe = msg.user_id === character?.id;
                            const rank = getPlayerRank((msg as any).activeRankId);
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xl p-3 rounded-lg ${isMe ? 'bg-indigo-700' : 'bg-slate-800'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {rank && (
                                                <span className="px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-white/5" style={{ 
                                                    backgroundImage: rank.backgroundImageUrl ? `url(${rank.backgroundImageUrl})` : 'none',
                                                    backgroundColor: rank.backgroundImageUrl ? 'transparent' : '#312e81',
                                                    backgroundSize: 'cover',
                                                    color: rank.textColor,
                                                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                                }}>{rank.name}</span>
                                            )}
                                            <span className="font-bold text-xs text-gray-300">{msg.character_name}</span>
                                            <span className="text-[10px] text-gray-500">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <form onSubmit={e => { e.preventDefault(); if(newMessage.trim()) { onSendMessage(newMessage); setNewMessage(''); }}} className="mt-4 flex gap-2">
                        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Napisz coś..." className="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none" />
                        <button disabled={!newMessage.trim()} className="px-6 py-2 bg-indigo-600 rounded-lg font-bold disabled:bg-slate-700">Wyślij</button>
                    </form>
                </div>
                <div className="w-64 bg-slate-900/40 p-4 rounded-xl hidden md:block">
                    <h3 className="font-bold text-indigo-400 mb-4 border-b border-slate-700 pb-2">Bywalcy ({activeUsers.length})</h3>
                    <ul className="space-y-1 overflow-y-auto max-h-[60vh]">
                        {activeUsers.map(name => <li key={name} className="text-sm text-gray-400 flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span>{name}</li>)}
                    </ul>
                </div>
            </div>
        </ContentPanel>
    );
};
