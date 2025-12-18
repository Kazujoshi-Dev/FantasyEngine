
import React from 'react';
import { Enemy, PartyMember } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

export const EnemyListPanel: React.FC<{
    enemies: Enemy[];
    finalEnemiesHealth: { uniqueId: string; name: string; currentHealth: number; maxHealth: number }[] | undefined;
    onEnemyHover: (enemy: Enemy, rect: DOMRect) => void;
    onEnemyLeave: () => void;
}> = ({ enemies, finalEnemiesHealth, onEnemyHover, onEnemyLeave }) => {
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-red-500/50 h-full overflow-y-auto">
             <h4 className="font-bold text-xl text-center border-b border-red-500/50 pb-2 mb-2 text-red-400">
                Wrogowie
            </h4>
            <div className="space-y-3">
                {enemies.map((enemy, idx) => {
                    const uniqueId = enemy.uniqueId || `enemy-${idx}`;
                    const healthData = finalEnemiesHealth?.find(h => h.uniqueId === uniqueId || h.name === enemy.name);
                    const currentHealth = healthData ? healthData.currentHealth : 0; 
                    const maxHealth = healthData?.maxHealth ?? enemy.stats.maxHealth;
                    const hpPercent = (Math.max(0, currentHealth) / maxHealth) * 100;
                    const isDead = currentHealth <= 0;
                    const enemyName = healthData?.name || enemy.name;

                    return (
                        <div 
                            key={uniqueId} 
                            className={`p-2 rounded bg-slate-800 relative z-10 hover:z-20 !pointer-events-auto ${isDead ? 'opacity-75 hover:opacity-100 grayscale hover:grayscale-0' : ''} cursor-help border border-transparent hover:border-slate-500 transition-all duration-200`}
                            onMouseEnter={(e) => onEnemyHover(enemy, e.currentTarget.getBoundingClientRect())}
                            onMouseLeave={onEnemyLeave}
                        >
                            <p className={`font-bold text-sm text-white ${isDead ? 'line-through text-red-500' : ''}`}>
                                {enemyName}
                            </p>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className="bg-red-500 h-1.5 transition-all" style={{width: `${hpPercent}%`}}></div>
                            </div>
                            <p className="text-xs text-right text-gray-400 font-mono mt-0.5">{Math.max(0, Math.ceil(currentHealth))} / {maxHealth}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const PartyMemberList: React.FC<{ 
    members: PartyMember[]; 
    finalPartyHealth: Record<string, { currentHealth: number, maxHealth: number }>;
    onMemberHover: (member: PartyMember, rect: DOMRect) => void;
    onMemberLeave: () => void;
    isEnemyTeam?: boolean;
}> = ({ members, finalPartyHealth, onMemberHover, onMemberLeave, isEnemyTeam }) => {
    const { t } = useTranslation();
    const titleColor = isEnemyTeam ? 'text-red-400' : 'text-sky-400';
    const borderColor = isEnemyTeam ? 'border-red-500/50' : 'border-sky-500/50';
    const barColor = isEnemyTeam ? 'bg-red-600' : 'bg-green-500';
    
    return (
        <div className={`bg-slate-900/50 p-4 rounded-lg border ${borderColor} h-full overflow-y-auto overflow-visible`}>
             <h4 className={`font-bold text-xl text-center border-b ${borderColor} pb-2 mb-2 ${titleColor}`}>
                {isEnemyTeam ? 'Przeciwnicy' : t('hunting.members')}
            </h4>
            <div className="space-y-2">
                {members.map((member, idx) => {
                    const healthData = finalPartyHealth[member.characterName];
                    const currentHP = healthData?.currentHealth ?? 0; 
                    const maxHP = healthData?.maxHealth ?? 1;
                    const hpPercent = Math.min(100, Math.max(0, (currentHP / maxHP) * 100));
                    const isDead = currentHP <= 0;

                    return (
                        <div 
                            key={idx} 
                            className={`p-2 rounded bg-slate-800 relative group cursor-help hover:bg-slate-700 z-10 hover:z-20 !pointer-events-auto transition-all duration-200 ${isDead ? 'opacity-75 hover:opacity-100' : ''}`}
                            onMouseEnter={(e) => onMemberHover(member, e.currentTarget.getBoundingClientRect())}
                            onMouseLeave={onMemberLeave}
                        >
                            <p className={`font-bold text-sm ${isDead ? 'text-red-500 line-through' : 'text-white'}`}>
                                {member.characterName}
                            </p>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className={`${barColor} h-1.5 transition-all`} style={{width: `${hpPercent}%`}}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
