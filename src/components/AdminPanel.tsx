
import React, { useState } from 'react';
import { GameData } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { ADMIN_TABS, AdminTabId } from './admin/AdminTabRegistry';

interface AdminPanelProps {
  gameData: GameData;
  onGameDataUpdate: (key: string, data: any) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ gameData, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [activeTabId, setActiveTabId] = useState<AdminTabId>('general');

  const safeGameData: GameData = gameData || {
      locations: [], expeditions: [], enemies: [], itemTemplates: [], quests: [], affixes: [], skills: [], rituals: [], towers: [], itemSets: [], settings: { language: 'pl' as any }
  };

  const activeTab = ADMIN_TABS.find(tab => tab.id === activeTabId) || ADMIN_TABS[0];
  const Component = activeTab.component;

  const handleSettingsUpdate = (newSettings: any) => {
      api.updateGameSettings(newSettings);
      onGameDataUpdate('settings', newSettings);
  };

  // Przygotowanie propsów dla dynamicznego komponentu
  const getComponentProps = () => {
      if (activeTab.props) {
          return activeTab.props(safeGameData, onGameDataUpdate);
      }
      
      // Domyślne propsy dla prostych tabów (np. GeneralTab, PvpTab)
      return {
          gameData: safeGameData,
          settings: safeGameData.settings,
          onSettingsUpdate: handleSettingsUpdate,
          onForceTraderRefresh: () => api.getTraderInventory(true),
          onSendGlobalMessage: api.sendGlobalMessage,
          onResetAllPvpCooldowns: api.resetAllPvpCooldowns
      };
  };

  return (
    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 h-[85vh] flex flex-col overflow-hidden">
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2 flex-shrink-0">{t('admin.title')}</h2>
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700 pb-4 flex-shrink-0 max-h-32 overflow-y-auto custom-scrollbar">
            {ADMIN_TABS.map(tab => (
                <button 
                    key={tab.id} 
                    onClick={() => setActiveTabId(tab.id)} 
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTabId === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
            <Component {...getComponentProps()} />
        </div>
    </div>
  );
};
