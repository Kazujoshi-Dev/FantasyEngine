
import React, { useState, useEffect } from 'react';
import { api } from './api';
import { GameData, ExpeditionRewardSummary, PvpRewardSummary, MessageType } from './types';
import { ExpeditionSummaryModal } from './components/combat/CombatSummary';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';
import { Language } from './types';

interface PublicReportViewerProps {
    reportId: string;
    type?: 'message' | 'raid'; // Added type prop
}

// A separate, non-authed fetch function for public data
const fetchPublicApi = async (endpoint: string): Promise<any> => {
    const response = await fetch(`/api/public${endpoint}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Report not found or has been deleted.' }));
        throw new Error(errorData.message);
    }
    return response.json();
};

export const PublicReportViewer: React.FC<PublicReportViewerProps> = ({ reportId, type = 'message' }) => {
    const t = getT(Language.PL);
    const [reportData, setReportData] = useState<{ type: MessageType; body: any, subject: string, sender: string } | null>(null);
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isLoading = !reportData && !error;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const endpoint = type === 'raid' ? `/raid/${reportId}` : `/report/${reportId}`;
                
                // Fetch both in parallel
                const [reportRes, gameDataRes] = await Promise.all([
                    fetchPublicApi(endpoint),
                    api.getGameData()
                ]);

                setReportData({
                    type: reportRes.message_type,
                    body: reportRes.body,
                    subject: reportRes.subject,
                    sender: reportRes.sender_name,
                });
                setGameData(gameDataRes);
            } catch (err: any) {
                setError(err.message);
            }
        };
        fetchData();
    }, [reportId, type]);

    const handleClose = () => {
        // Redirect to the main page when the modal is closed
        window.location.href = '/';
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">{t('loading')}</div>;
    }

    if (error || !reportData || !gameData) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <div className="text-center bg-slate-800 p-8 rounded-lg">
                    <h2 className="text-2xl font-bold text-red-500 mb-4">{t('error.title')}</h2>
                    <p>{error || 'Could not load report data.'}</p>
                    <button onClick={handleClose} className="mt-6 px-4 py-2 bg-indigo-600 rounded-lg">
                        Powrót do strony głównej
                    </button>
                </div>
            </div>
        );
    }

    const { type: msgType, body } = reportData;

    let modalProps: any = {
        onClose: handleClose,
        itemTemplates: gameData.itemTemplates,
        affixes: gameData.affixes,
        // @FIX: Pass enemies prop to ExpeditionSummaryModal
        enemies: gameData.enemies || [],
        messageId: type === 'message' ? parseInt(reportId, 10) : null,
        raidId: type === 'raid' ? parseInt(reportId, 10) : null,
        backgroundImage: gameData.settings?.reportBackgroundUrl,
    };

    if (msgType === 'expedition_report') {
        const expBody = body as ExpeditionRewardSummary;
        const boss = expBody.bossId ? gameData.enemies.find(e => e.id === expBody.bossId) : undefined;
        
        modalProps = {
            ...modalProps,
            reward: expBody,
            characterName: reportData.sender || 'Gracz',
            isHunting: !!expBody.huntingMembers,
            huntingMembers: expBody.huntingMembers,
            allRewards: expBody.allRewards,
            encounteredEnemies: expBody.encounteredEnemies,
            bossName: boss?.name,
        };
    } else if (msgType === 'raid_report') {
        // Raid reports share ExpeditionRewardSummary structure but with extra 'opponents' field in body
        const raidBody = body as ExpeditionRewardSummary & { opponents?: any[] };
        
        modalProps = {
            ...modalProps,
            reward: raidBody,
            characterName: '', // Not used in hunting/raid view
            isHunting: true, // Reuses hunting view logic for party display
            isRaid: true, // Explicitly mark as raid
            huntingMembers: raidBody.huntingMembers,
            opponents: raidBody.opponents, // Ensure this field is handled in CombatSummary
            isPvp: false,
        };

    } else if (msgType === 'pvp_report') {
        const pvpBody = body as PvpRewardSummary;
        modalProps = {
            ...modalProps,
            reward: {
                combatLog: pvpBody.combatLog,
                isVictory: pvpBody.isVictory,
                totalGold: pvpBody.gold,
                totalExperience: pvpBody.experience,
                rewardBreakdown: [],
                itemsFound: [],
                essencesFound: {}
            },
            characterName: pvpBody.attacker.name,
            isPvp: true,
            pvpData: { attacker: pvpBody.attacker, defender: pvpBody.defender },
            isDefenderView: false, // Public view always shows attacker perspective
        };
    } else {
         return (
             <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <p>Nieprawidłowy typ raportu.</p>
             </div>
        );
    }
    
    const windowBackground = gameData?.settings?.windowBackgroundUrl 
        ? `url(${gameData.settings.windowBackgroundUrl})` 
        : undefined;

    return (
        <LanguageContext.Provider value={{ lang: Language.PL, t }}>
            <div 
                className="bg-gray-900"
                style={{ "--window-bg": windowBackground } as React.CSSProperties}
            >
                <ExpeditionSummaryModal {...modalProps} />
            </div>
        </LanguageContext.Provider>
    );
};
