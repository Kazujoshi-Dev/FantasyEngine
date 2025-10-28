import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, ItemInstance, ItemTemplate, ItemRarity, EssenceType, EquipmentSlot } from '../types';
import { ItemList, ItemDetailsPanel, ItemListItem } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { AnvilIcon } from './icons/AnvilIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { rarityStyles } from './shared/ItemSlot';

type BlacksmithTab = 'disenchant' | 'upgrade';
type NotificationType = { message: string; type: 'success' | 'error' };

interface BlacksmithProps {
    character: PlayerCharacter;
    itemTemplates: ItemTemplate[];
    onDisenchantItem: (item: ItemInstance) => { success: boolean; amount?: number; essenceType?: EssenceType };
    onUpgradeItem: (item: ItemInstance) => { success: boolean; messageKey: string; level?: number };
}

const getPotentialYield = (rarity: ItemRarity): [string, EssenceType | null] => {
    switch (rarity) {
        case ItemRarity.Common: return ['1-4', EssenceType.Common];
        case ItemRarity.Uncommon: return ['1-2', EssenceType.Uncommon];
        case ItemRarity.Rare: return ['1-2', EssenceType.Rare];
        case ItemRarity.Epic: return ['1', EssenceType.Epic];
        case ItemRarity.Legendary: return ['0-1 (50%)', EssenceType.Legendary];
        default: return ['', null];
    }
};

