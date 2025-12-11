
import React, { useState } from 'react';
import { Ritual, EssenceType, CharacterStats } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { PlusCircleIcon } from '../../icons/PlusCircleIcon';
import { MinusCircleIcon } from '../../icons/MinusCircleIcon';

interface RitualEditorProps {
    ritual: Partial<Ritual>;
    onSave: (ritual: Ritual) => void;
    onCancel: () => void;
    isEditing: boolean;
}

export const RitualEditor: React.FC<RitualEditorProps> = ({ ritual, onSave, onCancel, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Ritual>>({
        id: crypto.randomUUID(),
        name: '',
        description: '',
        tier: 1,
        durationMinutes: 60,
        cost: [],
        stats: {},
        ...ritual
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['tier', 'durationMinutes', 'expBonus'].includes(name);
        
        if (name === 'expBonus') {
            setFormData(prev => ({
                ...prev,
                stats: { ...prev.stats, expBonus: parseInt(value, 10) || 0 }
            }));
        } else {
             setFormData(prev => ({
                ...prev,
                [name]: isNumeric ? parseInt(value, 10) || 0 : value
            }));
        }
    };

    // --- Costs Management ---
    const handleCostChange = (index: number, key: 'type' | 'amount', value: string) => {
        const newCosts = [...(formData.cost || [])];
        if (key === 'amount') {
            newCosts[index].amount = parseInt(value, 10) || 0;
        } else {
            newCosts[index].type = value as EssenceType | 'gold';
        }
        setFormData(prev => ({ ...prev, cost: newCosts }));
    };

    const addCost = () => {
        setFormData(prev => ({
            ...prev,
            cost: [...(prev.cost || []), { type: 'gold', amount: 100 }]
        }));
    };

    const removeCost = (index: number) => {
        setFormData(prev => ({
            ...prev,
            cost: prev.cost?.filter((_, i) => i !== index)
        }));
    };

    // --- Stats Management ---
    const handleStatChange = (stat: keyof CharacterStats | 'expBonus', value: string) => {
        const numValue = parseFloat(value);
        setFormData(prev => {
            const newStats = { ...(prev.stats || {}) };
            if (isNaN(numValue) || numValue === 0) {
                delete (newStats as any)[stat];
            } else {
                (newStats as any)[stat] = numValue;
            }
            return { ...prev, stats: newStats };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert('Nazwa rytuału jest wymagana.');
            return;
        }
        onSave(formData as Ritual);
    };

    // Helper for stat inputs
    const StatInput = ({ label, statKey, isPercentage = false }: { label: string, statKey: keyof CharacterStats | 'expBonus', isPercentage?: boolean }) => (
        <div className="flex flex-col">
            <label className="text-xs text-gray-400 mb-1">{label}</label>
            <div className="relative">
                <input 
                    type="number" 
                    step={isPercentage ? "0.1" : "1"}
                    value={(formData.stats as any)?.[statKey] || ''} 
                    onChange={e => handleStatChange(statKey, e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded p-1.5 text-sm"
                    placeholder="0"
                />
                {isPercentage && <span className="absolute right-2 top-1.5 text-gray-500 text-xs">%</span>}
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h3 className="text-xl font-bold text-fuchsia-400">{isEditing ? 'Edytuj Rytuał' : 'Stwórz Rytuał'}</h3>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.general.name')}</label>
                    <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded p-2" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Poziom Wtajemniczenia (1-5)</label>
                    <select name="tier" value={formData.tier} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded p-2">
                        {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('admin.general.description')}</label>
                    <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Czas Trwania (minuty)</label>
                    <input type="number" name="durationMinutes" value={formData.durationMinutes || 0} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded p-2" />
                    <p className="text-xs text-gray-500 mt-1">Przykład: 1440 = 24h, 2880 = 48h</p>
                </div>
            </div>

            {/* Costs */}
            <fieldset className="border border-slate-700 rounded-lg p-4 bg-slate-800/20">
                <legend className="px-2 text-sm font-bold text-amber-400">Koszt Rytuału</legend>
                <div className="space-y-2">
                    {(formData.cost || []).map((cost, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <select 
                                value={cost.type} 
                                onChange={e => handleCostChange(idx, 'type', e.target.value)} 
                                className="bg-slate-700 border border-slate-600 rounded p-1.5 text-sm flex-grow"
                            >
                                <option value="gold">{t('resources.gold')}</option>
                                {Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}
                            </select>
                            <input 
                                type="number" 
                                value={cost.amount} 
                                onChange={e => handleCostChange(idx, 'amount', e.target.value)} 
                                className="w-24 bg-slate-700 border border-slate-600 rounded p-1.5 text-sm" 
                                placeholder="Ilość"
                            />
                            <button type="button" onClick={() => removeCost(idx)} className="text-red-400 hover:text-red-300"><MinusCircleIcon className="h-5 w-5"/></button>
                        </div>
                    ))}
                    <button type="button" onClick={addCost} className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300 mt-2">
                        <PlusCircleIcon className="h-4 w-4"/> Dodaj koszt
                    </button>
                </div>
            </fieldset>

            {/* Bonuses */}
            <div className="space-y-4">
                <h4 className="font-bold text-gray-200 border-b border-slate-700 pb-1">Bonusy</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-full mb-2">
                         <h5 className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">Specjalne</h5>
                         <StatInput label="Bonus Doświadczenia (%)" statKey="expBonus" isPercentage />
                    </div>

                    <div className="col-span-full border-t border-slate-700/50 pt-2">
                         <h5 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">Atrybuty</h5>
                    </div>
                    <StatInput label={t('statistics.strength')} statKey="strength" />
                    <StatInput label={t('statistics.agility')} statKey="agility" />
                    <StatInput label={t('statistics.stamina')} statKey="stamina" />
                    <StatInput label={t('statistics.intelligence')} statKey="intelligence" />
                    <StatInput label={t('statistics.luck')} statKey="luck" />
                    <StatInput label={t('statistics.accuracy')} statKey="accuracy" />
                    <StatInput label={t('statistics.energy')} statKey="energy" />

                    <div className="col-span-full border-t border-slate-700/50 pt-2 mt-2">
                         <h5 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">Walka</h5>
                    </div>
                    <StatInput label={t('item.damageMin')} statKey="minDamage" />
                    <StatInput label={t('item.damageMax')} statKey="maxDamage" />
                    <StatInput label={t('statistics.armor')} statKey="armor" />
                    <StatInput label={t('statistics.critChance')} statKey="critChance" isPercentage />
                    <StatInput label={t('statistics.critDamageModifier')} statKey="critDamageModifier" isPercentage />
                    <StatInput label={t('item.magicDamageMin')} statKey="magicDamageMin" />
                    <StatInput label={t('item.magicDamageMax')} statKey="magicDamageMax" />
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-medium">
                    {t('admin.general.cancel')}
                </button>
                <button type="submit" className="px-6 py-2 rounded bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold shadow-lg shadow-fuchsia-900/20">
                    {t('admin.general.save')}
                </button>
            </div>
        </form>
    );
};
