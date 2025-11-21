
import React, { useState } from 'react';
import { Location } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { LocationEditor } from '../editors/LocationEditor';

interface LocationsTabProps {
  locations: Location[];
  onGameDataUpdate: (key: string, data: any) => void;
}

export const LocationsTab: React.FC<LocationsTabProps> = ({ locations, onGameDataUpdate }) => {
  const { t } = useTranslation();
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);

  const safeLocations = (locations || []).filter(l => l && typeof l === 'object');

  const handleSaveLocation = (locationToSave: Location) => {
    let updatedLocations;
    if (editingLocation && editingLocation.id) {
        updatedLocations = safeLocations.map(loc => loc.id === locationToSave.id ? locationToSave : loc);
    } else {
        updatedLocations = [...safeLocations, locationToSave];
    }
    if(locationToSave.isStartLocation){
        updatedLocations = updatedLocations.map(loc => loc.id === locationToSave.id ? loc : {...loc, isStartLocation: false});
    }
    onGameDataUpdate('locations', updatedLocations);
    setEditingLocation(null);
  };
    
  const handleDeleteLocation = (locationId: string) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
        const updatedLocations = safeLocations.filter(loc => loc.id !== locationId);
        onGameDataUpdate('locations', updatedLocations);
    }
  };

  return (
    <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-indigo-400">{t('admin.location.manage')}</h3>
            <button onClick={() => setEditingLocation({})} className="px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 font-semibold">{t('admin.location.add')}</button>
        </div>
        {editingLocation ? (
            <LocationEditor location={editingLocation} onSave={handleSaveLocation} onCancel={() => setEditingLocation(null)} isEditing={!!editingLocation.id} allLocations={safeLocations} />
        ) : (
            <div className="space-y-2">
                {safeLocations.map(loc => (
                     <div key={loc.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{loc.name || 'Bez nazwy'} {loc.isStartLocation && <span className="text-xs text-amber-400">({t('admin.location.start')})</span>}</p>
                            <p className="text-sm text-gray-400">{loc.description}</p>
                        </div>
                        <div className="space-x-2">
                            <button onClick={() => setEditingLocation(loc)} className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600">{t('admin.edit')}</button>
                            <button onClick={() => handleDeleteLocation(loc.id)} className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700">{t('admin.delete')}</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};
