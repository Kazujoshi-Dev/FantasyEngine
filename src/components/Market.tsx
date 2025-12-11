
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { PlayerCharacter, GameData, MarketListing, ItemInstance, CurrencyType, ListingType, EssenceType, ItemTemplate, ItemRarity, RolledAffixStats, EquipmentSlot, CharacterStats } from '../types';
import { api } from '../api';
import { ItemDetailsPanel, ItemListItem, rarityStyles, getGrammaticallyCorrectFullName } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { ClockIcon } from './icons/ClockIcon';
import { StarIcon } from './icons/StarIcon';
import { ScaleIcon } from './icons/ScaleIcon';
import { useCharacter } from '@/contexts/CharacterContext';

const CountdownTimer: React.FC<{ until: string, onFinish?: () => void }> = ({ until, onFinish }) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            // Use api.getServerTime() for sync
            const remaining = new Date(until).getTime() - api.getServerTime();
            if (remaining > 0) {
                 const hours = Math.floor(remaining / (1000 * 60 * 60));
                 const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                 const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                 setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            } else {
                setTimeLeft('00:00:00');
                if (onFinish) onFinish();
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [until, onFinish]);

    return (
        <span className="flex items-center text-xs text-gray-400">
            <ClockIcon className="h-3 w-3 mr-1" />
            {timeLeft || '...'}
        </span>
    );
};

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

const CurrencyDisplay: React.FC<{ currency: CurrencyType, amount: number }> = ({ currency, amount }) => {
    const { t } = useTranslation();
    if (currency === 'gold') {
        return <span className="text-amber-400 flex items-center">{amount.toLocaleString()} <CoinsIcon className="h-4 w-4 ml-1"/></span>;
    }
    const rarity = essenceToRarityMap[currency];
    const colorClass = rarityStyles[rarity]?.text || 'text-gray-300';

    return <span className={`${colorClass} flex items-center`}>{amount.toLocaleString()} <StarIcon className="h-4 w-4 ml-1"/></span>
}

const PRIMARY_STAT_KEYS: (keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];

const SECONDARY_STAT_KEYS = [
    'physicalDamage', 'magicDamage', 'attacksPerRound', 'armor', 'critChance', 
    'maxHealth', 'critDamageModifier', 'armorPenetration', 'lifeSteal', 'manaSteal', 'dodgeChance'
];


