

import React, { useState } from 'react';
import { Expedition, Location, Enemy, ItemTemplate, ExpeditionEnemy, LootDrop, ResourceDrop, EssenceType } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface ExpeditionEditorProps {
  expedition: Partial<Expedition>;
  onSave: (expedition: Expedition) => void;
  onCancel: () => void;
  isEditing: boolean;
  allLocations: Location[];
  allEnemies: Enemy[];
  allItemTemplates: ItemTemplate[];
}

export const ExpeditionEditor: React.FC<ExpeditionEditorProps> = ({ expedition, onSave, onCancel, isEditing, allLocations, allEnemies, allItemTemplates }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Expedition>>({
        enemies: [],
        lootTable: [],
        resourceLootTable: [],
        ...expedition,
        minBaseGoldReward: expedition.minBaseGoldReward ?? 0,
        maxBaseGoldReward: expedition.maxBaseGoldReward ?? 0,
        minBaseExperienceReward: expedition.minBaseExperienceReward ?? 0,
        maxBaseExperienceReward: expedition.maxBaseExperienceReward ?? 0,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['duration', 'goldCost', 'energyCost', 'minBaseGoldReward', 'maxBaseGoldReward', 'minBaseExperienceReward', 'maxBaseExperienceReward', 'maxEnemies'].includes(name);
        setFormData(prev => ({ ...prev, [name]: isNumeric ? parseInt(value, 10) || 0 : value }));
    };
    
    const handleLocationChange = (locId: string) => {
        const currentLocs = formData.locationIds || [];
        const newLocs = currentLocs.includes(locId) ? currentLocs.filter(id => id !== locId) : [...currentLocs, locId];
        setFormData(prev => ({ ...prev, locationIds: newLocs }));
    };

    const handleEnemyChange = (index: number, key: keyof ExpeditionEnemy, value: string) => {
        const updatedEnemies = [...(formData.enemies || [])];
        (updatedEnemies[index] as any)[key] = key === 'spawnChance' ? parseInt(value, 10) || 0 : value;
        setFormData(prev => ({ ...prev, enemies: updatedEnemies }));
    };
    
    const addEnemy = () => setFormData(prev => ({ ...prev, enemies: [...(prev.enemies || []), { enemyId: '', spawnChance: 100 }] }));
    const removeEnemy = (index: number) => setFormData(prev => ({ ...prev, enemies: prev.enemies?.filter((_, i) => i !== index) }));

    const handleLootChange = (index: number, key: keyof LootDrop, value: string) => {
        const updatedLoot = [...(formData.lootTable || [])];
        (updatedLoot[index] as any)[key] = key === 'chance' ? parseInt(value, 10) || 0 : value;
        setFormData(prev => ({ ...prev, lootTable: updatedLoot }));
    };

    const addLoot = () => setFormData(prev => ({ ...prev, lootTable: [...(prev.lootTable || []), { templateId: '', chance: 0 }] }));
    const removeLoot = (index: number) => setFormData(prev => ({ ...prev, lootTable: prev.lootTable?.filter((_, i) => i !== index) }));

    const handleResourceLootChange = (index: number, key: keyof ResourceDrop, value: string) => {
        const updatedLoot = [...(formData.resourceLootTable || [])];
        (updatedLoot[index] as any)[key] = ['min', 'max', 'chance'].includes(key) ? parseInt(value, 10) || 0 : value;
        setFormData(prev => ({ ...prev, resourceLootTable: updatedLoot }));
    };

    const addResourceLoot = () => setFormData(prev => ({ ...prev, resourceLootTable: [...(prev.resourceLootTable || []), { resource: EssenceType.Common, min: 1, max: 1, chance: 0 }] }));
    const removeResourceLoot = (index: number) => setFormData(prev => ({ ...prev, resourceLootTable: prev.resourceLootTable?.filter((_, i) => i !== index) }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert(t('admin.expedition.nameRequired'));
            return;
        }
        onSave(formData as Expedition);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.expedition.edit') : t('admin.expedition.create')}</h3>
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label>{t('admin.general.name')}:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>URL Obrazka:<input name="image" value={formData.image || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div className="md:col-span-2"><label>{t('admin.general.description')}:<textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.expedition.expeditionDuration')}:<input name="duration" type="number" value={formData.duration || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.expedition.expeditionGoldCost')}:<input name="goldCost" type="number" value={formData.goldCost || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.expedition.expeditionEnergyCost')}:<input name="energyCost" type="number" value={formData.energyCost || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.expedition.maxEnemies')}:<input name="maxEnemies" type="number" value={formData.maxEnemies || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" title={t('admin.expedition.maxEnemiesDesc')!} /></label></div>
                <div><label>{t('admin.expedition.rewardGold')} ({t('admin.min')}/{t('admin.max')}):<div className="flex gap-2"><input name="minBaseGoldReward" type="number" value={formData.minBaseGoldReward || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /><input name="maxBaseGoldReward" type="number" value={formData.maxBaseGoldReward || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></div></label></div>
                <div><label>{t('admin.expedition.rewardExp')} ({t('admin.min')}/{t('admin.max')}):<div className="flex gap-2"><input name="minBaseExperienceReward" type="number" value={formData.minBaseExperienceReward || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /><input name="maxBaseExperienceReward" type="number" value={formData.maxBaseExperienceReward || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></div></label></div>
            </div>

            {/* Location Availability */}
            <div>
                <label className="block font-medium mb-2">{t('admin.expedition.availableIn')}</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {allLocations.map(loc => <label key={loc.id} className="flex items-center gap-2"><input type="checkbox" checked={formData.locationIds?.includes(loc.id)} onChange={() => handleLocationChange(loc.id)} /> {loc.name}</label>)}
                </div>
            </div>
            
            {/* Enemies */}
            <div>
                 <h4 className="font-semibold text-lg mb-2">{t('admin.expedition.tabEnemies')}</h4>
                {(formData.enemies || []).map((enemy, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-slate-800/50 rounded-md">
                        <select value={enemy.enemyId} onChange={e => handleEnemyChange(index, 'enemyId', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"><option value="">-- {t('admin.select')} --</option>{allEnemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                        <input type="number" placeholder={t('admin.dropChance')!} value={enemy.spawnChance} onChange={e => handleEnemyChange(index, 'spawnChance', e.target.value)} className="w-32 bg-slate-700 p-2 rounded-md" />
                        <button type="button" onClick={() => removeEnemy(index)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">X</button>
                    </div>
                ))}
                <button type="button" onClick={addEnemy} className="px-3 py-1 text-sm rounded bg-sky-700 hover:bg-sky-600">+</button>
            </div>
            
            {/* Rewards */}
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold text-lg mb-2">{t('admin.lootTable')}</h4>
                    {(formData.lootTable || []).map((loot, index) => (
                         <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-slate-800/50 rounded-md">
                            <select value={loot.templateId} onChange={e => handleLootChange(index, 'templateId', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"><option value="">-- {t('admin.select')} --</option>{allItemTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                            <input type="number" placeholder={t('admin.dropChance')!} value={loot.chance} onChange={e => handleLootChange(index, 'chance', e.target.value)} className="w-32 bg-slate-700 p-2 rounded-md" />
                            <button type="button" onClick={() => removeLoot(index)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">X</button>
                        </div>
                    ))}
                    <button type="button" onClick={addLoot} className="px-3 py-1 text-sm rounded bg-sky-700 hover:bg-sky-600">+</button>
                </div>
                 <div>
                    <h4 className="font-semibold text-lg mb-2">{t('admin.resourceLootTable')}</h4>
                    {(formData.resourceLootTable || []).map((loot, index) => (
                         <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-slate-800/50 rounded-md">
                            <select value={loot.resource} onChange={e => handleResourceLootChange(index, 'resource', e.target.value)} className="flex-grow bg-slate-700 p-2 rounded-md">{Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}</select>
                            <input type="number" placeholder={t('admin.min')!} value={loot.min} onChange={e => handleResourceLootChange(index, 'min', e.target.value)} className="w-20 bg-slate-700 p-2 rounded-md" />
                            <input type="number" placeholder={t('admin.max')!} value={loot.max} onChange={e => handleResourceLootChange(index, 'max', e.target.value)} className="w-20 bg-slate-700 p-2 rounded-md" />
                            <input type="number" placeholder={t('admin.chance')!} value={loot.chance} onChange={e => handleResourceLootChange(index, 'chance', e.target.value)} className="w-24 bg-slate-700 p-2 rounded-md" />
                            <button type="button" onClick={() => removeResourceLoot(index)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">X</button>
                        </div>
                    ))}
                    <button type="button" onClick={addResourceLoot} className="px-3 py-1 text-sm rounded bg-sky-700 hover:bg-sky-600">+</button>
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};