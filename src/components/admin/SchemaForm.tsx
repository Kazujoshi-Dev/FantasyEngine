
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';

export interface FieldDefinition {
    type: 'text' | 'number' | 'textarea' | 'checkbox' | 'select';
    label?: string; // Optional override
    options?: { value: string | number; label: string }[];
    readonly?: boolean;
}

interface SchemaFormProps {
    initialData: any;
    onSave: (data: any) => void;
    onCancel: () => void;
    fieldDefinitions?: Record<string, FieldDefinition>;
    isEditing: boolean;
}

export const SchemaForm: React.FC<SchemaFormProps> = ({ initialData, onSave, onCancel, fieldDefinitions, isEditing }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<any>(initialData || {});

    // Helper to infer type if definition not provided
    const inferType = (key: string, value: any): FieldDefinition['type'] => {
        if (typeof value === 'boolean') return 'checkbox';
        if (typeof value === 'number') return 'number';
        if (key === 'description') return 'textarea';
        return 'text';
    };

    const handleChange = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    // Filter out complex objects/arrays unless we have a specific field definition for them
    // or we might want to support JSON editing for them in the future.
    const keysToRender = Object.keys(formData).filter(key => {
        if (key === 'id') return false; // Don't edit ID directly usually
        if (fieldDefinitions && fieldDefinitions[key]) return true;
        const val = formData[key];
        return typeof val !== 'object' || val === null;
    });

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4 border border-slate-700">
            <h3 className="text-xl font-bold text-indigo-400 mb-4">
                {isEditing ? t('admin.edit') : t('admin.add')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keysToRender.map(key => {
                    const def = fieldDefinitions?.[key];
                    const type = def?.type || inferType(key, formData[key]);
                    const label = def?.label || t(`admin.general.${key}` as any) || key;
                    const isReadonly = def?.readonly;

                    if (type === 'checkbox') {
                        return (
                            <div key={key} className="flex items-center mt-6">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={!!formData[key]} 
                                        onChange={e => handleChange(key, e.target.checked)}
                                        disabled={isReadonly}
                                        className="form-checkbox h-5 w-5 text-indigo-600 bg-slate-700 border-slate-600 rounded"
                                    />
                                    <span className="text-gray-300 font-medium">{label}</span>
                                </label>
                            </div>
                        );
                    }

                    if (type === 'select' && def?.options) {
                        return (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                                <select
                                    value={formData[key] || ''}
                                    onChange={e => handleChange(key, e.target.value)}
                                    disabled={isReadonly}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white"
                                >
                                    {def.options.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    }

                    if (type === 'textarea') {
                        return (
                            <div key={key} className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                                <textarea
                                    value={formData[key] || ''}
                                    onChange={e => handleChange(key, e.target.value)}
                                    disabled={isReadonly}
                                    rows={3}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white"
                                />
                            </div>
                        );
                    }

                    return (
                        <div key={key}>
                            <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                            <input
                                type={type === 'number' ? 'number' : 'text'}
                                value={formData[key] || ''}
                                onChange={e => handleChange(key, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                disabled={isReadonly}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white"
                            />
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700 mt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-medium">
                    {t('admin.general.cancel')}
                </button>
                <button type="submit" className="px-6 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {t('admin.general.save')}
                </button>
            </div>
        </form>
    );
};
