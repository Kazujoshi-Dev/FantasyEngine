import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { Location, Tab, Expedition, Enemy, GameSettings, Language, User, AdminCharacterInfo, ItemTemplate, EquipmentSlot, ItemRarity, CharacterStats, LootDrop, TraderSettings, EssenceType, ResourceDrop, MagicAttackType, Quest, QuestType, ItemReward, ResourceReward, GameData, Affix, AffixType, ItemCategory, GrammaticalGender, DuplicationAuditResult, DuplicationInfo, RolledAffixStats, OrphanAuditResult, ItemSearchResult, PlayerCharacter, ItemInstance } from '../types';
import { SwordsIcon } from './icons/SwordsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles, ItemTooltip, getGrammaticallyCorrectFullName, ItemListItem } from './shared/ItemSlot';
import { SettingsIcon } from './icons/SettingsIcon';
import { api } from '../api';

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


const LocationEditor: React.FC<{
  location: Partial<Location>;
  onSave: (location: Location) => void;
  onCancel: () => void;
  isEditing: boolean;
  allLocations: Location[];
}> = ({ location, onSave, onCancel, isEditing, allLocations }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Location>>(location);
  const allTabs = (Object.values(Tab).filter(v => typeof v === 'number') as Tab[]).filter(t => t !== Tab.Admin);
  
  const tabLabels: { [key in Tab]?: string } = {
      [Tab.Statistics]: t('sidebar.statistics'),
      [Tab.Equipment]: t('sidebar.equipment'),
      [Tab.Expedition]: t('sidebar.expedition'),
      [Tab.Trader]: t('sidebar.trader'),
      [Tab.Blacksmith]: t('sidebar.blacksmith'),
      [Tab.Camp]: t('sidebar.camp'),
      [Tab.Location]: t('sidebar.location'),
      [Tab.Resources]: t('sidebar.resources'),
      [Tab.Ranking]: t('sidebar.ranking'),
      [Tab.Quests]: t('sidebar.quests'),
      [Tab.Messages]: t('sidebar.messages'),
      [Tab.Tavern]: t('sidebar.tavern'),
      [Tab.Market]: t('sidebar.market'),
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        if (name === 'isStartLocation') {
             setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            const tabKey = parseInt(name, 10) as Tab;
            const currentTabs = formData.availableTabs || [];
            if (checked) {
                setFormData(prev => ({ ...prev, availableTabs: [...currentTabs, tabKey] }));
            } else {
                setFormData(prev => ({ ...prev, availableTabs: currentTabs.filter(t => t !== tabKey) }));
            }
        }
    } else {
       setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) || 0 : value }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target && event.target.result) {
                    setFormData(prev => ({ ...prev, image: event.target!.result as string }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
        alert(t('admin.location.nameRequired'));
        return;
    }

    let finalLocations = [...allLocations];
    const finalLocation: Location = {
      id: formData.id || crypto.randomUUID(),
      name: formData.name,
      description: formData.description || '',
      travelTime: formData.travelTime || 0,
      travelCost: formData.travelCost || 0,
      travelEnergyCost: formData.travelEnergyCost || 0,
      availableTabs: formData.availableTabs || [],
      isStartLocation: formData.isStartLocation || false,
      image: formData.image
    };

    if (finalLocation.isStartLocation) {
        finalLocations = finalLocations.map(loc => ({ ...loc, isStartLocation: false }));
    }
    
    onSave(finalLocation);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
        <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? t('admin.location.edit') : t('admin.location.create')}</h3>
        <div>
            <label className="block text-sm font-medium text-gray-300">{t('admin.general.name')}</label>
            <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-300">{t('admin.general.description')}</label>
            <textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={3} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"></textarea>
        </div>
         <div>
            <label className="block text-sm font-medium text-gray-300">Grafika lokacji</label>
            <div className="mt-2 flex items-center gap-4">
                {formData.image && <img src={formData.image} alt="Podgląd" className="h-24 w-auto object-cover rounded-md border border-slate-700" />}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"/>
                {formData.image && <button type="button" onClick={() => setFormData(prev => ({...prev, image: undefined}))} className="text-xs text-red-400 hover:text-red-300">Usuń</button>}
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
                <span className="text-sm font-medium text-gray-300">{t('admin.location.travelCostGold')}</span>
                <input type="number" name="travelCost" value={formData.travelCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
            </label>
            <label className="block">
                <span className="text-sm font-medium text-gray-300">{t('admin.location.travelCostEnergy')}</span>
                <input type="number" name="travelEnergyCost" value={formData.travelEnergyCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
            </label>
            <label className="block">
                <span className="text-sm font-medium text-gray-300">{t('admin.location.travelTime')}</span>
                <input type="number" name="travelTime" value={formData.travelTime || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
            </label>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.location.availableTabs')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allTabs.map(tab => {
                    const label = tabLabels[tab];
                    if (!label) return null;
                    return (
                     <label key={tab} className="flex items-center space-x-2">
                        <input type="checkbox" name={tab.toString()} checked={formData.availableTabs?.includes(tab) || false} onChange={handleInputChange} className="form-checkbox h-5 w-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/>
                        <span>{label}</span>
                    </label>
                )})}
            </div>
        </div>
         <div>
            <label className="flex items-center space-x-2">
                <input type="checkbox" name="isStartLocation" checked={formData.isStartLocation || false} onChange={handleInputChange} className="form-checkbox h-5 w-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500" />
                <span>{t('admin.location.isStartLocation')}</span>
            </label>
            {formData.isStartLocation && <p className="text-xs text-amber-400 mt-1">{t('admin.location.isStartLocationNote')}</p>}
        </div>
        <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
        </div>
    </form>
  )
};

