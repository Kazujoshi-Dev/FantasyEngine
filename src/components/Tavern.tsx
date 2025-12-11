
import React, { useState, useEffect, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { TavernMessage } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { StarIcon } from './icons/StarIcon';
import { useCharacter } from '@/contexts/CharacterContext';

interface TavernProps {
    messages: TavernMessage[];
    activeUsers: string[];
    onSendMessage: (content: string) => void;
}

export const Tavern: React.FC<TavernProps> = ({ messages, activeUsers, onSendMessage }) => {
    const { character } = useCharacter();
    const { t } = useTranslation();
    const [newMessage, setNewMessage] = useState('');
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const isInitialMount = useRef(true);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            const behavior = isInitialMount.current ? 'auto' : 'smooth';
            container.scrollTo({
                top: container.scrollHeight,
                behavior: behavior,
            });

            if (isInitialMount.current) {
                isInitialMount.current = false;
            }
        }
    }, [messages]);

    if (!character) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };
    
    const formatTimestamp = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <ContentPanel title={t('tavern.title')}>
            <div className="flex flex-col md:flex-row gap-6 h-[75vh]">
                {/* Left Column: Chat */}
                <div className="flex-grow bg-slate-900/40 p-4 rounded-xl flex flex-col min-w-0">
                    <div ref={messagesContainerRef} className="flex-grow overflow-y-auto pr-4 space-y-4">
                        {messages.map((msg) => {
                            const isMe = msg.user_id === character.id;
                            const isAdmin = msg.character_name === 'Kazujoshi';
                            return (
                                <div key={msg.id} className={`flex items-end gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xl p-3 rounded-lg ${isMe ? 'bg-indigo-700 text-white' : 'bg-slate-800'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-bold text-sm ${isAdmin ? 'text-amber-400' : 'text-gray-400'}`}>
                                                {msg.character_name}
                                            </span>
                                            {isAdmin && <StarIcon className="h-4 w-4 text-amber-400" />}
                                            <span className="text-xs text-gray-500">{formatTimestamp(msg.created_at)}</span>
                                        </div>
                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <form onSubmit={handleSubmit} className="flex gap-4">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={t('tavern.placeholder')}
                                className="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                            />
                            <button
                                type="submit"
                                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors duration-200 disabled:bg-slate-600"
                                disabled={!newMessage.trim()}
                            >
                                {t('tavern.send')}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Active Users */}
                <div className="w-full md:w-64 bg-slate-900/40 p-4 rounded-xl flex-shrink-0 overflow-y-auto">
                    <h3 className="text-lg font-bold text-indigo-400 mb-4 border-b border-slate-700/50 pb-2">
                        {t('tavern.activePatrons')} ({activeUsers.length})
                    </h3>
                    <ul className="space-y-2">
                        {activeUsers.map((name, index) => (
                            <li key={index} className="flex items-center text-sm text-gray-300">
                                <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                                {name}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </ContentPanel>
    );
};
