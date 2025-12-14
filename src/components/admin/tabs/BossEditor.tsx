


import React, { useState } from 'react';
import { Enemy, ItemTemplate, LootDrop, ResourceDrop, EssenceType, MagicAttackType, EnemyStats, SpecialAttackType, BossSpecialAttack } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface BossEditorProps {
  boss: Partial<Enemy>;
  onSave: (enemy: Enemy) => void;
  onCancel: () => void;
  isEditing: boolean;
  allItemTemplates: ItemTemplate[];
}

export const BossEditor: React.FC<BossEditorProps> = ({ boss, onSave, onCancel, isEditing, allItemTemplates }) => {
    const { t } = useTranslation();

    const specialAttackDescriptions: Record<SpecialAttackType, string> = {
        [SpecialAttackType.Stun]: t('specialAttacks.StunDesc'),
        [SpecialAttackType.ArmorPierce]: t('specialAttacks.ArmorPierceDesc'),
        [SpecialAttackType.DeathTouch]: t('specialAttacks.DeathTouchDesc'),
        [SpecialAttackType.EmpoweredStrikes]: t('specialAttacks.EmpoweredStrikesDesc'),
        [SpecialAttackType.Earthquake]: t('specialAttacks.EarthquakeDesc'),
    };

    const [formData, setFormData] = useState<Partial<Enemy>>(() => {
        const defaultStats: EnemyStats = {
            maxHealth: 100,
            minDamage: 10,
            maxDamage: 20,
            armor: 10,
            critChance: 10,
            critDamageModifier: 200,
            agility: 10,
            dodgeChance: 0,
            maxMana: 50,
            manaRegen: 5,
            magicDamageMin: 0,
            magicDamageMax: 0,
            magicAttackChance: 0,
            magicAttackManaCost: 0,
            attacksPerTurn: 1,
            armorPenetrationPercent: 0,
            armorPenetrationFlat: 0
        };
        return {
            lootTable: [],
            resourceLootTable: [],
            specialAttacks: [],
            isBoss: true, // Forced
            isGuildBoss: false,
            ...boss,
            rewards: boss.rewards || { minGold: 100, maxGold: 200, minExperience: 100, maxExperience: 200 },
            stats: { ...defaultStats, ...boss.stats },
        };
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const isNumeric = ['preparationTimeSeconds'].includes(name);
        
        setFormData(prev => ({ 
            ...prev, 
            [name]: isCheckbox ? (e.target as HTMLInputElement).checked : (isNumeric ? parseInt(value, 10) || 0 : value) 
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
    
    const handleSpecialAttackChange = (index: number, key: keyof BossSpecialAttack, value: string | number) => {
        const updatedAttacks = [...(formData.specialAttacks || [])];
        (updatedAttacks[index] as any)[key] = typeof value === 'string' ? value : (parseInt(String(value), 10) || 0);
        setFormData(prev => ({ ...prev, specialAttacks: updatedAttacks }));
    };

    const addSpecialAttack = () => setFormData(prev => ({ ...prev, specialAttacks: [...(prev.specialAttacks || []), { type: SpecialAttackType.Stun, chance: 10, uses: 1 }] }));
    const removeSpecialAttack = (index: number) => setFormData(prev => ({ ...prev, specialAttacks: prev.specialAttacks?.filter((_, i) => i !== index) }));


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert(t('admin.enemy.nameRequired'));
            return;
        }
        onSave(formData as Enemy);
    };

    const getImageUrl = (url: string | undefined): string | undefined => {
        if (!url) return undefined;
        if (url.startsWith('http') || url.startsWith('/api/uploads/')) return url;
        const uploadsIndex = url.indexOf('uploads/');
        if (uploadsIndex > -1) {
            return `/api/${url.substring(uploadsIndex)}`;
        }
        return url;
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-amber-400">{isEditing ? 'Edytuj Bossa' : 'Stwórz Bossa'}</h3>
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div><label>{t('admin.general.name')}:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                    <div><label>{t('admin.general.description')}:<textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                    
                    <div className="flex items-center space-x-2 mt-2">
                        <input
                            type="checkbox"
                            id="isGuildBoss"
                            name="isGuildBoss"
                            checked={formData.isGuildBoss || false}
                            onChange={handleChange}
                            className="form-checkbox h-5 w-5 text-purple-600 rounded bg-slate-700 border-slate-600"
                        />
                        <label htmlFor="isGuildBoss" className="font-bold text-purple-400">Boss Gildyjny</label>
                    </div>

                    <div>
                        <label>Czas przygotowania (sekundy):
                            <input name="preparationTimeSeconds" type="number" value={formData.preparationTimeSeconds ?? 30} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Czas odliczany od momentu zebrania pełnej grupy do startu walki.</p>
                    </div>

                    {/* Image URL */}
                    <div>
                         <label className="block text-sm font-medium text-gray-300 mb-1">Portret Bossa (URL)</label>
                         <input
                            type="text"
                            name="image"
                            value={formData.image || ''}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
                            placeholder="https://example.com/image.png"
                        />
                        {formData.image && (
                            <div className="mt-2">
                                <p className="text-xs text-gray-400 mb-1">Podgląd:</p>
                                <img src={getImageUrl(formData.image)} alt="Boss Portrait" className="w-32 h-32 object-cover rounded-lg border border-amber-700/50" />
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="space-y-4">
                     {/* Stats */}
                    <fieldset className="grid grid-cols-2 gap-4 border p-4 rounded-md border-slate-700">
                        <legend className="px-2 font-semibold">Statystyki Bossa</legend>
                        <div><label>Max HP:<input name="maxHealth" type="number" value={formData.stats?.maxHealth || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Pancerz:<input name="armor" type="number" value={formData.stats?.armor || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Min Dmg:<input name="minDamage" type="number" value={formData.stats?.minDamage || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Max Dmg:<input name="maxDamage" type="number" value={formData.stats?.maxDamage || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Szansa Kryt. (%):<input name="critChance" type="number" step="0.1" value={formData.stats?.critChance || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Modyfikator Kryt (%):<input name="critDamageModifier" type="number" value={formData.stats?.critDamageModifier || 150} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Zręczność:<input name="agility" type="number" value={formData.stats?.agility || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Szansa na Unik (%):<input name="dodgeChance" type="number" step="0.1" value={formData.stats?.dodgeChance ?? 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Ataki/turę:<input name="attacksPerTurn" type="number" step="0.1" value={formData.stats?.attacksPerTurn || 1} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Penetracja Pancerza (%):<input name="armorPenetrationPercent" type="number" step="0.1" value={formData.stats?.armorPenetrationPercent || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                        <div><label>Penetracja Pancerza (Flat):<input name="armorPenetrationFlat" type="number" value={formData.stats?.armorPenetrationFlat || 0} onChange={handleStatsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                    </fieldset>
                </div>
            </div>

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
            
            {/* Special Attacks */}
            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">Ataki Specjalne</legend>
                 {(formData.specialAttacks || []).map((attack, index) => (
                     <div key={index} className="p-3 bg-slate-800/50 rounded-md mb-3 border border-slate-700/50">
                        <div className="flex items-end gap-4">
                            <div className="flex-grow">
                                <label className="block text-xs font-medium text-gray-400 mb-1">{t('admin.bossEditor.attackType')}</label>
                                <select value={attack.type} onChange={e => handleSpecialAttackChange(index, 'type', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md">
                                    {Object.values(SpecialAttackType).map(type => <option key={type} value={type}>{t(`specialAttacks.${type}`)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">{t('admin.bossEditor.chance')}</label>
                                <input type="number" value={attack.chance} onChange={e => handleSpecialAttackChange(index, 'chance', e.target.value)} className="w-24 bg-slate-700 p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">{t('admin.bossEditor.uses')}</label>
                                <input type="number" value={attack.uses} onChange={e => handleSpecialAttackChange(index, 'uses', e.target.value)} className="w-24 bg-slate-700 p-2 rounded-md" />
                            </div>
                            <button type="button" onClick={() => removeSpecialAttack(index)} className="px-3 py-2 text-sm rounded bg-red-800 hover:bg-red-700 self-end">X</button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">{specialAttackDescriptions[attack.type]}</p>
                    </div>
                ))}
                <button type="button" onClick={addSpecialAttack} className="px-3 py-1 text-sm rounded bg-sky-700 hover:bg-sky-600">+</button>
            </fieldset>

            {/* Rewards */}
            <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">Nagrody (Dla całej grupy)</legend>
                <div><label>Min Złota:<input name="minGold" type="number" value={formData.rewards?.minGold || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Max Złota:<input name="maxGold" type="number" value={formData.rewards?.maxGold || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Min EXP:<input name="minExperience" type="number" value={formData.rewards?.minExperience || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>Max EXP:<input name="maxExperience" type="number" value={formData.rewards?.maxExperience || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>
            
            {/* Loot */}
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