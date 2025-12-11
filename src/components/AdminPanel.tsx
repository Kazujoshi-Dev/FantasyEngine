
import React, { useState } from 'react';
import { GameData } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';

// Tabs
import { GeneralTab } from './admin/tabs/GeneralTab';
import { UsersTab } from './admin/tabs/UsersTab';
import { LocationsTab } from './admin/tabs/LocationsTab';
import { ExpeditionsTab } from './admin/tabs/ExpeditionsTab';
import { EnemiesTab } from './admin/tabs/EnemiesTab';
import { BossesTab } from './admin/tabs/BossesTab';
import { ItemsTab } from './admin/tabs/ItemsTab';
import { ItemCreatorTab } from './admin/tabs/ItemCreatorTab';
import { AffixesTab } from './admin/tabs/AffixesTab';
import QuestsTab from './admin/tabs/QuestsTab';
import { PvpTab } from './admin/tabs/PvpTab';
import { ItemInspectorTab } from './admin/tabs/ItemInspectorTab';
import { DuplicationAuditTab } from './admin/tabs/DuplicationAuditTab';
import { OrphanAuditTab } from './admin/tabs/OrphanAuditTab';
import { DataIntegrityTab } from './admin/tabs/DataIntegrityTab';
import { UniversityTab } from './admin/tabs/UniversityTab';
import { HuntingTab } from './admin/tabs/HuntingTab';
import { TriviaTab } from './admin/tabs/TriviaTab';
import { RitualsTab } from './admin/tabs/RitualsTab';
import { GuildsTab } from './admin/tabs/GuildsTab';

interface AdminPanelProps {
  gameData: GameData;
  onGameDataUpdate: (key: string, data: any) => void;
  // Note: We removed most function props as tabs now handle their own API calls
}

type AdminTab = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'bosses' | 'items' | 'itemCreator' | 'affixes' | 'quests' | 'pvp' | 'itemInspector' | 'duplicationAudit' | 'orphanAudit' | 'dataIntegrity' | 'university' | 'hunting' | 'trivia' | 'rituals' | 'guilds';

export const AdminPanel: React.FC<AdminPanelProps> = ({ gameData, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [adminTab, setAdminTab] = useState<AdminTab>('general');

  // Safe accessor to avoid crashes if gameData is loading/partial
  const safeGameData: GameData = gameData || {
      locations: [], expeditions: [], enemies: [], itemTemplates: [], quests: [], affixes: [], skills: [], rituals: [], settings: { language: 'pl' as any }
  };
  
  const settings = safeGameData.settings;

  // Wrapper for settings update to sync with App state AND backend
  const handleSettingsUpdate = (newSettings: any) => {
      api.updateGameSettings(newSettings);
      onGameDataUpdate('settings', newSettings);
  };

  const renderActiveTab = () => {
    switch (adminTab) {
      case 'general':
        return <GeneralTab 
                  settings={settings} 
                  onSettingsUpdate={handleSettingsUpdate}
                  onForceTraderRefresh={() => api.getTraderInventory(true)}
                  onSendGlobalMessage={api.sendGlobalMessage}
                />;
      case 'trivia':
        return <TriviaTab gameData={safeGameData} />;
      case 'guilds':
        return <GuildsTab />;
      case 'hunting':
        return <HuntingTab settings={settings} onSettingsUpdate={handleSettingsUpdate} />;
      case 'users':
        return <UsersTab gameData={safeGameData} />;
      case 'locations':
        return <LocationsTab locations={safeGameData.locations} onGameDataUpdate={onGameDataUpdate} />;
      case 'expeditions':
        return <ExpeditionsTab 
                  expeditions={safeGameData.expeditions} 
                  locations={safeGameData.locations} 
                  enemies={safeGameData.enemies} 
                  itemTemplates={safeGameData.itemTemplates} 
                  onGameDataUpdate={onGameDataUpdate} 
                />;
      case 'enemies':
        return <EnemiesTab enemies={safeGameData.enemies} itemTemplates={safeGameData.itemTemplates} onGameDataUpdate={onGameDataUpdate} />;
      case 'bosses':
        return <BossesTab enemies={safeGameData.enemies} itemTemplates={safeGameData.itemTemplates} onGameDataUpdate={onGameDataUpdate} />;
      case 'items':
        return <ItemsTab itemTemplates={safeGameData.itemTemplates} onGameDataUpdate={onGameDataUpdate} />;
      case 'itemCreator':
        // ItemCreator fetches its own user list
        return <ItemCreatorTab itemTemplates={safeGameData.itemTemplates} affixes={safeGameData.affixes} />;
      case 'affixes':
        return <AffixesTab affixes={safeGameData.affixes} onGameDataUpdate={onGameDataUpdate} />;
      case 'quests':
        return <QuestsTab gameData={safeGameData} onGameDataUpdate={onGameDataUpdate} />;
      case 'university':
        return <UniversityTab skills={safeGameData.skills} onGameDataUpdate={onGameDataUpdate} />;
      case 'rituals':
        return <RitualsTab gameData={safeGameData} onGameDataUpdate={onGameDataUpdate} />;
      case 'pvp':
        return <PvpTab settings={settings} onSettingsUpdate={handleSettingsUpdate} onResetAllPvpCooldowns={api.resetAllPvpCooldowns} />;
      case 'itemInspector':
        return <ItemInspectorTab gameData={safeGameData} />;
      case 'dataIntegrity':
        return <DataIntegrityTab />;
      case 'duplicationAudit':
        return <DuplicationAuditTab />;
      case 'orphanAudit':
        return <OrphanAuditTab />;
      default:
        return null;
    }
  };

  const ADMIN_TABS: { id: AdminTab, label: string }[] = [
    { id: 'general', label: 'Ogólne' },
    { id: 'users', label: 'Użytkownicy' },
    { id: 'guilds', label: 'Gildie' },
    { id: 'locations', label: 'Lokacje' },
    { id: 'expeditions', label: 'Wyprawy' },
    { id: 'enemies', label: 'Wrogowie' },
    { id: 'bosses', label: 'Bossowie' },
    { id: 'items', label: 'Przedmioty' },
    { id: 'itemCreator', label: 'Kreator' },
    { id: 'quests', label: 'Zadania' },
    { id: 'university', label: 'Umiejętności' },
    { id: 'rituals', label: 'Rytuały' },
    { id: 'affixes', label: 'Afiksy' },
    { id: 'hunting', label: 'Polowania' },
    { id: 'pvp', label: 'PvP' },
    { id: 'itemInspector', label: 'Inspektor' },
    { id: 'dataIntegrity', label: 'Kondycja' },
    { id: 'duplicationAudit', label: 'Duplikaty' },
    { id: 'orphanAudit', label: 'Sieroty' },
    { id: 'trivia', label: 'Info' },
  ];

  return (
    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 h-[85vh] flex flex-col overflow-hidden">
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2 flex-shrink-0">
            {t('admin.title')}
        </h2>
        
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700 pb-4 flex-shrink-0">
            {ADMIN_TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setAdminTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${adminTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
            {renderActiveTab()}
        </div>
    </div>
  );
};
