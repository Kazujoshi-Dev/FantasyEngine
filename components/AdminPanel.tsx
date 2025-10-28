import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { Location, Tab, Expedition, Enemy, GameSettings, Language, User, AdminCharacterInfo, ItemTemplate, EquipmentSlot, ItemRarity, CharacterStats, LootDrop, TraderSettings, EssenceType, ResourceDrop, MagicAttackType, Quest, QuestType, ItemReward, ResourceReward } from '../types';
import { SwordsIcon } from './icons/SwordsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { rarityStyles, ItemTooltip } from './shared/ItemSlot';
import { SettingsIcon } from './icons/SettingsIcon';

interface AdminPanelProps {
  locations: Location[];
  onLocationsUpdate: (locations: Location[]) => void;
  expeditions: Expedition[];
  onExpeditionsUpdate: (expeditions: Expedition[]) => void;
  enemies: Enemy[];
  onEnemiesUpdate: (enemies: Enemy[]) => void;
  itemTemplates: ItemTemplate[];
  onItemTemplatesUpdate: (itemTemplates: ItemTemplate[]) => void;
  quests: Quest[];
  onQuestsUpdate: (quests: Quest[]) => void;
  settings: GameSettings;
  onSettingsUpdate: (settings: GameSettings) => void;
  users: User[];
  onDeleteUser: (userId: number) => void;
  allCharacters: AdminCharacterInfo[];
  onDeleteCharacter: (userId: number) => void;
  onResetCharacterStats: (userId: number) => void;
  onHealCharacter: (userId: number) => void;
  onForceTraderRefresh: () => void;
  onResetAllPvpCooldowns: () => void;
}

type AdminTab = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'items' | 'quests' | 'pvp';


