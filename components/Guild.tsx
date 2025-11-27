import React from 'react';
import { ContentPanel } from './ContentPanel';
import { useTranslation } from '../contexts/LanguageContext';

export const Guild: React.FC = () => {
    const { t } = useTranslation();

    return (
        <ContentPanel title={t('guild.title')}>
            <div className="bg-slate-900/40 p-6 rounded-xl flex items-center justify-center h-64">
                <p className="text-gray-400 italic">Zawartość w przygotowaniu...</p>
            </div>
        </ContentPanel>
    );
};