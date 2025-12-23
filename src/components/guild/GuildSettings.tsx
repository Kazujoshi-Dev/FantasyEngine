
import React, { useState, useRef } from 'react';
import { Guild } from '../../types';
import { api } from '../../api';

interface GuildSettingsProps {
    guild: Guild;
    onUpdate: () => void;
}

// Ulepszony parser BBCode obsługujący wielolinijkowość i poprawne tagi
export const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return <div className="text-sm text-gray-500 italic">Brak opisu.</div>;

    const parseLine = (line: string, lineIndex: number) => {
        if (!line.trim()) return <br key={lineIndex} />;

        // Regex do wychwytywania tagów: [b], [i], [color=...]
        const parts = line.split(/(\[b\].*?\[\/b\]|\[i\].*?\[\/i\]|\[color=[^\]]+\].*?\[\/color\])/g);

        return (
            <div key={lineIndex} className="mb-1 leading-relaxed">
                {parts.map((part, index) => {
                    if (part.startsWith('[b]') && part.endsWith('[/b]')) {
                        return <strong key={index} className="text-white font-bold">{part.slice(3, -4)}</strong>;
                    }
                    if (part.startsWith('[i]') && part.endsWith('[/i]')) {
                        return <em key={index} className="italic text-gray-300">{part.slice(3, -4)}</em>;
                    }
                    if (part.startsWith('[color=') && part.endsWith('[/color]')) {
                        const colorMatch = part.match(/\[color=([^\]]+)\](.*?)\[\/color\]/);
                        if (colorMatch) {
                            return <span key={index} style={{ color: colorMatch[1] }}>{colorMatch[2]}</span>;
                        }
                    }
                    return <span key={index}>{part}</span>;
                })}
            </div>
        );
    };

    return (
        <div className="text-sm text-gray-300">
            {text.split('\n').map((line, idx) => parseLine(line, idx))}
        </div>
    );
};

export const GuildSettings: React.FC<GuildSettingsProps> = ({ guild, onUpdate }) => {
    const [desc, setDesc] = useState(guild.description || '');
    const [crest, setCrest] = useState(guild.crestUrl || '');
    const [minLvl, setMinLvl] = useState(guild.minLevel || 1);
    const [isPublic, setIsPublic] = useState(guild.isPublic);
    const [rentalTax, setRentalTax] = useState(guild.rentalTax || 10);
    const [huntingTax, setHuntingTax] = useState(guild.huntingTax || 0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [color, setColor] = useState('#fbbf24');

    const handleSave = async () => {
        try {
            await api.updateGuild({
                description: desc,
                crestUrl: crest,
                minLevel: minLvl,
                isPublic: isPublic,
                rentalTax: rentalTax,
                huntingTax: huntingTax
            });
            alert('Zapisano ustawienia gildii.');
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const insertTag = (tag: string, param: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selection = desc.substring(start, end);
        
        let prefix = `[${tag}]`;
        let suffix = `[/${tag}]`;

        if (tag === 'color') {
            prefix = `[color=${param}]`;
        }

        const newText = desc.substring(0, start) + prefix + selection + suffix + desc.substring(end);
        setDesc(newText);
        
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 space-y-6">
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-400">Opis Gildii (Wspiera BBCode)</label>
                
                <div className="flex flex-wrap gap-2 p-2 bg-slate-800 rounded-t-lg border border-slate-600 border-b-0">
                    <button type="button" onClick={() => insertTag('b')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded font-bold">B</button>
                    <button type="button" onClick={() => insertTag('i')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded italic">I</button>
                    <div className="flex items-center gap-1 border-l border-slate-600 pl-2">
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 bg-transparent cursor-pointer" />
                        <button type="button" onClick={() => insertTag('color', color)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded">Kolor</button>
                    </div>
                </div>

                <textarea 
                    ref={textareaRef}
                    className="w-full bg-slate-800 p-3 rounded-b-lg border border-slate-600 h-48 font-mono text-sm text-gray-300 focus:ring-1 focus:ring-indigo-500 outline-none" 
                    value={desc} 
                    onChange={e => setDesc(e.target.value)} 
                    placeholder="Opisz swoją gildię..."
                />
                
                <div className="p-4 bg-slate-800/50 rounded border border-slate-700">
                    <p className="text-[10px] text-gray-500 uppercase mb-2">Podgląd</p>
                    <FormattedText text={desc} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">URL Herbu (PNG/JPG)</label>
                    <input className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={crest} onChange={e => setCrest(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Minimalny Poziom</label>
                    <input type="number" className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={minLvl} onChange={e => setMinLvl(Number(e.target.value))} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="isPublic" className="w-4 h-4" />
                    <label htmlFor="isPublic" className="text-sm text-gray-300">Gildia Otwarta (Publiczna)</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 uppercase">Podatek Wypożyczeń (%)</label>
                        <input type="number" className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={rentalTax} onChange={e => setRentalTax(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 uppercase">Podatek Polowań (%)</label>
                        <input type="number" className="w-full bg-slate-800 p-2 rounded border border-slate-600" value={huntingTax} onChange={e => setHuntingTax(Number(e.target.value))} />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button onClick={handleSave} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white shadow-lg">
                    Zapisz Ustawienia
                </button>
            </div>
        </div>
    );
};
