import React, { useState } from 'react';
import { Enemy, ItemTemplate, LootDrop, ResourceDrop, EssenceType, MagicAttackType, EnemyStats } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface EnemyEditorProps {
  enemy: Partial<Enemy>;
  onSave: (enemy: Enemy) => void;
  onCancel: () => void;
  isEditing: boolean;
  allItemTemplates: ItemTemplate[];
}

export const EnemyEditor: React.FC<EnemyEditorProps> = ({ enemy, onSave, onCancel, isEditing, allItemTemplates }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Enemy>>(() => {
        const defaultStats: EnemyStats = {
            maxHealth: 10,
            minDamage: 1,
            maxDamage: 2,
            armor: 0,
            critChance: 5,
            critDamageModifier: 150,
            agility: 5,
            dodgeChance: 0,
            // Fix: Added missing blockChance required property
            blockChance: 0,
            maxMana: 0,
            manaRegen: 0,
            magicDamageMin: 0,
            magicDamageMax: 0,
            magicAttackChance: 0,
            magicAttackManaCost: 0,
            attacksPerTurn: 1
        };
        return {
            lootTable: [],
            resourceLootTable: [],
            isBoss: false,
            ...enemy,
            rewards: enemy.rewards || { minGold: 0, maxGold: 0, minExperience: 0, maxExperience: 0 },
            stats: { ...defaultStats, ...(enemy.stats || {}) },
        };
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const isChecked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
             ...prev,
             [name]: isCheckbox ? isChecked : value
        }));
    };

    const handleStatsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, stats: {
            ...(prev.stats as EnemyStats),
            [name]: name === 'magicAttackType' ? value : (parseFloat(value) || 0)
        } }));
    };

    const handleRewardsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, rewards: {
            minGold: 0,
            maxGold: 0,
            minExperience: 0,
            maxExperience: 0,
            ...(prev.rewards || {}),
            [name]: parseInt(value, 10) || 0 
        } }));
    };

    const handleLootChange = (index: number, key: keyof LootDrop, value: string) => {
        const updatedLoot = [...(formData.lootTable || [])];
        (updatedLoot[index] as any)[key] = key === 'weight' ? parseInt(value, 10) || 0 : value;
        setFormData(prev => ({ ...prev, lootTable: updatedLoot }));
    };

    const addLoot = () => setFormData(prev => ({ ...prev, lootTable: [...(prev.lootTable || []), { templateId: '', weight: 100 }] }));
    const removeLoot = (index: number) => setFormData(prev => ({ ...prev, lootTable: prev.lootTable?.filter((_, i) => i !== index) }));

    const handleResourceLootChange = (index: number, key: keyof ResourceDrop, value: string) => {
        const updatedLoot = [...(formData.resourceLootTable || [])];
        (updatedLoot[index] as any)[key] = ['min', 'max', 'weight'].includes(key) ? parseInt(value, 10) || 0 : value;
        setFormData(prev => ({ ...prev, resourceLootTable: updatedLoot }));
    };

    const addResourceLoot = () => setFormData(prev => ({ ...prev, resourceLootTable: [...(prev.resourceLootTable || []), { resource: EssenceType.Common, min: 1, max: 1, weight: 100 }] }));
    const removeResourceLoot = (index: number) => setFormData(prev => ({ ...prev, resourceLootTable: prev.resourceLootTable?.filter((_, i) => i !== index) }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert(t('admin.enemy.nameRequired'));
            return;
        }
        onSave(formData as Enemy);
    };

    const totalLootWeight = (formData.lootTable || []).reduce((acc, curr) => acc + (curr.weight || 0), 0);
    const totalResourceWeight = (formData.resourceLootTable || []).reduce((acc, curr) => acc + (curr.weight || 0), 0);

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.enemy.edit') : t('admin.enemy.create')}</h3>
            
            {/* Basic Info */}
            <div><label>{t('admin.general.name')}:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            <div><label>{t('admin.general.description')}:<textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            <div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                        name="isBoss"
                        type="checkbox"
                        checked={formData.isBoss || false}
                        onChange={handleChange}
                        className="form-checkbox h-5 w-5 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-amber-400 font-bold">{t('admin.enemy.isBoss')}</span>
                </label>
            </div>

            {/* Stats */}
            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">Statystyki</legend>
                <div><label>Max HP:<input name="maxHealth" type="number" value={formData.stats?.maxHealth || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Min Dmg:<input name="minDamage" type="number" value={formData.stats?.minDamage || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Max Dmg:<input name="maxDamage" type="number" value={formData.stats?.maxDamage || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Pancerz:<input name="armor" type="number" value={formData.stats?.armor || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Szansa na Kryt. (%):<input name="critChance" type="number" step="0.1" value={formData.stats?.critChance || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Modyfikator Obr. Kryt. (%):<input name="critDamageModifier" type="number" value={formData.stats?.critDamageModifier || 150} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Zręczność:<input name="agility" type="number" value={formData.stats?.agility || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Szansa na Unik (%):<input name="dodgeChance" type="number" step="0.1" value={formData.stats?.dodgeChance ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Ataki/turę:<input name="attacksPerTurn" type="number" step="0.1" value={formData.stats?.attacksPerTurn || 1} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>

            {/* Magic Stats */}
             <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.enemy.magicProperties')}</legend>
                <div><label>{t('admin.enemy.maxMana')}:<input name="maxMana" type="number" value={formData.stats?.maxMana ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.enemy.manaRegen')}:<input name="manaRegen" type="number" value={formData.stats?.manaRegen ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.enemy.magicDamageMin')}:<input name="magicDamageMin" type="number" value={formData.stats?.magicDamageMin ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.enemy.magicDamageMax')}:<input name="magicDamageMax" type="number" value={formData.stats?.magicDamageMax ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.enemy.magicAttackChance')}:<input name="magicAttackChance" type="number" value={formData.stats?.magicAttackChance ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.enemy.magicAttackManaCost')}:<input name="magicAttackManaCost" type="number" value={formData.stats?.magicAttackManaCost ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                 <div className="md:col-span-2"><label>{t('admin.enemy.magicAttackType')}:<select name="magicAttackType" value={formData.stats?.magicAttackType || ''} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- {t('admin.general.none')} --</option>{Object.values(MagicAttackType).map(v => <option key={v} value={v}>{v}</option>)}</select></label></div>
             </fieldset>

            {/* Rewards */}
            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">Nagrody</legend>
                <div><label>Min Złota:<input name="minGold" type="number" value={formData.rewards?.minGold || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Max Złota:<input name="maxGold" type="number" value={formData.rewards?.maxGold || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Min EXP:<input name="minExperience" type="number" value={formData.rewards?.minExperience || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Max EXP:<input name="maxExperience" type="number" value={formData.rewards?.maxExperience || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>
            
            {/* Loot */}
            <div className="grid grid-cols-2 gap-6">
                 <div>
                    <h4 className="font-semibold text-lg mb-2">{t('admin.lootTable')} <span className="text-xs text-gray-400 font-normal ml-2">(Suma wag: {totalLootWeight})</span></h4>
                    {(formData.lootTable || []).map((loot, index) => (
                         <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-slate-800/50 rounded-md">
                            <select value={loot.templateId} onChange={e => handleLootChange(index, 'templateId', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md"><option value="">-- {t('admin.select')} --</option>{allItemTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                            <input type="number" placeholder={t('admin.dropChance')!} value={loot.weight} onChange={e => handleLootChange(index, 'weight', e.target.value)} className="w-32 bg-slate-700 p-2 rounded-md" />
                            <span className="text-xs text-gray-400 w-16 text-right">
                                {totalLootWeight > 0 ? ((loot.weight / totalLootWeight) * 100).toFixed(2) : 0}%
                            </span>
                            <button type="button" onClick={() => removeLoot(index)} className="px-2 py-1 text-xs rounded bg-red-800 hover:bg-red-700">X</button>
                        </div>
                    ))}
                    <button type="button" onClick={addLoot} className="px-3 py-1 text-sm rounded bg-sky-700 hover:bg-sky-600">+</button>
                </div>
                 <div>
                    <h4 className="font-semibold text-lg mb-2">{t('admin.resourceLootTable')} <span className="text-xs text-gray-400 font-normal ml-2">(Suma wag: {totalResourceWeight})</span></h4>
                    {(formData.resourceLootTable || []).map((loot, index) => (
                         <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-slate-800/50 rounded-md">
                            <select value={loot.resource} onChange={e => handleResourceLootChange(index, 'resource', e.target.value)} className="flex-grow bg-slate-700 p-2 rounded-md">{Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}</select>
                            <input type="number" placeholder={t('admin.min')!} value={loot.min} onChange={e => handleResourceLootChange(index, 'min', e.target.value)} className="w-20 bg-slate-700 p-2 rounded-md" />
                            <input type="number" placeholder={t('admin.max')!} value={loot.max} onChange={e => handleResourceLootChange(index, 'max', e.target.value)} className="w-20 bg-slate-700 p-2 rounded-md" />
                            <input type="number" placeholder="Waga" value={loot.weight} onChange={e => handleResourceLootChange(index, 'weight', e.target.value)} className="w-24 bg-slate-700 p-2 rounded-md" />
                            <span className="text-xs text-gray-400 w-12 text-right">
                                {totalResourceWeight > 0 ? ((loot.weight / totalResourceWeight) * 100).toFixed(1) : 0}%
                            </span>
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