
import React, { useState, useEffect, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { MarketListing, ItemInstance, EssenceType, ItemRarity, ListingType, EquipmentSlot } from '../types';
import { ItemList, ItemDetailsPanel, rarityStyles, getGrammaticallyCorrectFullName } from './shared/ItemSlot';
import { CoinsIcon } from './icons/CoinsIcon';
import { ScaleIcon } from './icons/ScaleIcon';

type MarketTab = 'browse' | 'create' | 'myListings';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const Market: React.FC = () => {
    const { t } = useTranslation();
    const { character, updateCharacter, gameData } = useCharacter();
    const [activeTab, setActiveTab] = useState<MarketTab>('browse');
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [myListings, setMyListings] = useState<MarketListing[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Create State
    const [selectedItem, setSelectedItem] = useState<ItemInstance | null>(null);
    const [listingType, setListingType] = useState<ListingType>(ListingType.BuyNow);
    const [price, setPrice] = useState(100);
    const [startBid, setStartBid] = useState(50);
    const [currency, setCurrency] = useState<'gold' | EssenceType>('gold');
    const [duration, setDuration] = useState(24);

    // Filter State
    const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all');
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [filterPrefix, setFilterPrefix] = useState<'all' | 'yes' | 'no'>('all');
    const [filterSuffix, setFilterSuffix] = useState<'all' | 'yes' | 'no'>('all');
    const [filterAffixCount, setFilterAffixCount] = useState<'all' | '0' | '1' | '2'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const { itemTemplates, affixes } = gameData || { itemTemplates: [], affixes: [], enemies: [] };

    const fetchListings = async () => {
        setIsLoading(true);
        try {
            const [all, my] = await Promise.all([
                api.getMarketListings(),
                api.getMyMarketListings()
            ]);
            setListings(all);
            setMyListings(my);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchListings();
        const interval = setInterval(fetchListings, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateListing = async () => {
        if (!selectedItem) return;
        try {
            await api.createMarketListing({
                itemUniqueId: selectedItem.uniqueId,
                listingType,
                price: listingType === ListingType.BuyNow ? price : 0,
                startBid: listingType === ListingType.Auction ? startBid : 0,
                currency,
                durationHours: duration
            });
            alert('Oferta wystawiona!');
            setSelectedItem(null);
            fetchListings();
            api.getCharacter().then(updateCharacter);
        } catch (e: any) { alert(e.message); }
    };

    const handleBuy = async (id: number) => {
        if (!confirm('Czy na pewno chcesz kupić ten przedmiot?')) return;
        try {
            await api.buyMarketListing(id);
            alert('Zakup udany!');
            fetchListings();
            api.getCharacter().then(updateCharacter);
        } catch (e: any) { alert(e.message); }
    };

    const handleBid = async (id: number, currentBid: number) => {
        const bidAmount = parseInt(prompt(`Podaj kwotę (min ${currentBid + 1}):`, (currentBid + 10).toString()) || '0');
        if (bidAmount <= currentBid) return;
        try {
            await api.bidOnMarketListing(id, bidAmount);
            alert('Oferta złożona!');
            fetchListings();
            api.getCharacter().then(updateCharacter);
        } catch (e: any) { alert(e.message); }
    };

    const handleCancel = async (id: number) => {
        if (!confirm(t('market.myListings.cancelConfirm'))) return;
        try {
            await api.cancelMarketListing(id);
            fetchListings();
        } catch (e: any) { alert(e.message); }
    };

    const handleClaim = async (id: number) => {
        try {
            const updated = await api.claimMarketListing(id);
            updateCharacter(updated);
            fetchListings();
        } catch (e: any) { alert(e.message); }
    };

    // Helper for deduplicating slots in the filter dropdown
    const slotOptions = useMemo(() => {
        const slots = Object.values(EquipmentSlot) as string[];
        const uniqueSlots = Array.from(new Set(slots.map(s => s.startsWith('ring') ? 'ring' : s)));
        return uniqueSlots.map(s => ({
            id: s,
            label: s === 'ring' ? t('item.slot.ring') : t(`equipment.slot.${s}`)
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t]);

    const filteredListings = useMemo(() => {
        return listings.filter(l => {
            const template = itemTemplates.find(t => t.id === l.item_data.templateId);
            if (!template) return false;
            
            const matchRarity = filterRarity === 'all' || template.rarity === filterRarity;
            
            // Normalize ring slots for comparison
            const itemSlotNormalized = template.slot.startsWith('ring') ? 'ring' : template.slot;
            const matchSlot = filterSlot === 'all' || itemSlotNormalized === filterSlot;
            
            const matchSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
            
            // Affix logic
            const hasPrefix = !!l.item_data.prefixId;
            const hasSuffix = !!l.item_data.suffixId;
            const count = (hasPrefix ? 1 : 0) + (hasSuffix ? 1 : 0);

            const matchPrefix = filterPrefix === 'all' || (filterPrefix === 'yes' ? hasPrefix : !hasPrefix);
            const matchSuffix = filterSuffix === 'all' || (filterSuffix === 'yes' ? hasSuffix : !hasSuffix);
            const matchCount = filterAffixCount === 'all' || count === parseInt(filterAffixCount);
            
            return matchRarity && matchSlot && matchSearch && matchPrefix && matchSuffix && matchCount;
        });
    }, [listings, filterRarity, filterSlot, filterPrefix, filterSuffix, filterAffixCount, searchQuery, itemTemplates]);

    const renderPrice = (amount: number, curr: string) => {
        if (curr === 'gold') return <span className="text-amber-400 font-bold flex items-center">{amount} <CoinsIcon className="h-4 w-4 ml-1"/></span>;
        const rarity = essenceToRarityMap[curr as EssenceType];
        return <span className={`${rarityStyles[rarity]?.text || 'text-white'} font-bold`}>{amount} {t(`resources.${curr}`)}</span>;
    };

    const renderAction = (listing: MarketListing) => {
        switch(listing.status) {
            case 'ACTIVE': 
                return <button onClick={() => handleCancel(listing.id)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('market.myListings.cancel')}</button>;
            case 'SOLD': 
                return <button onClick={() => handleClaim(listing.id)} className="px-3 py-1 text-xs rounded bg-green-600 hover:bg-green-700">{t('market.myListings.claim')}</button>;
            case 'EXPIRED':
            case 'CANCELLED': 
                return (
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-gray-400">Przedmiot w wiadomościach</span>
                        <button onClick={() => handleClaim(listing.id)} className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-gray-300">
                            Wyczyść
                        </button>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <ContentPanel title={t('market.title')}>
            <div className="flex border-b border-slate-700 mb-6">
                <button onClick={() => setActiveTab('browse')} className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'browse' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400'}`}>{t('market.tabs.browse')}</button>
                <button onClick={() => setActiveTab('create')} className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'create' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400'}`}>{t('market.tabs.create')}</button>
                <button onClick={() => setActiveTab('myListings')} className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'myListings' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400'}`}>{t('market.tabs.myListings')}</button>
            </div>

            <div className="h-[70vh] overflow-y-auto pr-2">
                {activeTab === 'browse' && (
                    <div className="space-y-4">
                        {/* Filters Container */}
                        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Nazwa</label>
                                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('market.create.filterByName')} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">{t('market.browse.filters.rarity')}</label>
                                    <select value={filterRarity} onChange={e => setFilterRarity(e.target.value as any)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none">
                                        <option value="all">{t('market.browse.filters.all')}</option>
                                        {Object.values(ItemRarity).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">{t('market.browse.filters.slot')}</label>
                                    <select value={filterSlot} onChange={e => setFilterSlot(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none">
                                        <option value="all">{t('market.browse.filters.all')}</option>
                                        {slotOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">{t('market.browse.filters.hasPrefix')}</label>
                                    <select value={filterPrefix} onChange={e => setFilterPrefix(e.target.value as any)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none">
                                        <option value="all">{t('market.browse.filters.any')}</option>
                                        <option value="yes">{t('market.browse.filters.yes')}</option>
                                        <option value="no">{t('market.browse.filters.no')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">{t('market.browse.filters.hasSuffix')}</label>
                                    <select value={filterSuffix} onChange={e => setFilterSuffix(e.target.value as any)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none">
                                        <option value="all">{t('market.browse.filters.any')}</option>
                                        <option value="yes">{t('market.browse.filters.yes')}</option>
                                        <option value="no">{t('market.browse.filters.no')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">{t('market.browse.filters.affixCount')}</label>
                                    <select value={filterAffixCount} onChange={e => setFilterAffixCount(e.target.value as any)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none">
                                        <option value="all">{t('market.browse.filters.all')}</option>
                                        <option value="0">0</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredListings.map(listing => {
                                const template = itemTemplates.find(t => t.id === listing.item_data.templateId);
                                if (!template) return null;
                                return (
                                    <div key={listing.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col gap-3">
                                        <div className="flex gap-3">
                                            <div className="flex-grow">
                                                <ItemDetailsPanel item={listing.item_data} template={template} affixes={affixes} size="small" compact={true} showIcon={true} />
                                            </div>
                                            <div className="flex flex-col justify-between items-end min-w-[100px]">
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">Sprzedawca: {listing.seller_name}</p>
                                                    <p className="text-xs text-gray-500">Wygasa: {new Date(listing.expires_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="mt-2 text-right">
                                                    {listing.listing_type === ListingType.BuyNow ? (
                                                        <>
                                                            <div className="mb-1">{renderPrice(listing.buy_now_price || 0, listing.currency)}</div>
                                                            {listing.seller_id !== character?.id && (
                                                                <button onClick={() => handleBuy(listing.id)} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white">Kup Teraz</button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-xs text-gray-400">Oferta: {renderPrice(listing.current_bid_price || 0, listing.currency)}</p>
                                                            {listing.seller_id !== character?.id && (
                                                                <button onClick={() => handleBid(listing.id, listing.current_bid_price || 0)} className="mt-1 px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-xs font-bold text-white">Licytuj</button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {filteredListings.length === 0 && <p className="text-gray-500 text-center col-span-full py-8">Brak ofert spełniających kryteria.</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'create' && character && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700">
                             <h3 className="font-bold text-indigo-400 mb-4">{t('market.create.selectItem')}</h3>
                             <ItemList 
                                items={character.inventory.filter(i => !i.isBorrowed)} 
                                itemTemplates={itemTemplates} 
                                affixes={affixes} 
                                selectedItem={selectedItem} 
                                onSelectItem={setSelectedItem} 
                            />
                        </div>
                        <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                            {selectedItem ? (
                                <div className="space-y-4">
                                    <h3 className="font-bold text-indigo-400 mb-2">Konfiguracja Oferty</h3>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">{t('market.create.listingType')}</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setListingType(ListingType.BuyNow)} className={`flex-1 py-2 rounded text-sm font-bold ${listingType === ListingType.BuyNow ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-gray-300'}`}>{t('market.create.buyNow')}</button>
                                            <button onClick={() => setListingType(ListingType.Auction)} className={`flex-1 py-2 rounded text-sm font-bold ${listingType === ListingType.Auction ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-gray-300'}`}>{t('market.create.auction')}</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">{t('market.create.currency')}</label>
                                        <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                                            <option value="gold">{t('resources.gold')}</option>
                                            {Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}
                                        </select>
                                    </div>
                                    {listingType === ListingType.BuyNow ? (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">{t('market.create.price')}</label>
                                            <input type="number" min="1" value={price} onChange={e => setPrice(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">{t('market.create.startingBid')}</label>
                                            <input type="number" min="1" value={startBid} onChange={e => setStartBid(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">{t('market.create.duration')}</label>
                                        <select value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                                            <option value={12}>12h</option>
                                            <option value={24}>24h</option>
                                            <option value={48}>48h</option>
                                        </select>
                                    </div>
                                    
                                    <div className="bg-slate-800/50 p-3 rounded text-xs text-gray-400 mt-2">
                                        <p>{t('market.create.commission')}</p>
                                        <p>{t('market.create.youWillReceive')}: {renderPrice(Math.floor((listingType === ListingType.BuyNow ? price : startBid) * (currency === 'gold' ? 0.85 : 1)), currency)}</p>
                                    </div>

                                    <button onClick={handleCreateListing} className="w-full py-3 bg-green-700 hover:bg-green-600 rounded font-bold text-white shadow-lg mt-2">
                                        {t('market.create.createListing')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <ScaleIcon className="h-12 w-12 mb-2 opacity-50"/>
                                    <p>{t('market.create.selectItem')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'myListings' && (
                    <div className="space-y-4">
                        {myListings.length === 0 && <p className="text-gray-500 text-center py-8">{t('market.myListings.noListings')}</p>}
                        {myListings.map(listing => {
                             const template = itemTemplates.find(t => t.id === listing.item_data.templateId);
                             if (!template) return null;
                             return (
                                 <div key={listing.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                                     <div className="flex-grow">
                                        <ItemDetailsPanel item={listing.item_data} template={template} affixes={affixes} size="small" compact={true} showIcon={false} />
                                        <div className="flex gap-4 text-xs text-gray-400 mt-2">
                                            <span>Typ: {listing.listing_type === 'buy_now' ? 'Kup Teraz' : 'Aukcja'}</span>
                                            <span>Cena: {renderPrice(listing.listing_type === 'buy_now' ? listing.buy_now_price! : listing.current_bid_price!, listing.currency)}</span>
                                            <span>Status: <span className={listing.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}>{t(`market.myListings.status.${listing.status}`)}</span></span>
                                        </div>
                                     </div>
                                     <div className="ml-4 flex flex-col gap-2">
                                        {renderAction(listing)}
                                     </div>
                                 </div>
                             )
                        })}
                        <p className="text-xs text-gray-500 text-center mt-4">{t('market.myListings.claimedHiddenNote')}</p>
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
