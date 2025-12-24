
import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { StarIcon } from './icons/StarIcon';
import { CoinsIcon } from './icons/CoinsIcon';
import { LoadoutManager } from './equipment/LoadoutManager';

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
    const [inspectedItem, setInspectedItem] = useState<{ item: ItemInstance; template: ItemTemplate } | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot } | null>(null);
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');
    
    // Stany dla wizualnego feedbacku Drag and Drop
    const [isDragOverPaperDoll, setIsDragOverPaperDoll] = useState(false);
    const [isDragOverBackpack, setIsDragOverBackpack] = useState(false);

    // Timer do debouncowania zamykania tooltipa
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    if (!character || !gameData) return null;

    const backpackCapacity = 40 + ((character.backpack?.level || 1) - 1) * 10;

    const slotOptions = useMemo(() => {
        const slots = Object.values(EquipmentSlot) as string[];
        const uniqueSlots = Array.from(new Set(slots.map(s => s.startsWith('ring') ? 'ring' : s)));
        return uniqueSlots.map(s => ({
            id: s,
            label: s === 'ring' ? t('item.slot.ring') : t(`item.slot.${s}`)
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t]);

    const filteredInventory = useMemo(() => {
        return (character.inventory || []).filter(item => {
            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
            if (!template) return false;
            
            const rarityMatch = rarityFilter === 'all' || template.rarity === rarityFilter;
            
            // Grupowanie pierścieni w logice filtra
            const itemSlotNormalized = template.slot.startsWith('ring') ? 'ring' : template.slot;
            const slotMatch = filterSlot === 'all' || itemSlotNormalized === filterSlot;

            return rarityMatch && slotMatch;
        });
    }, [character.inventory, filterSlot, rarityFilter, gameData.itemTemplates]);

    const handleEquip = useCallback(async (item: ItemInstance) => {
        try {
            const updatedChar = await api.equipItem(item.uniqueId);
            updateCharacter(updatedChar);
            setInspectedItem(null);
        } catch (e: any) { alert(e.message); }
    }, [updateCharacter]);

    const handleUnequip = useCallback(async (slot: EquipmentSlot) => {
        try {
            const updatedChar = await api.unequipItem(slot);
            updateCharacter(updatedChar);
            setInspectedItem(null);
        } catch (e: any) { alert(e.message); }
    }, [updateCharacter]);

    // --- Obsługa Drag and Drop ---

    const handleDragOver = (e: React.DragEvent, zone: 'paperdoll' | 'backpack') => {
        e.preventDefault();
        if (zone === 'paperdoll') setIsDragOverPaperDoll(true);
        else setIsDragOverBackpack(true);
    };

    const handleDragLeave = (zone: 'paperdoll' | 'backpack') => {
        if (zone === 'paperdoll') setIsDragOverPaperDoll(false);
        else setIsDragOverBackpack(false);
    };

    const handleDrop = async (e: React.DragEvent, targetZone: 'paperdoll' | 'backpack') => {
        e.preventDefault();
        setIsDragOverPaperDoll(false);
        setIsDragOverBackpack(false);

        try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (!dataStr) return;
            
            const data = JSON.parse(dataStr);
            const { uniqueId, source, fromSlot } = data;

            // Logika: upuszczenie na Equipment
            if (targetZone === 'paperdoll' && source === 'inventory') {
                const item = character.inventory.find(i => i.uniqueId === uniqueId);
                if (item) await handleEquip(item);
            }
            // Logika: upuszczenie na Backpack
            else if (targetZone === 'backpack' && source === 'equipment' && fromSlot) {
                await handleUnequip(fromSlot);
            }
        } catch (err) {
            console.error("DND Drop Error:", err);
        }
    };

    const handleMouseEnter = (item: ItemInstance, template: ItemTemplate, e: React.MouseEvent) => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setMousePos({ x: e.clientX, y: e.clientY });
        setInspectedItem({ item, template });
    };

    const handleMouseLeave = () => {
        closeTimerRef.current = setTimeout(() => {
            setInspectedItem(null);
        }, 300);
    };

    const handleTooltipEnter = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    const handleRightClick = (e: React.MouseEvent, item: ItemInstance, source: 'equipment' | 'inventory', fromSlot?: EquipmentSlot) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item, source, fromSlot });
    };

    const getCompareItem = (template: ItemTemplate): ItemInstance | null => {
        if (!character) return null;
        
        // Dla tarcz zawsze porównujemy z OffHand
        if (template.isShield) {
            return character.equipment.offHand || null;
        }

        if (template.slot === 'ring') {
            return character.equipment.ring1 || character.equipment.ring2 || null;
        }
        if (template.slot === EquipmentSlot.TwoHand) {
            return character.equipment.mainHand || character.equipment.twoHand || null;
        }
        if (template.slot === EquipmentSlot.MainHand) {
             return character.equipment.mainHand || character.equipment.twoHand || null;
        }
        if (template.slot === EquipmentSlot.OffHand) {
            return character.equipment.offHand || null;
        }
        return character.equipment[template.slot as EquipmentSlot] || null;
    };

    return (
        <ContentPanel title={t('equipment.title')}>
            <LoadoutManager />
            
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[80vh]">
                
                {/* Paper Doll */}
                <div 
                    onDragOver={(e) => handleDragOver(e, 'paperdoll')}
                    onDragLeave={() => handleDragLeave('paperdoll')}
                    onDrop={(e) => handleDrop(e, 'paperdoll')}
                    className={`xl:col-span-3 p-4 rounded-2xl border transition-all duration-300 flex flex-col min-h-0 ${isDragOverPaperDoll ? 'bg-indigo-900/20 border-indigo-500 shadow-2xl scale-[1.02]' : 'bg-slate-900/40 border-white/5'}`}
                >
                    <h3 className="text-sm fantasy-header font-black text-indigo-400 mb-4 px-2 uppercase tracking-widest border-b border-indigo-500/20 pb-2 flex justify-between">
                        <span>Wyposażenie</span>
                        {isDragOverPaperDoll && <span className="text-[9px] animate-pulse">Upuść, by założyć</span>}
                    </h3>
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-2">
                        {slotOrder.map(slot => {
                            const item = character.equipment[slot];
                            const template = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;
                            if (slot === EquipmentSlot.TwoHand && character.equipment.mainHand) return null;
                            if ((slot === EquipmentSlot.MainHand || slot === EquipmentSlot.OffHand) && character.equipment.twoHand) return null;
                            return item && template ? (
                                <div key={slot} onContextMenu={(e) => handleRightClick(e, item, 'equipment', slot)}>
                                    <ItemListItem 
                                        item={item} 
                                        template={template} 
                                        affixes={gameData.affixes} 
                                        isSelected={false} 
                                        onClick={() => {}} 
                                        onMouseEnter={(e) => handleMouseEnter(item, template, e)} 
                                        onMouseLeave={handleMouseLeave} 
                                        onDoubleClick={() => handleUnequip(slot)}
                                        source="equipment"
                                        fromSlot={slot}
                                        onAction={() => handleUnequip(slot)}
                                        actionType="unequip"
                                    />
                                </div>
                            ) : ( <EmptySlotListItem key={slot} slotName={t(`item.slot.${slot}`)} /> );
                        })}
                    </div>
                </div>

                {/* ŚRODKOWA KOLUMNA: Statystyki Bojowe */}
                <div className="xl:col-span-4 bg-[#0d111a] p-6 rounded-2xl border border-fantasy-gold/20 flex flex-col min-h-0 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col h-full">
                        <h3 className="text-lg fantasy-header font-black text-fantasy-gold mb-6 text-center uppercase tracking-[0.2em] border-b border-fantasy-gold/30 pb-4">Statystyki Bojowe</h3>
                        
                        <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar space-y-6">
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><SparklesIcon className="h-3 w-3" /> Atrybuty</h4>
                                <div className="grid grid-cols-1 gap-1">
                                    <StatRow label={t('statistics.strength')} value={character.stats.strength} />
                                    <StatRow label={t('statistics.agility')} value={character.stats.agility} />
                                    <StatRow label={t('statistics.accuracy')} value={character.stats.accuracy} />
                                    <StatRow label={t('statistics.stamina')} value={character.stats.stamina} />
                                    <StatRow label={t('statistics.intelligence')} value={character.stats.intelligence} />
                                    <StatRow label={t('statistics.luck')} value={character.stats.luck} color="text-amber-400" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2"><SwordsIcon className="h-3 w-3" /> Ofensywa</h4>
                                <div className="grid grid-cols-1 gap-1">
                                    <StatRow label="Obrażenia Fizyczne" value={`${character.stats.minDamage} - ${character.stats.maxDamage}`} color="text-white" />
                                    <StatRow label="Obrażenia Magiczne" value={`${character.stats.magicDamageMin} - ${character.stats.magicDamageMax}`} color="text-purple-400" />
                                    <StatRow label="Modyfikator Krytyka" value={`${character.stats.critDamageModifier}%`} color="text-red-400" />
                                    <StatRow label="Szansa na Krytyk" value={`${character.stats.critChance.toFixed(1)}%`} color="text-red-400" />
                                    <StatRow label="Ataki na Rundę" value={character.stats.attacksPerRound} />
                                    <StatRow label="Penetracja Pancerza" value={`${character.stats.armorPenetrationPercent}% / ${character.stats.armorPenetrationFlat}`} color="text-gray-400" />
                                    <StatRow label="Kradzież Życia" value={`${character.stats.lifeStealPercent}% / ${character.stats.lifeStealFlat}`} color="text-green-500" />
                                    <StatRow label="Kradzież Many" value={`${character.stats.manaStealPercent}% / ${character.stats.manaStealFlat}`} color="text-blue-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-2"><ShieldIcon className="h-3 w-3" /> Defensywa</h4>
                                <div className="grid grid-cols-1 gap-1">
                                    <StatRow label="Pancerz" value={character.stats.armor} color="text-sky-300" />
                                    <StatRow label="Szansa na Blok" value={`${character.stats.blockChance.toFixed(1)}%`} color="text-sky-400" />
                                    <StatRow label="Szansa na Unik" value={`${character.stats.dodgeChance.toFixed(1)}%`} color="text-blue-400" />
                                    <StatRow label="Zdrowie" value={`${Math.ceil(character.stats.currentHealth)} / ${character.stats.maxHealth}`} color="text-green-400" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2"><SparklesIcon className="h-3 w-3" /> Bonusy Zestawów</h4>
                                <div className="grid grid-cols-1 gap-1">
                                    <StatRow label="Bonus Obrażeń" value={`+${character.stats.damageBonusPercent}%`} color="text-red-400" icon={<SwordsIcon className="h-3 w-3"/>} />
                                    <StatRow label="Redukcja Obrażeń" value={`+${character.stats.damageReductionPercent}%`} color="text-sky-400" icon={<ShieldIcon className="h-3 w-3"/>} />
                                    <StatRow label="Bonus Złota" value={`+${character.stats.goldBonusPercent}%`} color="text-amber-400" icon={<CoinsIcon className="h-3 w-3"/>} />
                                    <StatRow label="Bonus Doświadczenia" value={`+${character.stats.expBonusPercent}%`} color="text-sky-300" icon={<StarIcon className="h-3 w-3"/>} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/5 text-[9px] text-gray-500 text-center uppercase tracking-tighter">Wartości uwzględniają wszystkie aktywne bonusy.</div>
                    </div>
                </div>

                {/* Plecak */}
                <div 
                    onDragOver={(e) => handleDragOver(e, 'backpack')}
                    onDragLeave={() => handleDragLeave('backpack')}
                    onDrop={(e) => handleDrop(e, 'backpack')}
                    className={`xl:col-span-5 p-4 rounded-2xl border transition-all duration-300 flex flex-col min-h-0 ${isDragOverBackpack ? 'bg-indigo-900/20 border-indigo-500 shadow-2xl scale-[1.02]' : 'bg-slate-900/40 border-white/5'}`}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm fantasy-header font-black text-sky-400 uppercase tracking-widest">
                            Plecak
                            {isDragOverBackpack && <span className="ml-2 text-[9px] animate-pulse">Upuść, by zdjąć</span>}
                        </h3>
                        <span className="font-mono text-xs font-bold text-gray-500 bg-slate-950 px-3 py-1 rounded-full border border-white/5">{character.inventory.length} / {backpackCapacity}</span>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <select 
                            value={filterSlot} 
                            onChange={(e) => setFilterSlot(e.target.value)} 
                            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-gray-300 outline-none"
                        >
                            <option value="all">{t('market.browse.filters.all')}</option>
                            {slotOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                        <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as ItemRarity | 'all')} className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-gray-300 outline-none">
                            <option value="all">Wszystkie jakości</option>
                            {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                        </select>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
                        {filteredInventory.map(item => {
                            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return false;
                            return (
                                <div key={item.uniqueId} onContextMenu={(e) => handleRightClick(e, item, 'inventory')}>
                                    <ItemListItem 
                                        item={item} 
                                        template={template} 
                                        affixes={gameData.affixes} 
                                        isSelected={false} 
                                        onClick={() => {}} 
                                        onMouseEnter={(e) => handleMouseEnter(item, template, e)} 
                                        onMouseLeave={handleMouseLeave} 
                                        onDoubleClick={() => handleEquip(item)}
                                        source="inventory"
                                        onAction={() => handleEquip(item)}
                                        actionType="equip"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {inspectedItem && (
                <ItemTooltip 
                    instance={inspectedItem.item} 
                    template={inspectedItem.template} 
                    affixes={gameData.affixes} 
                    character={character} 
                    compareWith={getCompareItem(inspectedItem.template)} 
                    itemTemplates={gameData.itemTemplates} 
                    x={mousePos.x}
                    y={mousePos.y}
                    onMouseEnter={handleTooltipEnter}
                    onMouseLeave={handleMouseLeave}
                />
            )}

            {contextMenu && (
                <ContextMenu {...contextMenu} options={contextMenu.source === 'inventory' ? [{ label: t('equipment.equip'), action: () => handleEquip(contextMenu.item) }] : [{ label: t('equipment.unequip'), action: () => handleUnequip(contextMenu.fromSlot!) }]} onClose={() => setContextMenu(null)} />
            )}
        </ContentPanel>
    );
};
