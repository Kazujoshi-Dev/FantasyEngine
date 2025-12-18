
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { GameData, ExpeditionRewardSummary, PvpRewardSummary, MessageType, Enemy } from '../types';
import { ExpeditionSummaryModal } from './combat/CombatSummary';
import { LanguageContext } from '../contexts/LanguageContext';
import { getT } from '../i18n';
import { Language } from '../types';

interface PublicReportViewerProps {
    reportId: string;
    type?: 'message' | 'raid';
}

const fetchPublicApi = async (endpoint: string): Promise<any> => {
    const response = await fetch(`/api/public${endpoint}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Raport nie został znaleziony lub wygasł.' }));
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

                // SEO Optimization: Change Page Title
                const resultText = reportRes.body.isVictory ? 'Zwycięstwo' : 'Porażka';
                document.title = `${resultText}: ${reportRes.subject} | Kroniki Mroku`;
            } catch (err: any) {
                setError(err.message);
            }
        };
        fetchData();
    }, [reportId, type]);

    const handleClose = () => {
        window.location.href = '/';
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Wczytywanie kronik...</div>;
    }

    if (error || !reportData || !gameData) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <div className="text-center bg-slate-800 p-8 rounded-lg shadow-2xl border border-red-500/50">
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Nie odnaleziono kroniki</h2>
                    <p className="text-gray-400">{error || 'Zapis tej bitwy mógł zostać usunięty przez system.'}</p>
                    <button onClick={handleClose} className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold transition-all">
                        Strona Główna
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
        enemies: gameData.enemies || [],
        messageId: type === 'message' ? parseInt(reportId, 10) : null,
        raidId: type === 'raid' ? parseInt(reportId, 10) : null,
        backgroundImage: gameData.settings?.reportBackgroundUrl,
    };

    if (msgType === 'expedition_report') {
        const expBody = body as ExpeditionRewardSummary;
        const boss = expBody.bossId ? gameData.enemies.find(e => e.id === expBody.bossId) : undefined;
        modalProps = { ...modalProps, reward: expBody, characterName: reportData.sender || 'Bohater', isHunting: !!expBody.huntingMembers, huntingMembers: expBody.huntingMembers, allRewards: expBody.allRewards, encounteredEnemies: expBody.encounteredEnemies, bossName: boss?.name };
    } else if (msgType === 'raid_report') {
        const raidBody = body as ExpeditionRewardSummary & { opponents?: any[] };
        modalProps = { ...modalProps, reward: raidBody, characterName: '', isHunting: true, isRaid: true, huntingMembers: raidBody.huntingMembers, opponents: raidBody.opponents, isPvp: false };
    } else if (msgType === 'pvp_report') {
        const pvpBody = body as PvpRewardSummary;
        modalProps = { ...modalProps, reward: { combatLog: pvpBody.combatLog, isVictory: pvpBody.isVictory, totalGold: pvpBody.gold, totalExperience: pvpBody.experience, rewardBreakdown: [], itemsFound: [], essencesFound: {} }, characterName: pvpBody.attacker.name, isPvp: true, pvpData: { attacker: pvpBody.attacker, defender: pvpBody.defender }, isDefenderView: false };
    } else {
         return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><p>Nieznany format kroniki.</p></div>;
    }
    
    const windowBackground = gameData?.settings?.windowBackgroundUrl ? `url(${gameData.settings.windowBackgroundUrl})` : undefined;

    return (
        <LanguageContext.Provider value={{ lang: Language.PL, t }}>
            <div className="bg-gray-900 min-h-screen" style={{ "--window-bg": windowBackground } as React.CSSProperties}>
                <ExpeditionSummaryModal {...modalProps} />
            </div>
        </LanguageContext.Provider>
    );
};