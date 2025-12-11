
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
    const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [selectedPrefixId, setSelectedPrefixId] = useState<string>('');
    const [selectedSuffixId, setSelectedSuffixId] = useState<string>('');
    const [upgradeLevel, setUpgradeLevel] = useState<number>(0);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // Get characters instead of raw users for clearer naming (char name vs username)
                const data = await api.getAllCharacters();
                setUsers(data);
            } catch (e) {
                console.error("Failed to fetch users for item creator", e);
            }
        };
        fetchUsers();
    }, []);

    // Filter templates by category
    const filteredTemplates = useMemo(() => {
        return itemTemplates.filter(t => selectedCategory === 'all' || t.category === selectedCategory)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [itemTemplates, selectedCategory]);

    // ... (rest of the logic remains the same, just removed users prop)
    const selectedTemplate = itemTemplates.find(t => t.id === selectedTemplateId);
    
    const allowedAffixes = useMemo(() => {
        if (!selectedTemplate) return affixes;
        return affixes.filter(a => a.spawnChances && a.spawnChances[selectedTemplate.category] && a.spawnChances[selectedTemplate.category]! > 0);
    }, [affixes, selectedTemplate]);

    const prefixes = useMemo(() => allowedAffixes.filter(a => a.type === AffixType.Prefix), [allowedAffixes]);
    const suffixes = useMemo(() => allowedAffixes.filter(a => a.type === AffixType.Suffix), [allowedAffixes]);

    const previewItem = useMemo<ItemInstance | null>(() => {
        if (!selectedTemplateId) return null;
        
        const mockRolledStats = (source: any) => {
            const rolled: any = {};
            const getMax = (val: any) => typeof val === 'object' ? val.max : val;
            const keys = [
                'damageMin', 'damageMax', 'armorBonus', 'critChanceBonus', 'maxHealthBonus', 
                'critDamageModifierBonus', 'armorPenetrationPercent', 'armorPenetrationFlat', 
                'lifeStealPercent', 'lifeStealFlat', 'manaStealPercent', 'manaStealFlat', 
                'magicDamageMin', 'magicDamageMax', 'attacksPerRoundBonus', 'dodgeChanceBonus'
            ];
            keys.forEach(key => { if (source[key] !== undefined) rolled[key] = getMax(source[key]); });
            if (source.statsBonus) {
                rolled.statsBonus = {};
                Object.keys(source.statsBonus).forEach(k => { rolled.statsBonus[k] = getMax(source.statsBonus[k]); });
            }
            return rolled;
        };

        const rolledBase = selectedTemplate ? mockRolledStats(selectedTemplate) : undefined;
        const prefix = affixes.find(a => a.id === selectedPrefixId);
        const suffix = affixes.find(a => a.id === selectedSuffixId);
        const rolledPrefix = prefix ? mockRolledStats(prefix) : undefined;
        const rolledSuffix = suffix ? mockRolledStats(suffix) : undefined;

        return {
            uniqueId: 'preview',
            templateId: selectedTemplateId,
            prefixId: selectedPrefixId || undefined,
            suffixId: selectedSuffixId || undefined,
            upgradeLevel: upgradeLevel,
            rolledBaseStats: rolledBase,
            rolledPrefix: rolledPrefix,
            rolledSuffix: rolledSuffix
        };
    }, [selectedTemplateId, selectedPrefixId, selectedSuffixId, upgradeLevel, itemTemplates, affixes, selectedTemplate]);

    const handleSend = async () => {
        if (!selectedUserId || !selectedTemplateId) {
            alert('Wybierz gracza i przedmiot.');
            return;
        }

        setIsSending(true);
        try {
            await api.adminGiveItem(Number(selectedUserId), {
                templateId: selectedTemplateId,
                prefixId: selectedPrefixId || undefined,
                suffixId: selectedSuffixId || undefined,
                upgradeLevel
            });
            alert('Przedmiot wysłany pomyślnie!');
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">Kreator Przedmiotów</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4 bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Gracz</label>
                        <select 
                            value={selectedUserId} 
                            onChange={e => setSelectedUserId(Number(e.target.value))} 
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                        >
                            <option value="">-- Wybierz gracza --</option>
                            {users.map(u => (
                                <option key={u.user_id} value={u.user_id}>{u.name} ({u.username})</option>
                            ))}
                        </select>
                    </div>

                    <div className="border-t border-slate-700 pt-4"></div>

                    <div className="flex gap-2">
                         <div className="w-1/3">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Kategoria</label>
                            <select 
                                value={selectedCategory} 
                                onChange={e => { setSelectedCategory(e.target.value as any); setSelectedTemplateId(''); }} 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                            >
                                <option value="all">Wszystkie</option>
                                {Object.values(ItemCategory).map(c => <option key={c} value={c}>{t(`item.categories.${c}`)}</option>)}
                            </select>
                        </div>
                        <div className="w-2/3">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Baza Przedmiotu</label>
                            <select 
                                value={selectedTemplateId} 
                                onChange={e => { setSelectedTemplateId(e.target.value); setSelectedPrefixId(''); setSelectedSuffixId(''); }} 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                            >
                                <option value="">-- Wybierz bazę --</option>
                                {filteredTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.rarity})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Prefiks</label>
                            <select 
                                value={selectedPrefixId} 
                                onChange={e => setSelectedPrefixId(e.target.value)} 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                                disabled={!selectedTemplateId}
                            >
                                <option value="">-- Brak --</option>
                                {prefixes.map(p => (
                                    <option key={p.id} value={p.id}>{p.name.masculine}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-300 mb-1">Sufiks</label>
                            <select 
                                value={selectedSuffixId} 
                                onChange={e => setSelectedSuffixId(e.target.value)} 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                                disabled={!selectedTemplateId}
                            >
                                <option value="">-- Brak --</option>
                                {suffixes.map(s => (
                                    <option key={s.id} value={s.id}>{s.name.masculine}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Ulepszenie (+{upgradeLevel})</label>
                        <input 
                            type="range" 
                            min="0" 
                            max="10" 
                            value={upgradeLevel} 
                            onChange={e => setUpgradeLevel(parseInt(e.target.value))} 
                            className="w-full accent-indigo-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>0</span><span>5</span><span>10</span>
                        </div>
                    </div>

                    <div className="pt-4">
                         <button 
                            onClick={handleSend} 
                            disabled={isSending || !selectedUserId || !selectedTemplateId}
                            className="w-full py-3 bg-green-700 hover:bg-green-600 rounded text-white font-bold shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            {isSending ? 'Wysyłanie...' : 'Stwórz i Wyślij'}
                        </button>
                    </div>
                </div>

                {/* Preview */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                    <h4 className="text-lg font-bold text-gray-400 mb-4">Podgląd (Maksymalne Statystyki)</h4>
                    {previewItem && selectedTemplate ? (
                        <div className="w-full max-w-sm bg-slate-900 p-4 rounded-lg border border-slate-600 shadow-2xl">
                            <ItemDetailsPanel 
                                item={previewItem} 
                                template={selectedTemplate} 
                                affixes={affixes} 
                                hideAffixes={false}
                            />
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">Wybierz przedmiot, aby zobaczyć podgląd.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
