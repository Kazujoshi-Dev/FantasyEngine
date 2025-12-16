
import React, { useState, useRef } from 'react';
import { Guild } from '../../types';
import { api } from '../../api';

interface GuildSettingsProps {
    guild: Guild;
    onUpdate: () => void;
}

// Simple BBCode parser
export const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return <div className="text-sm text-gray-500 italic">Brak opisu.</div>;

    // Split text by newlines first to preserve paragraph structure
    const lines = text.split('\n');

    const parseLine = (line: string, lineIndex: number) => {
        // Split by tags: [b]...[/b], [i]...[/i], [color=...]...[/color]
        // Note: This is a non-recursive parser for simplicity and safety. 
        // It handles one level of tags.
        const parts = line.split(/(\[b\].*?\[\/b\]|\[i\].*?\[\/i\]|\[color=[^\]]+\][\s\S]*?\[\/color\])/g);

        return (
            <div key={lineIndex} className="min-h-[1.2em]">
                {parts.map((part, index) => {
                    if (part.startsWith('[b]') && part.endsWith('[/b]')) {
                        return <strong key={index} className="text-white font-bold">{part.slice(3, -4)}</strong>;
                    }
                    if (part.startsWith('[i]') && part.endsWith('[/i]')) {
                        return <em key={index} className="italic text-gray-300">{part.slice(3, -4)}</em>;
                    }
                    if (part.startsWith('[color=') && part.endsWith('[/color]')) {
                        const match = part.match(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/);
                        if (match) {
                            return <span key={index} style={{ color: match[1] }}>{match[2]}</span>;
                        }
                    }
                    return <span key={index}>{part}</span>;
                })}
            </div>
        );
    };

    return (
        <div className="text-sm text-gray-300 space-y-1">
            {lines.map((line, idx) => parseLine(line, idx))}
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
    const [color, setColor] = useState('#fbbf24'); // Default amber

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
        
        // Restore focus and position cursor after inserted tag (or selection)
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    return (
        <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Opis Gildii</label>
                
                {/* Formatting Toolbar */}
                <div className="flex gap-2 mb-2 bg-slate-800 p-2 rounded-t-lg border border-slate-600 border-b-0 items-center">
                    <button 
                        type="button"
                        onClick={() => insertTag('b')}
                        className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white font-bold border border-slate-600"
                        title="Pogrubienie"
                    >
                        B
                    </button>
                    <button 
                        type="button"
                        onClick={() => insertTag('i')}
                        className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white italic border border-slate-600"
                        title="Kursywa"
                    >
                        I
                    </button>
                    <div className="h-6 w-px bg-slate-600 mx-1"></div>
                    <div className="flex items-center gap-1">
                        <input 
                            type="color" 
                            value={color} 
                            onChange={(e) => setColor(e.target.value)}
                            className="w-8 h-8 p-0 border-0 rounded cursor-pointer bg-transparent"
                            title="Wybierz kolor"
                        />
                        <button 
                            type="button"
                            onClick={() => insertTag('color', color)}
                            className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        >
                            Wstaw Kolor
                        </button>
                    </div>
                </div>

                <textarea 
                    ref={textareaRef}
                    className="w-full bg-slate-800 p-3 rounded-b-lg border border-slate-600 h-48 font-mono text-sm text-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    value={desc} 
                    onChange={e => setDesc(e.target.value)} 
                    placeholder="Opisz swoją gildię... Użyj paska narzędzi do formatowania."
                />
                
                <div className="mt-4 p-4 bg-slate-800/50 rounded border border-slate-700">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Podgląd</p>
                    <FormattedText text={desc} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">URL Herbu</label>
                    <input className="w-full bg-slate-800 p-2 rounded border border-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" value={crest} onChange={e => setCrest(e.target.value)} />
                    {crest && <img src={crest} alt="Preview" className="mt-2 h-20 w-20 object-contain mx-auto bg-slate-900 rounded border border-slate-700" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Minimalny Poziom</label>
                        <input type="number" className="w-full bg-slate-800 p-2 rounded border border-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" value={minLvl} onChange={e => setMinLvl(Number(e.target.value))} />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-600">
                        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="isPublic" className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-slate-700 border-slate-500" />
                        <label htmlFor="isPublic" className="text-sm font-medium text-gray-300 cursor-pointer">Gildia Publiczna (Otwarta rekrutacja)</label>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
                <h4 className="text-lg font-bold text-amber-400 mb-4">Podatki i Ekonomia</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Podatek od Wypożyczeń (%)</label>
                        <input type="number" min="0" max="50" className="w-full bg-slate-700 p-2 rounded border border-slate-600 text-white font-bold" value={rentalTax} onChange={e => setRentalTax(Math.min(50, Math.max(0, Number(e.target.value))))} />
                        <div className="flex justify-between mt-1">
                            <p className="text-xs text-gray-500">Opłata pobierana od członka przy wypożyczaniu.</p>
                            <span className="text-xs text-amber-500 font-bold">Max: 50%</span>
                        </div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Podatek od Polowań (%)</label>
                        <input type="number" min="0" max="50" className="w-full bg-slate-700 p-2 rounded border border-slate-600 text-white font-bold" value={huntingTax} onChange={e => setHuntingTax(Math.min(50, Math.max(0, Number(e.target.value))))} />
                        <div className="flex justify-between mt-1">
                            <p className="text-xs text-gray-500">Część złota i esencji z polowań trafiająca do banku.</p>
                            <span className="text-xs text-amber-500 font-bold">Max: 50%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                 <button onClick={handleSave} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white shadow-lg transition-colors">
                    Zapisz Ustawienia
                </button>
            </div>
        </div>
    );
};
