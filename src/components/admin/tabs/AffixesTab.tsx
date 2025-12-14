
// This file seems to be a duplicate or old location of AffixEditor. 
// If it is indeed the Tab component that lists affixes, it should import the editor from ../editors/
// Based on the file content provided in previous turn, it was the TAB component.

import React, { useState, useMemo } from 'react';
import { GameData, Affix, AffixType } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { AffixEditor } from '../editors/AffixEditor';

interface AffixesTabProps {
  affixes: Affix[];
  onGameDataUpdate: (key: string, data: any) => void;
}

export const AffixesTab: React.FC<AffixesTabProps> = ({ affixes, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingAffix, setEditingAffix] = useState<Partial<Affix> | null>(null);
  const [affixSearch, setAffixSearch] = useState('');

  const handleSaveData = (itemFromEditor: Affix | null) => {
    if (!itemFromEditor) {
        setEditingAffix(null);
        return;
    }

    const itemExists = itemFromEditor.id ? affixes.some(d => d.id === itemFromEditor.id) : false;
    let updatedData;

    if (itemExists) {
        updatedData = affixes.map(item => item.id === itemFromEditor.id ? itemFromEditor : item);
    } else {
        updatedData = [...affixes, { ...itemFromEditor, id: itemFromEditor.id || crypto.randomUUID() }];
    }
    onGameDataUpdate('affixes', updatedData);
    setEditingAffix(null);
  };

  const handleDeleteData = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
        const updatedData = affixes.filter(item => item.id !== id);
        onGameDataUpdate('affixes', updatedData);
    }
  };

  const { filteredPrefixes, filteredSuffixes } = useMemo(() => {
    // Helper to safely extract name string
    const getName = (a: Affix): string => {
        if (!a || !a.name) return '';
        if (typeof a.name === 'string') return a.name; // Legacy support
        return a.name.masculine || '';
    };

    const safeAffixes = (affixes || []).filter(a => a && a.type);

    const prefixes = safeAffixes
        .filter(a => a.type === 'Prefix' && getName(a).toLowerCase().includes(affixSearch.toLowerCase()))
        .sort((a,b) => getName(a).localeCompare(getName(b)));
        
    const suffixes = safeAffixes
        .filter(a => a.type === 'Suffix' && getName(a).toLowerCase().includes(affixSearch.toLowerCase()))
        .sort((a,b) => getName(a).localeCompare(getName(b)));
        
    return { filteredPrefixes: prefixes, filteredSuffixes: suffixes };
  }, [affixes, affixSearch]);

  const formatAffixBonuses = (affix: Affix): string => {
    const parts: string[] = [];
    const formatMinMax = (val: { min: number, max: number } | undefined, prefix: string = '', suffix: string = '') => {
        if (!val) return null;
        return `${prefix}${val.min !== val.max ? `${val.min}-${val.max}` : val.min}${suffix}`;
    }
    
    if (affix.statsBonus) {
        for (const [key, value] of Object.entries(affix.statsBonus)) {
            // Use key directly if translation fails or assume generic stat
            const label = t(`statistics.${key}` as any) || key;
            if(value) parts.push(formatMinMax(value, `+`, ` ${label}`)!);
        }
    }
    
    if (affix.damageMin) parts.push(formatMinMax(affix.damageMin, `+`, ` Min Dmg`)!);
    if (affix.damageMax) parts.push(formatMinMax(affix.damageMax, `+`, ` Max Dmg`)!);
    if (affix.armorBonus) parts.push(formatMinMax(affix.armorBonus, `+`, ` Pancerza`)!);
    if (affix.critChanceBonus) parts.push(formatMinMax(affix.critChanceBonus, `+`, `% Szansy na kryt.`)!);
    if (affix.maxHealthBonus) parts.push(formatMinMax(affix.maxHealthBonus, `+`, ` Zdr.`)!);

    return parts.slice(0, 3).join(', ');
  };
  
  return (
    <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-indigo-400">{t('admin.affix.manage')}</h3>
             <div className="space-x-2">
                <button onClick={() => setEditingAffix({ type: AffixType.Prefix })} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.affix.addPrefix')}</button>
                <button onClick={() => setEditingAffix({ type: AffixType.Suffix })} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.affix.addSuffix')}</button>
            </div>
        </div>
        {editingAffix ? (
            <AffixEditor affix={editingAffix} onSave={handleSaveData} onCancel={() => setEditingAffix(null)} isEditing={!!editingAffix.id} />
        ) : (
            <>
                <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                     <input type="text" value={affixSearch} onChange={e => setAffixSearch(e.target.value)} placeholder={t('admin.general.searchByName') as string} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2"/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-lg font-bold text-gray-300 mb-2">{t('admin.affix.prefixes')}</h4>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                            {filteredPrefixes.map(affix => (
                                <div key={affix.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-sky-400">{typeof affix.name === 'string' ? affix.name : affix.name.masculine}</p>
                                        <p className="text-xs text-gray-400 mt-1">{formatAffixBonuses(affix)}</p>
                                    </div>
                                    <div className="space-x-2"><button onClick={() => setEditingAffix(affix)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button><button onClick={() => handleDeleteData(affix.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-gray-300 mb-2">{t('admin.affix.suffixes')}</h4>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                             {filteredSuffixes.map(affix => (
                                <div key={affix.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-amber-400">{typeof affix.name === 'string' ? affix.name : affix.name.masculine}</p>
                                        <p className="text-xs text-gray-400 mt-1">{formatAffixBonuses(affix)}</p>
                                    </div>
                                    <div className="space-x-2"><button onClick={() => setEditingAffix(affix)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button><button onClick={() => handleDeleteData(affix.id!)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </>
        )}
    </div>
  );
};