const LocationEditor: React.FC<{
  location: Partial<Location>;
  onSave: (location: Location) => void;
  onCancel: () => void;
  isEditing: boolean;
  allLocations: Location[];
}> = ({ location, onSave, onCancel, isEditing, allLocations }) => {
  const [formData, setFormData] = useState<Partial<Location>>(location);
  const allTabs = (Object.values(Tab).filter(v => typeof v === 'number') as Tab[]).filter(t => t !== Tab.Admin);
  
  const tabLabels: { [key in Tab]?: string } = {
      [Tab.Statistics]: 'Statistics',
      [Tab.Equipment]: 'Equipment',
      [Tab.Expedition]: 'Expedition',
      [Tab.Trader]: 'Trader',
      [Tab.Blacksmith]: 'Blacksmith',
      [Tab.Camp]: 'Camp',
      [Tab.Location]: 'Location',
      [Tab.Resources]: 'Resources',
      [Tab.Ranking]: 'Ranking',
      [Tab.Quests]: 'Quests',
      [Tab.Messages]: 'Messages',
      [Tab.Tavern]: 'Tavern',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
        alert("Location name is required.");
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
      isStartLocation: formData.isStartLocation || false
    };

    if (finalLocation.isStartLocation) {
        finalLocations = finalLocations.map(loc => ({ ...loc, isStartLocation: false }));
    }
    
    onSave(finalLocation);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
        <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? "Edit Location" : "Create New Location"}</h3>
        <div>
            <label className="block text-sm font-medium text-gray-300">Name</label>
            <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-300">Description</label>
            <textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={3} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"></textarea>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
                <span className="text-sm font-medium text-gray-300">Travel cost (gold)</span>
                <input type="number" name="travelCost" value={formData.travelCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
            </label>
            <label className="block">
                <span className="text-sm font-medium text-gray-300">Travel cost (energy)</span>
                <input type="number" name="travelEnergyCost" value={formData.travelEnergyCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
            </label>
            <label className="block">
                <span className="text-sm font-medium text-gray-300">Travel time (seconds)</span>
                <input type="number" name="travelTime" value={formData.travelTime || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"/>
            </label>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Available tabs</label>
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
                <span>Starting location</span>
            </label>
            {formData.isStartLocation && <p className="text-xs text-amber-400 mt-1">Note: Setting this location as the starting one will remove this status from the previous one.</p>}
        </div>
        <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">Save</button>
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
        alert("Expedition name is required.");
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
    { id: 'basic', label: 'Informacje Podstawowe' },
    { id: 'enemies', label: 'Przeciwnicy' },
    { id: 'rewards', label: 'Nagrody' },
  ];
  
  return (
     <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6">
        <h3 className="text-xl font-bold text-indigo-400 mb-4">{isEditing ? "Edytuj Ekspedycję" : "Stwórz Nową Ekspedycję"}</h3>
        
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
                    <div><label className="block text-sm font-medium text-gray-300">Nazwa</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></div>
                    <div><label className="block text-sm font-medium text-gray-300">Opis</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={3} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"></textarea></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.expeditionGoldCost')}</span><input type="number" name="goldCost" value={formData.goldCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></label>
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.expeditionEnergyCost')}</span><input type="number" name="energyCost" value={formData.energyCost || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></label>
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.expeditionDuration')}</span><input type="number" name="duration" value={formData.duration || 60} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/></label>
                        <label className="block"><span className="text-sm font-medium text-gray-300">{t('admin.maxEnemies')}</span><input type="number" name="maxEnemies" min="0" value={formData.maxEnemies || 0} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2" title={t('admin.maxEnemiesDesc')}/></label>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Dostępna w lokacjach</label>
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
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Przeciwnicy (szansa na pojawienie się %)</label><input type="text" placeholder="Szukaj przeciwnika..." value={enemySearch} onChange={e => setEnemySearch(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2" /></div>
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
                        <div className="bg-slate-800/50 p-3 rounded-md"><label className="block text-sm font-medium text-gray-300 mb-2">Nagroda w złocie</label><div className="flex items-end space-x-2"><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.min')}</label><input type="number" min="0" name="minBaseGoldReward" value={formData.minBaseGoldReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div><span className="text-gray-400 pb-2">-</span><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.max')}</label><input type="number" min="0" name="maxBaseGoldReward" value={formData.maxBaseGoldReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div></div></div>
                        <div className="bg-slate-800/50 p-3 rounded-md"><label className="block text-sm font-medium text-gray-300 mb-2">Nagroda w doświadczeniu</label><div className="flex items-end space-x-2"><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.min')}</label><input type="number" min="0" name="minBaseExperienceReward" value={formData.minBaseExperienceReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div><span className="text-gray-400 pb-2">-</span><div className="flex-1"><label className="block text-xs font-medium text-gray-400">{t('admin.max')}</label><input type="number" min="0" name="maxBaseExperienceReward" value={formData.maxBaseExperienceReward ?? ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div></div></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.lootTable')}</label>
                        <div className="flex gap-4 mb-2"><input type="text" placeholder="Szukaj przedmiotu..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/><select value={itemRarityFilter} onChange={e => setItemRarityFilter(e.target.value as ItemRarity | 'all')} className="bg-slate-700 border border-slate-600 rounded-md px-3 py-2"><option value="all">Wszystkie rzadkości</option>{Object.values(ItemRarity).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2 bg-slate-800/30 rounded-md">
                            {filteredItems.map(item => {
                                const currentLoot = formData.lootTable?.find(l => l.templateId === item.id);
                                return <div key={item.id} className="relative group hover:z-20"><label htmlFor={`loot-${item.id}`} className={`text-xs ${rarityStyles[item.rarity].text}`}>{item.name}</label><input type="number" id={`loot-${item.id}`} min="0" max="100" value={currentLoot?.chance || ''} onChange={(e) => handleLootChanceChange(item.id, parseInt(e.target.value, 10) || 0)} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/><ItemTooltip instance={{ uniqueId: `tooltip-exp-${item.id}`, templateId: item.id }} template={item}/></div>;
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

        <div className="flex justify-end space-x-4 pt-6 border-t border-slate-700 mt-6">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">Anuluj</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">Zapisz</button>
        </div>
     </form>
  )
}

const EnemyEditor: React.FC<{
  enemy: Partial<Enemy>;
  onSave: (enemy: Enemy) => void;
  onCancel: () => void;
  isEditing: boolean;
  allItemTemplates: ItemTemplate[];
}> = ({ enemy, onSave, onCancel, isEditing, allItemTemplates }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Enemy>>(enemy);
    const magicAttackTypes = Object.values(MagicAttackType);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value }));
    };

    const handleNestedChange = (category: 'stats' | 'rewards', e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [name]: name === 'magicAttackType' ? value : parseInt(value, 10) || 0,
            }
        }));
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
            if (value > 0) {
                const updatedDrop = { ...newLoot[existingIndex], [field]: value };
                if (updatedDrop.min || updatedDrop.max || updatedDrop.chance) {
                    newLoot[existingIndex] = updatedDrop;
                } else {
                    newLoot.splice(existingIndex, 1);
                }
            } else {
                 const updatedDrop = { ...newLoot[existingIndex], [field]: 0 };
                 if (updatedDrop.min || updatedDrop.max || updatedDrop.chance) {
                    newLoot[existingIndex] = updatedDrop;
                } else {
                    newLoot.splice(existingIndex, 1);
                }
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
            alert("Enemy name is required."); return;
        }

        const rewards = {
            minGold: formData.rewards?.minGold ?? 0,
            maxGold: formData.rewards?.maxGold ?? 0,
            minExperience: formData.rewards?.minExperience ?? 0,
            maxExperience: formData.rewards?.maxExperience ?? 0,
        };

        if (rewards.maxGold < rewards.minGold) {
            rewards.maxGold = rewards.minGold;
        }
        if (rewards.maxExperience < rewards.minExperience) {
            rewards.maxExperience = rewards.minExperience;
        }

        const finalEnemy: Enemy = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name,
            description: formData.description || '',
            stats: {
                maxHealth: formData.stats?.maxHealth || 10,
                minDamage: formData.stats?.minDamage || 1,
                maxDamage: formData.stats?.maxDamage || 2,
                armor: formData.stats?.armor || 0,
                critChance: formData.stats?.critChance || 5,
                agility: formData.stats?.agility || 0,
                attacksPerTurn: formData.stats?.attacksPerTurn,
                maxMana: formData.stats?.maxMana,
                manaRegen: formData.stats?.manaRegen,
                magicDamageMin: formData.stats?.magicDamageMin,
                magicDamageMax: formData.stats?.magicDamageMax,
                magicAttackChance: formData.stats?.magicAttackChance,
                magicAttackType: formData.stats?.magicAttackType,
                magicAttackManaCost: formData.stats?.magicAttackManaCost,
            },
            rewards: rewards,
            lootTable: formData.lootTable || [],
            resourceLootTable: formData.resourceLootTable || [],
        };
        onSave(finalEnemy);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
             <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? "Edit Enemy" : "Create New Enemy"}</h3>
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/>
             </div>

             <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">Statistics</h4>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Health</label>
                    <input type="number" name="maxHealth" value={formData.stats?.maxHealth ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Min. Damage</label>
                    <input type="number" name="minDamage" value={formData.stats?.minDamage ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max. Damage</label>
                    <input type="number" name="maxDamage" value={formData.stats?.maxDamage ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Armor</label>
                    <input type="number" name="armor" value={formData.stats?.armor ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Crit Chance (%)</label>
                    <input type="number" name="critChance" value={formData.stats?.critChance ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Agility</label>
                    <input type="number" name="agility" value={formData.stats?.agility ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Ataki na turę</label>
                    <input type="number" name="attacksPerTurn" value={formData.stats?.attacksPerTurn ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
             </div>
             
             <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('admin.enemy.magicProperties')}</h4>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.maxMana')}</label><input type="number" name="maxMana" value={formData.stats?.maxMana ?? ''} onChange={e => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.manaRegen')}</label><input type="number" name="manaRegen" value={formData.stats?.manaRegen ?? ''} onChange={e => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicDamageMin')}</label><input type="number" name="magicDamageMin" value={formData.stats?.magicDamageMin ?? ''} onChange={e => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicDamageMax')}</label><input type="number" name="magicDamageMax" value={formData.stats?.magicDamageMax ?? ''} onChange={e => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicAttackChance')}</label><input type="number" name="magicAttackChance" value={formData.stats?.magicAttackChance ?? ''} onChange={e => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicAttackManaCost')}</label><input type="number" name="magicAttackManaCost" value={formData.stats?.magicAttackManaCost ?? ''} onChange={e => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicAttackType')}</label><select name="magicAttackType" value={formData.stats?.magicAttackType ?? ''} onChange={e => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{magicAttackTypes.map(type => <option key={type} value={type}>{t(`item.magic.${type}`)}</option>)}</select></div>
             </div>

             <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">Rewards</h4>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Min Gold</label>
                    <input type="number" name="minGold" value={formData.rewards?.minGold ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max Gold</label>
                    <input type="number" name="maxGold" value={formData.rewards?.maxGold ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Min Experience</label>
                    <input type="number" name="minExperience" value={formData.rewards?.minExperience ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Max Experience</label>
                    <input type="number" name="maxExperience" value={formData.rewards?.maxExperience ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
             </div>
             
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.lootTable')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2 bg-slate-800/30 rounded-md">
                    {allItemTemplates.map(item => {
                        const currentLoot = formData.lootTable?.find(l => l.templateId === item.id);
                        return (
                            <div key={item.id} className="relative group hover:z-20">
                                <label htmlFor={`loot-enemy-${item.id}`} className={`text-xs ${rarityStyles[item.rarity].text}`}>{item.name}</label>
                                <input type="number" id={`loot-enemy-${item.id}`} min="0" max="100" value={currentLoot?.chance || ''} onChange={(e) => handleLootChanceChange(item.id, parseInt(e.target.value, 10) || 0)} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/>
                                <ItemTooltip instance={{ uniqueId: `tooltip-enemy-${item.id}`, templateId: item.id }} template={item} />
                            </div>
                        )
                    })}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.resourceLootTable')}</label>
                <div className="grid grid-cols-4 gap-2 items-center text-xs text-gray-400 font-bold mb-2 px-1">
                    <span className="col-span-1">{t('admin.resource')}</span>
                    <span className="text-center">{t('admin.min')}</span>
                    <span className="text-center">{t('admin.max')}</span>
                    <span className="text-center">{t('admin.chance')}</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.values(EssenceType).map(essence => {
                        const currentLoot = formData.resourceLootTable?.find(l => l.resource === essence);
                        return (
                             <div key={essence} className="grid grid-cols-4 gap-2 items-center">
                                <label className="text-gray-300 text-sm col-span-1">{t(`resources.${essence}`)}</label>
                                <input type="number" min="0" aria-label={`${t(`resources.${essence}`)} min amount`} value={currentLoot?.min || ''} onChange={e => handleResourceLootChange(essence, 'min', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/>
                                <input type="number" min="0" aria-label={`${t(`resources.${essence}`)} max amount`} value={currentLoot?.max || ''} onChange={e => handleResourceLootChange(essence, 'max', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/>
                                <input type="number" min="0" max="100" aria-label={`${t(`resources.${essence}`)} chance`} value={currentLoot?.chance || ''} onChange={e => handleResourceLootChange(essence, 'chance', parseInt(e.target.value) || 0)} className="w-full bg-slate-700 p-2 rounded-md"/>
                            </div>
                        )
                    })}
                </div>
            </div>
             
             <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">Save</button>
            </div>
        </form>
    );
};

const ItemEditor: React.FC<{
  item: Partial<ItemTemplate>;
  onSave: (item: ItemTemplate) => void;
  onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<ItemTemplate>>(item);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;

        if (isCheckbox) {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            const isNumeric = ['value', 'requiredLevel', 'damageMin', 'damageMax', 'armorBonus', 'critChanceBonus', 'maxHealthBonus', 'attacksPerRound', 'critDamageModifierBonus', 'armorPenetrationPercent', 'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent', 'manaStealFlat', 'manaCost', 'magicDamageMin', 'magicDamageMax'].includes(name);
            setFormData(prev => ({...prev, [name]: isNumeric ? parseFloat(value) || 0 : value }));
        }
    };
    
    const handleStatsBonusChange = (stat: keyof CharacterStats, value: string) => {
        setFormData(prev => ({
            ...prev,
            statsBonus: {
                ...prev.statsBonus,
                [stat]: parseInt(value, 10) || 0
            }
        }));
    };
    
    const handleRequiredStatsChange = (stat: keyof CharacterStats, value: string) => {
        setFormData(prev => ({
            ...prev,
            requiredStats: {
                ...prev.requiredStats,
                [stat]: parseInt(value, 10) || 0
            }
        }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, icon: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.slot || !formData.rarity) {
            alert("Name, slot, and rarity are required.");
            return;
        }
        
        const finalItem: ItemTemplate = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name,
            description: formData.description || '',
            slot: formData.slot,
            rarity: formData.rarity,
            icon: formData.icon || '',
            value: formData.value || 0,
            requiredLevel: formData.requiredLevel || 1,
            requiredStats: formData.requiredStats || {},
            statsBonus: formData.statsBonus || {},
            damageMin: formData.damageMin,
            damageMax: formData.damageMax,
            attacksPerRound: formData.attacksPerRound,
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
            isMagical: formData.isMagical,
            magicAttackType: formData.magicAttackType,
            manaCost: formData.manaCost,
            magicDamageMin: formData.magicDamageMin,
            magicDamageMax: formData.magicDamageMax,
        };
        onSave(finalItem);
    };

    const primaryStatKeys: (keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
            <h3 className="text-xl font-bold text-indigo-400 mb-2">{item.id ? t('admin.item.edit') : t('admin.item.create')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-300">{t('item.name')}</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.slotLabel')}</label><select name="slot" value={formData.slot || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{t(`item.slot.${s}`)}</option>)}<option value="ring">Ring</option><option value="consumable">Consumable</option></select></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.rarity')}</label><select name="rarity" value={formData.rarity || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(ItemRarity).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-300">{t('item.description')}</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={2} className="mt-1 w-full bg-slate-700 p-2 rounded-md"></textarea></div>
            
            <div className="flex gap-4 items-start">
                <div className="flex-grow">
                    <label className="block text-sm font-medium text-gray-300">Ikona przedmiotu (URL)</label>
                    <input type="text" name="icon" value={formData.icon || ''} onChange={handleInputChange} placeholder="https://example.com/image.png" className="mt-1 w-full bg-slate-700 p-2 rounded-md"/>
                     <label className="block text-sm font-medium text-gray-300 mt-2">Lub prześlij plik</label>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="mt-1 w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"/>
                </div>
                <div className="flex-shrink-0">
                     <label className="block text-sm font-medium text-gray-300 text-center mb-1">Podgląd</label>
                    <div className="w-32 h-32 border-2 border-dashed border-slate-600 rounded-md flex items-center justify-center bg-slate-800">
                        {formData.icon ? <img src={formData.icon} alt="Podgląd ikony" className="w-full h-full object-contain"/> : <span className="text-slate-500 text-xs">Brak obrazka</span>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-gray-300">{t('item.value')}</label><input type="number" name="value" value={formData.value || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.levelRequirement')}</label><input type="number" name="requiredLevel" value={formData.requiredLevel || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.attacksPerRound')}</label><input type="number" name="attacksPerRound" value={formData.attacksPerRound || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
            </div>

            <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('item.requiredStats')}</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {primaryStatKeys.map(key => (
                    <div key={key}>
                        <label className="block text-xs font-medium text-gray-300">{t(`statistics.${key}`)}</label>
                        <input type="number" name={key} value={formData.requiredStats?.[key] || ''} onChange={(e) => handleRequiredStatsChange(key, e.target.value)} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/>
                    </div>
                ))}
            </div>

            <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('item.statBonuses')}</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {primaryStatKeys.map(key => (
                    <div key={key}><label className="block text-xs font-medium text-gray-300">{t(`statistics.${key}`)}</label><input type="number" name={key} value={formData.statsBonus?.[key] || ''} onChange={(e) => handleStatsBonusChange(key, e.target.value)} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                ))}
            </div>

            <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('item.secondaryBonuses')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-gray-300">{t('item.damageMin')}</label><input type="number" name="damageMin" value={formData.damageMin || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.damageMax')}</label><input type="number" name="damageMax" value={formData.damageMax || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.armorBonus')}</label><input type="number" name="armorBonus" value={formData.armorBonus || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.critChanceBonus')}</label><input type="number" step="0.1" name="critChanceBonus" value={formData.critChanceBonus || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.maxHealthBonus')}</label><input type="number" name="maxHealthBonus" value={formData.maxHealthBonus || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.critDamageModifierBonus')}</label><input type="number" name="critDamageModifierBonus" value={formData.critDamageModifierBonus || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.armorPenetrationPercent')}</label><input type="number" name="armorPenetrationPercent" value={formData.armorPenetrationPercent || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.armorPenetrationFlat')}</label><input type="number" name="armorPenetrationFlat" value={formData.armorPenetrationFlat || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.lifeStealPercent')}</label><input type="number" name="lifeStealPercent" value={formData.lifeStealPercent || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.lifeStealFlat')}</label><input type="number" name="lifeStealFlat" value={formData.lifeStealFlat || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.manaStealPercent')}</label><input type="number" name="manaStealPercent" value={formData.manaStealPercent || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.manaStealFlat')}</label><input type="number" name="manaStealFlat" value={formData.manaStealFlat || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
            </div>

            <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('item.magicProperties')}</h4>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <label className="flex items-center space-x-2 pt-6"><input type="checkbox" name="isMagical" checked={formData.isMagical || false} onChange={handleInputChange} className="form-checkbox h-5 w-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/><span>{t('item.isMagical')}</span></label>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.magicAttackType')}</label><select name="magicAttackType" value={formData.magicAttackType || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md" disabled={!formData.isMagical}><option value="">None</option>{Object.values(MagicAttackType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.manaCost')}</label><input type="number" name="manaCost" value={formData.manaCost || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md" disabled={!formData.isMagical}/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.magicDamageMin')}</label><input type="number" name="magicDamageMin" value={formData.magicDamageMin || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md" disabled={!formData.isMagical}/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.magicDamageMax')}</label><input type="number" name="magicDamageMax" value={formData.magicDamageMax || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md" disabled={!formData.isMagical}/></div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">Save</button>
            </div>
        </form>
    );
};

const QuestEditor: React.FC<{
  quest: Partial<Quest>;
  onSave: (quest: Quest) => void;
  onCancel: () => void;
  allLocations: Location[];
  allEnemies: Enemy[];
  allItemTemplates: ItemTemplate[];
}> = ({ quest, onSave, onCancel, allLocations, allEnemies, allItemTemplates }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Quest>>({
        ...quest,
        objective: quest.objective || { type: QuestType.Kill, amount: 1 },
        rewards: quest.rewards || { gold: 0, experience: 0, itemRewards: [], resourceRewards: [], lootTable: [] }
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'repeatable' ? parseInt(value) || 0 : value }));
    };

    const handleLocationToggle = (locationId: string) => {
        setFormData(prev => {
            const currentIds = prev.locationIds || [];
            const newIds = currentIds.includes(locationId) ? currentIds.filter(id => id !== locationId) : [...currentIds, locationId];
            return { ...prev, locationIds: newIds };
        });
    };
    
    const handleObjectiveChange = (field: keyof Quest['objective'], value: any) => {
        setFormData(prev => {
            const newObjective = { ...(prev.objective as Quest['objective']), [field]: value };
            // Reset targetId if type changes to PayGold
            if (field === 'type' && value === QuestType.PayGold) {
                newObjective.targetId = undefined;
            }
            return { ...prev, objective: newObjective };
        });
    };

    const handleRewardChange = (field: 'gold' | 'experience', value: any) => {
        setFormData(prev => {
            const currentRewards = prev.rewards || { gold: 0, experience: 0 };
            return {
                ...prev,
                rewards: {
                    ...currentRewards,
                    [field]: parseInt(value) || 0
                }
            };
        });
    };

    const handleDynamicRewardChange = (rewardType: 'itemRewards' | 'resourceRewards' | 'lootTable', index: number, field: string, value: any) => {
        setFormData(prev => {
            const rewards = prev.rewards || { gold: 0, experience: 0, itemRewards: [], resourceRewards: [], lootTable: [] };
            const list = (rewards[rewardType] as any[] | undefined) || [];
            const updatedList = [...list];
            updatedList[index] = { ...updatedList[index], [field]: value };
            return { ...prev, rewards: { ...rewards, [rewardType]: updatedList }};
        });
    };
    
    const addDynamicReward = (rewardType: 'itemRewards' | 'resourceRewards' | 'lootTable') => {
        setFormData(prev => {
            const rewards = prev.rewards || { gold: 0, experience: 0, itemRewards: [], resourceRewards: [], lootTable: [] };
            let newItem: any;
            if (rewardType === 'itemRewards') newItem = { templateId: '', quantity: 1 };
            else if (rewardType === 'resourceRewards') newItem = { resource: EssenceType.Common, quantity: 1 };
            else newItem = { templateId: '', chance: 10 };
            const list = (rewards[rewardType] as any[] | undefined) || [];
            const updatedList = [...list, newItem];
            return { ...prev, rewards: { ...rewards, [rewardType]: updatedList }};
        });
    };

    const removeDynamicReward = (rewardType: 'itemRewards' | 'resourceRewards' | 'lootTable', index: number) => {
        setFormData(prev => {
            const rewards = prev.rewards || { gold: 0, experience: 0, itemRewards: [], resourceRewards: [], lootTable: [] };
            const list = (rewards[rewardType] as any[] | undefined) || [];
            const updatedList = list.filter((_, i) => i !== index);
            return { ...prev, rewards: { ...rewards, [rewardType]: updatedList }};
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.objective?.type || formData.objective.amount <= 0) {
            alert("Name, objective type, and a valid amount are required.");
            return;
        }
        
        const finalQuest: Quest = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name,
            description: formData.description || '',
            locationIds: formData.locationIds || [],
            objective: {
                type: formData.objective.type,
                targetId: formData.objective.targetId,
                amount: formData.objective.amount,
            },
            rewards: {
                gold: formData.rewards?.gold || 0,
                experience: formData.rewards?.experience || 0,
                itemRewards: formData.rewards?.itemRewards?.filter(r => r.templateId && r.quantity > 0) || [],
                resourceRewards: formData.rewards?.resourceRewards?.filter(r => r.resource && r.quantity > 0) || [],
                lootTable: formData.rewards?.lootTable?.filter(r => r.templateId && r.chance > 0) || [],
            },
            repeatable: formData.repeatable === 0 ? 0 : formData.repeatable || 1,
        };

        onSave(finalQuest);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400 mb-2">{quest.id ? t('admin.quest.edit') : t('admin.quest.create')}</h3>
            
            {/* --- Basic Info --- */}
            <fieldset className="border border-slate-700 p-4 rounded-md space-y-4">
                <legend className="px-2 font-semibold">Informacje Podstawowe</legend>
                <div><label className="block text-sm font-medium text-gray-300">{t('admin.quest.name')}</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('item.description')}</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} rows={2} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300">{t('admin.quest.repeatable')}</label><input type="number" name="repeatable" min="0" value={formData.repeatable ?? 1} onChange={handleInputChange} className="mt-1 w-full bg-slate-700 p-2 rounded-md" title={t('admin.quest.repeatableDesc')}/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Dostępny w lokacjach</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{allLocations.map(loc => (<label key={loc.id} className="flex items-center space-x-2"><input type="checkbox" checked={formData.locationIds?.includes(loc.id) || false} onChange={() => handleLocationToggle(loc.id)} className="form-checkbox h-5 w-5 rounded bg-slate-700 border-slate-600 text-indigo-600"/><span>{loc.name}</span></label>))}</div></div>
            </fieldset>

            {/* --- Objective --- */}
            <fieldset className="border border-slate-700 p-4 rounded-md space-y-4">
                <legend className="px-2 font-semibold">{t('admin.quest.objective')}</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-medium text-gray-300">{t('admin.quest.objectiveType')}</label><select value={formData.objective?.type || ''} onChange={(e) => handleObjectiveChange('type', e.target.value as QuestType)} className="mt-1 w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(QuestType).map(type => <option key={type} value={type}>{t(`admin.quest.types.${type}`)}</option>)}</select></div>
                    {formData.objective?.type !== QuestType.PayGold && (<div><label className="block text-sm font-medium text-gray-300">{t('admin.quest.target')}</label><select value={formData.objective?.targetId || ''} onChange={(e) => handleObjectiveChange('targetId', e.target.value)} className="mt-1 w-full bg-slate-700 p-2 rounded-md" disabled={!formData.objective?.type}><option value="">{t('admin.select')}</option>{formData.objective?.type === QuestType.Kill && allEnemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}{formData.objective?.type === QuestType.Gather && allItemTemplates.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}{formData.objective?.type === QuestType.GatherResource && Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}</select></div>)}
                    <div><label className="block text-sm font-medium text-gray-300">{t('admin.quest.amount')}</label><input type="number" min="1" value={formData.objective?.amount || 1} onChange={(e) => handleObjectiveChange('amount', parseInt(e.target.value) || 1)} className="mt-1 w-full bg-slate-700 p-2 rounded-md" disabled={!formData.objective?.type}/></div>
                </div>
            </fieldset>

            {/* --- Rewards --- */}
            <fieldset className="border border-slate-700 p-4 rounded-md space-y-4">
                <legend className="px-2 font-semibold">{t('admin.quest.rewards')}</legend>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-300">{t('resources.gold')}</label><input type="number" value={formData.rewards?.gold || ''} onChange={(e) => handleRewardChange('gold', e.target.value)} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm font-medium text-gray-300">{t('expedition.experience')}</label><input type="number" value={formData.rewards?.experience || ''} onChange={(e) => handleRewardChange('experience', e.target.value)} className="mt-1 w-full bg-slate-700 p-2 rounded-md"/></div>
                </div>
                {/* Item Rewards */}
                <div><label className="block text-sm font-medium text-gray-300">{t('admin.quest.itemRewards')}</label>{
// FIX: Ensure formData.rewards.itemRewards is an array before calling map.
(formData.rewards?.itemRewards || []).map((reward, index) => (<div key={index} className="flex items-center gap-2 mt-2"><select value={reward.templateId} onChange={e => handleDynamicRewardChange('itemRewards', index, 'templateId', e.target.value)} className="flex-grow bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{allItemTemplates.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select><input type="number" min="1" value={reward.quantity} onChange={e => handleDynamicRewardChange('itemRewards', index, 'quantity', parseInt(e.target.value))} className="w-24 bg-slate-700 p-2 rounded-md"/><button type="button" onClick={() => removeDynamicReward('itemRewards', index)} className="px-2 py-1 bg-red-800 rounded">X</button></div>))}<button type="button" onClick={() => addDynamicReward('itemRewards')} className="mt-2 text-sm text-indigo-400 hover:text-indigo-300">+ Add Item</button></div>
                {/* Resource Rewards */}
                <div><label className="block text-sm font-medium text-gray-300">{t('admin.quest.resourceRewards')}</label>{
// FIX: Ensure formData.rewards.resourceRewards is an array before calling map.
(formData.rewards?.resourceRewards || []).map((reward, index) => (<div key={index} className="flex items-center gap-2 mt-2"><select value={reward.resource} onChange={e => handleDynamicRewardChange('resourceRewards', index, 'resource', e.target.value as EssenceType)} className="flex-grow bg-slate-700 p-2 rounded-md">{Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}</select><input type="number" min="1" value={reward.quantity} onChange={e => handleDynamicRewardChange('resourceRewards', index, 'quantity', parseInt(e.target.value))} className="w-24 bg-slate-700 p-2 rounded-md"/><button type="button" onClick={() => removeDynamicReward('resourceRewards', index)} className="px-2 py-1 bg-red-800 rounded">X</button></div>))}<button type="button" onClick={() => addDynamicReward('resourceRewards')} className="mt-2 text-sm text-indigo-400 hover:text-indigo-300">+ Add Resource</button></div>
                {/* Loot Table Rewards */}
                 <div><label className="block text-sm font-medium text-gray-300">{t('admin.lootTable')}</label>{
// FIX: Ensure formData.rewards.lootTable is an array before calling map.
(formData.rewards?.lootTable || []).map((drop, index) => (<div key={index} className="flex items-center gap-2 mt-2"><select value={drop.templateId} onChange={e => handleDynamicRewardChange('lootTable', index, 'templateId', e.target.value)} className="flex-grow bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{allItemTemplates.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select><input type="number" min="1" max="100" value={drop.chance} onChange={e => handleDynamicRewardChange('lootTable', index, 'chance', parseInt(e.target.value))} className="w-24 bg-slate-700 p-2 rounded-md" placeholder="Chance %"/><button type="button" onClick={() => removeDynamicReward('lootTable', index)} className="px-2 py-1 bg-red-800 rounded">X</button></div>))}<button type="button" onClick={() => addDynamicReward('lootTable')} className="mt-2 text-sm text-indigo-400 hover:text-indigo-300">+ Add Drop</button></div>
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">Save</button>
            </div>
        </form>
    );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  locations, onLocationsUpdate, expeditions, onExpeditionsUpdate, enemies, onEnemiesUpdate, 
  itemTemplates, onItemTemplatesUpdate, quests, onQuestsUpdate, settings, onSettingsUpdate, users, 
  onDeleteUser, allCharacters, onDeleteCharacter, onResetCharacterStats, onHealCharacter,
  onForceTraderRefresh, onResetAllPvpCooldowns
}) => {
    const { t } = useTranslation();
    const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('general');
    
    // Editor states
    const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);
    const [isExpeditionEditorOpen, setIsExpeditionEditorOpen] = useState(false);
    const [editingExpedition, setEditingExpedition] = useState<Partial<Expedition> | null>(null);
    const [isEnemyEditorOpen, setIsEnemyEditorOpen] = useState(false);
    const [editingEnemy, setEditingEnemy] = useState<Partial<Enemy> | null>(null);
    const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<ItemTemplate> | null>(null);
    const [isQuestEditorOpen, setIsQuestEditorOpen] = useState(false);
    const [editingQuest, setEditingQuest] = useState<Partial<Quest> | null>(null);
    
    const groupedAndSortedItems = useMemo(() => {
        const rarityOrder: Record<ItemRarity, number> = {
            [ItemRarity.Common]: 0,
            [ItemRarity.Uncommon]: 1,
            [ItemRarity.Rare]: 2,
            [ItemRarity.Epic]: 3,
            [ItemRarity.Legendary]: 4,
        };
    
        const grouped = itemTemplates.reduce((acc, item) => {
            const slotKey = item.slot;
            if (!acc[slotKey]) {
                acc[slotKey] = [];
            }
            acc[slotKey].push(item);
            return acc;
        }, {} as Record<string, ItemTemplate[]>);
    
        for (const slot in grouped) {
            grouped[slot].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
        }
        
        const slotOrder: string[] = [
            EquipmentSlot.Head, EquipmentSlot.Neck, EquipmentSlot.Chest,
            EquipmentSlot.Hands, EquipmentSlot.Waist, EquipmentSlot.Legs,
            EquipmentSlot.Feet, 'ring', EquipmentSlot.MainHand,
            EquipmentSlot.TwoHand, EquipmentSlot.OffHand, 'consumable',
        ];
    
        const orderedGroups: { [key: string]: ItemTemplate[] } = {};
        const processedSlots = new Set<string>();
    
        slotOrder.forEach(slot => {
            if (grouped[slot]) {
                orderedGroups[slot] = grouped[slot];
                processedSlots.add(slot);
            }
        });
    
        Object.keys(grouped).sort().forEach(slot => {
            if (!processedSlots.has(slot)) {
                orderedGroups[slot] = grouped[slot];
            }
        });
    
        return orderedGroups;
    }, [itemTemplates]);


    // Save handlers
    const handleSaveLocation = (loc: Location) => {
        let updated;
        if (editingLocation?.id) {
            updated = locations.map(l => l.id === loc.id ? loc : l);
        } else {
            updated = [...locations, loc];
        }
        if (loc.isStartLocation) {
            updated = updated.map(l => l.id === loc.id ? l : { ...l, isStartLocation: false });
        }
        onLocationsUpdate(updated);
        setIsLocationEditorOpen(false);
        setEditingLocation(null);
    };

    const handleSaveExpedition = (exp: Expedition) => {
        const updated = editingExpedition?.id ? expeditions.map(e => e.id === exp.id ? exp : e) : [...expeditions, exp];
        onExpeditionsUpdate(updated);
        setIsExpeditionEditorOpen(false);
        setEditingExpedition(null);
    };

    const handleSaveEnemy = (enemy: Enemy) => {
        const updated = editingEnemy?.id ? enemies.map(e => e.id === enemy.id ? enemy : e) : [...enemies, enemy];
        onEnemiesUpdate(updated);
        setIsEnemyEditorOpen(false);
        setEditingEnemy(null);
    };
    
    const handleSaveItem = (item: ItemTemplate) => {
        const updated = editingItem?.id ? itemTemplates.map(i => i.id === item.id ? item : i) : [...itemTemplates, item];
        onItemTemplatesUpdate(updated);
        setIsItemEditorOpen(false);
        setEditingItem(null);
    };

    const handleSaveQuest = (quest: Quest) => {
        const updated = editingQuest?.id ? quests.map(q => q.id === quest.id ? quest : q) : [...quests, quest];
        onQuestsUpdate(updated);
        setIsQuestEditorOpen(false);
        setEditingQuest(null);
    };

    // Delete handlers
    const handleDeleteLocation = (id: string) => {
        if (window.confirm('Are you sure?')) {
            onLocationsUpdate(locations.filter(l => l.id !== id));
        }
    };
    const handleDeleteExpedition = (id: string) => {
        if (window.confirm('Are you sure?')) {
            onExpeditionsUpdate(expeditions.filter(e => e.id !== id));
        }
    };
    const handleDeleteEnemy = (id: string) => {
        if (window.confirm('Are you sure?')) {
            onEnemiesUpdate(enemies.filter(e => e.id !== id));
        }
    };
    const handleDeleteItem = (id: string) => {
        if (window.confirm(t('admin.item.deleteConfirm'))) {
            onItemTemplatesUpdate(itemTemplates.filter(i => i.id !== id));
        }
    };
    const handleDeleteQuest = (id: string) => {
        if (window.confirm(t('admin.quest.deleteConfirm'))) {
            onQuestsUpdate(quests.filter(q => q.id !== id));
        }
    };

    const TABS: { id: AdminTab; label: string }[] = [
        { id: 'general', label: t('admin.tabs.general') },
        { id: 'users', label: t('admin.tabs.users') },
        { id: 'locations', label: t('admin.tabs.locations') },
        { id: 'expeditions', label: t('admin.tabs.expeditions') },
        { id: 'enemies', label: t('admin.tabs.enemies') },
        { id: 'items', label: t('admin.tabs.items') },
        { id: 'quests', label: t('admin.tabs.quests') },
        { id: 'pvp', label: t('admin.tabs.pvp') },
    ];
    
    const renderAdminTabContent = () => {
        switch(activeAdminTab) {
            case 'general':
                return <GeneralSettingsPanel settings={settings} onSettingsUpdate={onSettingsUpdate} onForceTraderRefresh={onForceTraderRefresh} />;
            case 'users':
                return <UsersPanel users={users} allCharacters={allCharacters} onDeleteUser={onDeleteUser} onDeleteCharacter={onDeleteCharacter} onResetCharacterStats={onResetCharacterStats} onHealCharacter={onHealCharacter}/>;
            case 'locations':
                return (
                    <div>
                        {isLocationEditorOpen ? (
                            <LocationEditor location={editingLocation!} onSave={handleSaveLocation} onCancel={() => setIsLocationEditorOpen(false)} isEditing={!!editingLocation?.id} allLocations={locations}/>
                        ) : (
                            <>
                                <button onClick={() => {setEditingLocation({}); setIsLocationEditorOpen(true)}} className="mb-4 px-4 py-2 bg-indigo-600 rounded">Add Location</button>
                                <div className="space-y-2">{locations.map(loc => (<div key={loc.id} className="bg-slate-800/50 p-3 rounded flex justify-between items-center"><span>{loc.name}</span><div><button onClick={() => {setEditingLocation(loc); setIsLocationEditorOpen(true)}} className="text-sm bg-slate-700 px-3 py-1 rounded mr-2">Edit</button><button onClick={() => handleDeleteLocation(loc.id)} className="text-sm bg-red-800/60 px-3 py-1 rounded">Delete</button></div></div>))}</div>
                            </>
                        )}
                    </div>
                );
            case 'expeditions':
                return (
                    <div>
                        {isExpeditionEditorOpen ? (
                            <ExpeditionEditor expedition={editingExpedition!} onSave={handleSaveExpedition} onCancel={() => setIsExpeditionEditorOpen(false)} isEditing={!!editingExpedition?.id} allLocations={locations} allEnemies={enemies} allItemTemplates={itemTemplates}/>
                        ) : (
                            <>
                                <button onClick={() => {setEditingExpedition({}); setIsExpeditionEditorOpen(true)}} className="mb-4 px-4 py-2 bg-indigo-600 rounded">Add Expedition</button>
                                <div className="space-y-2">{expeditions.map(exp => (<div key={exp.id} className="bg-slate-800/50 p-3 rounded flex justify-between items-center"><span>{exp.name}</span><div><button onClick={() => {setEditingExpedition(exp); setIsExpeditionEditorOpen(true)}} className="text-sm bg-slate-700 px-3 py-1 rounded mr-2">Edit</button><button onClick={() => handleDeleteExpedition(exp.id)} className="text-sm bg-red-800/60 px-3 py-1 rounded">Delete</button></div></div>))}</div>
                            </>
                        )}
                    </div>
                );
             case 'enemies':
                return (
                    <div>
                        {isEnemyEditorOpen ? (
                            <EnemyEditor enemy={editingEnemy!} onSave={handleSaveEnemy} onCancel={() => setIsEnemyEditorOpen(false)} isEditing={!!editingEnemy?.id} allItemTemplates={itemTemplates} />
                        ) : (
                            <>
                                <button onClick={() => {setEditingEnemy({}); setIsEnemyEditorOpen(true)}} className="mb-4 px-4 py-2 bg-indigo-600 rounded">Add Enemy</button>
                                <div className="space-y-2">{enemies.map(en => (<div key={en.id} className="bg-slate-800/50 p-3 rounded flex justify-between items-center"><span>{en.name}</span><div><button onClick={() => {setEditingEnemy(en); setIsEnemyEditorOpen(true)}} className="text-sm bg-slate-700 px-3 py-1 rounded mr-2">Edit</button><button onClick={() => handleDeleteEnemy(en.id)} className="text-sm bg-red-800/60 px-3 py-1 rounded">Delete</button></div></div>))}</div>
                            </>
                        )}
                    </div>
                );
            case 'items':
                return (
                    <div>
                        {isItemEditorOpen ? (
                            <ItemEditor item={editingItem!} onSave={handleSaveItem} onCancel={() => setIsItemEditorOpen(false)} />
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <button onClick={() => {setEditingItem({}); setIsItemEditorOpen(true)}} className="px-4 py-2 bg-indigo-600 rounded">{t('admin.item.add')}</button>
                                </div>
                                <div className="space-y-8">
                                    {Object.entries(groupedAndSortedItems).map(([slot, items]) => (
                                        <div key={slot}>
                                            <h4 className="text-xl font-semibold text-indigo-300 mb-3 border-b border-slate-700 pb-2">
                                                {t(`item.slot.${slot}`, { defaultValue: slot })}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {items.map(item => (
                                                    <div key={item.id} className="bg-slate-800/50 p-3 rounded flex justify-between items-center relative group hover:z-20">
                                                        <span className={rarityStyles[item.rarity].text}>{item.name}</span>
                                                        <div>
                                                            <button onClick={() => {setEditingItem(item); setIsItemEditorOpen(true)}} className="text-sm bg-slate-700 px-3 py-1 rounded mr-2">{t('admin.edit')}</button>
                                                            <button onClick={() => handleDeleteItem(item.id)} className="text-sm bg-red-800/60 px-3 py-1 rounded">{t('admin.delete')}</button>
                                                        </div>
                                                        <ItemTooltip instance={{uniqueId: `tooltip-admin-${item.id}`, templateId: item.id}} template={item} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                );
            case 'quests':
                return (
                    <div>
                        {isQuestEditorOpen ? (
                             <QuestEditor quest={editingQuest!} onSave={handleSaveQuest} onCancel={() => {setIsQuestEditorOpen(false); setEditingQuest(null);}} allLocations={locations} allEnemies={enemies} allItemTemplates={itemTemplates} />
                        ) : (
                            <>
                                <button onClick={() => {setEditingQuest({}); setIsQuestEditorOpen(true)}} className="mb-4 px-4 py-2 bg-indigo-600 rounded">{t('admin.quest.add')}</button>
                                <div className="space-y-2">{quests.map(q => (<div key={q.id} className="bg-slate-800/50 p-3 rounded flex justify-between items-center"><span>{q.name}</span><div><button onClick={() => {setEditingQuest(q); setIsQuestEditorOpen(true)}} className="text-sm bg-slate-700 px-3 py-1 rounded mr-2">{t('admin.edit')}</button><button onClick={() => handleDeleteQuest(q.id)} className="text-sm bg-red-800/60 px-3 py-1 rounded">{t('admin.delete')}</button></div></div>))}</div>
                            </>
                        )}
                    </div>
                );
            case 'pvp':
                return <PvpSettingsPanel settings={settings} onSettingsUpdate={onSettingsUpdate} onResetAllPvpCooldowns={onResetAllPvpCooldowns} />;
            default:
                return null;
        }
    }
    
    return (
        <ContentPanel title={t('admin.title')}>
            <div className="flex border-b border-slate-700 mb-6 flex-wrap">
                 {TABS.map(tab => (
                     <button key={tab.id} onClick={() => setActiveAdminTab(tab.id)}
                        className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${activeAdminTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                     >{tab.label}</button>
                 ))}
            </div>
            {renderAdminTabContent()}
        </ContentPanel>
    );
};

// Sub-panels for each admin tab
const GeneralSettingsPanel: React.FC<{ settings: GameSettings, onSettingsUpdate: (s: GameSettings) => void, onForceTraderRefresh: () => void }> = ({ settings, onSettingsUpdate, onForceTraderRefresh }) => {
    const { t } = useTranslation();
    const [localSettings, setLocalSettings] = useState(settings);
    
    useEffect(() => setLocalSettings(settings), [settings]);
    
    const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLocalSettings(prev => ({ ...prev, language: e.target.value as Language }));
    };

    const handleTraderRarityChange = (rarity: ItemRarity, value: number) => {
        setLocalSettings(prev => ({
            ...prev,
            traderSettings: {
                ...(prev.traderSettings as object),
                rarityChances: {
                    ...(prev.traderSettings?.rarityChances || { [ItemRarity.Common]: 0, [ItemRarity.Uncommon]: 0, [ItemRarity.Rare]: 0 }),
                    [rarity]: value
                }
            }
        }));
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-lg">
                 <h3 className="text-lg font-semibold text-white mb-4">{t('admin.gameSettings')}</h3>
                 <label className="block mb-2 text-sm font-medium text-gray-300">{t('admin.language')}</label>
                 <select value={localSettings.language} onChange={handleLangChange} className="bg-slate-700 p-2 rounded-md">
                    <option value={Language.EN}>{t('admin.languages.en')}</option>
                    <option value={Language.PL}>{t('admin.languages.pl')}</option>
                 </select>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">{t('admin.traderSettings')}</h3>
                <label className="block mb-2 text-sm font-medium text-gray-300">{t('admin.rarityChances')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('admin.rarityChancesDesc')}</p>
                <div className="flex gap-4">
                    {[ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare].map(rarity => (
                         <div key={rarity}><label className={`block text-sm mb-1 ${rarityStyles[rarity].text}`}>{rarity}</label><input type="number" min="0" max="100" value={localSettings.traderSettings?.rarityChances?.[rarity] || ''} onChange={e => handleTraderRarityChange(rarity, parseInt(e.target.value) || 0)} className="w-24 bg-slate-700 p-2 rounded-md"/></div>
                    ))}
                </div>
            </div>
             <div className="bg-slate-800/50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">{t('admin.traderActions')}</h3>
                <button onClick={onForceTraderRefresh} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded text-white">{t('admin.forceTraderRefresh')}</button>
            </div>
            <button onClick={() => onSettingsUpdate(localSettings)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg">{t('admin.saveSettings')}</button>
        </div>
    );
};

const UsersPanel: React.FC<{ users: User[], allCharacters: AdminCharacterInfo[], onDeleteUser: (id: number) => void, onDeleteCharacter: (id: number) => void, onResetCharacterStats: (id: number) => void, onHealCharacter: (id: number) => void }> = (props) => {
    const { t } = useTranslation();
    const charactersByUserId = useMemo(() => {
        return props.allCharacters.reduce((acc, char) => {
            acc[char.user_id] = char;
            return acc;
        }, {} as Record<number, AdminCharacterInfo>);
    }, [props.allCharacters]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-white mb-2">{t('admin.managePlayers')}</h3>
                <div className="space-y-2">{props.users.map(user => (<div key={user.id} className="bg-slate-800/50 p-3 rounded flex justify-between items-center"><span>{user.username}</span><button onClick={() => props.onDeleteUser(user.id)} className="text-sm bg-red-800/60 px-3 py-1 rounded">{t('admin.deletePlayer')}</button></div>))}</div>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-2">{t('admin.manageCharacters')}</h3>
                <div className="space-y-2">{props.allCharacters.map(char => (<div key={char.user_id} className="bg-slate-800/50 p-3 rounded">
                    <div className="flex justify-between items-center">
                        <div><p className="font-semibold">{char.name} <span className="text-sm text-gray-400">({t(`race.${char.race}`)}, Lvl {char.level})</span></p><p className="text-xs text-gray-500">{t('admin.owner')}: {char.username}</p></div>
                        <div className="flex gap-2">
                            <button onClick={() => props.onHealCharacter(char.user_id)} className="text-sm bg-green-700/80 px-3 py-1 rounded">{t('admin.heal')}</button>
                            <button onClick={() => props.onResetCharacterStats(char.user_id)} className="text-sm bg-amber-700/80 px-3 py-1 rounded">{t('admin.resetStats')}</button>
                            <button onClick={() => props.onDeleteCharacter(char.user_id)} className="text-sm bg-red-800/60 px-3 py-1 rounded">{t('admin.deleteCharacter')}</button>
                        </div>
                    </div>
                </div>))}</div>
            </div>
        </div>
    );
};

const PvpSettingsPanel: React.FC<{ settings: GameSettings, onSettingsUpdate: (s: GameSettings) => void, onResetAllPvpCooldowns: () => void }> = ({ settings, onSettingsUpdate, onResetAllPvpCooldowns }) => {
    const { t } = useTranslation();
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => setLocalSettings(settings), [settings]);
    
    const handlePvpSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalSettings(prev => ({...prev, [name]: parseInt(value) || 0 }));
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">{t('admin.pvp.title')}</h3>
                <label className="block text-sm font-medium text-gray-300">{t('admin.pvp.protectionDuration')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('admin.pvp.protectionDurationDesc')}</p>
                <input type="number" name="pvpProtectionMinutes" value={localSettings.pvpProtectionMinutes || 60} onChange={handlePvpSettingChange} className="w-48 bg-slate-700 p-2 rounded-md" />
                 <div className="mt-6">
                    <button onClick={() => onSettingsUpdate(localSettings)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg">{t('admin.saveSettings')}</button>
                </div>
            </div>
             <div className="bg-slate-800/50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">{t('admin.pvp.actions')}</h3>
                <button onClick={onResetAllPvpCooldowns} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded text-white">{t('admin.pvp.resetCooldowns')}</button>
            </div>
        </div>
    );
};