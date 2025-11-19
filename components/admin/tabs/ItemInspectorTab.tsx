import React, { useState } from 'react';
import { ItemSearchResult, GameData } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';
import { ItemDetailsPanel } from '../../shared/ItemSlot';

interface ItemInspectorTabProps {
  gameData: GameData;
}

export const ItemInspectorTab: React.FC<ItemInspectorTabProps> = ({ gameData }) => {
  const { t } = useTranslation();
  const [itemSearchId, setItemSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<ItemSearchResult | null>(null);
  const [isSearchingItem, setIsSearchingItem] = useState(false);
  const [itemSearchError, setItemSearchError] = useState<string | null>(null);

  const handleFindItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSearchId.trim()) return;
    setIsSearchingItem(true);
    setItemSearchError(null);
    setSearchResult(null);
    try {
        const result = await api.findItemById(itemSearchId.trim());
        setSearchResult(result);
    } catch (err: any) {
        setSearchResult(null);
        setItemSearchError(err.message);
    } finally {
        setIsSearchingItem(false);
    }
  };

  return (
    <div className="animate-fade-in">
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.itemInspector.title')}</h3>
        <p className="text-sm text-gray-400 mb-4">
            {t('admin.itemInspector.description')}
        </p>
        <form onSubmit={handleFindItem} className="flex gap-4 mb-6">
            <input
                type="text"
                value={itemSearchId}
                onChange={(e) => { setItemSearchId(e.target.value); setItemSearchError(null); setSearchResult(null); }}
                placeholder={t('admin.itemInspector.placeholder') as string}
                className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2"
            />
            <button
                type="submit"
                disabled={isSearchingItem || !itemSearchId.trim()}
                className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
                {isSearchingItem ? t('admin.itemInspector.search') + '...' : t('admin.itemInspector.search')}
            </button>
        </form>

        {itemSearchError && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 text-center p-3 rounded-lg">
                {itemSearchError}
            </div>
        )}

        {searchResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 animate-fade-in">
                <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h4 className="text-lg font-bold text-indigo-400 mb-2">{t('admin.itemInspector.itemDetails')}</h4>
                    <ItemDetailsPanel 
                        item={searchResult.item}
                        template={searchResult.template}
                        affixes={gameData.affixes}
                    />
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h4 className="text-lg font-bold text-indigo-400 mb-2">{t('admin.itemInspector.locations')}</h4>
                    {searchResult.locations.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                            {searchResult.locations.map((loc, index) => (
                                <li key={index} className="bg-slate-700/50 p-2 rounded">
                                    <p><strong>{t('admin.itemInspector.owner')}:</strong> {loc.ownerName} (ID: {loc.userId})</p>
                                    <p><strong>{t('admin.itemInspector.location')}:</strong> <span className="font-mono">{loc.location}</span></p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">{t('admin.itemInspector.notFound')}.</p>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
