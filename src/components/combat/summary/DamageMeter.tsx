
import React from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';

interface DamageMeterProps {
    damageData: {
        stats: Record<string, number>;
        totalDamage: number;
        turns: number;
        sortedMembers: { name: string, dmg: number }[];
    } | null;
    title: string;
    barColor?: string;
}

export const DamageMeter: React.FC<DamageMeterProps> = ({ damageData, title, barColor = 'bg-amber-600' }) => {
    const { t } = useTranslation();

    if (!damageData || damageData.totalDamage === 0) return null;

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex-shrink-0 overflow-y-auto max-h-[300px]">
            <h4 className="font-bold text-center border-b border-slate-700 pb-2 mb-2 text-amber-400">
                {title}
            </h4>
            <div className="space-y-3 text-xs">
                {damageData.sortedMembers.map(({name, dmg}) => {
                    const percent = (dmg / damageData.totalDamage) * 100;
                    const dpt = dmg / damageData.turns;
                    return (
                        <div key={name} className="relative">
                            <div className="flex justify-between items-center z-10 relative mb-1">
                                <span className="font-bold text-white">{name}</span>
                                <span className="text-gray-300">{dmg.toLocaleString()} ({percent.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`${barColor} h-full`} style={{ width: `${percent}%` }}></div>
                            </div>
                            <div className="text-right text-[10px] text-gray-500 mt-0.5">
                                {t('expedition.damageMeter.dpt')}: {dpt.toFixed(0)}
                            </div>
                        </div>
                    )
                })}
                <div className="border-t border-slate-700 pt-2 mt-2 text-center">
                    <span className="text-gray-400">{t('expedition.damageMeter.total')}: </span>
                    <span className="font-mono text-white font-bold">{damageData.totalDamage.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};
