

import React, { useState, useMemo, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { Message, ItemTemplate, PvpRewardSummary, PlayerCharacter, PlayerMessageBody, ExpeditionRewardSummary } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { ExpeditionSummaryModal } from './Expedition';
import { MailIcon } from './icons/MailIcon';
import { api } from '../api';

interface ComposeMessageModalProps {
    allCharacterNames: string[];
    onClose: () => void;
    onSendMessage: (data: { recipientName: string; subject: string; content: string }) => Promise<void>;
    initialRecipient?: string;
    initialSubject?: string;
}

export const ComposeMessageModal: React.FC<ComposeMessageModalProps> = ({ allCharacterNames, onClose, onSendMessage, initialRecipient = '', initialSubject = '' }) => {
    const { t } = useTranslation();
    const [recipient, setRecipient] = useState(initialRecipient);
    const [subject, setSubject] = useState(initialSubject);
    const [content, setContent] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (recipient.length > 1) {
            const filtered = allCharacterNames.filter(name =>
                name.toLowerCase().includes(recipient.toLowerCase())
            );
            setSuggestions(filtered.slice(0, 5));
        } else {
            setSuggestions([]);
        }
    }, [recipient, allCharacterNames]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipient || !subject || !content) {
            setError('All fields are required.');
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            await onSendMessage({ recipientName: recipient, subject, content });
            setSuccess(t('messages.compose.success'));
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                <h2 className="text-3xl font-bold mb-6 text-indigo-400">{t('messages.compose.title')}</h2>
                {error && <p className="bg-red-900/50 border border-red-700 text-red-300 text-center p-3 rounded-lg mb-4">{error}</p>}
                {success && <p className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg mb-4">{success}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <label htmlFor="recipient" className="block text-sm font-medium text-gray-300 mb-1">{t('messages.compose.to')}</label>
                        <input type="text" id="recipient" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={t('messages.compose.toPlaceholder')} className="w-full bg-slate-700 p-2 rounded-md" />
                        {suggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-slate-900 border border-slate-700 rounded-md mt-1 max-h-40 overflow-y-auto">
                                {suggestions.map(name => (
                                    <li key={name} onClick={() => { setRecipient(name); setSuggestions([]); }} className="px-4 py-2 cursor-pointer hover:bg-indigo-600">{name}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-1">{t('messages.compose.subject')}</label>
                        <input type="text" id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder={t('messages.compose.subjectPlaceholder')} className="w-full bg-slate-700 p-2 rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-1">{t('messages.compose.content')}</label>
                        <textarea id="content" value={content} onChange={e => setContent(e.target.value)} rows={6} className="w-full bg-slate-700 p-2 rounded-md" />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:bg-slate-500">{isLoading ? t('messages.compose.sending') : t('messages.compose.send')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface ViewMessageModalProps {
    message: Message;
    onClose: () => void;
    onReply: (message: Message) => void;
    onDelete: (messageId: number) => void;
}

const ViewMessageModal: React.FC<ViewMessageModalProps> = ({ message, onClose, onReply, onDelete }) => {
    const { t } = useTranslation();
    const content = (message.body as PlayerMessageBody).content;

    return (
         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-2 text-indigo-400">{message.subject}</h2>
                <div className="flex justify-between items-baseline text-sm text-gray-400 mb-4 border-b border-slate-700 pb-2">
                    <span>{t('messages.from')}: <span className="font-semibold text-gray-300">{message.sender_name}</span></span>
                    <span>{new Date(message.created_at).toLocaleString()}</span>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg max-h-80 overflow-y-auto">
                    <p className="whitespace-pre-wrap">{content}</p>
                </div>
                <div className="flex justify-end gap-4 pt-6">
                    <button type="button" onClick={() => { onDelete(message.id); onClose(); }} className="px-4 py-2 rounded-md bg-red-800 hover:bg-red-700 text-white font-semibold">{t('messages.delete')}</button>
                    <button type="button" onClick={() => { onReply(message); onClose(); }} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('messages.reply')}</button>
                </div>
            </div>
        </div>
    )
}


interface MessagesProps {
    messages: Message[];
    onDeleteMessage: (messageId: number) => void;
    onMarkAsRead: (messageId: number) => void;
    onCompose: (recipientName?: string, subject?: string) => void;
    itemTemplates: ItemTemplate[];
    currentPlayer: PlayerCharacter;
}

export const Messages: React.FC<MessagesProps> = ({ messages, onDeleteMessage, onMarkAsRead, onCompose, itemTemplates, currentPlayer }) => {
    const { t } = useTranslation();
    const [viewingMessage, setViewingMessage] = useState<Message | null>(null);
    const [viewingPvpReport, setViewingPvpReport] = useState<{ report: PvpRewardSummary, isDefenderView: boolean } | null>(null);
    const [viewingExpeditionReport, setViewingExpeditionReport] = useState<ExpeditionRewardSummary | null>(null);

    const sortedMessages = useMemo(() => {
        return [...messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [messages]);

    const handleMessageClick = (msg: Message) => {
        if (!msg.is_read) {
            onMarkAsRead(msg.id);
        }
        if (msg.message_type === 'pvp_report') {
            const isDefender = (msg.body as PvpRewardSummary).defender.id === currentPlayer.id;
            setViewingPvpReport({ report: msg.body as PvpRewardSummary, isDefenderView: isDefender });
        } else if (msg.message_type === 'expedition_report') {
            setViewingExpeditionReport(msg.body as ExpeditionRewardSummary);
        } else {
            setViewingMessage(msg);
        }
    };
    
    const handleReply = (message: Message) => {
        if (!message.sender_name) return;
        const subject = message.subject.startsWith("Re: ") ? message.subject : `Re: ${message.subject}`;
        onCompose(message.sender_name, subject);
    };

    return (
        <>
            <ContentPanel title={t('messages.title')}>
                <div className="bg-slate-900/40 p-6 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-indigo-400 flex items-center">
                            <MailIcon className="h-5 w-5 mr-2" /> {t('messages.inbox')}
                        </h3>
                        <button onClick={() => onCompose()} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                            {t('messages.compose.title')}
                        </button>
                    </div>

                    <div className="space-y-2">
                        {sortedMessages.length > 0 ? (
                            sortedMessages.map(msg => {
                                const isPlayerMessage = msg.message_type === 'player_message';
                                const sender = msg.sender_name || t('messages.system');
                                return (
                                    <div
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        className={`p-4 rounded-lg flex justify-between items-center transition-colors duration-200 cursor-pointer ${
                                            msg.is_read ? 'bg-slate-800/50 hover:bg-slate-800/80' : 'bg-indigo-900/40 hover:bg-indigo-900/60'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-semibold text-white">{msg.subject}</p>
                                            <p className="text-sm text-gray-400">
                                                {t('messages.from')}: {sender} - {new Date(msg.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMessageClick(msg); }}
                                                className="text-xs bg-slate-700 hover:bg-slate-600 text-white font-semibold px-3 py-1 rounded transition-colors"
                                            >
                                                {isPlayerMessage ? t('messages.view') : t('messages.viewReport')}
                                            </button>
                                            {isPlayerMessage && msg.sender_name &&
                                                <button onClick={(e) => { e.stopPropagation(); handleReply(msg); }} className="text-xs bg-sky-700 hover:bg-sky-600 text-white font-semibold px-3 py-1 rounded transition-colors">{t('messages.reply')}</button>
                                            }
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteMessage(msg.id); }}
                                                className="text-xs bg-red-800/60 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded transition-colors"
                                            >
                                                {t('messages.delete')}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-center text-gray-500 py-8">{t('messages.noMessages')}</p>
                        )}
                    </div>
                </div>
            </ContentPanel>

            {viewingMessage && (
                <ViewMessageModal
                    message={viewingMessage}
                    onClose={() => setViewingMessage(null)}
                    onReply={handleReply}
                    onDelete={onDeleteMessage}
                />
            )}

            {viewingPvpReport && (
                 <ExpeditionSummaryModal
                    reward={{
                        combatLog: viewingPvpReport.report.combatLog,
                        isVictory: viewingPvpReport.report.isVictory,
                        totalGold: viewingPvpReport.report.gold,
                        totalExperience: viewingPvpReport.report.experience,
                        rewardBreakdown: [],
                        itemsFound: [],
                        essencesFound: {}
                    }}
                    onClose={() => setViewingPvpReport(null)}
                    characterName={viewingPvpReport.report.attacker.name}
                    itemTemplates={itemTemplates}
                    isPvp={true}
                    pvpData={{
                        attacker: viewingPvpReport.report.attacker,
                        defender: viewingPvpReport.report.defender,
                    }}
                    isDefenderView={viewingPvpReport.isDefenderView}
                />
            )}

            {viewingExpeditionReport && (
                <ExpeditionSummaryModal
                    reward={viewingExpeditionReport}
                    onClose={() => setViewingExpeditionReport(null)}
                    characterName={currentPlayer.name}
                    itemTemplates={itemTemplates}
                />
            )}
        </>
    );
};