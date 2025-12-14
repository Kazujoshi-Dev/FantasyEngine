
import React, { useState } from 'react';
import { GameData, ItemRarity, EquipmentSlot, CharacterClass, Race, MagicAttackType, ItemCategory, SkillType, SkillCategory, QuestType, EssenceType } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';

// Tab Imports
import { GeneralTab } from './admin/tabs/GeneralTab';
import { UsersTab } from './admin/tabs/UsersTab';
import { TriviaTab } from './admin/tabs/TriviaTab';
import { GenericAdminTab } from './admin/GenericAdminTab';
import { FieldDefinition } from './admin/SchemaForm';

// --- Placeholders for unimplemented specific tabs ---
const PlaceholderTab: React.FC<{name: string}> = ({name}) => (
    <div className="flex items-center justify-center h-full text-gray-500 p-4 border border-dashed border-gray-700 rounded-lg">
        Zakładka {name} jest w trakcie budowy lub używa widoku generycznego.
    </div>
);

const ItemCreatorTab = (props: any) => <PlaceholderTab name="ItemCreator" />;
const PvpTab = (props: any) => <PlaceholderTab name="Pvp" />;
const ItemInspectorTab = (props: any) => <PlaceholderTab name="ItemInspector" />;
const DuplicationAuditTab = (props: any) => <PlaceholderTab name="DuplicationAudit" />;
const OrphanAuditTab = (props: any) => <PlaceholderTab name="OrphanAudit" />;
const DataIntegrityTab = (props: any) => <PlaceholderTab name="DataIntegrity" />;

interface AdminPanelProps {
  gameData: GameData;
  onGameDataUpdate: (key: string, data: any) => void;
}

type AdminTab = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'bosses' | 'items' | 'itemCreator' | 'affixes' | 'quests' | 'pvp' | 'itemInspector' | 'duplicationAudit' | 'orphanAudit' | 'dataIntegrity' | 'university' | 'hunting' | 'trivia' | 'rituals' | 'guilds';

