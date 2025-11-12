import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { Location, Tab, Expedition, Enemy, GameSettings, Language, User, AdminCharacterInfo, ItemTemplate, EquipmentSlot, ItemRarity, CharacterStats, LootDrop, TraderSettings, EssenceType, ResourceDrop, MagicAttackType, Quest, QuestType, ItemReward, ResourceReward, GameData, Affix, AffixType, ItemCategory, GrammaticalGender, DuplicationAuditResult, DuplicationInfo, RolledAffixStats, OrphanAuditResult, ItemSearchResult } from '../types';
import { SwordsIcon } from './icons/SwordsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles, ItemTooltip } from './shared/ItemSlot';
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
                                <label key={loc.id} className="flex items-center space-x-2"><input type="checkbox" checked={formData.locationIds?.includes(loc.id) || false} onChange={() => handleLocationToggle(loc.id)} className="form-checkbox h-5 w-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/><span>{loc.name}</span></label>
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

            <div className="border-t border-slate-700/50 pt-6">
                <h4 className="font-semibold text-lg text-gray-300 mb-4">Nagrody</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <label className="block"><span className="text-xs text-gray-400">Min Złoto</span><input type="number" value={formData.rewards?.minGold || 0} onChange={e => handleStatChange('minGold', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                     <label className="block"><span className="text-xs text-gray-400">Max Złoto</span><input type="number" value={formData.rewards?.maxGold || 0} onChange={e => handleStatChange('maxGold', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                     <label className="block"><span className="text-xs text-gray-400">Min EXP</span><input type="number" value={formData.rewards?.minExperience || 0} onChange={e => handleStatChange('minExperience', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                     <label className="block"><span className="text-xs text-gray-400">Max EXP</span><input type="number" value={formData.rewards?.maxExperience || 0} onChange={e => handleStatChange('maxExperience', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-sm"/></label>
                </div>
            </div>
            
            <div className="border-t border-slate-700/50 pt-6">
                <h4 className="font-semibold text-lg text-gray-300 mb-2">{t('admin.lootTable')}</h4>
                <div className="flex gap-4 mb-2"><input type="text" placeholder={t('admin.general.search') || 'Szukaj...'} value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="w-full bg-slate-700 border-slate-600 p-2 rounded-md"/><select value={itemRarityFilter} onChange={e => setItemRarityFilter(e.target.value as ItemRarity | 'all')} className="bg-slate-700 border-slate-600 p-2 rounded-md"><option value="all">{t('admin.item.allRarities')}</option>{Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}</select></div>
                <div className="max-h-64 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-4 p-2 bg-slate-800/30 rounded">
                    {filteredItems.map(item => <div key={item.id}><label className={`text-xs ${rarityStyles[item.rarity].text}`}>{item.name}</label><input type="number" value={formData.lootTable?.find(l => l.templateId === item.id)?.chance || ''} onChange={e => handleLootChange(item.id, parseInt(e.target.value) || 0)} min="0" max="100" className="w-full bg-slate-700 p-2 rounded-md mt-1"/></div>)}
                </div>
            </div>
            
            <div className="border-t border-slate-700/50 pt-6">
                <h4 className="font-semibold text-lg text-gray-300 mb-2">{t('admin.resourceLootTable')}</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs text-gray-400 font-bold mb-1"><span className="text-left">{t('admin.resource')}</span><span>{t('admin.min')}</span><span>{t('admin.max')}</span><span>{t('admin.chance')}</span></div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                    {Object.values(EssenceType).map(e => <div key={e} className="grid grid-cols-4 gap-2 items-center"><label className="text-sm">{t(`resources.${e}`)}</label><input type="number" value={formData.resourceLootTable?.find(r=>r.resource===e)?.min || ''} onChange={ev => handleResourceLootChange(e, 'min', parseInt(ev.target.value)||0)} className="w-full bg-slate-700 p-2 rounded-md"/><input type="number" value={formData.resourceLootTable?.find(r=>r.resource===e)?.max || ''} onChange={ev => handleResourceLootChange(e, 'max', parseInt(ev.target.value)||0)} className="w-full bg-slate-700 p-2 rounded-md"/><input type="number" value={formData.resourceLootTable?.find(r=>r.resource===e)?.chance || ''} onChange={ev => handleResourceLootChange(e, 'chance', parseInt(ev.target.value)||0)} min="0" max="100" className="w-full bg-slate-700 p-2 rounded-md"/></div>)}
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};

const ItemEditor: React.FC<{
  item: Partial<ItemTemplate>;
  onSave: (item: ItemTemplate) => void;
  onCancel: () => void;
  isEditing: boolean;
}> = ({ item, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<ItemTemplate>>({
        rarity: ItemRarity.Common,
        slot: EquipmentSlot.Head,
        category: ItemCategory.Armor,
        gender: GrammaticalGender.Masculine,
        statsBonus: {},
        requiredStats: {},
        ...item
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        const isCheckbox = type === 'checkbox';
        setFormData(prev => ({ ...prev, [name]: isCheckbox ? checked : value }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target && event.target.result) {
                    setFormData(prev => ({ ...prev, icon: event.target!.result as string }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMinMaxChange = (key: keyof ItemTemplate, field: 'min' | 'max', value: string) => {
        const numValue = parseFloat(value);
        setFormData(prev => {
            const currentVal = (prev as any)[key] || {};
            return {
                ...prev,
                [key]: {
                    ...currentVal,
                    [field]: isNaN(numValue) ? undefined : numValue
                }
            }
        });
    };

    const handleNestedMinMaxChange = (category: 'statsBonus', key: string, field: 'min' | 'max', value: string) => {
      const numValue = parseInt(value, 10);
      setFormData(prev => {
        const newCategory = { ...(prev as any)[category] };
        const newStat = { ...newCategory[key], [field]: isNaN(numValue) ? undefined : numValue };
        
        if (newStat.min === undefined && newStat.max === undefined) {
          delete newCategory[key];
        } else {
          newCategory[key] = newStat;
        }

        if (Object.keys(newCategory).length === 0) {
            const { [category]: _, ...rest } = prev;
            return rest;
        }
        
        return { ...prev, [category]: newCategory };
      });
    };

    const handleRequiredStatChange = (key: string, value: string) => {
      const numValue = parseInt(value, 10);
      setFormData(prev => {
        const newRequiredStats = { ...prev.requiredStats };
        if (isNaN(numValue) || numValue <= 0) {
          delete (newRequiredStats as any)[key];
        } else {
          (newRequiredStats as any)[key] = numValue;
        }
        return { ...prev, requiredStats: newRequiredStats };
      });
    };
    
    const handleNumericChange = (key: keyof ItemTemplate, value: string) => {
        setFormData(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.slot || !formData.rarity) {
            alert(t('admin.item.validationError'));
            return;
        }
        
        const cleanMinMax = (obj: any) => {
            if (!obj) return undefined;
            const { min, max } = obj;
            if (min === undefined && max === undefined) return undefined;
            const finalMin = min ?? max ?? 0;
            const finalMax = max ?? min ?? 0;
            return { min: Math.min(finalMin, finalMax), max: Math.max(finalMin, finalMax) };
        };

        const finalItem: ItemTemplate = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name,
            gender: formData.gender || GrammaticalGender.Masculine,
            description: formData.description || '',
            slot: formData.slot,
            category: formData.category || ItemCategory.Armor,
            rarity: formData.rarity,
            icon: formData.icon || '',
            value: formData.value || 0,
            requiredLevel: formData.requiredLevel || 1,
            requiredStats: formData.requiredStats,
            statsBonus: formData.statsBonus,
            damageMin: cleanMinMax(formData.damageMin),
            damageMax: cleanMinMax(formData.damageMax),
            attacksPerRound: formData.attacksPerRound,
            armorBonus: cleanMinMax(formData.armorBonus),
            critChanceBonus: cleanMinMax(formData.critChanceBonus),
            maxHealthBonus: cleanMinMax(formData.maxHealthBonus),
            critDamageModifierBonus: cleanMinMax(formData.critDamageModifierBonus),
            armorPenetrationPercent: cleanMinMax(formData.armorPenetrationPercent),
            armorPenetrationFlat: cleanMinMax(formData.armorPenetrationFlat),
            lifeStealPercent: cleanMinMax(formData.lifeStealPercent),
            lifeStealFlat: cleanMinMax(formData.lifeStealFlat),
            manaStealPercent: cleanMinMax(formData.manaStealPercent),
            manaStealFlat: cleanMinMax(formData.manaStealFlat),
            isMagical: formData.isMagical,
            isRanged: formData.isRanged,
            magicAttackType: formData.magicAttackType,
            manaCost: cleanMinMax(formData.manaCost),
            magicDamageMin: cleanMinMax(formData.magicDamageMin),
            magicDamageMax: cleanMinMax(formData.magicDamageMax),
        };
        onSave(finalItem);
    };

    const primaryStats: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];

    const MinMaxInput: React.FC<{ label: string; field: keyof ItemTemplate, isFloat?: boolean }> = ({ label, field, isFloat }) => {
        const value = (formData as any)[field] || {};
        return (
             <div>
                <label className="block text-sm font-medium text-gray-300">{label}</label>
                <div className="flex items-center gap-2 mt-1">
                    <input type="number" step={isFloat ? "0.1" : "1"} value={value.min ?? ''} onChange={e => handleMinMaxChange(field, 'min', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.min') as string} aria-label={`${label} min value`} />
                    <input type="number" step={isFloat ? "0.1" : "1"} value={value.max ?? ''} onChange={e => handleMinMaxChange(field, 'max', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.max') as string} aria-label={`${label} max value`} />
                </div>
            </div>
        );
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.item.edit') : t('admin.item.create')}</h3>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-700 p-4 rounded-md">
                <legend className="px-2 font-semibold">{t('admin.general.description')}</legend>
                <div className="md:col-span-2"><label>{t('item.name')}:<input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.item.grammaticalGender')}:<select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(GrammaticalGender).map(g => <option key={g} value={g}>{g}</option>)}</select></label></div>
                <div className="md:col-span-3"><label>{t('item.description')}:<textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-300">{t('item.iconPath')}</label>
                    <div className="mt-2 flex items-center gap-4">
                        {formData.icon && <img src={formData.icon} alt="Podgląd" className="h-24 w-auto object-contain rounded-md border border-slate-700 bg-slate-800" />}
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"/>
                        {formData.icon && <button type="button" onClick={() => setFormData(prev => ({...prev, icon: undefined}))} className="text-xs text-red-400 hover:text-red-300">Usuń</button>}
                    </div>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border border-slate-700 p-4 rounded-md">
                <legend className="px-2 font-semibold">{t('item.category')}</legend>
                <div><label>{t('item.slotLabel')}:<select name="slot" value={formData.slot} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{s}</option>)}<option value="ring">ring</option></select></label></div>
                <div><label>{t('item.category')}:<select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(ItemCategory).map(c => <option key={c} value={c}>{c}</option>)}</select></label></div>
                <div><label>{t('item.rarity')}:<select name="rarity" value={formData.rarity} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(ItemRarity).map(r => <option key={r} value={r}>{r}</option>)}</select></label></div>
                <div><label>{t('item.value')}:<input type="number" name="value" value={formData.value || 0} onChange={e => handleNumericChange('value', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('item.levelRequirement')}:<input type="number" name="requiredLevel" value={formData.requiredLevel || 1} onChange={e => handleNumericChange('requiredLevel', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div className="col-span-full"><label>{t('item.requiredStats')}:</label>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-1">
                        {primaryStats.map(stat => <label key={stat} className="text-xs">{t(`statistics.${stat}`)}:<input type="number" value={(formData.requiredStats as any)?.[stat] || ''} onChange={e => handleRequiredStatChange(stat, e.target.value)} className="w-full bg-slate-700 p-1 rounded-md mt-1 text-sm" /></label>)}
                    </div>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-2 md:grid-cols-3 gap-4 border border-slate-700 p-4 rounded-md">
                <legend className="px-2 font-semibold">{t('item.weaponStats')}</legend>
                <MinMaxInput label={t('item.damageMin')} field="damageMin" />
                <MinMaxInput label={t('item.damageMax')} field="damageMax" />
                <div><label>{t('item.attacksPerRound')}:<input type="number" name="attacksPerRound" step="0.1" value={formData.attacksPerRound || ''} onChange={e => handleNumericChange('attacksPerRound', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div className="flex items-center gap-4 col-span-full">
                    <label className="flex items-center gap-2"><input type="checkbox" name="isRanged" checked={!!formData.isRanged} onChange={handleInputChange} /> {t('item.isRanged')}</label>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-2 md:grid-cols-3 gap-4 border border-slate-700 p-4 rounded-md">
                <legend className="px-2 font-semibold">{t('item.magicProperties')}</legend>
                <MinMaxInput label={t('item.magicDamageMin')} field="magicDamageMin" />
                <MinMaxInput label={t('item.magicDamageMax')} field="magicDamageMax" />
                <MinMaxInput label={t('item.manaCost')} field="manaCost" />
                <div className="col-span-full md:col-span-1"><label>{t('item.magicAttackType')}:<select name="magicAttackType" value={formData.magicAttackType} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">{t('admin.general.none')}</option>{Object.values(MagicAttackType).map(m => <option key={m} value={m}>{m}</option>)}</select></label></div>
                 <div className="flex items-center gap-4 col-span-full">
                    <label className="flex items-center gap-2"><input type="checkbox" name="isMagical" checked={!!formData.isMagical} onChange={handleInputChange} /> {t('item.isMagical')}</label>
                </div>
            </fieldset>

            <fieldset className="border border-slate-700 p-4 rounded-md">
                <legend className="px-2 font-semibold">{t('admin.affix.primaryBonuses')}</legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {primaryStats.map(stat => {
                        const value = (formData.statsBonus as any)?.[stat] || {};
                        return (
                             <div key={stat}>
                                <label className="block text-sm font-medium text-gray-300">{t(`statistics.${stat}`)}</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input type="number" value={value.min ?? ''} onChange={e => handleNestedMinMaxChange('statsBonus', stat, 'min', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.min') as string} />
                                    <input type="number" value={value.max ?? ''} onChange={e => handleNestedMinMaxChange('statsBonus', stat, 'max', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.max') as string} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </fieldset>
            
            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('item.secondaryBonuses')}</legend>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MinMaxInput label={t('item.armorBonus')} field="armorBonus" />
                    <MinMaxInput label={t('item.critChanceBonus')} field="critChanceBonus" isFloat />
                    <MinMaxInput label={t('item.maxHealthBonus')} field="maxHealthBonus" />
                    <MinMaxInput label={t('item.critDamageModifierBonus')} field="critDamageModifierBonus" />
                    <MinMaxInput label={t('item.armorPenetrationPercent')} field="armorPenetrationPercent" />
                    <MinMaxInput label={t('item.armorPenetrationFlat')} field="armorPenetrationFlat" />
                    <MinMaxInput label={t('item.lifeStealPercent')} field="lifeStealPercent" />
                    <MinMaxInput label={t('item.lifeStealFlat')} field="lifeStealFlat" />
                    <MinMaxInput label={t('item.manaStealPercent')} field="manaStealPercent" />
                    <MinMaxInput label={t('item.manaStealFlat')} field="manaStealFlat" />
                </div>
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};

const AffixEditor: React.FC<{
  affix: Partial<Affix>;
  onSave: (affix: Affix) => void;
  onCancel: () => void;
  isEditing: boolean;
}> = ({ affix, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Affix>>({ 
        name: { masculine: '', feminine: '', neuter: '' }, 
        spawnChances: {}, 
        statsBonus: {},
        ...affix 
    });

    const handleNameChange = (gender: keyof Affix['name'], value: string) => {
        setFormData(prev => ({ ...prev, name: { ...(prev.name as any), [gender]: value }}));
    };
    
    const handleMinMaxChange = (key: keyof Affix, field: 'min' | 'max', value: string) => {
        const numValue = parseFloat(value);
        setFormData(prev => ({
            ...prev,
            [key]: {
                ...(prev as any)[key],
                [field]: isNaN(numValue) ? undefined : numValue
            }
        }));
    };

    const handleNestedMinMaxChange = (category: 'statsBonus', key: string, field: 'min' | 'max', value: string) => {
      const numValue = parseFloat(value);
      setFormData(prev => {
        const newCategory = { ...(prev as any)[category] };
        const newStat = { ...newCategory[key], [field]: isNaN(numValue) ? undefined : numValue };
        
        if (newStat.min === undefined && newStat.max === undefined) {
          delete newCategory[key];
        } else {
          newCategory[key] = newStat;
        }

        if (Object.keys(newCategory).length === 0) {
            return { ...prev, [category]: undefined };
        }
        
        return { ...prev, [category]: newCategory };
      });
    };

    const handleSpawnChanceChange = (category: ItemCategory, value: string) => {
        const numValue = parseInt(value, 10);
        setFormData(prev => ({
            ...prev,
            spawnChances: {
                ...prev.spawnChances,
                [category]: isNaN(numValue) ? undefined : numValue
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const names = formData.name as Affix['name'];
        if (!names?.masculine) {
            alert(t('admin.affix.nameRequired'));
            return;
        }

        const finalAffix: Affix = {
            id: formData.id || crypto.randomUUID(),
            name: {
                masculine: names.masculine,
                feminine: names.feminine || names.masculine,
                neuter: names.neuter || names.masculine,
            },
            type: formData.type!,
            value: formData.value || 0,
            requiredLevel: formData.requiredLevel,
            requiredStats: formData.requiredStats,
            statsBonus: formData.statsBonus,
            damageMin: formData.damageMin,
            damageMax: formData.damageMax,
            attacksPerRoundBonus: formData.attacksPerRoundBonus,
            dodgeChanceBonus: formData.dodgeChanceBonus,
            armorBonus: formData.armorBonus,
            critChanceBonus: formData.critChanceBonus,
            maxHealthBonus: formData.maxHealthBonus,
            critDamageModifierBonus: formData.critDamageModifierBonus,
            armorPenetrationPercent: formData.armorPenetrationPercent,
            armorPenetrationFlat: formData.armorPenetrationFlat,
            lifeStealPercent: formData.lifeStealPercent,
            lifeStealFlat: formData.lifeStealFlat,
            manaStealPercent: formData.manaStealPercent,
            manaStealFlat: formData.manaStealFlat,
            magicDamageMin: formData.magicDamageMin,
            magicDamageMax: formData.magicDamageMax,
            spawnChances: formData.spawnChances || {}
        };
        onSave(finalAffix);
    };
    
    const primaryStats: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];


    const MinMaxInput: React.FC<{ label: string; field: keyof Affix }> = ({ label, field }) => {
        const value = (formData as any)[field] || {};
        return (
             <div>
                <label className="block text-sm font-medium text-gray-300">{label}</label>
                <div className="flex items-center gap-2 mt-1">
                    <input type="number" step="0.1" value={value.min ?? ''} onChange={e => handleMinMaxChange(field, 'min', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.min') as string} aria-label={`${label} min value`} />
                    <input type="number" step="0.1" value={value.max ?? ''} onChange={e => handleMinMaxChange(field, 'max', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.max') as string} aria-label={`${label} max value`} />
                </div>
            </div>
        );
    };
    
    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.affix.edit') : t('admin.affix.create')} ({formData.type})</h3>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.general.name')}</legend>
                <div><label>{t('admin.affix.nameMasculine')}:<input type="text" value={formData.name?.masculine} onChange={e => handleNameChange('masculine', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.affix.nameFeminine')}:<input type="text" value={formData.name?.feminine} onChange={e => handleNameChange('feminine', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.affix.nameNeuter')}:<input type="text" value={formData.name?.neuter} onChange={e => handleNameChange('neuter', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>

            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.affix.spawnChances')}</legend>
                {Object.values(ItemCategory).map(cat => (
                    <div key={cat}><label>{t(`item.category${cat}`)}:<input type="number" value={formData.spawnChances?.[cat] || ''} onChange={e => handleSpawnChanceChange(cat, e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                ))}
            </fieldset>
            
            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.affix.primaryBonuses')}</legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {primaryStats.map(stat => {
                        const value = (formData.statsBonus as any)?.[stat] || {};
                        return (
                             <div key={stat}>
                                <label className="block text-sm font-medium text-gray-300">{t(`statistics.${stat}`)}</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input type="number" value={value.min ?? ''} onChange={e => handleNestedMinMaxChange('statsBonus', stat, 'min', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.min') as string} aria-label={`${t(`statistics.${stat}`)} min value`} />
                                    <input type="number" value={value.max ?? ''} onChange={e => handleNestedMinMaxChange('statsBonus', stat, 'max', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.max') as string} aria-label={`${t(`statistics.${stat}`)} max value`} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </fieldset>
            
            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.affix.secondaryBonuses')}</legend>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MinMaxInput label={t('item.damageMin')} field="damageMin" />
                    <MinMaxInput label={t('item.damageMax')} field="damageMax" />
                    <MinMaxInput label={t('item.attacksPerRoundBonus')} field="attacksPerRoundBonus" />
                    <MinMaxInput label={t('item.dodgeChanceBonus')} field="dodgeChanceBonus" />
                    <MinMaxInput label={t('item.armorBonus')} field="armorBonus" />
                    <MinMaxInput label={t('item.critChanceBonus')} field="critChanceBonus" />
                    <MinMaxInput label={t('item.maxHealthBonus')} field="maxHealthBonus" />
                    <MinMaxInput label={t('item.critDamageModifierBonus')} field="critDamageModifierBonus" />
                    <MinMaxInput label={t('item.armorPenetrationPercent')} field="armorPenetrationPercent" />
                    <MinMaxInput label={t('item.armorPenetrationFlat')} field="armorPenetrationFlat" />
                    <MinMaxInput label={t('item.lifeStealPercent')} field="lifeStealPercent" />
                    <MinMaxInput label={t('item.lifeStealFlat')} field="lifeStealFlat" />
                    <MinMaxInput label={t('item.manaStealPercent')} field="manaStealPercent" />
                    <MinMaxInput label={t('item.manaStealFlat')} field="manaStealFlat" />
                    <MinMaxInput label={t('item.magicDamageMin')} field="magicDamageMin" />
                    <MinMaxInput label={t('item.magicDamageMax')} field="magicDamageMax" />
                </div>
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};

const QuestEditor: React.FC<{
  quest: Partial<Quest>;
  onSave: (quest: Quest) => void;
  onCancel: () => void;
  isEditing: boolean;
  gameData: GameData;
}> = ({ quest, onSave, onCancel, isEditing, gameData }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Quest>>({ 
        objective: { type: QuestType.Kill, amount: 1 }, 
        rewards: { gold: 0, experience: 0, itemRewards: [], resourceRewards: [], lootTable: [] }, 
        ...quest 
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const numValue = parseInt(value, 10);
        setFormData(prev => ({ ...prev, [name]: isNaN(numValue) ? value : numValue }));
    };

    const handleObjectiveChange = (field: keyof Quest['objective'], value: any) => {
        setFormData(prev => ({ ...prev, objective: { ...(prev.objective as any), [field]: value } }));
    };

    const handleRewardChange = (field: keyof Quest['rewards'], value: any) => {
        setFormData(prev => ({ ...prev, rewards: { ...(prev.rewards as any), [field]: value } }));
    };

    const handleItemRewardChange = (index: number, field: keyof ItemReward, value: string | number) => {
        const newRewards = [...(formData.rewards?.itemRewards || [])];
        (newRewards[index] as any)[field] = value;
        handleRewardChange('itemRewards', newRewards);
    };

    const handleAddItemReward = () => {
        if (gameData.itemTemplates.length === 0) return;
        const newRewards = [...(formData.rewards?.itemRewards || []), { templateId: gameData.itemTemplates[0].id, quantity: 1 }];
        handleRewardChange('itemRewards', newRewards);
    };

    const handleRemoveItemReward = (index: number) => {
        const newRewards = [...(formData.rewards?.itemRewards || [])];
        newRewards.splice(index, 1);
        handleRewardChange('itemRewards', newRewards);
    };

    const handleResourceRewardChange = (index: number, field: keyof ResourceReward, value: string | number) => {
        const newRewards = [...(formData.rewards?.resourceRewards || [])];
        (newRewards[index] as any)[field] = value;
        handleRewardChange('resourceRewards', newRewards);
    };

    const handleAddResourceReward = () => {
        const newRewards = [...(formData.rewards?.resourceRewards || []), { resource: EssenceType.Common, quantity: 1 }];
        handleRewardChange('resourceRewards', newRewards);
    };

    const handleRemoveResourceReward = (index: number) => {
        const newRewards = [...(formData.rewards?.resourceRewards || [])];
        newRewards.splice(index, 1);
        handleRewardChange('resourceRewards', newRewards);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Quest);
    };

    return (
         <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.quest.edit') : t('admin.quest.create')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label>{t('admin.quest.name')}:<input name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label>
                <label>{t('admin.quest.repeatable')}:<input type="number" name="repeatable" value={formData.repeatable ?? 1} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" title={t('admin.quest.repeatableDesc')} /></label>
            </div>
            <label>{t('admin.general.description')}:<textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label>

            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.quest.objective')}</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label>{t('admin.quest.objectiveType')}:<select value={formData.objective?.type} onChange={e => handleObjectiveChange('type', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(QuestType).map(t => <option key={t} value={t}>{t}</option>)}</select></label>
                    <label>{t('admin.quest.target')}:
                         {formData.objective?.type === QuestType.Kill && <select value={formData.objective.targetId} onChange={e => handleObjectiveChange('targetId', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1">{gameData.enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
                         {formData.objective?.type === QuestType.Gather && <select value={formData.objective.targetId} onChange={e => handleObjectiveChange('targetId', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1">{gameData.itemTemplates.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
                         {formData.objective?.type === QuestType.GatherResource && <select value={formData.objective.targetId} onChange={e => handleObjectiveChange('targetId', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}</select>}
                         {formData.objective?.type === QuestType.PayGold && <span className="p-2 block text-gray-400">Gold</span>}
                    </label>
                    <label>{t('admin.quest.amount')}:<input type="number" value={formData.objective?.amount} onChange={e => handleObjectiveChange('amount', parseInt(e.target.value))} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label>
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.quest.rewards')}</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label>{t('resources.gold')}:<input type="number" value={formData.rewards?.gold || 0} onChange={e => handleRewardChange('gold', parseInt(e.target.value))} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label>
                    <label>XP:<input type="number" value={formData.rewards?.experience || 0} onChange={e => handleRewardChange('experience', parseInt(e.target.value))} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label>
                </div>
                
                <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">{t('admin.quest.itemRewards')}</h4>
                    <div className="space-y-2">
                        {formData.rewards?.itemRewards?.map((reward, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <select value={reward.templateId} onChange={e => handleItemRewardChange(index, 'templateId', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-xs">
                                    {gameData.itemTemplates.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                                </select>
                                <input type="number" value={reward.quantity} onChange={e => handleItemRewardChange(index, 'quantity', parseInt(e.target.value))} className="w-24 bg-slate-700 p-2 rounded-md text-xs" placeholder={t('admin.quest.quantity') as string}/>
                                <button type="button" onClick={() => handleRemoveItemReward(index)} className="px-2 py-1 bg-red-800 rounded-md text-xs">X</button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddItemReward} className="mt-2 px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.quest.addItemReward')}</button>
                </div>
                
                <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">{t('admin.quest.resourceRewards')}</h4>
                    <div className="space-y-2">
                        {formData.rewards?.resourceRewards?.map((reward, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <select value={reward.resource} onChange={e => handleResourceRewardChange(index, 'resource', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md text-xs">
                                    {Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}
                                </select>
                                <input type="number" value={reward.quantity} onChange={e => handleResourceRewardChange(index, 'quantity', parseInt(e.target.value))} className="w-24 bg-slate-700 p-2 rounded-md text-xs" placeholder={t('admin.quest.quantity') as string}/>
                                <button type="button" onClick={() => handleRemoveResourceReward(index)} className="px-2 py-1 bg-red-800 rounded-md text-xs">X</button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddResourceReward} className="mt-2 px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.quest.addResourceReward')}</button>
                </div>
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};


export const AdminPanel: React.FC<AdminPanelProps> = ({
  gameData, onGameDataUpdate, onSettingsUpdate, users, onDeleteUser, allCharacters,
  onDeleteCharacter, onResetCharacterStats, onHealCharacter, onUpdateCharacterGold, onForceTraderRefresh, onResetAllPvpCooldowns, onSendGlobalMessage
}) => {
  const { t } = useTranslation();
  const [adminTab, setAdminTab] = useState<AdminTab>('general');
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);
  const [editingExpedition, setEditingExpedition] = useState<Partial<Expedition> | null>(null);
  const [editingEnemy, setEditingEnemy] = useState<Partial<Enemy> | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<ItemTemplate> | null>(null);
  const [editingAffix, setEditingAffix] = useState<Partial<Affix> | null>(null);
  const [editingQuest, setEditingQuest] = useState<Partial<Quest> | null>(null);
  const [settings, setSettings] = useState<GameSettings>(gameData.settings);
  const [globalMessage, setGlobalMessage] = useState({ subject: '', content: '' });
  const [isSendingGlobal, setIsSendingGlobal] = useState(false);
  const [duplicationResults, setDuplicationResults] = useState<DuplicationAuditResult[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [goldInputs, setGoldInputs] = useState<Record<number, string>>({});
  const [orphanResults, setOrphanResults] = useState<OrphanAuditResult[]>([]);
  const [isAuditingOrphans, setIsAuditingOrphans] = useState(false);
  const [isResolvingOrphans, setIsResolvingOrphans] = useState(false);
  const [itemSearchId, setItemSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<ItemSearchResult | null>(null);
  const [isSearchingItem, setIsSearchingItem] = useState(false);
  const [itemSearchError, setItemSearchError] = useState<string | null>(null);

  // Item filters
  const [itemSearch, setItemSearch] = useState('');
  const [itemRarityFilter, setItemRarityFilter] = useState<ItemRarity | 'all'>('all');
  const [itemSlotFilter, setItemSlotFilter] = useState<string>('all');
  
  // Affix filters
  const [affixSearch, setAffixSearch] = useState('');

  useEffect(() => {
      setSettings(gameData.settings);
  }, [gameData.settings]);

    const handleSaveData = <T extends { id?: string }>(key: keyof Omit<GameData, 'settings'>, data: T[], itemFromEditor: T | null, setEditingItem: (item: T | null) => void) => {
        if (!itemFromEditor) {
            setEditingItem(null);
            return;
        }

        const itemExists = itemFromEditor.id ? data.some(d => d.id === itemFromEditor.id) : false;
        let updatedData;

        if (itemExists) {
            updatedData = data.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
        } else {
            updatedData = [...data, { ...itemFromEditor, id: itemFromEditor.id || crypto.randomUUID() }];
        }
        onGameDataUpdate(key, updatedData);
        setEditingItem(null);
    };

    const handleDeleteData = <T extends { id?: string }>(key: keyof Omit<GameData, 'settings'>, data: T[], id: string) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            const updatedData = data.filter(item => (item as any).id !== id);
            onGameDataUpdate(key, updatedData);
        }
    };
    
    const handleSaveLocation = (locationToSave: Location) => {
        let updatedLocations;
        if (editingLocation && editingLocation.id) {
            updatedLocations = gameData.locations.map(loc => loc.id === locationToSave.id ? locationToSave : loc);
        } else {
            updatedLocations = [...gameData.locations, locationToSave];
        }
        if(locationToSave.isStartLocation){
            updatedLocations = updatedLocations.map(loc => loc.id === locationToSave.id ? loc : {...loc, isStartLocation: false});
        }
        onGameDataUpdate('locations', updatedLocations);
        setEditingLocation(null);
    };
    
    const handleDeleteLocation = (locationId: string) => {
        if (window.confirm('Are you sure you want to delete this location?')) {
            const updatedLocations = gameData.locations.filter(loc => loc.id !== locationId);
            onGameDataUpdate('locations', updatedLocations);
        }
    };


  const handleGoldInputChange = (userId: number, value: string) => {
    setGoldInputs(prev => ({ ...prev, [userId]: value }));
  };

  const handleSetGold = async (userId: number) => {
    const amountStr = goldInputs[userId];
    if (amountStr === undefined || amountStr.trim() === '') return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid, non-negative number for gold.');
        return;
    }
    try {
        await onUpdateCharacterGold(userId, amount);
        handleGoldInputChange(userId, ''); // Clear input on success
    } catch (err) {
        // Error is already alerted in App.tsx, but we can log it here too
        console.error("Failed to set gold:", err);
    }
  };

  const handleResetGold = async (userId: number) => {
    if (window.confirm('Are you sure you want to reset this character\'s gold to 0?')) {
        try {
            await onUpdateCharacterGold(userId, 0);
        } catch (err) {
            // Error is already alerted in App.tsx
        }
    }
  };


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
    if (updatedSettings.newsContent !== gameData.settings.newsContent) {
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

  const runDuplicationAudit = async () => {
    setIsAuditing(true);
    try {
        const results = await api.runDuplicationAudit();
        setDuplicationResults(results);
    } catch (err: any) {
        alert(`Audit failed: ${err.message}`);
    } finally {
        setIsAuditing(false);
    }
  };
  
  const resolveDuplications = async () => {
    if (window.confirm(`Are you sure you want to resolve ${duplicationResults.length} duplicate sets? The item instance with the highest priority (Equipment > Market > Inventory > Mailbox) will be kept.`)) {
        setIsResolving(true);
        try {
            const result = await api.resolveDuplications();
            alert(`Resolved ${result.resolvedSets} duplicate sets. Deleted ${result.itemsDeleted} item instances.`);
            runDuplicationAudit(); // Re-run audit to confirm
        } catch (err: any) {
            alert(`Resolution failed: ${err.message}`);
        } finally {
            setIsResolving(false);
        }
    }
  };

  const runOrphanAudit = async () => {
    setIsAuditingOrphans(true);
    try {
        const results = await api.runOrphanAudit();
        setOrphanResults(results);
    } catch (err: any) {
        alert(`Orphan audit failed: ${err.message}`);
    } finally {
        setIsAuditingOrphans(false);
    }
};

const resolveOrphans = async () => {
    if (window.confirm(`Are you sure you want to resolve ${orphanResults.length} sets of orphaned items? This will permanently delete items that no longer have a valid template.`)) {
        setIsResolvingOrphans(true);
        try {
            const result = await api.resolveOrphans();
            alert(`Resolved orphans. ${result.itemsRemoved} items were removed from ${result.charactersAffected} characters.`);
            await runOrphanAudit(); // Re-run audit
        } catch (err: any) {
            alert(`Failed to resolve orphans: ${err.message}`);
        } finally {
            setIsResolvingOrphans(false);
        }
    }
};

const handleFindItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSearchId.trim()) return;
    setIsSearchingItem(true);
    setItemSearchError(null);
    setSearchResult(null);
    try {
        const result = await api.findItemById(itemSearchId.trim());
        setSearchResult(result);
    } catch (err: any) {
        setSearchResult(null);
        setItemSearchError(err.message);
    } finally {
        setIsSearchingItem(false);
    }
};

  const filteredItems = useMemo(() => {
    return gameData.itemTemplates.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(itemSearch.toLowerCase());
        const rarityMatch = itemRarityFilter === 'all' || item.rarity === itemRarityFilter;
        const slotMatch = itemSlotFilter === 'all' || item.slot === itemSlotFilter;
        return nameMatch && rarityMatch && slotMatch;
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [gameData.itemTemplates, itemSearch, itemRarityFilter, itemSlotFilter]);

  const { filteredPrefixes, filteredSuffixes } = useMemo(() => {
    const prefixes = gameData.affixes.filter(a => a.type === 'Prefix' && a.name.masculine.toLowerCase().includes(affixSearch.toLowerCase())).sort((a,b) => a.name.masculine.localeCompare(b.name.masculine));
    const suffixes = gameData.affixes.filter(a => a.type === 'Suffix' && a.name.masculine.toLowerCase().includes(affixSearch.toLowerCase())).sort((a,b) => a.name.masculine.localeCompare(b.name.masculine));
    return { filteredPrefixes: prefixes, filteredSuffixes: suffixes };
  }, [gameData.affixes, affixSearch]);

    const formatAffixBonuses = (affix: Affix): string => {
        const parts: string[] = [];
        const formatMinMax = (val: { min: number, max: number } | undefined, prefix: string = '', suffix: string = '') => {
            if (!val) return null;
            return `${prefix}${val.min !== val.max ? `${val.min}-${val.max}` : val.min}${suffix}`;
        }
        
        if (affix.statsBonus) {
            for (const [key, value] of Object.entries(affix.statsBonus)) {
                if(value) parts.push(formatMinMax(value, `+`, ` ${t(`statistics.${key}` as any)}`)!);
            }
        }
        
        if (affix.damageMin) parts.push(formatMinMax(affix.damageMin, `+`, ` Min Dmg`)!);
        if (affix.damageMax) parts.push(formatMinMax(affix.damageMax, `+`, ` Max Dmg`)!);
        if (affix.armorBonus) parts.push(formatMinMax(affix.armorBonus, `+`, ` Pancerza`)!);
        if (affix.critChanceBonus) parts.push(formatMinMax(affix.critChanceBonus, `+`, `% Szansy na kryt.`)!);
        if (affix.maxHealthBonus) parts.push(formatMinMax(affix.maxHealthBonus, `+`, ` Zdr.`)!);

        return parts.slice(0, 3).join(', '); // Show up to 3 for brevity
    };


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
        {adminTab === 'general' && (
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
                       {Object.values(ItemRarity).filter(r => r !== ItemRarity.Epic && r !== ItemRarity.Legendary).map(rarity => (
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
        )}
        {adminTab === 'users' && (
          <div className="animate-fade-in">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.manageCharacters')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-xs text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">{t('admin.owner')}</th>
                    <th className="p-3">{t('admin.general.name')}</th>
                    <th className="p-3">{t('statistics.level')}</th>
                    <th className="p-3">{t('resources.gold')}</th>
                    <th className="p-3">Zarządzaj Złotem</th>
                    <th className="p-3 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {allCharacters.map(char => (
                    <tr key={char.user_id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                      <td className="p-3">{char.user_id}</td>
                      <td className="p-3">{char.username}</td>
                      <td className="p-3 font-semibold">{char.name}</td>
                      <td className="p-3">{char.level}</td>
                      <td className="p-3 font-mono">{char.gold.toLocaleString()}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={goldInputs[char.user_id] || ''}
                            onChange={(e) => handleGoldInputChange(char.user_id, e.target.value)}
                            className="w-24 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm"
                            placeholder="Ilość"
                          />
                          <button onClick={() => handleSetGold(char.user_id)} className="px-2 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">Ustaw</button>
                          <button onClick={() => handleResetGold(char.user_id)} className="px-2 py-1 text-xs rounded bg-amber-800 hover:bg-amber-700">Wyzeruj</button>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => onHealCharacter(char.user_id)} className="px-2 py-1 text-xs rounded bg-green-700 hover:bg-green-600">Ulecz</button>
                            <button onClick={() => onResetCharacterStats(char.user_id)} className="px-2 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600">Resetuj Staty</button>
                            <button onClick={() => onDeleteCharacter(char.user_id)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">Usuń</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {adminTab === 'locations' && (
             <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-indigo-400">{t('admin.location.manage')}</h3>
                    <button onClick={() => setEditingLocation({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.location.add')}</button>
                </div>
                {editingLocation ? (
                    <LocationEditor location={editingLocation} onSave={handleSaveLocation} onCancel={() => setEditingLocation(null)} isEditing={!!editingLocation.id} allLocations={gameData.locations} />
                ) : (
                    <div className="space-y-2">
                        {gameData.locations.map(loc => (
                             <div key={loc.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{loc.name} {loc.isStartLocation && <span className="text-xs text-amber-400">({t('admin.location.start')})</span>}</p>
                                    <p className="text-sm text-gray-400">{loc.description}</p>
                                </div>
                                <div className="space-x-2">
                                    <button onClick={() => setEditingLocation(loc)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                                    <button onClick={() => handleDeleteLocation(loc.id)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
        {adminTab === 'expeditions' && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-indigo-400">{t('admin.expedition.manage')}</h3>
                    <button onClick={() => setEditingExpedition({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.expedition.add')}</button>
                </div>
                {editingExpedition ? (
                    <ExpeditionEditor expedition={editingExpedition} onSave={(exp) => handleSaveData('expeditions', gameData.expeditions, exp, setEditingExpedition)} onCancel={() => setEditingExpedition(null)} isEditing={!!editingExpedition.id} allLocations={gameData.locations} allEnemies={gameData.enemies} allItemTemplates={gameData.itemTemplates} />
                ) : (
                     <div className="space-y-2">
                        {gameData.expeditions.map(exp => (
                             <div key={exp.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{exp.name}</p>
                                    <p className="text-sm text-gray-400">{exp.description}</p>
                                </div>
                                <div className="space-x-2">
                                    <button onClick={() => setEditingExpedition(exp)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                                    <button onClick={() => handleDeleteData('expeditions', gameData.expeditions, exp.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
        {adminTab === 'enemies' && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-indigo-400">{t('admin.enemy.manage')}</h3>
                    <button onClick={() => setEditingEnemy({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.enemy.add')}</button>
                </div>
                {editingEnemy ? (
                    <EnemyEditor enemy={editingEnemy} onSave={(enemy) => handleSaveData('enemies', gameData.enemies, enemy, setEditingEnemy)} onCancel={() => setEditingEnemy(null)} isEditing={!!editingEnemy.id} allItemTemplates={gameData.itemTemplates} />
                ) : (
                    <div className="space-y-2">
                        {gameData.enemies.map(enemy => (
                             <div key={enemy.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                <div><p className="font-semibold">{enemy.name}</p></div>
                                <div className="space-x-2">
                                    <button onClick={() => setEditingEnemy(enemy)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                                    <button onClick={() => handleDeleteData('enemies', gameData.enemies, enemy.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
        {adminTab === 'items' && (
             <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-indigo-400">{t('admin.manageItems')}</h3>
                    <button onClick={() => setEditingItem({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.item.add')}</button>
                </div>
                {editingItem ? (
                     <ItemEditor item={editingItem} onSave={(item) => handleSaveData('itemTemplates', gameData.itemTemplates, item, setEditingItem)} onCancel={() => setEditingItem(null)} isEditing={!!editingItem.id} />
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-800/50 rounded-lg">
                            <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder={t('admin.general.searchByName')} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/>
                            <select value={itemRarityFilter} onChange={e => setItemRarityFilter(e.target.value as ItemRarity | 'all')} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2">
                                <option value="all">{t('admin.item.allRarities')}</option>
                                {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                            </select>
                            <select value={itemSlotFilter} onChange={e => setItemSlotFilter(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2">
                                <option value="all">{t('admin.item.allSlots')}</option>
                                {Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{s}</option>)}
                                <option value="ring">ring</option>
                            </select>
                        </div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                             {filteredItems.map(item => (
                                 <div key={item.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                    <div className="flex-1">
                                        <p className={`font-semibold ${rarityStyles[item.rarity].text}`}>{item.name}</p>
                                        <div className="flex gap-4 text-xs text-gray-400 mt-1">
                                            {(item.damageMin || item.damageMax) && <span>DMG: {item.damageMin?.min}-{item.damageMax?.max}</span>}
                                            {item.armorBonus && <span>ARM: {item.armorBonus.min}-{item.armorBonus.max}</span>}
                                            <span>Lvl: {item.requiredLevel}</span>
                                            <span className="italic">{item.slot}</span>
                                        </div>
                                    </div>
                                    <div className="space-x-2 flex-shrink-0">
                                        <button onClick={() => setEditingItem(item)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                                        <button onClick={() => handleDeleteData('itemTemplates', gameData.itemTemplates, item.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        )}
        {adminTab === 'affixes' && (
             <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-indigo-400">{t('admin.affix.manage')}</h3>
                     <div className="space-x-2">
                        <button onClick={() => setEditingAffix({ type: AffixType.Prefix })} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.affix.addPrefix')}</button>
                        <button onClick={() => setEditingAffix({ type: AffixType.Suffix })} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.affix.addSuffix')}</button>
                    </div>
                </div>
                {editingAffix ? (
                    <AffixEditor affix={editingAffix} onSave={(affix) => handleSaveData('affixes', gameData.affixes, affix, setEditingAffix)} onCancel={() => setEditingAffix(null)} isEditing={!!editingAffix.id} />
                ) : (
                    <>
                        <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                             <input type="text" value={affixSearch} onChange={e => setAffixSearch(e.target.value)} placeholder={t('admin.general.searchByName')} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-lg font-bold text-gray-300 mb-2">{t('admin.affix.prefixes')}</h4>
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                    {filteredPrefixes.map(affix => (
                                        <div key={affix.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-sky-400">{affix.name.masculine}</p>
                                                <p className="text-xs text-gray-400 mt-1">{formatAffixBonuses(affix)}</p>
                                            </div>
                                            <div className="space-x-2"><button onClick={() => setEditingAffix(affix)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button><button onClick={() => handleDeleteData('affixes', gameData.affixes, affix.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-300 mb-2">{t('admin.affix.suffixes')}</h4>
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                     {filteredSuffixes.map(affix => (
                                        <div key={affix.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-amber-400">{affix.name.masculine}</p>
                                                <p className="text-xs text-gray-400 mt-1">{formatAffixBonuses(affix)}</p>
                                            </div>
                                            <div className="space-x-2"><button onClick={() => setEditingAffix(affix)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button><button onClick={() => handleDeleteData('affixes', gameData.affixes, affix.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}
        {adminTab === 'quests' && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-indigo-400">{t('admin.quest.manage')}</h3>
                    <button onClick={() => setEditingQuest({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.quest.add')}</button>
                </div>
                {editingQuest ? (
                    <QuestEditor quest={editingQuest} onSave={(quest) => handleSaveData('quests', gameData.quests, quest, setEditingQuest)} onCancel={() => setEditingQuest(null)} isEditing={!!editingQuest.id} gameData={gameData} />
                ) : (
                    <div className="space-y-2">
                        {gameData.quests.map(quest => (
                             <div key={quest.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                <div><p className="font-semibold">{quest.name}</p></div>
                                <div className="space-x-2">
                                    <button onClick={() => setEditingQuest(quest)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                                    <button onClick={() => handleDeleteData('quests', gameData.quests, quest.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
         {adminTab === 'pvp' && (
          <div className="animate-fade-in space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.pvp.title')}</h3>
                <div className="max-w-md space-y-4">
                     <div>
                        <label htmlFor="pvpProtectionMinutes" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.pvp.protectionDuration')}</label>
                        <input type="number" id="pvpProtectionMinutes" name="pvpProtectionMinutes" value={settings.pvpProtectionMinutes || 60} onChange={handleSettingsChange} className="w-full bg-slate-700 p-2 rounded-md" />
                        <p className="text-xs text-gray-500 mt-1">{t('admin.pvp.protectionDurationDesc')}</p>
                    </div>
                     <button onClick={handleSaveSettings} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.pvp.actions')}</h3>
                <button onClick={onResetAllPvpCooldowns} className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white font-semibold">
                    {t('admin.pvp.resetCooldowns')}
                </button>
              </div>
          </div>
        )}
        {adminTab === 'itemInspector' && (
            <div className="animate-fade-in">
                <h3 className="text-2xl font-bold text-indigo-400 mb-4">Inspektor Przedmiotów</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Wyszukaj przedmiot w całej grze po jego unikalnym ID, aby zobaczyć jego statystyki, właściciela i lokalizację.
                </p>
                <form onSubmit={handleFindItem} className="flex gap-4 mb-6">
                    <input
                        type="text"
                        value={itemSearchId}
                        onChange={(e) => { setItemSearchId(e.target.value); setItemSearchError(null); setSearchResult(null); }}
                        placeholder="Wpisz unikalne ID przedmiotu..."
                        className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2"
                    />
                    <button
                        type="submit"
                        disabled={isSearchingItem || !itemSearchId.trim()}
                        className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        {isSearchingItem ? 'Szukanie...' : 'Szukaj'}
                    </button>
                </form>

                {itemSearchError && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 text-center p-3 rounded-lg">
                        {itemSearchError}
                    </div>
                )}

                {searchResult && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 animate-fade-in">
                        <div className="bg-slate-800/50 p-4 rounded-lg">
                            <ItemDetailsPanel 
                                item={searchResult.item}
                                template={searchResult.template}
                                affixes={gameData.affixes}
                            />
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-lg">
                            <h4 className="text-lg font-bold text-indigo-400 mb-2">Lokalizacje Przedmiotu</h4>
                            {searchResult.locations.length > 0 ? (
                                <ul className="space-y-2 text-sm">
                                    {searchResult.locations.map((loc, index) => (
                                        <li key={index} className="bg-slate-700/50 p-2 rounded">
                                            <p><strong>Właściciel:</strong> {loc.ownerName} (ID: {loc.userId})</p>
                                            <p><strong>Lokalizacja:</strong> <span className="font-mono">{loc.location}</span></p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">Nie znaleziono lokalizacji (może to być błąd). </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
        {adminTab === 'duplicationAudit' && (
             <div className="animate-fade-in">
                <h3 className="text-2xl font-bold text-indigo-400 mb-4">Audyt duplikatów przedmiotów</h3>
                 <div className="flex gap-4 mb-4">
                    <button onClick={runDuplicationAudit} disabled={isAuditing} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
                        {isAuditing ? 'Audytowanie...' : 'Uruchom audyt'}
                    </button>
                    {duplicationResults.length > 0 && (
                        <button onClick={resolveDuplications} disabled={isResolving} className="px-4 py-2 rounded-md bg-red-800 hover:bg-red-700 font-semibold disabled:bg-slate-600">
                            {isResolving ? 'Rozwiązywanie...' : `Rozwiąż ${duplicationResults.length} duplikatów`}
                        </button>
                    )}
                 </div>
                 {duplicationResults.length === 0 && !isAuditing && <p className="text-gray-400">Nie znaleziono duplikatów.</p>}
                 <div className="space-y-2">
                    {duplicationResults.map(dup => (
                         <div key={dup.uniqueId} className="bg-slate-800/50 p-3 rounded-lg">
                             <p className="font-semibold text-white">{dup.itemName} (ID: {dup.uniqueId})</p>
                             <ul className="list-disc list-inside text-sm text-gray-300 mt-1">
                                {dup.instances.map((inst, index) => (
                                    <li key={index}>{inst.ownerName} ({inst.location})</li>
                                ))}
                             </ul>
                         </div>
                    ))}
                 </div>
            </div>
        )}
        {adminTab === 'orphanAudit' && (
            <div className="animate-fade-in">
                <h3 className="text-2xl font-bold text-indigo-400 mb-4">Audyt osieroconych przedmiotów</h3>
                <p className="text-sm text-gray-400 mb-4">
                    To narzędzie wyszukuje przedmioty w ekwipunkach graczy, których szablony (item templates) zostały usunięte z gry. Takie przedmioty mogą powodować błędy.
                </p>
                <div className="flex gap-4 mb-4">
                    <button onClick={runOrphanAudit} disabled={isAuditingOrphans} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
                        {isAuditingOrphans ? 'Audytowanie...' : 'Uruchom audyt'}
                    </button>
                    {orphanResults.length > 0 && (
                        <button onClick={resolveOrphans} disabled={isResolvingOrphans} className="px-4 py-2 rounded-md bg-red-800 hover:bg-red-700 font-semibold disabled:bg-slate-600">
                            {isResolvingOrphans ? 'Usuwanie...' : `Usuń ${orphanResults.reduce((sum, r) => sum + r.orphans.length, 0)} osieroconych przedmiotów`}
                        </button>
                    )}
                </div>
                {orphanResults.length === 0 && !isAuditingOrphans && <p className="text-gray-400">Nie znaleziono osieroconych przedmiotów.</p>}
                <div className="space-y-2">
                    {orphanResults.map(result => (
                        <div key={result.userId} className="bg-slate-800/50 p-3 rounded-lg">
                            <p className="font-semibold text-white">Gracz: {result.characterName} (ID: {result.userId})</p>
                            <ul className="list-disc list-inside text-sm text-gray-300 mt-1">
                                {result.orphans.map((orphan, index) => (
                                    <li key={index}>ID szablonu: <span className="font-mono text-red-400">{orphan.templateId}</span>, Unikalne ID: <span className="font-mono text-gray-500">{orphan.uniqueId}</span>, Lokalizacja: <span className="font-mono">{orphan.location}</span></li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </ContentPanel>
  );
};