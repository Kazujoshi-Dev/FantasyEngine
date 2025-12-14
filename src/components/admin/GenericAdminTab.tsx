
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';

interface GenericAdminTabProps {
    data: any[];
    dataKey: string; // Key in GameData (e.g., 'locations', 'enemies')
    onUpdate: (key: string, newData: any[]) => void;
    title: string;
    idField?: string;
    displayField?: string;
    newItemTemplate?: any;
}

export const GenericAdminTab: React.FC<GenericAdminTabProps> = ({ 
    data, 
    dataKey, 
    onUpdate, 
    title, 
    idField = 'id', 
    displayField = 'name',
    newItemTemplate = {}
}) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [editJson, setEditJson] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Filter data safely
    const safeData = Array.isArray(data) ? data : [];
    
    const filteredData = safeData.filter(item => {
        const val = item[displayField];
        return val && typeof val === 'string' && val.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleSelect = (item: any) => {
        setSelectedItem(item);
        setEditJson(JSON.stringify(item, null, 2));
        setError(null);
    };

    const handleCreate = () => {
        const newItem = { 
            [idField]: `new-${Date.now()}`,
            [displayField]: 'Nowy Element',
            ...newItemTemplate 
        };
        const newData = [...safeData, newItem];
        onUpdate(dataKey, newData);
        handleSelect(newItem);
    };

    const handleDelete = (id: string) => {
        if (!confirm('Czy na pewno chcesz usunąć ten element?')) return;
        const newData = safeData.filter(i => i[idField] !== id);
        onUpdate(dataKey, newData);
        if (selectedItem && selectedItem[idField] === id) {
            setSelectedItem(null);
            setEditJson('');
        }
    };

    const handleSave = () => {
        try {
            const parsed = JSON.parse(editJson);
            if (!parsed[idField]) throw new Error(`Brak pola ID (${idField})`);
            
            const newData = safeData.map(i => i[idField] === selectedItem[idField] ? parsed : i);
            
            // If ID changed or it's a new mapping logic (rare in simple edits), careful handling needed.
            // For simple Admin Panel, we assume ID might be editable if it's string based but unique check is on user.
            
            onUpdate(dataKey, newData);
            setSelectedItem(parsed);
            setError(null);
            alert('Zapisano zmiany (lokalnie). Pamiętaj, aby zapisać zmiany na serwerze, jeśli wymagane.');
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="flex h-full gap-6">
            {/* Left Column: List */}
            <div className="w-1/3 flex flex-col bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white">{title} ({safeData.length})</h3>
                    <button onClick={handleCreate} className="text-green-400 hover:text-green-300">
                        <PlusCircleIcon className="h-6 w-6" />
                    </button>
                </div>
                <input 
                    type="text" 
                    placeholder="Szukaj..." 
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm mb-4"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {filteredData.map((item, idx) => (
                        <div 
                            key={item[idField] || idx}
                            onClick={() => handleSelect(item)}
                            className={`p-2 rounded cursor-pointer border flex justify-between items-center ${selectedItem && selectedItem[idField] === item[idField] ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-700 border-transparent hover:border-slate-500'}`}
                        >
                            <span className="truncate text-sm font-medium text-white">{item[displayField] || 'Bez nazwy'}</span>
                            <span className="text-xs text-gray-400 font-mono">{item[idField]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Editor */}
            <div className="w-2/3 flex flex-col bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                {selectedItem ? (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-indigo-400">Edycja: {selectedItem[displayField]}</h3>
                            <button 
                                onClick={() => handleDelete(selectedItem[idField])}
                                className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs text-white"
                            >
                                Usuń Element
                            </button>
                        </div>
                        
                        <div className="flex-grow flex flex-col relative">
                            <textarea
                                className="flex-grow w-full bg-slate-900 font-mono text-xs text-green-400 p-4 rounded border border-slate-600 resize-none focus:outline-none focus:border-indigo-500"
                                value={editJson}
                                onChange={e => setEditJson(e.target.value)}
                                spellCheck={false}
                            />
                            {error && (
                                <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 text-red-200 p-2 rounded text-sm">
                                    Błąd JSON: {error}
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={handleSave}
                                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded"
                            >
                                Zastosuj Zmiany
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-right">
                            * Edytujesz surowy format danych (JSON). Zachowaj ostrożność przy strukturze obiektów.
                        </p>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Wybierz element z listy, aby edytować.
                    </div>
                )}
            </div>
        </div>
    );
};
