
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { useTranslation } from '../../contexts/LanguageContext';
import { Guild, EspionageEntry, EssenceType, GuildRole } from '../../types';
import { EyeIcon } from '../icons/EyeIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { CoinsIcon } from '../icons/CoinsIcon';
import { rarityStyles } from '../shared/ItemSlot';

const Countdown: React.FC<{ until: string; onFinish: () => void }> = ({ until, onFinish }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now(); // Should sync with server time ideally
            const diff = new Date(until).getTime() - now;
            if (diff <= 0) {
                setTimeLeft('00:00');
                onFinish();
                clearInterval(interval);
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [until, onFinish]);

    return <span className="font-mono text-emerald-400">{timeLeft}</span>;
};

export const GuildEspionage: React.FC<{ guild: Guild }> = ({ guild }) => {
    const { t } = useTranslation();
    const [activeSpies, setActiveSpies] = useState<EspionageEntry[]>([]);
    const [history, setHistory] = useState<EspionageEntry[]>([]);
    const [targets, setTargets] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);

    const spyLevel = guild.buildings?.spyHideout || 0;
    const maxSpies = spyLevel;
    
    // Permission check
    const canSpy = guild.myRole === GuildRole.LEADER || guild.myRole === GuildRole.OFFICER;

    const fetchData = async () => {
        try {
            const data = await api.getEspionage();
            setActiveSpies(data.activeSpies);
            setHistory(data.history);

            if (spyLevel > 0) {
                const targetList = await api.getGuildTargets();
                setTargets(targetList);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleSendSpy = async () => {
        if (!selectedTarget) return;
        setLoading(true);
        try {
            await api.startEspionage(Number(selectedTarget));
            alert(t('guild.espionage.spySent'));
            fetchData();
            setSelectedTarget('');
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const getDuration = () => {
        if (spyLevel === 1) return 15;
        if (spyLevel === 2) return 10;
        if (spyLevel >= 3) return 5;
        return 0;
    };

    const essenceToRarityMap: Record<EssenceType, any> = {
        [EssenceType.Common]: rarityStyles['Common'],
        [EssenceType.Uncommon]: rarityStyles['Uncommon'],
        [EssenceType.Rare]: rarityStyles['Rare'],
        [EssenceType.Epic]: rarityStyles['Epic'],
        [EssenceType.Legendary]: rarityStyles['Legendary'],
    };

    const renderResources = (res: any) => {
        // Safe parsing logic for double-serialized JSON or missing data
        let data = res;
        if (!data) return <span className="text-gray-500">Brak danych (Błąd szpiega)</span>;
        
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Failed to parse espionage result:", e);
                return <span className="text-red-500">Błąd danych</span>;
            }
        }

        return (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                    <span className="text-amber-400">Złoto:</span>
                    <span className="font-mono text-white">{data.gold?.toLocaleString() ?? '0'}</span>
                </div>
                {Object.values(EssenceType).map(e => {
                    // Filter based on building level
                    // Lvl 1: Gold only (already handled above)
                    // Lvl 2: Gold + Common/Uncommon/Rare
                    // Lvl 3: All
                    if (spyLevel === 1) return null;
                    if (spyLevel === 2 && (e === EssenceType.Epic || e === EssenceType.Legendary)) return null;

                    const rarityStyle = essenceToRarityMap[e];
                    return (
                         <div key={e} className="flex justify-between">
                            <span className={rarityStyle.text}>{t(`resources.${e}`)}:</span>
                            <span className="font-mono text-white">{data[e] !== undefined ? data[e] : '0'}</span>
                        </div>
                    );
                })}
                 {(spyLevel < 3) && <div className="col-span-2 text-center text-gray-500 italic mt-1">{t('guild.espionage.hidden')}</div>}
            </div>
        );
    };

    // Cost calculation logic
    const selectedTargetData = useMemo(() => targets.find(t => t.id === selectedTarget), [targets, selectedTarget]);
    const missionCost = selectedTargetData ? (selectedTargetData.total_level * 125) : 0;
    const canAfford = (guild.resources.gold || 0) >= missionCost;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[70vh] animate-fade-in">
            {/* Left: Controls & Active */}
            <div className="flex flex-col gap-6">
                <div className="bg-slate-900/40 p-6 rounded-xl border border-emerald-500/30">
                    <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                        <EyeIcon className="h-6 w-6"/> {t('guild.espionage.title')} (Lvl {spyLevel})
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                             <label className="block text-sm font-medium text-gray-300 mb-2">{t('guild.espionage.selectTarget')}</label>
                             <select 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white disabled:opacity-50"
                                value={selectedTarget}
                                onChange={e => setSelectedTarget(Number(e.target.value))}
                                disabled={activeSpies.length >= maxSpies || !canSpy}
                             >
                                 <option value="">{t('guild.espionage.selectTarget')}</option>
                                 {targets.map(t => (
                                     <option key={t.id} value={t.id}>[{t.tag}] {t.name} (Lvl: {t.total_level})</option>
                                 ))}
                             </select>
                        </div>
                        
                        <div className="text-sm space-y-3 bg-slate-800/50 p-4 rounded border border-slate-700">
                             <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                 <span className="text-gray-400 font-medium">{t('guild.espionage.duration')}:</span>
                                 <span className="text-white font-bold">{getDuration()} min</span>
                             </div>

                             {selectedTargetData ? (
                                 <div className="space-y-1">
                                     <div className="flex justify-between items-center">
                                         <span className="text-gray-400">{t('guild.espionage.targetSumLevels')}:</span>
                                         <span className="text-white">{selectedTargetData.total_level}</span>
                                     </div>
                                     <div className="flex justify-between items-center">
                                         <span className="text-gray-400">{t('guild.espionage.costBase')}:</span>
                                         <span className="text-gray-500">125 <CoinsIcon className="h-3 w-3 inline text-amber-500"/></span>
                                     </div>
                                     <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-700/50">
                                         <span className="text-gray-300 font-bold">{t('guild.espionage.cost')}:</span>
                                         <span className={`font-mono font-bold flex items-center gap-1 ${canAfford ? 'text-amber-400' : 'text-red-500'}`}>
                                             {missionCost.toLocaleString()} <CoinsIcon className="h-4 w-4"/>
                                         </span>
                                     </div>
                                     {!canAfford && (
                                         <p className="text-xs text-red-400 text-right mt-1">
                                             Brak złota w skarbcu ({guild.resources.gold.toLocaleString()})
                                         </p>
                                     )}
                                 </div>
                             ) : (
                                 <p className="text-gray-500 text-xs italic text-center">{t('guild.espionage.selectTargetHint')}</p>
                             )}

                             <div className="bg-slate-900/50 p-2 rounded text-xs text-gray-400 mt-2">
                                 <p className="font-bold text-gray-300 mb-1">Dostępne informacje:</p>
                                 <p>{spyLevel === 1 ? t('guild.espionage.level1Info') : spyLevel === 2 ? t('guild.espionage.level2Info') : t('guild.espionage.level3Info')}</p>
                             </div>
                        </div>

                        <button 
                            onClick={handleSendSpy} 
                            disabled={loading || !selectedTarget || activeSpies.length >= maxSpies || !canAfford || !canSpy}
                            className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 rounded font-bold text-white shadow-lg disabled:bg-slate-700 disabled:text-gray-500 transition-all hover:scale-[1.02]"
                        >
                            {loading ? '...' : t('guild.espionage.sendSpy')}
                        </button>
                        {!canSpy && <p className="text-center text-xs text-red-400 font-bold mt-1">Tylko Lider i Oficerowie mogą wysyłać szpiegów.</p>}
                    </div>
                </div>

                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex-grow">
                    <h4 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">{t('guild.espionage.activeSpies')} ({activeSpies.length}/{maxSpies})</h4>
                    <div className="space-y-3">
                         {activeSpies.length === 0 && <p className="text-gray-500 text-center italic">{t('guild.espionage.noActive')}</p>}
                         {activeSpies.map(spy => (
                             <div key={spy.id} className="bg-slate-800 p-3 rounded border border-slate-600 flex justify-between items-center">
                                 <div>
                                     <span className="font-bold text-emerald-300">{spy.targetGuildName}</span>
                                     <p className="text-xs text-gray-500 mt-0.5">Koszt: {spy.cost}g</p>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <ClockIcon className="h-4 w-4 text-gray-400"/>
                                     <Countdown until={spy.endTime} onFinish={fetchData} />
                                 </div>
                             </div>
                         ))}
                    </div>
                </div>
            </div>

            {/* Right: History */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 flex flex-col h-full overflow-hidden">
                <h4 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">{t('guild.espionage.reports')}</h4>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                     {history.length === 0 && <p className="text-gray-500 text-center italic mt-10">{t('guild.espionage.noReports')}</p>}
                     {history.map(report => (
                         <div key={report.id} className="bg-slate-800 p-4 rounded-lg border border-slate-600 hover:border-emerald-500/50 transition-colors">
                             <div className="flex justify-between items-start mb-3 border-b border-slate-700 pb-2">
                                 <span className="font-bold text-white">{t('guild.espionage.reportFrom')} <span className="text-emerald-300">{report.targetGuildName}</span></span>
                                 <span className="text-xs text-gray-500">{new Date(report.endTime).toLocaleString()}</span>
                             </div>
                             
                             <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                                 {renderResources(report.resultSnapshot)}
                             </div>
                             <div className="mt-2 text-right">
                                 <span className="text-xs text-gray-500">{t('guild.espionage.cost')}: <span className="text-amber-500">{report.cost}g</span></span>
                             </div>
                         </div>
                     ))}
                </div>
            </div>
        </div>
    );
};
