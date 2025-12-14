import React, { useState } from 'react';
import { Skill, SkillType, SkillCategory, SkillCost, SkillRequirements, EssenceType, CharacterResources, CharacterStats } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface SkillEditorProps {
  skill: Partial<Skill>;
  onSave: (skill: Skill) => void;
  onCancel: () => void;
  isEditing: boolean;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({ skill, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Skill>>({
        requirements: {},
        cost: {},
        manaMaintenanceCost: 0,
        ...skill
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = name === 'manaMaintenanceCost';
        setFormData(prev => ({ ...prev, [name]: isNumeric ? parseInt(value, 10) || 0 : value }));
    };

    const handleNumericChange = (category: 'requirements' | 'cost', key: string, value: string) => {
        const numValue = parseInt(value, 10);
        setFormData(prev => {
            const newCategory = { ...(prev[category] as any) };
            if (isNaN(numValue) || numValue === 0) {
                delete newCategory[key];
            } else {
                newCategory[key] = numValue;
            }
            return { ...prev, [category]: newCategory };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.type || !formData.category) {
            alert('Name, Type, and Category are required.');
            return;
        }
        onSave(formData as Skill);
    };

    const requirementKeys: (keyof SkillRequirements)[] = ['level', 'strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];
    const costKeys: (keyof SkillCost)[] = ['gold', ...Object.values(EssenceType)];

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? 'Edytuj Umiejętność' : 'Stwórz Nową Umiejętność'}</h3>
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label>Nazwa:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Typ:<select name="type" value={formData.type || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- Wybierz --</option>{Object.values(SkillType).map(v => <option key={v} value={v}>{v}</option>)}</select></label></div>
                <div><label>Kategoria:<select name="category" value={formData.category || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- Wybierz --</option>{Object.values(SkillCategory).map(v => <option key={v} value={v}>{v}</option>)}</select></label></div>
                
                {formData.category === 'Active' && (
                    <div><label>Koszt utrzymania (Max Mana):<input name="manaMaintenanceCost" type="number" value={formData.manaMaintenanceCost || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                )}

                <div className="md:col-span-3"><label>Opis:<textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </div>

            {/* Requirements */}
            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">Wymagania</legend>
                {requirementKeys.map(key => (
                     <div key={key}><label>{t(`statistics.${key}` as any)}:<input type="number" value={(formData.requirements as any)?.[key] || ''} onChange={e => handleNumericChange('requirements', key, e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                ))}
            </fieldset>

            {/* Cost */}
            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">Koszt</legend>
                {costKeys.map(key => (
                    <div key={key}><label>{t(`resources.${key}` as any)}:<input type="number" value={(formData.cost as any)?.[key] || ''} onChange={e => handleNumericChange('cost', key, e.target.value)} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                ))}
            </fieldset>
            
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};