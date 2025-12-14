
import React, { useState } from 'react';
import { GameSettings } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface GeneralTabProps {
    settings?: GameSettings;
    onSettingsUpdate: (settings: GameSettings) => void;
    onForceTraderRefresh: () => void;
    onSendGlobalMessage: (data: { subject: string, content: string }) => Promise<void>;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onSettingsUpdate, onForceTraderRefresh, onSendGlobalMessage }) => {
    const { t } = useTranslation();
    const [localSettings, setLocalSettings] = useState<GameSettings>(settings || { language: 'pl' } as any);
    const [globalMsg, setGlobalMsg] = useState({ subject: '', content: '' });

    const handleSave = () => {
        onSettingsUpdate(localSettings);
        alert(t('admin.general.save') + '!');
    };

    const handleGlobalMessage = async () => {
        if (!globalMsg.subject || !globalMsg.content) return alert(t('admin.globalMessage.validationError'));
        try {
            await onSendGlobalMessage(globalMsg);
            alert(t('admin.globalMessage.sendSuccess'));
            setGlobalMsg({ subject: '', content: '' });
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Global Actions */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">{t('admin.globalMessage.title')}</h3>
                <div className="space-y-4">
                    <input 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                        placeholder="Temat"
                        value={globalMsg.subject}
                        onChange={e => setGlobalMsg({...globalMsg, subject: e.target.value})}
                    />
                    <textarea 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                        rows={3} 
                        placeholder={t('admin.globalMessage.contentPlaceholder')}
                        value={globalMsg.content}
                        onChange={e => setGlobalMsg({...globalMsg, content: e.target.value})}
                    />
                    <button onClick={handleGlobalMessage} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-bold">
                        {t('admin.globalMessage.sendButton')}
                    </button>
                </div>
            </div>

            {/* Trader Settings */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">{t('admin.traderActions')}</h3>
                    <button onClick={() => { if(confirm(t('admin.traderRefreshConfirm'))) onForceTraderRefresh() }} className="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-white font-bold text-sm">
                        {t('admin.forceTraderRefresh')}
                    </button>
                </div>
            </div>

            {/* Game Settings JSON */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">{t('admin.gameSettings')} (JSON)</h3>
                <textarea 
                    className="w-full h-64 bg-slate-900 font-mono text-xs text-green-400 p-4 rounded border border-slate-600"
                    value={JSON.stringify(localSettings, null, 2)}
                    onChange={e => {
                        try {
                            setLocalSettings(JSON.parse(e.target.value));
                        } catch(err) {
                            // ignore parse error while typing
                        }
                    }}
                />
                <button onClick={handleSave} className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold">
                    {t('admin.general.save')}
                </button>
            </div>
        </div>
    );
};
