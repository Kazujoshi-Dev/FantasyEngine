import React, { useState } from 'react';
import { AnvilIcon } from '../icons/AnvilIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { useTranslation } from '../../contexts/LanguageContext';
import { useCharacter } from '../../contexts/CharacterContext';
import { api } from '../../api';
import { getWorkshopUpgradeCost } from '../../logic/stats';
import { calculateCraftingCost, calculateReforgeCost } from '../../logic/crafting_frontend_helper';
import { rarityStyles, ItemListItem, ItemDetailsPanel } from '../shared/ItemSlot';
import { EquipmentSlot, ItemRarity, CharacterClass, ItemInstance, EssenceType } from '../../types';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const WorkshopPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter, gameData } = useCharacter();
    const { t } = useTranslation();
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [craftingSlot, setCraftingSlot] = useState<EquipmentSlot | 'ring' | 'consumable'>(EquipmentSlot.MainHand);
    const [craftingRarity, setCraftingRarity] = useState<ItemRarity>(ItemRarity.Common);
    const [reforgeTab, setReforgeTab] = useState<'values' | 'affixes'>('values');
    const [selectedReforgeItem, setSelectedReforgeItem] = useState<ItemInstance | null>(null);
    const [lastCraftedItem, setLastCraftedItem] = useState<ItemInstance | null>(null);

    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates, affixes } = gameData;
    
    const workshop = character.workshop || { level: 0 };
    const level = workshop.level;
    const maxLevel = 10;
    const isMaxLevel = level >= maxLevel;
    const settings = gameData.settings?.crafting;
    const upgradeCost = isMaxLevel ? { gold: Infinity, essences: [] } : getWorkshopUpgradeCost(level + 1, settings);
    
    const canAffordUpgrade = !isMaxLevel && 
        (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && 
        upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const onUpgradeWorkshop = async () => {
        setIsUpgrading(true);
        try {
            const updated = await api.upgradeWorkshop();
            updateCharacter(updated);
        } catch(e:any) { alert(e.message); }
        finally { setIsUpgrading(false); }
    };

    const craftingCost = calculateCraftingCost(craftingRarity, character, settings);
    const canAffordCraft = (character.resources.gold >= craftingCost.gold) && craftingCost.essences.every(e => (character.resources[e.type] || 0) >= e.amount);
    
    const isRarityUnlocked = (r: ItemRarity) => {
        if (r === ItemRarity.Rare) return level >= 3;
        if (r === ItemRarity.Epic) return level >= 5;
        if (r === ItemRarity.Legendary) return level >= 7;
        return true;
    };

    const handleCraft = async () => {
        if (!isRarityUnlocked(craftingRarity)) return alert(t('camp.workshop.lowLevel'));
        if (!canAffordCraft) return alert(t('camp.workshop.noResources'));
        setIsProcessing(true);
        try {
            const { character: updatedChar, item } = await api.craftItem(craftingSlot, craftingRarity);
            updateCharacter(updatedChar);
            setLastCraftedItem(item);
            setSelectedReforgeItem(null); 
        } catch(e:any) { alert(e.message); }
        finally { setIsProcessing(false); }
    };

    const reforgeUnlocked = level >= 10;
    const backpackItems = character.inventory.filter(i => !i.isBorrowed);

    const reforgeCost = selectedReforgeItem && gameData.itemTemplates 
        ? calculateReforgeCost(selectedReforgeItem, reforgeTab, character, gameData.itemTemplates.find(t=>t.id===selectedReforgeItem.templateId)!, settings) 
        : null;

    const canAffordReforge = reforgeCost 
        ? (character.resources.gold >= reforgeCost.gold && reforgeCost.essences.every(e => (character.resources[e.type] || 0) >= e.amount))
        : false;

    const handleReforge = async () => {
        if (!selectedReforgeItem || isProcessing) return;
        setIsProcessing(true);
        try {
            const updated = await api.reforgeItem(selectedReforgeItem.uniqueId, reforgeTab);
            
            // CRITICAL FIX: After reforge, the item in selectedReforgeItem is stale (old reference).
            // We must find the updated item in the new character inventory to refresh the preview.
            const updatedItem = updated.inventory.find(i => i.uniqueId === selectedReforgeItem.uniqueId);
            
            updateCharacter(updated);
            if (updatedItem) {
                setSelectedReforgeItem(updatedItem);
            }
            
            // Visual feedback
            const reforgeEffect = document.getElementById('reforge-preview-container');
            if (reforgeEffect) {
                reforgeEffect.classList.add('brightness-150', 'scale-105');
                setTimeout(() => reforgeEffect.classList.remove('brightness-150', 'scale-105'), 300);
            }

        } catch(e:any) { alert(e.message); }
        finally { setIsProcessing(false); }
    };

    const previewItem = selectedReforgeItem || lastCraftedItem;
    const previewTemplate = previewItem ? itemTemplates.find(t => t.id === previewItem.templateId) : null;

    return (
        <div className="flex flex-col h-full animate-fade-in overflow-hidden">
            
            <div className="bg-slate-900/60 p-4 rounded-xl border border-indigo-500/30 mb-6 flex flex-col md:flex-row gap-6 items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600/20 p-4 rounded-full border border-indigo-500/50">
                        <AnvilIcon className="h-10 w-10 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-white">{t('camp.workshop.title')}</h2>
                        <p className="text-indigo-300 font-mono">Poziom {level} <span className="text-gray-500 font-sans">/ {maxLevel}</span></p>
                    </div>
                </div>

                <div className="flex-grow grid grid-cols-2 lg:grid-cols-4 gap-2 text-[10px] uppercase tracking-tighter">
                    <div className={`p-2 rounded border ${level >= 3 ? 'bg-indigo-900/20 border-indigo-500/50 text-indigo-200' : 'bg-slate-800/40 border-slate-700 text-gray-600'}`}>Lvl 3: Rzadkie</div>
                    <div className={`p-2 rounded border ${level >= 5 ? 'bg-purple-900/20 border-purple-500/50 text-purple-200' : 'bg-slate-800/40 border-slate-700 text-gray-600'}`}>Lvl 5: Epickie</div>
                    <div className={`p-2 rounded border ${level >= 7 ? 'bg-amber-900/20 border-amber-500/50 text-amber-200' : 'bg-slate-800/40 border-slate-700 text-gray-600'}`}>Lvl 7: Legendarne</div>
                    <div className={`p-2 rounded border ${level >= 10 ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-200' : 'bg-slate-800/40 border-slate-700 text-gray-600'}`}>Lvl 10: Przekuwanie</div>
                </div>

                {!isMaxLevel && (
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 flex items-center gap-4 min-w-fit">
                         <div className="text-xs space-y-1">
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-500">Złoto:</span>
                                <span className={`font-mono font-bold ${(baseCharacter.resources.gold || 0) >= upgradeCost.gold ? 'text-amber-400' : 'text-red-400'}`}>{upgradeCost.gold.toLocaleString()}</span>
                            </div>
                            {upgradeCost.essences.map(e => (
                                <div key={e.type} className="flex justify-between gap-4">
                                    <span className={`${rarityStyles[essenceToRarityMap[e.type]].text}`}>{t(`resources.${e.type}`)}:</span>
                                    <span className={`font-mono font-bold ${(baseCharacter.resources[e.type] || 0) >= e.amount ? 'text-sky-400' : 'text-red-400'}`}>{e.amount}</span>
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={onUpgradeWorkshop} 
                            disabled={!canAffordUpgrade || isUpgrading} 
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-xs text-white disabled:bg-slate-700 transition-colors shadow-lg shadow-indigo-900/20"
                        >
                            {isUpgrading ? '...' : t('camp.upgrade')}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden pb-4">
                
                <div className="bg-slate-900/40 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/30 flex justify-between items-center">
                        <h3 className="font-bold text-purple-400 text-sm uppercase tracking-wider">{t('camp.workshop.reforgeTitle')}</h3>
                        {!reforgeUnlocked && <span className="text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 px-2 py-0.5 rounded">Zablokowane</span>}
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                        {reforgeUnlocked ? (
                            <>
                                <div className="flex mb-4 bg-slate-800 p-1 rounded-lg">
                                    <button onClick={() => setReforgeTab('values')} className={`flex-1 py-1.5 text-xs font-bold rounded ${reforgeTab === 'values' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>{t('camp.workshop.reforgeTabValues')}</button>
                                    <button onClick={() => setReforgeTab('affixes')} className={`flex-1 py-1.5 text-xs font-bold rounded ${reforgeTab === 'affixes' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>{t('camp.workshop.reforgeTabAffixes')}</button>
                                </div>
                                
                                <div className="space-y-1">
                                    {backpackItems.length === 0 && <p className="text-gray-600 text-center py-8 italic text-sm">{t('camp.workshop.reforgeEmptyBackpack')}</p>}
                                    {backpackItems.map(item => {
                                        const tmpl = itemTemplates.find(t=>t.id===item.templateId);
                                        if(!tmpl) return null;
                                        return (
                                            <div 
                                                key={item.uniqueId} 
                                                onClick={() => { setSelectedReforgeItem(item); setLastCraftedItem(null); }}
                                                className={`p-1 rounded cursor-pointer border transition-all ${selectedReforgeItem?.uniqueId === item.uniqueId ? 'bg-indigo-900/40 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'}`}
                                            >
                                                <ItemListItem item={item} template={tmpl} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} className="border-0 bg-transparent p-1 shadow-none pointer-events-none"/>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-center p-8">
                                <p className="text-gray-500 text-sm italic">{t('camp.workshop.reforgeLocked')}</p>
                            </div>
                        )}
                    </div>

                    {selectedReforgeItem && reforgeCost && (
                        <div className="p-4 bg-slate-800/60 border-t border-slate-700 animate-fade-in">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs text-gray-400 font-bold uppercase">{t('camp.workshop.reforgeCost')}</span>
                                <div className="flex gap-2">
                                    <span className="text-amber-400 font-mono font-bold flex items-center gap-1 text-sm">{reforgeCost.gold} <CoinsIcon className="h-3 w-3"/></span>
                                    {reforgeCost.essences.map(e => (
                                        <span key={e.type} className={`${rarityStyles[essenceToRarityMap[e.type]].text} font-mono font-bold text-sm`}>{e.amount}x</span>
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={handleReforge}
                                disabled={!canAffordReforge || isProcessing}
                                className="w-full py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-white font-bold text-sm transition-all shadow-lg shadow-purple-900/30 disabled:bg-slate-700 disabled:shadow-none"
                            >
                                {isProcessing ? 'Przetwarzanie...' : t('camp.workshop.reforgeAction')}
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-slate-900/20 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/30">
                        <h3 className="font-bold text-indigo-300 text-sm uppercase tracking-wider text-center">Podgląd Przedmiotu</h3>
                    </div>
                    
                    <div id="reforge-preview-container" className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-slate-900/10 transition-all duration-300">
                        {previewItem && previewTemplate ? (
                            <div className="animate-fade-in h-full" key={previewItem.uniqueId + JSON.stringify(previewItem.rolledBaseStats)}>
                                <ItemDetailsPanel 
                                    item={previewItem} 
                                    template={previewTemplate} 
                                    affixes={affixes} 
                                    character={character} 
                                    compact={true}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                <BriefcaseIcon className="h-16 w-16 mb-4 text-gray-500" />
                                <p className="text-gray-500 text-sm">Wybierz przedmiot do przekucia lub wytwórz nowy, aby zobaczyć podgląd.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900/40 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/30">
                        <h3 className="font-bold text-green-400 text-sm uppercase tracking-wider">{t('camp.workshop.craftingTitle')}</h3>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">{t('camp.workshop.categorySlot')}</label>
                            <select 
                                value={craftingSlot} 
                                onChange={e => setCraftingSlot(e.target.value as any)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-green-500 outline-none"
                            >
                                <option value={EquipmentSlot.MainHand}>{t('item.slot.mainHand')}</option>
                                <option value={EquipmentSlot.OffHand}>{t('item.slot.offHand')}</option>
                                <option value={EquipmentSlot.TwoHand}>{t('item.slot.twoHand')}</option>
                                <option value={EquipmentSlot.Head}>{t('item.slot.head')}</option>
                                <option value={EquipmentSlot.Chest}>{t('item.slot.chest')}</option>
                                <option value={EquipmentSlot.Legs}>{t('item.slot.legs')}</option>
                                <option value={EquipmentSlot.Feet}>{t('item.slot.feet')}</option>
                                <option value={EquipmentSlot.Hands}>{t('item.slot.hands')}</option>
                                <option value={EquipmentSlot.Waist}>{t('item.slot.waist')}</option>
                                <option value={EquipmentSlot.Neck}>{t('item.slot.neck')}</option>
                                <option value="ring">{t('item.slot.ring')}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">{t('camp.workshop.rarity')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(ItemRarity).map(r => {
                                    const unlocked = isRarityUnlocked(r);
                                    const style = rarityStyles[r];
                                    return (
                                        <button 
                                            key={r}
                                            onClick={() => setCraftingRarity(r)}
                                            disabled={!unlocked}
                                            className={`
                                                py-2 px-1 rounded border text-[10px] font-bold transition-all
                                                ${craftingRarity === r ? `${style.bg} ${style.border} text-white ring-1 ring-white shadow-md` : 'bg-slate-800/60 border-slate-700 text-gray-500'}
                                                ${!unlocked ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:opacity-80'}
                                            `}
                                        >
                                            {t(`rarity.${r}`)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-800/60 border-t border-slate-700">
                        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700 mb-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-500 font-bold uppercase">{t('camp.workshop.cost')}</span>
                                {character.characterClass === CharacterClass.Engineer && (
                                    <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 rounded">Bonus Inżyniera -20%</span>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-400 text-xs"><CoinsIcon className="h-3.5 w-3.5 mr-1.5 text-amber-500" />{t('resources.gold')}</span>
                                    <span className={`font-mono font-bold text-sm ${(character.resources.gold || 0) >= craftingCost.gold ? 'text-amber-400' : 'text-red-400'}`}>
                                        {craftingCost.gold.toLocaleString()}
                                    </span>
                                </div>
                                {craftingCost.essences.map(e => (
                                    <div key={e.type} className="flex justify-between items-center">
                                        <span className={`${rarityStyles[essenceToRarityMap[e.type]].text} text-xs`}>{t(`resources.${e.type}`)}</span>
                                        <span className={`font-mono font-bold text-sm ${(character.resources[e.type] || 0) >= e.amount ? 'text-white' : 'text-red-400'}`}>
                                            {e.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={handleCraft} 
                            disabled={!canAffordCraft || !isRarityUnlocked(craftingRarity) || isProcessing}
                            className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg shadow-lg shadow-green-900/20 transition-all hover:scale-[1.01] active:scale-95 disabled:bg-slate-700 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            <AnvilIcon className="h-5 w-5"/> {isProcessing ? 'Wytwarzanie...' : t('camp.workshop.action')}
                        </button>
                    </div>
                </div>

            </div>

        </div>
    );
};