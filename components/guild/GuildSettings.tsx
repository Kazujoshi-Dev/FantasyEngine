
import React, { useState, useRef } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { Guild as GuildType } from '../../types';

export const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    // Simple parser for custom tags or just safe rendering of standard text
    // Replace newline with <br/>
    const lines = text.split('\n');
    return (
        <div className="text-gray-400 italic mb-4 whitespace-pre-wrap">
            {lines.map((line, i) => {
                // Basic parser for [b], [i], [color=code]
                let parts: (string | React.ReactNode)[] = [line];
                // Bold
                parts = parts.flatMap(p => typeof p === 'string' ? p.split(/(\[b\].*?\[\/b\])/g) : [p]).map(p => {
                    if (typeof p === 'string' && p.startsWith('[b]') && p.endsWith('[/b]')) {
                        return <b key={Math.random()} className="text-white not-italic">{p.slice(3, -4)}</b>;
                    }
                    return p;
                });
                // Italic (already italic wrapper, but nested maybe)
                parts = parts.flatMap(p => typeof p === 'string' ? p.split(/(\[i\].*?\[\/i\])/g) : [p]).map(p => {
                    if (typeof p === 'string' && p.startsWith('[i]') && p.endsWith('[/i]')) {
                        return <i key={Math.random()}>{p.slice(3, -4)}</i>;
                    }
                    return p;
                });
                // Color [color=red]text[/color]
                parts = parts.flatMap(p => typeof p === 'string' ? p.split(/(\[color=[a-z]+\][\s\S]*?\[\/color\])/g) : [p]).map(p => {
                    if (typeof p === 'string' && p.startsWith('[color=')) {
                        const match = p.match(/\[color=([a-z]+)\](.*?)\[\/color\]/);
                        if (match) {
                            const colorClass = 
                                match[1] === 'red' ? 'text-red-400' : 
                                match[1] === 'green' ? 'text-green-400' :
                                match[1] === 'blue' ? 'text-blue-400' :
                                match[1] === 'yellow' ? 'text-amber-400' :
                                match[1] === 'purple' ? 'text-purple-400' : 'text-white';
                            return <span key={Math.random()} className={`${colorClass} not-italic`}>{match[2]}</span>;
                        }
                    }
                    return p;
                });

                return <span key={i}>{parts}<br/></span>;
            })}
        </div>
    );
};

export const GuildSettings: React.FC<{ guild: GuildType, onUpdate: () => void }> = ({ guild, onUpdate }) => {
    const { t } = useTranslation();
    const [desc, setDesc] = useState(guild.description || '');
    const [crest, setCrest] = useState(guild.crestUrl || '');
    const [minLevel, setMinLevel] = useState(guild.minLevel || 1);
    const [isPublic, setIsPublic] = useState(guild.isPublic || false);
    const [rentalTax, setRentalTax] = useState(guild.rentalTax || 10);
    const [huntingTax, setHuntingTax] = useState(guild.huntingTax || 0);
    const [saving, setSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateGuild({ description: desc, crestUrl: crest, minLevel, isPublic, rentalTax, huntingTax });
            onUpdate();
            alert('Zapisano ustawienia.');
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDisband = async () => {
        if (!confirm(t('guild.settings.disbandConfirm'))) return;
        try {
            await api.leaveGuild(); // For leader this means disband
            window.location.reload(); // Refresh to reset state
        } catch (e: any) {
            alert(e.message);
        }
    };

    const insertTag = (tagStart: string, tagEnd: string) => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const text = textareaRef.current.value;
            const before = text.substring(0, start);
            const selection = text.substring(start, end);
            const after = text.substring(end);
            const newText = before + tagStart + selection + tagEnd + after;
            setDesc(newText);
            // Must wait for render to set selection back
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.selectionStart = start + tagStart.length;
                    textareaRef.current.selectionEnd = end + tagStart.length;
                }
            }, 0);
        }
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">{t('guild.settings.title')}</h3>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.description')}</label>
                    <div className="flex gap-2 mb-2">
                        <button type="button" onClick={() => insertTag('[b]', '[/b]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white">B</button>
                        <button type="button" onClick={() => insertTag('[i]', '[/i]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs italic text-white">I</button>
                        <button type="button" onClick={() => insertTag('[color=red]', '[/color]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-red-400">Red</button>
                        <button type="button" onClick={() => insertTag('[color=green]', '[/color]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-green-400">Green</button>
                        <button type="button" onClick={() => insertTag('[color=blue]', '[/color]')} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-blue-400">Blue</button>
                    </div>
                    <textarea 
                        ref={textareaRef}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-32 text-sm font-mono" 
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        placeholder="Opisz swoją gildię..."
                    />
                    <div className="mt-2 text-xs text-gray-500">
                        {t('guild.settings.preview')}:
                        <div className="p-2 border border-slate-700 rounded bg-slate-900/50 mt-1">
                            <FormattedText text={desc || 'Brak opisu'} />
                        </div>
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.crestUrl')}</label>
                    <input 
                        type="text"
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                        value={crest}
                        onChange={e => setCrest(e.target.value)}
                        placeholder="https://example.com/crest.png"
                    />
                    {crest && (
                        <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">{t('guild.settings.preview')}:</p>
                            <img src={crest} alt="Crest Preview" className="h-24 w-24 object-contain border border-slate-600 bg-slate-900 rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.minLevel')}</label>
                        <input 
                            type="number"
                            min="1"
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                            value={minLevel}
                            onChange={e => setMinLevel(parseInt(e.target.value))}
                        />
                    </div>
                    
                    <div className="flex items-center">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={isPublic}
                                onChange={e => setIsPublic(e.target.checked)}
                                className="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-0 bg-slate-700 border-slate-600" 
                            />
                            <span className="text-sm font-medium text-gray-300">{t('guild.settings.isPublic')}</span>
                        </label>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.rentalTax')} (0-50%)</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range"
                                min="0"
                                max="50"
                                className="flex-grow accent-indigo-500"
                                value={rentalTax}
                                onChange={e => setRentalTax(parseInt(e.target.value))}
                            />
                            <span className="font-mono text-white w-12 text-right">{rentalTax}%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t('guild.settings.rentalTaxDesc')}</p>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('guild.settings.huntingTax')} (0-50%)</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range"
                                min="0"
                                max="50"
                                className="flex-grow accent-purple-500"
                                value={huntingTax}
                                onChange={e => setHuntingTax(parseInt(e.target.value))}
                            />
                            <span className="font-mono text-white w-12 text-right">{huntingTax}%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t('guild.settings.huntingTaxDesc')}</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                    <button onClick={handleDisband} className="px-4 py-2 bg-red-900/80 hover:bg-red-800 text-red-200 rounded font-bold">
                        {t('guild.settings.disband')}
                    </button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-bold disabled:bg-slate-600">
                        {saving ? 'Zapisywanie...' : t('guild.settings.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
