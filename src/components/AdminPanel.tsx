
import React, { useState } from 'react';
import { GameData, ItemRarity, EquipmentSlot, CharacterClass, Race, MagicAttackType, ItemCategory, SkillType, SkillCategory, QuestType, EssenceType } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';

// Tab Imports
import { GeneralTab } from './admin/tabs/GeneralTab';
import { UsersTab } from './admin/tabs/UsersTab';
import { TriviaTab } from './admin/tabs/TriviaTab';

// Dedykowane Tabs (zawierają zaawansowane edytory)
import { LocationsTab } from './admin/tabs/LocationsTab';
import { ExpeditionsTab } from './admin/tabs/ExpeditionsTab';
import { EnemiesTab } from './admin/tabs/EnemiesTab';
import { BossesTab } from './admin/tabs/BossesTab';
import { ItemsTab } from './admin/tabs/ItemsTab';
import { AffixesTab } from './admin/tabs/AffixesTab';
import QuestsTab from './admin/tabs/QuestsTab'; // Default export w tym pliku
import { UniversityTab } from './admin/tabs/UniversityTab';
import { RitualsTab } from './admin/tabs/RitualsTab';
import { GuildsTab } from './admin/tabs/GuildsTab';
import { HuntingTab } from './admin/tabs/HuntingTab';
import { ItemCreatorTab } from './admin/tabs/ItemCreatorTab';
import { PvpTab } from './admin/tabs/PvpTab';
import { ItemInspectorTab } from './admin/tabs/ItemInspectorTab';
import { DuplicationAuditTab } from './admin/tabs/DuplicationAuditTab';
import { OrphanAuditTab } from './admin/tabs/OrphanAuditTab';
import { DataIntegrityTab } from './admin/tabs/DataIntegrityTab';
import { DatabaseEditorTab } from './admin/tabs/DatabaseEditorTab';
import { TowersTab } from './admin/tabs/TowersTab';

interface AdminPanelProps {
  gameData: GameData;
  onGameDataUpdate: (key: string, data: any) => void;
}

type AdminTab = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'bosses' | 'items' | 'itemCreator' | 'affixes' | 'quests' | 'pvp' | 'itemInspector' | 'duplicationAudit' | 'orphanAudit' | 'dataIntegrity' | 'university' | 'hunting' | 'trivia' | 'rituals' | 'guilds' | 'databaseEditor' | 'towers';

export const AdminPanel: React.FC<AdminPanelProps> = ({ gameData, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [adminTab, setAdminTab] = useState<AdminTab>('general');

  const safeGameData: GameData = gameData || {
      locations: [], expeditions: [], enemies: [], itemTemplates: [], quests: [], affixes: [], skills: [], rituals: [], towers: [], settings: { language: 'pl' as any }
  };
  
  const settings = safeGameData.settings;

  const handleSettingsUpdate = (newSettings: any) => {
      api.updateGameSettings(newSettings);
      onGameDataUpdate('settings', newSettings);
  };

  const renderActiveTab = () => {
    switch (adminTab) {
      // Zakładki Ogólne
      case 'general': return <GeneralTab settings={settings} onSettingsUpdate={handleSettingsUpdate} onForceTraderRefresh={() => api.getTraderInventory(true)} onSendGlobalMessage={api.sendGlobalMessage} />;
      case 'users': return <UsersTab gameData={safeGameData} />;
      case 'trivia': return <TriviaTab gameData={safeGameData} />;
      
      // Zakładki Contentu Gry (Używają dedykowanych komponentów zamiast GenericAdminTab)
      case 'locations': 
          return <LocationsTab locations={safeGameData.locations} onGameDataUpdate={onGameDataUpdate} />;
      case 'expeditions': 
          return <ExpeditionsTab expeditions={safeGameData.expeditions} locations={safeGameData.locations} enemies={safeGameData.enemies} itemTemplates={safeGameData.itemTemplates} onGameDataUpdate={onGameDataUpdate} />;
      case 'enemies': 
          return <EnemiesTab enemies={safeGameData.enemies} itemTemplates={safeGameData.itemTemplates} onGameDataUpdate={onGameDataUpdate} />;
      case 'bosses': 
          return <BossesTab enemies={safeGameData.enemies} itemTemplates={safeGameData.itemTemplates} onGameDataUpdate={onGameDataUpdate} />;
      case 'items': 
          return <ItemsTab itemTemplates={safeGameData.itemTemplates} onGameDataUpdate={onGameDataUpdate} />;
      case 'affixes': 
          return <AffixesTab affixes={safeGameData.affixes} onGameDataUpdate={onGameDataUpdate} />;
      case 'quests': 
          return <QuestsTab gameData={safeGameData} onGameDataUpdate={onGameDataUpdate} />;
      case 'university': 
          return <UniversityTab skills={safeGameData.skills} onGameDataUpdate={onGameDataUpdate} />;
      case 'rituals': 
          return <RitualsTab gameData={safeGameData} onGameDataUpdate={onGameDataUpdate} />;
      case 'towers': 
          return <TowersTab gameData={safeGameData} onGameDataUpdate={onGameDataUpdate} />;
      
      // Zakładki Zarządzania Systemami
      case 'guilds': return <GuildsTab />;
      case 'hunting': return <HuntingTab settings={settings} onSettingsUpdate={handleSettingsUpdate} />;
      case 'pvp': return <PvpTab settings={settings} onSettingsUpdate={handleSettingsUpdate} onResetAllPvpCooldowns={api.resetAllPvpCooldowns} />;
      case 'itemCreator': return <ItemCreatorTab itemTemplates={safeGameData.itemTemplates} affixes={safeGameData.affixes} />;
      
      // Zakładki Narzędziowe / Audyty
      case 'itemInspector': return <ItemInspectorTab gameData={safeGameData} />;
      case 'dataIntegrity': return <DataIntegrityTab />;
      case 'duplicationAudit': return <DuplicationAuditTab />;
      case 'orphanAudit': return <OrphanAuditTab />;
      case 'databaseEditor': return <DatabaseEditorTab />;
      
      default: return <div className="text-gray-500 p-4">Wybierz zakładkę</div>;
    }
  };

  const ADMIN_TABS: { id: AdminTab, label: string }[] = [
    { id: 'general', label: 'Ogólne' },
    { id: 'users', label: 'Użytkownicy' },
    { id: 'locations', label: 'Lokacje' },
    { id: 'expeditions', label: 'Wyprawy' },
    { id: 'towers', label: 'Wieże Mroku' },
    { id: 'enemies', label: 'Wrogowie' },
    { id: 'bosses', label: 'Bossowie' },
    { id: 'items', label: 'Przedmioty' },
    { id: 'affixes', label: 'Afiksy' },
    { id: 'quests', label: 'Zadania' },
    { id: 'university', label: 'Umiejętności' },
    { id: 'rituals', label: 'Rytuały' },
    { id: 'guilds', label: 'Gildie' },
    { id: 'hunting', label: 'Polowania' },
    { id: 'trivia', label: 'Info' },
    { id: 'itemCreator', label: 'Kreator' },
    { id: 'pvp', label: 'PvP' },
    { id: 'itemInspector', label: 'Inspektor' },
    { id: 'dataIntegrity', label: 'Audyty' },
    { id: 'databaseEditor', label: 'Baza Danych' },
  ];

  return (
    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 h-[85vh] flex flex-col overflow-hidden">
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2 flex-shrink-0">
            {t('admin.title')}
        </h2>
        
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700 pb-4 flex-shrink-0 max-h-32 overflow-y-auto">
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
