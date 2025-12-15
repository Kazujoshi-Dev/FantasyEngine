





import React, { useMemo } from 'react';
import { GameData, AffixType, Race, CharacterClass, AdminCharacterInfo } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { SparklesIcon } from '../../icons/SparklesIcon';
import { ShieldIcon } from '../../icons/ShieldIcon';
import { SwordsIcon } from '../../icons/SwordsIcon';
import { UsersIcon } from '../../icons/UsersIcon';
import { BookOpenIcon } from '../../icons/BookOpenIcon';

interface TriviaTabProps {
    gameData: GameData;
    allCharacters?: AdminCharacterInfo[];
}

export const TriviaTab: React.FC<TriviaTabProps> = ({ gameData, allCharacters = [] }) => {
    const { t } = useTranslation();
    const { itemTemplates, affixes, enemies, quests, locations, skills } = gameData;

    const stats = useMemo(() => {
        let totalCombinations = 0n; 
        let mostFlexibleItem = { name: '', count: 0 };
        
        // Categorize Affixes
        const prefixes = affixes.filter(a => a.type === AffixType.Prefix);
        const suffixes = affixes.filter(a => a.type === AffixType.Suffix);

        // Max Affix Damage Calculation (Pre-calc for performance)
        const maxPrefixDmg = prefixes.reduce((max, p) => Math.max(max, p.damageMax?.max || 0), 0);
        const maxSuffixDmg = suffixes.reduce((max, p) => Math.max(max, p.damageMax?.max || 0), 0);
        let ultimateWeapon = { name: 'Brak', damage: 0 };

        itemTemplates.forEach(item => {
            // 1. Combinations Logic
            const validPrefixesCount = prefixes.filter(p => p.spawnChances && p.spawnChances[item.category] && p.spawnChances[item.category]! > 0).length;
            const validSuffixesCount = suffixes.filter(s => s.spawnChances && s.spawnChances[item.category] && s.spawnChances[item.category]! > 0).length;
            const combinations = (1 + validPrefixesCount) * (1 + validSuffixesCount);
            totalCombinations += BigInt(combinations);

            if (combinations > mostFlexibleItem.count) {
                mostFlexibleItem = { name: item.name, count: combinations };
            }

            // 2. Ultimate Weapon Logic (Base + Max Prefix + Max Suffix)
            // Only check weapons (items with damage)
            if (item.damageMax && item.damageMax > 0) {
                // Calculate Base Damage at +10 Upgrade (100% bonus)
                const baseMax = item.damageMax;
                // Math.round(base * 1.0) represents the +100% bonus from level 10 upgrade
                const upgradedBaseMax = baseMax + Math.round(baseMax * 1.0);

                // Simplified check: assumes best prefix/suffix CAN spawn on this weapon category
                // For exact precision we would filter maxPrefixDmg by item.category, but this is good for trivia.
                const theoreticalMax = upgradedBaseMax + maxPrefixDmg + maxSuffixDmg;
                
                if (theoreticalMax > ultimateWeapon.damage) {
                    ultimateWeapon = { name: item.name, damage: theoreticalMax };
                }
            }
        });

        return {
            totalCombinations: totalCombinations.toString(),
            avgCombinationsPerItem: itemTemplates.length > 0 ? (Number(totalCombinations) / itemTemplates.length).toFixed(0) : 0,
            mostFlexibleItem,
            ultimateWeapon,
            
            // Counts
            itemsCount: itemTemplates.length,
            affixCount: affixes.length,
            enemiesCount: enemies.filter(e => !e.isBoss).length,
            bossCount: enemies.filter(e => e.isBoss).length,
            questsCount: quests.length,
            locationsCount: locations.length,
            
            // Enums & Arrays
            raceCount: Object.keys(Race).length,
            classCount: Object.keys(CharacterClass).length,
            skillCount: (skills || []).length
        };
    }, [itemTemplates, affixes, enemies, quests, locations, skills]);

    const demographics = useMemo(() => {
        const raceCounts: Record<string, number> = {};
        const classCounts: Record<string, number> = {};
        const totalPlayers = allCharacters.length;

        allCharacters.forEach(char => {
            if (char.race) {
                raceCounts[char.race] = (raceCounts[char.race] || 0) + 1;
            }
            
            const className = char.characterClass || 'Bez klasy (Novice)';
            classCounts[className] = (classCounts[className] || 0) + 1;
        });

        // Sort descending
        const sortedRaces = Object.entries(raceCounts).sort((a, b) => b[1] - a[1]);
        const sortedClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

        return { sortedRaces, sortedClasses, totalPlayers };
    }, [allCharacters]);

    const formatNumber = (num: string | number) => {
        return Number(num).toLocaleString('pl-PL');
    };

    const renderProgressBar = (count: number, total: number, color: string) => {
        const percent = total > 0 ? (count / total) * 100 : 0;
        return (
            <div className="w-full bg-slate-900/50 h-2 rounded-full mt-1 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${percent}%` }}></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
                <SparklesIcon className="h-6 w-6" />
                Ciekawostki Świata Gry
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Main Stat Card */}
                <div className="col-span-full bg-gradient-to-r from-slate-800 to-indigo-900/50 p-6 rounded-xl border border-indigo-500/30 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h4 className="text-lg text-indigo-300 font-semibold mb-2">Liczba możliwych przedmiotów</h4>
                            <p className="text-4xl md:text-6xl font-extrabold text-white tracking-tight text-shadow">
                                {formatNumber(stats.totalCombinations)}
                            </p>
                            <p className="text-sm text-gray-400 mt-2">
                                Unikalnych wariantów ekwipunku (Baza + Prefiksy + Sufiksy).
                            </p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-600/50 text-right">
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Teoretycznie najsilniejsza broń</p>
                            <p className="text-xl font-bold text-red-400">{stats.ultimateWeapon.name}</p>
                            <p className="text-sm text-gray-300">Maks. obrażeń: <span className="font-mono font-bold text-white">{stats.ultimateWeapon.damage}</span></p>
                            <p className="text-[10px] text-gray-500 italic">(Ulepszenie +10 + Perfect Roll + Najlepsze Afiksy)</p>
                        </div>
                    </div>
                </div>

                {/* Demographics - Races */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                        <UsersIcon className="h-5 w-5"/> Populacja Ras
                    </h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {demographics.sortedRaces.map(([race, count]) => (
                            <div key={race} className="bg-slate-900/30 p-2 rounded">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-300">{t(`race.${race}`)}</span>
                                    <span className="font-mono text-white">{count} ({((count / demographics.totalPlayers) * 100).toFixed(1)}%)</span>
                                </div>
                                {renderProgressBar(count, demographics.totalPlayers, 'bg-amber-500')}
                            </div>
                        ))}
                         {demographics.sortedRaces.length === 0 && <p className="text-gray-500 text-sm text-center">Brak danych</p>}
                    </div>
                </div>

                 {/* Demographics - Classes */}
                 <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">
                        <BookOpenIcon className="h-5 w-5"/> Populacja Klas
                    </h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {demographics.sortedClasses.map(([className, count]) => {
                            // Try to translate class key if it matches enum, otherwise display raw (e.g. 'Bez klasy')
                            const displayClass = className === 'Bez klasy (Novice)' ? className : t(`class.${className}`);
                            return (
                                <div key={className} className="bg-slate-900/30 p-2 rounded">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-300">{displayClass}</span>
                                        <span className="font-mono text-white">{count} ({((count / demographics.totalPlayers) * 100).toFixed(1)}%)</span>
                                    </div>
                                    {renderProgressBar(count, demographics.totalPlayers, 'bg-indigo-500')}
                                </div>
                            )
                        })}
                        {demographics.sortedClasses.length === 0 && <p className="text-gray-500 text-sm text-center">Brak danych</p>}
                    </div>
                </div>

                {/* Development & Variety */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <UsersIcon className="h-5 w-5 text-green-400"/>
                        Różnorodność Systemu
                    </h4>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                            <span className="text-gray-300">Dostępne Rasy</span>
                            <span className="font-mono font-bold text-amber-400">{stats.raceCount}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                            <span className="text-gray-300">Dostępne Klasy</span>
                            <span className="font-mono font-bold text-indigo-400">{stats.classCount}</span>
                        </div>
                         <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                            <span className="text-gray-300">Umiejętności (Uniw.)</span>
                            <span className="font-mono font-bold text-sky-400">{stats.skillCount}</span>
                        </div>
                    </div>
                </div>

                {/* Content Stats */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <ShieldIcon className="h-5 w-5 text-red-400"/>
                        Zagrożenia i Content
                    </h4>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                            <span className="text-gray-300">Zwykli Przeciwnicy</span>
                            <span className="font-mono font-bold text-white">{stats.enemiesCount}</span>
                        </div>
                         <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded border border-red-900/30">
                            <span className="text-red-300 font-bold">Bossowie</span>
                            <span className="font-mono font-bold text-red-500">{stats.bossCount}</span>
                        </div>
                         <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                            <span className="text-gray-300">Zadania (Questy)</span>
                            <span className="font-mono font-bold text-yellow-400">{stats.questsCount}</span>
                        </div>
                    </div>
                </div>

                {/* Item Stats */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <SwordsIcon className="h-5 w-5 text-sky-400"/>
                        Baza Przedmiotów
                    </h4>
                     <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                            <span className="text-gray-300">Szablony</span>
                            <span className="font-mono font-bold text-white">{stats.itemsCount}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/30 p-2 rounded">
                            <span className="text-gray-300">Afiksy</span>
                            <span className="font-mono font-bold text-purple-400">{stats.affixCount}</span>
                        </div>
                        <div className="p-2 rounded bg-slate-900/30 text-xs text-center text-gray-400">
                            Najbardziej elastyczny przedmiot:<br/>
                            <span className="text-amber-400 font-bold text-sm">{stats.mostFlexibleItem.name}</span>
                            <br/>({formatNumber(stats.mostFlexibleItem.count)} wariantów)
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-900/30 p-4 rounded-lg text-xs text-gray-500 italic text-center">
                * Obliczenia są wykonywane w czasie rzeczywistym na podstawie aktualnie zdefiniowanych danych w grze oraz aktywnych postaci.
            </div>
        </div>
    );
};
