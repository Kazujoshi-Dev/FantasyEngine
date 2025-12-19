
import React, { useState, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, EquipmentSlot, ItemInstance, ItemTemplate, GameData, CharacterStats, ItemRarity, Affix } from '../types';
import { ItemDetailsPanel, ItemListItem, EmptySlotListItem, rarityStyles, ItemTooltip } from './shared/ItemSlot';
import { ContextMenu } from './shared/ContextMenu';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { ShieldIcon } from './icons/ShieldIcon';
import { BoltIcon } from './icons/BoltIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { SparklesIcon } from './icons/SparklesIcon';

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

const StatRow: React.FC<{ label: string; value: React.ReactNode; color?: string; icon?: React.ReactNode }> = ({ label, value, color = 'text-gray-300', icon }) => (
    <div className="flex justify-between items-center py-1.5 px-3 rounded bg-slate-800/30 border border-white/5">
        <div className="flex items-center gap-2">
            {icon && <div className="opacity-70">{icon}</div>}
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
        </div>
        <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
);

export const Equipment: React.FC = () => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [hoveredItem, setHoveredItem] = useState<{ item: ItemInstance; template: ItemTemplate; x: number; y: number } | null>(null);
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
            setHoveredItem(null);
        } catch (e: any) { alert(e.message); }
    }, [updateCharacter]);

    const handleUnequip = useCallback(async (slot: EquipmentSlot) => {
        try {
            const updatedChar = await api.unequipItem(slot);
            updateCharacter(updatedChar);
            setHoveredItem(null);
        } catch (e: any) { alert(e.message); }
    }, [updateCharacter]);

    const handleRightClick = (e: React.MouseEvent, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item, source, fromSlot });
    };

    const getCompareItem = (template: ItemTemplate): ItemInstance | null => {
        if (!character) return null;
        let slotToCompare: EquipmentSlot = template.slot as EquipmentSlot;
        
        if (template.slot === 'ring') {
            return character.equipment.ring1 || character.equipment.ring2 || null;
        }
        
        return character.equipment[slotToCompare] || null;
    };

    return (
        <ContentPanel title={t('equipment.title')}>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[80vh]">
                
                {/* Paper Doll: Equipped Items */}
                <div className="xl:col-span-3 bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex flex-col min-h-0">
                    <h3 className="text-sm fantasy-header font-black text-indigo-400 mb-4 px-2 uppercase tracking-widest border-b border-indigo-500/20 pb-2">Wyposażenie</h3>
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-2">
                        {slotOrder.map(slot => {
                            const item = character.equipment[slot];
                            const template = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;
                            
                            if (slot === EquipmentSlot.TwoHand && character.equipment.mainHand) return null;
                            if ((slot === EquipmentSlot.MainHand || slot === EquipmentSlot.OffHand) && character.equipment.twoHand) return null;

                            return item && template ? (
                                <div 
                                    key={slot} 
                                    onContextMenu={(e) => handleRightClick(e, item, 'equipment', slot)}
                                    onMouseEnter={(e) => setHoveredItem({ item, template, x: e.clientX, y: e.clientY })}
                                    onMouseLeave={() => setHoveredItem(null)}
                                >
                                    <ItemListItem
                                        item={item}
                                        template={template}
                                        affixes={gameData.affixes}
                                        isSelected={false}
                                        onClick={() => {}}
                                        onDoubleClick={() => handleUnequip(slot)}
                                    />
                                </div>
                            ) : (
                                <EmptySlotListItem key={slot} slotName={t(`equipment.slot.${slot}`)} />
                            );
                        })}
                    </div>
                </div>

                {/* Arkusz Statystyk Bojowych (Środek) */}
                <div className="xl:col-span-4 bg-[#0d111a] p-6 rounded-2xl border border-fantasy-gold/20 flex flex-col min-h-0 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col h-full">
                        <h3 className="text-lg fantasy-header font-black text-fantasy-gold mb-6 text-center uppercase tracking-[0.2em] border-b border-fantasy-gold/30 pb-4">Archiwum Bojowe</h3>
                        
                        <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar space-y-6">
                            {/* Sekcja: Atrybuty */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <SparklesIcon className="h-3 w-3" /> Atrybuty Mocy
                                </h4>
                                <div className="grid grid-cols-1 gap-1">
                                    <StatRow label={t('statistics.strength')} value={character.stats.strength} />
                                    <StatRow label={t('statistics.agility')} value={character.stats.agility} />
                                    <StatRow label={t('statistics.accuracy')} value={character.stats.accuracy} />
                                    <StatRow label={t('statistics.intelligence')} value={character.stats.intelligence} />
                                    <StatRow label={t('statistics.luck')} value={character.stats.luck} color="text-amber-400" />
                                </div>
                            </div>

                            {/* Sekcja: Walka */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <SwordsIcon className="h-3 w-3" /> Potencjał Ofensywny
                                </h4>
                                <div className="grid grid-cols-1 gap-1">
                                    <StatRow label="Obrażenia Fizyczne" value={`${character.stats.minDamage} - ${character.stats.maxDamage}`} color="text-white" />
                                    {character.stats.magicDamageMax > 0 && <StatRow label="Obrażenia Magiczne" value={`${character.stats.magicDamageMin} - ${character.stats.magicDamageMax}`} color="text-purple-400" />}
                                    <StatRow label="Szansa na Krytyk" value={`${character.stats.critChance.toFixed(1)}%`} color="text-red-400" />
                                    <StatRow label="Modyfikator Kryt." value={`${character.stats.critDamageModifier}%`} />
                                    <StatRow label="Ataki na Rundę" value={character.stats.attacksPerRound} />
                                </div>
                            </div>

                            {/* Sekcja: Obrona i Inne */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <ShieldIcon className="h-3 w-3" /> Formacje Obronne
                                </h4>
                                <div className="grid grid-cols-1 gap-1">
                                    <StatRow label="Pancerz" value={character.stats.armor} color="text-sky-300" />
                                    <StatRow label="Szansa na Unik" value={`${character.stats.dodgeChance.toFixed(1)}%`} color="text-blue-400" />
                                    <StatRow label="Zdrowie" value={`${Math.ceil(character.stats.currentHealth)} / ${character.stats.maxHealth}`} color="text-green-400" />
                                    <StatRow label="Regeneracja Many" value={character.stats.manaRegen} color="text-indigo-400" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/5 text-[9px] text-gray-500 text-center uppercase tracking-tighter">
                            Wartości uwzględniają bonusy z przedmiotów, gildii oraz umiejętności aktywnych.
                        </div>
                    </div>
                </div>

                {/* Backpack Area */}
                <div className="xl:col-span-5 bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm fantasy-header font-black text-sky-400 uppercase tracking-widest">Plecak</h3>
                        <span className="font-mono text-xs font-bold text-gray-500 bg-slate-950 px-3 py-1 rounded-full border border-white/5">
                            {character.inventory.length} / {backpackCapacity}
                        </span>
                    </div>

                    {/* Inventory Filters */}
                    <div className="flex gap-2 mb-4">
                        <select 
                            value={filterSlot} 
                            onChange={(e) => setFilterSlot(e.target.value)}
                            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-gray-300 outline-none"
                        >
                            <option value="all">Wszystkie typy</option>
                            <option value="head">Głowa</option>
                            <option value="chest">Tors</option>
                            <option value="mainHand">Broń</option>
                            <option value="legs">Nogi</option>
                            <option value="feet">Stopy</option>
                            <option value="hands">Ręce</option>
                            <option value="waist">Pas</option>
                            <option value="neck">Szyja</option>
                            <option value="ring">Pierścienie</option>
                        </select>
                        <select 
                            value={rarityFilter} 
                            onChange={(e) => setRarityFilter(e.target.value as ItemRarity | 'all')}
                            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-gray-300 outline-none"
                        >
                            <option value="all">Wszystkie jakości</option>
                            {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                        </select>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
                        {filteredInventory.map(item => {
                            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            return (
                                <div 
                                    key={item.uniqueId} 
                                    onContextMenu={(e) => handleRightClick(e, item, 'inventory')}
                                    onMouseEnter={(e) => setHoveredItem({ item, template, x: e.clientX, y: e.clientY })}
                                    onMouseLeave={() => setHoveredItem(null)}
                                >
                                    <ItemListItem
                                        item={item}
                                        template={template}
                                        affixes={gameData.affixes}
                                        isSelected={false}
                                        onClick={() => {}}
                                        onDoubleClick={() => handleEquip(item)}
                                    />
                                </div>
                            );
                        })}
                        {filteredInventory.length === 0 && (
                            <p className="text-center py-12 text-gray-600 italic text-sm col-span-full">Brak przedmiotów.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Hover Tooltip with Comparison */}
            {hoveredItem && (
                <ItemTooltip 
                    instance={hoveredItem.item}
                    template={hoveredItem.template}
                    affixes={gameData.affixes}
                    character={character}
                    compareWith={getCompareItem(hoveredItem.template)}
                    x={hoveredItem.x}
                    y={hoveredItem.y}
                />
            )}

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
