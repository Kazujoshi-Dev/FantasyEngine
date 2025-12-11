
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, ItemInstance, ItemTemplate, Affix, ItemRarity, GameSettings, CharacterStats } from '../types';
import { ItemDetailsPanel, ItemList, ItemListItem, rarityStyles } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { ClockIcon } from './icons/ClockIcon';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';

interface TraderProps {
    traderInventory: ItemInstance[];
    traderSpecialOfferItems: ItemInstance[];
}

const BulkSellPanel: React.FC<{
    items: ItemInstance[];
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    onSell: () => void;
}> = ({ items, itemTemplates, affixes, onSell }) => {
    const { t } = useTranslation();
    const totalValue = useMemo(() => {
        return items.reduce((sum, item) => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            let itemValue = parseInt(String(template?.value), 10) || 0;
            if (item.prefixId) {
                const prefix = affixes.find(a => a.id === item.prefixId);
                itemValue += parseInt(String(prefix?.value), 10) || 0;
            }
            if (item.suffixId) {
                const suffix = affixes.find(a => a.id === item.suffixId);
                itemValue += parseInt(String(suffix?.value), 10) || 0;
            }
            return sum + itemValue;
        }, 0);
    }, [items, itemTemplates, affixes]);

    return (
        <div className="flex flex-col h-full">
            <h4 className="font-bold text-xl mb-4 text-center text-indigo-400">
                {t('trader.sellMultipleItems', { count: items.length })}
            </h4>
            <div className="flex-grow overflow-y-auto pr-2 space-y-2 bg-slate-800/50 p-2 rounded-lg">
                {items.map(item => {
                    const template = itemTemplates.find(t => t.id === item.templateId);
                    if (!template) return null;
                    let itemValue = parseInt(String(template.value), 10) || 0;
                     if (item.prefixId) {
                        const prefix = affixes.find(a => a.id === item.prefixId);
                        itemValue += parseInt(String(prefix?.value), 10) || 0;
                    }
                    if (item.suffixId) {
                        const suffix = affixes.find(a => a.id === item.suffixId);
                        itemValue += parseInt(String(suffix?.value), 10) || 0;
                    }
                    return (
                        <div key={item.uniqueId} className="flex justify-between items-center text-sm">
                            <span className={rarityStyles[template.rarity].text}>{template.name}</span>
                            <span className="font-mono text-amber-400 flex items-center">
                                {itemValue} <CoinsIcon className="h-3 w-3 ml-1" />
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4">
                <div className="flex justify-between items-center font-bold text-lg bg-slate-800 p-3 rounded-lg">
                    <span>{t('trader.totalValue')}:</span>
                    <span className="font-mono text-amber-300 flex items-center">
                        {totalValue} <CoinsIcon className="h-5 w-5 ml-1" />
                    </span>
                </div>
                <button
                    onClick={onSell}
                    className="w-full mt-4 bg-amber-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-amber-700 transition-colors"
                >
                    {t('trader.sellAllFor', { value: totalValue })}
                </button>
            </div>
        </div>
    );
};


export const Trader: React.FC<TraderProps> = ({ traderInventory, traderSpecialOfferItems }) => {
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState('');
    
    if (!character || !baseCharacter || !gameData) return null;

    const { itemTemplates, affixes, settings } = gameData;
    
    const [detailsItem, setDetailsItem] = useState<{ item: ItemInstance; source: 'trader' } | null>(null);
    const [itemsToSellIds, setItemsToSellIds] = useState<Set<string>>(new Set());
    const backpackCapacity = 40 + ((character.backpack?.level || 1) - 1) * 10;

    const validInventory = useMemo(() => 
        (character.inventory || []).filter(item => item && itemTemplates.find(t => t.id === item.templateId)),
        [character.inventory, itemTemplates]
    );

    const meetsRequirements = useCallback((item: ItemInstance): boolean => {
        const template = itemTemplates.find(t => t.id === item.templateId);
        if (!template) return true;

        if (character.level < template.requiredLevel) {
            return false;
        }

        if (template.requiredStats) {
            for (const stat in template.requiredStats) {
                const key = stat as keyof CharacterStats;
                if (character.stats[key] < (template.requiredStats[key] || 0)) {
                    return false;
                }
            }
        }
        return true;
    }, [character, itemTemplates]);

    useEffect(() => {
        const timerId = setInterval(() => {
            const now = new Date();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const remainingMinutes = 59 - minutes;
            const remainingSeconds = 59 - seconds;
            setTimeLeft(`${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(timerId);
    }, []);

    const selectedItemsToSell = useMemo(() => 
        validInventory.filter(i => itemsToSellIds.has(i.uniqueId)),
        [itemsToSellIds, validInventory]
    );

    const handleTraderItemClick = (item: ItemInstance) => {
        setDetailsItem({ item, source: 'trader' });
        setItemsToSellIds(new Set());
    };

    const handlePlayerItemClick = (item: ItemInstance) => {
        setDetailsItem(null);
        setItemsToSellIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(item.uniqueId)) {
                newSet.delete(item.uniqueId);
            } else {
                newSet.add(item.uniqueId);
            }
            return newSet;
        });
    };

    const handleBuyClick = async (item: ItemInstance) => {
        const template = itemTemplates.find(t => t.id === item.templateId)!;
        let itemValue = template.value;
        if (item.prefixId) itemValue += affixes.find(a => a.id === item.prefixId)?.value || 0;
        if (item.suffixId) itemValue += affixes.find(a => a.id === item.suffixId)?.value || 0;
        
        const isSpecial = traderSpecialOfferItems.some(i => i.uniqueId === item.uniqueId);
        const cost = isSpecial ? itemValue * 5 : itemValue * 2;

        if ((character.inventory || []).length >= backpackCapacity) {
            alert(t('trader.inventoryFull'));
            return;
        }
        if ((character.resources?.gold || 0) < cost) {
            alert(t('trader.notEnoughGold'));
            return;
        }
        
        try {
            const updatedChar = await api.buyItem(item.uniqueId);
            updateCharacter(updatedChar);
            setDetailsItem(null);
        } catch (e: any) {
            alert(e.message);
        }
    };
    
    const handleSellClick = async () => {
        if (selectedItemsToSell.length > 0) {
            if (selectedItemsToSell.some(i => i.isBorrowed)) {
                alert('Nie można sprzedać wypożyczonego przedmiotu.');
                return;
            }
            try {
                const itemIds = selectedItemsToSell.map(i => i.uniqueId);
                const updatedChar = await api.sellItems(itemIds);
                updateCharacter(updatedChar);
                setItemsToSellIds(new Set());
            } catch (e: any) {
                alert(e.message);
            }
        }
    }

    const handleBulkSell = useCallback(async (raritiesToSell: ItemRarity[]) => {
        if (!baseCharacter || !baseCharacter.inventory) return;

        const itemsToSell = (baseCharacter.inventory || []).filter(item => {
            if (!item || item.isBorrowed) return false;
            const template = itemTemplates.find(t => t.id === item.templateId);
            return template && raritiesToSell.includes(template.rarity);
        });

        if (itemsToSell.length === 0) {
            alert(t('trader.noItemsToSellOfRarity'));
            return;
        }

        const totalValue = itemsToSell.reduce((sum, item) => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            let itemValue = parseInt(String(template?.value), 10) || 0;
            if (item.prefixId) {
                const prefix = affixes.find(a => a.id === item.prefixId);
                itemValue += parseInt(String(prefix?.value), 10) || 0;
            }
            if (item.suffixId) {
                const suffix = affixes.find(a => a.id === item.suffixId);
                itemValue += parseInt(String(suffix?.value), 10) || 0;
            }
            return sum + itemValue;
        }, 0);

        const isJunkSell = raritiesToSell.length === 2 && 
                           raritiesToSell.includes(ItemRarity.Common) && 
                           raritiesToSell.includes(ItemRarity.Uncommon);
                           
        const typesLabel = isJunkSell 
            ? t('trader.junkTypes') 
            : t(`rarity.${raritiesToSell[0]}`);

        if (window.confirm(t('trader.bulkSellConfirm', { count: itemsToSell.length, value: totalValue, types: typesLabel }))) {
            try {
                const updatedChar = await api.sellItems(itemsToSell.map(i => i.uniqueId));
                updateCharacter(updatedChar);
                setItemsToSellIds(new Set());
                setDetailsItem(null);
            } catch (e: any) {
                alert(e.message);
            }
        }
    }, [baseCharacter, itemTemplates, affixes, updateCharacter, t]);

    const renderMiddlePanel = () => {
        if (detailsItem) {
            const template = itemTemplates.find(t => t.id === detailsItem.item.templateId);
            if (!template) return null;

            return (
                <ItemDetailsPanel item={detailsItem.item} template={template} affixes={affixes} character={character}>
                    <div className="mt-4">
                        <button
                            onClick={() => handleBuyClick(detailsItem.item)}
                            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-green-700 transition-colors"
                        >
                            {t('trader.buy')}
                        </button>
                    </div>
                </ItemDetailsPanel>
            );
        }

        if (selectedItemsToSell.length === 1) {
            const item = selectedItemsToSell[0];
            const template = itemTemplates.find(t => t.id === item.templateId);
            if (!template) return null;

            let itemValue = parseInt(String(template.value), 10) || 0;
            if (item.prefixId) {
                const prefix = affixes.find(a => a.id === item.prefixId);
                itemValue += parseInt(String(prefix?.value), 10) || 0;
            }
            if (item.suffixId) {
                const suffix = affixes.find(a => a.id === item.suffixId);
                itemValue += parseInt(String(suffix?.value), 10) || 0;
            }

            return (
                <ItemDetailsPanel item={item} template={template} affixes={affixes} character={character}>
                    <div className="mt-4">
                        <button
                            onClick={handleSellClick}
                            className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-amber-700 transition-colors"
                        >
                            {t('trader.sell')} ({itemValue} <CoinsIcon className="inline h-4 w-4 mb-1"/>)
                        </button>
                    </div>
                </ItemDetailsPanel>
            );
        }
        
        if (selectedItemsToSell.length > 1) {
            return (
                <BulkSellPanel
                    items={selectedItemsToSell}
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    onSell={handleSellClick}
                />
            );
        }
        
        return <div className="flex items-center justify-center h-full text-slate-500">{t('equipment.selectItemPrompt')}</div>;
    };

    return (
         <ContentPanel title={t('trader.title')}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="text-xl font-bold text-indigo-400">{t('trader.traderWares')}</h3>
                        <div className="flex items-center text-sm text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                           <ClockIcon className="h-4 w-4 mr-2" />
                           <span className="font-mono font-bold text-white ml-1">{timeLeft}</span>
                        </div>
                    </div>
                    <h4 className="font-bold text-lg text-amber-400 mb-2 px-2">{t('trader.specialOffer.title')}</h4>
                    <div className="space-y-1 mb-4">
                        {traderSpecialOfferItems.length > 0 ? (
                            <ItemList items={traderSpecialOfferItems} itemTemplates={itemTemplates} affixes={affixes} selectedItem={detailsItem?.item || null} onSelectItem={handleTraderItemClick} showPrice="buy-special" meetsRequirements={meetsRequirements} />
                        ) : <p className="text-sm text-gray-500 px-2">Brak ofert specjalnych.</p>}
                    </div>

                    <h4 className="font-bold text-lg text-gray-300 mt-4 pt-4 border-t border-slate-700/50 mb-2 px-2">{t('trader.regularWares')}</h4>
                    {traderInventory.length > 0 ? (
                        <ItemList items={traderInventory} itemTemplates={itemTemplates} affixes={affixes} selectedItem={detailsItem?.item || null} onSelectItem={handleTraderItemClick} showPrice="buy" meetsRequirements={meetsRequirements} />
                    ) : (
                         <p className="text-sm text-gray-500 px-2">Brak towarów. Wróć później.</p>
                    )}
                </div>

                <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
                    {renderMiddlePanel()}
                </div>

                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                         <h3 className="text-xl font-bold text-indigo-400">{t('trader.yourBag')}</h3>
                         <div className="flex items-center gap-2">
                            <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                                {validInventory.length} / {backpackCapacity}
                            </div>
                            <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-1 rounded-full">
                                <CoinsIcon className="h-5 w-5 text-amber-400" />
                                <span className="font-mono text-lg font-bold text-amber-400">{(character.resources?.gold || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div className="px-2 mb-4 border-b border-slate-700/50 pb-4">
                        <h4 className="text-sm font-semibold text-gray-400 mb-2">{t('trader.bulkSellTitle')}</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <button
                                onClick={() => handleBulkSell([ItemRarity.Common, ItemRarity.Uncommon])}
                                className="w-full py-1.5 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold"
                            >
                                {t('trader.sellAllJunk')}
                            </button>
                            <button
                                onClick={() => handleBulkSell([ItemRarity.Common])}
                                className="w-full py-1.5 rounded-md bg-slate-700/80 hover:bg-slate-700 border border-slate-600 font-semibold text-gray-300"
                            >
                                {t('trader.sellAllRarity', { rarity: t('rarity.Common') })}
                            </button>
                            <button
                                onClick={() => handleBulkSell([ItemRarity.Uncommon])}
                                className="w-full py-1.5 rounded-md bg-green-900/60 hover:bg-green-800/60 border border-green-800 font-semibold text-green-400"
                            >
                                {t('trader.sellAllRarity', { rarity: t('rarity.Uncommon') })}
                            </button>
                            <button
                                onClick={() => handleBulkSell([ItemRarity.Rare])}
                                className="w-full py-1.5 rounded-md bg-sky-900/60 hover:bg-sky-800/60 border border-sky-800 font-semibold text-sky-400"
                            >
                                {t('trader.sellAllRarity', { rarity: t('rarity.Rare') })}
                            </button>
                        </div>
                    </div>
                     <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                        {validInventory.map(item => {
                            const template = itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            const isSelected = itemsToSellIds.has(item.uniqueId);
                            
                            let itemValue = parseInt(String(template.value), 10) || 0;
                            if (item.prefixId) {
                                const prefix = affixes.find(a => a.id === item.prefixId);
                                itemValue += parseInt(String(prefix?.value), 10) || 0;
                            }
                            if (item.suffixId) {
                                const suffix = affixes.find(a => a.id === item.suffixId);
                                itemValue += parseInt(String(suffix?.value), 10) || 0;
                            }

                            return (
                                <ItemListItem
                                    key={item.uniqueId}
                                    item={item}
                                    template={template}
                                    affixes={affixes}
                                    isSelected={isSelected}
                                    onClick={() => handlePlayerItemClick(item)}
                                    price={itemValue}
                                    showPrimaryStat={false}
                                    meetsRequirements={meetsRequirements(item)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
         </ContentPanel>
    );
};
