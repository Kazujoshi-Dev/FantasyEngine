import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';
import { Race, CharacterClass } from '../types';

type MainTab = 'universal' | 'racial';
type UniversalSubTab = 'passive' | 'active';
type RacialSubTab = 'races' | 'classes';

export const University: React.FC = () => {
    const { t } = useTranslation();
    const [mainTab, setMainTab] = useState<MainTab>('universal');
    const [universalSubTab, setUniversalSubTab] = useState<UniversalSubTab>('passive');
    const [racialSubTab, setRacialSubTab] = useState<RacialSubTab>('races');

    const renderContent = () => {
        if (mainTab === 'universal') {
            if (universalSubTab === 'passive') {
                return <p className="text-gray-500">{t('university.underConstruction')}</p>;
            }
            if (universalSubTab === 'active') {
                return <p className="text-gray-500">{t('university.underConstruction')}</p>;
            }
        }
        if (mainTab === 'racial') {
            if (racialSubTab === 'races') {
                return <p className="text-gray-500">{t('university.underConstruction')}</p>;
            }
            if (racialSubTab === 'classes') {
                return <p className="text-gray-500">{t('university.underConstruction')}</p>;
            }
        }
        return null;
    };

    return (
        <ContentPanel title={t('university.title')}>
            <div className="flex border-b border-slate-700 mb-6">
                <button
                    onClick={() => setMainTab('universal')}
                    className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${mainTab === 'universal' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    {t('university.universal')}
                </button>
                <button
                    onClick={() => setMainTab('racial')}
                    className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${mainTab === 'racial' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    {t('university.racial')}
                </button>
            </div>

            {mainTab === 'universal' && (
                <div className="flex border-b border-slate-800 mb-6">
                    <button
                        onClick={() => setUniversalSubTab('passive')}
                        className={`px-4 py-2 text-xs font-medium ${universalSubTab === 'passive' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('university.passive')}
                    </button>
                    <button
                        onClick={() => setUniversalSubTab('active')}
                        className={`px-4 py-2 text-xs font-medium ${universalSubTab === 'active' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('university.active')}
                    </button>
                </div>
            )}

            {mainTab === 'racial' && (
                <div className="flex border-b border-slate-800 mb-6">
                    <button
                        onClick={() => setRacialSubTab('races')}
                        className={`px-4 py-2 text-xs font-medium ${racialSubTab === 'races' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('university.races')}
                    </button>
                    <button
                        onClick={() => setRacialSubTab('classes')}
                        className={`px-4 py-2 text-xs font-medium ${racialSubTab === 'classes' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('university.classes')}
                    </button>
                </div>
            )}
            
            <div className="bg-slate-900/40 p-6 rounded-xl">
                {renderContent()}
            </div>
        </ContentPanel>
    );
};