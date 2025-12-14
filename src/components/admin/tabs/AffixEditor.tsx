
import React, { useState } from 'react';
import { Affix, AffixType, ItemCategory, CharacterStats } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

export const AffixEditor: React.FC<{
  affix: Partial<Affix>;
  onSave: (affix: Affix) => void;
  onCancel: () => void;
  isEditing: boolean;
}> = ({ affix, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    
    // Normalize name to object format
    const initialName = typeof affix.name === 'string' 
        ? { masculine: affix.name, feminine: affix.name, neuter: affix.name }
        : affix.name || { masculine: '', feminine: '', neuter: '' };

    const [formData, setFormData] = useState<Partial<Affix>>({ 
        spawnChances: {}, 
        statsBonus: {},
        ...affix,
        name: initialName
    });

    const handleNameChange = (gender: keyof Exclude<Affix['name'], string>, value: string) => {
        setFormData(prev => {
            const currentName = prev.name as Exclude<Affix['name'], string>;
            return { 
                ...prev, 
                name: { ...currentName, [gender]: value }
            };
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['value', 'requiredLevel'].includes(name);
        setFormData(prev => ({
            ...prev,
            [name]: isNumeric ? parseInt(value, 10) || 0 : value
        }));
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
        const names = formData.name as Exclude<Affix['name'], string>;
        if (!names?.masculine) {
            alert(t('admin.affix.nameRequired'));
            return;
        }

        const finalAffix: Affix = {
            id: formData.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }),
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
    
    const primaryStats: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];


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
    
    // Helper to safely access name properties
    const currentNames = formData.name as Exclude<Affix['name'], string>;

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.affix.edit') : t('admin.affix.create')} ({formData.type})</h3>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.general.name')}</legend>
                <div><label>{t('admin.affix.nameMasculine')}:<input type="text" value={currentNames?.masculine || ''} onChange={e => handleNameChange('masculine', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.affix.nameFeminine')}:<input type="text" value={currentNames?.feminine || ''} onChange={e => handleNameChange('feminine', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.affix.nameNeuter')}:<input type="text" value={currentNames?.neuter || ''} onChange={e => handleNameChange('neuter', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300">{t('item.value')}</label>
                    <input name="value" type="number" value={formData.value || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" />
                </div>
            </div>

            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.affix.spawnChances')}</legend>
                {Object.values(ItemCategory).map(cat => (
                    <div key={cat}><label>{t(`item.categories.${cat}`)}:<input type="number" value={formData.spawnChances?.[cat] || ''} onChange={e => handleSpawnChanceChange(cat, e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
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
