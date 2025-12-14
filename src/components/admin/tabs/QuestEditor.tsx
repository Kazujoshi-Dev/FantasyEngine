
import React, { useState } from 'react';
import { GameData, Quest, QuestType, EssenceType, ItemReward, ResourceReward, LootDrop } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface QuestEditorProps {
  quest: Partial<Quest>;
  onSave: (quest: Quest) => void;
  onCancel: () => void;
  isEditing: boolean;
  gameData: GameData;
}

export const QuestEditor: React.FC<QuestEditorProps> = ({ quest, onSave, onCancel, isEditing, gameData }) => {
    const { t } = useTranslation();
    // Initialize with robust defaults to prevent "undefined" errors later
    const [formData, setFormData] = useState<Partial<Quest>>({
        name: '',
        description: '',
        locationIds: [],
        repeatable: 1,
        ...quest,
        objective: {
            type: QuestType.Kill,
            amount: 1,
            ...quest.objective
        },
        rewards: {
            gold: 0,
            experience: 0,
            itemRewards: [],
            resourceRewards: [],
            lootTable: [],
            ...quest.rewards
        }
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['repeatable', 'amount', 'gold', 'experience'].includes(name);
        setFormData(prev => ({ ...prev, [name]: isNumeric ? parseInt(value, 10) || 0 : value }));
    };

    const handleObjectiveChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = name === 'amount';
        const newObjective = { ...(formData.objective || { type: QuestType.Kill, amount: 0 }), [name]: isNumeric ? parseInt(value, 10) || 0 : value };
        if (name === 'type') {
            delete newObjective.targetId;
        }
        setFormData(prev => ({ ...prev, objective: newObjective }));
    };

    const handleRewardsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, rewards: { ...(formData.rewards || {gold: 0, experience: 0}), [name]: parseInt(value, 10) || 0 } }));
    };

    const handleLocationChange = (locId: string) => {
        const currentLocs = formData.locationIds || [];
        const newLocs = currentLocs.includes(locId) ? currentLocs.filter(id => id !== locId) : [...currentLocs, locId];
        setFormData(prev => ({ ...prev, locationIds: newLocs }));
    };

    // --- Item Rewards Handlers ---
    const handleItemRewardChange = <K extends keyof ItemReward>(index: number, key: K, value: ItemReward[K]) => {
        const rewards = [...(formData.rewards?.itemRewards || [])];
        rewards[index] = { ...rewards[index], [key]: value };
        setFormData(prev => ({ ...prev, rewards: { ...(prev.rewards || { gold: 0, experience: 0 }), itemRewards: rewards } }));
    };
    const addItemReward = () => setFormData(prev => ({
        ...prev,
        rewards: {
            ...(prev.rewards || { gold: 0, experience: 0 }),
            itemRewards: [...(prev.rewards?.itemRewards || []), { templateId: '', quantity: 1 }]
        }
    }));
    
    const removeItemReward = (index: number) => setFormData(prev => ({ ...prev, rewards: { ...(prev.rewards || { gold: 0, experience: 0 }), itemRewards: prev.rewards?.itemRewards?.filter((_, i) => i !== index) } }));

    // --- Resource Rewards Handlers ---
    const handleResourceRewardChange = <K extends keyof ResourceReward>(index: number, key: K, value: ResourceReward[K]) => {
        const rewards = [...(formData.rewards?.resourceRewards || [])];
        rewards[index] = { ...rewards[index], [key]: value };
        setFormData(prev => ({ ...prev, rewards: { ...(prev.rewards || { gold: 0, experience: 0 }), resourceRewards: rewards } }));
    };
    const addResourceReward = () => setFormData(prev => ({
        ...prev,
        rewards: {
            ...(prev.rewards || { gold: 0, experience: 0 }),
            resourceRewards: [...(prev.rewards?.resourceRewards || []), { resource: EssenceType.Common, quantity: 1 }]
        }
    }));
    
    const removeResourceReward = (index: number) => setFormData(prev => ({ ...prev, rewards: { ...(prev.rewards || { gold: 0, experience: 0 }), resourceRewards: prev.rewards?.resourceRewards?.filter((_, i) => i !== index) } }));

    // --- Loot Table Handlers ---
    const handleLootChange = (index: number, key: keyof LootDrop, value: string) => {
        const lootTable = [...(formData.rewards?.lootTable || [])];
        (lootTable[index] as any)[key] = key === 'chance' ? parseInt(value, 10) || 0 : value;
        setFormData(prev => ({ ...prev, rewards: { ...(prev.rewards || { gold: 0, experience: 0 }), lootTable } }));
    };
    const addLoot = () => handleLootChange((formData.rewards?.lootTable || []).length, 'templateId', '');
    const removeLoot = (index: number) => setFormData(prev => ({ ...prev, rewards: { ...(prev.rewards || { gold: 0, experience: 0 }), lootTable: prev.rewards?.lootTable?.filter((_, i) => i !== index) } }));


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert(t('admin.quest.name') + ' jest wymagane.');
            return;
        }
        if (!formData.objective?.type) {
            alert(t('admin.quest.objectiveType') + ' jest wymagane.');
            return;
        }
        onSave(formData as Quest);
    };

    const getTargetOptions = () => {
        switch (formData.objective?.type) {
            case QuestType.Kill: return gameData.enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>);
            case QuestType.Gather: return gameData.itemTemplates.map(i => <option key={i.id} value={i.id}>{i.name}</option>);
            case QuestType.GatherResource: return Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>);
            default: return null;
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.quest.edit') : t('admin.quest.create')}</h3>
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><label>{t('admin.quest.name')}:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                 <div><label>{t('admin.quest.repeatable')}:<input name="repeatable" type="number" value={formData.repeatable ?? 1} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" title={t('admin.quest.repeatableDesc')!} /></label></div>
                 <div className="md:col-span-2"><label>{t('admin.general.description')}:<textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </div>
            <div><label className="block mb-2">{t('admin.expedition.availableIn')}:</label><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{gameData.locations.map(loc => <label key={loc.id} className="flex items-center gap-2"><input type="checkbox" checked={formData.locationIds?.includes(loc.id)} onChange={() => handleLocationChange(loc.id)} /> {loc.name}</label>)}</div></div>
            
            {/* Objective */}
            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.quest.objective')}</legend>
                <div><label>{t('admin.quest.objectiveType')}:<select name="type" value={formData.objective?.type || ''} onChange={handleObjectiveChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(QuestType).map(t => <option key={t} value={t}>{t}</option>)}</select></label></div>
                {formData.objective?.type !== QuestType.PayGold && <div><label>{t('admin.quest.target')}:<select name="targetId" value={formData.objective?.targetId || ''} onChange={handleObjectiveChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- Wybierz --</option>{getTargetOptions()}</select></label></div>}
                <div><label>{t('admin.quest.amount')}:<input name="amount" type="number" value={formData.objective?.amount || 0} onChange={handleObjectiveChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>

            {/* Rewards */}
            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-semibold">{t('admin.quest.rewards')}</legend>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><label>{t('resources.gold')}:<input name="gold" type="number" value={formData.rewards?.gold || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                    <div><label>XP:<input name="experience" type="number" value={formData.rewards?.experience || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                </div>
                {/* Item Rewards */}
                <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2">{t('admin.quest.itemRewards')}</h4>
                    {(formData.rewards?.itemRewards || []).map((reward, index) => (
                        <div key={index} className="flex gap-2 mb-2 items-center"><select value={reward.templateId} onChange={e => handleItemRewardChange(index, 'templateId', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md">{gameData.itemTemplates.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select><input type="number" value={reward.quantity || 1} onChange={e => handleItemRewardChange(index, 'quantity', parseInt(e.target.value))} className="w-24 bg-slate-700 p-1 rounded-md" /><button type="button" onClick={() => removeItemReward(index)} className="px-2 py-1 text-xs rounded bg-red-800">X</button></div>
                    ))}
                    <button type="button" onClick={addItemReward} className="px-2 py-1 text-xs rounded bg-sky-700">+</button>
                </div>
                {/* Resource Rewards */}
                <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2">{t('admin.quest.resourceRewards')}</h4>
                    {(formData.rewards?.resourceRewards || []).map((reward, index) => (
                        <div key={index} className="flex gap-2 mb-2 items-center"><select value={reward.resource} onChange={e => handleResourceRewardChange(index, 'resource', e.target.value as EssenceType)} className="w-full bg-slate-700 p-1 rounded-md">{Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}</select><input type="number" value={reward.quantity || 1} onChange={e => handleResourceRewardChange(index, 'quantity', parseInt(e.target.value))} className="w-24 bg-slate-700 p-1 rounded-md" /><button type="button" onClick={() => removeResourceReward(index)} className="px-2 py-1 text-xs rounded bg-red-800">X</button></div>
                    ))}
                    <button type="button" onClick={addResourceReward} className="px-2 py-1 text-xs rounded bg-sky-700">+</button>
                </div>
                 {/* Loot Table */}
                <div>
                     <h4 className="font-semibold text-sm mb-2">{t('admin.lootTable')}</h4>
                    {(formData.rewards?.lootTable || []).map((loot, index) => (
                         <div key={index} className="flex items-center gap-2 mb-2"><select value={loot.templateId} onChange={e => handleLootChange(index, 'templateId', e.target.value)} className="w-full bg-slate-700 p-1 rounded-md"><option value="">-- {t('admin.select')} --</option>{gameData.itemTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><input type="number" placeholder="Szansa %" value={loot.chance} onChange={e => handleLootChange(index, 'chance', e.target.value)} className="w-32 bg-slate-700 p-1 rounded-md" /><button type="button" onClick={() => removeLoot(index)} className="px-2 py-1 text-xs rounded bg-red-800">X</button></div>
                    ))}
                    <button type="button" onClick={addLoot} className="px-2 py-1 text-xs rounded bg-sky-700">+</button>
                </div>
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};
