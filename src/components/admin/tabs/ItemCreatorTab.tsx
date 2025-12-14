
import React, { useState, useMemo, useEffect } from 'react';
import { ItemTemplate, Affix, AdminCharacterInfo, ItemCategory, AffixType, ItemInstance } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';
import { ItemDetailsPanel } from '../../shared/ItemSlot';

interface ItemCreatorTabProps {
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
}

export const ItemCreatorTab: React.FC<ItemCreatorTabProps> = ({ itemTemplates, affixes }) => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<AdminCharacterInfo[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    
    const [category, setCategory] = useState<ItemCategory | 'all'>('all');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [selectedPrefixId, setSelectedPrefixId] = useState<string>('');
    const [selectedSuffixId, setSelectedSuffixId] = useState<string>('');
    const [upgradeLevel, setUpgradeLevel] = useState<number>(0);

    useEffect(() => {
        api.getAllCharacters().then(setUsers).catch(console.error);
    }, []);

    const filteredTemplates = useMemo(() => {
        return itemTemplates.filter(t => category === 'all' || t.category === category);
    }, [itemTemplates, category]);

    const selectedTemplate = useMemo(() => 
        itemTemplates.find(t => t.id === selectedTemplateId), 
    [itemTemplates, selectedTemplateId]);

    const validPrefixes = useMemo(() => {
        if (!selectedTemplate) return [];
        return affixes.filter(a => a.type === AffixType.Prefix && a.spawnChances[selectedTemplate.category]);
    }, [affixes, selectedTemplate]);

    const validSuffixes = useMemo(() => {
        if (!selectedTemplate) return [];
        return affixes.filter(a => a.type === AffixType.Suffix && a.spawnChances[selectedTemplate.category]);
    }, [affixes, selectedTemplate]);

    const previewItem: ItemInstance | null = useMemo(() => {
        if (!selectedTemplate) return null;
        return {
            uniqueId: 'preview',
            templateId: selectedTemplate.id,
            prefixId: selectedPrefixId || undefined,
            suffixId: selectedSuffixId || undefined,
            upgradeLevel: upgradeLevel,
            isBorrowed: false // Admin generated
        };
    }, [selectedTemplate, selectedPrefixId, selectedSuffixId, upgradeLevel]);

    const handleGiveItem = async () => {
        if (!selectedUserId || !selectedTemplateId) {
            alert('Wybierz użytkownika i przedmiot.');
            return;
        }

        try {
            await api.adminGiveItem(Number(selectedUserId), {
                templateId: selectedTemplateId,
                prefixId: selectedPrefixId || undefined,
                suffixId: selectedSuffixId || undefined,
                upgradeLevel: upgradeLevel
            });
            alert('Przedmiot wysłany!');
        } catch (e: any) {
            alert(e.message);
        }
    };
    
    // Helper to handle affix names which can be string or object
    const getAffixName = (affix: Affix) => {
        if (!affix.name) return 'Unnamed';
        if (typeof affix.name === 'string') return affix.name;
        return affix.name.masculine || 'Unnamed'; 
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-indigo-400">Kreator Przedmiotów</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Użytkownik</label>
                    <select 
                        className="w-full bg-slate-700 p-2 rounded border border-slate-600"
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(Number(e.target.value))}
                    >
                        <option value="">-- Wybierz Gracza --</option>
                        {users.map(u => (
                            <option key={u.user_id} value={u.user_id}>{u.name} (Lvl {u.level})</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Kategoria</label>
                    <select 
                        className="w-full bg-slate-700 p-2 rounded border border-slate-600"
                        value={category}
                        onChange={e => { setCategory(e.target.value as any); setSelectedTemplateId(''); }}
                    >
                        <option value="all">Wszystkie</option>
                        {Object.values(ItemCategory).map(c => <option key={c} value={c}>{t(`item.categories.${c}`)}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Szablon</label>
                    <select 
                        className="w-full bg-slate-700 p-2 rounded border border-slate-600"
                        value={selectedTemplateId}
                        onChange={e => { setSelectedTemplateId(e.target.value); setSelectedPrefixId(''); setSelectedSuffixId(''); }}
                    >
                        <option value="">-- Wybierz Przedmiot --</option>
                        {filteredTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.rarity})</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Prefiks</label>
                        <select 
                            className="w-full bg-slate-700 p-2 rounded border border-slate-600"
                            value={selectedPrefixId}
                            onChange={e => setSelectedPrefixId(e.target.value)}
                            disabled={!selectedTemplate}
                        >
                            <option value="">Brak</option>
                            {validPrefixes.map(p => <option key={p.id} value={p.id}>{getAffixName(p)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Sufiks</label>
                        <select 
                            className="w-full bg-slate-700 p-2 rounded border border-slate-600"
                            value={selectedSuffixId}
                            onChange={e => setSelectedSuffixId(e.target.value)}
                            disabled={!selectedTemplate}
                        >
                            <option value="">Brak</option>
                            {validSuffixes.map(s => <option key={s.id} value={s.id}>{getAffixName(s)}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Poziom Ulepszenia (+{upgradeLevel})</label>
                    <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        value={upgradeLevel} 
                        onChange={e => setUpgradeLevel(parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>

                <button 
                    onClick={handleGiveItem}
                    disabled={!previewItem || !selectedUserId}
                    className="w-full py-3 bg-green-700 hover:bg-green-600 rounded font-bold text-white disabled:bg-slate-700 disabled:text-gray-500"
                >
                    Wyślij Przedmiot
                </button>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-xl flex items-center justify-center border border-slate-700">
                {previewItem && selectedTemplate ? (
                    <ItemDetailsPanel 
                        item={previewItem} 
                        template={selectedTemplate} 
                        affixes={affixes} 
                    />
                ) : (
                    <p className="text-gray-500">Wybierz szablon, aby zobaczyć podgląd.</p>
                )}
            </div>
        </div>
    );
};
