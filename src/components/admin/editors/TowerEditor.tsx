
import React, { useState, useMemo } from 'react';
import { Tower, GameData, TowerFloor, EssenceType, LootDrop, ItemInstance, ItemCategory, AffixType, ItemTemplate, ItemRarity, Affix } from '../../../types';
import { PlusCircleIcon } from '../../icons/PlusCircleIcon';
import { MinusCircleIcon } from '../../icons/MinusCircleIcon';
import { CoinsIcon } from '../../icons/CoinsIcon';
import { rarityStyles, getGrammaticallyCorrectFullName } from '../../shared/ItemSlot';
import { useTranslation } from '../../../contexts/LanguageContext';

interface TowerEditorProps {
    tower: Partial<Tower>;
    onSave: (tower: Tower) => void;
    onCancel: () => void;
    gameData: GameData;
}

export const TowerEditor: React.FC<TowerEditorProps> = ({ tower, onSave, onCancel, gameData }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Tower>>({
        id: crypto.randomUUID(),
        name: '',
        description: '',
        locationId: '',
        totalFloors: 0,
        floors: [],
        grandPrize: { gold: 0, experience: 0, items: [], essences: {}, randomItemRewards: [] },
        isActive: true,
        ...tower
    });
    
    // --- Item Creator State (Shared) ---
    const [newItemCategory, setNewItemCategory] = useState<ItemCategory | 'all'>('all');
    const [newItemTemplateId, setNewItemTemplateId] = useState('');
    const [newItemPrefixId, setNewItemPrefixId] = useState('');
    const [newItemSuffixId, setNewItemSuffixId] = useState('');
    const [newItemLevel, setNewItemLevel] = useState(0);

    // --- State for managing floors locally before save ---
    const addFloor = () => {
        setFormData(prev => ({
            ...prev,
            floors: [...(prev.floors || []), { 
                floorNumber: (prev.floors?.length || 0) + 1, 
                enemies: [],
                energyCost: 0,
                duration: 0,
                guaranteedReward: { gold: 0, experience: 0 },
                lootTable: [],
                resourceLootTable: [],
                specificItemRewards: [],
                randomItemRewards: []
            }],
            totalFloors: (prev.floors?.length || 0) + 1
        }));
    };

    const removeFloor = (index: number) => {
        setFormData(prev => {
            const newFloors = prev.floors?.filter((_, i) => i !== index).map((f, i) => ({ ...f, floorNumber: i + 1 })) || [];
            return {
                ...prev,
                floors: newFloors,
                totalFloors: newFloors.length
            };
        });
    };

    const updateFloor = (index: number, updates: Partial<TowerFloor>) => {
        setFormData(prev => {
            const newFloors = [...(prev.floors || [])];
            newFloors[index] = { ...newFloors[index], ...updates };
            return { ...prev, floors: newFloors };
        });
    };
    
    const addEnemyToFloor = (floorIndex: number) => {
        const floor = formData.floors![floorIndex];
        const newEnemies = [...floor.enemies, { enemyId: gameData.enemies[0]?.id || '', spawnChance: 100 }];
        updateFloor(floorIndex, { enemies: newEnemies });
    };

    const removeEnemyFromFloor = (floorIndex: number, enemyIndex: number) => {
        const floor = formData.floors![floorIndex];
        const newEnemies = floor.enemies.filter((_, i) => i !== enemyIndex);
        updateFloor(floorIndex, { enemies: newEnemies });
    };
    
    const updateEnemyInFloor = (floorIndex: number, enemyIndex: number, key: 'enemyId' | 'spawnChance', value: any) => {
         const floor = formData.floors![floorIndex];
         const newEnemies = [...floor.enemies];
         (newEnemies[enemyIndex] as any)[key] = value;
         updateFloor(floorIndex, { enemies: newEnemies });
    };

    // --- Reward Helpers ---
    
    // Essences (Floor specific)
    const addEssenceToFloor = (floorIndex: number, type: EssenceType) => {
        const floor = formData.floors![floorIndex];
        const currentResources = floor.resourceLootTable || [];
        // Use ResourceDrop structure: { resource, min, max, chance }
        // For specific rewards, chance should be 100.
        updateFloor(floorIndex, { 
            resourceLootTable: [...currentResources, { resource: type, min: 1, max: 1, chance: 100 }]
        });
    };
    
    const updateEssenceInFloor = (floorIndex: number, resIndex: number, key: string, value: any) => {
         const floor = formData.floors![floorIndex];
         const newRes = [...(floor.resourceLootTable || [])];
         (newRes[resIndex] as any)[key] = value;
         updateFloor(floorIndex, { resourceLootTable: newRes });
    };
    
    const removeEssenceFromFloor = (floorIndex: number, resIndex: number) => {
         const floor = formData.floors![floorIndex];
         const newRes = (floor.resourceLootTable || []).filter((_, i) => i !== resIndex);
         updateFloor(floorIndex, { resourceLootTable: newRes });
    };

    // Random Items (Floor specific)
    const addRandomItemToFloor = (floorIndex: number) => {
        const floor = formData.floors![floorIndex];
        const currentRandoms = floor.randomItemRewards || [];
        updateFloor(floorIndex, {
            randomItemRewards: [...currentRandoms, { rarity: ItemRarity.Common, chance: 100, amount: 1, affixCount: 0 }]
        });
    };
    
    const updateRandomItemInFloor = (floorIndex: number, itemIndex: number, key: string, value: any) => {
         const floor = formData.floors![floorIndex];
         const newRandoms = [...(floor.randomItemRewards || [])];
         (newRandoms[itemIndex] as any)[key] = value;
         updateFloor(floorIndex, { randomItemRewards: newRandoms });
    };

    const removeRandomItemFromFloor = (floorIndex: number, itemIndex: number) => {
         const floor = formData.floors![floorIndex];
         const newRandoms = (floor.randomItemRewards || []).filter((_, i) => i !== itemIndex);
         updateFloor(floorIndex, { randomItemRewards: newRandoms });
    };

    // Specific Items (Floor specific)
    const addSpecificItemToFloor = (floorIndex: number) => {
         if (!newItemTemplateId) return;
         const newItem: ItemInstance = {
            uniqueId: crypto.randomUUID(),
            templateId: newItemTemplateId,
            prefixId: newItemPrefixId || undefined,
            suffixId: newItemSuffixId || undefined,
            upgradeLevel: newItemLevel
        };
        const floor = formData.floors![floorIndex];
        updateFloor(floorIndex, {
            specificItemRewards: [...(floor.specificItemRewards || []), newItem]
        });
    };
    
    const removeSpecificItemFromFloor = (floorIndex: number, uniqueId: string) => {
        const floor = formData.floors![floorIndex];
        updateFloor(floorIndex, {
            specificItemRewards: (floor.specificItemRewards || []).filter(i => i.uniqueId !== uniqueId)
        });
    };


    // --- Grand Prize Helpers ---
    const updateGrandPrizeEssence = (type: EssenceType, amount: number) => {
        setFormData(prev => {
            const currentEssences = { ...(prev.grandPrize?.essences || {}) };
            if (amount <= 0) {
                delete currentEssences[type];
            } else {
                currentEssences[type] = amount;
            }
            return {
                ...prev,
                grandPrize: { ...prev.grandPrize, essences: currentEssences } as any
            };
        });
    };

    const addGrandPrizeItem = () => {
        if (!newItemTemplateId) return;
        const newItem: ItemInstance = {
            uniqueId: crypto.randomUUID(), 
            templateId: newItemTemplateId,
            prefixId: newItemPrefixId || undefined,
            suffixId: newItemSuffixId || undefined,
            upgradeLevel: newItemLevel
        };
        setFormData(prev => ({
            ...prev,
            grandPrize: {
                ...prev.grandPrize,
                items: [...(prev.grandPrize?.items || []), newItem]
            } as any
        }));
    };

    const removeGrandPrizeItem = (uniqueId: string) => {
        setFormData(prev => ({
            ...prev,
            grandPrize: {
                ...prev.grandPrize,
                items: prev.grandPrize?.items?.filter(i => i.uniqueId !== uniqueId) || []
            } as any
        }));
    };
    
    // Grand Prize Random Items
    const addGrandPrizeRandomItem = () => {
        setFormData(prev => ({
            ...prev,
            grandPrize: {
                ...prev.grandPrize,
                randomItemRewards: [...(prev.grandPrize?.randomItemRewards || []), { rarity: ItemRarity.Common, chance: 100, amount: 1, affixCount: 0 }]
            } as any
        }));
    };
    
    const updateGrandPrizeRandomItem = (index: number, key: string, value: any) => {
        setFormData(prev => {
            const newRandoms = [...(prev.grandPrize?.randomItemRewards || [])];
            (newRandoms[index] as any)[key] = value;
            return {
                ...prev,
                grandPrize: {
                    ...prev.grandPrize,
                    randomItemRewards: newRandoms
                } as any
            };
        });
    };
    
    const removeGrandPrizeRandomItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            grandPrize: {
                ...prev.grandPrize,
                randomItemRewards: prev.grandPrize?.randomItemRewards?.filter((_, i) => i !== index) || []
            } as any
        }));
    };

    // --- Filter logic for Item Creator ---
    const filteredTemplates = useMemo(() => {
        return gameData.itemTemplates.filter(t => newItemCategory === 'all' || t.category === newItemCategory)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [gameData.itemTemplates, newItemCategory]);

    const selectedTemplate = useMemo(() => gameData.itemTemplates.find(t => t.id === newItemTemplateId), [newItemTemplateId, gameData.itemTemplates]);
    
    const validPrefixes = useMemo(() => {
        if (!selectedTemplate) return [];
        return gameData.affixes.filter(a => a.type === AffixType.Prefix && a.spawnChances[selectedTemplate.category]);
    }, [selectedTemplate, gameData.affixes]);

    const validSuffixes = useMemo(() => {
        if (!selectedTemplate) return [];
        return gameData.affixes.filter(a => a.type === AffixType.Suffix && a.spawnChances[selectedTemplate.category]);
    }, [selectedTemplate, gameData.affixes]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.locationId) {
            alert('Nazwa i lokalizacja są wymagane');
            return;
        }
        onSave(formData as Tower);
    };

    const getAffixName = (a: Affix) => typeof a.name === 'string' ? a.name : a.name.masculine;

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-xl font-bold text-purple-400">Edytor Wieży</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm text-gray-400">Nazwa</label>
                    <input className="w-full bg-slate-700 p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                    <label className="block text-sm text-gray-400">Lokacja</label>
                    <select className="w-full bg-slate-700 p-2 rounded" value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})}>
                        <option value="">Wybierz...</option>
                        {gameData.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-400">Obrazek (URL)</label>
                    <input className="w-full bg-slate-700 p-2 rounded" value={formData.image || ''} onChange={e => setFormData({...formData, image: e.target.value})} />
                </div>
                <div className="col-span-2">
                    <label className="block text-sm text-gray-400">Opis</label>
                    <textarea className="w-full bg-slate-700 p-2 rounded" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
            </div>

            {/* ITEM CREATOR TOOL (Shared) */}
             <div className="bg-slate-800/80 p-3 rounded border border-indigo-500/50">
                 <p className="text-xs text-indigo-300 mb-2 font-bold uppercase">Narzędzie: Kreator Przedmiotu (Użyj przycisków w sekcjach poniżej aby dodać)</p>
                 <div className="grid grid-cols-2 gap-2 mb-2">
                    <select value={newItemCategory} onChange={e => { setNewItemCategory(e.target.value as any); setNewItemTemplateId(''); }} className="bg-slate-700 text-xs p-1 rounded">
                        <option value="all">Kat: Wszystkie</option>
                        {Object.values(ItemCategory).map(c => <option key={c} value={c}>{t(`item.categories.${c}`)}</option>)}
                    </select>
                    <select value={newItemTemplateId} onChange={e => setNewItemTemplateId(e.target.value)} className="bg-slate-700 text-xs p-1 rounded">
                        <option value="">-- Wybierz Bazę --</option>
                        {filteredTemplates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rarity})</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-3 gap-2 mb-2">
                     <select value={newItemPrefixId} onChange={e => setNewItemPrefixId(e.target.value)} className="bg-slate-700 text-xs p-1 rounded" disabled={!newItemTemplateId}>
                         <option value="">Prefiks: Brak</option>
                         {validPrefixes.map(p => <option key={p.id} value={p.id}>{getAffixName(p)}</option>)}
                     </select>
                     <select value={newItemSuffixId} onChange={e => setNewItemSuffixId(e.target.value)} className="bg-slate-700 text-xs p-1 rounded" disabled={!newItemTemplateId}>
                         <option value="">Sufiks: Brak</option>
                         {validSuffixes.map(s => <option key={s.id} value={s.id}>{getAffixName(s)}</option>)}
                     </select>
                     <input type="number" placeholder="Lvl" min="0" max="10" value={newItemLevel} onChange={e => setNewItemLevel(parseInt(e.target.value)||0)} className="bg-slate-700 text-xs p-1 rounded" />
                 </div>
             </div>
            
            {/* Grand Prize Section */}
            <div className="bg-slate-800/50 p-4 rounded-lg border border-amber-600/30">
                 <h4 className="text-amber-400 font-bold text-lg mb-4 flex items-center gap-2"><CoinsIcon className="h-5 w-5"/> Nagroda Główna (za ukończenie)</h4>
                 
                 {/* Basic Currency */}
                 <div className="flex gap-4 mb-4">
                     <label className="text-sm text-gray-300">Złoto: <input type="number" className="w-24 bg-slate-700 p-1 rounded ml-2" value={formData.grandPrize?.gold} onChange={e => setFormData({...formData, grandPrize: {...formData.grandPrize, gold: parseInt(e.target.value)||0}} as any)} /></label>
                     <label className="text-sm text-gray-300">XP: <input type="number" className="w-24 bg-slate-700 p-1 rounded ml-2" value={formData.grandPrize?.experience} onChange={e => setFormData({...formData, grandPrize: {...formData.grandPrize, experience: parseInt(e.target.value)||0}} as any)} /></label>
                 </div>
                 
                 {/* Essences */}
                 <div className="mb-4">
                     <p className="text-xs text-gray-500 font-bold uppercase mb-2">Esencje</p>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                         {Object.values(EssenceType).map(type => (
                             <div key={type} className="flex items-center gap-2">
                                 <span className={`text-xs ${rarityStyles[type === EssenceType.Common ? 'Common' : type === EssenceType.Uncommon ? 'Uncommon' : type === EssenceType.Rare ? 'Rare' : type === EssenceType.Epic ? 'Epic' : 'Legendary'].text}`}>{t(`resources.${type}`)}:</span>
                                 <input 
                                     type="number" 
                                     className="w-16 bg-slate-700 p-1 rounded text-xs" 
                                     value={(formData.grandPrize?.essences as any)?.[type] || 0}
                                     onChange={e => updateGrandPrizeEssence(type, parseInt(e.target.value) || 0)}
                                 />
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Random Items (Grand Prize) */}
                 <div className="mb-4">
                     <p className="text-xs text-gray-500 font-bold uppercase mb-2">Losowe Przedmioty</p>
                     {formData.grandPrize?.randomItemRewards?.map((rew, rIdx) => (
                          <div key={rIdx} className="flex gap-2 items-center text-xs mb-1">
                             <select value={rew.rarity} onChange={e => updateGrandPrizeRandomItem(rIdx, 'rarity', e.target.value)} className="bg-slate-900 p-1 rounded">
                                {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                             </select>
                             <label>Szansa %: <input type="number" value={rew.chance} onChange={e => updateGrandPrizeRandomItem(rIdx, 'chance', parseInt(e.target.value))} className="w-12 bg-slate-900 p-1 rounded" /></label>
                             <label>Ilość: <input type="number" value={rew.amount} onChange={e => updateGrandPrizeRandomItem(rIdx, 'amount', parseInt(e.target.value))} className="w-10 bg-slate-900 p-1 rounded" /></label>
                             <label>Afiksy (0-2): <input type="number" min="0" max="2" value={rew.affixCount || 0} onChange={e => updateGrandPrizeRandomItem(rIdx, 'affixCount', parseInt(e.target.value))} className="w-10 bg-slate-900 p-1 rounded" /></label>
                             <button type="button" onClick={() => removeGrandPrizeRandomItem(rIdx)} className="text-red-500">X</button>
                          </div>
                     ))}
                     <button type="button" onClick={addGrandPrizeRandomItem} className="text-xs text-purple-400">+ Losowy Przedmiot</button>
                 </div>

                 {/* Items */}
                 <div>
                     <p className="text-xs text-gray-500 font-bold uppercase mb-2">Konkretne Przedmioty</p>
                     <div className="space-y-2 mb-3">
                         {(formData.grandPrize?.items || []).map((item, idx) => {
                             const tmpl = gameData.itemTemplates.find(t => t.id === item.templateId);
                             if (!tmpl) return null;
                             const fullName = getGrammaticallyCorrectFullName(item, tmpl, gameData.affixes);
                             return (
                                 <div key={idx} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-700">
                                     <span className={`${rarityStyles[tmpl.rarity].text} text-sm`}>
                                         {fullName} {item.upgradeLevel ? `+${item.upgradeLevel}` : ''}
                                     </span>
                                     <button type="button" onClick={() => removeGrandPrizeItem(item.uniqueId)} className="text-red-500 hover:text-red-400 text-xs">Usuń</button>
                                 </div>
                             );
                         })}
                     </div>
                     <button type="button" onClick={addGrandPrizeItem} disabled={!newItemTemplateId} className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold py-1 px-3 rounded">Dodaj z Kreatora</button>
                 </div>
            </div>

            {/* Floors Editor */}
            <div className="space-y-4">
                <h4 className="font-bold text-white border-b border-slate-700 pb-2 flex justify-between items-center">
                    Piętra ({formData.floors?.length})
                    <button type="button" onClick={addFloor} className="px-3 py-1 bg-green-700 rounded text-xs hover:bg-green-600">+ Piętro</button>
                </h4>
                
                <div className="space-y-4">
                    {formData.floors?.map((floor, idx) => (
                        <div key={idx} className="bg-slate-800/50 p-4 rounded border border-slate-700">
                            <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                                <h5 className="font-bold text-gray-300">Piętro {floor.floorNumber}</h5>
                                <button type="button" onClick={() => removeFloor(idx)} className="text-red-400 text-xs">Usuń Piętro</button>
                            </div>
                            
                            {/* Costs */}
                             <div className="flex gap-4 mb-3 border-b border-slate-700/50 pb-3">
                                <label className="text-xs text-gray-400">Koszt Energii: 
                                    <input type="number" className="w-16 bg-slate-900 p-1 rounded ml-1 text-white" value={floor.energyCost || 0} onChange={e => updateFloor(idx, { energyCost: parseInt(e.target.value)||0 })} />
                                </label>
                                <label className="text-xs text-gray-400">Czas (s): 
                                    <input type="number" className="w-16 bg-slate-900 p-1 rounded ml-1 text-white" value={floor.duration || 0} onChange={e => updateFloor(idx, { duration: parseInt(e.target.value)||0 })} />
                                </label>
                            </div>

                            {/* Enemies */}
                            <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1 font-bold">Przeciwnicy</p>
                                {floor.enemies.map((enemy, eIdx) => (
                                    <div key={eIdx} className="flex gap-2 mb-1">
                                        <select 
                                            value={enemy.enemyId} 
                                            onChange={e => updateEnemyInFloor(idx, eIdx, 'enemyId', e.target.value)}
                                            className="flex-grow bg-slate-900 p-1 rounded text-sm"
                                        >
                                            {gameData.enemies.map(en => <option key={en.id} value={en.id}>{en.name} (Lvl {en.stats.maxHealth > 500 ? 'Boss' : 'Mob'})</option>)}
                                        </select>
                                        <input 
                                            type="number" 
                                            value={enemy.spawnChance} 
                                            onChange={e => updateEnemyInFloor(idx, eIdx, 'spawnChance', parseInt(e.target.value))}
                                            className="w-20 bg-slate-900 p-1 rounded text-sm"
                                            placeholder="Szansa"
                                        />
                                        <button type="button" onClick={() => removeEnemyFromFloor(idx, eIdx)} className="text-red-500">X</button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => addEnemyToFloor(idx)} className="text-xs text-green-400">+ Przeciwnik</button>
                            </div>
                            
                            {/* Floor Rewards */}
                            <div className="grid grid-cols-1 gap-3 border-t border-slate-700 pt-2">
                                <p className="text-xs text-gray-500 font-bold">Nagrody za Piętro (Gwarantowane)</p>
                                <div className="flex gap-4 text-sm">
                                     <label>Złoto: <input type="number" className="w-20 bg-slate-900 p-1 rounded" value={floor.guaranteedReward?.gold} onChange={e => updateFloor(idx, { guaranteedReward: { ...floor.guaranteedReward, gold: parseInt(e.target.value)||0 } as any })} /></label>
                                     <label>XP: <input type="number" className="w-20 bg-slate-900 p-1 rounded" value={floor.guaranteedReward?.experience} onChange={e => updateFloor(idx, { guaranteedReward: { ...floor.guaranteedReward, experience: parseInt(e.target.value)||0 } as any })} /></label>
                                </div>
                                
                                {/* Specific Items */}
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">Konkretne Przedmioty (100%):</p>
                                    {floor.specificItemRewards?.map((item, itemIdx) => (
                                         <div key={item.uniqueId} className="flex justify-between items-center text-xs bg-slate-900/50 p-1 rounded mb-1">
                                            <span>{item.templateId ? gameData.itemTemplates.find(t=>t.id===item.templateId)?.name : '???'} (+{item.upgradeLevel})</span>
                                            <button type="button" onClick={() => removeSpecificItemFromFloor(idx, item.uniqueId)} className="text-red-500">X</button>
                                         </div>
                                    ))}
                                    <button type="button" onClick={() => addSpecificItemToFloor(idx)} disabled={!newItemTemplateId} className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700">Dodaj z Kreatora</button>
                                </div>

                                {/* Essences */}
                                <div>
                                     <p className="text-xs text-gray-400 mb-1">Esencje:</p>
                                     {floor.resourceLootTable?.map((res, resIdx) => (
                                         <div key={resIdx} className="flex gap-2 items-center text-xs mb-1">
                                             <select value={res.resource} onChange={e => updateEssenceInFloor(idx, resIdx, 'resource', e.target.value)} className="bg-slate-900 p-1 rounded">
                                                {Object.values(EssenceType).map(et => <option key={et} value={et}>{t(`resources.${et}`)}</option>)}
                                             </select>
                                             <input type="number" value={res.min} onChange={e => updateEssenceInFloor(idx, resIdx, 'min', parseInt(e.target.value))} className="w-12 bg-slate-900 p-1 rounded" placeholder="Min"/>
                                             <input type="number" value={res.max} onChange={e => updateEssenceInFloor(idx, resIdx, 'max', parseInt(e.target.value))} className="w-12 bg-slate-900 p-1 rounded" placeholder="Max"/>
                                             <button type="button" onClick={() => removeEssenceFromFloor(idx, resIdx)} className="text-red-500">X</button>
                                         </div>
                                     ))}
                                     <button type="button" onClick={() => addEssenceToFloor(idx, EssenceType.Common)} className="text-xs text-sky-400">+ Esencja</button>
                                </div>

                                {/* Random Items */}
                                <div>
                                     <p className="text-xs text-gray-400 mb-1">Losowe Przedmioty:</p>
                                     {floor.randomItemRewards?.map((rew, rIdx) => (
                                          <div key={rIdx} className="flex gap-2 items-center text-xs mb-1">
                                             <select value={rew.rarity} onChange={e => updateRandomItemInFloor(idx, rIdx, 'rarity', e.target.value)} className="bg-slate-900 p-1 rounded">
                                                {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                                             </select>
                                             <label>Szansa %: <input type="number" value={rew.chance} onChange={e => updateRandomItemInFloor(idx, rIdx, 'chance', parseInt(e.target.value))} className="w-12 bg-slate-900 p-1 rounded" /></label>
                                             <label>Ilość: <input type="number" value={rew.amount} onChange={e => updateRandomItemInFloor(idx, rIdx, 'amount', parseInt(e.target.value))} className="w-10 bg-slate-900 p-1 rounded" /></label>
                                             <label>Afiksy (0-2): <input type="number" min="0" max="2" value={rew.affixCount || 0} onChange={e => updateRandomItemInFloor(idx, rIdx, 'affixCount', parseInt(e.target.value))} className="w-10 bg-slate-900 p-1 rounded" /></label>
                                             <button type="button" onClick={() => removeRandomItemFromFloor(idx, rIdx)} className="text-red-500">X</button>
                                          </div>
                                     ))}
                                     <button type="button" onClick={() => addRandomItemToFloor(idx)} className="text-xs text-purple-400">+ Losowy Przedmiot</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-700 rounded text-white">Anuluj</button>
                <button type="submit" className="px-6 py-2 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold">Zapisz Wieżę</button>
            </div>
        </form>
    );
};
