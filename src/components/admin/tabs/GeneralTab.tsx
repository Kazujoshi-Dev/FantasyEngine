
import React, { useState, useEffect } from 'react';
import { GameSettings, ItemRarity, Tab, Language, TraderSettings } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface GeneralTabProps {
  settings: GameSettings;
  onSettingsUpdate: (settings: GameSettings) => void;
  onForceTraderRefresh: () => void;
  onSendGlobalMessage: (data: { subject: string; content: string }) => Promise<void>;
}

const DEFAULT_TAB_ORDER: Tab[] = [
    Tab.Statistics, Tab.Equipment, Tab.Expedition, Tab.Quests, Tab.Hunting, Tab.Tavern, Tab.Trader,
    Tab.Blacksmith, Tab.Market, Tab.Camp, Tab.Location, Tab.Resources, Tab.Ranking,
    Tab.University, Tab.Messages, Tab.Options, Tab.Admin
];

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings: propSettings, onSettingsUpdate, onForceTraderRefresh, onSendGlobalMessage }) => {
  const { t } = useTranslation();
  
  // Fallback if propSettings is null/undefined
  const initialSettings = propSettings || { language: Language.PL };

  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [globalMessage, setGlobalMessage] = useState({ subject: '', content: '' });
  const [isSendingGlobal, setIsSendingGlobal] = useState(false);
  
  // Safe initialization of sidebarOrder: filter out duplicates and invalid enum values
  const safeSidebarOrder = (initialSettings.sidebarOrder || DEFAULT_TAB_ORDER)
    .filter((t, index, self) => Tab[t] !== undefined && self.indexOf(t) === index);

  const [sidebarOrder, setSidebarOrder] = useState<Tab[]>(safeSidebarOrder);
  
  // Slider images handling
  const [sliderImages, setSliderImages] = useState<string[]>(initialSettings.titleScreen?.images || []);
  const [newSliderImageUrl, setNewSliderImageUrl] = useState('');

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name.startsWith('traderRarity-')) {
        const rarity = name.split('-')[1] as keyof TraderSettings['rarityChances'];
        setSettings(prev => {
            const defaultRarityChances = { 
                [ItemRarity.Common]: 0, 
                [ItemRarity.Uncommon]: 0, 
                [ItemRarity.Rare]: 0 
            };
            
            const currentTraderSettings = prev.traderSettings || { rarityChances: defaultRarityChances };
            const currentRarityChances = currentTraderSettings.rarityChances || defaultRarityChances;

            return {
                ...prev,
                traderSettings: {
                    ...currentTraderSettings,
                    rarityChances: {
                        ...currentRarityChances,
                        [rarity]: parseInt(value, 10) || 0
                    }
                }
            };
        });
    } else if (name === 'pvpProtectionMinutes') {
        setSettings(prev => ({ ...prev, pvpProtectionMinutes: parseInt(value, 10) || 60 }));
    } else if (name === 'newsContent') {
         setSettings(prev => ({ ...prev, newsContent: value }));
    } else if (name === 'titleScreenDescription') {
        setSettings(prev => ({
            ...prev,
            titleScreen: {
                ...prev.titleScreen,
                description: value,
                images: prev.titleScreen?.images || []
            }
        }));
    } else {
        setSettings(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const removeSliderImage = (index: number) => {
      const newImages = sliderImages.filter((_, i) => i !== index);
      setSliderImages(newImages);
      setSettings(prev => ({
          ...prev,
          titleScreen: {
              ...prev.titleScreen,
              description: prev.titleScreen?.description || '',
              images: newImages
          }
      }));
  };

  const handleSaveSettings = () => {
    const updatedSettings = { ...settings, sidebarOrder };
    if (updatedSettings.newsContent !== initialSettings.newsContent) {
        updatedSettings.newsLastUpdatedAt = Date.now();
    }
    onSettingsUpdate(updatedSettings);
  };

  const handleTraderRefresh = () => {
    if (window.confirm(t('admin.traderRefreshConfirm'))) {
      onForceTraderRefresh();
    }
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
  
  const moveTab = (index: number, direction: 'up' | 'down') => {
      const newOrder = [...sidebarOrder];
      if (direction === 'up' && index > 0) {
          [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      } else if (direction === 'down' && index < newOrder.length - 1) {
          [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      }
      setSidebarOrder(newOrder);
  };

  const getTabName = (tab: Tab): string => {
      const tabNameEnum = Tab[tab];
      if (tabNameEnum === undefined) return `Unknown Tab (${tab})`;

      const key = tabNameEnum.toLowerCase();
      // Map special cases or default to standard naming convention
      if (tab === Tab.Admin) return t('sidebar.admin');
      // Using optional access for i18n keys
      const translated = t(`sidebar.${key}`);
      return translated.includes('sidebar.') ? tabNameEnum : translated;
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
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">Ustawienia Wizualne</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Logo (URL)</label>
                    <input
                        type="text"
                        name="logoUrl"
                        value={settings.logoUrl || ''}
                        onChange={handleSettingsChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                        placeholder="https://example.com/logo.png"
                    />
                    {settings.logoUrl && (
                        <div className="mt-2 p-2 bg-slate-800/50 rounded-md inline-block">
                             <img src={settings.logoUrl} alt="Podgląd logo" className="max-h-16 object-contain" />
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tekstura Okien (URL)</label>
                    <input
                        type="text"
                        name="windowBackgroundUrl"
                        value={settings.windowBackgroundUrl || ''}
                        onChange={handleSettingsChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                        placeholder="https://example.com/texture.jpg"
                    />
                    {settings.windowBackgroundUrl && (
                        <div 
                            className="mt-2 w-full h-16 rounded-md border border-slate-600 bg-center bg-cover"
                            style={{ backgroundImage: `url(${settings.windowBackgroundUrl})` }}
                        ></div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Tekstura używana jako tło dla paneli i kart postaci.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tło Menu Bocznego (URL)</label>
                    <input
                        type="text"
                        name="sidebarBackgroundUrl"
                        value={settings.sidebarBackgroundUrl || ''}
                        onChange={handleSettingsChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                        placeholder="https://example.com/sidebar.jpg"
                    />
                    {settings.sidebarBackgroundUrl && (
                        <div 
                            className="mt-2 w-full h-16 rounded-md border border-slate-600 bg-center bg-cover"
                            style={{ backgroundImage: `url(${settings.sidebarBackgroundUrl})` }}
                        ></div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Tło dla panelu nawigacji po lewej stronie.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tło Raportów (URL)</label>
                    <input
                        type="text"
                        name="reportBackgroundUrl"
                        value={settings.reportBackgroundUrl || ''}
                        onChange={handleSettingsChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                        placeholder="https://example.com/report_bg.jpg"
                    />
                    {settings.reportBackgroundUrl && (
                        <div 
                            className="mt-2 w-full h-16 rounded-md border border-slate-600 bg-center bg-cover"
                            style={{ backgroundImage: `url(${settings.reportBackgroundUrl})` }}
                        ></div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Tło używane w oknach podsumowania walki i raportach.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tło Ekranu Logowania (URL)</label>
                    <input
                        type="text"
                        name="loginBackground"
                        value={settings.loginBackground || ''}
                        onChange={handleSettingsChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                        placeholder="https://example.com/image.png"
                    />
                    {settings.loginBackground && <p className="text-xs text-gray-400 mt-1 truncate">Obecne: {settings.loginBackground}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tło Gry (URL)</label>
                    <input
                        type="text"
                        name="gameBackground"
                        value={settings.gameBackground || ''}
                        onChange={handleSettingsChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                        placeholder="https://example.com/image.png"
                    />
                    {settings.gameBackground && <p className="text-xs text-gray-400 mt-1 truncate">Obecne: {settings.gameBackground}</p>}
                </div>
                <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-300 mb-1">Opis gry</label>
                     <textarea name="titleScreenDescription" value={settings.titleScreen?.description || ''} onChange={handleSettingsChange} rows={4} className="w-full bg-slate-700 p-2 rounded-md" placeholder="Opis gry na stronie logowania..."></textarea>
                </div>
                <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-300 mb-1">Obrazy w sliderze</label>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={newSliderImageUrl}
                            onChange={(e) => setNewSliderImageUrl(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                            placeholder="https://example.com/image.png"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if (newSliderImageUrl.trim()) {
                                    const newImages = [...sliderImages, newSliderImageUrl.trim()];
                                    setSliderImages(newImages);
                                    setSettings(prev => ({
                                        ...prev,
                                        titleScreen: {
                                            ...(prev.titleScreen || { description: '', images: [] }),
                                            images: newImages
                                        }
                                    }));
                                    setNewSliderImageUrl('');
                                }
                            }}
                            className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold text-sm whitespace-nowrap"
                        >
                            Dodaj Obraz
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {sliderImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                                <img src={img} alt={`Slide ${idx}`} className="h-20 w-20 object-cover rounded border border-slate-600" />
                                <button onClick={() => removeSliderImage(idx)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-700">X</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        
        <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.menuOrder')}</h3>
            <div className="bg-slate-800/50 p-4 rounded-lg max-w-md">
                {sidebarOrder.map((tab, index) => (
                    <div key={tab} className="flex items-center justify-between p-2 border-b border-slate-700 last:border-0 hover:bg-slate-700/50 rounded">
                        <span className="text-gray-300">{getTabName(tab)}</span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => moveTab(index, 'up')} 
                                disabled={index === 0}
                                className="p-1 bg-slate-600 hover:bg-slate-500 rounded disabled:opacity-30"
                            >
                                ↑
                            </button>
                            <button 
                                onClick={() => moveTab(index, 'down')} 
                                disabled={index === sidebarOrder.length - 1}
                                className="p-1 bg-slate-600 hover:bg-slate-500 rounded disabled:opacity-30"
                            >
                                ↓
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">Ustawienia Handlarza</h3>
            <div className="grid grid-cols-3 gap-4">
               {(Object.values(ItemRarity) as ItemRarity[]).filter(r => r !== ItemRarity.Epic && r !== ItemRarity.Legendary).map(rarity => (
                    <div key={rarity}>
                        <label htmlFor={`traderRarity-${rarity}`} className="block text-sm font-medium text-gray-300 mb-1">{t(`rarity.${rarity}`)}</label>
                        <input 
                            type="number" 
                            id={`traderRarity-${rarity}`} 
                            name={`traderRarity-${rarity}`} 
                            value={settings.traderSettings?.rarityChances?.[rarity] || 0} 
                            onChange={handleSettingsChange} 
                            className="w-full bg-slate-700 p-2 rounded-md"
                        />
                    </div>
                ))}
            </div>
            {/* Use explicit key to avoid rendering object */}
            <p className="text-xs text-gray-500 mt-2">{t('admin.traderSettings.rarityChancesDesc')}</p>
        </div>

         <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.traderActions')}</h3>
            <button onClick={handleTraderRefresh} className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white font-semibold">{t('admin.forceTraderRefresh')}</button>
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
