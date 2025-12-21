
import React, { useState, useMemo } from 'react';
import { GameData, ItemSet, ItemSetTier, CharacterStats, Affix } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { PlusCircleIcon } from '../../icons/PlusCircleIcon';
import { MinusCircleIcon } from '../../icons/MinusCircleIcon';

interface ItemSetsTabProps {
    gameData: GameData;
    onGameDataUpdate: (key: string, data: any) => void;
}

export const ItemSetsTab: React.FC<ItemSetsTabProps> = ({ gameData, onGameDataUpdate }) => {
    const { t } = useTranslation();
    const [editingSet, setEditingSet] = useState<Partial<ItemSet> | null>(null);
    const sets = gameData.itemSets || [];
    const affixes = gameData.affixes || [];

    const getAffixDisplayName = (affix: Affix | undefined): string => {
        if (!affix || !affix.name) return 'Nieznany afiks';
        if (typeof affix.name === 'string') return affix.name;
        return affix.name.masculine || 'Brak nazwy';
    };

    const handleSave = (set: ItemSet) => {
        let updated = [...sets];
        const index = updated.findIndex(s => s.id === set.id);
        if (index > -1) updated[index] = set;
        else updated.push(set);
        onGameDataUpdate('itemSets', updated);
        setEditingSet(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Usunąć zestaw?')) return;
        onGameDataUpdate('itemSets', sets.filter(s => s.id !== id));
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-emerald-400">Zestawy Przedmiotów</h3>
                <button 
                    onClick={() => setEditingSet({ id: crypto.randomUUID(), name: '', affixId: '', tiers: [] })}
                    className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded font-bold text-white shadow-lg"
                >
                    Dodaj Zestaw
                </button>
            </div>

            {editingSet ? (
                <ItemSetEditor 
                    set={editingSet} 
                    affixes={affixes} 
                    onSave={handleSave} 
                    onCancel={() => setEditingSet(null)} 
                    getAffixDisplayName={getAffixDisplayName}
                />
            ) : (
                <div className="space-y-4">
                    {sets.map(set => (
                        <div key={set.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                            <div>
                                <h4 className="text-lg font-bold text-white">{set.name}</h4>
                                <p className="text-sm text-gray-400">
                                    Kotwica: <span className="text-sky-400">
                                        {getAffixDisplayName(affixes.find(a => a.id === set.affixId))}
                                    </span>
                                </p>
                                <p className="text-xs text-gray-500">{set.tiers.length} Progi bonusowe</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingSet(set)} className="px-3 py-1 bg-sky-700 hover:bg-sky-600 rounded text-sm font-bold">Edytuj</button>
                                <button onClick={() => handleDelete(set.id)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm font-bold">Usuń</button>
                            </div>
                        </div>
                    ))}
                    {sets.length === 0 && <p className="text-gray-500 text-center py-10 italic">Brak zdefiniowanych zestawów.</p>}
                </div>
            )}
        </div>
    );
};

interface ItemSetEditorProps {
    set: Partial<ItemSet>;
    affixes: Affix[];
    onSave: (s: ItemSet) => void;
    onCancel: () => void;
    getAffixDisplayName: (a: Affix | undefined) => string;
}

const ItemSetEditor: React.FC<ItemSetEditorProps> = ({ set, affixes, onSave, onCancel, getAffixDisplayName }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<ItemSet>({
        id: set.id || crypto.randomUUID(),
        name: set.name || '',
        affixId: set.affixId || '',
        tiers: set.tiers || []
    });

    const addTier = () => {
        setFormData(prev => ({
            ...prev,
            tiers: [...prev.tiers, { requiredPieces: 2, bonuses: {} }]
        }));
    };

    const updateTier = (idx: number, updates: Partial<ItemSetTier>) => {
        setFormData(prev => {
            const newTiers = [...prev.tiers];
            newTiers[idx] = { ...newTiers[idx], ...updates };
            return { ...prev, tiers: newTiers };
        });
    };

    const handleBonusChange = (tierIdx: number, key: string, val: string) => {
        const numVal = parseFloat(val);
        setFormData(prev => {
            const newTiers = [...prev.tiers];
            const newBonuses = { ...newTiers[tierIdx].bonuses };
            if (isNaN(numVal) || numVal === 0) delete (newBonuses as any)[key];
            else (newBonuses as any)[key] = numVal;
            newTiers[tierIdx].bonuses = newBonuses;
            return { ...prev, tiers: newTiers };
        });
    };

    const sortedAffixes = useMemo(() => {
        return [...affixes].sort((a, b) => 
            getAffixDisplayName(a).localeCompare(getAffixDisplayName(b))
        );
    }, [affixes, getAffixDisplayName]);

    const attributeKeys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];
    const vitalKeys: (keyof CharacterStats)[] = ['maxHealth', 'maxMana', 'manaRegen']; // NOWE
    const combatKeys: (keyof CharacterStats)[] = ['armor', 'critChance', 'critDamageModifier', 'dodgeChance', 'attacksPerRound'];
    const weaponKeys: (keyof CharacterStats)[] = ['minDamage', 'maxDamage', 'magicDamageMin', 'magicDamageMax'];
    const specialtyKeys: (keyof CharacterStats)[] = ['armorPenetrationPercent', 'armorPenetrationFlat', 'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent', 'manaStealFlat'];
    
    const setPercentKeys = [
        { key: 'expBonusPercent', label: 'Bonus EXP (%)' },
        { key: 'goldBonusPercent', label: 'Bonus Złota (%)' },
        { key: 'damageBonusPercent', label: 'Bonus Obrażeń (%)' },
        { key: 'damageReductionPercent', label: 'Redukcja Obrażeń (%)' }
    ];

    const getLabel = (k: string) => {
        const statsLabel = t(`statistics.${k}` as any);
        if (!statsLabel.includes('statistics.')) return statsLabel;
        const itemLabel = t(`item.${k}` as any);
        if (!itemLabel.includes('item.')) return itemLabel;
        return k;
    };

    const renderInput = (idx: number, k: string) => (
        <div key={k}>
            <label className="block text-[10px] text-gray-500 truncate" title={getLabel(k)}>{getLabel(k)}</label>
            <input type="number" step="0.1" className="w-full bg-slate-900 p-1 rounded text-xs text-indigo-300" value={(formData.tiers[idx].bonuses as any)[k] || ''} onChange={e => handleBonusChange(idx, k, e.target.value)} />
        </div>
    );

    return (
        <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-700 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Nazwa Zestawu</label>
                    <input className="w-full bg-slate-800 p-2 rounded border border-slate-600 text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Afiks Kotwiczący (Zestawowy)</label>
                    <select className="w-full bg-slate-800 p-2 rounded border border-slate-600 text-white" value={formData.affixId} onChange={e => setFormData({...formData, affixId: e.target.value})}>
                        <option value="">Wybierz afiks...</option>
                        {sortedAffixes.map(a => (
                            <option key={a.id} value={a.id}>
                                {getAffixDisplayName(a)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                    <h4 className="font-bold text-gray-300">Progi i Bonusy</h4>
                    <button onClick={addTier} className="text-xs bg-indigo-600 px-2 py-1 rounded hover:bg-indigo-500 font-bold text-white">+ Dodaj Próg</button>
                </div>

                {formData.tiers.map((tier, idx) => (
                    <div key={idx} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative">
                        <button 
                            onClick={() => setFormData({...formData, tiers: formData.tiers.filter((_, i) => i !== idx)})}
                            className="absolute top-2 right-2 text-red-500 hover:text-red-400"
                        ><MinusCircleIcon className="h-5 w-5"/></button>

                        <div className="flex items-center gap-4 mb-4">
                            <label className="text-sm font-bold text-emerald-400">Wymagane części:</label>
                            <input type="number" min="2" max="12" className="w-16 bg-slate-900 p-1 rounded text-white text-center font-bold" value={tier.requiredPieces} onChange={e => updateTier(idx, {requiredPieces: parseInt(e.target.value)})} />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            <div className="col-span-full text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-700/50 mb-1">Atrybuty</div>
                            {attributeKeys.map(k => renderInput(idx, k))}

                            <div className="col-span-full text-[10px] font-black text-green-400 uppercase tracking-widest border-b border-slate-700/50 mt-2 mb-1">Statystyki Witalne</div>
                            {vitalKeys.map(k => renderInput(idx, k))}

                            <div className="col-span-full text-[10px] font-black text-sky-400 uppercase tracking-widest border-b border-slate-700/50 mt-2 mb-1">Statystyki Bojowe</div>
                            {combatKeys.map(k => renderInput(idx, k))}

                            <div className="col-span-full text-[10px] font-black text-red-400 uppercase tracking-widest border-b border-slate-700/50 mt-2 mb-1">Parametry Broni</div>
                            {weaponKeys.map(k => renderInput(idx, k))}

                            <div className="col-span-full text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-700/50 mt-2 mb-1">Efekty Specjalne</div>
                            {specialtyKeys.map(k => renderInput(idx, k))}

                            <div className="col-span-full text-[10px] font-black text-amber-400 uppercase tracking-widest border-b border-slate-700/50 mt-2 mb-1">Bonusy Zestawowe (%)</div>
                            {setPercentKeys.map(s => (
                                <div key={s.key}>
                                    <label className="block text-[10px] text-gray-500 truncate">{s.label}</label>
                                    <input type="number" step="1" className="w-full bg-slate-900 p-1 rounded text-xs text-amber-300 font-bold" value={(tier.bonuses as any)[s.key] || ''} onChange={e => handleBonusChange(idx, s.key, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button onClick={onCancel} className="px-4 py-2 bg-slate-700 rounded text-white font-bold">Anuluj</button>
                <button onClick={() => onSave(formData)} className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-white font-bold shadow-lg">Zapisz Zestaw</button>
            </div>
        </div>
    );
};
