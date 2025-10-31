import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { Location, Tab, Expedition, Enemy, GameSettings, Language, User, AdminCharacterInfo, ItemTemplate, EquipmentSlot, ItemRarity, CharacterStats, LootDrop, TraderSettings, EssenceType, ResourceDrop, MagicAttackType, Quest, QuestType, ItemReward, ResourceReward, GameData, Affix, AffixType, ItemCategory, GrammaticalGender } from '../types';
import { SwordsIcon } from './icons/SwordsIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { rarityStyles, ItemTooltip } from './shared/ItemSlot';
import { SettingsIcon } from './icons/SettingsIcon';

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
  onForceTraderRefresh: () => void;
  onResetAllPvpCooldowns: () => void;
  onSendGlobalMessage: (data: { subject: string; content: string }) => Promise<void>;
}

type AdminTab = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'items' | 'affixes' | 'quests' | 'pvp';


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
      isStartLocation: formData.isStartLocation || false
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

        <div className="flex justify-end space-x-4 pt-6 border-t border-slate-700 mt-6">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
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
            alert(t('admin.enemy.nameRequired')); return;
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
             <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? t('admin.enemy.edit') : t('admin.enemy.create')}</h3>
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.general.name')}</label>
                <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.general.description')}</label>
                <textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/>
             </div>

             <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('statistics.title')}</h4>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('statistics.health')}</label>
                    <input type="number" name="maxHealth" value={formData.stats?.maxHealth ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('item.damageMin')}</label>
                    <input type="number" name="minDamage" value={formData.stats?.minDamage ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('item.damageMax')}</label>
                    <input type="number" name="maxDamage" value={formData.stats?.maxDamage ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('statistics.armor')}</label>
                    <input type="number" name="armor" value={formData.stats?.armor ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('statistics.critChance')} (%)</label>
                    <input type="number" name="critChance" value={formData.stats?.critChance ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('statistics.agility')}</label>
                    <input type="number" name="agility" value={formData.stats?.agility ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('statistics.attacksPerTurn')}</label>
                    <input type="number" name="attacksPerTurn" value={formData.stats?.attacksPerTurn ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/>
                 </div>
             </div>
             
             <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('admin.enemy.magicProperties')}</h4>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.maxMana')}</label><input type="number" name="maxMana" value={formData.stats?.maxMana ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.manaRegen')}</label><input type="number" name="manaRegen" value={formData.stats?.manaRegen ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicDamageMin')}</label><input type="number" name="magicDamageMin" value={formData.stats?.magicDamageMin ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicDamageMax')}</label><input type="number" name="magicDamageMax" value={formData.stats?.magicDamageMax ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicAttackChance')}</label><input type="number" name="magicAttackChance" value={formData.stats?.magicAttackChance ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicAttackManaCost')}</label><input type="number" name="magicAttackManaCost" value={formData.stats?.magicAttackManaCost ?? ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.enemy.magicAttackType')}</label><select name="magicAttackType" value={formData.stats?.magicAttackType || ''} onChange={(e) => handleNestedChange('stats', e)} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.general.none')}</option>{magicAttackTypes.map(type => <option key={type} value={type}>{t(`item.magic.${type}`)}</option>)}</select></div>
             </div>
             
             <h4 className="font-semibold text-gray-300 border-t border-slate-700 pt-4 mt-4">{t('quests.rewards')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.min')} {t('resources.gold')}</label><input type="number" name="minGold" value={formData.rewards?.minGold ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                 <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.max')} {t('resources.gold')}</label><input type="number" name="maxGold" value={formData.rewards?.maxGold ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                 <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.min')} {t('expedition.experience')}</label><input type="number" name="minExperience" value={formData.rewards?.minExperience ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                 <div><label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.max')} {t('expedition.experience')}</label><input type="number" name="maxExperience" value={formData.rewards?.maxExperience ?? ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.lootTable')}</label>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2 bg-slate-800/30 rounded-md">
                    {allItemTemplates.map(item => {
                        const currentLoot = formData.lootTable?.find(l => l.templateId === item.id);
                        return <div key={item.id} className="relative group hover:z-20"><label htmlFor={`loot-${item.id}`} className={`text-xs ${rarityStyles[item.rarity].text}`}>{item.name}</label><input type="number" id={`loot-${item.id}`} min="0" max="100" value={currentLoot?.chance || ''} onChange={(e) => handleLootChanceChange(item.id, parseInt(e.target.value, 10) || 0)} className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/><ItemTooltip instance={{ uniqueId: `tooltip-enemy-${item.id}`, templateId: item.id }} template={item} affixes={[]}/></div>;
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

            <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700 mt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button>
            </div>
        </form>
    )
};

const ItemTemplateManager: React.FC<{
    itemTemplates: ItemTemplate[];
    onSave: (item: ItemTemplate) => void;
    onDelete: (id: string) => void;
}> = ({ itemTemplates, onSave, onDelete }) => {
    const { t } = useTranslation();
    const [editingItem, setEditingItem] = useState<Partial<ItemTemplate> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [slotFilter, setSlotFilter] = useState<string>('all');
    const [rarityFilter, setRarityFilter] = useState<string>('all');

    const filteredItems = useMemo(() => {
        return itemTemplates.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const slotMatch = slotFilter === 'all' || item.slot === slotFilter;
            const rarityMatch = rarityFilter === 'all' || item.rarity === rarityFilter;
            return nameMatch && slotMatch && rarityMatch;
        });
    }, [itemTemplates, searchTerm, slotFilter, rarityFilter]);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-indigo-400">{t('admin.manageItems')}</h3>
                <button onClick={() => setEditingItem({})} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.item.add')}</button>
            </div>

            <div className="flex gap-4 mb-4">
                <input type="text" placeholder={t('admin.general.searchByName') || "Szukaj po nazwie..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2" />
                <select value={slotFilter} onChange={e => setSlotFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2">
                    <option value="all">{t('admin.item.allSlots')}</option>
                    {Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{s}</option>)}
                     <option value="ring">ring</option>
                </select>
                <select value={rarityFilter} onChange={e => setRarityFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2">
                    <option value="all">{t('admin.item.allRarities')}</option>
                    {Object.values(ItemRarity).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            <div className="max-h-96 overflow-y-auto">
                {filteredItems.map(template => (
                    <div key={template.id} className="bg-slate-800/50 p-2 rounded-md mb-2 flex justify-between items-center">
                        <span className={rarityStyles[template.rarity].text}>{template.name} ({template.slot}, Lvl {template.requiredLevel})</span>
                        <div>
                            <button onClick={() => setEditingItem(template)} className="px-3 py-1 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm mr-2">{t('admin.edit')}</button>
                            <button onClick={() => {
                                if (window.confirm(t('admin.item.deleteConfirm'))) {
                                    onDelete(template.id);
                                }
                            }} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.delete')}</button>
                        </div>
                    </div>
                ))}
            </div>

            {editingItem && (
                <ItemTemplateEditor
                    itemTemplate={editingItem}
                    onSave={(item) => { onSave(item); setEditingItem(null); }}
                    onCancel={() => setEditingItem(null)}
                    isEditing={!!editingItem.id}
                />
            )}
        </div>
    );
};

const ItemTemplateEditor: React.FC<{
    itemTemplate: Partial<ItemTemplate>;
    onSave: (item: ItemTemplate) => void;
    onCancel: () => void;
    isEditing: boolean;
}> = ({ itemTemplate, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<ItemTemplate>>({
        statsBonus: {},
        requiredStats: {},
        ...itemTemplate
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    
    const handleNestedChange = (category: 'statsBonus' | 'requiredStats', e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [category]: { ...prev[category], [name]: parseInt(value) || 0 }}));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!formData.name || !formData.slot || !formData.rarity) {
            alert(t('admin.item.validationError')); return;
        }

        const finalItem: ItemTemplate = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name,
            gender: formData.gender || GrammaticalGender.Masculine,
            description: formData.description || '',
            slot: formData.slot,
            category: formData.category || ItemCategory.Armor,
            rarity: formData.rarity,
            icon: formData.icon || '',
            value: Number(formData.value) || 0,
            requiredLevel: Number(formData.requiredLevel) || 1,
            requiredStats: formData.requiredStats || {},
            statsBonus: formData.statsBonus || {},
            damageMin: formData.slot === 'mainHand' || formData.slot === 'offHand' || formData.slot === 'twoHand' ? Number(formData.damageMin) || 0 : undefined,
            damageMax: formData.slot === 'mainHand' || formData.slot === 'offHand' || formData.slot === 'twoHand' ? Number(formData.damageMax) || 0 : undefined,
            attacksPerRound: formData.slot === 'mainHand' || formData.slot === 'twoHand' ? Number(formData.attacksPerRound) || 1 : undefined,
            armorBonus: Number(formData.armorBonus) || undefined,
            critChanceBonus: Number(formData.critChanceBonus) || undefined,
            maxHealthBonus: Number(formData.maxHealthBonus) || undefined,
            critDamageModifierBonus: Number(formData.critDamageModifierBonus) || undefined,
            armorPenetrationPercent: Number(formData.armorPenetrationPercent) || undefined,
            armorPenetrationFlat: Number(formData.armorPenetrationFlat) || undefined,
            lifeStealPercent: Number(formData.lifeStealPercent) || undefined,
            lifeStealFlat: Number(formData.lifeStealFlat) || undefined,
            manaStealPercent: Number(formData.manaStealPercent) || undefined,
            manaStealFlat: Number(formData.manaStealFlat) || undefined,
            isMagical: formData.isMagical || false,
            magicAttackType: formData.isMagical ? formData.magicAttackType : undefined,
            manaCost: formData.isMagical ? Number(formData.manaCost) || 0 : undefined,
            magicDamageMin: formData.isMagical ? Number(formData.magicDamageMin) || 0 : undefined,
            magicDamageMax: formData.isMagical ? Number(formData.magicDamageMax) || 0 : undefined,
        };
        onSave(finalItem);
    }
    
    const statKeys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
            <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? t('admin.item.edit') : t('admin.item.create')}</h3>
            
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium">{t('item.name')}</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium">{t('admin.item.iconPath')}</label><input type="text" name="icon" value={formData.icon || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
            </div>
            <div><label className="block text-sm font-medium">{t('item.description')}</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium">{t('item.slotLabel')}</label><select name="slot" value={formData.slot || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{s}</option>)}<option value="ring">ring</option></select></div>
                <div><label className="block text-sm font-medium">{t('item.category')}</label><select name="category" value={formData.category || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(ItemCategory).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-sm font-medium">{t('item.rarity')}</label><select name="rarity" value={formData.rarity || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(ItemRarity).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><label className="block text-sm font-medium">{t('admin.item.grammaticalGender')}</label><select name="gender" value={formData.gender || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(GrammaticalGender).map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                <div><label className="block text-sm font-medium">{t('item.value')}</label><input type="number" name="value" value={formData.value || 0} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm font-medium">{t('item.levelRequirement')}</label><input type="number" name="requiredLevel" value={formData.requiredLevel || 1} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
            </div>

            <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('item.weaponStats')}</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-sm">{t('item.damageMin')}</label><input type="number" name="damageMin" value={formData.damageMin || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.damageMax')}</label><input type="number" name="damageMax" value={formData.damageMax || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.attacksPerRound')}</label><input type="number" step="0.1" name="attacksPerRound" value={formData.attacksPerRound || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                </div>
            </div>
            
             <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center mb-4"><input type="checkbox" name="isMagical" checked={formData.isMagical || false} onChange={handleInputChange} className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500 mr-2"/><label className="font-semibold text-gray-300">{t('item.isMagical')}</label></div>
                {formData.isMagical && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                        <div><label className="block text-sm">{t('item.magicAttackType')}</label><select name="magicAttackType" value={formData.magicAttackType || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.general.none')}</option>{Object.values(MagicAttackType).map(type => <option key={type} value={type}>{t(`item.magic.${type}`)}</option>)}</select></div>
                        <div><label className="block text-sm">{t('item.manaCost')}</label><input type="number" name="manaCost" value={formData.manaCost || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                        <div><label className="block text-sm">{t('item.magicDamageMin')}</label><input type="number" name="magicDamageMin" value={formData.magicDamageMin || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                        <div><label className="block text-sm">{t('item.magicDamageMax')}</label><input type="number" name="magicDamageMax" value={formData.magicDamageMax || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    </div>
                )}
            </div>

            <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('item.statBonuses')}</h4><div className="grid grid-cols-3 md:grid-cols-6 gap-2">{statKeys.map(key => <div key={key}><label className="block text-xs">{t(`statistics.${key}`)}</label><input type="number" name={key} value={(formData.statsBonus as any)?.[key] || ''} onChange={(e) => handleNestedChange('statsBonus', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>)}</div></div>
            <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('item.requiredStats')}</h4><div className="grid grid-cols-3 md:grid-cols-6 gap-2">{statKeys.map(key => <div key={key}><label className="block text-xs">{t(`statistics.${key}`)}</label><input type="number" name={key} value={(formData.requiredStats as any)?.[key] || ''} onChange={(e) => handleNestedChange('requiredStats', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>)}</div></div>

            <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('item.secondaryBonuses')}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm">{t('item.armorBonus')}</label><input type="number" name="armorBonus" value={formData.armorBonus || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.critChanceBonus')}</label><input type="number" step="0.1" name="critChanceBonus" value={formData.critChanceBonus || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.maxHealthBonus')}</label><input type="number" name="maxHealthBonus" value={formData.maxHealthBonus || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.critDamageModifierBonus')}</label><input type="number" name="critDamageModifierBonus" value={formData.critDamageModifierBonus || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.armorPenetrationPercent')}</label><input type="number" name="armorPenetrationPercent" value={formData.armorPenetrationPercent || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.armorPenetrationFlat')}</label><input type="number" name="armorPenetrationFlat" value={formData.armorPenetrationFlat || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.lifeStealPercent')}</label><input type="number" name="lifeStealPercent" value={formData.lifeStealPercent || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.lifeStealFlat')}</label><input type="number" name="lifeStealFlat" value={formData.lifeStealFlat || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.manaStealPercent')}</label><input type="number" name="manaStealPercent" value={formData.manaStealPercent || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('item.manaStealFlat')}</label><input type="number" name="manaStealFlat" value={formData.manaStealFlat || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button><button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button></div>
        </form>
    );
};

const AffixManager: React.FC<{
    affixes: Affix[];
    onSave: (affix: Affix) => void;
    onDelete: (id: string) => void;
}> = ({ affixes, onSave, onDelete }) => {
    const { t } = useTranslation();
    const [editingAffix, setEditingAffix] = useState<Partial<Affix> | null>(null);
    const [filterType, setFilterType] = useState<AffixType | 'all'>('all');

    const secondaryStatLabels: Record<string, string> = {
        damageMin: t('item.damageMin'),
        damageMax: t('item.damageMax'),
        attacksPerRoundBonus: t('item.attacksPerRoundBonus'),
        dodgeChanceBonus: t('item.dodgeChanceBonus'),
        armorBonus: t('item.armorBonus'),
        critChanceBonus: t('item.critChanceBonus'),
        maxHealthBonus: t('item.maxHealthBonus'),
        critDamageModifierBonus: t('item.critDamageModifierBonus'),
        armorPenetrationPercent: t('item.armorPenetrationPercent'),
        armorPenetrationFlat: t('item.armorPenetrationFlat'),
        lifeStealPercent: t('item.lifeStealPercent'),
        lifeStealFlat: t('item.lifeStealFlat'),
        manaStealPercent: t('item.manaStealPercent'),
        manaStealFlat: t('item.manaStealFlat'),
        magicDamageMin: t('item.magicDamageMin'),
        magicDamageMax: t('item.magicDamageMax')
    };

    const renderAffixBonuses = (affix: Affix) => {
        const bonuses: React.ReactNode[] = [];
        const formatRange = (range: { min: number; max: number } | undefined) => {
            if (!range || (range.min === 0 && range.max === 0)) return null;
            if (range.min === range.max) return `${range.min}`;
            return `${range.min}-${range.max}`;
        };

        if (affix.statsBonus) {
            Object.entries(affix.statsBonus).forEach(([key, range]) => {
                const formattedRange = formatRange(range);
                if (formattedRange) {
                    bonuses.push(<li key={key}>+{formattedRange} {t(`statistics.${key}`)}</li>);
                }
            });
        }

        const secondaryStatKeys = Object.keys(secondaryStatLabels) as (keyof typeof secondaryStatLabels)[];
        for (const key of secondaryStatKeys) {
            const formattedRange = formatRange((affix as any)[key]);
            if (formattedRange) {
                let label = secondaryStatLabels[key];
                if (key.includes('Percent')) label = label.replace('(%)','').trim() + ' %';
                bonuses.push(<li key={key}>+{formattedRange} {label}</li>);
            }
        }

        if (bonuses.length === 0) {
            return <p className="italic">Brak bonusów</p>;
        }
        return <ul className="space-y-0.5">{bonuses}</ul>;
    };

    const renderSpawnChances = (affix: Affix) => {
        const chances = Object.entries(affix.spawnChances || {}).filter(([, chance]) => chance > 0);
        if (chances.length === 0) {
            return <p className="italic">Brak zasad pojawiania się</p>;
        }
        return (
            <ul className="space-y-0.5">
                {chances.map(([category, chance]) => (
                    <li key={category}>{t(`admin.affix.${category.toLowerCase()}` as any)}: <span className="font-semibold">{chance}%</span></li>
                ))}
            </ul>
        );
    };

    const filteredAffixes = useMemo(() => {
        if (filterType === 'all') return affixes;
        return affixes.filter(a => a.type === filterType);
    }, [affixes, filterType]);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-indigo-400">{t('admin.affix.manage')}</h3>
                <div className="flex gap-2">
                    <button onClick={() => setEditingAffix({ type: AffixType.Prefix })} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 text-white font-semibold">{t('admin.affix.addPrefix')}</button>
                    <button onClick={() => setEditingAffix({ type: AffixType.Suffix })} className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white font-semibold">{t('admin.affix.addSuffix')}</button>
                </div>
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 mb-4">
                <option value="all">{t('admin.affix.allTypes')}</option>
                <option value={AffixType.Prefix}>{t('admin.affix.prefixes')}</option>
                <option value={AffixType.Suffix}>{t('admin.affix.suffixes')}</option>
            </select>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                {filteredAffixes.map(affix => (
                    <div key={affix.id} className={`bg-slate-800/50 p-4 rounded-md mb-2 flex flex-col border-l-4 ${affix.type === AffixType.Prefix ? 'border-sky-500' : 'border-amber-500'}`}>
                        <div className="flex justify-between items-center w-full mb-2">
                            <span className="font-bold text-lg text-white">{(affix.name as any).masculine || affix.name}</span>
                            <div>
                                <button onClick={() => setEditingAffix(affix)} className="px-3 py-1 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm mr-2">{t('admin.edit')}</button>
                                <button onClick={() => { if (window.confirm(t('admin.affix.deleteConfirm'))) { onDelete(affix.id); } }} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.delete')}</button>
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-slate-700/50 text-xs text-gray-400">
                            <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Bonusy</h5>
                                {renderAffixBonuses(affix)}
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Szansa na pojawienie się</h5>
                                {renderSpawnChances(affix)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {editingAffix && (
                <AffixEditor
                    affix={editingAffix}
                    onSave={(affix) => { onSave(affix); setEditingAffix(null); }}
                    onCancel={() => setEditingAffix(null)}
                    isEditing={!!editingAffix.id}
                />
            )}
        </div>
    );
};

const AffixEditor: React.FC<{
    affix: Partial<Affix>;
    onSave: (affix: Affix) => void;
    onCancel: () => void;
    isEditing: boolean;
}> = ({ affix, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Affix>>(affix);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // FIX: Ensure all properties of the `name` object are present to satisfy the type.
        setFormData(prev => ({
            ...prev,
            name: {
                masculine: prev.name?.masculine || '',
                feminine: prev.name?.feminine || '',
                neuter: prev.name?.neuter || '',
                ...(typeof prev.name === 'object' && prev.name !== null ? prev.name : {}),
                [name]: value
            }
        }));
    };

    const handleStatRangeChange = (stat: string, minOrMax: 'min' | 'max', value: string) => {
        setFormData(prev => {
            const currentStat = (prev as any)[stat] || { min: 0, max: 0 };
            return {
                ...prev,
                [stat]: { ...currentStat, [minOrMax]: parseFloat(value) || 0 }
            }
        });
    };
    
    const handlePrimaryStatRangeChange = (stat: keyof CharacterStats, minOrMax: 'min' | 'max', value: string) => {
        setFormData(prev => {
            const currentBonuses = prev.statsBonus || {};
            const currentStat = (currentBonuses as any)[stat] || { min: 0, max: 0 };
            return {
                ...prev,
                statsBonus: {
                    ...currentBonuses,
                    [stat]: { ...currentStat, [minOrMax]: parseFloat(value) || 0 }
                }
            }
        });
    };

    const handleSpawnChanceChange = (category: ItemCategory, value: string) => {
        setFormData(prev => ({
            ...prev,
            spawnChances: {
                ...prev.spawnChances,
                [category]: parseFloat(value) || 0
            }
        }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const nameData = formData.name;
        if (!nameData || typeof nameData !== 'object' || !nameData.masculine) {
            alert(t('admin.affix.nameRequired'));
            return;
        }

        const finalAffix: Affix = {
            id: formData.id || crypto.randomUUID(),
            name: {
                masculine: nameData.masculine,
                feminine: nameData.feminine || nameData.masculine,
                neuter: nameData.neuter || nameData.masculine,
            },
            type: formData.type!,
            value: formData.value || 0,
            spawnChances: formData.spawnChances || {},
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
        };
        onSave(finalAffix);
    };

    const primaryStatKeys: (keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>)[] = [
        'strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'
    ];

    const secondaryStatKeys: (keyof Omit<Affix, 'id'|'name'|'type'|'requiredLevel'|'requiredStats'|'spawnChances'|'value'|'statsBonus'>)[] = [
        'damageMin', 'damageMax', 'attacksPerRoundBonus', 'dodgeChanceBonus', 'armorBonus',
        'critChanceBonus', 'maxHealthBonus', 'critDamageModifierBonus', 'armorPenetrationPercent',
        'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent',
        'manaStealFlat', 'magicDamageMin', 'magicDamageMax'
    ];
    
    const secondaryStatLabels: Record<string, string> = {
        damageMin: t('item.damageMin'),
        damageMax: t('item.damageMax'),
        attacksPerRoundBonus: t('item.attacksPerRoundBonus'),
        dodgeChanceBonus: t('item.dodgeChanceBonus'),
        armorBonus: t('item.armorBonus'),
        critChanceBonus: t('item.critChanceBonus'),
        maxHealthBonus: t('item.maxHealthBonus'),
        critDamageModifierBonus: t('item.critDamageModifierBonus'),
        armorPenetrationPercent: t('item.armorPenetrationPercent'),
        armorPenetrationFlat: t('item.armorPenetrationFlat'),
        lifeStealPercent: t('item.lifeStealPercent'),
        lifeStealFlat: t('item.lifeStealFlat'),
        manaStealPercent: t('item.manaStealPercent'),
        manaStealFlat: t('item.manaStealFlat'),
        magicDamageMin: t('item.magicDamageMin'),
        magicDamageMax: t('item.magicDamageMax')
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
            <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? t('admin.affix.edit') : t('admin.affix.create')}</h3>
            <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-sm">{t('admin.affix.nameMasculine')}</label><input type="text" name="masculine" value={(formData.name as any)?.masculine || ''} onChange={handleNameChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm">{t('admin.affix.nameFeminine')}</label><input type="text" name="feminine" value={(formData.name as any)?.feminine || ''} onChange={handleNameChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                <div><label className="block text-sm">{t('admin.affix.nameNeuter')}</label><input type="text" name="neuter" value={(formData.name as any)?.neuter || ''} onChange={handleNameChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
            </div>
            <div><label className="block text-sm font-medium">{t('item.value')}</label><input type="number" name="value" value={formData.value || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
            
            <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('admin.affix.spawnChances')}</h4>
                <div className="grid grid-cols-3 gap-4">
                    {Object.values(ItemCategory).map(cat => (
                        <div key={cat}><label className="block text-sm">{t(`admin.affix.${cat.toLowerCase()}` as any)}</label><input type="number" value={formData.spawnChances?.[cat] || ''} onChange={e => handleSpawnChanceChange(cat, e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    ))}
                </div>
            </div>
            
             <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('admin.affix.primaryBonuses')}</h4>
                {primaryStatKeys.map(key => (
                    <div key={key} className="grid grid-cols-3 gap-2 items-center mb-1">
                        <label className="text-sm col-span-1">{t(`statistics.${key}`)}</label>
                        <input type="number" placeholder={t('admin.min') || 'Min'} value={(formData.statsBonus as any)?.[key]?.min || ''} onChange={e => handlePrimaryStatRangeChange(key, 'min', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-center"/>
                        <input type="number" placeholder={t('admin.max') || 'Max'} value={(formData.statsBonus as any)?.[key]?.max || ''} onChange={e => handlePrimaryStatRangeChange(key, 'max', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-center"/>
                    </div>
                ))}
            </div>

            <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('admin.affix.secondaryBonuses')}</h4>
                {secondaryStatKeys.map(key => (
                    <div key={key} className="grid grid-cols-3 gap-2 items-center mb-1">
                        <label className="text-sm col-span-1">{secondaryStatLabels[key]}</label>
                        <input type="number" placeholder={t('admin.min') || 'Min'} value={(formData as any)?.[key]?.min || ''} onChange={e => handleStatRangeChange(key, 'min', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-center"/>
                        <input type="number" placeholder={t('admin.max') || 'Max'} value={(formData as any)?.[key]?.max || ''} onChange={e => handleStatRangeChange(key, 'max', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-center"/>
                    </div>
                ))}
            </div>

            <div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button><button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button></div>
        </form>
    )
};

const QuestManager: React.FC<{
    quests: Quest[];
    onSave: (quest: Quest) => void;
    onDelete: (id: string) => void;
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    locations: Location[];
}> = ({ quests, onSave, onDelete, enemies, itemTemplates, locations }) => {
    const { t } = useTranslation();
    const [editingQuest, setEditingQuest] = useState<Partial<Quest> | null>(null);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-indigo-400">{t('admin.quest.manage')}</h3>
                <button onClick={() => setEditingQuest({})} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.quest.add')}</button>
            </div>
             <div className="max-h-96 overflow-y-auto">
                {quests.map(quest => (
                    <div key={quest.id} className="bg-slate-800/50 p-2 rounded-md mb-2 flex justify-between items-center">
                        <span>{quest.name}</span>
                        <div>
                            <button onClick={() => setEditingQuest(quest)} className="px-3 py-1 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm mr-2">{t('admin.edit')}</button>
                            <button onClick={() => { if (window.confirm(t('admin.quest.deleteConfirm'))) { onDelete(quest.id); } }} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.delete')}</button>
                        </div>
                    </div>
                ))}
            </div>
            {editingQuest && (
                <QuestEditor
                    quest={editingQuest}
                    onSave={(q) => { onSave(q); setEditingQuest(null); }}
                    onCancel={() => setEditingQuest(null)}
                    isEditing={!!editingQuest.id}
                    enemies={enemies}
                    itemTemplates={itemTemplates}
                    locations={locations}
                />
            )}
        </div>
    );
};

const QuestEditor: React.FC<{
    quest: Partial<Quest>;
    onSave: (quest: Quest) => void;
    onCancel: () => void;
    isEditing: boolean;
    enemies: Enemy[];
    itemTemplates: ItemTemplate[];
    locations: Location[];
}> = ({ quest, onSave, onCancel, isEditing, enemies, itemTemplates, locations }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Quest>>(quest);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNestedChange = (category: 'objective' | 'rewards', e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [category]: { ...prev[category], [name]: value }}));
    };
    
    const handleLocationToggle = (locationId: string) => {
        const currentIds = formData.locationIds || [];
        if (currentIds.includes(locationId)) {
            setFormData(prev => ({ ...prev, locationIds: currentIds.filter(id => id !== locationId) }));
        } else {
            setFormData(prev => ({ ...prev, locationIds: [...currentIds, locationId] }));
        }
    };
    
    const handleItemRewardChange = (index: number, field: keyof ItemReward, value: string | number) => {
        const rewards = [...(formData.rewards?.itemRewards || [])];
        rewards[index] = { ...rewards[index], [field]: value };
        setFormData(prev => ({ ...prev, rewards: { ...prev.rewards, itemRewards: rewards } as Quest['rewards'] }));
    };

    const handleResourceRewardChange = (index: number, field: keyof ResourceReward, value: string | number) => {
        const rewards = [...(formData.rewards?.resourceRewards || [])];
        rewards[index] = { ...rewards[index], [field]: value };
        setFormData(prev => ({ ...prev, rewards: { ...prev.rewards, resourceRewards: rewards } as Quest['rewards'] }));
    };

    const handleLootTableChange = (index: number, field: keyof LootDrop, value: string | number) => {
        const lootTable = [...(formData.rewards?.lootTable || [])];
        lootTable[index] = { ...lootTable[index], [field]: value };
        setFormData(prev => ({ ...prev, rewards: { ...prev.rewards, lootTable: lootTable } as Quest['rewards'] }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation
        if (!formData.name || !formData.objective?.type) {
            alert(t('admin.quest.validationError'));
            return;
        }

        const finalQuest: Quest = {
            id: formData.id || crypto.randomUUID(),
            name: formData.name,
            description: formData.description || '',
            locationIds: formData.locationIds || [],
            objective: {
                type: formData.objective.type,
                targetId: formData.objective.targetId || undefined,
                amount: Number(formData.objective.amount) || 1,
            },
            rewards: {
                gold: Number(formData.rewards?.gold) || 0,
                experience: Number(formData.rewards?.experience) || 0,
                itemRewards: formData.rewards?.itemRewards?.filter(r => r.templateId && r.quantity > 0).map(r => ({...r, quantity: Number(r.quantity)})) || [],
                resourceRewards: formData.rewards?.resourceRewards?.filter(r => r.resource && r.quantity > 0).map(r => ({...r, quantity: Number(r.quantity)})) || [],
                lootTable: formData.rewards?.lootTable?.filter(l => l.templateId && l.chance > 0).map(l => ({...l, chance: Number(l.chance)})) || [],
            },
            repeatable: Number(formData.repeatable) ?? 1,
        };
        onSave(finalQuest);
    };

    const objectiveType = formData.objective?.type;
    const targetOptions = 
        objectiveType === QuestType.Kill ? enemies :
        objectiveType === QuestType.Gather ? itemTemplates :
        [];

    return (
         <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
            <h3 className="text-xl font-bold text-indigo-400 mb-2">{isEditing ? t('admin.quest.edit') : t('admin.quest.create')}</h3>
            <div><label className="block text-sm font-medium">{t('admin.quest.name')}</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
            <div><label className="block text-sm font-medium">{t('item.description')}</label><textarea name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md"/></div>
            <div><label className="block text-sm font-medium">{t('admin.quest.repeatable')}</label><input type="number" name="repeatable" value={formData.repeatable ?? 1} onChange={handleInputChange} className="w-full bg-slate-700 p-2 rounded-md" title={t('admin.quest.repeatableDesc')}/></div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.expedition.availableIn')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {locations.map(loc => (
                        <label key={loc.id} className="flex items-center space-x-2"><input type="checkbox" checked={formData.locationIds?.includes(loc.id) || false} onChange={() => handleLocationToggle(loc.id)} className="form-checkbox h-5 w-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/><span>{loc.name}</span></label>
                    ))}
                </div>
            </div>

            <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('admin.quest.objective')}</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-sm">{t('admin.quest.objectiveType')}</label><select name="type" value={formData.objective?.type || ''} onChange={(e) => handleNestedChange('objective', e)} className="w-full bg-slate-700 p-2 rounded-md"><option value="">{t('admin.select')}</option>{Object.values(QuestType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="block text-sm">{t('admin.quest.target')}</label>
                        <select name="targetId" value={formData.objective?.targetId || ''} onChange={(e) => handleNestedChange('objective', e)} className="w-full bg-slate-700 p-2 rounded-md" disabled={objectiveType === QuestType.PayGold}>
                            <option value="">{t('admin.select')}</option>
                            {objectiveType === QuestType.GatherResource 
                                ? Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)
                                : targetOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)
                            }
                        </select>
                    </div>
                    <div><label className="block text-sm">{t('admin.quest.amount')}</label><input type="number" name="amount" value={formData.objective?.amount || ''} onChange={(e) => handleNestedChange('objective', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                </div>
            </div>
            
             <div className="border-t border-slate-700 pt-4"><h4 className="font-semibold text-gray-300 mb-2">{t('admin.quest.rewards')}</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm">{t('resources.gold')}</label><input type="number" name="gold" value={formData.rewards?.gold || ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                    <div><label className="block text-sm">{t('expedition.experience')}</label><input type="number" name="experience" value={formData.rewards?.experience || ''} onChange={(e) => handleNestedChange('rewards', e)} className="w-full bg-slate-700 p-2 rounded-md"/></div>
                </div>
             </div>

            <div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold">{t('admin.general.cancel')}</button><button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.general.save')}</button></div>
         </form>
    )
};

const PVPManager: React.FC<{
    settings: GameSettings;
    onSettingsUpdate: (settings: GameSettings) => void;
    onResetAllPvpCooldowns: () => void;
}> = ({ settings, onSettingsUpdate, onResetAllPvpCooldowns }) => {
    const { t } = useTranslation();
    const [pvpProtection, setPvpProtection] = useState(settings.pvpProtectionMinutes || 60);

    const handleSave = () => {
        onSettingsUpdate({
            ...settings,
            pvpProtectionMinutes: pvpProtection,
        });
        alert(t('admin.pvp.saveSuccess'));
    };

    return (
        <div>
            <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.pvp.title')}</h3>
            <div className="bg-slate-800/50 p-4 rounded-md space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.pvp.protectionDuration')}</label>
                    <input
                        type="number"
                        value={pvpProtection}
                        onChange={(e) => setPvpProtection(parseInt(e.target.value) || 0)}
                        className="w-full max-w-xs bg-slate-700 p-2 rounded-md"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('admin.pvp.protectionDurationDesc')}</p>
                </div>
                <button onClick={handleSave} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.saveSettings')}</button>
            </div>
             <div className="border-t border-slate-700/50 my-6"></div>
             <div>
                <h4 className="font-semibold text-gray-300 mb-2">{t('admin.pvp.actions')}</h4>
                <button onClick={onResetAllPvpCooldowns} className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white font-semibold">{t('admin.pvp.resetCooldowns')}</button>
             </div>
        </div>
    );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  gameData, onGameDataUpdate, onSettingsUpdate, users, onDeleteUser, allCharacters, onDeleteCharacter, onResetCharacterStats, onHealCharacter, onForceTraderRefresh, onResetAllPvpCooldowns, onSendGlobalMessage,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('general');
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);
  const [editingExpedition, setEditingExpedition] = useState<Partial<Expedition> | null>(null);
  const [editingEnemy, setEditingEnemy] = useState<Partial<Enemy> | null>(null);
  const [globalMessage, setGlobalMessage] = useState({ subject: '', content: '' });
  const [isSending, setIsSending] = useState(false);

  const handleUpdate = <T,>(key: keyof Omit<GameData, 'settings'>, allData: T[], newData: T & { id: string }) => {
      const index = allData.findIndex(d => (d as any).id === newData.id);
      if (index > -1) {
          const updated = [...allData];
          updated[index] = newData;
          onGameDataUpdate(key, updated);
      } else {
          onGameDataUpdate(key, [...allData, newData]);
      }
  };

  const handleDelete = <T,>(key: keyof Omit<GameData, 'settings'>, allData: T[], id: string) => {
      onGameDataUpdate(key, allData.filter(d => (d as any).id !== id));
  };
  
  const handleDeleteItemTemplate = (id: string) => {
      const updatedTemplates = gameData.itemTemplates.filter(template => template.id !== id);
      onGameDataUpdate('itemTemplates', updatedTemplates);
  };
  
  const handleSaveItemTemplate = (itemTemplate: ItemTemplate) => {
      handleUpdate('itemTemplates', gameData.itemTemplates, itemTemplate);
  };

  const handleSendGlobalMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalMessage.subject || !globalMessage.content) {
        alert(t('admin.globalMessage.validationError'));
        return;
    }
    setIsSending(true);
    try {
        await onSendGlobalMessage(globalMessage);
        alert(t('admin.globalMessage.sendSuccess'));
        setGlobalMessage({ subject: '', content: '' });
    } catch (err: any) {
        alert(`${t('error.title')}: ${err.message}`);
    } finally {
        setIsSending(false);
    }
  };


  const TABS: { id: AdminTab, label: string }[] = [
    { id: 'general', label: t('admin.tabs.general') },
    { id: 'users', label: t('admin.tabs.users') },
    { id: 'locations', label: t('admin.tabs.locations') },
    { id: 'expeditions', label: t('admin.tabs.expeditions') },
    { id: 'enemies', label: t('admin.tabs.enemies') },
    { id: 'items', label: t('admin.tabs.items') },
    { id: 'affixes', label: t('admin.tabs.affixes') },
    { id: 'quests', label: t('admin.tabs.quests') },
    { id: 'pvp', label: t('admin.tabs.pvp') },
  ];

  return (
    <ContentPanel title={t('admin.title')}>
        <div className="flex border-b border-slate-700 mb-6">
            {TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${activeTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
        
        <div className="bg-slate-900/40 p-6 rounded-xl">
            {activeTab === 'general' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.gameSettings')}</h3>
                        <div className="max-w-md space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.language')}</label>
                                <select value={gameData.settings.language} onChange={(e) => onSettingsUpdate({ ...gameData.settings, language: e.target.value as Language })} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2">
                                    <option value="pl">{t('admin.languages.pl')}</option>
                                </select>
                            </div>
                             <div>
                                <h4 className="font-semibold text-gray-300 mt-4 mb-2">{t('admin.traderSettings')}</h4>
                                <div className="space-y-2">
                                    <label className="block text-sm">{t('admin.rarityChances')}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.values(ItemRarity).filter(r => [ItemRarity.Common, ItemRarity.Uncommon, ItemRarity.Rare].includes(r)).map(rarity => (
                                            <div key={rarity}>
                                                <label className="text-xs">{rarity}</label>
                                                <input
                                                    type="number"
                                                    value={gameData.settings.traderSettings?.rarityChances[rarity] || ''}
                                                    onChange={(e) => {
                                                        const newChances = {
                                                            ...gameData.settings.traderSettings?.rarityChances,
                                                            [rarity]: parseInt(e.target.value) || 0
                                                        }
                                                        onSettingsUpdate({ ...gameData.settings, traderSettings: { ...gameData.settings.traderSettings, rarityChances: newChances } as TraderSettings })
                                                    }}
                                                    className="w-full bg-slate-800 p-2 rounded-md"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                     <p className="text-xs text-gray-500 mt-1">{t('admin.rarityChancesDesc')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="border-t border-slate-700/50 my-6"></div>
                     <div>
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.traderActions')}</h3>
                        <button onClick={onForceTraderRefresh} className="px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white font-semibold">{t('admin.forceTraderRefresh')}</button>
                     </div>
                     <div className="border-t border-slate-700/50 my-6"></div>
                      <div>
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.globalMessage.title')}</h3>
                        <form onSubmit={handleSendGlobalMessageSubmit} className="space-y-4 max-w-md">
                            <input type="text" placeholder={t('messages.compose.subjectPlaceholder') || "Temat"} value={globalMessage.subject} onChange={e => setGlobalMessage(p => ({...p, subject: e.target.value}))} className="w-full bg-slate-800 p-2 rounded-md" />
                            <textarea placeholder={t('admin.globalMessage.contentPlaceholder') || "Treść wiadomości..."} value={globalMessage.content} onChange={e => setGlobalMessage(p => ({...p, content: e.target.value}))} rows={4} className="w-full bg-slate-800 p-2 rounded-md" />
                            <button type="submit" disabled={isSending} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 font-semibold disabled:bg-slate-600">{isSending ? t('messages.compose.sending') : t('admin.globalMessage.sendButton')}</button>
                        </form>
                      </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.managePlayers')}</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {users.map(user => (
                                <div key={user.id} className="bg-slate-800/50 p-2 rounded-md flex justify-between items-center">
                                    <span>{user.username} (ID: {user.id})</span>
                                    <button onClick={() => onDeleteUser(user.id)} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.deletePlayer')}</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('admin.manageCharacters')}</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {allCharacters.length > 0 ? allCharacters.map(char => (
                                <div key={char.user_id} className="bg-slate-800/50 p-2 rounded-md">
                                    <div className="flex justify-between items-center">
                                        <span>{char.name} (Lvl {char.level} {char.race}) - <span className="text-gray-400">{t('admin.owner')}: {char.username}</span></span>
                                        <div>
                                            <button onClick={() => onResetCharacterStats(char.user_id)} className="px-3 py-1 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-sm mr-2">{t('admin.resetStats')}</button>
                                            <button onClick={() => onHealCharacter(char.user_id)} className="px-3 py-1 rounded-md bg-green-700 hover:bg-green-600 text-white text-sm mr-2">{t('admin.heal')}</button>
                                            <button onClick={() => onDeleteCharacter(char.user_id)} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.deleteCharacter')}</button>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className="text-gray-500">{t('admin.noCharacters')}</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'locations' && (
                <div>
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-indigo-400">{t('admin.location.manage')}</h3>
                        <button onClick={() => setEditingLocation({})} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.location.add')}</button>
                    </div>
                     <div className="max-h-96 overflow-y-auto">
                        {gameData.locations.map(location => (
                            <div key={location.id} className="bg-slate-800/50 p-2 rounded-md mb-2 flex justify-between items-center">
                                <span>{location.name} {location.isStartLocation && <span className="text-xs text-amber-400">({t('admin.location.start')})</span>}</span>
                                <div>
                                    <button onClick={() => setEditingLocation(location)} className="px-3 py-1 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm mr-2">{t('admin.edit')}</button>
                                    <button onClick={() => handleDelete('locations', gameData.locations, location.id)} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {editingLocation && (
                        <LocationEditor 
                            location={editingLocation}
                            onSave={(loc) => { handleUpdate('locations', gameData.locations, loc); setEditingLocation(null); }}
                            onCancel={() => setEditingLocation(null)}
                            isEditing={!!editingLocation.id}
                            allLocations={gameData.locations}
                        />
                    )}
                </div>
            )}
            
             {activeTab === 'expeditions' && (
                 <div>
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-indigo-400">{t('admin.expedition.manage')}</h3>
                        <button onClick={() => setEditingExpedition({})} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.expedition.add')}</button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {gameData.expeditions.map(exp => (
                            <div key={exp.id} className="bg-slate-800/50 p-2 rounded-md mb-2 flex justify-between items-center">
                                <span>{exp.name}</span>
                                <div>
                                    <button onClick={() => setEditingExpedition(exp)} className="px-3 py-1 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm mr-2">{t('admin.edit')}</button>
                                    <button onClick={() => handleDelete('expeditions', gameData.expeditions, exp.id)} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {editingExpedition && (
                        <ExpeditionEditor
                            expedition={editingExpedition}
                            onSave={(exp) => { handleUpdate('expeditions', gameData.expeditions, exp); setEditingExpedition(null); }}
                            onCancel={() => setEditingExpedition(null)}
                            isEditing={!!editingExpedition.id}
                            allLocations={gameData.locations}
                            allEnemies={gameData.enemies}
                            allItemTemplates={gameData.itemTemplates}
                        />
                    )}
                 </div>
             )}
             
            {activeTab === 'enemies' && (
                 <div>
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-indigo-400">{t('admin.enemy.manage')}</h3>
                        <button onClick={() => setEditingEnemy({})} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">{t('admin.enemy.add')}</button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {gameData.enemies.map(enemy => (
                            <div key={enemy.id} className="bg-slate-800/50 p-2 rounded-md mb-2 flex justify-between items-center">
                                <span>{enemy.name}</span>
                                <div>
                                    <button onClick={() => setEditingEnemy(enemy)} className="px-3 py-1 rounded-md bg-sky-700 hover:bg-sky-600 text-white text-sm mr-2">{t('admin.edit')}</button>
                                    <button onClick={() => handleDelete('enemies', gameData.enemies, enemy.id)} className="px-3 py-1 rounded-md bg-red-800 hover:bg-red-700 text-white text-sm">{t('admin.delete')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {editingEnemy && (
                        <EnemyEditor
                            enemy={editingEnemy}
                            onSave={(enemy) => { handleUpdate('enemies', gameData.enemies, enemy); setEditingEnemy(null); }}
                            onCancel={() => setEditingEnemy(null)}
                            isEditing={!!editingEnemy.id}
                            allItemTemplates={gameData.itemTemplates}
                        />
                    )}
                 </div>
             )}
             
            {activeTab === 'items' && (
                <ItemTemplateManager 
                    itemTemplates={gameData.itemTemplates}
                    onSave={handleSaveItemTemplate}
                    onDelete={handleDeleteItemTemplate}
                />
            )}
            
            {activeTab === 'affixes' && (
                <AffixManager 
                    affixes={gameData.affixes || []}
                    onSave={(affix) => handleUpdate('affixes', gameData.affixes || [], affix)}
                    onDelete={(id) => handleDelete('affixes', gameData.affixes || [], id)}
                />
            )}
            
            {activeTab === 'quests' && (
                <QuestManager 
                    quests={gameData.quests || []}
                    onSave={(quest) => handleUpdate('quests', gameData.quests || [], quest)}
                    onDelete={(id) => handleDelete('quests', gameData.quests || [], id)}
                    enemies={gameData.enemies}
                    itemTemplates={gameData.itemTemplates}
                    locations={gameData.locations}
                />
            )}

            {activeTab === 'pvp' && (
                <PVPManager
                    settings={gameData.settings}
                    onSettingsUpdate={onSettingsUpdate}
                    onResetAllPvpCooldowns={onResetAllPvpCooldowns}
                />
            )}

        </div>
    </ContentPanel>
  );
};

export default AdminPanel;