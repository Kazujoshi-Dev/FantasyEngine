
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { GameData, ExpeditionRewardSummary, PvpRewardSummary, MessageType, Enemy, Language } from '../types';
import { ExpeditionSummaryModal } from './combat/CombatSummary';
import { LanguageContext } from '../contexts/LanguageContext';
import { getT } from '../i18n';

// Symulacja Helmet dla SEO (w realnym projekcie użyj react-helmet-async)
const SEOHead: React.FC<{ title: string; description: string }> = ({ title, description }) => {
    useEffect(() => {
        document.title = title;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', description);
    }, [title, description]);
    return null;
};

interface PublicReportViewerProps {
    reportId: string;
    type?: 'message' | 'raid';
}

const fetchPublicApi = async (endpoint: string): Promise<any> => {
    const response = await fetch(`/api/public${endpoint}`);
    if (!response.ok) throw new Error('Report not found.');
    return response.json();
};

export const PublicReportViewer: React.FC<PublicReportViewerProps> = ({ reportId, type = 'message' }) => {
    const t = getT(Language.PL);
    const [reportData, setReportData] = useState<{ type: MessageType; body: any, subject: string, sender: string } | null>(null);
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const endpoint = type === 'raid' ? `/raid/${reportId}` : `/report/${reportId}`;
                const [reportRes, gameDataRes] = await Promise.all([fetchPublicApi(endpoint), api.getGameData()]);
                setReportData({ type: reportRes.message_type, body: reportRes.body, subject: reportRes.subject, sender: reportRes.sender_name });
                setGameData(gameDataRes);
            } catch (err: any) { setError(err.message); }
        };
        fetchData();
    }, [reportId, type]);

    const getSEOMeta = () => {
        if (!reportData) return { title: 'Ładowanie raportu...', desc: '' };
        const winStatus = reportData.body.isVictory ? 'Zwycięstwo' : 'Porażka';
        return {
            title: `${winStatus}: ${reportData.subject} | Kroniki Mroku`,
            desc: `Zobacz raport z walki w grze Kroniki Mroku. Gracz: ${reportData.sender}. Wynik: ${winStatus}.`
        };
    };

    if (error || !reportData || !gameData) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="text-center">{error || 'Ładowanie...'}</div></div>;
    }

    const { title, desc } = getSEOMeta();

    return (
        <LanguageContext.Provider value={{ lang: Language.PL, t }}>
            <SEOHead title={title} description={desc} />
            <div className="bg-gray-900 min-h-screen">
                <ExpeditionSummaryModal 
                    reward={reportData.body} 
                    onClose={() => window.location.href = '/'} 
                    characterName={reportData.sender}
                    itemTemplates={gameData.itemTemplates}
                    affixes={gameData.affixes}
                    enemies={gameData.enemies}
                    isPvp={reportData.type === 'pvp_report'}
                    isHunting={reportData.type === 'expedition_report' && !!reportData.body.huntingMembers}
                    isRaid={reportData.type === 'raid_report'}
                    backgroundImage={gameData.settings?.reportBackgroundUrl}
                />
            </div>
        </LanguageContext.Provider>
    );
};