type ExpeditionEditorTab = 'basic' | 'enemies' | 'rewards';

const ExpeditionEditor: React.FC<{
  expedition: Partial<Expedition>;
  onSave: (expedition: Expedition) => void;
  onCancel: () => void;
  isEditing: boolean;
  allLocations: Location[];
  allEnemies: Enemy[];
  allItemTemplates: ItemTemplate[];
}> = ({ expedition, onSave, onCancel, isEditing, allLocations, allEnemies, allItemTemplates }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Expedition>>(expedition);
  const [activeTab, setActiveTab] = useState<ExpeditionEditorTab>('basic');

  const [enemySearch, setEnemySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemRarityFilter, setItemRarityFilter] = useState<ItemRarity | 'all'>('all');

  useEffect(() => {
    const dataToSet = { ...expedition };
    const oldGold = (dataToSet as any).baseGoldReward;
    if (oldGold !== undefined && dataToSet.minBaseGoldReward === undefined) {
        dataToSet.minBaseGoldReward = oldGold;
        dataToSet.maxBaseGoldReward = oldGold;
        delete (dataToSet as any).baseGoldReward;
    }
    setFormData(dataToSet);
  }, [expedition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['duration', 'goldCost', 'energyCost', 'minBaseGoldReward', 'maxBaseGoldReward', 'minBaseExperienceReward', 'maxBaseExperienceReward', 'maxEnemies'];
    setFormData(prev => ({ ...prev, [name]: numericFields.includes(name) ? parseInt(value, 10) || 0 : value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target && event.target.result) {
                    setFormData(prev => ({ ...prev, image: event.target!.result as string }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

  const handleLocationToggle = (locationId: string) => {
    const currentIds = formData.locationIds || [];
    if (currentIds.includes(locationId)) {
      setFormData(prev => ({ ...prev, locationIds: currentIds.filter(id => id !== locationId) }));
    } else {
      setFormData(prev => ({ ...prev, locationIds: [...currentIds, locationId] }));
    }
  };

  const handleEnemyChanceChange = (enemyId: string, chance: number) => {
    const currentEnemies = formData.enemies || [];
    const existingEnemyIndex = currentEnemies.findIndex(e => e.enemyId === enemyId);
    let newEnemies = [...currentEnemies];
    if (existingEnemyIndex > -1) {
        if (chance > 0) {
            newEnemies[existingEnemyIndex] = { ...newEnemies[existingEnemyIndex], spawnChance: chance };
        } else {
            newEnemies.splice(existingEnemyIndex, 1);
        }
    } else if (chance > 0) {
        newEnemies.push({ enemyId, spawnChance: chance });
    }
    setFormData(prev => ({ ...prev, enemies: newEnemies }));
  };
  
  const handleLootChanceChange = (templateId: string, chance: number) => {
    const currentLoot = formData.lootTable || [];
    const existingIndex = currentLoot.findIndex(l => l.templateId === templateId);
    let newLoot = [...currentLoot];
    if (existingIndex > -1) {
        if (chance > 0) {
            newLoot[existingIndex] = { ...newLoot[existingIndex], chance };
        } else {
            newLoot.splice(existingIndex, 1);
        }
    } else if (chance > 0) {
        newLoot.push({ templateId, chance });
    }
    setFormData(prev => ({ ...prev, lootTable: newLoot }));
  };

  const handleResourceLootChange = (resource: EssenceType, field: 'min' | 'max' | 'chance', value: number) => {
    const currentLoot = formData.resourceLootTable || [];
    const existingIndex = currentLoot.findIndex(r => r.resource === resource);
    let newLoot = [...currentLoot];

    if (existingIndex > -1) {
        const updatedDrop = { ...newLoot[existingIndex], [field]: value };
        if (updatedDrop.min || updatedDrop.max || updatedDrop.chance) {
            newLoot[existingIndex] = updatedDrop;
        } else {
            newLoot.splice(existingIndex, 1);
        }
    } else if (value > 0) {
        const newDrop: ResourceDrop = { resource, min: 0, max: 0, chance: 0 };
        newDrop[field] = value;
        newLoot.push(newDrop);
    }

    setFormData(prev => ({ ...prev, resourceLootTable: newLoot }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
        alert(t('admin.expedition.nameRequired'));
        return;
    }
    
    const finalExpedition: Expedition = {
      id: formData.id || crypto.randomUUID(),
      name: formData.name,
      description: formData.description || '',
      duration: formData.duration || 60,
      goldCost: formData.goldCost || 0,
      energyCost: formData.energyCost || 0,
      minBaseGoldReward: formData.minBaseGoldReward || 0,
      maxBaseGoldReward: Math.max(formData.minBaseGoldReward || 0, formData.maxBaseGoldReward || 0),
      minBaseExperienceReward: formData.minBaseExperienceReward || 0,
      maxBaseExperienceReward: Math.max(formData.minBaseExperienceReward || 0, formData.maxBaseExperienceReward || 0),
      locationIds: formData.locationIds || [],
      enemies: formData.enemies || [],
      maxEnemies: formData.maxEnemies || 0,
      lootTable: formData.lootTable || [],
      resourceLootTable: formData.resourceLootTable || [],
      image: formData.image
    };
    
    onSave(finalExpedition);
  };

  const filteredEnemies = useMemo(() => {
    return allEnemies.filter(enemy => enemy.name.toLowerCase().includes(enemySearch.toLowerCase()));
  }, [allEnemies, enemySearch]);

  const filteredItems = useMemo(() => {
    return allItemTemplates.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(itemSearch.toLowerCase());
        const rarityMatch = itemRarityFilter === 'all' || item.rarity === itemRarityFilter;
        return nameMatch && rarityMatch;
    });
  }, [allItemTemplates, itemSearch, itemRarityFilter]);

  const EDITOR_TABS: { id: ExpeditionEditorTab, label: string }[] = [
    { id: 'basic', label: t('admin.expedition.tabBasic') },
    { id: 'enemies', label: t('admin.expedition.tabEnemies') },
    { id: 'rewards', label: t('admin.expedition.tabRewards') },
  ];
  
  return (
     <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6">
        <h3 className="text-xl font-bold text-indigo-400 mb-4">{isEditing ? t('admin.expedition.edit') : t('admin.expedition.create')}</h3>
        
        <div className="flex border-b border-slate-700 mb-6">
            {EDITOR_TABS.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${activeTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="space-y-6">
            {activeTab === 'basic' && (
                <div className="space-y-4 animate-fade-in">
                    <div><label className="block text-sm font-medium text-gray-300">{t('admin.general.name')}</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></div>
                    <div><label className="block text-sm font-medium text-gray-300">{t('admin.general.description')}</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={3} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"></textarea></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.expeditionGoldCost')}</span><input type="number" name="goldCost" value={formData.goldCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></label>
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.expeditionEnergyCost')}</span><input type="number" name="energyCost" value={formData.energyCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></label>
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.expeditionDuration')}</span><input type="number" name="duration" value={formData.duration || 60} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></label>
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.maxEnemies')}</span><input type="number" name="maxEnemies" min="0" value={formData.maxEnemies || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2" title={t('admin.maxEnemiesDesc')}/></label>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Grafika ekspedycji</label>
                        <div className="mt-2 flex items-center gap-4">
                            {formData.image && <img src={formData.image} alt="Podgląd" className="h-24 w-auto object-cover rounded-md border border-slate-700" />}
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"/>
                            {formData.image && <button type="button" onClick={() => setFormData(prev => ({...prev, image: undefined}))} className="text-xs text-red-400 hover:text-red-300">Usuń</button>}
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.expedition.availableIn')}</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {allLocations.map(loc => (
                                <label key={loc.id} className="flex items-center space-x-2"><input type="checkbox" checked={formData.locationIds?.includes(loc.id) || false} onChange={() => handleLocationToggle(loc.id)} className="form-checkbox h-5 w-5 rounded bg-slate-700 border border-slate-600 text-indigo-600 focus:ring-indigo-500"/><span>{loc.name}</span></label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'enemies' && (
                <div className="space-y-4 animate-fade-in">
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.expedition.enemiesSpawnChance')}</label><input type="text" placeholder={t('admin.general.search') || "Szukaj przeciwnika..."} value={enemySearch} onChange={e => setEnemySearch(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2" /></div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                        {filteredEnemies.map(enemy => {
                            const currentEnemy = formData.enemies?.find(e => e.enemyId === enemy.id);
                            return <div key={enemy.id}><label htmlFor={`enemy-${enemy.id}`} className="text-gray-300">{enemy.name}</label><input type="number" id={`enemy-${enemy.id}`} min="0" max="100" value={currentEnemy?.spawnChance || ''} onChange={(e) => handleEnemyChanceChange(enemy.id, parseInt(e.target.value, 10) || 0)} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></div>;
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'rewards' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-3 rounded-md"><label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.expedition.rewardGold')}</label><div className="flex items-end space-x-2"><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.min')}</label><input type="number" min="0" name="minBaseGoldReward" value={formData.minBaseGoldReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div><span className="text-gray-400 pb-2">-</span><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.max')}</label><input type="number" min="0" name="maxBaseGoldReward" value={formData.maxBaseGoldReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div></div></div>
                        <div className="bg-slate-800/50 p-3 rounded-md"><label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.expedition.rewardExp')}</label><div className="flex items-end space-x-2"><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.min')}</label><input type="number" min="0" name="minBaseExperienceReward" value={formData.minBaseExperienceReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div><span className="text-gray-400 pb-2">-</span><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.max')}</label><input type="number" min="0" name="maxBaseExperienceReward" value={formData.maxBaseExperienceReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div></div></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.lootTable')}</label>
                        <div className="flex gap-4 mb-2"><input type="text" placeholder={t('admin.general.search') || "Szukaj przedmiotu..."} value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/><select value={itemRarityFilter} onChange={e => setItemRarityFilter(e.target.value as ItemRarity | 'all')} className="bg-slate-700 border border-slate-600 rounded-md px-3 py-2"><option value="all">{t('admin.item.allRarities')}</option>{Object.values(ItemRarity).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2 bg-slate-800/30 rounded-md">
                            {filteredItems.map(item => {
                                const currentLoot = formData.lootTable?.find(l => l.templateId === item.id);
                                return <div key={item.id} className="relative group hover:z-20"><label htmlFor={`loot-${item.id}`} className={`text-xs ${rarityStyles[item.rarity].text}`}>{item.name}</label><input type="number" id={`loot-${item.id}`} min="0" max="100" value={currentLoot?.chance || ''} onChange={(e) => handleLootChanceChange(item.id, parseInt(e.target.value, 10) || 0)} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/><ItemTooltip instance={{ uniqueId: `tooltip-exp-${item.id}`, templateId: item.id }} template={item} affixes={[]}/></div>;
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.resourceLootTable')}</label>
                        <div className="grid grid-cols-4 gap-2 items-center text-xs text-gray-400 font-bold mb-2 px-1"><span className="col-span-1">{t('admin.resource')}</span><span className="text-center">{t('admin.min')}</span><span className="text-center">{t('admin.max')}</span><span className="text-center">{t('admin.chance')}</span></div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {Object.values(EssenceType).map(essence => {
                                const currentLoot = formData.resourceLootTable?.find(l => l.resource === essence);
                                return <div key={essence} className="grid grid-cols-4 gap-2 items-center"><label className="text-gray-300 text-sm col-span-1">{t(`resources.${essence}`)}</label><input type="number" min="0" aria-label={`${t(`resources.${essence}`)} min amount`} value={currentLoot?.min || ''} onChange={e => handleResourceLootChange(essence, 'min', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/><input type="number" min="0" aria-label={`${t(`resources.${essence}`)} max amount`} value={currentLoot?.max || ''} onChange={e => handleResourceLootChange(essence, 'max', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/><input type="number" min="0" max="100" aria-label={`${t(`resources.${essence}`)} chance`} value={currentLoot?.chance || ''} onChange={e => handleResourceLootChange(essence, 'chance', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/></div>;
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-slate-700/50">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
        </div>
    </form>
  );
};

const EnemyEditor: React.FC<{
  enemy: Partial<Enemy>;
  onSave: (enemy: Enemy) => void;
  onCancel: () => void;
  isEditing: boolean;
  allItemTemplates: ItemTemplate[];
}> = ({ enemy, onSave, onCancel, isEditing, allItemTemplates }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Enemy>>(enemy);
    const [itemSearch, setItemSearch] = useState('');
    const [itemRarityFilter, setItemRarityFilter] = useState<ItemRarity | 'all'>('all');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleStatChange = (stat: keyof Enemy['stats'] | keyof Enemy['rewards'], value: string) => {
        const isStat = ['maxHealth', 'minDamage', 'maxDamage', 'armor', 'critChance', 'agility', 'maxMana', 'manaRegen', 'magicDamageMin', 'magicDamageMax', 'magicAttackChance', 'magicAttackManaCost', 'attacksPerTurn'].includes(stat);
        const target = isStat ? 'stats' : 'rewards';

        setFormData(prev => ({
            ...prev,
            [target]: {
                ...(prev as any)[target],
                [stat]: parseFloat(value) || 0
            }
        }));
    };
     const handleMagicTypeChange = (value: string) => {
        setFormData(prev => ({ ...prev, stats: { ...prev.stats, magicAttackType: value as MagicAttackType } }));
    };

     const handleLootChange = (templateId: string, chance: number) => {
        let lootTable = [...(formData.lootTable || [])];
        const existingIndex = lootTable.findIndex(l => l.templateId === templateId);
        if (chance > 0) {
            if (existingIndex > -1) {
                lootTable[existingIndex].chance = chance;
            } else {
                lootTable.push({ templateId, chance });
            }
        } else if (existingIndex > -1) {
            lootTable.splice(existingIndex, 1);
        }
        setFormData(prev => ({ ...prev, lootTable }));
    };

     const handleResourceLootChange = (resource: EssenceType, field: 'min' | 'max' | 'chance', value: number) => {
        let resourceLootTable = [...(formData.resourceLootTable || [])];
        const existingIndex = resourceLootTable.findIndex(r => r.resource === resource);
        if (value > 0) {
            if (existingIndex > -1) {
                resourceLootTable[existingIndex][field] = value;
            } else {
                const newDrop: ResourceDrop = { resource, min: 0, max: 0, chance: 0 };
                newDrop[field] = value;
                resourceLootTable.push(newDrop);
            }
        } else if (existingIndex > -1) {
             resourceLootTable[existingIndex][field] = 0;
             if (resourceLootTable[existingIndex].min === 0 && resourceLootTable[existingIndex].max === 0 && resourceLootTable[existingIndex].chance === 0) {
                 resourceLootTable.splice(existingIndex, 1);
             }
        }
        setFormData(prev => ({ ...prev, resourceLootTable }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert(t('admin.enemy.nameRequired'));
            return;
        }
        const finalEnemy: Enemy = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name,
            description: formData.description || '',
            stats: formData.stats || { maxHealth: 10, minDamage: 1, maxDamage: 2, armor: 0, critChance: 5, agility: 5 },
            rewards: formData.rewards || { minGold: 0, maxGold: 0, minExperience: 0, maxExperience: 0 },
            lootTable: formData.lootTable || [],
            resourceLootTable: formData.resourceLootTable || []
        };
        onSave(finalEnemy);
    };
    
    const filteredItems = useMemo(() => {
        return allItemTemplates.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(itemSearch.toLowerCase());
            const rarityMatch = itemRarityFilter === 'all' || item.rarity === itemRarityFilter;
            return nameMatch && rarityMatch;
        });
    }, [allItemTemplates, itemSearch, itemRarityFilter]);

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? t('admin.enemy.edit') : t('admin.enemy.create')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <label className="block"><span className="text-sm text-gray-300">{t('admin.general.name')}</span><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></label>
                    <label className="block"><span className="text-sm text-gray-300">{t('admin.general.description')}</span><textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={3} className="mt-1 w-full bg-slate-700 p-2 rounded-md"></textarea></label>
                </div>
                <div className="space-y-4">
                    <h4 className="font-semibold text-lg text-gray-300">Statystyki</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="block"><span className="text-xs text-gray-400">Max HP</span><input type="number" value={formData.stats?.maxHealth || 0} onChange={e => handleStatChange('maxHealth', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                        <label className="block"><span className="text-xs text-gray-400">Min Dmg</span><input type="number" value={formData.stats?.minDamage || 0} onChange={e => handleStatChange('minDamage', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                        <label className="block"><span className="text-xs text-gray-400">Max Dmg</span><input type="number" value={formData.stats?.maxDamage || 0} onChange={e => handleStatChange('maxDamage', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                        <label className="block"><span className="text-xs text-gray-400">Pancerz</span><input type="number" value={formData.stats?.armor || 0} onChange={e => handleStatChange('armor', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                        <label className="block"><span className="text-xs text-gray-400">Szansa kryt. %</span><input type="number" value={formData.stats?.critChance || 0} onChange={e => handleStatChange('critChance', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                        <label className="block"><span className="text-xs text-gray-400">Zręczność</span><input type="number" value={formData.stats?.agility || 0} onChange={e => handleStatChange('agility', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                        <label className="block"><span className="text-xs text-gray-400">Ataki/tura</span><input type="number" value={formData.stats?.attacksPerTurn || 1} onChange={e => handleStatChange('attacksPerTurn', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                    </div>
                </div>
            </div>

             <div className="border-t border-slate-700/50 pt-6">
                <h4 className="font-semibold text-lg text-gray-300 mb-4">{t('admin.enemy.magicProperties')}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="block"><span className="text-xs text-gray-400">{t('admin.enemy.maxMana')}</span><input type="number" value={formData.stats?.maxMana || 0} onChange={e => handleStatChange('maxMana', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                    <label className="block"><span className="text-xs text-gray-400">{t('admin.enemy.manaRegen')}</span><input type="number" value={formData.stats?.manaRegen || 0} onChange={e => handleStatChange('manaRegen', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                    <label className="block"><span className="text-xs text-gray-400">{t('admin.enemy.magicDamageMin')}</span><input type="number" value={formData.stats?.magicDamageMin || 0} onChange={e => handleStatChange('magicDamageMin', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                    <label className="block"><span className="text-xs text-gray-400">{t('admin.enemy.magicDamageMax')}</span><input type="number" value={formData.stats?.magicDamageMax || 0} onChange={e => handleStatChange('magicDamageMax', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                    <label className="block"><span className="text-xs text-gray-400">{t('admin.enemy.magicAttackChance')}</span><input type="number" value={formData.stats?.magicAttackChance || 0} onChange={e => handleStatChange('magicAttackChance', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                    <label className="block"><span className="text-xs text-gray-400">{t('admin.enemy.magicAttackManaCost')}</span><input type="number" value={formData.stats?.magicAttackManaCost || 0} onChange={e => handleStatChange('magicAttackManaCost', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                    <div className="col-span-2"><label className="block"><span className="text-xs text-gray-400">{t('admin.enemy.magicAttackType')}</span><select value={formData.stats?.magicAttackType || ''} onChange={e => handleMagicTypeChange(e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"><option value="">Brak</option>{Object.values(MagicAttackType).map(t => <option key={t} value={t}>{t}</option>)}</select></label></div>
                </div>
            </div>

            <div className="border-t border-slate-700/50 pt-6 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-3 rounded-md"><label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.expedition.rewardGold')}</label><div className="flex items-end space-x-2"><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.min')}</label><input type="number" min="0" value={formData.rewards?.minGold ?? ''} onChange={e => handleStatChange('minGold', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"/></div><span className="text-gray-400 pb-2">-</span><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.max')}</label><input type="number" min="0" value={formData.rewards?.maxGold ?? ''} onChange={e => handleStatChange('maxGold', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"/></div></div></div>
                    <div className="bg-slate-800/50 p-3 rounded-md"><label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.expedition.rewardExp')}</label><div className="flex items-end space-x-2"><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.min')}</label><input type="number" min="0" value={formData.rewards?.minExperience ?? ''} onChange={e => handleStatChange('minExperience', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"/></div><span className="text-gray-400 pb-2">-</span><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.max')}</label><input type="number" min="0" value={formData.rewards?.maxExperience ?? ''} onChange={e => handleStatChange('maxExperience', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"/></div></div></div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.lootTable')}</label>
                    <div className="flex gap-4 mb-2"><input type="text" placeholder={t('admin.general.search') || "Szukaj przedmiotu..."} value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/><select value={itemRarityFilter} onChange={e => setItemRarityFilter(e.target.value as ItemRarity | 'all')} className="bg-slate-700 border border-slate-600 rounded-md px-3 py-2"><option value="all">{t('admin.item.allRarities')}</option>{Object.values(ItemRarity).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2 bg-slate-800/30 rounded-md">
                        {filteredItems.map(item => {
                            const currentLoot = formData.lootTable?.find(l => l.templateId === item.id);
                            return <div key={item.id} className="relative group hover:z-20"><label htmlFor={`loot-${item.id}`} className={`text-xs ${rarityStyles[item.rarity].text}`}>{item.name}</label><input type="number" id={`loot-${item.id}`} min="0" max="100" value={currentLoot?.chance || ''} onChange={(e) => handleLootChange(item.id, parseInt(e.target.value, 10) || 0)} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/><ItemTooltip instance={{ uniqueId: `tooltip-enemy-${item.id}`, templateId: item.id }} template={item} affixes={[]}/></div>;
                        })}
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.resourceLootTable')}</label>
                    <div className="grid grid-cols-4 gap-2 items-center text-xs text-gray-400 font-bold mb-2 px-1"><span className="col-span-1">{t('admin.resource')}</span><span className="text-center">{t('admin.min')}</span><span className="text-center">{t('admin.max')}</span><span className="text-center">{t('admin.chance')}</span></div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {Object.values(EssenceType).map(essence => {
                            const currentLoot = formData.resourceLootTable?.find(l => l.resource === essence);
                            return <div key={essence} className="grid grid-cols-4 gap-2 items-center"><label className="text-gray-300 text-sm col-span-1">{t(`resources.${essence}`)}</label><input type="number" min="0" value={currentLoot?.min || ''} onChange={e => handleResourceLootChange(essence, 'min', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/><input type="number" min="0" value={currentLoot?.max || ''} onChange={e => handleResourceLootChange(essence, 'max', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/><input type="number" min="0" max="100" value={currentLoot?.chance || ''} onChange={e => handleResourceLootChange(essence, 'chance', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/></div>;
                        })}
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-slate-700/50">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};