const DisenchantPanel: React.FC<{
    character: PlayerCharacter;
    itemTemplates: ItemTemplate[];
    onDisenchantItem: BlacksmithProps['onDisenchantItem'];
    setNotification: (notification: NotificationType | null) => void;
}> = ({ character, itemTemplates, onDisenchantItem, setNotification }) => {
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);

    const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
        [EssenceType.Common]: ItemRarity.Common,
        [EssenceType.Uncommon]: ItemRarity.Uncommon,
        [EssenceType.Rare]: ItemRarity.Rare,
        [EssenceType.Epic]: ItemRarity.Epic,
        [EssenceType.Legendary]: ItemRarity.Legendary,
    };

    const handleDisenchantClick = () => {
        if (!selectedItem) return;
        
        const result = onDisenchantItem(selectedItem);
        
        if (result.success && result.amount && result.essenceType) {
            setNotification({
                message: t('blacksmith.disenchantSuccess', { amount: result.amount, essenceName: t(`resources.${result.essenceType}`) }),
                type: 'success'
            });
        } else {
            setNotification({
                message: t('blacksmith.disenchantFailure'),
                type: 'error'
            });
        }
        setSelectedItem(null);
    };
    
    const selectedTemplate = selectedItem ? itemTemplates.find(t=> t.id === selectedItem.templateId) : null;
    const disenchantCost = selectedTemplate ? Math.round(selectedTemplate.value * 0.1) : 0;
    const [yieldAmount, yieldEssenceType] = selectedTemplate ? getPotentialYield(selectedTemplate.rarity) : ['', null];
    
    const yieldRarity = yieldEssenceType ? essenceToRarityMap[yieldEssenceType] : null;
    const textColorClass = yieldRarity ? rarityStyles[yieldRarity].text : 'text-gray-300';

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-fade-in h-[70vh]">
             <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                 <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('blacksmith.yourBag')}</h3>
                <ItemList
                    items={character.inventory}
                    itemTemplates={itemTemplates}
                    selectedItem={selectedItem}
                    onSelectItem={setSelectedItem}
                />
            </div>
            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col items-center justify-start text-center min-h-0">
                 <AnvilIcon className="h-10 w-10 text-slate-500 mb-2" />
                 {selectedTemplate && selectedItem ? (
                     <div className="w-full max-w-sm">
                         <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('blacksmith.disenchantItem')}</h3>
                         
                         <ItemDetailsPanel item={selectedItem} template={selectedTemplate} showIcon={false}/>

                         <div className="space-y-3 bg-slate-800/50 p-4 rounded-lg mt-6">
                             <div className="flex justify-between text-lg"><span className="text-gray-300">{t('blacksmith.disenchantCost')}</span><span className="font-mono font-bold text-amber-400 flex items-center">{disenchantCost} <CoinsIcon className="h-4 w-4 ml-1" /></span></div>
                             <div className="flex justify-between text-lg">
                                <span className="text-gray-300">{t('blacksmith.potentialYield')}</span>
                                <span className={`font-mono font-bold ${textColorClass}`}>{yieldAmount} {yieldEssenceType ? t(`resources.${yieldEssenceType}`) : ''}</span>
                             </div>
                         </div>
                         <button onClick={handleDisenchantClick} disabled={character.resources.gold < disenchantCost} className="w-full mt-6 bg-red-800 hover:bg-red-700 text-white font-bold py-3 rounded-lg text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed">
                            {t('blacksmith.disenchant')}
                         </button>
                    </div>
                 ) : (
                    <div className="flex-grow flex flex-col items-center justify-center">
                        <AnvilIcon className="h-12 w-12 text-slate-500 mb-4" />
                        <p className="text-gray-500">{t('blacksmith.selectItem')}</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

const UpgradePanel: React.FC<{
    character: PlayerCharacter;
    itemTemplates: ItemTemplate[];
    onUpgradeItem: BlacksmithProps['onUpgradeItem'];
    setNotification: (notification: NotificationType | null) => void;
}> = ({ character, itemTemplates, onUpgradeItem, setNotification }) => {
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);
    const [filterSlot, setFilterSlot] = useState<EquipmentSlot | 'consumable' | 'all'>('all');

    const allItems = useMemo(() => [
        ...Object.values(character.equipment).filter((i): i is ItemInstance => i !== null),
        ...character.inventory
    ], [character.equipment, character.inventory]);
    
    const filteredItems = useMemo(() => {
        if (filterSlot === 'all') {
            return allItems;
        }
        return allItems.filter(item => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            return template?.slot === filterSlot;
        });
    }, [allItems, filterSlot, itemTemplates]);

    useEffect(() => {
        if (selectedItem) {
            const updatedItemInList = allItems.find(i => i.uniqueId === selectedItem.uniqueId);
            if (!updatedItemInList || (updatedItemInList.upgradeLevel !== selectedItem.upgradeLevel)) {
                setSelectedItem(updatedItemInList || null);
            }
        }
    }, [allItems, selectedItem]);


    const handleUpgradeClick = () => {
        if (!selectedItem) return;
        const template = itemTemplates.find(t=>t.id === selectedItem.templateId);
        if (!template) return;
        const currentLevel = selectedItem.upgradeLevel || 0;
        const successChance = Math.max(10, 100 - (currentLevel * 10));

        if (successChance < 100) {
            if (!window.confirm(t('blacksmith.upgrade.upgradeConfirm'))) {
                return;
            }
        }
        
        const result = onUpgradeItem(selectedItem);
        
        setNotification({
            message: t(result.messageKey, { level: result.level }),
            type: result.success ? 'success' : 'error'
        });
    };

    const selectedTemplate = selectedItem ? itemTemplates.find(t=> t.id === selectedItem.templateId) : null;
    
    const { cost, chance, canUpgrade } = useMemo(() => {
        if (!selectedTemplate || !selectedItem) return { cost: null, chance: 0, canUpgrade: false };
        const currentLevel = selectedItem.upgradeLevel || 0;
        const nextLevel = currentLevel + 1;

        if (nextLevel > 10) return { cost: null, chance: 0, canUpgrade: false };

        const rarityMultiplier = {
            [ItemRarity.Common]: 1, [ItemRarity.Uncommon]: 1.5, [ItemRarity.Rare]: 2.5,
            [ItemRarity.Epic]: 4, [ItemRarity.Legendary]: 8
        };
        const goldCost = Math.floor(selectedTemplate.value * 0.5 * nextLevel * rarityMultiplier[selectedTemplate.rarity]);
        const essenceCostAmount = 1;
        
        let essenceType: EssenceType | null = null;
        switch (selectedTemplate.rarity) {
            case ItemRarity.Common: essenceType = EssenceType.Common; break;
            case ItemRarity.Uncommon: essenceType = EssenceType.Uncommon; break;
            case ItemRarity.Rare: essenceType = EssenceType.Rare; break;
            case ItemRarity.Epic: essenceType = EssenceType.Epic; break;
            case ItemRarity.Legendary: essenceType = EssenceType.Legendary; break;
        }
        const successChance = Math.max(10, 100 - (currentLevel * 10));
        return {
            cost: { gold: goldCost, essenceType, essenceAmount: essenceCostAmount },
            chance: successChance,
            canUpgrade: true
        };
    }, [selectedItem, selectedTemplate]);
    
    const hasEnoughGold = cost ? character.resources.gold >= cost.gold : false;
    const hasEnoughEssence = cost && cost.essenceType ? (character.resources[cost.essenceType] || 0) >= cost.essenceAmount : false;
    const hasEnoughResources = hasEnoughGold && hasEnoughEssence;

    return (
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-fade-in h-[70vh]">
            <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4 px-2">
                     <h3 className="text-xl font-bold text-indigo-400">{t('equipment.title')} / {t('equipment.backpack')}</h3>
                     <div className="flex items-center space-x-2">
                        <label htmlFor="item-filter" className="text-sm text-gray-400">{t('equipment.filterByType')}:</label>
                        <select
                            id="item-filter"
                            value={filterSlot}
                            onChange={(e) => {
                                setFilterSlot(e.target.value as EquipmentSlot | 'consumable' | 'all');
                                setSelectedItem(null);
                            }}
                            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            <option value="all">{t('equipment.showAll')}</option>
                            {Object.values(EquipmentSlot).map(slot => (
                                <option key={slot} value={slot}>{t(`equipment.slot.${slot}`)}</option>
                            ))}
                            <option value="consumable">{t('item.slot.consumable')}</option>
                        </select>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-2 gap-2">
                    {filteredItems.map(item => {
                        const template = itemTemplates.find(t => t.id === item.templateId);
                        if (!template) return null;

                        return (
                            <ItemListItem
                                key={item.uniqueId}
                                item={item}
                                template={template}
                                isSelected={selectedItem?.uniqueId === item.uniqueId}
                                onClick={() => setSelectedItem(item)}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col items-center justify-start text-center min-h-0">
                 <AnvilIcon className="h-10 w-10 text-slate-500 mb-2" />
                 {selectedTemplate && selectedItem ? (
                     <div className="w-full max-w-lg">
                         <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('blacksmith.upgrade.upgradeItem')}</h3>
                         
                         {canUpgrade ? (
                            <>
                                <div className="flex justify-center items-start gap-4 my-2">
                                     <div className="flex-1">
                                        <p className="text-center text-sm text-gray-400 mb-1">{t('blacksmith.upgrade.currentStats')}</p>
                                        <ItemDetailsPanel item={selectedItem} template={selectedTemplate} showIcon={false}/>
                                    </div>
                                    <ArrowRightIcon className="h-6 w-6 text-slate-500 mt-8" />
                                    <div className="flex-1">
                                        <p className="text-center text-sm text-gray-400 mb-1">{t('blacksmith.upgrade.statsAfterUpgrade')}</p>
                                        <ItemDetailsPanel item={{...selectedItem, upgradeLevel: (selectedItem.upgradeLevel || 0) + 1}} template={selectedTemplate} showIcon={false}/>
                                    </div>
                                </div>

                                <div className="space-y-2 bg-slate-800/50 p-4 rounded-lg text-left mt-4">
                                    <div className="flex justify-between text-lg">
                                        <span className="text-gray-300">{t('blacksmith.upgrade.successChance')}:</span>
                                        <span className="font-mono font-bold text-amber-400">{chance}%</span>
                                    </div>
                                    <div className="border-t border-slate-700/50"></div>
                                    <h4 className="font-semibold text-gray-300">{t('blacksmith.upgrade.cost')}:</h4>
                                    <div className="flex justify-between text-md">
                                        <span className="text-gray-400 flex items-center gap-2"><CoinsIcon className="h-4 w-4 text-amber-400"/> {t('resources.gold')}</span>
                                        <span className="font-mono font-bold text-amber-400">{cost?.gold}</span>
                                    </div>
                                    {cost?.essenceType && (
                                        <div className="flex justify-between text-md items-center">
                                            <span className={`font-semibold ${rarityStyles[selectedTemplate.rarity].text}`}>{t(`resources.${cost.essenceType}`)}</span>
                                            <div className="flex items-baseline">
                                                <span className={`font-mono font-bold ${rarityStyles[selectedTemplate.rarity].text} mr-2`}>x {cost.essenceAmount}</span>
                                                <span className="text-xs text-gray-500">({t('blacksmith.upgrade.youHave')}: {character.resources[cost.essenceType] || 0})</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {chance < 100 && <p className="text-red-500 font-semibold mt-2 text-sm">{t('blacksmith.upgrade.riskWarning')}</p>}
                                <button onClick={handleUpgradeClick} disabled={!hasEnoughResources} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed">{t('blacksmith.upgrade.upgrade')}</button>
                                {!hasEnoughGold && <p className="text-red-400 text-sm mt-2">{t('blacksmith.notEnoughGold')}</p>}
                                {hasEnoughGold && !hasEnoughEssence && <p className="text-red-400 text-sm mt-2">{t('blacksmith.notEnoughEssence')}</p>}
                            </>
                         ) : (
                             <p className="text-amber-400 mt-4">{t('blacksmith.upgrade.maxLevel')}</p>
                         )}
                    </div>
                 ) : (
                    <>
                        <p className="text-gray-500 mb-4">{t('blacksmith.upgrade.selectItemToUpgrade')}</p>
                        <div className="mt-4 w-full border-t border-slate-700/50 pt-4 text-left">
                            <h4 className="font-bold text-indigo-400 mb-2">{t('blacksmith.upgrade.howItWorks.title')}</h4>
                            <ul className="text-xs text-gray-400 space-y-2 list-disc list-inside">
                                <li>{t('blacksmith.upgrade.howItWorks.statIncrease')}</li>
                                <li>{t('blacksmith.upgrade.howItWorks.cost')}</li>
                                <li>{t('blacksmith.upgrade.howItWorks.chance')}</li>
                                <li className="font-semibold text-red-500/90">{t('blacksmith.upgrade.howItWorks.failure')}</li>
                            </ul>
                        </div>
                    </>
                 )}
            </div>
        </div>
    );
};

export const Blacksmith: React.FC<BlacksmithProps> = ({ character, itemTemplates, onDisenchantItem, onUpgradeItem }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<BlacksmithTab>('upgrade');
    const [notification, setNotification] = useState<NotificationType | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);
    
    const TABS: { id: BlacksmithTab, label: string }[] = [
        { id: 'upgrade', label: t('blacksmith.upgrade.upgradeItem') },
        { id: 'disenchant', label: t('blacksmith.disenchant') },
    ];

    return (
        <ContentPanel title={t('blacksmith.title')}>
             <div className="flex border-b border-slate-700 mb-6">
                 {TABS.map(tab => (
                     <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${activeTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                     >{tab.label}</button>
                 ))}
                 <div className="flex-grow border-b border-slate-700"></div>
                 <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-1 rounded-full mb-[-1px] border border-slate-700">
                     <CoinsIcon className="h-5 w-5 text-amber-400" />
                     <span className="font-mono text-lg font-bold text-amber-400">{character.resources.gold.toLocaleString()}</span>
                 </div>
            </div>

            {notification && (
                <div className={`p-4 rounded-lg mb-6 text-center text-white font-semibold animate-fade-in ${notification.type === 'success' ? 'bg-green-600/80' : 'bg-red-800/80'}`}>
                    {notification.message}
                </div>
            )}
            
            {activeTab === 'disenchant' && <DisenchantPanel character={character} itemTemplates={itemTemplates} onDisenchantItem={onDisenchantItem} setNotification={setNotification} />}
            {activeTab === 'upgrade' && <UpgradePanel character={character} itemTemplates={itemTemplates} onUpgradeItem={onUpgradeItem} setNotification={setNotification} />}

        </ContentPanel>
    );
};