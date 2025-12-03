
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { GameSettings, User, AdminCharacterInfo, GameData, PlayerCharacter, Language, ItemRarity } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

import { GeneralTab } from './admin/tabs/GeneralTab';
import { UsersTab } from './admin/tabs/UsersTab';
import { LocationsTab } from './admin/tabs/LocationsTab';
import { ExpeditionsTab } from './admin/tabs/ExpeditionsTab';
import { EnemiesTab } from './admin/tabs/EnemiesTab';
import { BossesTab } from './admin/tabs/BossesTab';
import { ItemsTab } from './admin/tabs/ItemsTab';
import { AffixesTab } from './admin/tabs/AffixesTab';
import QuestsTab from './admin/tabs/QuestsTab';
import { PvpTab } from './admin/tabs/PvpTab';
import { ItemInspectorTab } from './admin/tabs/ItemInspectorTab';
import { DuplicationAuditTab } from './admin/tabs/DuplicationAuditTab';
import { OrphanAuditTab } from './admin/tabs/OrphanAuditTab';
import { DataIntegrityTab } from './admin/tabs/DataIntegrityTab';
import { UniversityTab } from './admin/tabs/UniversityTab';
import { HuntingTab } from './admin/tabs/HuntingTab';
import { DatabaseEditorTab } from './admin/tabs/DatabaseEditorTab';

interface AdminPanelProps {
  gameData: GameData;
  onGameDataUpdate: (key: keyof Omit<GameData, 'settings'>, data: any) => void;
  onSettingsUpdate: (settings: GameSettings) => void;
  users: User[];
  onDeleteUser: (userId: number) => void;
  allCharacters: AdminCharacterInfo[];
  onDeleteCharacter: (userId: number) => void;
  onResetCharacterStats: (userId: number) => void;
  onResetCharacterProgress: (userId: number) => Promise<void>;
  onHealCharacter: (userId: number) => void;
  onUpdateCharacterGold: (userId: number, gold: number) => Promise<void>;
  onForceTraderRefresh: () => void;
  onResetAllPvpCooldowns: () => void;
  onSendGlobalMessage: (data: { subject: string; content: string }) => Promise<void>;
  // New handlers
  onRegenerateCharacterEnergy: (userId: number) => Promise<void>;
  onChangeUserPassword: (userId: number, newPassword: string) => Promise<void>;
  onInspectCharacter: (userId: number) => Promise<PlayerCharacter>;
  onDeleteCharacterItem: (userId: number, itemUniqueId: string) => Promise<PlayerCharacter>;
}

