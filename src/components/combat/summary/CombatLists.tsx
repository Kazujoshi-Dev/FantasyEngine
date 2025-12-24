
import React from 'react';
import { Enemy, PartyMember } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

export const EnemyListPanel: React.FC<{
    enemies: Enemy[];
    finalEnemiesHealth: { uniqueId: string; name: string; currentHealth: number; maxHealth: number }[] | undefined;
    onEnemyClick: (enemy: Enemy) => void;
    selectedName?: string;
    globalEnemyHealth?: number; // Dodany prop dla kompatybilności 1v1
}> = ({ enemies, finalEnemiesHealth, onEnemyClick, selectedName, globalEnemyHealth }) => {
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-red-500/50 h-full overflow-y-auto">
             <h4 className="font-bold text-xl text-center border-b border-red-500/50 pb-2 mb-2 text-red-400">
                Wrogowie
            </h4>
            <div className="space-y-3">
                {enemies.map((enemy, idx) => {
                    const uniqueId = enemy.uniqueId || `enemy-${idx}`;
                    const healthSnapshot = finalEnemiesHealth?.find(h => h.uniqueId === uniqueId || h.name === enemy.name);
                    
                    const maxHealth = healthSnapshot?.maxHealth ?? enemy.stats.maxHealth;
                    let currentHealth = maxHealth;

                    if (healthSnapshot) {
                        currentHealth = healthSnapshot.currentHealth;
                    } else if (globalEnemyHealth !== undefined && enemies.length === 1) {
                        currentHealth = globalEnemyHealth;
                    }
                    
                    const hpPercent = (Math.max(0, currentHealth) / maxHealth) * 100;
                    const isDead = currentHealth <= 0;
                    const enemyName = healthSnapshot?.name || enemy.name;
                    const isSelected = selectedName === enemyName;

                    return (
                        <div 
                            key={uniqueId} 
                            className={`p-2 rounded bg-slate-800 transition-all duration-200 cursor-pointer border ${isSelected ? 'border-red-500 ring-1 ring-red-500/50 bg-red-900/20' : 'border-transparent hover:border-slate-500'} ${isDead ? 'opacity-75 grayscale' : ''}`}
                            onClick={() => onEnemyClick(enemy)}
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
    finalPartyStatus: Record<string, { currentHealth: number, maxHealth: number, currentMana?: number, maxMana?: number }>;
    onMemberClick: (member: PartyMember) => void;
    selectedName?: string;
    isEnemyTeam?: boolean;
}> = ({ members, finalPartyStatus, onMemberClick, selectedName, isEnemyTeam }) => {
    const { t } = useTranslation();
    const titleColor = isEnemyTeam ? 'text-red-400' : 'text-sky-400';
    const borderColor = isEnemyTeam ? 'border-red-500/50' : 'border-sky-500/50';
    const hpBarColor = isEnemyTeam ? 'bg-red-600' : 'bg-green-500';
    
    return (
        <div className={`bg-slate-900/50 p-4 rounded-lg border ${borderColor} h-full overflow-y-auto overflow-visible`}>
             <h4 className={`font-bold text-xl text-center border-b ${borderColor} pb-2 mb-2 ${titleColor}`}>
                {isEnemyTeam ? 'Przeciwnicy' : t('hunting.members')}
            </h4>
            <div className="space-y-3">
                {members.map((member, idx) => {
                    const statusData = finalPartyStatus[member.characterName];
                    
                    const currentHP = statusData?.currentHealth ?? (member.stats?.currentHealth ?? 1); 
                    const maxHP = statusData?.maxHealth ?? (member.stats?.maxHealth ?? 1);
                    const currentMP = statusData?.currentMana ?? (member.stats?.currentMana ?? 0);
                    const maxMP = statusData?.maxMana ?? (member.stats?.maxMana ?? 0);
                    
                    const hpPercent = Math.min(100, Math.max(0, (currentHP / maxHP) * 100));
                    const mpPercent = maxMP > 0 ? Math.min(100, Math.max(0, (currentMP / maxMP) * 100)) : 0;
                    
                    const isDead = currentHP <= 0;
                    const isSelected = selectedName === member.characterName;

                    return (
                        <div 
                            key={idx} 
                            className={`p-2 rounded bg-slate-800 transition-all duration-200 cursor-pointer border ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/50 bg-indigo-900/20' : 'border-transparent hover:border-slate-500'} ${isDead ? 'opacity-75' : ''}`}
                            onClick={() => onMemberClick(member)}
                        >
                            <p className={`font-bold text-sm ${isDead ? 'text-red-500 line-through' : 'text-white'}`}>
                                {member.characterName}
                            </p>
                            
                            {/* Pasek HP */}
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className={`${hpBarColor} h-1.5 transition-all duration-500`} style={{width: `${hpPercent}%`}}></div>
                            </div>
                            
                            {/* Pasek Many - Wyświetlany tylko jeśli postać posiada manę */}
                            {maxMP > 0 && (
                                <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden mt-1 shadow-inner">
                                    <div className="bg-blue-500 h-1 transition-all duration-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" style={{width: `${mpPercent}%`}}></div>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-1">
                                <span className="text-[9px] text-gray-500 font-bold uppercase">{member.characterClass ? t(`class.${member.characterClass}`) : ''}</span>
                                <p className="text-[10px] text-right text-gray-400 font-mono">
                                    HP: {Math.max(0, Math.ceil(currentHP))} {maxMP > 0 && `| MP: ${Math.max(0, Math.ceil(currentMP))}`}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
