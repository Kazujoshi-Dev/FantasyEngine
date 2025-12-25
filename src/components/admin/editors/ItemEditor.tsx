
import React, { useState } from 'react';
import { ItemTemplate, EquipmentSlot, ItemRarity, ItemCategory, GrammaticalGender, CharacterStats, MagicAttackType, Gender } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface ItemEditorProps {
  item: Partial<ItemTemplate>;
  onSave: (item: ItemTemplate) => void;
  onCancel: () => void;
  isEditing: boolean;
}

export const ItemEditor: React.FC<ItemEditorProps> = ({ item, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<ItemTemplate>>({
        requiredGender: null,
        ...item
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = (e.target as HTMLInputElement).type === 'checkbox';
        const isChecked = (e.target as HTMLInputElement).checked;
        const isNumeric = ['value', 'requiredLevel', 'attacksPerRound'].includes(name);

        setFormData(prev => ({
            ...prev,
            [name]: isCheckbox ? isChecked : (isNumeric ? parseFloat(value) || 0 : value)
        }));
    };
    
    const handleMinMaxChange = (key: keyof ItemTemplate, field: 'min' | 'max', value: string) => {
        const numValue = parseFloat(value);
        setFormData(prev => ({
            ...prev,
            [key]: {
                ...(prev as any)[key],
                [field]: isNaN(numValue) ? undefined : numValue
            }
        }));
    };

    const handleNestedMinMaxChange = (category: 'statsBonus' | 'requiredStats', key: string, field: 'min' | 'max' | null, value: string) => {
        const numValue = parseInt(value, 10);
        setFormData(prev => {
            const newCategory = { ...(prev as any)[category] };
            if (field) {
                 const newStat = { ...newCategory[key], [field]: isNaN(numValue) ? undefined : numValue };
                 if (newStat.min === undefined && newStat.max === undefined) delete newCategory[key];
                 else newCategory[key] = newStat;
            } else {
                if (isNaN(numValue) || numValue === 0) delete newCategory[key];
                else newCategory[key] = numValue;
            }
            if (Object.keys(newCategory).length === 0) return { ...prev, [category]: undefined };
            return { ...prev, [category]: newCategory };
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.slot || !formData.rarity) {
            alert(t('admin.item.validationError'));
            return;
        }
        onSave(formData as ItemTemplate);
    };

    const primaryStats: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];

    const MinMaxInput: React.FC<{ label: string; field: keyof ItemTemplate }> = ({ label, field }) => {
        const value = (formData as any)[field] || {};
        return (
             <div>
                <label className="block text-sm font-medium text-gray-300">{label}</label>
                <div className="flex items-center gap-2 mt-1">
                    <input type="number" step="0.1" value={value.min ?? ''} onChange={e => handleMinMaxChange(field, 'min', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.min') as string} />
                    <input type="number" step="0.1" value={value.max ?? ''} onChange={e => handleMinMaxChange(field, 'max', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs" placeholder={t('admin.max') as string} />
                </div>
            </div>
        );
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.item.edit') : t('admin.item.create')}</h3>
            
            <fieldset className="grid grid-cols-2 md:grid-cols-3 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.item.basicInfo')}</legend>
                <div className="md:col-span-2"><label>{t('item.name')}:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('item.slotLabel')}:<select name="slot" value={formData.slot || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- {t('admin.select')} --</option>{Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{t(`item.slot.${s}`)}</option>)}<option value="ring">{t('item.slot.ring')}</option></select></label></div>
                <div className="md:col-span-3"><label>{t('item.description')}:<textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('item.category')}:<select name="category" value={formData.category || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- {t('admin.select')} --</option>{Object.values(ItemCategory).map(c => <option key={c} value={c}>{t(`item.categories.${c}`)}</option>)}</select></label></div>
                <div><label>{t('item.rarity')}:<select name="rarity" value={formData.rarity || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- {t('admin.select')} --</option>{Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}</select></label></div>
                
                {/* Gender Constraints */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500 uppercase font-bold">Wymagana Płeć:</label>
                    <select name="requiredGender" value={formData.requiredGender || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">
                        <option value="">-- Dowolna --</option>
                        <option value={Gender.Male}>{t('gender.Male')}</option>
                        <option value={Gender.Female}>{t('gender.Female')}</option>
                    </select>
                </div>

                <div><label>{t('admin.item.grammaticalGender')}:<select name="gender" value={formData.gender || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(GrammaticalGender).map(g => <option key={g} value={g}>{g}</option>)}</select></label></div>
                <div><label>{t('admin.item.iconPath')}:<input name="icon" value={formData.icon || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('item.value')}:<input name="value" type="number" value={formData.value || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('item.levelRequirement')}:<input name="requiredLevel" type="number" value={formData.requiredLevel || 1} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>

            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.item.bonuses')}</legend>
                <MinMaxInput label={t('item.damageMin')} field="damageMin" />
                <MinMaxInput label={t('item.damageMax')} field="damageMax" />
                <div><label>{t('item.attacksPerRound')}:<input name="attacksPerRound" type="number" step="0.1" value={formData.attacksPerRound || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <MinMaxInput label={t('statistics.armor')} field="armorBonus" />
                <MinMaxInput label={t('statistics.critChance')} field="critChanceBonus" />
                <MinMaxInput label={t('item.blockChanceBonus')} field="blockChanceBonus" />
                <MinMaxInput label={t('statistics.health')} field="maxHealthBonus" />
                <MinMaxInput label={t('statistics.critDamageModifier')} field="critDamageModifierBonus" />
                <MinMaxInput label={t('item.armorPenetrationPercent')} field="armorPenetrationPercent" />
                <MinMaxInput label={t('item.armorPenetrationFlat')} field="armorPenetrationFlat" />
                <MinMaxInput label={t('item.lifeStealPercent')} field="lifeStealPercent" />
                <MinMaxInput label={t('item.lifeStealFlat')} field="lifeStealFlat" />
                <MinMaxInput label={t('item.manaStealPercent')} field="manaStealPercent" />
                <MinMaxInput label={t('item.manaStealFlat')} field="manaStealFlat" />
            </fieldset>

            <fieldset className="grid grid-cols-2 md:grid-cols-3 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('item.magicProperties')}</legend>
                <label className="flex items-center gap-2"><input name="isMagical" type="checkbox" checked={formData.isMagical || false} onChange={handleChange}/> {t('item.isMagical')}</label>
                <label className="flex items-center gap-2"><input name="isRanged" type="checkbox" checked={formData.isRanged || false} onChange={handleChange}/> {t('item.isRanged')}</label>
                <label className="flex items-center gap-2"><input name="isShield" type="checkbox" checked={formData.isShield || false} onChange={handleChange}/> {t('item.isShield')}</label>
                <div><label>{t('item.magicAttackType')}:<select name="magicAttackType" value={formData.magicAttackType || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- {t('admin.general.none')} --</option>{Object.values(MagicAttackType).map(v => <option key={v} value={v}>{v}</option>)}</select></label></div>
                <MinMaxInput label={t('item.manaCost')} field="manaCost" />
                <MinMaxInput label={t('item.magicDamageMin')} field="magicDamageMin" />
                <MinMaxInput label={t('item.magicDamageMax')} field="magicDamageMax" />
            </fieldset>

            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('item.requiredStats')}</legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {primaryStats.map(stat => (
                        <div key={stat}>
                            <label className="block text-sm font-medium text-gray-300">{t(`statistics.${stat}`)}</label>
                            <input type="number" value={(formData.requiredStats as any)?.[stat] || ''} onChange={e => handleNestedMinMaxChange('requiredStats', stat, null, e.target.value)} className="w-full bg-slate-700 p-1 rounded-md text-xs mt-1" />
                        </div>
                    ))}
                </div>
            </fieldset>

            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('item.statBonuses')}</legend>
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

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};