type AdminTab = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'bosses' | 'items' | 'affixes' | 'quests' | 'pvp' | 'itemInspector' | 'duplicationAudit' | 'orphanAudit' | 'dataIntegrity' | 'university' | 'hunting' | 'databaseEditor';

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { t } = useTranslation();
  const [adminTab, setAdminTab] = useState<AdminTab>('general');

  // Ensure gameData exists to prevent crashes
  if (!props.gameData) {
      return <ContentPanel title={t('admin.title')}><p>Loading game data...</p></ContentPanel>;
  }
  
  // Create a safe version of gameData where all arrays are guaranteed to exist
  // Also ensures settings has critical nested objects to prevent crashes in GeneralTab
  const safeSettings: GameSettings = {
      language: Language.PL,
      ...(props.gameData?.settings || {}),
      traderSettings: {
          rarityChances: {
              [ItemRarity.Common]: 0,
              [ItemRarity.Uncommon]: 0,
              [ItemRarity.Rare]: 0,
              ...(props.gameData?.settings?.traderSettings?.rarityChances || {})
          }
      }
  };

  const safeGameData: GameData = {
      locations: props.gameData?.locations || [],
      expeditions: props.gameData?.expeditions || [],
      enemies: props.gameData?.enemies || [],
      itemTemplates: props.gameData?.itemTemplates || [],
      quests: props.gameData?.quests || [],
      affixes: props.gameData?.affixes || [],
      skills: props.gameData?.skills || [],
      settings: safeSettings
  };

  const ADMIN_TABS: { id: AdminTab, label: string }[] = [
    { id: 'general', label: 'Ogólne' },
    { id: 'hunting', label: 'Polowania' },
    { id: 'users', label: 'Użytkownicy i Postacie' },
    { id: 'locations', label: 'Lokacje' },
    { id: 'expeditions', label: 'Ekspedycje' },
    { id: 'enemies', label: 'Wrogowie' },
    { id: 'bosses', label: 'Bossowie' },
    { id: 'items', label: 'Przedmioty' },
    { id: 'affixes', label: 'Afiksy' },
    { id: 'quests', label: 'Zadania' },
    { id: 'university', label: 'Uniwersytet' },
    { id: 'pvp', label: 'PvP' },
    { id: 'itemInspector', label: 'Inspektor Przedmiotów' },
    { id: 'duplicationAudit', label: 'Audyt Duplikatów' },
    { id: 'orphanAudit', label: 'Audyt Osieroconych Przedmiotów' },
    { id: 'dataIntegrity', label: 'Kondycja Bazy Danych' },
    { id: 'databaseEditor', label: 'Edytor Bazy Danych' },
  ];
  
  const settings = safeGameData.settings;

  const renderActiveTab = () => {
    switch (adminTab) {
      case 'general':
        return <GeneralTab 
                  settings={settings} 
                  onSettingsUpdate={props.onSettingsUpdate} 
                  onForceTraderRefresh={props.onForceTraderRefresh}
                  onSendGlobalMessage={props.onSendGlobalMessage}
                />;
      case 'hunting':
        return <HuntingTab
                  settings={settings}
                  onSettingsUpdate={props.onSettingsUpdate}
                />;
      case 'users':
        return <UsersTab 
                  allCharacters={props.allCharacters || []}
                  gameData={safeGameData}
                  onHealCharacter={props.onHealCharacter}
                  onResetCharacterStats={props.onResetCharacterStats}
                  onResetCharacterProgress={props.onResetCharacterProgress}
                  onDeleteCharacter={props.onDeleteCharacter}
                  onUpdateCharacterGold={props.onUpdateCharacterGold}
                  onRegenerateCharacterEnergy={props.onRegenerateCharacterEnergy}
                  onChangeUserPassword={props.onChangeUserPassword}
                  onInspectCharacter={props.onInspectCharacter}
                  onDeleteCharacterItem={props.onDeleteCharacterItem}
                />;
      case 'locations':
        return <LocationsTab
                  locations={safeGameData.locations}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'expeditions':
        return <ExpeditionsTab
                  expeditions={safeGameData.expeditions}
                  locations={safeGameData.locations}
                  enemies={safeGameData.enemies}
                  itemTemplates={safeGameData.itemTemplates}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'enemies':
        return <EnemiesTab
                  enemies={safeGameData.enemies}
                  itemTemplates={safeGameData.itemTemplates}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'bosses':
        return <BossesTab
                  enemies={safeGameData.enemies}
                  itemTemplates={safeGameData.itemTemplates}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'items':
        return <ItemsTab
                  itemTemplates={safeGameData.itemTemplates}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'affixes':
        return <AffixesTab
                  affixes={safeGameData.affixes}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'quests':
        return <QuestsTab
                  gameData={safeGameData}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'university':
        return <UniversityTab
                  skills={safeGameData.skills}
                  onGameDataUpdate={props.onGameDataUpdate}
                />;
      case 'pvp':
        return <PvpTab
                  settings={settings}
                  onSettingsUpdate={props.onSettingsUpdate}
                  onResetAllPvpCooldowns={props.onResetAllPvpCooldowns}
                />;
      case 'itemInspector':
        return <ItemInspectorTab gameData={safeGameData} />;
      case 'duplicationAudit':
        return <DuplicationAuditTab />;
      case 'orphanAudit':
        return <OrphanAuditTab />;
      case 'dataIntegrity':
        return <DataIntegrityTab />;
      case 'databaseEditor':
        return <DatabaseEditorTab />;
      default:
        return null;
    }
  }

  return (
    <ContentPanel title={t('admin.title')}>
      <div className="flex border-b border-slate-700 mb-6 overflow-x-auto pb-2">
        {ADMIN_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setAdminTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2 flex-shrink-0 ${
              adminTab === tab.id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bg-slate-900/40 p-6 rounded-xl overflow-y-auto h-[72vh]">
        {renderActiveTab()}
      </div>
    </ContentPanel>
  );
};
