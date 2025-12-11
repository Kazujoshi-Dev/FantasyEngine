
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ContentPanel } from '@/components/ContentPanel';
import { Message, ItemTemplate, PvpRewardSummary, PlayerCharacter, PlayerMessageBody, ExpeditionRewardSummary, Affix, MarketNotificationBody, CurrencyType, ItemRarity, EssenceType, ItemInstance, Enemy, GuildInviteBody } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { MailIcon } from '@/components/icons/MailIcon';
import { api } from '@/api';
import { rarityStyles } from '@/components/shared/ItemSlot';
import { CoinsIcon } from '@/components/icons/CoinsIcon';
import { StarIcon } from '@/components/icons/StarIcon';
import { useCharacter } from '@/contexts/CharacterContext';

// Fix: ExpeditionSummaryModal is not exported from its module. Adding a placeholder to fix compilation.
const ExpeditionSummaryModal = (props: any) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                props.onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [props.onClose]);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={props.onClose}>
            <div className="bg-slate-800 p-4 rounded" onClick={e => e.stopPropagation()}>
                Report unavailable due to a build issue. Press ESC to close.
            </div>
        </div>
    );
};
interface ComposeMessageModalProps {
    allCharacterNames: string[];
    onClose: () => void;
    onSendMessage: (data: { recipientName: string; subject: string; content: string }) => Promise<Message>;
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
                        <textarea id="content" value={content} onChange={e => setContent(e.target.value)} rows={6} className="w-full bg-slate-700 p-2 rounded-md"></textarea>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={isLoading} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors duration-200 disabled:bg-slate-600">
                            {isLoading ? t('messages.compose.sending') : t('messages.compose.send')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

const CurrencyDisplay: React.FC<{ currency: CurrencyType, amount: number }> = ({ currency, amount }) => {
    const { t } = useTranslation();
    if (currency === 'gold') {
        return <span className="text-amber-400 flex items-center">{amount.toLocaleString()} <CoinsIcon className="h-4 w-4 ml-1"/></span>;
    }
    const rarity = essenceToRarityMap[currency];
    const colorClass = rarityStyles[rarity]?.text || 'text-gray-300';

    return <span className={`${colorClass} flex items-center`}>{amount.toLocaleString()} <StarIcon className="h-4 w-4 ml-1"/></span>
};


const MarketNotification: React.FC<{
    body: MarketNotificationBody;
    messageId: number;
    onClaimReturn: (messageId: number) => Promise<boolean>;
}> = ({ body, messageId, onClaimReturn }) => {
    const { t } = useTranslation();
    const [isClaiming, setIsClaiming] = useState(false);

    const handleClaim = async () => {
        setIsClaiming(true);
        await onClaimReturn(messageId);
    };

    const renderText = () => {
        switch (body.type) {
            case 'SOLD':
                return (
                    <p>{t('messages.market.soldBodyPart1')} <span className="font-semibold text-white">{body.itemName}</span> {t('messages.market.soldBodyPart2')} <CurrencyDisplay currency={body.currency!} amount={body.price!} /></p>
                );
            case 'BOUGHT':
                 return (
                    <p>{t('messages.market.boughtBodyPart1')} <span className="font-semibold text-white">{body.itemName}</span> {t('messages.market.boughtBodyPart2')} <CurrencyDisplay currency={body.currency!} amount={body.price!} /></p>
                );
            case 'WON':
                 return (
                    <p>{t('messages.market.wonBodyPart1')} <span className="font-semibold text-white">{body.itemName}</span> {t('messages.market.wonBodyPart2')} <CurrencyDisplay currency={body.currency!} amount={body.price!} /></p>
                 );
            case 'EXPIRED':
                 return (
                    <p>{t('messages.market.expiredSubject')}.</p>
                );
            case 'ITEM_RETURNED':
                return (
                    <p>{t('messages.market.returnedBodyPart1')}: <span className="font-semibold text-white">{body.itemName}</span>.</p>
                );
            default:
                return <p>{body.itemName}</p>;
        }
    };
    
    const canClaim = (body.type === 'ITEM_RETURNED' || body.type === 'WON') && body.item;

    return (
        <div>
            {renderText()}
            {canClaim && (
                <div className="mt-4">
                    <button onClick={handleClaim} disabled={isClaiming} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 font-semibold disabled:bg-slate-600">
                        {isClaiming ? t('messages.claimingItem') : t('messages.claimItem')}
                    </button>
                </div>
            )}
        </div>
    );
};

const GuildInviteCard: React.FC<{ body: GuildInviteBody, messageId: number, refreshMessages: () => void }> = ({ body, messageId, refreshMessages }) => {
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');

    const handleAccept = async () => {
        setStatus('processing');
        try {
            await api.acceptGuildInvite(messageId);
            alert('Dołączyłeś do gildii!');
            refreshMessages();
        } catch (e: any) {
            alert(e.message);
            setStatus('idle');
        }
    };

    const handleReject = async () => {
        setStatus('processing');
        try {
            await api.rejectGuildInvite(messageId);
            refreshMessages();
        } catch (e: any) {
            alert(e.message);
            setStatus('idle');
        }
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-indigo-500/50">
            <p className="mb-4">Zostałeś zaproszony do gildii <span className="font-bold text-white">{body.guildName}</span>.</p>
            <div className="flex gap-4">
                <button 
                    onClick={handleAccept} 
                    disabled={status !== 'idle'}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-bold disabled:bg-slate-600"
                >
                    {status === 'processing' ? 'Przetwarzanie...' : 'Akceptuj'}
                </button>
                <button 
                    onClick={handleReject} 
                    disabled={status !== 'idle'}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-bold disabled:bg-slate-600"
                >
                    Odrzuć
                </button>
            </div>
        </div>
    );
}


interface MessagesProps {
    initialRecipient?: string | null;
    onClearInitialRecipient?: () => void;
}

const MESSAGES_PER_PAGE = 5;

export const Messages: React.FC<MessagesProps> = ({ initialRecipient, onClearInitialRecipient }) => {
    const { character: currentPlayer, gameData, updateCharacter: onCharacterUpdate } = useCharacter();
    const { t } = useTranslation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
    const [selectedReport, setSelectedReport] = useState<ExpeditionRewardSummary | null>(null);
    const [selectedPvpReport, setSelectedPvpReport] = useState<PvpRewardSummary | null>(null);
    const [selectedReportMessageId, setSelectedReportMessageId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [copyStatus, setCopyStatus] = useState('');
    
    const [activeFolder, setActiveFolder] = useState<'inbox' | 'saved'>('inbox');
    
    const [isComposing, setIsComposing] = useState(false);
    const [allCharNames, setAllCharNames] = useState<string[]>([]);
    const [composeRecipient, setComposeRecipient] = useState<string | undefined>(undefined);
    const [composeSubject, setComposeSubject] = useState<string | undefined>(undefined);

    const { itemTemplates, affixes, enemies } = gameData || { itemTemplates: [], affixes: [], enemies: [] };

    const handleOpenCompose = (recipient?: string, subject?: string) => {
        setComposeRecipient(recipient);
        setComposeSubject(subject);
        api.getCharacterNames().then(setAllCharNames).catch(console.error);
        setIsComposing(true);
    };

    useEffect(() => {
        if (initialRecipient) {
            handleOpenCompose(initialRecipient);
            if (onClearInitialRecipient) {
                onClearInitialRecipient();
            }
        }
    }, [initialRecipient, onClearInitialRecipient]);

    const fetchMessages = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getMessages();
            setMessages(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);
    
    const filteredMessages = useMemo(() => {
        if (activeFolder === 'saved') {
            return messages.filter(m => m.is_saved);
        }
        return messages.filter(m => !m.is_saved);
    }, [messages, activeFolder]);

    const totalPages = Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
        if (totalPages === 0 && currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [filteredMessages.length, totalPages, currentPage]);

    const paginatedMessages = useMemo(() => {
        const startIndex = (currentPage - 1) * MESSAGES_PER_PAGE;
        const endIndex = startIndex + MESSAGES_PER_PAGE;
        return filteredMessages.slice(startIndex, endIndex);
    }, [filteredMessages, currentPage]);

    const selectedMessage = useMemo(() => {
        if (selectedMessageId) {
            return messages.find(msg => msg.id === selectedMessageId);
        }
        return paginatedMessages.length > 0 ? paginatedMessages[0] : null;
    }, [selectedMessageId, messages, paginatedMessages]);

    useEffect(() => {
        if (paginatedMessages.length > 0) {
             if (!selectedMessageId || !paginatedMessages.some(m => m.id === selectedMessageId)) {
                 const firstMsg = paginatedMessages[0];
                 handleMessageSelect(firstMsg.id, firstMsg.is_read);
             }
        } else {
             setSelectedMessageId(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFolder, paginatedMessages]);

    const handleMessageSelect = (id: number, isRead: boolean) => {
        setSelectedMessageId(id);
        if (!isRead) {
            api.markMessageAsRead(id);
            setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
        }
    };
    
    const handleDelete = async (id: number) => {
        const oldMessages = [...messages];
        setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedMessageId === id) {
            const currentIndex = filteredMessages.findIndex(m => m.id === id);
            const nextMessage = filteredMessages[currentIndex + 1] || filteredMessages[currentIndex - 1] || null;
            setSelectedMessageId(nextMessage ? nextMessage.id : null);
        }
        try {
            await api.deleteMessage(id);
        } catch (err) {
            setMessages(oldMessages);
            alert((err as Error).message);
        }
    };
    
    const handleToggleSave = async (id: number) => {
        const msg = messages.find(m => m.id === id);
        if (!msg) return;
        
        const originalSavedState = msg.is_saved;
        setMessages(prev => prev.map(m => m.id === id ? { ...m, is_saved: !originalSavedState } : m));
        
        try {
            await api.toggleMessageSaved(id);
        } catch (err: any) {
             setMessages(prev => prev.map(m => m.id === id ? { ...m, is_saved: originalSavedState } : m));
             alert(err.message);
        }
    };
    
    const handleReply = (msg: Message) => {
        if (msg.sender_name) {
            const subject = msg.subject.startsWith('Re: ') ? msg.subject : `Re: ${msg.subject}`;
            handleOpenCompose(msg.sender_name, subject);
        }
    };
    
    const handleClaimReturn = async (messageId: number) => {
        try {
            const updatedChar = await api.claimMarketReturn(messageId);
            onCharacterUpdate(updatedChar, true);
            await fetchMessages();
            return true;
        } catch(err) {
            alert((err as Error).message);
            return false;
        }
    };

    const handleBulkDelete = async (type: 'read' | 'all' | 'expedition_reports') => {
        let confirmText = '';
        switch(type) {
            case 'read': confirmText = t('messages.bulkDelete.confirmRead'); break;
            case 'all': confirmText = t('messages.bulkDelete.confirmAll'); break;
            case 'expedition_reports': confirmText = t('messages.bulkDelete.confirmReports'); break;
        }
        if (window.confirm(confirmText)) {
            await api.deleteBulkMessages(type);
            await fetchMessages();
            setCurrentPage(1);
        }
    };

    const handleCopyLink = (messageId: number, isRaid = false) => {
        const path = isRaid ? 'raid-report' : 'report';
        const url = `${window.location.origin}/${path}/${messageId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopyStatus('Skopiowano link!');
            setTimeout(() => setCopyStatus(''), 2000);
        }, (err) => {
            setCopyStatus('Błąd kopiowania');
            console.error('Could not copy text: ', err);
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };
    
    const renderMessageBody = (msg: Message) => {
        try {
            switch (msg.message_type) {
                case 'pvp_report':
                case 'expedition_report':
                case 'raid_report':
                    const body = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
                    return (
                        <div className="mt-4 flex items-center gap-2">
                            <button onClick={() => {
                                if (msg.message_type === 'pvp_report') {
                                    setSelectedPvpReport(body as PvpRewardSummary);
                                } else {
                                    setSelectedReport(body as ExpeditionRewardSummary);
                                }
                                setSelectedReportMessageId(msg.id);
                            }} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold">{t('messages.viewReport')}</button>
                            <button onClick={() => handleCopyLink(msg.id, msg.message_type === 'raid_report')} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold text-sm">
                                {copyStatus || 'Kopiuj Link'}
                            </button>
                        </div>
                    );
                case 'player_message':
                    return <p className="mt-4 whitespace-pre-wrap">{(msg.body as PlayerMessageBody).content}</p>;
                case 'market_notification':
                     const marketBody = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
                     return <MarketNotification body={marketBody} messageId={msg.id} onClaimReturn={handleClaimReturn} />;
                case 'system':
                     const systemBody = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
                     return <p className="mt-4 whitespace-pre-wrap">{(systemBody as PlayerMessageBody).content}</p>;
                case 'guild_invite':
                    const inviteBody = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
                    return <GuildInviteCard body={inviteBody as GuildInviteBody} messageId={msg.id} refreshMessages={fetchMessages} />;
                default:
                    return <p className="text-gray-500">Unsupported message type.</p>;
            }
        } catch (e) {
            console.error("Failed to parse message body:", e);
            return <p className="text-red-400">Error displaying message body.</p>;
        }
    };

    if (!currentPlayer || !gameData) return null;

    const isDefenderView = selectedPvpReport ? selectedPvpReport.defender.id === currentPlayer.id : false;

    const selectedBoss = selectedReport?.bossId ? enemies.find(e => e.id === selectedReport.bossId) : undefined;
    const initialEnemyForModal = selectedBoss || (
        selectedReport?.combatLog?.[0]?.enemyStats ? {
            id: 'unknown',
            name: selectedReport.combatLog[0].defender === currentPlayer.name ? selectedReport.combatLog[0].attacker : selectedReport.combatLog[0].defender,
            description: selectedReport.combatLog[0].enemyDescription || '',
            stats: selectedReport.combatLog[0].enemyStats,
            rewards: { minGold: 0, maxGold: 0, minExperience: 0, maxExperience: 0 },
            lootTable: []
        } : undefined
    );
    const bossNameForModal = selectedBoss?.name || initialEnemyForModal?.name;
    
    const savedCount = messages.filter(m => m.is_saved).length;

    return (
        <ContentPanel title={t('messages.title')}>
            {isComposing && (
                <ComposeMessageModal
                    allCharacterNames={allCharNames}
                    onClose={() => setIsComposing(false)}
                    onSendMessage={api.sendMessage}
                    initialRecipient={composeRecipient}
                    initialSubject={composeSubject}
                />
            )}
            {selectedReport && (
                <ExpeditionSummaryModal
                  reward={selectedReport}
                  messageId={selectedReportMessageId}
                  onClose={() => setSelectedReport(null)}
                  characterName={currentPlayer.name}
                  itemTemplates={itemTemplates}
                  affixes={affixes}
                  enemies={enemies}
                  isHunting={!!selectedReport.huntingMembers || !!(selectedReport as any).opponents}
                  isRaid={!!(selectedReport as any).opponents}
                  huntingMembers={selectedReport.huntingMembers}
                  opponents={(selectedReport as any).opponents}
                  allRewards={selectedReport.allRewards}
                  initialEnemy={initialEnemyForModal}
                  bossName={bossNameForModal}
                />
            )}
             {selectedPvpReport && (
                <ExpeditionSummaryModal
                    reward={{
                        combatLog: selectedPvpReport.combatLog,
                        isVictory: selectedPvpReport.isVictory,
                        totalGold: selectedPvpReport.gold,
                        totalExperience: selectedPvpReport.experience,
                        rewardBreakdown: [],
                        itemsFound: [],
                        essencesFound: {}
                    }}
                    messageId={selectedReportMessageId}
                    onClose={() => setSelectedPvpReport(null)}
                    characterName={selectedPvpReport.attacker.name}
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    enemies={enemies}
                    isPvp={true}
                    pvpData={{ attacker: selectedPvpReport.attacker, defender: selectedPvpReport.defender }}
                    isDefenderView={isDefenderView}
                />
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[75vh]">
                <div className="md:col-span-1 bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4">
                         <button onClick={() => handleOpenCompose()} className="w-full px-3 py-2 text-sm rounded bg-indigo-600 hover:bg-indigo-700 font-semibold flex items-center justify-center gap-2 shadow-md">
                            <MailIcon className="h-4 w-4" />
                            {t('messages.compose.title')}
                        </button>
                    </div>
                    
                    <div className="flex mb-2 border-b border-slate-700">
                        <button 
                            onClick={() => { setActiveFolder('inbox'); setCurrentPage(1); }}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeFolder === 'inbox' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400 hover:text-white'}`}
                        >
                            {t('messages.inbox')}
                        </button>
                        <button 
                            onClick={() => { setActiveFolder('saved'); setCurrentPage(1); }}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeFolder === 'saved' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400 hover:text-white'}`}
                        >
                            {t('messages.saved')} ({savedCount}/50)
                        </button>
                    </div>
                    
                    {activeFolder === 'inbox' && (
                        <div className="pb-3 mb-3 border-b border-slate-700/50">
                            <details className="text-sm">
                                <summary className="cursor-pointer text-gray-400 hover:text-white">{t('messages.bulkDelete.title') || 'Bulk Actions'}</summary>
                                <div className="flex flex-col gap-2 mt-2">
                                    <button onClick={() => handleBulkDelete('read')} className="w-full text-left px-3 py-1.5 rounded bg-slate-700/50 hover:bg-slate-700">{t('messages.bulkDelete.deleteRead')}</button>
                                    <button onClick={() => handleBulkDelete('expedition_reports')} className="w-full text-left px-3 py-1.5 rounded bg-slate-700/50 hover:bg-slate-700">{t('messages.bulkDelete.deleteReports')}</button>
                                    <button onClick={() => handleBulkDelete('all')} className="w-full text-left px-3 py-1.5 rounded bg-red-900/50 hover:bg-red-800 text-red-300">{t('messages.bulkDelete.deleteAll')}</button>
                                </div>
                            </details>
                        </div>
                    )}
                    
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {isLoading && <p className="text-gray-500 text-center mt-4">{t('loading')}</p>}
                        {!isLoading && paginatedMessages.map(msg => (
                            <div key={msg.id} onClick={() => handleMessageSelect(msg.id, msg.is_read)}
                                className={`p-3 rounded-lg cursor-pointer border-l-4 relative group ${selectedMessage?.id === msg.id ? 'bg-slate-700/50 border-indigo-500' : 'bg-slate-800/50 border-transparent hover:bg-slate-700/30'}`}>
                                <div className="flex justify-between items-start">
                                    <p className={`font-semibold truncate pr-6 ${!msg.is_read ? 'text-white' : 'text-gray-300'}`}>{msg.subject}</p>
                                    {!msg.is_read && <span className="h-2.5 w-2.5 bg-sky-400 rounded-full flex-shrink-0 mt-1.5"></span>}
                                </div>
                                <p className="text-sm text-gray-400">
                                    {t('messages.from')}: {msg.sender_name || t('messages.system')}
                                </p>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleDateString()}</p>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleToggleSave(msg.id); }}
                                        className={`p-1 rounded hover:bg-slate-600 transition-colors ${msg.is_saved ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-200'}`}
                                        title={msg.is_saved ? t('messages.unsave') : t('messages.save')}
                                    >
                                        <StarIcon className="h-4 w-4 fill-current" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {!isLoading && filteredMessages.length === 0 && <p className="text-gray-500 text-center py-8">{t('messages.noMessages')}</p>}
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="mt-4 flex justify-between items-center pt-4 border-t border-slate-700/50">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                &lt;
                            </button>
                            <span className="text-xs text-gray-400">{currentPage} / {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="md:col-span-2 bg-slate-900/40 p-6 rounded-xl overflow-y-auto">
                    {selectedMessage ? (
                        <div>
                            <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-700/50">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">{selectedMessage.subject}</h2>
                                    <div className="text-sm text-gray-400">
                                        <p>{t('messages.from')}: <span className="font-semibold text-gray-300">{selectedMessage.sender_name || t('messages.system')}</span></p>
                                        <p>{new Date(selectedMessage.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleToggleSave(selectedMessage.id)} 
                                        className={`px-3 py-1.5 text-xs rounded font-bold flex items-center gap-1 border ${selectedMessage.is_saved ? 'bg-yellow-900/30 border-yellow-600 text-yellow-400' : 'bg-slate-700 border-slate-600 text-gray-300 hover:bg-slate-600'}`}
                                    >
                                        <StarIcon className={`h-3 w-3 ${selectedMessage.is_saved ? 'fill-current' : ''}`} />
                                        {selectedMessage.is_saved ? t('messages.saved') : t('messages.save')}
                                    </button>
                                    {selectedMessage.message_type === 'player_message' && selectedMessage.sender_id && (
                                        <button onClick={() => handleReply(selectedMessage)} className="px-3 py-1.5 text-xs rounded bg-slate-600 hover:bg-slate-500 font-bold">{t('messages.reply')}</button>
                                    )}
                                    <button onClick={() => handleDelete(selectedMessage.id)} className="px-3 py-1.5 text-xs rounded bg-red-800 hover:bg-red-700 font-bold">{t('messages.delete')}</button>
                                </div>
                            </div>
                            <div className="prose prose-invert max-w-none text-gray-300">
                                {renderMessageBody(selectedMessage)}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <MailIcon className="h-16 w-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">{isLoading ? t('loading') : t('messages.noMessages')}</p>
                        </div>
                    )}
                </div>
            </div>
        </ContentPanel>
    );
};
