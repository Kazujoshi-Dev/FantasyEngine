
import React, { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { SchemaForm, FieldDefinition } from './SchemaForm';

interface GenericAdminTabProps {
    data: any[];
    dataKey: string;
    onUpdate: (key: string, data: any) => void;
    title: string;
    displayField?: string; // Field to show in list (default: 'name')
    newItemTemplate?: any;
    fieldDefinitions?: Record<string, FieldDefinition>;
}

export const GenericAdminTab: React.FC<GenericAdminTabProps> = ({ 
    data, 
    dataKey, 
    onUpdate, 
    title, 
    displayField = 'name',
    newItemTemplate = {},
    fieldDefinitions
}) => {
    const { t } = useTranslation();
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const safeData = Array.isArray(data) ? data : [];

    const handleSave = (item: any) => {
        let updatedData;
        const isNew = !item.id;
        
        const finalItem = {
            ...item,
            id: item.id || crypto.randomUUID()
        };

        if (!isNew) {
            updatedData = safeData.map(d => d.id === finalItem.id ? finalItem : d);
        } else {
            updatedData = [...safeData, finalItem];
        }

        onUpdate(dataKey, updatedData);
        setEditingItem(null);
    };

    const handleDelete = (id: string) => {
        if (window.confirm(t('admin.db.deleteConfirm'))) {
            const updatedData = safeData.filter(d => d.id !== id);
            onUpdate(dataKey, updatedData);
        }
    };

    const filteredData = safeData.filter(item => {
        const val = item[displayField];
        if (typeof val === 'string') {
            return val.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    });

    // Helper to get display value even from nested objects (like name.masculine for Affix)
    const getDisplayValue = (item: any) => {
        const parts = displayField.split('.');
        let val = item;
        for (const p of parts) {
            val = val?.[p];
        }
        return typeof val === 'string' || typeof val === 'number' ? val : '---';
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-indigo-400">{title}</h3>
                <button 
                    onClick={() => setEditingItem({ ...newItemTemplate })} 
                    className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold shadow-lg transition-colors"
                >
                    {t('admin.add')}
                </button>
            </div>

            {editingItem ? (
                <SchemaForm 
                    initialData={editingItem} 
                    onSave={handleSave} 
                    onCancel={() => setEditingItem(null)} 
                    isEditing={!!editingItem.id}
                    fieldDefinitions={fieldDefinitions}
                />
            ) : (
                <>
                    <div className="mb-4">
                        <input 
                            type="text" 
                            placeholder={t('admin.general.searchByName') as string} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    
                    <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredData.length === 0 && (
                            <p className="text-gray-500 text-center py-8">Brak danych do wyświetlenia.</p>
                        )}
                        {filteredData.map((item, idx) => (
                            <div key={item.id || idx} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center border border-slate-700 hover:border-slate-600 transition-colors">
                                <div>
                                    <p className="font-semibold text-gray-200">{getDisplayValue(item)}</p>
                                    <p className="text-xs text-gray-500 font-mono">{item.id}</p>
                                </div>
                                <div className="space-x-2">
                                    <button 
                                        onClick={() => setEditingItem(item)} 
                                        className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600 text-white font-medium transition-colors"
                                    >
                                        {t('admin.edit')}
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)} 
                                        className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700 text-white font-medium transition-colors"
                                    >
                                        {t('admin.delete')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
