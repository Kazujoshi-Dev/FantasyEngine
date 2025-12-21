
import React, { useState } from 'react';
import { GameData, Quest, QuestType, QuestCategory, EssenceType, ItemReward, ResourceReward, LootDrop, ItemRarity, RandomItemReward } from '../../../types';
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
    const [formData, setFormData] = useState<Partial<Quest>>({
        name: '',
        description: '',
        image: '',
        category: QuestCategory.Normal,
        locationIds: [],
        repeatable: 1,
        ...quest,
        objective: {
            type: QuestType.Kill,
            amount: 1,
            targetId: '',
            ...quest.objective
        },
        rewards: {
            gold: 0,
            experience: 0,
            itemRewards: [],
            randomItemRewards: [],
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
        const newObjective = { ...(formData.objective || { type: QuestType.Kill, amount: 0, targetId: '' }), [name]: isNumeric ? parseInt(value, 10) || 0 : value } as any;
        
        if (name === 'type') {
            newObjective.targetId = '';
        }
        setFormData(prev => ({ ...prev, objective: newObjective }));
    };

    const handleRewardsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const currentRewards = prev.rewards || { gold: 0, experience: 0, itemRewards: [], randomItemRewards: [], resourceRewards: [], lootTable: [] };
            return { 
                ...prev, 
                rewards: { 
                    ...currentRewards,
                    [name]: parseInt(value, 10) || 0 
                } 
            };
        });
    };

    const handleLocationToggle = (locId: string) => {
        setFormData(prev => {
            const currentLocs = prev.locationIds || [];
            const newLocs = currentLocs.includes(locId) 
                ? currentLocs.filter(id => id !== locId) 
                : [...currentLocs, locId];
            return { ...prev, locationIds: newLocs };
        });
    };

    // --- Item Rewards Handlers ---
    const handleItemRewardChange = (index: number, key: keyof ItemReward, value: any) => {
        setFormData(prev => {
             const rewardsList = [...(prev.rewards?.itemRewards || [])];
             rewardsList[index] = { ...rewardsList[index], [key]: value };
             return { ...prev, rewards: { ...prev.rewards!, itemRewards: rewardsList } };
        });
    };
    const addItemReward = () => setFormData(prev => ({
        ...prev,
        rewards: { ...prev.rewards!, itemRewards: [...(prev.rewards?.itemRewards || []), { templateId: '', quantity: 1 }] }
    }));
    const removeItemReward = (index: number) => setFormData(prev => ({
        ...prev,
        rewards: { ...prev.rewards!, itemRewards: prev.rewards?.itemRewards?.filter((_, i) => i !== index) || [] }
    }));

    // --- Random Item Rewards Handlers ---
    const handleRandomItemRewardChange = (index: number, key: keyof RandomItemReward, value: any) => {
        setFormData(prev => {
             const list = [...(prev.rewards?.randomItemRewards || [])];
             list[index] = { ...list[index], [key]: value };
             return { ...prev, rewards: { ...prev.rewards!, randomItemRewards: list } };
        });
    };
    const addRandomItemReward = () => setFormData(prev => ({
        ...prev,
        rewards: { ...prev.rewards!, randomItemRewards: [...(prev.rewards?.randomItemRewards || []), { rarity: ItemRarity.Common, quantity: 1 }] }
    }));
    const removeRandomItemReward = (index: number) => setFormData(prev => ({
        ...prev,
        rewards: { ...prev.rewards!, randomItemRewards: prev.rewards?.randomItemRewards?.filter((_, i) => i !== index) || [] }
    }));

    // --- Resource Rewards Handlers ---
    const handleResourceRewardChange = (index: number, key: keyof ResourceReward, value: any) => {
         setFormData(prev => {
             const list = [...(prev.rewards?.resourceRewards || [])];
             list[index] = { ...list[index], [key]: value };
             return { ...prev, rewards: { ...prev.rewards!, resourceRewards: list } };
        });
    };
    const addResourceReward = () => setFormData(prev => ({
        ...prev,
        rewards: { ...prev.rewards!, resourceRewards: [...(prev.rewards?.resourceRewards || []), { resource: EssenceType.Common, quantity: 1 }] }
    }));
    const removeResourceReward = (index: number) => setFormData(prev => ({
        ...prev,
        rewards: { ...prev.rewards!, resourceRewards: prev.rewards?.resourceRewards?.filter((_, i) => i !== index) || [] }
    }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return alert('Nazwa jest wymagana.');
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
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-6 overflow-y-auto max-h-[80vh]">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? 'Edytuj Zadanie' : 'Stwórz Zadanie'}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="md:col-span-2"><label className="text-sm font-bold text-gray-400">Nazwa:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                 <div><label className="text-sm font-bold text-gray-400">Kategoria:<select name="category" value={formData.category} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(QuestCategory).map(c => <option key={c} value={c}>{c}</option>)}</select></label></div>
                 
                 <div className="md:col-span-2">
                    <label className="text-sm font-bold text-gray-400">URL Grafiki:
                        <input name="image" value={formData.image || ''} onChange={handleChange} placeholder="https://..." className="w-full bg-slate-700 p-2 rounded-md mt-1" />
                    </label>
                 </div>
                 <div>
                    <label className="text-sm font-bold text-gray-400">Limit Powtórzeń (0=∞):
                        <input name="repeatable" type="number" value={formData.repeatable ?? 1} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" />
                    </label>
                 </div>

                 {formData.image && (
                    <div className="md:col-span-3">
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Podgląd Grafiki:</p>
                        <div className="w-full h-32 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                            <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                    </div>
                 )}

                 <div className="md:col-span-3"><label className="text-sm font-bold text-gray-400">Opis:<textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" rows={2}/></label></div>
            </div>

            <fieldset className="border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-bold text-sky-400">Dostępność w Lokacjach</legend>
                <p className="text-[10px] text-gray-500 mb-3 italic">Jeśli nie wybierzesz żadnej lokacji, zadanie będzie dostępne wszędzie.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {gameData.locations.map(loc => (
                        <label key={loc.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1 rounded transition-colors">
                            <input 
                                type="checkbox" 
                                checked={formData.locationIds?.includes(loc.id)} 
                                onChange={() => handleLocationToggle(loc.id)}
                                className="rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-300">{loc.name}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md border-slate-700">
                <legend className="px-2 font-bold text-indigo-300">Cel Zadania</legend>
                <div><label className="text-xs text-gray-400">Typ:<select name="type" value={formData.objective?.type || ''} onChange={handleObjectiveChange} className="w-full bg-slate-700 p-2 rounded-md mt-1">{Object.values(QuestType).map(t => <option key={t} value={t}>{t}</option>)}</select></label></div>
                {formData.objective?.type !== QuestType.PayGold && <div><label className="text-xs text-gray-400">Cel:<select name="targetId" value={formData.objective?.targetId || ''} onChange={handleObjectiveChange} className="w-full bg-slate-700 p-2 rounded-md mt-1"><option value="">-- Wybierz --</option>{getTargetOptions()}</select></label></div>}
                <div><label className="text-xs text-gray-400">Ilość:<input name="amount" type="number" value={formData.objective?.amount || 0} onChange={handleObjectiveChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
            </fieldset>

            <fieldset className="border p-4 rounded-md border-slate-700 space-y-4">
                <legend className="px-2 font-bold text-green-400">Nagrody</legend>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-gray-400">Złoto:<input name="gold" type="number" value={formData.rewards?.gold || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                    <div><label className="text-xs text-gray-400">XP:<input name="experience" type="number" value={formData.rewards?.experience || 0} onChange={handleRewardsChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-sm font-bold text-gray-300">Konkretne Przedmioty</h4>
                    {(formData.rewards?.itemRewards || []).map((reward, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <select value={reward.templateId} onChange={e => handleItemRewardChange(index, 'templateId', e.target.value)} className="flex-grow bg-slate-700 p-1.5 rounded-md text-sm">{gameData.itemTemplates.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select>
                            <input type="number" value={reward.quantity} onChange={e => handleItemRewardChange(index, 'quantity', parseInt(e.target.value))} className="w-20 bg-slate-700 p-1.5 rounded-md text-sm" />
                            <button type="button" onClick={() => removeItemReward(index)} className="px-2 py-1.5 rounded bg-red-800 text-xs font-bold">X</button>
                        </div>
                    ))}
                    <button type="button" onClick={addItemReward} className="text-xs font-bold text-indigo-400">+ Dodaj Przedmiot</button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                    <h4 className="text-sm font-bold text-amber-400">Losowe Przedmioty (Loot Box)</h4>
                    {(formData.rewards?.randomItemRewards || []).map((reward, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <select value={reward.rarity} onChange={e => handleRandomItemRewardChange(index, 'rarity', e.target.value as ItemRarity)} className="flex-grow bg-slate-700 p-1.5 rounded-md text-sm">{Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}</select>
                            <input type="number" value={reward.quantity} onChange={e => handleRandomItemRewardChange(index, 'quantity', parseInt(e.target.value))} className="w-20 bg-slate-700 p-1.5 rounded-md text-sm" />
                            <button type="button" onClick={() => removeRandomItemReward(index)} className="px-2 py-1.5 rounded bg-red-800 text-xs font-bold">X</button>
                        </div>
                    ))}
                    <button type="button" onClick={addRandomItemReward} className="text-xs font-bold text-amber-500">+ Dodaj Losowanie</button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                    <h4 className="text-sm font-bold text-gray-300">Esencje</h4>
                    {(formData.rewards?.resourceRewards || []).map((reward, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <select value={reward.resource} onChange={e => handleResourceRewardChange(index, 'resource', e.target.value as EssenceType)} className="flex-grow bg-slate-700 p-1.5 rounded-md text-sm">{Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}</select>
                            <input type="number" value={reward.quantity} onChange={e => handleResourceRewardChange(index, 'quantity', parseInt(e.target.value))} className="w-20 bg-slate-700 p-1.5 rounded-md text-sm" />
                            <button type="button" onClick={() => removeResourceReward(index)} className="px-2 py-1.5 rounded bg-red-800 text-xs font-bold">X</button>
                        </div>
                    ))}
                    <button type="button" onClick={addResourceReward} className="text-xs font-bold text-sky-400">+ Dodaj Esencję</button>
                </div>
            </fieldset>

            <div className="flex justify-end space-x-4 pt-4 sticky bottom-0 bg-slate-800 p-4 rounded-b-xl">
                <button type="button" onClick={onCancel} className="px-6 py-2 rounded-md bg-slate-600 hover:bg-slate-700 font-bold">Anuluj</button>
                <button type="submit" className="px-8 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 font-bold">Zapisz</button>
            </div>
        </form>
    );
};
