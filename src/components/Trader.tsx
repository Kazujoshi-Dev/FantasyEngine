
import React, { useState, useMemo, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemInstance, ItemRarity, EquipmentSlot } from '../types';
import { ItemList, ItemDetailsPanel, rarityStyles, getGrammaticallyCorrectFullName } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { HandshakeIcon } from './icons/HandshakeIcon';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { SparklesIcon } from './icons/SparklesIcon';

interface TraderProps {
    traderInventory: ItemInstance[];
    traderSpecialOfferItems: ItemInstance[];
    onItemBought: () => void;
}

export const Trader: React.FC<TraderProps> = ({ traderInventory, traderSpecialOfferItems, onItemBought }) => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<{ item: ItemInstance; source: 'buy' | 'sell' } | null>(null);
    const [selectedSellIds, setSelectedSellIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all');

    // Reset selection on tab change
    useEffect(() => {
        setSelectedItem(null);
        setSelectedSellIds(new Set());
    }, [activeTab]);

    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates, affixes } = gameData;

    const handleBuy = async (item: ItemInstance) => {
        try {
            const updatedChar = await api.buyItem(item.uniqueId);
            updateCharacter(updatedChar);
            setSelectedItem(null);
            onItemBought(); // Refresh inventory list
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSell = async (item: ItemInstance) => {
        // Single sell fallback or specific item sell from details
        const template = itemTemplates.find(t => t.id === item.templateId);
        if (template && (template.rarity === ItemRarity.Epic || template.rarity === ItemRarity.Legendary)) {
            if (!confirm(t('trader.sellConfirm', { name: template.name }))) return;
        }

        try {
            const updatedChar = await api.sellItems([item.uniqueId]);
            updateCharacter(updatedChar);
            setSelectedItem(null);
            setSelectedSellIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.uniqueId);
                return newSet;
            });
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSellSelected = async () => {
        if (selectedSellIds.size === 0) return;

        const itemsToSell = character.inventory.filter(i => selectedSellIds.has(i.uniqueId));
        let totalValue = 0;
        let hasHighValue = false;

        itemsToSell.forEach(item => {
             const template = itemTemplates.find(t => t.id === item.templateId);
             if (template && (template.rarity === ItemRarity.Epic || template.rarity === ItemRarity.Legendary)) {
                 hasHighValue = true;
             }
             totalValue += getSellPrice(item);
        });

        if (hasHighValue) {
            if (!confirm(t('trader.sellHighValueConfirm', { count: itemsToSell.length, value: totalValue }))) return;
        }

        try {
            const ids = Array.from(selectedSellIds);
            const updatedChar = await api.sellItems(ids);
            updateCharacter(updatedChar);
            setSelectedSellIds(new Set());
            setSelectedItem(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSellAllByRarity = async (rarity: ItemRarity) => {
        const itemsToSell = character.inventory.filter(item => {
            if (item.isBorrowed) return false;
            const template = itemTemplates.find(t => t.id === item.templateId);
            return template && template.rarity === rarity;
        });

        if (itemsToSell.length === 0) {
            alert(t('trader.noItemsToSellOfRarity'));
            return;
        }

        let totalValue = 0;
        itemsToSell.forEach(item => {
             totalValue += getSellPrice(item);
        });

        if (confirm(t('trader.bulkSellConfirm', { count: itemsToSell.length, types: t(`rarity.${rarity}`), value: totalValue }))) {
             try {
                const ids = itemsToSell.map(i => i.uniqueId);
                const updatedChar = await api.sellItems(ids);
                updateCharacter(updatedChar);
                // Also clear these from selection if they were selected
                setSelectedSellIds(prev => {
                    const newSet = new Set(prev);
                    ids.forEach(id => newSet.delete(id));
                    return newSet;
                });
            } catch (e: any) {
                alert(e.message);
            }
        }
    };

    const handleItemClick = (item: ItemInstance, source: 'buy' | 'sell') => {
        if (source === 'sell') {
            setSelectedSellIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(item.uniqueId)) {
                    newSet.delete(item.uniqueId);
                } else {
                    newSet.add(item.uniqueId);
                }
                return newSet;
            });
            // Update preview to show the last clicked item if selecting, 
            // BUT if we are deselecting the currently viewed item, we might want to switch view or keep it.
            // For simplicity, we just set it as "last interacted".
            setSelectedItem({ item, source: 'sell' });
        } else {
            // In Buy mode, single selection
            setSelectedItem({ item, source: 'buy' });
        }
    };

    const handleDeselectOne = (uniqueId: string) => {
        setSelectedSellIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(uniqueId);
            return newSet;
        });
    };

    const getSellPrice = (item: ItemInstance) => {
        const template = itemTemplates.find(t => t.id === item.templateId);
        if (!template) return 0;
        let val = Number(template.value) || 0;
        
        if (item.prefixId) {
            const prefix = affixes.find(a => a.id === item.prefixId);
            if (prefix) val += (prefix.value || 0);
        }
        if (item.suffixId) {
            const suffix = affixes.find(a => a.id === item.suffixId);
            if (suffix) val += (suffix.value || 0);
        }
        return val;
    };

    const getBuyPrice = (item: ItemInstance, isSpecial: boolean) => {
        const sellPrice = getSellPrice(item);
        return sellPrice * (isSpecial ? 5 : 2);
    };

    const filterItems = (items: ItemInstance[]) => {
        return items.filter(item => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            if (!template) return false;
            
            const slotMatch = filterSlot === 'all' || template.slot === filterSlot;
            const rarityMatch = filterRarity === 'all' || template.rarity === filterRarity;
            
            return slotMatch && rarityMatch;
        });
    };

    // Separate filtered lists for Buy tab
    const filteredSpecialOffers = useMemo(() => {
        return filterItems(traderSpecialOfferItems).map(i => ({ ...i, _isSpecial: true }));
    }, [traderSpecialOfferItems, filterSlot, filterRarity, itemTemplates]);

    const filteredRegularWares = useMemo(() => {
        return filterItems(traderInventory).map(i => ({ ...i, _isSpecial: false }));
    }, [traderInventory, filterSlot, filterRarity, itemTemplates]);

    const sellList = useMemo(() => {
        // Exclude borrowed items from sell list
        const myItems = character.inventory.filter(i => !i.isBorrowed);
        return filterItems(myItems);
    }, [character.inventory, filterSlot, filterRarity, itemTemplates]);

    const selectedTemplate = selectedItem ? itemTemplates.find(t => t.id === selectedItem.item.templateId) : null;
    
    // Calculate total value of selected sell items
    const selectedItemsList = useMemo(() => {
        if (activeTab !== 'sell') return [];
        return character.inventory.filter(i => selectedSellIds.has(i.uniqueId));
    }, [selectedSellIds, character.inventory, activeTab]);

    const selectedSellValue = useMemo(() => {
        return selectedItemsList.reduce((sum, item) => sum + getSellPrice(item), 0);
    }, [selectedItemsList, gameData]);

    const selectedPrice = selectedItem 
        ? (selectedItem.source === 'buy' 
            ? getBuyPrice(selectedItem.item, (selectedItem.item as any)._isSpecial) 
            : getSellPrice(selectedItem.item))
        : 0;

    const canAfford = selectedItem?.source === 'buy' && character.resources.gold >= selectedPrice;

    // Determine what to render in the right column
    const isMultiSellMode = activeTab === 'sell' && selectedSellIds.size > 1;

    return (
        <ContentPanel title={t('trader.title')}>
            <div className="flex border-b border-slate-700 mb-6">
                <button
                    onClick={() => setActiveTab('buy')}
                    className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'buy' ? 'border-amber-400 text-white bg-slate-800/50' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    <HandshakeIcon className="h-4 w-4" /> {t('trader.buy')}
                </button>
                <button
                    onClick={() => setActiveTab('sell')}
                    className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'sell' ? 'border-indigo-500 text-white bg-slate-800/50' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    <CoinsIcon className="h-4 w-4" /> {t('trader.sell')}
                </button>
                <div className="flex-grow flex items-center justify-end px-4 gap-4">
                     <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1 rounded-full border border-amber-500/30">
                        <CoinsIcon className="h-5 w-5 text-amber-400" />
                        <span className="font-mono text-lg font-bold text-amber-400">{character.resources.gold.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[65vh]">
                {/* Inventory Column */}
                <div className="xl:col-span-2 bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0 border border-slate-700/50">
                    {/* Filters */}
                    <div className="flex gap-4 mb-4">
                        <select 
                            className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={filterSlot}
                            onChange={(e) => setFilterSlot(e.target.value)}
                        >
                            <option value="all">{t('equipment.showAll')}</option>
                            {(Object.values(EquipmentSlot) as string[]).map(slot => (
                                <option key={slot} value={slot}>{t(`equipment.slot.${slot}`)}</option>
                            ))}
                        </select>
                        <select 
                            className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={filterRarity}
                            onChange={(e) => setFilterRarity(e.target.value as ItemRarity | 'all')}
                        >
                            <option value="all">{t('market.browse.filters.all')}</option>
                            {(Object.values(ItemRarity) as string[]).map(r => (
                                <option key={r} value={r}>{t(`rarity.${r}`)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        {activeTab === 'buy' ? (
                            <>
                                {filteredSpecialOffers.length > 0 && (
                                    <div className="bg-gradient-to-r from-amber-900/30 to-transparent p-3 rounded-lg border border-amber-600/40">
                                        <h4 className="text-amber-400 font-bold mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                                            <SparklesIcon className="h-4 w-4" /> {t('trader.specialOffer.title')}
                                        </h4>
                                        <ItemList 
                                            items={filteredSpecialOffers} 
                                            itemTemplates={itemTemplates} 
                                            affixes={affixes} 
                                            selectedItem={selectedItem?.item || null} 
                                            onSelectItem={(item) => handleItemClick(item, 'buy')}
                                            showPrice={(item: any) => 'buy-special'}
                                        />
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-gray-400 font-bold mb-2 text-sm uppercase tracking-wider px-2">
                                        {t('trader.regularWares')}
                                    </h4>
                                    <ItemList 
                                        items={filteredRegularWares} 
                                        itemTemplates={itemTemplates} 
                                        affixes={affixes} 
                                        selectedItem={selectedItem?.item || null} 
                                        onSelectItem={(item) => handleItemClick(item, 'buy')}
                                        showPrice={(item: any) => 'buy'}
                                    />
                                    {filteredRegularWares.length === 0 && filteredSpecialOffers.length === 0 && (
                                        <p className="text-gray-500 text-center py-12">Brak przedmiotów.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <ItemList 
                                items={sellList} 
                                itemTemplates={itemTemplates} 
                                affixes={affixes} 
                                selectedItem={selectedItem?.item || null} 
                                selectedIds={selectedSellIds}
                                onSelectItem={(item) => handleItemClick(item, 'sell')}
                                showPrice="sell"
                            />
                        )}
                        {activeTab === 'sell' && sellList.length === 0 && (
                             <p className="text-gray-500 text-center py-12">{t('trader.noItemsToSellOfRarity').replace('tej rzadkości ', '')}</p>
                        )}
                    </div>
                </div>

                {/* Details Column */}
                <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col items-center border border-slate-700/50">
                    
                    {activeTab === 'sell' && !isMultiSellMode && (
                        <div className="w-full mb-6 pb-6 border-b border-slate-700/50">
                             <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider text-center">{t('trader.bulkSellTitle')}</h4>
                             <div className="grid grid-cols-2 gap-2 mb-2">
                                {(Object.values(ItemRarity) as ItemRarity[]).filter(r => r !== ItemRarity.Legendary).map(rarity => (
                                    <button 
                                        key={rarity}
                                        onClick={() => handleSellAllByRarity(rarity)}
                                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-gray-300 rounded border border-slate-600 transition-colors"
                                    >
                                        {t('trader.sellAllRarity', { rarity: t(`rarity.${rarity}`) })}
                                    </button>
                                ))}
                             </div>
                        </div>
                    )}
                    
                    {isMultiSellMode ? (
                        /* MULTI-SELECT SUMMARY VIEW */
                        <div className="w-full flex flex-col h-full animate-fade-in">
                            <h3 className="text-xl font-bold text-gray-200 mb-4 px-2 border-b border-slate-700 pb-2 flex justify-between items-center">
                                <span>{t('market.summary')}</span>
                                <span className="text-sm font-normal text-gray-400">{t('market.selectedCount', { count: selectedSellIds.size })}</span>
                            </h3>
                            
                            <div className="flex-grow overflow-y-auto pr-2 space-y-2 mb-4 custom-scrollbar">
                                {selectedItemsList.map(item => {
                                    const template = itemTemplates.find(t => t.id === item.templateId);
                                    if (!template) return null;
                                    const price = getSellPrice(item);
                                    const fullName = getGrammaticallyCorrectFullName(item, template, affixes);
                                    const { text: rarityColor } = rarityStyles[template.rarity];

                                    return (
                                        <div key={item.uniqueId} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <img src={template.icon} alt={template.name} className="w-8 h-8 object-contain bg-slate-900 rounded" />
                                                <span className={`text-sm font-medium truncate ${rarityColor}`}>{fullName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="font-mono text-amber-400 text-sm">{price}</span>
                                                <button 
                                                    onClick={() => handleDeselectOne(item.uniqueId)}
                                                    className="text-gray-500 hover:text-red-400 p-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-700">
                                <div className="flex justify-between items-center mb-4 text-lg">
                                    <span className="text-gray-300 font-medium">
                                        {t('trader.totalValue')}:
                                    </span>
                                    <span className="font-mono font-bold flex items-center text-amber-400 text-xl">
                                        {selectedSellValue.toLocaleString()} <CoinsIcon className="h-6 w-6 ml-1"/>
                                    </span>
                                </div>
                                <button 
                                    onClick={handleSellSelected}
                                    className="w-full py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded shadow-lg transition-all transform hover:scale-[1.02]"
                                >
                                    {t('trader.sellSelected', { count: selectedSellIds.size })}
                                </button>
                            </div>
                        </div>

                    ) : selectedItem && selectedTemplate ? (
                        /* SINGLE ITEM DETAIL VIEW */
                        <div className="w-full flex flex-col h-full">
                            <div className="flex-grow">
                                <ItemDetailsPanel 
                                    item={selectedItem.item} 
                                    template={selectedTemplate} 
                                    affixes={affixes} 
                                    character={character}
                                    title={selectedItem.source === 'buy' ? t('trader.buy') : t('trader.sell')}
                                />
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <div className="flex justify-between items-center mb-4 text-lg">
                                    <span className="text-gray-300 font-medium">
                                        {selectedItem.source === 'buy' ? t('trader.buyPrice') : t('trader.sellPrice')}:
                                    </span>
                                    <span className={`font-mono font-bold flex items-center ${selectedItem.source === 'buy' && !canAfford ? 'text-red-400' : 'text-amber-400'}`}>
                                        {selectedPrice.toLocaleString()} <CoinsIcon className="h-5 w-5 ml-1"/>
                                    </span>
                                </div>

                                {selectedItem.source === 'buy' ? (
                                    <button 
                                        onClick={() => handleBuy(selectedItem.item)}
                                        disabled={!canAfford}
                                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
                                    >
                                        {t('trader.buy')}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleSell(selectedItem.item)}
                                        className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-lg transition-all hover:scale-[1.02]"
                                    >
                                        {t('trader.sell')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* EMPTY STATE */
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <HandshakeIcon className="h-16 w-16 mb-4 opacity-50" />
                            <p>{t('equipment.selectItemPrompt')}</p>
                        </div>
                    )}
                </div>
            </div>
        </ContentPanel>
    );
};