const BrowseListings: React.FC = () => {
    const { character, gameData, updateCharacter: onCharacterUpdate } = useCharacter();
    const { t } = useTranslation();
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
    const [bidAmount, setBidAmount] = useState<string>('');
    const [filters, setFilters] = useState({
        slot: 'all',
        rarity: 'all',
        affixCount: 'any',
        prefix: 'any',
        suffix: 'any',
    });
    const [selectedPrimaryStats, setSelectedPrimaryStats] = useState<string[]>([]);
    const [selectedSecondaryStats, setSelectedSecondaryStats] = useState<string[]>([]);

    if (!character || !gameData) return null;

    const fetchListings = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getMarketListings();
            setListings(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchListings();
    }, [fetchListings]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleStatToggle = (stat: string, type: 'primary' | 'secondary') => {
        const updater = type === 'primary' ? setSelectedPrimaryStats : setSelectedSecondaryStats;
        updater(prev => prev.includes(stat) ? prev.filter(s => s !== stat) : [...prev, stat]);
    };
    
    const resetFilters = () => {
        setFilters({ slot: 'all', rarity: 'all', affixCount: 'any', prefix: 'any', suffix: 'any' });
        setSelectedPrimaryStats([]);
        setSelectedSecondaryStats([]);
    };

    const filteredListings = useMemo(() => {
        const hasAllPrimaryStats = (item: ItemInstance, template: ItemTemplate, stats: string[]): boolean => {
            const allBonuses: Partial<Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>> = {
                ...(item.rolledBaseStats?.statsBonus || {}),
                ...(item.rolledPrefix?.statsBonus || {}),
                ...(item.rolledSuffix?.statsBonus || {})
            };
            return stats.every(stat => (allBonuses as any)?.[stat] > 0);
        };
    
        const hasAllSecondaryStats = (item: ItemInstance, template: ItemTemplate, stats: string[]): boolean => {
             const allBonuses: RolledAffixStats = { ...item.rolledBaseStats, ...item.rolledPrefix, ...item.rolledSuffix };
             return stats.every(stat => {
                 switch (stat) {
                     case 'physicalDamage': return allBonuses.damageMin || allBonuses.damageMax;
                     case 'magicDamage': return allBonuses.magicDamageMin || allBonuses.magicDamageMax;
                     case 'attacksPerRound': return allBonuses.attacksPerRoundBonus;
                     case 'armor': return allBonuses.armorBonus;
                     case 'critChance': return allBonuses.critChanceBonus;
                     case 'maxHealth': return allBonuses.maxHealthBonus;
                     case 'critDamageModifier': return allBonuses.critDamageModifierBonus;
                     case 'armorPenetration': return allBonuses.armorPenetrationPercent || allBonuses.armorPenetrationFlat;
                     case 'lifeSteal': return allBonuses.lifeStealPercent || allBonuses.lifeStealFlat;
                     case 'manaSteal': return allBonuses.manaStealPercent || allBonuses.manaStealFlat;
                     case 'dodgeChance': return allBonuses.dodgeChanceBonus;
                     default: return false;
                 }
             });
        };

        return listings.filter(listing => {
            const template = gameData.itemTemplates.find(t => t.id === listing.item_data.templateId);
            if (!template) return false;

            if (filters.slot !== 'all' && template.slot !== filters.slot) return false;
            if (filters.rarity !== 'all' && template.rarity !== filters.rarity) return false;

            const hasPrefix = !!listing.item_data.prefixId;
            const hasSuffix = !!listing.item_data.suffixId;
            const affixCount = (hasPrefix ? 1 : 0) + (hasSuffix ? 1 : 0);

            if (filters.prefix === 'yes' && !hasPrefix) return false;
            if (filters.prefix === 'no' && hasPrefix) return false;
            if (filters.suffix === 'yes' && !hasSuffix) return false;
            if (filters.suffix === 'no' && hasSuffix) return false;
            if (filters.affixCount !== 'any' && affixCount !== parseInt(filters.affixCount, 10)) return false;

            if (selectedPrimaryStats.length > 0 && !hasAllPrimaryStats(listing.item_data, template, selectedPrimaryStats)) return false;
            if (selectedSecondaryStats.length > 0 && !hasAllSecondaryStats(listing.item_data, template, selectedSecondaryStats)) return false;

            return true;
        });
    }, [listings, filters, selectedPrimaryStats, selectedSecondaryStats, gameData.itemTemplates]);

    const handleBuyNow = async (listing: MarketListing) => {
        if (!listing.buy_now_price) return;
        if (listing.currency === 'gold' && character.resources.gold < listing.buy_now_price) {
            alert(t('market.notEnoughGold'));
            return;
        }
        if (listing.currency !== 'gold' && (character.resources[listing.currency] || 0) < listing.buy_now_price) {
             alert(t('market.notEnoughEssence'));
            return;
        }
        try {
            const updatedChar = await api.buyMarketListing(listing.id);
            onCharacterUpdate(updatedChar);
            setSelectedListing(null);
            fetchListings();
        } catch (err: any) {
            alert(err.message);
        }
    };
    
    const handlePlaceBid = async (listing: MarketListing) => {
        const bid = parseInt(bidAmount, 10);
        if (isNaN(bid)) return;

        // Logic: Bid must be at least 5% higher than current bid
        const currentPrice = listing.current_bid_price || 0;
        const minBid = listing.current_bid_price 
            ? Math.ceil(currentPrice * 1.05) 
            : listing.start_bid_price!;

        if (bid < minBid) {
            alert(t('market.bidTooLow', { amount: minBid }));
            return;
        }

        if (listing.currency === 'gold' && character.resources.gold < bid) {
            alert(t('market.notEnoughGold'));
            return;
        }
        if (listing.currency !== 'gold' && (character.resources[listing.currency] || 0) < bid) {
             alert(t('market.notEnoughEssence'));
            return;
        }

        try {
            const updatedListing = await api.bidOnMarketListing(listing.id, bid);
            setListings(prev => prev.map(l => l.id === updatedListing.id ? updatedListing : l));
            setSelectedListing(updatedListing);
            const updatedChar = await api.getCharacter();
            onCharacterUpdate(updatedChar);
            setBidAmount('');
        } catch (err: any) {
            alert(err.message);
        }
    };


    const selectedTemplate = useMemo(() => {
        if (!selectedListing) return null;
        return gameData.itemTemplates.find(t => t.id === selectedListing.item_data.templateId) || null;
    }, [selectedListing, gameData.itemTemplates]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">
            <div className="xl:col-span-2 bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="text-xl font-bold text-indigo-400">{t('market.browse.title')}</h3>
                </div>
                <details className="bg-slate-800/50 rounded-lg p-3 mb-4 text-sm">
                    <summary className="font-semibold cursor-pointer">{t('market.browse.filters.title')}</summary>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('market.browse.filters.slot')}</label>
                            <select name="slot" value={filters.slot} onChange={handleFilterChange} className="w-full bg-slate-700 p-1.5 rounded-md text-xs">
                                <option value="all">{t('market.browse.filters.all')}</option>
                                {(Object.values(EquipmentSlot) as string[]).map(value => <option key={value} value={value}>{t(`equipment.slot.${value}`)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('market.browse.filters.rarity')}</label>
                            <select name="rarity" value={filters.rarity} onChange={handleFilterChange} className="w-full bg-slate-700 p-1.5 rounded-md text-xs">
                                <option value="all">{t('market.browse.filters.all')}</option>
                                {(Object.values(ItemRarity) as string[]).map(value => <option key={value} value={value}>{t(`rarity.${value}`)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('market.browse.filters.affixCount')}</label>
                            <select name="affixCount" value={filters.affixCount} onChange={handleFilterChange} className="w-full bg-slate-700 p-1.5 rounded-md text-xs">
                                <option value="any">{t('market.browse.filters.any')}</option><option value="0">0</option><option value="1">1</option><option value="2">2</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('market.browse.filters.hasPrefix')}</label>
                            <select name="prefix" value={filters.prefix} onChange={handleFilterChange} className="w-full bg-slate-700 p-1.5 rounded-md text-xs">
                                <option value="any">{t('market.browse.filters.any')}</option><option value="yes">{t('market.browse.filters.yes')}</option><option value="no">{t('market.browse.filters.no')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('market.browse.filters.hasSuffix')}</label>
                            <select name="suffix" value={filters.suffix} onChange={handleFilterChange} className="w-full bg-slate-700 p-1.5 rounded-md text-xs">
                                <option value="any">{t('market.browse.filters.any')}</option><option value="yes">{t('market.browse.filters.yes')}</option><option value="no">{t('market.browse.filters.no')}</option>
                            </select>
                        </div>
                        <div className="col-span-full border-t border-slate-700/50 mt-2 pt-2">
                             <label className="block text-xs font-medium text-gray-400 mb-1">{t('market.browse.filters.searchAttributes')}</label>
                             <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                                {PRIMARY_STAT_KEYS.map(stat => (
                                    <label key={stat} className="flex items-center space-x-2">
                                        <input type="checkbox" checked={selectedPrimaryStats.includes(stat)} onChange={() => handleStatToggle(stat, 'primary')} className="form-checkbox h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/>
                                        <span className="text-xs">{t(`statistics.${stat}`)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-full border-t border-slate-700/50 mt-2 pt-2">
                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('market.browse.filters.searchBonuses')}</label>
                            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                                {SECONDARY_STAT_KEYS.map(stat => (
                                     <label key={stat} className="flex items-center space-x-2">
                                        <input type="checkbox" checked={selectedSecondaryStats.includes(stat)} onChange={() => handleStatToggle(stat, 'secondary')} className="form-checkbox h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/>
                                        <span className="text-xs">{t(`market.browse.filters.stats.${stat}`)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-full">
                            <button onClick={resetFilters} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-semibold py-1.5 rounded-md text-xs mt-2">{t('market.browse.filters.reset')}</button>
                        </div>
                    </div>
                </details>
                <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                    {isLoading ? <p>{t('loading')}</p> : filteredListings.map(listing => {
                        const template = gameData.itemTemplates.find(t => t.id === listing.item_data.templateId);
                        if (!template) return null;
                        return (
                             <div key={listing.id} onClick={() => setSelectedListing(listing)}
                                className={`p-2 rounded-lg cursor-pointer transition-all duration-150 grid grid-cols-12 gap-2 items-center text-sm ${selectedListing?.id === listing.id ? 'bg-indigo-600/30 ring-2 ring-indigo-500' : 'hover:bg-slate-700/50'}`}>
                                <div className="col-span-4">
                                    <ItemListItem item={listing.item_data} template={template} affixes={gameData.affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} />
                                </div>
                                <div className="col-span-2 text-gray-300">{listing.seller_name}</div>
                                <div className="col-span-3 font-mono flex flex-col items-start">
                                    {listing.listing_type === 'buy_now' ? (
                                        <>
                                            <span className="text-xs text-gray-400 font-sans flex items-center gap-1"><CoinsIcon className="h-3 w-3" /> {t('market.buyNow')}</span>
                                            <CurrencyDisplay currency={listing.currency} amount={listing.buy_now_price!} />
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs text-gray-400 font-sans flex items-center gap-1"><ScaleIcon className="h-3 w-3" /> {t('market.auction')}</span>
                                            <CurrencyDisplay currency={listing.currency} amount={listing.current_bid_price || listing.start_bid_price!} />
                                        </>
                                    )}
                                </div>
                                 <div className="col-span-2 text-gray-400"><CountdownTimer until={listing.expires_at} onFinish={fetchListings} /></div>
                                <div className="col-span-1 text-center text-gray-400">{listing.bid_count}</div>
                             </div>
                        )
                    })}
                </div>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl min-h-0">
                {selectedListing && selectedTemplate ? (
                    <ItemDetailsPanel item={selectedListing.item_data} template={selectedTemplate} affixes={gameData.affixes} character={character} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">{t('equipment.selectItemPrompt')}</div>
                )}
                {selectedListing && (
                    <div className="mt-4 border-t border-slate-700/50 pt-4">
                        {selectedListing.listing_type === 'buy_now' && (
                            <button
                                onClick={() => handleBuyNow(selectedListing)}
                                disabled={selectedListing.seller_id === character.id}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-green-700 transition-colors disabled:bg-slate-600 flex items-center justify-center gap-2"
                            >
                                {t('market.buyNowFor')}
                                <CurrencyDisplay currency={selectedListing.currency} amount={selectedListing.buy_now_price!} />
                            </button>
                        )}
                        {selectedListing.listing_type === 'auction' && (
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm text-gray-400">{t('market.browse.currentBid')}</p>
                                    {/* Fix: Use selectedListing instead of listing which is not in scope */}
                                    <p className="font-bold text-lg"><CurrencyDisplay currency={selectedListing.currency} amount={selectedListing.current_bid_price || selectedListing.start_bid_price!} /></p>
                                    {selectedListing.highest_bidder_name && <p className="text-xs text-gray-500">{t('market.browse.highestBidder')}: {selectedListing.highest_bidder_name}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)}
                                        placeholder={t('market.browse.yourBid') || "Twoja oferta"}
                                        className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-center" />
                                    <button onClick={() => handlePlaceBid(selectedListing)}
                                        disabled={selectedListing.seller_id === character.id}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-semibold disabled:bg-slate-600">
                                        {t('market.browse.placeBid')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

const CreateListing: React.FC<{
    onSwitchTab: (tab: 'browse' | 'create' | 'my-listings') => void;
}> = ({ onSwitchTab }) => {
    const { character, gameData, updateCharacter: onCharacterUpdate } = useCharacter();
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);
    const [listingType, setListingType] = useState<ListingType>('buy_now');
    const [price, setPrice] = useState<string>('');
    const [duration, setDuration] = useState<number>(8);
    const [currency, setCurrency] = useState<CurrencyType>('gold');
    const [nameFilter, setNameFilter] = useState('');
    const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');

    if (!character || !gameData) return null;

    const filteredInventory = useMemo(() => {
        return (character.inventory || []).filter(item => {
            if (!item) return false;
            const template = gameData.itemTemplates.find(t => t.id === item.templateId);
            if (!template) return false;

            const nameMatch = getGrammaticallyCorrectFullName(item, template, gameData.affixes || [])
                .toLowerCase()
                .includes(nameFilter.toLowerCase());
            const rarityMatch = rarityFilter === 'all' || template.rarity === rarityFilter;
            
            return nameMatch && rarityMatch;
        });
    }, [character.inventory, gameData.itemTemplates, gameData.affixes, nameFilter, rarityFilter]);
    
    const selectedTemplate = useMemo(() => {
        if (!selectedItem) return null;
        return gameData.itemTemplates.find(t => t.id === selectedItem.templateId) || null;
    }, [selectedItem, gameData.itemTemplates]);

    const handleCreateListing = async () => {
        if (!selectedItem || !price) return;
        try {
            const updatedChar = await api.createMarketListing({
                itemId: selectedItem.uniqueId,
                listingType,
                currency,
                price: parseInt(price, 10),
                durationHours: duration,
            });
            onCharacterUpdate(updatedChar);
            setSelectedItem(null);
            setPrice('');
            onSwitchTab('my-listings');
        } catch (err: any) {
            alert(err.message);
        }
    }

    // Calculate Item Value with Affixes
    const itemValue = useMemo(() => {
        if (!selectedTemplate) return 0;
        let val = Number(selectedTemplate.value) || 0;
        
        const affixes = gameData.affixes || [];
        
        if (selectedItem?.prefixId) {
            const prefix = affixes.find(a => a.id === selectedItem.prefixId);
            if (prefix && prefix.value) {
                val += Number(prefix.value) || 0;
            }
        }
        if (selectedItem?.suffixId) {
            const suffix = affixes.find(a => a.id === selectedItem.suffixId);
            if (suffix && suffix.value) {
                val += Number(suffix.value) || 0;
            }
        }
        return val;
    }, [selectedTemplate, selectedItem, gameData.affixes]);

    const commission = Math.ceil(itemValue * 0.15);
    const netPrice = Math.max(0, parseInt(price, 10) - commission);

    return (
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[75vh]">
             <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('equipment.backpack')}</h3>
                 <div className="px-2 mb-4 space-y-2">
                     <input
                        type="text"
                        placeholder={t('market.create.filterByName')}
                        value={nameFilter}
                        onChange={e => setNameFilter(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm"
                    />
                    <select
                        value={rarityFilter}
                        onChange={e => setRarityFilter(e.target.value as ItemRarity | 'all')}
                        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm"
                    >
                        <option value="all">{t('market.create.allRarities')}</option>
                        {(Object.values(ItemRarity) as string[]).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                    </select>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 space-y-1">
                    {filteredInventory.map(item => {
                        const template = gameData.itemTemplates.find(t => t.id === item.templateId);
                        if (!template) return null;
                        return (
                            <ItemListItem key={item.uniqueId} item={item} template={template} affixes={gameData.affixes}
                                isSelected={selectedItem?.uniqueId === item.uniqueId}
                                onClick={() => setSelectedItem(item)} showPrimaryStat={false}
                            />
                        );
                    })}
                </div>
            </div>
             <div className="xl:col-span-2 bg-slate-900/40 p-4 rounded-xl flex flex-col min-h-0">
                {selectedItem && selectedTemplate ? (
                     <div className="grid grid-cols-2 gap-6">
                        <ItemDetailsPanel item={selectedItem} template={selectedTemplate} affixes={gameData.affixes} character={character} />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{t('market.create.listingType')}</label>
                                <div className="flex gap-2"><button onClick={() => setListingType('buy_now')} className={`w-full py-2 rounded ${listingType === 'buy_now' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('market.create.buyNow')}</button><button onClick={() => setListingType('auction')} className={`w-full py-2 rounded ${listingType === 'auction' ? 'bg-indigo-600' : 'bg-slate-700'}`}>{t('market.create.auction')}</button></div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{listingType === 'buy_now' ? t('market.create.price') : t('market.create.startingBid')}</label>
                                <input type="number" value={price} onChange={e=>setPrice(e.target.value)} className="w-full bg-slate-700 p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{t('market.create.currency')}</label>
                                <select value={currency} onChange={e=>setCurrency(e.target.value as CurrencyType)} className="w-full bg-slate-700 p-2 rounded-md">
                                    <option value="gold">{t('resources.gold')}</option>
                                    {(Object.values(EssenceType) as string[]).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{t('market.create.duration')}</label>
                                <select value={duration} onChange={e=>setDuration(parseInt(e.target.value))} className="w-full bg-slate-700 p-2 rounded-md"><option value={1}>{t('market.create.hours', {count: 1})}</option><option value={8}>{t('market.create.hours', {count: 8})}</option><option value={24}>{t('market.create.hours', {count: 24})}</option></select>
                            </div>
                            <div className="border-t border-slate-700 pt-4 space-y-2 text-sm">
                                <p className="flex justify-between"><span>{t('market.create.itemValue')}:</span> <CurrencyDisplay currency="gold" amount={itemValue} /></p>
                                <p className="flex justify-between"><span>{t('market.create.commission')}:</span> <CurrencyDisplay currency="gold" amount={commission} /></p>
                                {currency === 'gold' && !isNaN(netPrice) && <p className="flex justify-between font-bold"><span>{t('market.create.youWillReceive')}:</span> <CurrencyDisplay currency="gold" amount={netPrice} /></p>}
                            </div>
                            <button onClick={handleCreateListing} disabled={!price} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-green-700 disabled:bg-slate-600">{t('market.create.createListing')}</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">{t('market.create.selectItem')}</div>
                )}
            </div>
        </div>
    )
}

const MyListings: React.FC = () => {
    const { character, gameData, updateCharacter: onCharacterUpdate } = useCharacter();
    const { t } = useTranslation();
    const [myListings, setMyListings] = useState<MarketListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    if (!character || !gameData) return null;

    const fetchMyListings = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getMyMarketListings();
            setMyListings(data);
        } catch (error) { console.error(error); } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchMyListings(); }, [fetchMyListings]);

    const handleCancel = async (id: number) => {
        if (!window.confirm(t('market.myListings.cancelConfirm'))) return;
        try {
            const updatedChar = await api.cancelMarketListing(id);
            onCharacterUpdate(updatedChar);
            fetchMyListings();
        } catch (err: any) { alert(err.message); }
    }
    
    const handleClaim = async (id: number) => {
        try {
            const updatedChar = await api.claimMarketListing(id);
            onCharacterUpdate(updatedChar);
            fetchMyListings();
        } catch (err: any) { alert(err.message); }
    }

    const renderAction = (listing: MarketListing) => {
        switch(listing.status) {
            case 'ACTIVE': return <button onClick={() => handleCancel(listing.id)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('market.myListings.cancel')}</button>;
            case 'SOLD': return <button onClick={() => handleClaim(listing.id)} className="px-3 py-1 text-xs rounded bg-green-600 hover:bg-green-700">{t('market.myListings.claim')}</button>;
            case 'EXPIRED':
            case 'CANCELLED': return <button onClick={() => handleClaim(listing.id)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('market.myListings.retrieve')}</button>;
            default: return null;
        }
    };

    return (
        <div className="bg-slate-900/40 p-4 rounded-xl">
             <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('market.myListings.title')}</h3>
             <div className="space-y-2">
                {isLoading && <p>{t('loading')}</p>}
                {!isLoading && myListings.length === 0 && <p className="text-gray-500 text-center py-8">{t('market.myListings.noListings')}</p>}
                {myListings.map(listing => {
                    const template = gameData.itemTemplates.find(t => t.id === listing.item_data.templateId)!;
                    return (
                        <div key={listing.id} className="p-2 rounded-lg bg-slate-800/50 grid grid-cols-12 gap-4 items-center text-sm">
                            <div className="col-span-4"><ItemListItem item={listing.item_data} template={template} affixes={gameData.affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false}/></div>
                            <div className="col-span-2 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    listing.status === 'ACTIVE' ? 'bg-green-900 text-green-300' : 
                                    listing.status === 'CLAIMED' ? 'bg-slate-700 text-slate-400' :
                                    'bg-slate-700 text-slate-300'
                                }`}>
                                    {t(`market.myListings.status.${listing.status}` as any)}
                                </span>
                            </div>
                            <div className="col-span-3 font-mono">
                                <CurrencyDisplay currency={listing.currency} amount={listing.current_bid_price || listing.buy_now_price || listing.start_bid_price!} />
                            </div>
                            <div className="col-span-2">{listing.status === 'ACTIVE' && <CountdownTimer until={listing.expires_at} onFinish={fetchMyListings} />}</div>
                            <div className="col-span-1">{renderAction(listing)}</div>
                        </div>
                    )
                })}
             </div>
             <p className="text-xs text-gray-500 italic mt-4 text-center">{t('market.myListings.claimedHiddenNote')}</p>
        </div>
    )
}

export const Market: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'my-listings'>('browse');
    
     const TABS: { id: typeof activeTab, label: string }[] = [
        { id: 'browse', label: t('market.tabs.browse') },
        { id: 'create', label: t('market.tabs.create') },
        { id: 'my-listings', label: t('market.tabs.myListings') },
    ];

    return (
        <ContentPanel title={t('market.title')}>
            <div className="flex border-b border-slate-700 mb-6">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${activeTab === tab.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {activeTab === 'browse' && <BrowseListings />}
            {activeTab === 'create' && <CreateListing onSwitchTab={setActiveTab} />}
            {activeTab === 'my-listings' && <MyListings />}

        </ContentPanel>
    );
};
