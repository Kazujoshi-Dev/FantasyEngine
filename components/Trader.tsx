import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, ItemInstance, ItemTemplate, GameSettings } from '../types';
import { ItemList, ItemDetailsPanel } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { ClockIcon } from './icons/ClockIcon';

interface TraderProps {
    character: PlayerCharacter;
    itemTemplates: ItemTemplate[];
    settings: GameSettings;
    traderInventory: ItemInstance[];
    onBuyItem: (item: ItemInstance, cost: number) => void;
    onSellItem: (item: ItemInstance, value: number) => void;
}

const MAX_PLAYER_INVENTORY_SIZE = 40;

export const Trader: React.FC<TraderProps> = ({ character, itemTemplates, settings, traderInventory, onBuyItem, onSellItem }) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState('');
    
    const [selected, setSelected] = useState<{ item: ItemInstance; source: 'trader' | 'player' } | null>(null);

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

    const selectedTemplate = useMemo(() => {
        if (!selected) return null;
        return itemTemplates.find(t => t.id === selected.item.templateId) || null;
    }, [selected, itemTemplates]);

    const handleSelectItem = (item: ItemInstance, source: 'trader' | 'player') => {
        setSelected({ item, source });
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
        setSelected(null);
    };
    
    const handleSellClick = (item: ItemInstance, value: number) => {
        onSellItem(item, value);
        setSelected(null);
    }

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
                        selectedItem={selected?.source === 'trader' ? selected.item : null}
                        onSelectItem={(item) => handleSelectItem(item, 'trader')}
                        showPrice="buy"
                    />
                </div>

                {/* Details Panel */}
                <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
                    <ItemDetailsPanel item={selected?.item} template={selectedTemplate}>
                        {selected && selectedTemplate && (
                            <div className="mt-4">
                                {selected.source === 'trader' ? (
                                    <button
                                        onClick={() => handleBuyClick(selected.item, selectedTemplate.value * 2)}
                                        className="w-full bg-green-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-green-700 transition-colors"
                                    >
                                        {t('trader.buy')} ({selectedTemplate.value * 2} <CoinsIcon className="inline h-4 w-4 mb-1"/>)
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSellClick(selected.item, selectedTemplate.value)}
                                        className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-amber-700 transition-colors"
                                    >
                                        {t('trader.sell')} ({selectedTemplate.value} <CoinsIcon className="inline h-4 w-4 mb-1"/>)
                                    </button>
                                )}
                            </div>
                        )}
                    </ItemDetailsPanel>
                </div>

                {/* Player's Inventory */}
                <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-4 px-2">
                         <h3 className="text-xl font-bold text-indigo-400">{t('trader.yourBag')}</h3>
                         <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-1 rounded-full">
                            <CoinsIcon className="h-5 w-5 text-amber-400" />
                            <span className="font-mono text-lg font-bold text-amber-400">{character.resources.gold.toLocaleString()}</span>
                         </div>
                    </div>
                    <ItemList
                        items={character.inventory}
                        itemTemplates={itemTemplates}
                        selectedItem={selected?.source === 'player' ? selected.item : null}
                        onSelectItem={(item) => handleSelectItem(item, 'player')}
                        showPrice="sell"
                    />
                </div>
            </div>
         </ContentPanel>
    );
};