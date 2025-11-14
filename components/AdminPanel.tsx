import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { GameSettings, User, AdminCharacterInfo, GameData } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

import { GeneralTab } from './admin/tabs/GeneralTab';
import { UsersTab } from './admin/tabs/UsersTab';
import { LocationsTab } from './admin/tabs/LocationsTab';
import { ExpeditionsTab } from './admin/tabs/ExpeditionsTab';
import { EnemiesTab } from './admin/tabs/EnemiesTab';
import { ItemsTab } from './admin/tabs/ItemsTab';
import { AffixesTab } from './admin/tabs/AffixesTab';
import { QuestsTab } from './admin/tabs/QuestsTab';
import { PvpTab } from './admin/tabs/PvpTab';
import { ItemInspectorTab } from './admin/tabs/ItemInspectorTab';
import { DuplicationAuditTab } from './admin/tabs/DuplicationAuditTab';
import { OrphanAuditTab } from './admin/tabs/OrphanAuditTab';

interface AdminPanelProps {
  gameData: GameData;
  onGameDataUpdate: (key: keyof Omit<GameData, 'settings'>, data: any) => void;
  onSettingsUpdate: (settings: GameSettings) => void;
  users: User[];
  onDeleteUser: (userId: number) => void;
  allCharacters: AdminCharacterInfo[];
  onDeleteCharacter: (userId: number) => void;
  onResetCharacterStats: (userId: number) => void;
  onHealCharacter: (userId: number) => void;
  onUpdateCharacterGold: (userId: number, gold: number) => Promise<void>;
  onForceTraderRefresh: () => void;
  onResetAllPvpCooldowns: () => void;
  onSendGlobalMessage: (data: { subject: string; content: string }) => Promise<void>;
}

type AdminTab = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'items' | 'affixes' | 'quests' | 'pvp' | 'itemInspector' | 'duplicationAudit' | 'orphanAudit';

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { t } = useTranslation();
  const [adminTab, setAdminTab] = useState<AdminTab>('general');

  const ADMIN_TABS: { id: AdminTab, label: string }[] = [
    { id: 'general', label: 'Ogólne' },
    { id: 'users', label: 'Użytkownicy i Postacie' },
    { id: 'locations', label: 'Lokacje' },
    { id: 'expeditions', label: 'Ekspedycje' },
    { id: 'enemies', label: 'Wrogowie' },
    { id: 'items', label: 'Przedmioty' },
    { id: 'affixes', label: 'Afiksy' },
    { id: 'quests', label: 'Zadania' },
    { id: 'pvp', label: 'PvP' },
    { id: 'itemInspector', label: 'Inspektor Przedmiotów' },
    { id: 'duplicationAudit', label: 'Audyt Duplikatów' },
    { id: 'orphanAudit', label: 'Audyt Osieroconych Przedmiotów' },
  ];
  
  const renderActiveTab = () => {
    switch (adminTab) {
      case 'general':
        return <GeneralTab 
                  settings={props.gameData.settings} 
                  onSettingsUpdate={props.onSettingsUpdate} 
                  onForceTraderRefresh={props.onForceTraderRefresh}
                  onSendGlobalMessage={props.onSendGlobalMessage}
                />;
      case 'users':
        return <UsersTab 
                  allCharacters={props.allCharacters}
                  onHealCharacter={props.onHealCharacter}
                  onResetCharacterStats={props.onResetCharacterStats}
                  onDeleteCharacter={props.onDeleteCharacter}
                />;
      case 'locations':
        return <LocationsTab
                  locations={props.gameData.locations}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'expeditions':
        return <ExpeditionsTab
                  expeditions={props.gameData.expeditions}
                  locations={props.gameData.locations}
                  enemies={props.gameData.enemies}
                  itemTemplates={props.gameData.itemTemplates}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'enemies':
        return <EnemiesTab
                  enemies={props.gameData.enemies}
                  itemTemplates={props.gameData.itemTemplates}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'items':
        return <ItemsTab
                  itemTemplates={props.gameData.itemTemplates}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'affixes':
        return <AffixesTab
                  affixes={props.gameData.affixes}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'quests':
        return <QuestsTab
                  gameData={props.gameData}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'pvp':
        return <PvpTab
                  settings={props.gameData.settings}
                  onSettingsUpdate={props.onSettingsUpdate}
                  onResetAllPvpCooldowns={props.onResetAllPvpCooldowns}
                />;
      case 'itemInspector':
        return <ItemInspectorTab gameData={props.gameData} />;
      case 'duplicationAudit':
        return <DuplicationAuditTab />;
      case 'orphanAudit':
        return <OrphanAuditTab />;
      default:
        return null;
    }
  }

  return (
    <ContentPanel title={t('admin.title')}>
      <div className="flex border-b border-slate-700 mb-6 overflow-x-auto">
        {ADMIN_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setAdminTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2 ${
              adminTab === tab.id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bg-slate-900/40 p-6 rounded-xl">
        {renderActiveTab()}
      </div>
    </ContentPanel>
  );
};