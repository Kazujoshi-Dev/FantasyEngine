
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemInstance, ItemTemplate, ItemRarity, EssenceType, EquipmentSlot, CharacterClass } from '../types';
import { ItemList, ItemDetailsPanel, ItemListItem, rarityStyles } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { AnvilIcon } from './icons/AnvilIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';

type BlacksmithTab = 'disenchant' | 'upgrade';
type NotificationType = { message: string; type: 'success' | 'error' };

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
    setNotification: (notification: NotificationType | null) => void;
}> = ({ setNotification }) => {
    const { t } = useTranslation();
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);

    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates, affixes } = gameData;

    const onDisenchantItem = async (item: ItemInstance) => {
        try {
            const { updatedCharacter, result } = await api.disenchantItem(item.uniqueId);
            updateCharacter(updatedCharacter);
            return result;
        } catch (e: any) {
            alert(e.message);
            return { success: false };
        }
    };

    const validInventory = useMemo(() => 
        (character.inventory || []).filter(item => item && itemTemplates.find(t => t.id === item.templateId)),
        [character.inventory, itemTemplates]
    );
    const backpackCapacity = 40 + ((character.backpack?.level || 1) - 1) * 10;

    const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
        [EssenceType.Common]: ItemRarity.Common,
        [EssenceType.Uncommon]: ItemRarity.Uncommon,
        [EssenceType.Rare]: ItemRarity.Rare,
        [EssenceType.Epic]: ItemRarity.Epic,
        [EssenceType.Legendary]: ItemRarity.Legendary,
    };
    
    const selectedTemplate = selectedItem ? itemTemplates.find(t=> t.id === selectedItem.templateId) : null;
    const disenchantCost = selectedTemplate ? Math.round(selectedTemplate.value * 0.1) : 0;

    const handleDisenchantClick = useCallback(async () => {
        if (!selectedItem) return;
        
        const result = await onDisenchantItem(selectedItem);
        
        if (result.success && result.amount && result.essenceType) {
            setNotification({
                message: t('blacksmith.disenchantSuccess', { amount: result.amount, essenceName: t(`resources.${result.essenceType}`) }),
                type: 'success'
            });
        } else if (!result.success && result.amount === undefined) {
             // API error alert already shown
        } else {
            setNotification({
                message: t('blacksmith.disenchantFailure'),
                type: 'error'
            });
        }
        setSelectedItem(null);
    }, [selectedItem, onDisenchantItem, setNotification, t]);

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) return;

            if (event.key === 'Enter' && selectedItem && (baseCharacter.resources?.gold || 0) >= disenchantCost) {
                event.preventDefault(); 
                handleDisenchantClick();
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [selectedItem, baseCharacter.resources, disenchantCost, handleDisenchantClick]);
    
    const [yieldAmount, yieldEssenceType] = selectedTemplate ? getPotentialYield(selectedTemplate.rarity) : ['', null];
    const yieldRarity = yieldEssenceType ? essenceToRarityMap[yieldEssenceType] : null;
    const textColorClass = yieldRarity ? rarityStyles[yieldRarity].text : 'text-gray-300';

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-fade-in h-[70vh]">
             <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                 <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="text-xl font-bold text-indigo-400">{t('blacksmith.yourBag')}</h3>
                    <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                        {validInventory.length} / {backpackCapacity}
                    </div>
                </div>
                <ItemList
                    items={validInventory}
                    itemTemplates={itemTemplates}
                    affixes={affixes}
                    selectedItem={selectedItem}
                    onSelectItem={setSelectedItem}
                />
            </div>
            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col items-center justify-start text-center min-h-0 overflow-y-auto">
                 <AnvilIcon className="h-10 w-10 text-slate-500 mb-2" />
                 {selectedTemplate && selectedItem ? (
                     <div className="w-full max-w-sm">
                         <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('blacksmith.disenchantItem')}</h3>
                         <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 text-left shadow-sm">
                            <ItemDetailsPanel 
                                item={selectedItem} 
                                template={selectedTemplate} 
                                affixes={affixes} 
                                character={character} 
                                showIcon={false}
                                compact={true}
                                size="small"
                            />
                         </div>
                         <div className="space-y-3 bg-slate-800/50 p-4 rounded-lg mt-6">
                             <div className="flex justify-between text-lg"><span className="text-gray-300">{t('blacksmith.disenchantCost')}</span><span className="font-mono font-bold text-amber-400 flex items-center">{disenchantCost} <CoinsIcon className="h-4 w-4 ml-1" /></span></div>
                             <div className="flex justify-between text-lg">
                                <span className="text-gray-300">{t('blacksmith.potentialYield')}</span>
                                <span className={`font-mono font-bold ${textColorClass}`}>{yieldAmount} {yieldEssenceType ? t(`resources.${yieldEssenceType}`) : ''}</span>
                             </div>
                         </div>
                         <button onClick={handleDisenchantClick} disabled={(baseCharacter.resources?.gold || 0) < disenchantCost} className="w-full mt-6 bg-red-800 hover:bg-red-700 text-white font-bold py-3 rounded-lg text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed">
                            {t('blacksmith.disenchant')}
                         </button>
                         <p className="text-xs text-gray-500 mt-2">{t('blacksmith.pressEnter')}</p>
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
    setNotification: (notification: NotificationType | null) => void;
}> = ({ setNotification }) => {
    const { t } = useTranslation();
    const { character, baseCharacter, gameData, updateCharacter } = useCharacter();
    const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);
    const [filterSlot, setFilterSlot] = useState<string>('all');
    
    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates, affixes } = gameData;
    
    const onUpgradeItem = async (item: ItemInstance) => {
        try {
            const { updatedCharacter, result } = await api.upgradeItem(item.uniqueId);
            updateCharacter(updatedCharacter);
            return result;
        } catch (e: any) {
            alert(e.message);
            return { success: false, messageKey: 'error.title' };
        }
    };

    const allItems = useMemo(() => [
        ...Object.values(character.equipment || {})
            .filter((i): i is ItemInstance => i !== null)
            .filter(item => item && itemTemplates.find(t => t.id === item.templateId)),
        ...(character.inventory || []).filter(item => item && itemTemplates.find(t => t.id === item.templateId))
    ], [character.equipment, character.inventory, itemTemplates]);

    const validInventoryCount = useMemo(() => 
        (character.inventory || []).filter(item => item && itemTemplates.find(t => t.id === item.templateId)).length,
        [character.inventory, itemTemplates]
    );

    const equippedItemIds = useMemo(() => 
        new Set(Object.values(character.equipment || {}).filter((i): i is ItemInstance => !!i).map(i => i.uniqueId)),
    [character.equipment]);

    const equipmentSlotOptions = useMemo(() => {
        const slots: {value: string, label: string}[] = Object.values(EquipmentSlot)
            .filter(slot => slot !== EquipmentSlot.Ring1 && slot !== EquipmentSlot.Ring2)
            .map(slot => ({ value: slot, label: t(`equipment.slot.${slot}`) as string }));
        
        return slots.concat([{ value: 'ring', label: t('item.slot.ring') as string }])
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [t]);
    
    const filteredItems = useMemo(() => {
        if (filterSlot === 'all' || filterSlot === 'consumable') {
            const items = allItems.filter(item => {
                 const template = itemTemplates.find(t => t.id === item.templateId);
                 return template?.slot === filterSlot;
            });
            return filterSlot === 'all' ? allItems : items;
        }
        return allItems.filter(item => {
            const template = itemTemplates.find(t => t.id === item.templateId);
            if (!template) return false;
            
            const slotToCheck = template.slot === 'ring' || template.slot === EquipmentSlot.Ring1 || template.slot === EquipmentSlot.Ring2 ? 'ring' : template.slot;
            
            return slotToCheck === filterSlot;
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


    const handleUpgradeClick = async () => {
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
        
        const result = await onUpgradeItem(selectedItem);
        
        if (result.messageKey !== 'error.title') {
            setNotification({
                message: t(result.messageKey, { level: result.level ?? currentLevel + 1 }),
                type: result.success ? 'success' : 'error'
            });
        }
    };

    const selectedTemplate = selectedItem ? itemTemplates.find(t=> t.id === selectedItem.templateId) : null;
    
    const { cost, chance, canUpgrade, baseSuccessChance } = useMemo(() => {
        if (!selectedTemplate || !selectedItem) return { cost: null, chance: 0, canUpgrade: false, baseSuccessChance: 0 };
        const currentLevel = selectedItem.upgradeLevel || 0;
        const nextLevel = currentLevel + 1;

        if (nextLevel > 10) return { cost: null, chance: 0, canUpgrade: false, baseSuccessChance: 0 };

        const rarityMultiplier = {
            [ItemRarity.Common]: 1, [ItemRarity.Uncommon]: 1.5, [ItemRarity.Rare]: 2.5,
            [ItemRarity.Epic]: 4, [ItemRarity.Legendary]: 8
        };
        const goldCost = Math.floor(Number(selectedTemplate.value) * 0.5 * nextLevel * rarityMultiplier[selectedTemplate.rarity]);
        const essenceCostAmount = 1;
        
        let essenceType: EssenceType | null = null;
        switch (selectedTemplate.rarity) {
            case ItemRarity.Common: essenceType = EssenceType.Common; break;
            case ItemRarity.Uncommon: essenceType = EssenceType.Uncommon; break;
            case ItemRarity.Rare: essenceType = EssenceType.Rare; break;
            case ItemRarity.Epic: essenceType = EssenceType.Epic; break;
            case ItemRarity.Legendary: essenceType = EssenceType.Legendary; break;
        }
        const baseChance = Math.max(10, 100 - (currentLevel * 10));

        let finalSuccessChance = baseChance;
        if (character.characterClass === CharacterClass.Blacksmith) {
            const p = baseChance / 100;
            const effectiveP = 1 - Math.pow((1 - p), 2);
            finalSuccessChance = Math.round(effectiveP * 100);
        }

        return {
            cost: { gold: goldCost, essenceType, essenceAmount: essenceCostAmount },
            chance: finalSuccessChance,
            canUpgrade: true,
            baseSuccessChance: baseChance
        };
    }, [selectedItem, selectedTemplate, character.characterClass]);
    
    const hasEnoughGold = cost ? (baseCharacter.resources?.gold || 0) >= cost.gold : false;
    const hasEnoughEssence = cost && cost.essenceType ? ((baseCharacter.resources || {})[cost.essenceType] || 0) >= cost.essenceAmount : false;
    const hasEnoughResources = hasEnoughGold && hasEnoughEssence;

    return (
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-fade-in h-[70vh]">
            <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4 px-2">
                     <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-indigo-400">{t('equipment.title')} / {t('equipment.backpack')}</h3>
                        <div className="font-mono text-base text-gray-400 bg-slate-800/50 px-3 py-1 rounded-full">
                            {validInventoryCount} / {40 + ((character.backpack?.level || 1) - 1) * 10}
                        </div>
                     </div>
                     <div className="flex items-center space-x-2">
                        <label htmlFor="item-filter" className="text-sm text-gray-400">{t('equipment.filterByType')}:</label>
                        <select
                            id="item-filter"
                            value={filterSlot}
                            onChange={(e) => {
                                setFilterSlot(e.target.value);
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
                                affixes={affixes || []}
                                isSelected={selectedItem?.uniqueId === item.uniqueId}
                                onClick={() => setSelectedItem(item)}
                                isEquipped={equippedItemIds.has(item.uniqueId)}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col items-center justify-start text-center min-h-0 overflow-y-auto">
                 <AnvilIcon className="h-10 w-10 text-slate-500 mb-2" />
                 {selectedTemplate && selectedItem ? (
                     <div className="w-full max-w-lg">
                         <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('blacksmith.upgrade.upgradeItem')}</h3>
                         
                         {canUpgrade ? (
                            <>
                                <div className="flex justify-center items-start gap-4 my-2">
                                     <div className="flex-1">
                                        <p className="text-center text-sm text-gray-400 mb-1">{t('blacksmith.upgrade.currentStats')}</p>
                                        <ItemDetailsPanel item={selectedItem} template={selectedTemplate} affixes={affixes} showIcon={false} size="small" hideAffixes={false} compact={true} />
                                    </div>
                                    <ArrowRightIcon className="h-6 w-6 text-slate-500 mt-8" />
                                    <div className="flex-1">
                                        <p className="text-center text-sm text-gray-400 mb-1">{t('blacksmith.upgrade.statsAfterUpgrade')}</p>
                                        <ItemDetailsPanel item={{...selectedItem, upgradeLevel: (selectedItem.upgradeLevel || 0) + 1}} template={selectedTemplate} affixes={affixes} showIcon={false} size="small" hideAffixes={false} compact={true} />
                                    </div>
                                </div>

                                <div className="space-y-2 bg-slate-800/50 p-4 rounded-lg text-left mt-4">
                                    <div className="flex justify-between text-lg">
                                        <span className="text-gray-300">{t('blacksmith.upgrade.successChance')}:</span>
                                        <span className="font-mono font-bold text-amber-400">{chance}%</span>
                                    </div>
                                    {character.characterClass === CharacterClass.Blacksmith && baseSuccessChance !== chance && (
                                        <p className="text-xs text-green-400 text-right">
                                            Bonus Kowala aktywny (bazowa szansa: {baseSuccessChance}%)
                                        </p>
                                    )}
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
                                                <span className="text-xs text-gray-500">({t('blacksmith.upgrade.youHave')}: {(baseCharacter.resources || {})[cost.essenceType] || 0})</span>
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
                                <li>{t('blacksmith.upgrade.howItWorks.scope')}</li>
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

export const Blacksmith: React.FC = () => {
    const { t } = useTranslation();
    const { baseCharacter } = useCharacter();
    const [activeTab, setActiveTab] = useState<BlacksmithTab>('upgrade');
    const [notification, setNotification] = useState<NotificationType | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);
    
    if (!baseCharacter) return null;

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
                     <span className="font-mono text-lg font-bold text-amber-400">{(baseCharacter.resources?.gold || 0).toLocaleString()}</span>
                 </div>
            </div>

            {notification && (
                <div className={`p-4 rounded-lg mb-6 text-center text-white font-semibold animate-fade-in ${notification.type === 'success' ? 'bg-green-600/80' : 'bg-red-800/80'}`}>
                    {notification.message}
                </div>
            )}
            
            {activeTab === 'disenchant' && <DisenchantPanel setNotification={setNotification} />}
            {activeTab === 'upgrade' && <UpgradePanel setNotification={setNotification} />}

        </ContentPanel>
    );
};
