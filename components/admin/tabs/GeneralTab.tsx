import React, { useState, useEffect } from 'react';
import { GameSettings, ItemRarity } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface GeneralTabProps {
  settings: GameSettings;
  onSettingsUpdate: (settings: GameSettings) => void;
  onForceTraderRefresh: () => void;
  onSendGlobalMessage: (data: { subject: string; content: string }) => Promise<void>;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings: initialSettings, onSettingsUpdate, onForceTraderRefresh, onSendGlobalMessage }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [globalMessage, setGlobalMessage] = useState({ subject: '', content: '' });
  const [isSendingGlobal, setIsSendingGlobal] = useState(false);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name.startsWith('traderRarity-')) {
        const rarity = name.split('-')[1] as ItemRarity;
        setSettings(prev => ({
            ...prev,
            traderSettings: {
                ...(prev.traderSettings || { rarityChances: { [ItemRarity.Common]: 0, [ItemRarity.Uncommon]: 0, [ItemRarity.Rare]: 0 } }),
                rarityChances: {
                    ...prev.traderSettings?.rarityChances,
                    [rarity]: parseInt(value, 10) || 0
                }
            }
        }));
    } else if (name === 'pvpProtectionMinutes') {
        setSettings(prev => ({ ...prev, pvpProtectionMinutes: parseInt(value, 10) || 60 }));
    } else if (name === 'newsContent') {
         setSettings(prev => ({ ...prev, newsContent: value }));
    } else {
        setSettings(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSaveSettings = () => {
    const updatedSettings = { ...settings };
    if (updatedSettings.newsContent !== initialSettings.newsContent) {
        updatedSettings.newsLastUpdatedAt = Date.now();
    }
    onSettingsUpdate(updatedSettings);
  };
  
  const handleSendGlobalMessage = async () => {
    if (!globalMessage.subject || !globalMessage.content) {
        alert(t('admin.globalMessage.validationError'));
        return;
    }
    setIsSendingGlobal(true);
    try {
        await onSendGlobalMessage(globalMessage);
        alert(t('admin.globalMessage.sendSuccess'));
        setGlobalMessage({ subject: '', content: '' });
    } catch (err) {
        // Error is alerted in App.tsx
    } finally {
        setIsSendingGlobal(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
        <div>
             <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.gameSettings')}</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.language')}</label>
                    <select id="language" name="language" value={settings.language} onChange={handleSettingsChange} className="w-full bg-slate-700 p-2 rounded-md">
                        <option value="pl">{t('admin.languages.pl')}</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                     <h4 className="text-lg font-semibold text-gray-300 mb-2">{t('admin.news.title')}</h4>
                     <textarea name="newsContent" value={settings.newsContent || ''} onChange={handleSettingsChange} rows={6} className="w-full bg-slate-700 p-2 rounded-md" placeholder={t('admin.news.content')!}></textarea>
                </div>
             </div>
        </div>

        <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.traderSettings')}</h3>
            <div className="grid grid-cols-3 gap-4">
               {(Object.values(ItemRarity) as ItemRarity[]).filter(r => r !== ItemRarity.Epic && r !== ItemRarity.Legendary).map(rarity => (
                    <div key={rarity}>
                        <label htmlFor={`traderRarity-${rarity}`} className="block text-sm font-medium text-gray-300 mb-1">{t(`rarity.${rarity}`)}</label>
                        <input type="number" id={`traderRarity-${rarity}`} name={`traderRarity-${rarity}`} value={settings.traderSettings?.rarityChances[rarity] || 0} onChange={handleSettingsChange} className="w-full bg-slate-700 p-2 rounded-md"/>
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('admin.traderSettings.rarityChancesDesc')}</p>
        </div>

         <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.traderActions')}</h3>
            <button onClick={onForceTraderRefresh} className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white font-semibold">{t('admin.forceTraderRefresh')}</button>
        </div>
        
         <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.globalMessage.title')}</h3>
            <div className="space-y-4">
                <input type="text" value={globalMessage.subject} onChange={e => setGlobalMessage(p => ({...p, subject: e.target.value}))} placeholder={t('messages.compose.subjectPlaceholder')} className="w-full bg-slate-700 p-2 rounded-md" />
                <textarea value={globalMessage.content} onChange={e => setGlobalMessage(p => ({...p, content: e.target.value}))} rows={4} placeholder={t('admin.globalMessage.contentPlaceholder')} className="w-full bg-slate-700 p-2 rounded-md"></textarea>
                <button onClick={handleSendGlobalMessage} disabled={isSendingGlobal} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
                    {isSendingGlobal ? t('messages.compose.sending') : t('admin.globalMessage.sendButton')}
                </button>
            </div>
        </div>

         <div className="flex justify-end mt-8">
             <button onClick={handleSaveSettings} className="px-6 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{t('admin.saveSettings')}</button>
         </div>
    </div>
  );
};
