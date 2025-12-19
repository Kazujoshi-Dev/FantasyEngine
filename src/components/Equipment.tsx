
import React, { useState, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate, GameData, CharacterStats, ItemRarity, Affix } from '../types';
import { ItemDetailsPanel, ItemListItem, EmptySlotListItem, rarityStyles } from './shared/ItemSlot';
import { ContextMenu } from './shared/ContextMenu';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { ShieldIcon } from './icons/ShieldIcon';

const slotOrder: EquipmentSlot[] = [
    EquipmentSlot.Head,
    EquipmentSlot.Neck,
    EquipmentSlot.Chest,
    EquipmentSlot.MainHand,
    EquipmentSlot.OffHand,
    EquipmentSlot.Hands,
    EquipmentSlot.Waist,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
    EquipmentSlot.Ring1,
    EquipmentSlot.Ring2,
    EquipmentSlot.TwoHand,
];

export const Equipment: React.FC = () => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<{ item: ItemInstance; source: 'equipment' | 'inventory'; fromSlot?: EquipmentSlot } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot } | null>(null);
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');

    if (!character || !gameData) return null;

    const backpackCapacity = 40 + ((character.backpack?.level || 1) - 1) * 10;

    const filteredInventory = useMemo(() => {
        return (character.inventory || []).filter(item => {
            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
            if (!template) return false;
            const rarityMatch = rarityFilter === 'all' || template.rarity === rarityFilter;
            const slotMatch = filterSlot === 'all' || template.slot === filterSlot;
            return rarityMatch && slotMatch;
        });
    }, [character.inventory, filterSlot, rarityFilter, gameData.itemTemplates]);

    const handleEquip = useCallback(async (item: ItemInstance) => {
        try {
            const updatedChar = await api.equipItem(item.uniqueId);
            updateCharacter(updatedChar);
            setSelectedItem(null);
        } catch (e: any) { alert(e.message); }
    }, [updateCharacter]);

    const handleUnequip = useCallback(async (slot: EquipmentSlot) => {
        try {
            const updatedChar = await api.unequipItem(slot);
            updateCharacter(updatedChar);
            setSelectedItem(null);
        } catch (e: any) { alert(e.message); }
    }, [updateCharacter]);

    const handleRightClick = (e: React.MouseEvent, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item, source, fromSlot });
    };

    return (
        <ContentPanel title={t('equipment.title')}>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-[80vh]">
                
                {/* Paper Doll: Equipped Items */}
                <div className="xl:col-span-4 bg-slate-900/40 p-6 rounded-2xl border border-white/5 flex flex-col min-h-0">
                    <h3 className="text-xl fantasy-header font-black text-indigo-400 mb-6 px-2 uppercase tracking-widest">Wyposażenie</h3>
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-2">
                        {slotOrder.map(slot => {
                            const item = character.equipment[slot];
                            const template = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;
                            
                            // Hide redundant slots for 2H weapons
                            if (slot === EquipmentSlot.TwoHand && character.equipment.mainHand) return null;
                            if ((slot === EquipmentSlot.MainHand || slot === EquipmentSlot.OffHand) && character.equipment.twoHand) return null;

                            return item && template ? (
                                <div key={slot} onContextMenu={(e) => handleRightClick(e, item, 'equipment', slot)}>
                                    <ItemListItem
                                        item={item}
                                        template={template}
                                        affixes={gameData.affixes}
                                        isSelected={selectedItem?.item.uniqueId === item.uniqueId}
                                        onClick={() => setSelectedItem({ item, source: 'equipment', fromSlot: slot })}
                                        onDoubleClick={() => handleUnequip(slot)}
                                    />
                                </div>
                            ) : (
                                <EmptySlotListItem key={slot} slotName={t(`equipment.slot.${slot}`)} />
                            );
                        })}
                    </div>
                </div>

                {/* Detail View */}
                <div className="xl:col-span-4 bg-slate-900/60 p-6 rounded-2xl border border-fantasy-gold/10 flex flex-col min-h-0 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
                    {selectedItem ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                                <ItemDetailsPanel 
                                    item={selectedItem.item} 
                                    template={gameData.itemTemplates.find(t => t.id === selectedItem.item.templateId)!}
                                    affixes={gameData.affixes}
                                    character={character}
                                />
                            </div>
                            <div className="mt-6 pt-6 border-t border-white/10 flex gap-4">
                                {selectedItem.source === 'inventory' ? (
                                    <button 
                                        onClick={() => handleEquip(selectedItem.item)}
                                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-900/40 transition-all"
                                    >
                                        {t('equipment.equip')}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleUnequip(selectedItem.fromSlot!)}
                                        className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all"
                                    >
                                        {t('equipment.unequip')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-40">
                            <ShieldIcon className="h-24 w-24 mb-6" />
                            <p className="text-lg fantasy-header font-black uppercase tracking-widest">{t('equipment.selectItemPrompt')}</p>
                        </div>
                    )}
                </div>

                {/* Backpack Area */}
                <div className="xl:col-span-4 bg-slate-900/40 p-6 rounded-2xl border border-white/5 flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl fantasy-header font-black text-sky-400 uppercase tracking-widest">Plecak</h3>
                        <span className="font-mono text-sm font-bold text-gray-500 bg-slate-950 px-3 py-1 rounded-full border border-white/5">
                            {character.inventory.length} / {backpackCapacity}
                        </span>
                    </div>

                    {/* Inventory Filters */}
                    <div className="flex gap-2 mb-4">
                        <select 
                            value={filterSlot} 
                            onChange={(e) => setFilterSlot(e.target.value)}
                            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-gray-300 outline-none"
                        >
                            <option value="all">Wszystkie typy</option>
                            <option value="head">Głowa</option>
                            <option value="chest">Tors</option>
                            <option value="MainHand">Broń</option>
                        </select>
                        <select 
                            value={rarityFilter} 
                            onChange={(e) => setRarityFilter(e.target.value as ItemRarity | 'all')}
                            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-gray-300 outline-none"
                        >
                            <option value="all">Wszystkie jakości</option>
                            {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                        </select>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 gap-2 content-start">
                        {filteredInventory.map(item => (
                            <div key={item.uniqueId} onContextMenu={(e) => handleRightClick(e, item, 'inventory')}>
                                <ItemListItem
                                    item={item}
                                    template={gameData.itemTemplates.find(t => t.id === item.templateId)!}
                                    affixes={gameData.affixes}
                                    isSelected={selectedItem?.item.uniqueId === item.uniqueId}
                                    onClick={() => setSelectedItem({ item, source: 'inventory' })}
                                    onDoubleClick={() => handleEquip(item)}
                                />
                            </div>
                        ))}
                        {filteredInventory.length === 0 && (
                            <p className="text-center py-12 text-gray-600 italic text-sm">Brak przedmiotów w tej kategorii.</p>
                        )}
                    </div>
                </div>
            </div>

            {contextMenu && (
                <ContextMenu 
                    {...contextMenu} 
                    options={contextMenu.source === 'inventory' 
                        ? [{ label: t('equipment.equip'), action: () => handleEquip(contextMenu.item) }]
                        : [{ label: t('equipment.unequip'), action: () => handleUnequip(contextMenu.fromSlot!) }]
                    } 
                    onClose={() => setContextMenu(null)} 
                />
            )}
        </ContentPanel>
    );
};
