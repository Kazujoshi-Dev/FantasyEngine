
import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { EssenceType, ItemRarity, ItemInstance, EquipmentSlot, CharacterClass } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ChestIcon } from './icons/ChestIcon';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { AnvilIcon } from './icons/AnvilIcon'; // Using Anvil for Workshop
import { useTranslation } from '../contexts/LanguageContext';
import { rarityStyles, ItemListItem, ItemDetailsPanel } from './shared/ItemSlot';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';
import { getCampUpgradeCost, getChestUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getWarehouseCapacity, getWorkshopUpgradeCost } from '../logic/stats';
import { calculateCraftingCost, calculateReforgeCost } from '../logic/crafting_frontend_helper'; // Helper we'll define below

const REGEN_INTERVAL_SECONDS = 10;

// --- Helper Functions ---
const getChestCapacity = (level: number) => Math.floor(500 * Math.pow(level, 1.8));
const getBackpackCapacity = (level: number) => 40 + (level - 1) * 10;

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

type CampTab = 'OVERVIEW' | 'TREASURY' | 'WAREHOUSE' | 'BACKPACK' | 'WORKSHOP';

// --- Sub-components ---

const OverviewPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [countdown, setCountdown] = useState(REGEN_INTERVAL_SECONDS);
    const [isHealing, setIsHealing] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);

    if (!character || !baseCharacter) return null;

    const { camp, isResting, stats, restStartHealth, activeTravel, activeExpedition } = character;
    const isTraveling = activeTravel !== null;
    const campLevel = camp?.level || 1;
    const maxLevel = 10;
    const isMaxLevel = campLevel >= maxLevel;

    const upgradeCost = isMaxLevel ? { gold: Infinity, essences: [] } : getCampUpgradeCost(campLevel);
    const canAffordUpgrade = !isMaxLevel && (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    useEffect(() => {
        if (!isResting) { setCountdown(REGEN_INTERVAL_SECONDS); return; }
        const timerId = setInterval(() => { setCountdown(prev => (prev <= 1 ? REGEN_INTERVAL_SECONDS : prev - 1)); }, 1000);
        return () => clearInterval(timerId);
    }, [isResting]);

    const currentHealth = stats?.currentHealth || 0;
    const maxHealth = stats?.maxHealth || 1;
    const regeneratedHealth = isResting ? Math.max(0, currentHealth - restStartHealth) : 0;
    const healthPercentage = (currentHealth / maxHealth) * 100;

    const onToggleResting = () => api.updateCharacter({ isResting: !isResting }).then(updateCharacter);
    
    const onUpgradeCamp = async () => { 
        setIsUpgrading(true);
        try { 
            const updated = await api.upgradeCamp();
            updateCharacter(updated); 
        } catch(e:any) { 
            alert(e.message); 
        } finally {
            setIsUpgrading(false);
        }
    };
    
    const onHealToFull = async () => { 
        setIsHealing(true);
        try { 
            const updated = await api.healCharacter();
            updateCharacter(updated); 
        } catch(e:any) { 
            alert(e.message); 
        } finally {
            setIsHealing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full animate-fade-in">
            {/* Status Panel */}
            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30 h-full">
                <h3 className="text-xl font-bold text-indigo-400 mb-6 flex items-center">
                    <HomeIcon className="h-6 w-6 mr-2" />
                    {t('camp.statusTitle')}
                </h3>
                
                <div className="space-y-4 flex-grow">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-400">{t('camp.yourHealth')}</span>
                            <span className="text-white font-bold">{currentHealth.toFixed(0)} / {maxHealth}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden border border-slate-600">
                            <div className="bg-red-600 h-full transition-all duration-500 relative" style={{ width: `${healthPercentage}%` }}>
                                <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{t('camp.level')}</p>
                            <p className="text-2xl font-bold text-white">{campLevel}</p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{t('camp.regeneration')}</p>
                            <p className="text-xl font-bold text-green-400">{campLevel}% / min</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    <button 
                        onClick={onToggleResting} 
                        disabled={activeExpedition !== null || isTraveling} 
                        className={`w-full py-3 rounded-lg font-bold text-lg transition-colors duration-200 shadow-lg ${isResting ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'} text-white disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed`}
                    >
                        {isResting ? t('camp.stopResting') : t('camp.startResting')}
                    </button>
                    
                    <button 
                        onClick={onHealToFull} 
                        disabled={activeExpedition !== null || isTraveling || isResting || currentHealth >= maxHealth || isHealing} 
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-colors duration-200 shadow-md bg-emerald-700 hover:bg-emerald-600 text-white disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed border border-emerald-500/30`}
                    >
                        {isHealing ? 'Leczenie...' : t('camp.healToFull')}
                    </button>

                    {isResting && (
                        <div className="text-center bg-slate-800/80 p-3 rounded-lg border border-green-500/30">
                            <p className="text-sm text-green-400 animate-pulse mb-1">{t('camp.restingMessage')}</p>
                            <p className="text-gray-400 text-xs">
                                {t('camp.regenerated')}: <span className="font-bold text-white">+{regeneratedHealth.toFixed(1)}</span> HP
                            </p>
                            <p className="text-gray-500 text-[10px] mt-1">
                                {t('camp.nextRegenIn')}: <span className="font-mono font-bold text-white">{countdown}s</span>
                            </p>
                        </div>
                    )}
                    
                    {activeExpedition !== null && <p className="text-center text-xs text-red-400 bg-red-900/20 p-2 rounded">{t('camp.cannotRest')}</p>}
                    {isTraveling && <p className="text-center text-xs text-red-400 bg-red-900/20 p-2 rounded">{t('camp.unavailableDuringTravel')}</p>}
                </div>
            </div>

            {/* Upgrade Panel */}
            <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30 h-full">
                <h3 className="text-xl font-bold text-amber-400 mb-6 flex items-center">
                    <CoinsIcon className="h-6 w-6 mr-2" />
                    Rozbudowa Obozu
                </h3>

                {isMaxLevel ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-slate-800/30 rounded-lg border border-amber-500/20">
                        <HomeIcon className="h-16 w-16 text-amber-500 mb-4 opacity-50" />
                        <p className="text-xl font-bold text-amber-400">{t('camp.maxLevel')}</p>
                        <p className="mt-2 text-gray-400">{t('camp.maxLevelDesc')}</p>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col justify-between">
                        <div>
                            <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
                                <p className="text-gray-400 text-sm mb-2">{t('camp.nextLevel')}: <span className="text-white font-bold text-lg">{campLevel + 1}</span></p>
                                <p className="text-gray-400 text-sm">{t('camp.newRegeneration')}: <span className="text-green-400 font-bold text-lg">{campLevel + 1}% / min</span></p>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <h4 className="text-sm font-bold text-gray-300 mb-3 border-b border-slate-700 pb-2">{t('camp.upgradeCost')}</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="flex items-center text-gray-300"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400" />{t('resources.gold')}</span>
                                        <span className={`font-mono font-bold ${(baseCharacter.resources.gold || 0) >= upgradeCost.gold ? 'text-green-400' : 'text-red-400'}`}>
                                            {(baseCharacter.resources.gold || 0).toLocaleString()} / {upgradeCost.gold.toLocaleString()}
                                        </span>
                                    </div>
                                    {upgradeCost.essences.map(e => (
                                        <div key={e.type} className="flex justify-between items-center">
                                            <span className={`${rarityStyles[essenceToRarityMap[e.type]].text} flex items-center`}>
                                                {t(`resources.${e.type}`)}
                                            </span>
                                            <span className={`font-mono font-bold ${(baseCharacter.resources[e.type] || 0) >= e.amount ? 'text-green-400' : 'text-red-400'}`}>
                                                {(baseCharacter.resources[e.type] || 0)} / {e.amount}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <button 
                                onClick={onUpgradeCamp} 
                                disabled={!canAffordUpgrade || isResting || isTraveling || isUpgrading} 
                                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                {isUpgrading ? 'Ulepszanie...' : t('camp.upgrade')}
                            </button>
                            {isResting && <p className="text-center text-xs text-amber-400 mt-2">{t('camp.mustStopResting')}</p>}
                            {isTraveling && <p className="text-center text-xs text-red-400 mt-2">{t('camp.unavailableDuringTravel')}</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TreasuryPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [amount, setAmount] = useState<string>('');
    const [isUpgrading, setIsUpgrading] = useState(false);

    if (!character || !baseCharacter) return null;

    // Use treasury object (new structure) with fallback
    const treasury = character.treasury || character.chest || { level: 1, gold: 0 };
    const chestLevel = treasury.level;
    const chestGold = treasury.gold;
    const capacity = getChestCapacity(chestLevel);
    const upgradeCost = getChestUpgradeCost(chestLevel);
    
    const canAffordUpgrade = (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const handleDeposit = async (value: number | 'all') => {
        const depositAmount = value === 'all' ? (baseCharacter.resources?.gold || 0) : Math.min((baseCharacter.resources?.gold || 0), Number(value));
        if (isNaN(depositAmount) || depositAmount <= 0) return;
        try {
            const updatedChar = await api.chestDeposit(depositAmount);
            updateCharacter(updatedChar);
            setAmount('');
        } catch (e: any) { alert(e.message || 'Błąd wpłaty'); }
    };

    const handleWithdraw = async (value: number | 'all') => {
        const currentStored = treasury.gold;
        const withdrawAmount = value === 'all' ? currentStored : Math.min(currentStored, Number(value));
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) return;
        try {
            const updatedChar = await api.chestWithdraw(withdrawAmount);
            updateCharacter(updatedChar);
            setAmount('');
        } catch (e: any) { alert(e.message || 'Błąd wypłaty'); }
    };

    const onUpgradeChest = async () => {
        setIsUpgrading(true);
        try {
            const updatedChar = await api.upgradeChest();
            updateCharacter(updatedChar);
        } catch (e: any) { 
            alert(e.message || t('error.title')); 
        } finally {
            setIsUpgrading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full animate-fade-in">
             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30">
                <h3 className="text-xl font-bold text-amber-400 mb-6 flex items-center">
                    <ChestIcon className="h-6 w-6 mr-2" />
                    {t('camp.chestTitle')}
                </h3>

                <div className="flex-grow">
                    <div className="bg-slate-800/50 p-4 rounded-lg mb-6 text-center">
                         <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Złoto w Skarbcu</p>
                         <p className="text-4xl font-mono font-bold text-amber-400 mb-2">{chestGold.toLocaleString()}</p>
                         <div className="w-full bg-slate-700 rounded-full h-3 relative">
                            <div className="bg-amber-500 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (chestGold / capacity) * 100)}%` }}></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-right">Pojemność: {capacity.toLocaleString()}</p>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg">
                        <label className="block text-sm text-gray-400 mb-2">Kwota transakcji</label>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="number" 
                                min="1" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                placeholder="Ilość złota..." 
                                className="flex-grow bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" 
                            />
                            <div className="flex items-center text-amber-400 font-bold bg-slate-900/50 px-3 rounded-lg border border-slate-700">
                                <CoinsIcon className="h-5 w-5 mr-1" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleDeposit(Number(amount))} className="py-2 bg-green-700 hover:bg-green-600 rounded text-white font-bold transition-colors">Wpłać</button>
                            <button onClick={() => handleWithdraw(Number(amount))} className="py-2 bg-amber-700 hover:bg-amber-600 rounded text-white font-bold transition-colors">Wypłać</button>
                            <button onClick={() => handleDeposit('all')} className="py-2 bg-green-900/60 hover:bg-green-800/60 border border-green-700 rounded text-green-200 text-sm">Wpłać wszystko</button>
                            <button onClick={() => handleWithdraw('all')} className="py-2 bg-amber-900/60 hover:bg-amber-800/60 border border-amber-700 rounded text-amber-200 text-sm">Wypłać wszystko</button>
                        </div>
                    </div>
                </div>
             </div>

             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30">
                <h3 className="text-xl font-bold text-gray-300 mb-6 flex items-center">
                    Ulepszanie Skarbca
                </h3>
                
                <div className="bg-slate-800/50 p-4 rounded-lg flex-grow">
                    <div className="mb-6">
                        <p className="text-gray-400 text-sm mb-2">Obecny Poziom: <span className="text-white font-bold text-lg">{chestLevel}</span></p>
                        <p className="text-gray-400 text-sm">Nowa Pojemność: <span className="text-green-400 font-bold text-lg">{getChestCapacity(chestLevel + 1).toLocaleString()}</span></p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-6">
                         <h4 className="text-sm font-bold text-gray-300 mb-3 border-b border-slate-700 pb-2">{t('camp.upgradeCost')}</h4>
                         <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="flex items-center text-gray-300"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400" />{t('resources.gold')}</span>
                                <span className={`font-mono font-bold ${(baseCharacter.resources.gold || 0) >= upgradeCost.gold ? 'text-green-400' : 'text-red-400'}`}>
                                    {(baseCharacter.resources.gold || 0).toLocaleString()} / {upgradeCost.gold.toLocaleString()}
                                </span>
                            </div>
                            {upgradeCost.essences.map(e => (
                                <div key={e.type} className="flex justify-between items-center">
                                    <span className={`${rarityStyles[essenceToRarityMap[e.type]].text} flex items-center`}>
                                        {t(`resources.${e.type}`)}
                                    </span>
                                    <span className={`font-mono font-bold ${(baseCharacter.resources[e.type] || 0) >= e.amount ? 'text-green-400' : 'text-red-400'}`}>
                                        {(baseCharacter.resources[e.type] || 0)} / {e.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <button 
                        onClick={onUpgradeChest} 
                        disabled={!canAffordUpgrade || isUpgrading} 
                        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        {isUpgrading ? 'Ulepszanie...' : t('camp.upgrade')}
                    </button>
                </div>
             </div>
        </div>
    );
};

const WarehousePanel: React.FC = () => {
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
                        Magazyn Przedmiotów
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Poziom: <span className="text-white font-bold">{warehouseLevel} / {10}</span> | Pojemność: <span className="text-white font-bold">{warehouseItems.length} / {capacity}</span>
                        {warehouseItems.length >= capacity && <span className="text-red-400 ml-2 font-bold">(PEŁNY)</span>}
                    </p>
                </div>
                 <div className="flex items-center gap-4">
                    {warehouseLevel >= 10 ? (
                        <div className="text-right">
                             <p className="text-sm font-bold text-amber-400">Maksymalny Poziom</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-right hidden md:block">
                                <p className="text-xs text-gray-500 uppercase">Koszt Ulepszenia</p>
                                <p className="text-sm font-mono text-amber-400">{upgradeCost.gold.toLocaleString()}g</p>
                            </div>
                            <button 
                                onClick={onUpgradeWarehouse} 
                                disabled={!canAffordUpgrade || isUpgrading} 
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors disabled:bg-slate-700 disabled:text-gray-500"
                                title="Zwiększ pojemność magazynu o 3 miejsca"
                            >
                                {isUpgrading ? '...' : 'Ulepsz (+3 sloty)'}
                            </button>
                        </>
                    )}
                 </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <input 
                    type="text" 
                    placeholder="Szukaj po nazwie..." 
                    className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={filterRarity} onChange={(e) => setFilterRarity(e.target.value as ItemRarity | 'all')}>
                    <option value="all">Wszystkie Rzadkości</option>
                    {(Object.values(ItemRarity) as string[]).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                </select>
                <select className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={filterSlot} onChange={(e) => setFilterSlot(e.target.value)}>
                    <option value="all">Wszystkie Typy</option>
                    {(Object.values(EquipmentSlot) as string[]).map(s => <option key={s} value={s}>{t(`equipment.slot.${s}`)}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow min-h-0">
                <div className="bg-slate-900/40 rounded-xl p-4 border border-indigo-500/30 flex flex-col overflow-hidden">
                    <p className="text-center font-bold text-indigo-300 mb-3 pb-2 border-b border-indigo-500/30">W Magazynie ({filteredWarehouseItems.length})</p>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {filteredWarehouseItems.length === 0 && <p className="text-gray-600 text-center text-sm py-8">Magazyn jest pusty.</p>}
                        {filteredWarehouseItems.map(item => {
                             const template = itemTemplates.find(t => t.id === item.templateId);
                             if (!template) return null;
                             return (
                                 <div key={item.uniqueId} className="flex justify-between items-center bg-slate-800/80 p-2 rounded-lg border border-slate-700 hover:border-slate-500 group">
                                     <div className="flex-grow overflow-hidden">
                                        <ItemListItem item={item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} className="border-0 bg-transparent p-0 hover:bg-transparent shadow-none" />
                                     </div>
                                     <button onClick={() => handleWithdraw(item)} className="ml-2 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded text-xs font-bold text-white whitespace-nowrap">Wyjmij</button>
                                 </div>
                             )
                        })}
                    </div>
                </div>
                <div className="bg-slate-900/40 rounded-xl p-4 border border-green-500/30 flex flex-col overflow-hidden">
                    <p className="text-center font-bold text-green-300 mb-3 pb-2 border-b border-green-500/30">W Plecaku ({filteredBackpackItems.length})</p>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {filteredBackpackItems.length === 0 && <p className="text-gray-600 text-center text-sm py-8">Plecak jest pusty.</p>}
                        {filteredBackpackItems.map(item => {
                             const template = itemTemplates.find(t => t.id === item.templateId);
                             if (!template) return null;
                             return (
                                 <div key={item.uniqueId} className="flex justify-between items-center bg-slate-800/80 p-2 rounded-lg border border-slate-700 hover:border-slate-500 group">
                                     <div className="flex-grow overflow-hidden">
                                        <ItemListItem item={item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} className="border-0 bg-transparent p-0 hover:bg-transparent shadow-none" />
                                     </div>
                                     <button onClick={() => handleDeposit(item)} className="ml-2 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white whitespace-nowrap">Schowaj</button>
                                 </div>
                             )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const BackpackPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [isUpgrading, setIsUpgrading] = useState(false);
    
    if (!character || !baseCharacter) return null;

    const backpackLevel = character.backpack?.level || 1;
    const capacity = getBackpackCapacity(backpackLevel);
    const upgradeCost = getBackpackUpgradeCost(backpackLevel);
    const maxLevel = 10;
    const isMaxLevel = backpackLevel >= maxLevel;
    const canAffordUpgrade = !isMaxLevel && (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const onUpgradeBackpack = async () => {
        setIsUpgrading(true);
        try {
            const updatedChar = await api.upgradeBackpack();
            updateCharacter(updatedChar);
        } catch (e: any) { 
            alert(e.message || t('error.title')); 
        } finally {
            setIsUpgrading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full animate-fade-in">
             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col justify-center items-center border border-slate-700/30">
                <BriefcaseIcon className="h-16 w-16 text-indigo-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">{t('camp.backpackTitle')}</h3>
                <p className="text-lg text-gray-400">Poziom: <span className="text-white font-bold">{backpackLevel} / {maxLevel}</span></p>
                <p className="text-lg text-gray-400">Pojemność: <span className="text-white font-bold">{capacity} przedmiotów</span></p>
             </div>

             <div className="bg-slate-900/40 p-6 rounded-xl flex flex-col border border-slate-700/30">
                <h3 className="text-xl font-bold text-gray-300 mb-6 flex items-center">
                    Ulepszanie Plecaka
                </h3>

                {isMaxLevel ? (
                     <div className="flex-grow flex flex-col items-center justify-center text-center">
                         <p className="text-xl font-bold text-amber-400">{t('camp.maxBackpackLevel')}</p>
                         <p className="mt-2 text-gray-500">{t('camp.maxBackpackLevelDesc')}</p>
                     </div>
                ) : (
                    <div className="flex-grow flex flex-col justify-between">
                         <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
                            <p className="text-gray-400 text-sm mb-2">{t('camp.nextCapacity')}: <span className="text-white font-bold text-lg">{getBackpackCapacity(backpackLevel + 1)}</span></p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-6">
                            <h4 className="text-sm font-bold text-gray-300 mb-3 border-b border-slate-700 pb-2">{t('camp.upgradeCost')}</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-300"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400" />{t('resources.gold')}</span>
                                    <span className={`font-mono font-bold ${(baseCharacter.resources.gold || 0) >= upgradeCost.gold ? 'text-green-400' : 'text-red-400'}`}>
                                        {(baseCharacter.resources.gold || 0).toLocaleString()} / {upgradeCost.gold.toLocaleString()}
                                    </span>
                                </div>
                                {upgradeCost.essences.map(e => (
                                    <div key={e.type} className="flex justify-between items-center">
                                        <span className={`${rarityStyles[essenceToRarityMap[e.type]].text} flex items-center`}>
                                            {t(`resources.${e.type}`)}
                                        </span>
                                        <span className={`font-mono font-bold ${(baseCharacter.resources[e.type] || 0) >= e.amount ? 'text-green-400' : 'text-red-400'}`}>
                                            {(baseCharacter.resources[e.type] || 0)} / {e.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={onUpgradeBackpack} disabled={!canAffordUpgrade || isUpgrading} className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white disabled:bg-slate-700 disabled:text-gray-500 transition-colors">
                            {isUpgrading ? 'Ulepszanie...' : t('camp.upgrade')}
                        </button>
                    </div>
                )}
             </div>
        </div>
    );
};

const WorkshopPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter, gameData } = useCharacter();
    const { t } = useTranslation();
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [craftingSlot, setCraftingSlot] = useState<EquipmentSlot | 'ring' | 'consumable'>(EquipmentSlot.MainHand);
    const [craftingRarity, setCraftingRarity] = useState<ItemRarity>(ItemRarity.Common);
    const [reforgeTab, setReforgeTab] = useState<'values' | 'affixes'>('values');
    const [selectedReforgeItem, setSelectedReforgeItem] = useState<ItemInstance | null>(null);

    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates } = gameData;
    
    // --- WORKSHOP LEVEL & UPGRADE ---
    const workshop = character.workshop || { level: 0 };
    const level = workshop.level;
    const maxLevel = 10;
    const isMaxLevel = level >= maxLevel;
    const upgradeCost = isMaxLevel ? { gold: Infinity, essences: [] } : getWorkshopUpgradeCost(level + 1);
    
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

    // --- CRAFTING ---
    const craftingCost = calculateCraftingCost(craftingRarity, character);
    const canAffordCraft = (character.resources.gold >= craftingCost.gold) && craftingCost.essences.every(e => (character.resources[e.type] || 0) >= e.amount);
    
    // Unlock requirements based on rarity
    const isRarityUnlocked = (r: ItemRarity) => {
        if (r === ItemRarity.Rare) return level >= 3;
        if (r === ItemRarity.Epic) return level >= 5;
        if (r === ItemRarity.Legendary) return level >= 7;
        return true;
    };

    const handleCraft = async () => {
        if (!isRarityUnlocked(craftingRarity)) return alert("Zbyt niski poziom warsztatu.");
        if (!canAffordCraft) return alert("Niewystarczające zasoby.");
        try {
            const updated = await api.craftItem(craftingSlot, craftingRarity);
            updateCharacter(updated);
            alert("Przedmiot wytworzony!");
        } catch(e:any) { alert(e.message); }
    };

    // --- REFORGING ---
    const reforgeUnlocked = level >= 10;
    const backpackItems = character.inventory.filter(i => !i.isBorrowed);

    // Calculate cost dynamically if item selected
    const reforgeCost = selectedReforgeItem && gameData.itemTemplates 
        ? calculateReforgeCost(selectedReforgeItem, reforgeTab, character, gameData.itemTemplates.find(t=>t.id===selectedReforgeItem.templateId)!) 
        : null;

    const canAffordReforge = reforgeCost 
        ? (character.resources.gold >= reforgeCost.gold && reforgeCost.essences.every(e => (character.resources[e.type] || 0) >= e.amount))
        : false;

    const handleReforge = async () => {
        if (!selectedReforgeItem) return;
        try {
            const updated = await api.reforgeItem(selectedReforgeItem.uniqueId, reforgeTab);
            updateCharacter(updated);
            setSelectedReforgeItem(null); // Deselect to force refresh or just convenience
            alert("Przedmiot przekuty!");
        } catch(e:any) { alert(e.message); }
    };


    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full animate-fade-in overflow-y-auto">
            
            {/* LEFT COLUMN: STATUS & UPGRADE */}
            <div className="space-y-6">
                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700/30">
                     <h3 className="text-xl font-bold text-amber-500 mb-4 flex items-center">
                        <AnvilIcon className="h-6 w-6 mr-2" />
                        Warsztat Rzemieślnika
                    </h3>
                    <div className="bg-slate-800/50 p-4 rounded-lg flex justify-between items-center mb-4">
                        <div>
                            <p className="text-gray-400 text-xs uppercase">Poziom</p>
                            <p className="text-3xl font-bold text-white">{level} <span className="text-lg text-gray-500">/ {maxLevel}</span></p>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                            <p>Lvl 3: Rzadkie</p>
                            <p>Lvl 5: Epickie</p>
                            <p>Lvl 7: Legendarne</p>
                            <p>Lvl 10: Przekuwanie</p>
                        </div>
                    </div>

                    {!isMaxLevel ? (
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                             <h4 className="text-sm font-bold text-gray-300 mb-3 border-b border-slate-700 pb-2">{t('camp.upgradeCost')} (Lvl {level + 1})</h4>
                             <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-300"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400" />{t('resources.gold')}</span>
                                    <span className={`font-mono font-bold ${(baseCharacter.resources.gold || 0) >= upgradeCost.gold ? 'text-green-400' : 'text-red-400'}`}>
                                        {(baseCharacter.resources.gold || 0).toLocaleString()} / {upgradeCost.gold.toLocaleString()}
                                    </span>
                                </div>
                                {upgradeCost.essences.map(e => (
                                    <div key={e.type} className="flex justify-between items-center">
                                        <span className={`${rarityStyles[essenceToRarityMap[e.type]].text} flex items-center`}>
                                            {t(`resources.${e.type}`)}
                                        </span>
                                        <span className={`font-mono font-bold ${(baseCharacter.resources[e.type] || 0) >= e.amount ? 'text-green-400' : 'text-red-400'}`}>
                                            {(baseCharacter.resources[e.type] || 0)} / {e.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={onUpgradeWorkshop} 
                                disabled={!canAffordUpgrade || isUpgrading} 
                                className="w-full mt-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
                            >
                                {isUpgrading ? 'Ulepszanie...' : t('camp.upgrade')}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-4 bg-slate-800/30 rounded border border-amber-500/20">
                            <p className="text-amber-400 font-bold">Maksymalny Poziom Osiągnięty</p>
                        </div>
                    )}
                </div>

                {/* REFORGING PANEL */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-purple-500/30 flex flex-col flex-grow">
                    <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center justify-between">
                        <span>Przekuwanie (Reforging)</span>
                        {!reforgeUnlocked && <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded border border-red-700">Wymagany Lvl 10</span>}
                    </h3>
                    
                    {reforgeUnlocked ? (
                        <>
                             <div className="flex mb-4 bg-slate-800 rounded p-1">
                                <button onClick={() => setReforgeTab('values')} className={`flex-1 py-1 text-sm rounded ${reforgeTab === 'values' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Oszlifowanie (Wartości)</button>
                                <button onClick={() => setReforgeTab('affixes')} className={`flex-1 py-1 text-sm rounded ${reforgeTab === 'affixes' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Przekucie Magii (Afiksy)</button>
                            </div>
                            
                            <p className="text-xs text-gray-400 mb-4 italic">
                                {reforgeTab === 'values' ? "Losuje na nowo wartości liczbowe obecnych statystyk. Afiksy pozostają bez zmian." : "Usuwa obecne afiksy i losuje nowe dla tego przedmiotu."}
                            </p>

                            <div className="flex-grow overflow-y-auto pr-2 max-h-60 mb-4 bg-slate-800/30 rounded p-2 border border-slate-700">
                                {backpackItems.length === 0 && <p className="text-gray-500 text-center py-4">Pusty plecak.</p>}
                                {backpackItems.map(item => {
                                    const tmpl = itemTemplates.find(t=>t.id===item.templateId);
                                    if(!tmpl) return null;
                                    return (
                                        <div 
                                            key={item.uniqueId} 
                                            onClick={() => setSelectedReforgeItem(item)}
                                            className={`p-2 rounded mb-1 cursor-pointer border ${selectedReforgeItem?.uniqueId === item.uniqueId ? 'bg-indigo-900/50 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                        >
                                            <ItemListItem item={item} template={tmpl} affixes={gameData.affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} className="border-0 bg-transparent p-0 shadow-none pointer-events-none"/>
                                        </div>
                                    )
                                })}
                            </div>

                            {selectedReforgeItem && reforgeCost && (
                                <div className="border-t border-slate-700 pt-4">
                                     <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-gray-400">Koszt:</span>
                                        <div className="flex gap-3">
                                            <span className="text-amber-400 font-mono">{reforgeCost.gold}g</span>
                                            {reforgeCost.essences.map(e => <span key={e.type} className={`${rarityStyles[essenceToRarityMap[e.type]].text} font-mono`}>{e.amount}x</span>)}
                                        </div>
                                     </div>
                                     <button 
                                        onClick={handleReforge}
                                        disabled={!canAffordReforge}
                                        className="w-full py-2 bg-purple-700 hover:bg-purple-600 rounded text-white font-bold disabled:bg-slate-700 disabled:cursor-not-allowed"
                                     >
                                         Przekuj
                                     </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-grow flex items-center justify-center text-center p-8">
                             <p className="text-gray-500">Ulepsz warsztat do poziomu 10, aby odblokować.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT COLUMN: CRAFTING */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700/30 flex flex-col">
                <h3 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                    <AnvilIcon className="h-6 w-6 mr-2" />
                    Wytwarzanie (Crafting)
                </h3>
                
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Kategoria / Slot</label>
                        <select 
                            value={craftingSlot} 
                            onChange={e => setCraftingSlot(e.target.value as any)}
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            <option value={EquipmentSlot.MainHand}>Broń Główna</option>
                            <option value={EquipmentSlot.OffHand}>Druga Ręka</option>
                            <option value={EquipmentSlot.TwoHand}>Broń Dwuręczna</option>
                            <option value={EquipmentSlot.Head}>Hełm</option>
                            <option value={EquipmentSlot.Chest}>Zbroja</option>
                            <option value={EquipmentSlot.Legs}>Nogawice</option>
                            <option value={EquipmentSlot.Feet}>Buty</option>
                            <option value={EquipmentSlot.Hands}>Rękawice</option>
                            <option value={EquipmentSlot.Waist}>Pas</option>
                            <option value={EquipmentSlot.Neck}>Amulet</option>
                            <option value="ring">Pierścień</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Jakość (Rzadkość)</label>
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
                                            py-2 px-3 rounded border text-xs font-bold transition-all
                                            ${craftingRarity === r ? `${style.bg} ${style.border} text-white ring-2 ring-white` : 'bg-slate-800 border-slate-700 text-gray-400'}
                                            ${!unlocked ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80'}
                                        `}
                                    >
                                        {t(`rarity.${r}`)} {!unlocked && "(Zablokowane)"}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mt-4">
                        <h4 className="text-sm font-bold text-gray-300 mb-3 border-b border-slate-700 pb-2">Koszt Wytworzenia</h4>
                         <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="flex items-center text-gray-300"><CoinsIcon className="h-4 w-4 mr-2 text-amber-400" />{t('resources.gold')}</span>
                                <span className={`font-mono font-bold ${(baseCharacter.resources.gold || 0) >= craftingCost.gold ? 'text-green-400' : 'text-red-400'}`}>
                                    {(baseCharacter.resources.gold || 0).toLocaleString()} / {craftingCost.gold.toLocaleString()}
                                </span>
                            </div>
                            {craftingCost.essences.map(e => (
                                <div key={e.type} className="flex justify-between items-center">
                                    <span className={`${rarityStyles[essenceToRarityMap[e.type]].text} flex items-center`}>
                                        {t(`resources.${e.type}`)}
                                    </span>
                                    <span className={`font-mono font-bold ${(baseCharacter.resources[e.type] || 0) >= e.amount ? 'text-green-400' : 'text-red-400'}`}>
                                        {(baseCharacter.resources[e.type] || 0)} / {e.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {character.characterClass === CharacterClass.Engineer && (
                            <p className="text-xs text-green-400 mt-2 text-right">Bonus Inżyniera (-20%) aktywny</p>
                        )}
                    </div>

                    <button 
                        onClick={handleCraft} 
                        disabled={!canAffordCraft || !isRarityUnlocked(craftingRarity)}
                        className="w-full py-4 bg-green-700 hover:bg-green-600 text-white font-bold text-lg rounded-lg shadow-lg transition-transform hover:scale-[1.02] disabled:bg-slate-700 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                    >
                        <AnvilIcon className="h-6 w-6"/> WYTWORZ
                    </button>
                    
                    <p className="text-xs text-gray-500 italic text-center">
                        * Przedmiot zostanie wylosowany z dostępnej puli dla wybranego slotu i rzadkości. Statystyki i afiksy są losowe.
                    </p>
                </div>
            </div>

        </div>
    );
};

export const Camp: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<CampTab>('OVERVIEW');
    const { baseCharacter } = useCharacter();

    if (!baseCharacter) return null;

    return (
        <ContentPanel title={t('camp.title')}>
            <div className="flex justify-between items-center border-b border-slate-700 mb-6">
                <div className="flex gap-2 overflow-x-auto">
                    <button onClick={() => setActiveTab('OVERVIEW')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 ${activeTab === 'OVERVIEW' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <HomeIcon className="h-4 w-4" /> Przegląd
                    </button>
                    <button onClick={() => setActiveTab('WORKSHOP')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 ${activeTab === 'WORKSHOP' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <AnvilIcon className="h-4 w-4" /> Warsztat
                    </button>
                    <button onClick={() => setActiveTab('TREASURY')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 ${activeTab === 'TREASURY' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <ChestIcon className="h-4 w-4" /> Skarbiec
                    </button>
                    <button onClick={() => setActiveTab('WAREHOUSE')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 ${activeTab === 'WAREHOUSE' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <ShieldIcon className="h-4 w-4" /> Magazyn
                    </button>
                    <button onClick={() => setActiveTab('BACKPACK')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 ${activeTab === 'BACKPACK' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <BriefcaseIcon className="h-4 w-4" /> Plecak
                    </button>
                </div>
                 <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700 flex-shrink-0">
                     <CoinsIcon className="h-5 w-5 text-amber-400" />
                     <span className="font-mono text-lg font-bold text-amber-400">{(baseCharacter.resources.gold || 0).toLocaleString()}</span>
                 </div>
            </div>

            <div className="h-[70vh] overflow-y-auto pr-2">
                {activeTab === 'OVERVIEW' && <OverviewPanel />}
                {activeTab === 'WORKSHOP' && <WorkshopPanel />}
                {activeTab === 'TREASURY' && <TreasuryPanel />}
                {activeTab === 'WAREHOUSE' && <WarehousePanel />}
                {activeTab === 'BACKPACK' && <BackpackPanel />}
            </div>
        </ContentPanel>
    );
};
