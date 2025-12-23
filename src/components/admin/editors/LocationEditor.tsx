
import React, { useState } from 'react';
import { Location, Tab } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface LocationEditorProps {
  location: Partial<Location>;
  onSave: (location: Location) => void;
  onCancel: () => void;
  isEditing: boolean;
  allLocations: Location[];
}

export const LocationEditor: React.FC<LocationEditorProps> = ({ location, onSave, onCancel, isEditing, allLocations }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<Location>>({
        availableTabs: [],
        ...location
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = (e.target as HTMLInputElement).type === 'checkbox';
        const isChecked = (e.target as HTMLInputElement).checked;
        const isNumeric = ['travelTime', 'travelCost', 'travelEnergyCost'].includes(name);

        setFormData(prev => ({
            ...prev,
            [name]: isCheckbox ? isChecked : (isNumeric ? parseInt(value, 10) || 0 : value)
        }));
    };
    
    const handleTabChange = (tab: Tab) => {
        const currentTabs = formData.availableTabs || [];
        const newTabs = currentTabs.includes(tab)
            ? currentTabs.filter(t => t !== tab)
            : [...currentTabs, tab];
        setFormData(prev => ({ ...prev, availableTabs: newTabs }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert(t('admin.location.nameRequired'));
            return;
        }
        
        const finalLocation: Location = {
            id: formData.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }),
            name: formData.name,
            description: formData.description || '',
            travelTime: formData.travelTime || 0,
            travelCost: formData.travelCost || 0,
            travelEnergyCost: formData.travelEnergyCost || 0,
            availableTabs: formData.availableTabs || [],
            isStartLocation: formData.isStartLocation || false,
            image: formData.image || '',
        };

        if (finalLocation.isStartLocation) {
            const otherStartLocation = allLocations.find(l => l.isStartLocation && l.id !== finalLocation.id);
            if(otherStartLocation) {
                alert(t('admin.location.isStartLocationNote'));
            }
        }
        onSave(finalLocation);
    };
    
    const allTabOptions = Object.values(Tab).filter(v => typeof v === 'string') as string[];

    return (
         <form onSubmit={handleSubmit} className="bg-slate-900/40 p-6 rounded-xl mt-6 space-y-4">
            <h3 className="text-xl font-bold text-indigo-400">{isEditing ? t('admin.location.edit') : t('admin.location.create')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label>{t('admin.general.name')}:<input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>URL Obrazka:<input name="image" value={formData.image || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div className="col-span-full"><label>{t('admin.general.description')}:<textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.location.travelTime')}:<input name="travelTime" type="number" value={formData.travelTime || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.location.travelCostGold')}:<input name="travelCost" type="number" value={formData.travelCost || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div><label>{t('admin.location.travelCostEnergy')}:<input name="travelEnergyCost" type="number" value={formData.travelEnergyCost || 0} onChange={handleChange} className="w-full bg-slate-700 p-2 rounded-md mt-1" /></label></div>
                <div className="flex items-center space-x-2 pt-6">
                    <input type="checkbox" name="isStartLocation" checked={formData.isStartLocation || false} onChange={handleChange} className="form-checkbox h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"/>
                    <span>{t('admin.location.isStartLocation')}</span>
                </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
                <label className="block text-sm font-bold text-gray-300 mb-4 uppercase tracking-widest">{t('location.availableFacilities')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {allTabOptions.map(tabName => {
                        const tabValue = tabName as Tab;
                        const isChecked = formData.availableTabs?.includes(tabValue);
                        return (
                            <label key={tabName} className={`flex items-center gap-2 p-2 rounded border transition-colors cursor-pointer ${isChecked ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={isChecked} 
                                    onChange={() => handleTabChange(tabValue)} 
                                    className="form-checkbox h-4 w-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-semibold">{t(`sidebar.${tabName.toLowerCase()}` as any)}</span>
                            </label>
                        );
                    })}
                </div>
                <p className="text-[10px] text-gray-500 mt-4 italic">Zaznacz zakładki, które mają być widoczne w menu bocznym będąc w tej lokacji.</p>
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-white font-bold">{t('admin.general.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold">{t('admin.general.save')}</button>
            </div>
        </form>
    );
};
