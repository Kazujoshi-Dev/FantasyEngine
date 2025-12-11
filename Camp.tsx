import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { EssenceType, ItemRarity, ItemInstance, EquipmentSlot } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ChestIcon } from './icons/ChestIcon';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { rarityStyles, ItemListItem } from './shared/ItemSlot';
import { useCharacter } from '@/contexts/CharacterContext';
import { api } from '../api';
import { getCampUpgradeCost, getChestUpgradeCost, getBackpackUpgradeCost, getWarehouseUpgradeCost, getWarehouseCapacity } from '@/logic/stats';

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

type CampTab = 'OVERVIEW' | 'TREASURY' | 'WAREHOUSE' | 'BACKPACK';

// --- Sub-components ---

const OverviewPanel: React.FC = () => {
    const { character, baseCharacter, updateCharacter } = useCharacter();
    const { t } = useTranslation();
    const [countdown, setCountdown] = useState(REGEN_INTERVAL_SECONDS);

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
    const onUpgradeCamp = async () => { try { updateCharacter(await api.upgradeCamp()); } catch(e:any) { alert(e.message); }};
    const onHealToFull = async () => { try { updateCharacter(await api.healCharacter()); } catch(e:any) { alert(e.message); }};

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
                        disabled={activeExpedition !== null || isTraveling || isResting || currentHealth >= maxHealth} 
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-colors duration-200 shadow-md bg-emerald-700 hover:bg-emerald-600 text-white disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed border border-emerald-500/30`}
                    >
                        {t('camp.healToFull')}
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
                                disabled={!canAffordUpgrade || isResting || isTraveling} 
                                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                {t('camp.upgrade')}
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
        try {
            const updatedChar = await api.upgradeChest();
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message || t('error.title')); }
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
                        disabled={!canAffordUpgrade} 
                        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 shadow-lg disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        {t('camp.upgrade')}
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
    
    if (!character || !baseCharacter || !gameData) return null;
    const { itemTemplates, affixes } = gameData;
    
    const warehouse = character.warehouse || { level: 1, items: [] };
    const warehouseLevel = warehouse.level;
    const warehouseItems = warehouse.items || [];
    
    const maxLevel = 10;
    const isMaxLevel = warehouseLevel >= maxLevel;

    const capacity = getWarehouseCapacity(warehouseLevel);
    const upgradeCost = getWarehouseUpgradeCost(warehouseLevel);
    const canAffordUpgrade = (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const onUpgradeWarehouse = async () => {
        try {
            const updatedChar = await api.upgradeWarehouse();
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message || t('error.title')); }
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
                        Poziom: <span className="text-white font-bold">{warehouseLevel} / {maxLevel}</span> | Pojemność: <span className="text-white font-bold">{warehouseItems.length} / {capacity}</span>
                        {warehouseItems.length >= capacity && <span className="text-red-400 ml-2 font-bold">(PEŁNY)</span>}
                    </p>
                </div>
                 <div className="flex items-center gap-4">
                    {isMaxLevel ? (
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
                                disabled={!canAffordUpgrade || isMaxLevel} 
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors disabled:bg-slate-700 disabled:text-gray-500"
                                title="Zwiększ pojemność magazynu o 3 miejsca"
                            >
                                Ulepsz (+3 sloty)
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
                    {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                </select>
                <select className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={filterSlot} onChange={(e) => setFilterSlot(e.target.value)}>
                    <option value="all">Wszystkie Typy</option>
                    {Object.values(EquipmentSlot).map(s => <option key={s} value={s}>{t(`equipment.slot.${s}`)}</option>)}
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
    
    if (!character || !baseCharacter) return null;

    const backpackLevel = character.backpack?.level || 1;
    const capacity = getBackpackCapacity(backpackLevel);
    const upgradeCost = getBackpackUpgradeCost(backpackLevel);
    const maxLevel = 10;
    const isMaxLevel = backpackLevel >= maxLevel;
    const canAffordUpgrade = !isMaxLevel && (baseCharacter.resources?.gold || 0) >= upgradeCost.gold && upgradeCost.essences.every(e => (baseCharacter.resources[e.type] || 0) >= e.amount);

    const onUpgradeBackpack = async () => {
        try {
            const updatedChar = await api.upgradeBackpack();
            updateCharacter(updatedChar);
        } catch (e: any) { alert(e.message || t('error.title')); }
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

                        <button onClick={onUpgradeBackpack} disabled={!canAffordUpgrade} className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white disabled:bg-slate-700 disabled:text-gray-500 transition-colors">{t('camp.upgrade')}</button>
                    </div>
                )}
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
                {activeTab === 'TREASURY' && <TreasuryPanel />}
                {activeTab === 'WAREHOUSE' && <WarehousePanel />}
                {activeTab === 'BACKPACK' && <BackpackPanel />}
            </div>
        </ContentPanel>
    );
};
