import React, { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, EssenceType, PlayerCharacter } from '../../types';
import { CoinsIcon } from '../icons/CoinsIcon';
import { rarityStyles } from '../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

export const GuildBank: React.FC<{ guild: GuildType, character: PlayerCharacter | null, onTransaction: () => void }> = ({ guild, character, onTransaction }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'gold' | EssenceType>('gold');
    const [type, setType] = useState<'DEPOSIT'>('DEPOSIT');
    
    const handleSubmit = async () => {
        const val = parseInt(amount);
        if (isNaN(val) || val <= 0) return;
        try {
            await api.guildBankTransaction(type, currency, val);
            setAmount('');
            onTransaction();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const getTransactionLabel = (type: string) => {
        if (type === 'DEPOSIT') return t('guild.bank.deposit');
        if (type === 'WITHDRAW') return t('guild.bank.withdraw');
        if (type === 'RENTAL') return t('guild.bank.rentalFee');
        if (type === 'TAX') return t('guild.bank.tax');
        if (type === 'LOOT') return t('guild.bank.loot');
        return type;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-4 rounded-lg flex flex-col h-full">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2"><CoinsIcon className="h-5 w-5"/> Zasoby Gildii</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between border-b border-slate-700 pb-2">
                        <span className="text-gray-400">{t('resources.gold')}</span>
                        <span className="font-mono font-bold text-amber-400">{guild.resources.gold.toLocaleString()}</span>
                    </div>
                    {Object.values(EssenceType).map(et => (
                        <div key={et} className="flex justify-between border-b border-slate-700 pb-2">
                            <span className={essenceToRarityMap[et].text}>{t(`resources.${et}`)}</span>
                            <span className="font-mono font-bold text-white">{guild.resources[et as keyof typeof guild.resources]}</span>
                        </div>
                    ))}
                </div>
                
                <div className="mt-6 space-y-3">
                    <p className="text-sm text-gray-400 mb-2">Wpłać zasoby</p>
                    <select className="w-full bg-slate-700 p-2 rounded border border-slate-600" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                        <option value="gold">{t('resources.gold')}</option>
                        {Object.values(EssenceType).map(e => <option key={e} value={e}>{t(`resources.${e}`)}</option>)}
                    </select>
                    <input type="number" className="w-full bg-slate-700 p-2 rounded border border-slate-600" placeholder="Ilość" value={amount} onChange={e => setAmount(e.target.value)} />
                    <button onClick={handleSubmit} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white">Wpłać</button>
                </div>

                {character && (
                    <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 text-center">Twoje Zasoby</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t('resources.gold')}</span>
                                <span className="font-mono text-amber-400">{character.resources.gold.toLocaleString()}</span>
                            </div>
                            {Object.values(EssenceType).map(et => (
                                <div key={et} className="flex justify-between">
                                    <span className={essenceToRarityMap[et].text}>{t(`resources.${et}`)}</span>
                                    <span className="font-mono text-white">{character.resources[et] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg flex flex-col h-[600px]">
                <h3 className="text-lg font-bold text-gray-300 mb-2">Historia Transakcji</h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {(guild.transactions || []).map(tx => (
                        <div key={tx.id} className="text-xs bg-slate-900/30 p-2 rounded flex justify-between items-center">
                            <div>
                                <span className={tx.type === 'DEPOSIT' ? 'text-green-400' : tx.type === 'RENTAL' ? 'text-indigo-400' : 'text-red-400'}>
                                    {getTransactionLabel(tx.type)}
                                </span>
                                <span className="text-gray-400 mx-2">|</span>
                                <span className="font-bold text-gray-200">{tx.characterName}</span>
                            </div>
                            <div className="font-mono flex flex-col items-end">
                                <span>{tx.amount} <span className="text-gray-500">{tx.currency === 'gold' ? t('resources.gold') : t(`resources.${tx.currency as EssenceType}`)}</span></span>
                                <span className="text-[10px] text-gray-600">{new Date(tx.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
};