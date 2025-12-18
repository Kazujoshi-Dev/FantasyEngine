import React, { useState } from 'react';
import { Guild, PlayerCharacter, EssenceType, ItemRarity } from '../../types';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';
import { CoinsIcon } from '../icons/CoinsIcon';
import { StarIcon } from '../icons/StarIcon';
import { rarityStyles } from '../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const GuildBank: React.FC<{ guild: Guild, character: PlayerCharacter | null, onTransaction: () => void }> = ({ guild, character, onTransaction }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<'gold' | EssenceType>('gold');

    const handleDeposit = async () => {
        const val = parseInt(amount, 10);
        if (isNaN(val) || val <= 0) return;
        try {
            await api.guildBankTransaction('DEPOSIT', selectedCurrency, val);
            setAmount('');
            onTransaction();
        } catch (e: any) { alert(e.message); }
    };

    const getTransactionLabel = (type: string) => {
        switch(type) {
            case 'DEPOSIT': return t('guild.bank.deposit');
            case 'WITHDRAW': return t('guild.bank.withdraw');
            case 'RENTAL': return t('guild.bank.rentalFee');
            case 'TAX': return t('guild.bank.tax');
            case 'LOOT': return t('guild.bank.loot');
            case 'WAR_LOSS': return t('guild.bank.warLoss');
            default: return type;
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-fade-in overflow-hidden">
            <div className="flex flex-col gap-6 overflow-hidden">
                {/* Global Resources Display */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-xl font-bold text-white mb-6">Zasoby Skarbca</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg flex flex-col items-center border border-amber-900/30 shadow-lg">
                            <div className="flex items-center text-amber-400 font-bold mb-1 uppercase text-xs tracking-widest">
                                <CoinsIcon className="h-5 w-5 mr-2" /> Złoto
                            </div>
                            <span className="text-3xl font-mono text-white font-extrabold">{guild.resources.gold.toLocaleString()}</span>
                        </div>
                        {Object.values(EssenceType).map(e => (
                            <div key={e} className={`bg-slate-800 p-3 rounded-lg flex flex-col items-center border border-slate-700/50 shadow-md`}>
                                <div className={`flex items-center ${rarityStyles[essenceToRarityMap[e]].text} font-bold mb-1 text-[10px] uppercase tracking-wider`}>
                                    <StarIcon className="h-3.5 w-3.5 mr-1.5" /> {t(`resources.${e}`).replace(' Esencja', '')}
                                </div>
                                <span className="text-xl font-mono text-white font-bold">{guild.resources[e] || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Transaction Form */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 shadow-xl">
                    <h4 className="text-lg font-bold text-indigo-400 mb-4 uppercase tracking-widest">Wpłać Darowiznę</h4>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <select className="bg-slate-800 border border-slate-600 rounded p-2 text-sm flex-grow outline-none focus:border-indigo-500" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value as any)}>
                                <option value="gold">Złoto</option>
                                {Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}
                            </select>
                            <input type="number" className="w-32 bg-slate-800 border border-slate-600 rounded p-2 font-mono text-white outline-none focus:border-indigo-500" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ilość" />
                        </div>
                        <button onClick={handleDeposit} disabled={!amount || parseInt(amount, 10) <= 0} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:bg-slate-700 disabled:text-gray-500">ZATWIERDŹ WPŁATĘ</button>
                        {character && (
                            <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                    Dostępne w plecaku: <span className="text-white font-bold font-mono">
                                        {selectedCurrency === 'gold' ? `${character.resources.gold.toLocaleString()}g` : `${character.resources[selectedCurrency as EssenceType] || 0}x`}
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col overflow-hidden h-[600px] shadow-2xl">
                <h3 className="text-xl font-bold text-gray-300 mb-4 flex-shrink-0 border-b border-slate-700 pb-2">Księga Transakcji</h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {(guild.transactions || []).length === 0 && <p className="text-gray-500 text-center py-20 italic text-sm">Pusta księga. Czas na pierwsze darowizny!</p>}
                    {(guild.transactions || []).map(t => (
                        <div key={t.id} className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center text-sm hover:bg-slate-700/50 transition-colors">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 font-mono mb-1">{new Date(t.timestamp).toLocaleString()}</span>
                                <p className="font-bold text-gray-200 tracking-wide">{getTransactionLabel(t.type)}</p>
                                <p className="text-[11px] text-gray-400 italic">Podróżnik: {t.characterName}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-mono font-extrabold text-lg ${t.type === 'DEPOSIT' || t.type === 'LOOT' || t.type === 'TAX' || t.type === 'RENTAL' ? 'text-green-400' : 'text-red-400'}`}>
                                    {t.type === 'DEPOSIT' || t.type === 'LOOT' || t.type === 'TAX' || t.type === 'RENTAL' ? '+' : '-'}{t.amount.toLocaleString()}
                                </p>
                                <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{t.currency === 'gold' ? 'Złoto' : 'Esencja'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
