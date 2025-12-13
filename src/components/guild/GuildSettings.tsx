
import React, { useState } from 'react';
import { Guild } from '../../types';
import { api } from '../../api';

interface GuildSettingsProps {
    guild: Guild;
    onUpdate: () => void;
}

export const FormattedText: React.FC<{ text: string }> = ({ text }) => (
    <div className="whitespace-pre-wrap text-sm text-gray-300">{text}</div>
);

export const GuildSettings: React.FC<GuildSettingsProps> = ({ guild, onUpdate }) => {
    const [desc, setDesc] = useState(guild.description || '');
    const [crest, setCrest] = useState(guild.crestUrl || '');
    const [minLvl, setMinLvl] = useState(guild.minLevel || 1);
    const [isPublic, setIsPublic] = useState(guild.isPublic);
    const [rentalTax, setRentalTax] = useState(guild.rentalTax || 10);
    const [huntingTax, setHuntingTax] = useState(guild.huntingTax || 0);

    const handleSave = async () => {
        try {
            await api.updateGuild({
                description: desc,
                crestUrl: crest,
                minLevel: minLvl,
                isPublic,
                rentalTax,
                huntingTax
            });
            alert('Zapisano ustawienia.');
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Opis Gildii</label>
                <textarea className="w-full bg-slate-800 p-2 rounded border border-slate-600 h-32" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">URL Herbu</label>
                    <input className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={crest} onChange={e => setCrest(e.target.value)} />
                    {crest && <img src={crest} alt="Preview" className="mt-2 h-20 w-20 object-contain mx-auto" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Minimalny Poziom</label>
                        <input type="number" className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={minLvl} onChange={e => setMinLvl(Number(e.target.value))} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="isPublic" className="w-4 h-4" />
                        <label htmlFor="isPublic" className="text-sm font-medium text-gray-300">Gildia Publiczna (Otwarta rekrutacja)</label>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
                <h4 className="text-lg font-bold text-amber-400 mb-4">Podatki</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Podatek od Wypożyczeń (%)</label>
                        <input type="number" min="0" max="50" className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={rentalTax} onChange={e => setRentalTax(Number(e.target.value))} />
                        <p className="text-xs text-gray-500 mt-1">Opłata pobierana od członka przy wypożyczaniu przedmiotu.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Podatek od Polowań (%)</label>
                        <input type="number" min="0" max="50" className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={huntingTax} onChange={e => setHuntingTax(Number(e.target.value))} />
                        <p className="text-xs text-gray-500 mt-1">Część złota i esencji z polowań trafiająca do banku gildii.</p>
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white">Zapisz Ustawienia</button>
        </div>
    );
};
