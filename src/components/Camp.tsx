
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { CoinsIcon } from './icons/CoinsIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ChestIcon } from './icons/ChestIcon';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { AnvilIcon } from './icons/AnvilIcon'; 
import { useTranslation } from '../contexts/LanguageContext';
import { useCharacter } from '@/contexts/CharacterContext';

// Import extracted panels
import { OverviewPanel } from './camp/OverviewPanel';
import { TreasuryPanel } from './camp/TreasuryPanel';
import { WarehousePanel } from './camp/WarehousePanel';
import { BackpackPanel } from './camp/BackpackPanel';
import { WorkshopPanel } from './camp/WorkshopPanel';

type CampTab = 'OVERVIEW' | 'TREASURY' | 'WAREHOUSE' | 'BACKPACK' | 'WORKSHOP';

export const Camp: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<CampTab>('OVERVIEW');
    const { baseCharacter } = useCharacter();

    if (!baseCharacter) return null;

    return (
        <ContentPanel title={t('camp.title')}>
            <div className="flex justify-between items-center border-b border-slate-700 mb-6">
                <div className="flex gap-2 overflow-x-auto custom-scrollbar-hide">
                    <button onClick={() => setActiveTab('OVERVIEW')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <HomeIcon className="h-4 w-4" /> Przegląd
                    </button>
                    <button onClick={() => setActiveTab('WORKSHOP')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'WORKSHOP' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <AnvilIcon className="h-4 w-4" /> Warsztat
                    </button>
                    <button onClick={() => setActiveTab('TREASURY')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'TREASURY' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <ChestIcon className="h-4 w-4" /> Skarbiec
                    </button>
                    <button onClick={() => setActiveTab('WAREHOUSE')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'WAREHOUSE' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <ShieldIcon className="h-4 w-4" /> Magazyn
                    </button>
                    <button onClick={() => setActiveTab('BACKPACK')} className={`px-4 py-3 border-b-2 transition-colors font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'BACKPACK' ? 'border-amber-400 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                        <BriefcaseIcon className="h-4 w-4" /> Plecak
                    </button>
                </div>
                 <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-1 rounded-full mb-[-1px] border border-slate-700 flex-shrink-0">
                     <CoinsIcon className="h-5 w-5 text-amber-400" />
                     <span className="font-mono text-lg font-bold text-amber-400">{(baseCharacter.resources.gold || 0).toLocaleString()}</span>
                 </div>
            </div>

            <div className="h-[70vh] overflow-y-auto pr-2">
                {activeTab === 'OVERVIEW' && <OverviewPanel />}
                {activeTab === 'WORKSHOP' && <WorkshopPanel />}
                {activeTab === 'TREASURY' && <TreasuryPanel />}
                {activeTab === 'WAREHOUSE' && <WarehousePanel />}
                {activeTab === 'BACKPACK' && <BackpackPanel />}
            </div>
        </ContentPanel>
    );
};
