
import React, { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType, EssenceType } from '../../types';
import { CoinsIcon } from '../icons/CoinsIcon';
import { rarityStyles } from '../shared/ItemSlot';

const essenceToRarityMap: Record<EssenceType, any> = {
    [EssenceType.Common]: rarityStyles['Common'],
    [EssenceType.Uncommon]: rarityStyles['Uncommon'],
    [EssenceType.Rare]: rarityStyles['Rare'],
    [EssenceType.Epic]: rarityStyles['Epic'],
    [EssenceType.Legendary]: rarityStyles['Legendary'],
};

export const GuildBank: React.FC<{ guild: GuildType, onTransaction: () => void }> = ({ guild, onTransaction }) => {
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-4 rounded-lg">
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
                    <button onClick={handleSubmit} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold">Wpłać</button>
                </div>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg flex flex-col h-[400px]">
                <h3 className="text-lg font-bold text-gray-300 mb-2">Historia Transakcji</h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {(guild.transactions || []).map(tx => (
                        <div key={tx.id} className="text-xs bg-slate-900/30 p-2 rounded flex justify-between items-center">
                            <div>
                                <span className={tx.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'}>{tx.type === 'DEPOSIT' ? 'Wpłata' : 'Wypłata'}</span>
                                <span className="text-gray-400 mx-2">|</span>
                                <span className="font-bold text-gray-200">{tx.characterName}</span>
                            </div>
                            <div className="font-mono">
                                {tx.amount} <span className="text-gray-500">{tx.currency === 'gold' ? t('resources.gold') : t(`resources.${tx.currency as EssenceType}`)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
};
