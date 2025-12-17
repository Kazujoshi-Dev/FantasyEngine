
import React, { useState, useMemo } from 'react';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { useTranslation } from '../../contexts/LanguageContext';
import { useCharacter } from '../../contexts/CharacterContext';
import { api } from '../../api';
import { getWarehouseCapacity, getWarehouseUpgradeCost } from '../../logic/stats';
import { ItemListItem } from '../shared/ItemSlot';
import { ItemRarity, EquipmentSlot, ItemInstance } from '../../types';

export const WarehousePanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter, gameData } = useCharacter();
    const { t } = useTranslation();
    const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all');
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isUpgrading, setIsUpgrading] = useState(false);
    
    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates, affixes } = gameData;
    
    const warehouse = character.warehouse || { level: 1, items: [] };
    const warehouseLevel = warehouse.level;
    const warehouseItems = warehouse.items || [];
    
    const capacity = getWarehouseCapacity(warehouseLevel);
    const upgradeCost = getWarehouseUpgradeCost(warehouseLevel);
    const canAffordUpgrade = (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const onUpgradeWarehouse = async () => {
        setIsUpgrading(true);
        try {
            const updatedChar = await api.upgradeWarehouse();
            updateCharacter(updatedChar);
        } catch (e: any) { 
            alert(e.message || t('error.title')); 
        } finally {
            setIsUpgrading(false);
        }
    };
    
    const handleDeposit = async (item: ItemInstance) => {
        try {
            const updatedChar = await api.warehouseDeposit(item.uniqueId);
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message); }
    };

    const handleWithdraw = async (item: ItemInstance) => {
        try {
            const updatedChar = await api.warehouseWithdraw(item.uniqueId);
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message); }
    };

    const filteredWarehouseItems = useMemo(() => {
        return warehouseItems.filter(item => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            if (!template) return false;
            
            const matchesRarity = filterRarity === 'all' || template.rarity === filterRarity;
            const matchesSlot = filterSlot === 'all' || template.slot === filterSlot;
            const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
            
            return matchesRarity && matchesSlot && matchesSearch;
        });
    }, [warehouseItems, itemTemplates, filterRarity, filterSlot, searchQuery]);

    const filteredBackpackItems = useMemo(() => {
        return character.inventory.filter(item => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            if (!template) return false;
            if (item.isBorrowed) return false;

            const matchesRarity = filterRarity === 'all' || template.rarity === filterRarity;
            const matchesSlot = filterSlot === 'all' || template.slot === filterSlot;
            const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
            
            return matchesRarity && matchesSlot && matchesSearch;
        });
    }, [character.inventory, itemTemplates, filterRarity, filterSlot, searchQuery]);

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                <div>
                     <h3 className="text-xl font-bold text-indigo-400 flex items-center">
                        <BriefcaseIcon className="h-6 w-6 mr-2" />
                        {t('camp.warehouse.title')}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        {t('camp.level')}: <span className="text-white font-bold">{warehouseLevel} / {10}</span> | {t('camp.backpackCapacity')}: <span className="text-white font-bold">{warehouseItems.length} / {capacity}</span>
                    </p>
                </div>
                 <div className="flex items-center gap-4">
                    {warehouseLevel < 10 && (
                        <>
                            <div className="text-right hidden md:block">
                                <p className="text-xs text-gray-500 uppercase">{t('camp.upgradeCost')}</p>
                                <p className="text-sm font-mono text-amber-400">{upgradeCost.gold.toLocaleString()}g</p>
                            </div>
                            <button 
                                onClick={onUpgradeWarehouse} 
                                disabled={!canAffordUpgrade || isUpgrading} 
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors disabled:bg-slate-700 disabled:text-gray-500"
                            >
                                {isUpgrading ? '...' : t('camp.warehouse.upgradeAction')}
                            </button>
                        </>
                    )}
                 </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <input 
                    type="text" 
                    placeholder={t('camp.warehouse.searchPlaceholder')}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={filterRarity} onChange={(e) => setFilterRarity(e.target.value as ItemRarity | 'all')}>
                    <option value="all">{t('market.browse.filters.all')}</option>
                    {(Object.values(ItemRarity) as string[]).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                </select>
                <select className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={filterSlot} onChange={(e) => setFilterSlot(e.target.value)}>
                    <option value="all">{t('market.browse.filters.all')}</option>
                    {(Object.values(EquipmentSlot) as string[]).map(s => <option key={s} value={s}>{t(`equipment.slot.${s}`)}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow min-h-0">
                <div className="bg-slate-900/40 rounded-xl p-4 border border-indigo-500/30 flex flex-col overflow-hidden">
                    <p className="text-center font-bold text-indigo-300 mb-3 pb-2 border-b border-indigo-500/30">{t('camp.warehouse.inWarehouse')} ({filteredWarehouseItems.length})</p>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {filteredWarehouseItems.length === 0 && <p className="text-gray-600 text-center text-sm py-8">{t('camp.warehouse.emptyWarehouse')}</p>}
                        {filteredWarehouseItems.map(item => {
                             const template = itemTemplates.find(t => t.id === item.templateId);
                             if (!template) return null;
                             return (
                                 <div key={item.uniqueId} className="flex justify-between items-center bg-slate-800/80 p-2 rounded-lg border border-slate-700 hover:border-slate-500 group">
                                     <div className="flex-grow overflow-hidden">
                                        <ItemListItem item={item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} className="border-0 bg-transparent p-0 hover:bg-transparent shadow-none" />
                                     </div>
                                     <button onClick={() => handleWithdraw(item)} className="ml-2 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded text-xs font-bold text-white whitespace-nowrap">{t('camp.warehouse.withdraw')}</button>
                                 </div>
                             )
                        })}
                    </div>
                </div>
                <div className="bg-slate-900/40 rounded-xl p-4 border border-green-500/30 flex flex-col overflow-hidden">
                    <p className="text-center font-bold text-green-300 mb-3 pb-2 border-b border-green-500/30">{t('camp.warehouse.inBackpack')} ({filteredBackpackItems.length})</p>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {filteredBackpackItems.length === 0 && <p className="text-gray-600 text-center text-sm py-8">{t('camp.warehouse.emptyBackpack')}</p>}
                        {filteredBackpackItems.map(item => {
                             const template = itemTemplates.find(t => t.id === item.templateId);
                             if (!template) return null;
                             return (
                                 <div key={item.uniqueId} className="flex justify-between items-center bg-slate-800/80 p-2 rounded-lg border border-slate-700 hover:border-slate-500 group">
                                     <div className="flex-grow overflow-hidden">
                                        <ItemListItem item={item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} className="border-0 bg-transparent p-0 hover:bg-transparent shadow-none" />
                                     </div>
                                     <button onClick={() => handleDeposit(item)} className="ml-2 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white whitespace-nowrap">{t('camp.warehouse.deposit')}</button>
                                 </div>
                             )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
