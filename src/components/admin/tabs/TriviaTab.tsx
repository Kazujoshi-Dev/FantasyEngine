
import React, { useMemo, useState, useEffect } from 'react';
import { GameData, GlobalStats } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { SparklesIcon } from '../../icons/SparklesIcon';
import { ShieldIcon } from '../../icons/ShieldIcon';
import { SwordsIcon } from '../../icons/SwordsIcon';
import { UsersIcon } from '../../icons/UsersIcon';
import { BookOpenIcon } from '../../icons/BookOpenIcon';
import { api } from '../../../api';

interface TriviaTabProps {
    gameData: GameData;
}

export const TriviaTab: React.FC<TriviaTabProps> = ({ gameData }) => {
    const { t } = useTranslation();
    const { itemTemplates, affixes, enemies, quests, locations, skills } = gameData;
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Force refresh by adding timestamp to bypass cache if any
        console.log("Fetching Global Stats...");
        const fetchStats = async () => {
            setLoading(true);
            try {
                const data = await api.getGlobalStats();
                setStats(data);
            } catch (err) {
                console.error("Failed to fetch global stats:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const staticStats = useMemo(() => {
        return {
            itemsCount: itemTemplates.length,
            affixCount: affixes.length,
            enemiesCount: enemies.filter(e => !e.isBoss).length,
            bossCount: enemies.filter(e => e.isBoss).length,
            questsCount: quests.length,
            locationsCount: locations.length,
            skillCount: (skills || []).length
        };
    }, [itemTemplates, affixes, enemies, quests, locations, skills]);

    const renderProgressBar = (count: number, total: number, color: string) => {
        const percent = total > 0 ? (count / total) * 100 : 0;
        return (
            <div className="w-full bg-slate-900/50 h-2 rounded-full mt-1 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${percent}%` }}></div>
            </div>
        );
    }
    
    // Sort received demographics
    const sortedRaces = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.raceCounts).sort((a, b) => b[1] - a[1]);
    }, [stats]);
    
    const sortedClasses = useMemo(() => {
         if (!stats) return [];
         return Object.entries(stats.classCounts).sort((a, b) => b[1] - a[1]);
    }, [stats]);

    return (
        <div className="animate-fade-in space-y-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
                <SparklesIcon className="h-6 w-6" />
                Statystyki Świata Gry
            </h3>

            {loading ? (
                <div className="flex justify-center py-10">
                    <p className="text-gray-400 animate-pulse">Ładowanie statystyk serwera...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Demographics - Races */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h4 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                            <UsersIcon className="h-5 w-5"/> Populacja Ras ({stats?.totalPlayers})
                        </h4>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {sortedRaces.map(([race, count]) => (
                                <div key={race} className="bg-slate-900/30 p-2 rounded">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-300">{t(`race.${race}`)}</span>
                                        <span className="font-mono text-white">{count} ({((count / (stats?.totalPlayers || 1)) * 100).toFixed(1)}%)</span>
                                    </div>
                                    {renderProgressBar(count, stats?.totalPlayers || 1, 'bg-amber-500')}
                                </div>
                            ))}
                            {sortedRaces.length === 0 && <p className="text-gray-500 text-sm">Brak danych.</p>}
                        </div>
                    </div>

                    {/* Demographics - Classes */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h4 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">
                            <BookOpenIcon className="h-5 w-5"/> Populacja Klas
                        </h4>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {sortedClasses.map(([className, count]) => {
                                const displayClass = className === 'Novice' ? 'Bez klasy (Novice)' : t(`class.${className}`);
                                return (
                                    <div key={className} className="bg-slate-900/30 p-2 rounded">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-300">{displayClass}</span>
                                            <span className="font-mono text-white">{count} ({((count / (stats?.totalPlayers || 1)) * 100).toFixed(1)}%)</span>
                                        </div>
                                        {renderProgressBar(count, stats?.totalPlayers || 1, 'bg-indigo-500')}
                                    </div>
                                )
                            })}
                            {sortedClasses.length === 0 && <p className="text-gray-500 text-sm">Brak danych.</p>}
                        </div>
                    </div>

                    {/* Content Stats (Static) */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h4 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                            <ShieldIcon className="h-5 w-5 text-red-400"/>
                            Zawartość (Statyczna)
                        </h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                                <span className="text-gray-300">Zwykli Przeciwnicy</span>
                                <span className="font-mono font-bold text-white">{staticStats.enemiesCount}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded border border-red-900/30">
                                <span className="text-red-300 font-bold">Bossowie</span>
                                <span className="font-mono font-bold text-red-500">{staticStats.bossCount}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                                <span className="text-gray-300">Zadania (Questy)</span>
                                <span className="font-mono font-bold text-yellow-400">{staticStats.questsCount}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                                <span className="text-gray-300">Lokacje</span>
                                <span className="font-mono font-bold text-green-400">{staticStats.locationsCount}</span>
                            </div>
                             <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                                <span className="text-gray-300">Umiejętności</span>
                                <span className="font-mono font-bold text-sky-400">{staticStats.skillCount}</span>
                            </div>
                        </div>
                    </div>
                
                    {/* Top Items */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 col-span-1 md:col-span-1">
                        <h4 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                            <SwordsIcon className="h-5 w-5 text-sky-400"/>
                            Najpopularniejsze Przedmioty
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                             {stats?.topItems.map(({ id, count }) => {
                                 const item = itemTemplates.find(t => t.id === id);
                                 return (
                                     <div key={id} className="flex justify-between items-center text-sm bg-slate-900/30 p-1.5 rounded">
                                         <span className="text-gray-300 truncate">{item ? item.name : id}</span>
                                         <span className="font-mono text-sky-400 font-bold">{count}</span>
                                     </div>
                                 )
                             })}
                             {stats?.topItems.length === 0 && <p className="text-gray-500 text-sm">Brak danych.</p>}
                        </div>
                    </div>

                    {/* Top Affixes */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 col-span-1 md:col-span-1">
                        <h4 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                            <SparklesIcon className="h-5 w-5 text-purple-400"/>
                            Najpopularniejsze Afiksy
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                             {stats?.topAffixes.map(({ id, count }) => {
                                 const affix = affixes.find(a => a.id === id);
                                 const name = affix ? (typeof affix.name === 'string' ? affix.name : affix.name.masculine) : id;
                                 return (
                                     <div key={id} className="flex justify-between items-center text-sm bg-slate-900/30 p-1.5 rounded">
                                         <span className="text-gray-300 truncate">{name}</span>
                                         <span className="font-mono text-purple-400 font-bold">{count}</span>
                                     </div>
                                 )
                             })}
                             {stats?.topAffixes.length === 0 && <p className="text-gray-500 text-sm">Brak danych.</p>}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-slate-900/30 p-4 rounded-lg text-xs text-gray-500 italic text-center">
                * Statystyki popularności są agregowane z inwentarza wszystkich graczy w czasie rzeczywistym.
            </div>
        </div>
    );
};
