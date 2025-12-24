
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, GuildRole, GuildArmoryItem, ItemInstance, ItemTemplate, Affix, ItemRarity, EquipmentSlot, PlayerCharacter } from '../../types';
import { ShieldIcon } from '../icons/ShieldIcon';
import { HandshakeIcon } from '../icons/HandshakeIcon'; // Używam HandshakeIcon jako ikony wypożyczeń
import { ItemListItem, getGrammaticallyCorrectFullName, ItemDetailsPanel, rarityStyles } from '../shared/ItemSlot';

export const GuildArmory: React.FC<{ guild: GuildType, character: PlayerCharacter | null, onUpdate: () => void, templates: ItemTemplate[], affixes: Affix[] }> = ({ guild, character, onUpdate, templates, affixes }) => {
    const { t } = useTranslation();
    const [armoryData, setArmoryData] = useState<{ armoryItems: GuildArmoryItem[], borrowedItems: GuildArmoryItem[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all');
    const [filterSlot, setFilterSlot] = useState<string>('all');
    const [inspectingItem, setInspectingItem] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);
    
    // Nowy stan do zarządzania podzakładkami
    const [activeSubTab, setActiveSubTab] = useState<'ARMORY' | 'BORROWED'>('ARMORY');

    useEffect(() => {
        setLoading(true);
        api.getGuildArmory()
            .then(setArmoryData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [guild.id]);

    const canManage = guild.myRole === GuildRole.LEADER || guild.myRole === GuildRole.OFFICER;
    const isLeader = guild.myRole === GuildRole.LEADER;
    const armoryLevel = guild.buildings?.armory || 0;
    const capacity = 10 + armoryLevel;

    const myItems = character ? character.inventory.filter(i => !i.isBorrowed) : [];
    const userId = character?.id || null;

    const handleDeposit = async (item: ItemInstance, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(t('guild.armory.depositConfirm'))) return;
        try {
            await api.depositToArmory(item.uniqueId);
            onUpdate();
            const armory = await api.getGuildArmory();
            setArmoryData(armory);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleBorrow = async (armoryId: number, item: ItemInstance, e: React.MouseEvent) => {
        e.stopPropagation();
        const template = templates.find(t => t.id === item.templateId);
        
        let value = template?.value || 0;
        
        // Add affix values
        if (item.prefixId) {
            const prefix = affixes.find(a => a.id === item.prefixId);
            if (prefix) value += (prefix.value || 0);
        }
        if (item.suffixId) {
            const suffix = affixes.find(a => a.id === item.suffixId);
            if (suffix) value += (suffix.value || 0);
        }

        const taxRate = guild.rentalTax || 10;
        const tax = Math.ceil(value * (taxRate / 100));
        
        if (!confirm(t('guild.armory.borrowConfirm', { taxRate, value: tax }))) return;

        try {
            await api.borrowFromArmory(armoryId);
            const armory = await api.getGuildArmory();
            onUpdate(); // Refresh character too
            setArmoryData(armory);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRecall = async (targetUserId: number, itemUniqueId: string) => {
        if (!confirm(t('guild.armory.recallConfirm'))) return;
        try {
            await api.recallFromMember(targetUserId, itemUniqueId);
            const armory = await api.getGuildArmory();
            setArmoryData(armory);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (armoryId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(t('guild.armory.deleteConfirm'))) return;
        try {
            await api.deleteFromArmory(armoryId);
            const armory = await api.getGuildArmory();
            setArmoryData(armory);
        } catch (e: any) {
            alert(e.message);
        }
    }

    const filteredItems = useMemo(() => {
        if (!armoryData) return [];
        return armoryData.armoryItems.filter(entry => {
            const template = templates.find(t => t.id === entry.item.templateId);
            if (!template) return false;
            
            const rarityMatch = filterRarity === 'all' || template.rarity === filterRarity;
            const slotMatch = filterSlot === 'all' || template.slot === filterSlot;
            
            return rarityMatch && slotMatch;
        });
    }, [armoryData, filterRarity, filterSlot, templates]);

    const handleItemClick = (item: ItemInstance, template: ItemTemplate) => {
        setInspectingItem({ item, template });
    };

    if (loading || !armoryData) return <p className="text-gray-400">Ładowanie zbrojowni...</p>;

    return (
        <div className="space-y-6 pb-6">
            {/* Sub-tabs Navigation */}
            <div className="flex border-b border-slate-700 mb-4">
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeSubTab === 'ARMORY' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                    onClick={() => setActiveSubTab('ARMORY')}
                >
                    <ShieldIcon className="h-4 w-4"/>
                    {t('guild.armory.title')}
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeSubTab === 'BORROWED' ? 'border-b-2 border-amber-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                    onClick={() => setActiveSubTab('BORROWED')}
                >
                    <HandshakeIcon className="h-4 w-4"/>
                    {t('guild.armory.borrowedItems')} ({armoryData.borrowedItems.length})
                </button>
            </div>

            {/* TAB: ARMORY (Guild Items & My Backpack) */}
            {activeSubTab === 'ARMORY' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                    {/* Guild Armory Contents */}
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col h-[600px]">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldIcon className="h-5 w-5 text-indigo-400"/> {t('guild.resources')}</h3>
                            <span className="text-sm text-gray-400">{armoryData.armoryItems.length} / {capacity}</span>
                        </div>
                        
                        {/* Filters */}
                        <div className="grid grid-cols-2 gap-2 mb-4 flex-shrink-0">
                            <select className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white" value={filterRarity} onChange={(e) => setFilterRarity(e.target.value as ItemRarity | 'all')}>
                                <option value="all">{t('market.browse.filters.all')}</option>
                                {(Object.values(ItemRarity) as string[]).map(r => <option key={r} value={r}>{t(`rarity.${r}`)}</option>)}
                            </select>
                            <select className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white" value={filterSlot} onChange={(e) => setFilterSlot(e.target.value)}>
                                <option value="all">{t('market.browse.filters.all')}</option>
                                {(Object.values(EquipmentSlot) as string[]).map(s => <option key={s} value={s}>{t(`equipment.slot.${s}`)}</option>)}
                            </select>
                        </div>

                        <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                            {filteredItems.length === 0 && <p className="text-gray-500 text-center text-sm py-4">{t('guild.armory.empty')}</p>}
                            {filteredItems.map(entry => {
                                const template = templates.find(t => t.id === entry.item.templateId);
                                if (!template) return null;
                                const taxRate = guild.rentalTax || 10;
                                
                                // Calculate tax including affixes for display
                                let value = template.value || 0;
                                if (entry.item.prefixId) {
                                    const prefix = affixes.find(a => a.id === entry.item.prefixId);
                                    if (prefix) value += (prefix.value || 0);
                                }
                                if (entry.item.suffixId) {
                                    const suffix = affixes.find(a => a.id === entry.item.suffixId);
                                    if (suffix) value += (suffix.value || 0);
                                }
                                const tax = Math.ceil(value * (taxRate / 100));
                                
                                return (
                                    <div key={entry.id} className="bg-slate-900/50 p-2 rounded border border-slate-700/50 relative group cursor-pointer hover:bg-slate-800" onClick={() => handleItemClick(entry.item, template)}>
                                        <div className="flex justify-between items-center">
                                            <ItemListItem item={entry.item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} />
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-xs text-gray-500">od {entry.ownerName}</span>
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => handleBorrow(entry.id, entry.item, e)} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white">
                                                        {t('guild.armory.borrow')} ({tax}g)
                                                    </button>
                                                    {isLeader && (
                                                        <button onClick={(e) => handleDelete(entry.id, e)} className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-xs text-white" title="Usuń trwale">
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* My Backpack (Deposit) */}
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col h-[600px]">
                        <h3 className="text-lg font-bold text-gray-300 mb-4 flex-shrink-0">{t('guild.armory.myBackpack')}</h3>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                            {myItems.length === 0 && <p className="text-gray-500 text-center text-sm py-4">Brak przedmiotów do zdeponowania.</p>}
                            {myItems.map(item => {
                                const template = templates.find(t => t.id === item.templateId);
                                if (!template) return null;
                                return (
                                    <div key={item.uniqueId} className="bg-slate-900/50 p-2 rounded border border-slate-700/50 relative group cursor-pointer hover:bg-slate-800" onClick={() => handleItemClick(item, template)}>
                                        <div className="flex justify-between items-center">
                                            <ItemListItem item={item} template={template} affixes={affixes} isSelected={false} onClick={()=>{}} showPrimaryStat={false} />
                                            <button onClick={(e) => handleDeposit(item, e)} className="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-xs font-bold text-white ml-2">
                                                {t('guild.armory.deposit')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: BORROWED ITEMS */}
            {activeSubTab === 'BORROWED' && (
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col h-[650px] animate-fade-in">
                    <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2"><HandshakeIcon className="h-5 w-5"/> {t('guild.armory.borrowedItems')}</h3>
                    
                    {/* Table Container with Explicit Scroll */}
                    <div className="overflow-y-auto flex-grow border border-slate-700/50 rounded bg-slate-900/30">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900 text-gray-400 sticky top-0 z-10 shadow-md">
                                <tr>
                                    <th className="p-3 bg-slate-900 border-b border-slate-700">Przedmiot</th>
                                    <th className="p-3 bg-slate-900 border-b border-slate-700">Właściciel</th>
                                    <th className="p-3 bg-slate-900 border-b border-slate-700">Wypożyczone przez</th>
                                    <th className="p-3 bg-slate-900 border-b border-slate-700">Data</th>
                                    <th className="p-3 text-right bg-slate-900 border-b border-slate-700">Akcja</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {armoryData.borrowedItems.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500 italic">Brak wypożyczonych przedmiotów.</td></tr>
                                )}
                                {armoryData.borrowedItems.map((entry, idx) => {
                                    const template = templates.find(t => t.id === entry.item.templateId);
                                    
                                    // Style and upgrade level
                                    const rarityStyle = template ? rarityStyles[template.rarity] : null;
                                    const upgradeLevel = entry.item.upgradeLevel || 0;

                                    // Logic to determine if user can manage this specific entry
                                    const isMyItem = entry.ownerId === userId;
                                    const canRecall = canManage || isMyItem;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                            <td className={`p-3 cursor-pointer font-bold ${rarityStyle?.text || 'text-white'}`} onClick={() => template && handleItemClick(entry.item, template)}>
                                                {template ? getGrammaticallyCorrectFullName(entry.item, template, affixes) : 'Unknown'}
                                                {upgradeLevel > 0 && <span className="ml-1 text-xs opacity-80">+{upgradeLevel}</span>}
                                            </td>
                                            <td className="p-3 text-gray-300">{entry.ownerName}</td>
                                            <td className="p-3 text-sky-400 font-bold">{entry.borrowedBy}</td>
                                            <td className="p-3 text-gray-400 text-xs">
                                                {entry.depositedAt ? new Date(Number(entry.depositedAt)).toLocaleString() : '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                {canRecall && (
                                                    <button onClick={() => handleRecall(entry.userId!, entry.item.uniqueId)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs text-white transition-colors">
                                                        {t('guild.armory.recall')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-slate-700">
                        * Liderzy, Oficerowie oraz prawowici właściciele mogą wymusić zwrot przedmiotu do zbrojowni w każdej chwili.
                    </p>
                </div>
            )}

            {/* Inspection Modal */}
            {inspectingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setInspectingItem(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={() => setInspectingItem(null)}>✕</button>
                        <ItemDetailsPanel item={inspectingItem.item} template={inspectingItem.template} affixes={affixes} character={character || undefined} />
                    </div>
                </div>
            )}
        </div>
    );
};
