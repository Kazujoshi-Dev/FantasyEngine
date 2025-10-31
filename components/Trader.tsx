import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, ItemInstance, ItemTemplate, GameSettings, Affix } from '../types';
import { ItemDetailsPanel, ItemList, ItemListItem, rarityStyles } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { ClockIcon } from './icons/ClockIcon';

interface TraderProps {
    character: PlayerCharacter;
    baseCharacter: PlayerCharacter;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    settings: GameSettings;
    traderInventory: ItemInstance[];
    onBuyItem: (item: ItemInstance, cost: number) => void;
    onSellItems: (items: ItemInstance[]) => void;
}

const MAX_PLAYER_INVENTORY_SIZE = 40;

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
            let itemValue = template?.value || 0;
            if (item.prefixId) {
                const prefix = affixes.find(a => a.id === item.prefixId);
                itemValue += prefix?.value || 0;
            }
            if (item.suffixId) {
                const suffix = affixes.find(a => a.id === item.suffixId);
                itemValue += suffix?.value || 0;
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
                    let itemValue = template.value;
                     if (item.prefixId) {
                        const prefix = affixes.find(a => a.id === item.prefixId);
                        itemValue += prefix?.value || 0;
                    }
                    if (item.suffixId) {
                        const suffix = affixes.find(a => a.id === item.suffixId);
                        itemValue += suffix?.value || 0;
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


export const Trader: React.FC<TraderProps> = ({ character, baseCharacter, itemTemplates, affixes, settings, traderInventory, onBuyItem, onSellItems }) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState('');
    
    const [detailsItem, setDetailsItem] = useState<{ item: ItemInstance; source: 'trader' } | null>(null);
    const [itemsToSellIds, setItemsToSellIds] = useState<Set<string>>(new Set());

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
        character.inventory.filter(i => itemsToSellIds.has(i.uniqueId)),
        [itemsToSellIds, character.inventory]
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

    const handleBuyClick = (item: ItemInstance, cost: number) => {
        if (character.inventory.length >= MAX_PLAYER_INVENTORY_SIZE) {
            alert(t('trader.inventoryFull'));
            return;
        }
        if (character.resources.gold < cost) {
            alert(t('trader.notEnoughGold'));
            return;
        }
        onBuyItem(item, cost);
        setDetailsItem(null);
    };
    
    const handleSellClick = () => {
        if (selectedItemsToSell.length > 0) {
            onSellItems(selectedItemsToSell);
            setItemsToSellIds(new Set());
        }
    }

    const renderMiddlePanel = () => {
        if (detailsItem) {
            const template = itemTemplates.find(t => t.id === detailsItem.item.templateId);
            if (!template) return null;

            let itemValue = template.value || 0;
            if (detailsItem.item.prefixId) {
                const prefix = affixes.find(a => a.id === detailsItem.item.prefixId);
                itemValue += prefix?.value || 0;
            }
            if (detailsItem.item.suffixId) {
                const suffix = affixes.find(a => a.id === detailsItem.item.suffixId);
                itemValue += suffix?.value || 0;
            }
            const cost = itemValue * 2;

            return (
                <ItemDetailsPanel item={detailsItem.item} template={template} affixes={affixes} character={character}>
                    <div className="mt-4">
                        <button
                            onClick={() => handleBuyClick(detailsItem.item, cost)}
                            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-green-700 transition-colors"
                        >
                            {t('trader.buy')} ({cost} <CoinsIcon className="inline h-4 w-4 mb-1"/>)
                        </button>
                    </div>
                </ItemDetailsPanel>
            );
        }

        if (selectedItemsToSell.length === 1) {
            const item = selectedItemsToSell[0];
            const template = itemTemplates.find(t => t.id === item.templateId);
            if (!template) return null;

            let itemValue = template.value || 0;
            if (item.prefixId) {
                const prefix = affixes.find(a => a.id === item.prefixId);
                itemValue += prefix?.value || 0;
            }
            if (item.suffixId) {
                const suffix = affixes.find(a => a.id === item.suffixId);
                itemValue += suffix?.value || 0;
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
                {/* Trader's Wares */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="text-xl font-bold text-indigo-400">{t('trader.traderWares')}</h3>
                        <div className="flex items-center text-sm text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                           <ClockIcon className="h-4 w-4 mr-2" />
                           <span className="font-mono font-bold text-white ml-1">{timeLeft}</span>
                        </div>
                    </div>
                    <ItemList
                        items={traderInventory}
                        itemTemplates={itemTemplates}
                        affixes={affixes}
                        selectedItem={detailsItem ? detailsItem.item : null}
                        onSelectItem={handleTraderItemClick}
                        showPrice="buy"
                    />
                </div>

                {/* Details Panel */}
                <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
                    {renderMiddlePanel()}
                </div>

                {/* Player's Inventory */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                         <h3 className="text-xl font-bold text-indigo-400">{t('trader.yourBag')}</h3>
                         <div className="flex items-center gap-2">
                            <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                                {character.inventory.length} / 40
                            </div>
                            <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-1 rounded-full">
                                <CoinsIcon className="h-5 w-5 text-amber-400" />
                                <span className="font-mono text-lg font-bold text-amber-400">{character.resources.gold.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                     <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                        {character.inventory.map(item => {
                            const template = itemTemplates.find(t => t.id === item.templateId);
                            if (!template) return null;
                            const isSelected = itemsToSellIds.has(item.uniqueId);
                            
                            let itemValue = template.value || 0;
                            if (item.prefixId) {
                                const prefix = affixes.find(a => a.id === item.prefixId);
                                itemValue += prefix?.value || 0;
                            }
                            if (item.suffixId) {
                                const suffix = affixes.find(a => a.id === item.suffixId);
                                itemValue += suffix?.value || 0;
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
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
         </ContentPanel>
    );
};