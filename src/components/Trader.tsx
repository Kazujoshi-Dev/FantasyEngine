
import React, { useState, useMemo, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemInstance, ItemRarity, EquipmentSlot } from '../types';
import { ItemList, ItemDetailsPanel } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { HandshakeIcon } from './icons/HandshakeIcon';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';

interface TraderProps {
    traderInventory: ItemInstance[];
    traderSpecialOfferItems: ItemInstance[];
}

export const Trader: React.FC<TraderProps> = ({ traderInventory, traderSpecialOfferItems }) => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<{ item: ItemInstance; source: 'buy' | 'sell' } | null>(null);
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all');

    // Reset selection on tab change
    useEffect(() => {
        setSelectedItem(null);
    }, [activeTab]);

    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates, affixes } = gameData;

    const handleBuy = async (item: ItemInstance) => {
        try {
            const updatedChar = await api.buyItem(item.uniqueId);
            updateCharacter(updatedChar);
            setSelectedItem(null);
            // Refresh inventory logic is handled by parent/api hook generally, 
            // but for instant feedback we rely on updatedChar from response
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSell = async (item: ItemInstance) => {
        // Simple confirmation for high value items?
        const template = itemTemplates.find(t => t.id === item.templateId);
        if (template && (template.rarity === ItemRarity.Epic || template.rarity === ItemRarity.Legendary)) {
            if (!confirm(`Czy na pewno chcesz sprzedać ${template.name}?`)) return;
        }

        try {
            const updatedChar = await api.sellItems([item.uniqueId]);
            updateCharacter(updatedChar);
            setSelectedItem(null);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSellJunk = async () => {
        const junkItems = character.inventory.filter(item => {
            if (item.isBorrowed) return false;
            const template = itemTemplates.find(t => t.id === item.templateId);
            return template && (template.rarity === ItemRarity.Common || template.rarity === ItemRarity.Uncommon);
        });

        if (junkItems.length === 0) {
            alert(t('trader.noItemsToSellOfRarity'));
            return;
        }

        const count = junkItems.length;
        let totalValue = 0;
        
        junkItems.forEach(item => {
             const template = itemTemplates.find(t => t.id === item.templateId);
             let val = Number(template?.value) || 0;
             // Add affix value calculation if needed, simplifying for junk
             totalValue += val;
        });

        if (confirm(t('trader.bulkSellConfirm', { count, types: t('trader.junkTypes'), value: totalValue }))) {
             try {
                const ids = junkItems.map(i => i.uniqueId);
                const updatedChar = await api.sellItems(ids);
                updateCharacter(updatedChar);
            } catch (e: any) {
                alert(e.message);
            }
        }
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

    // Combine regular and special items for the "Buy" list, marking specials
    const buyList = useMemo(() => {
        const regular = filterItems(traderInventory).map(i => ({ ...i, _isSpecial: false }));
        const special = filterItems(traderSpecialOfferItems).map(i => ({ ...i, _isSpecial: true }));
        return [...special, ...regular];
    }, [traderInventory, traderSpecialOfferItems, filterSlot, filterRarity, itemTemplates]);

    const sellList = useMemo(() => {
        // Exclude borrowed items from sell list
        const myItems = character.inventory.filter(i => !i.isBorrowed);
        return filterItems(myItems);
    }, [character.inventory, filterSlot, filterRarity, itemTemplates]);

    const selectedTemplate = selectedItem ? itemTemplates.find(t => t.id === selectedItem.item.templateId) : null;
    const selectedPrice = selectedItem 
        ? (selectedItem.source === 'buy' 
            ? getBuyPrice(selectedItem.item, (selectedItem.item as any)._isSpecial) 
            : getSellPrice(selectedItem.item))
        : 0;

    const canAfford = selectedItem?.source === 'buy' && character.resources.gold >= selectedPrice;

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
                            <option value="all">Wszystkie Rzadkości</option>
                            {(Object.values(ItemRarity) as string[]).map(r => (
                                <option key={r} value={r}>{t(`rarity.${r}`)}</option>
                            ))}
                        </select>
                        {activeTab === 'sell' && (
                            <button 
                                onClick={handleSellJunk}
                                className="ml-auto px-4 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs font-bold rounded border border-red-800 transition-colors"
                            >
                                {t('trader.sellAllJunk')}
                            </button>
                        )}
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2">
                        {activeTab === 'buy' ? (
                            <ItemList 
                                items={buyList} 
                                itemTemplates={itemTemplates} 
                                affixes={affixes} 
                                selectedItem={selectedItem?.item || null} 
                                onSelectItem={(item) => setSelectedItem({ item, source: 'buy' })}
                                showPrice={(item: any) => item._isSpecial ? 'buy-special' : 'buy'}
                            />
                        ) : (
                            <ItemList 
                                items={sellList} 
                                itemTemplates={itemTemplates} 
                                affixes={affixes} 
                                selectedItem={selectedItem?.item || null} 
                                onSelectItem={(item) => setSelectedItem({ item, source: 'sell' })}
                                showPrice="sell"
                            />
                        )}
                        {(activeTab === 'buy' ? buyList : sellList).length === 0 && (
                            <p className="text-gray-500 text-center py-12">Brak przedmiotów.</p>
                        )}
                    </div>
                </div>

                {/* Details Column */}
                <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col items-center border border-slate-700/50">
                    {selectedItem && selectedTemplate ? (
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