export const AdminPanel: React.FC<AdminPanelProps> = ({ gameData, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [adminTab, setAdminTab] = useState<AdminTab>('general');

  const safeGameData: GameData = gameData || {
      locations: [], expeditions: [], enemies: [], itemTemplates: [], quests: [], affixes: [], skills: [], rituals: [], settings: { language: 'pl' as any }
  };
  
  const settings = safeGameData.settings;

  const handleSettingsUpdate = (newSettings: any) => {
      api.updateGameSettings(newSettings);
      onGameDataUpdate('settings', newSettings);
  };

  // --- Field Definitions for Forms ---
  
  const commonItemFields: Record<string, FieldDefinition> = {
      rarity: {
          type: 'select',
          options: Object.values(ItemRarity).map(v => ({ value: v, label: v }))
      },
      slot: {
          type: 'select',
          options: [...Object.values(EquipmentSlot), 'consumable', 'ring'].map(v => ({ value: v, label: v }))
      },
      category: {
          type: 'select',
          options: Object.values(ItemCategory).map(v => ({ value: v, label: v }))
      },
      gender: {
          type: 'select',
          options: [
              { value: 'Masculine', label: 'Męski' },
              { value: 'Feminine', label: 'Żeński' },
              { value: 'Neuter', label: 'Nijaki' }
          ]
      },
      magicAttackType: {
          type: 'select',
          options: Object.values(MagicAttackType).map(v => ({ value: v, label: v }))
      }
  };

  const questFields: Record<string, FieldDefinition> = {
      objective: { type: 'select', label: 'Cel główny (Obiekt złożony)', readonly: true }, // Complex object, managed via tree
  };

  const skillFields: Record<string, FieldDefinition> = {
      type: {
          type: 'select',
          options: Object.values(SkillType).map(v => ({ value: v, label: v }))
      },
      category: {
          type: 'select',
          options: Object.values(SkillCategory).map(v => ({ value: v, label: v }))
      }
  };

  const ritualFields: Record<string, FieldDefinition> = {
      // Add if needed
  };

  const affixFields: Record<string, FieldDefinition> = {
      type: {
          type: 'select',
          options: [
              { value: 'Prefix', label: 'Prefix' },
              { value: 'Suffix', label: 'Suffix' }
          ]
      }
  };

  const renderActiveTab = () => {
    switch (adminTab) {
      case 'general': return <GeneralTab settings={settings} onSettingsUpdate={handleSettingsUpdate} onForceTraderRefresh={() => api.getTraderInventory(true)} onSendGlobalMessage={api.sendGlobalMessage} />;
      case 'users': return <UsersTab gameData={safeGameData} />;
      case 'trivia': return <TriviaTab gameData={safeGameData} />;
      
      // Generic Data Tabs with Smart Forms
      case 'locations': 
          return <GenericAdminTab data={safeGameData.locations} dataKey="locations" onUpdate={onGameDataUpdate} title="Lokacje" displayField="name" />;
      case 'expeditions': 
          return <GenericAdminTab data={safeGameData.expeditions} dataKey="expeditions" onUpdate={onGameDataUpdate} title="Wyprawy" displayField="name" />;
      case 'enemies': 
          return <GenericAdminTab data={(safeGameData.enemies || []).filter(e => !e.isBoss)} dataKey="enemies" onUpdate={onGameDataUpdate} title="Wrogowie" displayField="name" />;
      case 'bosses': 
          return <GenericAdminTab data={(safeGameData.enemies || []).filter(e => e.isBoss)} dataKey="enemies" onUpdate={onGameDataUpdate} title="Bossowie" displayField="name" newItemTemplate={{isBoss: true}} />;
      case 'items': 
          return <GenericAdminTab data={safeGameData.itemTemplates} dataKey="itemTemplates" onUpdate={onGameDataUpdate} title="Przedmioty" displayField="name" fieldDefinitions={commonItemFields} />;
      case 'affixes': 
          return <GenericAdminTab data={safeGameData.affixes} dataKey="affixes" onUpdate={onGameDataUpdate} title="Afiksy" displayField="name.masculine" fieldDefinitions={affixFields} />;
      case 'quests': 
          return <GenericAdminTab data={safeGameData.quests} dataKey="quests" onUpdate={onGameDataUpdate} title="Zadania" displayField="name" fieldDefinitions={questFields} />;
      case 'university': 
          return <GenericAdminTab data={safeGameData.skills} dataKey="skills" onUpdate={onGameDataUpdate} title="Umiejętności" displayField="name" fieldDefinitions={skillFields} />;
      case 'rituals': 
          return <GenericAdminTab data={safeGameData.rituals || []} dataKey="rituals" onUpdate={onGameDataUpdate} title="Rytuały" displayField="name" fieldDefinitions={ritualFields} />;
      
      case 'guilds': return <PlaceholderTab name="Gildie" />;
      case 'hunting': return <PlaceholderTab name="Polowania" />;
      case 'itemCreator': return <ItemCreatorTab itemTemplates={safeGameData.itemTemplates} affixes={safeGameData.affixes} />;
      case 'pvp': return <PvpTab settings={settings} onSettingsUpdate={handleSettingsUpdate} onResetAllPvpCooldowns={api.resetAllPvpCooldowns} />;
      case 'itemInspector': return <ItemInspectorTab gameData={safeGameData} />;
      case 'dataIntegrity': return <DataIntegrityTab />;
      case 'duplicationAudit': return <DuplicationAuditTab />;
      case 'orphanAudit': return <OrphanAuditTab />;
      default: return null;
    }
  };

  const ADMIN_TABS: { id: AdminTab, label: string }[] = [
    { id: 'general', label: 'Ogólne' },
    { id: 'users', label: 'Użytkownicy' },
    { id: 'locations', label: 'Lokacje' },
    { id: 'expeditions', label: 'Wyprawy' },
    { id: 'enemies', label: 'Wrogowie' },
    { id: 'bosses', label: 'Bossowie' },
    { id: 'items', label: 'Przedmioty' },
    { id: 'affixes', label: 'Afiksy' },
    { id: 'quests', label: 'Zadania' },
    { id: 'university', label: 'Umiejętności' },
    { id: 'rituals', label: 'Rytuały' },
    { id: 'trivia', label: 'Info' },
    { id: 'itemCreator', label: 'Kreator (Wkrótce)' },
    { id: 'pvp', label: 'PvP (Wkrótce)' },
    { id: 'dataIntegrity', label: 'Audyty' },
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
