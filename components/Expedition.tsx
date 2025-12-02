
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Expedition as ExpeditionType, Location, Enemy, ExpeditionRewardSummary, CombatLogEntry, CharacterStats, EnemyStats, ItemTemplate, PvpRewardSummary, Affix, ItemInstance, PartyMember, MagicAttackType } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { StarIcon } from './icons/StarIcon';
import { ClockIcon } from './icons/ClockIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { MapIcon } from './icons/MapIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles, getGrammaticallyCorrectFullName } from './shared/ItemSlot';
import { api } from '../api';

export interface ExpeditionProps {
    character: PlayerCharacter;
    expeditions: ExpeditionType[];
    enemies: Enemy[];
    currentLocation: Location;
    onStartExpedition: (expeditionId: string) => void;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    onCompletion: () => Promise<void>;
}

const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds > 0 ? `${remainingSeconds}s` : ''}`.trim();
};

const formatTimeLeft = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const CombatLogRow: React.FC<{
    log: CombatLogEntry;
    characterName: string;
    isHunting?: boolean;
    huntingMembers?: PartyMember[];
}> = ({ log, characterName, isHunting, huntingMembers }) => {
    const { t } = useTranslation();

    const friendlyNames = useMemo(() => {
        if (isHunting && huntingMembers) {
            return huntingMembers.map(m => m.characterName);
        }
        return [characterName];
    }, [isHunting, huntingMembers, characterName]);

    const getCombatantColor = (name: string) => {
        if (friendlyNames.includes(name) || name === 'Team') {
            return 'text-sky-400';
        }
        return 'text-red-400';
    };

    const getHpForEntity = (name: string) => {
        if (friendlyNames.includes(name)) {
            const playerHealthData = log.allPlayersHealth?.find(p => p.name === name);
            if (playerHealthData) {
                return playerHealthData.currentHealth;
            }
            return log.playerHealth; // Fallback
        }
        const enemyHealthData = log.allEnemiesHealth?.find(e => e.name === name);
        if (enemyHealthData) {
            return enemyHealthData.currentHealth;
        }
        return log.enemyHealth; // Fallback for 1v1
    };


    const renderName = (name: string) => {
        const color = getCombatantColor(name);
        if(name === 'Team') return <span className={`font-semibold ${color}`}>{name}</span>;
        
        const hp = Math.max(0, Math.ceil(getHpForEntity(name)));
        
        return (
            <>
                <span className={`font-semibold ${color}`}>{name}</span>
                <span className="text-xs text-gray-500 font-normal ml-1">({hp} HP)</span>
            </>
        );
    };
    
    if (log.action === 'specialAttackLog' && log.specialAttackType) {
        const key = `expedition.${log.specialAttackType.charAt(0).toLowerCase() + log.specialAttackType.slice(1)}Log`;
        
        const attackerName = <span className="font-bold text-red-400">{log.attacker}</span>;
        const defenderName = log.defender ? <span className="font-bold text-sky-400">{log.defender}</span> : null;
        const specialName = <span className="font-bold text-purple-400">{t(`specialAttacks.${log.specialAttackType}`)}</span>;

        let messageContent: React.ReactNode = t(key, { 
            attacker: log.attacker, 
            defender: log.defender, 
            specialAttack: t(`specialAttacks.${log.specialAttackType}`),
            damage: log.damage // Pass damage if present
        });

        // Override with styled components for specific keys if possible
        if (log.specialAttackType === 'Stun') {
             messageContent = <>{defenderName} {t('expedition.stunLog').replace('{defender}', '')}</>;
        } else if (log.specialAttackType === 'ArmorPierce') {
             messageContent = <>{defenderName} {t('expedition.armorPierceLog').replace('{defender}', '')}</>;
        } else if (log.specialAttackType === 'DeathTouch') {
             // DeathTouch now uses damage value
             const text = t('expedition.deathTouchLog', { damage: log.damage || 0 });
             const parts = text.split('{defender}');
             messageContent = <>{parts[0] ? parts[0] : null}{defenderName}{parts[1] ? parts[1] : null}</>;
        } else if (log.specialAttackType === 'EmpoweredStrikes') {
             messageContent = <>{attackerName} {t('expedition.empoweredStrikesLog').replace('{attacker}', '')}</>;
        } else if (log.specialAttackType === 'Earthquake') {
             messageContent = <>{attackerName} {t('expedition.earthquakeLog').replace('{attacker}', '')}</>;
        } else {
             // Fallback generic
             messageContent = <>{attackerName} używa {specialName}!</>;
        }

        return (
            <div className="text-center my-2 py-2 bg-purple-900/20 rounded border border-purple-500/30">
                <p className="font-bold text-sm text-purple-300">
                    <span className="font-mono text-gray-500 mr-2 text-xs">Tura {log.turn}:</span>
                    {messageContent}
                </p>
                {/* Render AoE damage details if present */}
                {log.aoeDamage && log.aoeDamage.length > 0 && (
                    <div className="mt-1 text-xs text-purple-200/80 space-y-0.5">
                        {log.aoeDamage.map((hit, idx) => (
                            <p key={idx} className="flex justify-center gap-2">
                                <span className="text-sky-300 font-semibold">{hit.target}:</span>
                                <span className="font-mono text-red-400">-{hit.damage} HP</span>
                            </p>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    
    // Obsługa okrzyku bossa
    if (log.action === 'boss_shout' && log.shout) {
        return (
            <div className="text-center my-4">
                <div className="inline-block bg-slate-900/80 px-4 py-2 rounded-xl border border-amber-600/50 relative">
                    <p className="font-bold text-amber-500 text-sm uppercase tracking-wide mb-1">{log.attacker}</p>
                    <p className="text-white italic font-serif text-lg">"{t(`bossShouts.${log.shout}`)}"</p>
                    {/* Tiny triangle for speech bubble effect */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-600/50"></div>
                </div>
            </div>
        );
    }
    
    if (log.action === 'effectApplied') {
        let effectText: React.ReactNode = '';
        let textColor = 'text-yellow-400 italic';
        let detailList: React.ReactNode = null;

        switch (log.effectApplied) {
            case 'burning':
                const defenderNode = renderName(log.defender);
                const effectStr = t('expedition.combatLog.effect.burning');
                const template = t('expedition.combatLog.effect.applied').replace('{effect}', effectStr);
                const parts = template.split('{defender}');
                effectText = <>{parts[0]}{defenderNode}{parts[1]}</>;
                textColor = 'text-orange-500 italic';
                break;
            case 'burningTarget':
                const targetNode = renderName(log.defender);
                const template2 = t('expedition.combatLog.effect.burningTarget').replace('{damage}', String(log.damage));
                const parts2 = template2.split('{target}');
                effectText = <>{parts2[0]}{targetNode}{parts2[1]}</>;
                textColor = 'text-orange-400 italic';
                break;
            case 'frozen_no_attack':
                const attackerNode = renderName(log.attacker);
                const template3 = t('expedition.combatLog.effect.frozen_no_attack');
                const parts3 = template3.split('{target}');
                effectText = <>{parts3[0]}{attackerNode}{parts3[1]}</>;
                textColor = 'text-cyan-400 italic';
                break;
            case 'frozen':
                const defenderNodeFreeze = renderName(log.defender);
                const effectStrFreeze = t('expedition.combatLog.effect.frozen');
                const templateFreeze = t('expedition.combatLog.effect.applied').replace('{effect}', effectStrFreeze);
                const partsFreeze = templateFreeze.split('{defender}');
                effectText = <>{partsFreeze[0]}{defenderNodeFreeze}{partsFreeze[1]}</>;
                textColor = 'text-cyan-400 italic';
                break;
            case 'frozen_no_dodge':
                const defenderNode4 = renderName(log.defender);
                const effectStr4 = t('expedition.combatLog.effect.frozen_no_dodge');
                const template4 = t('expedition.combatLog.effect.applied').replace('{effect}', effectStr4);
                const parts4 = template4.split('{defender}');
                effectText = <>{parts4[0]}{defenderNode4}{parts4[1]}</>;
                textColor = 'text-cyan-500 italic';
                break;
            case 'reduced_attacks':
                const targetNode5 = renderName(log.defender);
                const template5 = t('expedition.combatLog.effect.reduced_attacks');
                const parts5 = template5.split('{target}');
                effectText = <>{parts5[0]}{targetNode5}{parts5[1]}</>;
                textColor = 'text-gray-400 italic';
                break;
            case 'shadowBoltStack':
                // Uses log.damage field to store stack count
                effectText = t('expedition.combatLog.effect.shadowBoltStack', { stacks: log.damage || 1 });
                textColor = 'text-purple-400 italic';
                break;
            case 'arcaneMissileBonus':
                effectText = t('expedition.combatLog.effect.arcaneMissileBonus', { damage: log.damage });
                textColor = 'text-pink-400 italic';
                break;
            case 'chainLightningJump':
            case 'earthquakeSplash':
            case 'meteorSwarmSplash':
                if (log.effectApplied === 'chainLightningJump') {
                    effectText = t('expedition.combatLog.effect.chainLightningJump');
                    textColor = 'text-blue-400 italic font-bold';
                } else if (log.effectApplied === 'earthquakeSplash') {
                    // Use literal strings instead of MagicAttackType enum to prevent crashes in render
                    effectText = t('item.magic.Earthquake'); 
                    textColor = 'text-yellow-600 italic font-bold';
                } else {
                    effectText = t('item.magic.MeteorSwarm');
                    textColor = 'text-orange-600 italic font-bold';
                }

                if (log.aoeDamage && log.aoeDamage.length > 0) {
                    detailList = (
                        <div className="ml-6 mt-1 space-y-0.5">
                            {log.aoeDamage.map((hit, idx) => (
                                <p key={idx} className="text-xs">
                                    <span className="text-gray-400">↳</span> <span className="font-semibold text-gray-300">{hit.target}</span>: <span className="font-mono text-red-400">-{hit.damage} HP</span>
                                </p>
                            ))}
                        </div>
                    );
                }
                break;
            default:
                effectText = `${log.attacker} applies ${log.effectApplied} to ${log.defender}`;
        }
        return (
            <div className={`text-sm ${textColor}`}>
                <p>
                    <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                    {effectText}
                </p>
                {detailList}
            </div>
        );
    }

    if (log.action === 'starts a fight with') {
        return (
            <div className="text-center my-3 py-2 border-y border-slate-700/50">
                <p className="font-bold text-lg text-gray-300">
                    {renderName(log.attacker)}
                    <span className="text-gray-400 mx-2">{t('expedition.versus')}</span>
                    {renderName(log.defender)}
                </p>
            </div>
        )
    }
    
    if (log.action === 'all_enemies_defeated') {
        return (
            <div className="text-center my-2 py-1 bg-green-900/20 rounded border border-green-900/50">
                <p className="font-bold text-sm text-green-400">
                    Wszyscy przeciwnicy pokonani!
                </p>
            </div>
        );
    }
    
    if (log.action === 'enemy_death') {
        return (
            <div className="text-center my-2 py-1 bg-red-900/20 rounded border border-red-900/50">
                <p className="font-bold text-sm text-red-400">
                    {log.defender} został pokonany!
                </p>
            </div>
        );
    }
    
    if (log.action === 'death') {
        return (
             <div className="text-center my-2 py-1 bg-red-900/20 rounded border border-red-900/50">
                <p className="font-bold text-sm text-red-500">
                    Gracz {renderName(log.defender)} poległ od ciosu przeciwnika {renderName(log.attacker)}!
                </p>
            </div>
        );
    }

    if (log.action === 'shaman_power') {
        return (
            <p className="text-sm text-purple-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)}
                <span> {t('expedition.shamanPower')} </span>
                {renderName(log.defender)}
                <span> {t('expedition.dealing')} </span>
                <span className="font-bold text-white">{log.damage}</span>
                <span> {t('expedition.damage')}.</span>
            </p>
        );
    }

    if (log.action === 'manaRegen') {
        return (
             <p className="text-sm text-cyan-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)}
                <span> {t('expedition.manaGained')} </span>
                <span className="font-bold text-white">+{log.manaGained?.toFixed(0)}</span>
                <span> {t('expedition.manaPoints')}.</span>
            </p>
        );
    }
    
    if (log.action === 'orc_fury') {
        const text = t('expedition.orcFuryLog').replace('{attacker}', '');
        return (
             <p className="text-sm text-red-500 font-bold italic animate-pulse">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)} {text}
            </p>
        );
    }

    if (log.action === 'berserker_frenzy') {
        const text = t('expedition.berserkerFrenzyLog').replace('{attacker}', '');
        return (
             <p className="text-sm text-orange-500 font-bold italic animate-pulse">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)} {text}
            </p>
        );
    }
    
    if (log.action === 'notEnoughMana') {
         return (
             <p className="text-sm text-amber-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                <span>{t('expedition.notEnoughMana')}</span>
            </p>
         );
    }

    if (log.isDodge) {
        return (
            <p className="text-sm text-green-400 italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.defender)}
                <span> {t('expedition.dodge')} </span>
                {renderName(log.attacker)}
                <span>!</span>
            </p>
        );
    }

    const critText = log.isCrit ? <span className="font-bold text-amber-400">{t('expedition.critical')}</span> : '';
    const damageReducedText = log.damageReduced ? <span className="text-xs text-green-500 ml-1">{t('expedition.damageReduced', { amount: log.damageReduced })}</span> : '';
    
    const attackVerb = log.magicAttackType 
        ? <>{t('expedition.casts')} <span className="font-bold text-purple-400">{t(`item.magic.${log.magicAttackType}`)}</span> {log.manaSpent ? <span className="text-cyan-400 text-xs ml-1">{t('expedition.forMana', { amount: log.manaSpent })}</span> : null} {t('expedition.on')}</>
        : t('expedition.attacks');
        
    const stealText = [];
    if ((log.action === 'attacks' || log.action === 'magicAttack') && log.healthGained && log.healthGained > 0) {
        stealText.push(<span key="heal"> {t('expedition.healed')} <span className="font-bold text-green-400">{log.healthGained.toFixed(0)}</span> {t('expedition.healthPoints')}</span>);
    }
    if (log.action === 'attacks' && log.manaGained && log.manaGained > 0) {
        stealText.push(<span key="mana"> {t('expedition.manaStolen')} <span className="font-bold text-cyan-400">{log.manaGained.toFixed(0)}</span> {t('expedition.manaPoints')}</span>);
    }

    if (log.bonusDamage) {
        return (
            <p className={`text-sm text-gray-300`}>
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)}
                <span> {attackVerb} </span>
                {log.weaponName && <span className="text-gray-500 mx-1">({log.weaponName})</span>}
                {renderName(log.defender)}
                <span> {t('expedition.dealing')} </span>
                <span className="font-bold text-white">{log.damage}</span>
                <span className="text-xs ml-1 text-gray-400">({(log.damage || 0) - log.bonusDamage} + <span className="text-pink-400 font-bold">{log.bonusDamage}</span>)</span>
                <span> {t('expedition.damage')}. {critText} {damageReducedText}</span>
                {stealText}
            </p>
        );
    }

    return (
        <p className={`text-sm text-gray-300`}>
            <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
            {renderName(log.attacker)}
            <span> {attackVerb} </span>
            {log.weaponName && <span className="text-gray-500 mx-1">({log.weaponName})</span>}
            {renderName(log.defender)}
            <span> {t('expedition.dealing')} </span>
            <span className="font-bold text-white">{log.damage}</span>
            <span> {t('expedition.damage')}. {critText} {damageReducedText}</span>
            {stealText}
        </p>
    );
};

const EnemyListPanel: React.FC<{
    enemies: Enemy[];
    currentEnemiesHealth: { uniqueId: string; name: string; currentHealth: number; maxHealth: number }[] | undefined;
    onEnemyHover: (enemy: Enemy, rect: DOMRect) => void;
    onEnemyLeave: () => void;
}> = ({ enemies, currentEnemiesHealth, onEnemyHover, onEnemyLeave }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-red-500/50 h-full overflow-y-auto">
             <h4 className="font-bold text-xl text-center border-b border-red-500/50 pb-2 mb-2 text-red-400">
                Wrogowie
            </h4>
            <div className="space-y-3">
                {enemies.map(enemy => {
                    const healthData = currentEnemiesHealth?.find(h => h.uniqueId === enemy.uniqueId);
                    const currentHealth = healthData?.currentHealth ?? enemy.stats.maxHealth;
                    const maxHealth = healthData?.maxHealth ?? enemy.stats.maxHealth;
                    const hpPercent = (currentHealth / maxHealth) * 100;
                    const isDead = currentHealth <= 0;
                    const enemyName = healthData?.name || enemy.name; // Use numbered name from log

                    return (
                        <div 
                            key={enemy.uniqueId} 
                            className={`p-2 rounded bg-slate-800 ${isDead ? 'opacity-50' : ''}`}
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


const CombatantStatsPanel: React.FC<{
  name: string;
  description?: string;
  stats: CharacterStats | EnemyStats | null;
  currentHealth?: number;
  currentMana?: number;
}> = ({ name, description, stats, currentHealth, currentMana }) => {
  const { t } = useTranslation();
  if (!stats) {
    return <div className="w-full bg-slate-900/50 p-4 rounded-lg border border-transparent h-full"></div>;
  }

  const isPlayer = 'strength' in stats;
  const borderColor = isPlayer ? 'border-sky-500/50' : 'border-red-500/50';
  const textColor = isPlayer ? 'text-sky-400' : 'text-red-400';

  const hpDisplay = currentHealth !== undefined ? `${currentHealth.toFixed(0)} / ${stats.maxHealth}` : stats.maxHealth;
  const manaDisplay = stats.maxMana !== undefined && stats.maxMana > 0
    ? (currentMana !== undefined ? `${currentMana.toFixed(0)} / ${stats.maxMana}` : stats.maxMana)
    : null;

  const magicDamageDisplay = (stats.magicDamageMin !== undefined && stats.magicDamageMin > 0) || (stats.magicDamageMax !== undefined && stats.magicDamageMax > 0)
    ? `${stats.magicDamageMin || 0} - ${stats.magicDamageMax || 0}`
    : null;

  const manaRegenDisplay = stats.manaRegen !== undefined && stats.manaRegen > 0 ? stats.manaRegen : null;


  return (
    <div className={`bg-slate-900/50 p-4 rounded-lg border ${borderColor} h-full`}>
      <h4 className={`font-bold text-xl text-center border-b pb-2 mb-2 ${borderColor} ${textColor}`}>
        {name}
      </h4>
      {description && <p className="text-xs italic text-gray-400 mb-2 text-center">{description}</p>}
      <div className="text-left text-sm space-y-1 text-gray-300">
        <p className="flex justify-between"><strong>HP:</strong> <span>{hpDisplay}</span></p>
        {manaDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.mana')}:</strong> <span>{manaDisplay}</span></p>
        )}
        {manaRegenDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.manaRegen')}:</strong> <span>{manaRegenDisplay}</span></p>
        )}
        <div className="border-t border-slate-700/50 my-2"></div>
        
        {isPlayer && (
            <>
                <p className="flex justify-between"><strong>{t('statistics.strength')}:</strong> <span>{(stats as CharacterStats).strength}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.accuracy')}:</strong> <span>{(stats as CharacterStats).accuracy}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.stamina')}:</strong> <span>{(stats as CharacterStats).stamina}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.intelligence')}:</strong> <span>{(stats as CharacterStats).intelligence}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.energy')}:</strong> <span>{(stats as CharacterStats).energy}</span></p>
            </>
        )}
        
        <p className="flex justify-between"><strong>{t('statistics.agility')}:</strong> <span>{stats.agility}</span></p>
        
        <div className="border-t border-slate-700/50 my-2"></div>
        
        <p className="flex justify-between"><strong>{isPlayer ? t('statistics.physicalDamage') : t('statistics.damage')}:</strong> <span>{stats.minDamage} - {stats.maxDamage}</span></p>
        {magicDamageDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.magicDamage')}:</strong> <span>{magicDamageDisplay}</span></p>
        )}

        <p className="flex justify-between">
            <strong>{t('statistics.attacksPerTurn')}:</strong> 
            <span>
                {isPlayer 
                    ? (stats as CharacterStats).attacksPerRound 
                    : ((stats as EnemyStats).attacksPerTurn || 1)
                }
            </span>
        </p>

        <p className="flex justify-between"><strong>{t('statistics.armor')}:</strong> <span>{stats.armor}</span></p>
        <p className="flex justify-between"><strong>{t('statistics.critChance')}:</strong> <span>{stats.critChance.toFixed(1)}%</span></p>
        {isPlayer && 'critDamageModifier' in stats && (
             <p className="flex justify-between"><strong>{t('statistics.critDamageModifier')}:</strong> <span>{(stats as CharacterStats).critDamageModifier}%</span></p>
        )}
      </div>
    </div>
  );
};

const PartyMemberList: React.FC<{ 
    members: PartyMember[]; 
    currentTurnActor?: string;
    onMemberHover: (member: PartyMember, rect: DOMRect) => void;
    onMemberLeave: () => void;
}> = ({ members, currentTurnActor, onMemberHover, onMemberLeave }) => {
    const { t } = useTranslation();
    
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-sky-500/50 h-full overflow-y-auto overflow-visible">
             <h4 className="font-bold text-xl text-center border-b border-sky-500/50 pb-2 mb-2 text-sky-400">
                {t('hunting.members')}
            </h4>
            <div className="space-y-2">
                {members.map((member, idx) => {
                    const isActive = member.characterName === currentTurnActor;
                    const currentHP = member.stats?.currentHealth ?? 0;
                    const maxHP = member.stats?.maxHealth ?? 1;
                    const hpPercent = Math.min(100, Math.max(0, (currentHP / maxHP) * 100));

                    return (
                        <div 
                            key={idx} 
                            className={`p-2 rounded bg-slate-800 relative group ${isActive ? 'ring-2 ring-sky-500' : ''}`}
                            onMouseEnter={(e) => onMemberHover(member, e.currentTarget.getBoundingClientRect())}
                            onMouseLeave={onMemberLeave}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-sm">{member.characterName}</span>
                                <span className="text-xs text-gray-400">Lvl {member.level}</span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-1.5 transition-all" style={{width: `${hpPercent}%`}}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
};

export interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    isPvp?: boolean;
    pvpData?: {
        attacker: PlayerCharacter;
        defender: PlayerCharacter;
    };
    isDefenderView?: boolean;
    // New Props for Hunting
    isHunting?: boolean;
    huntingMembers?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number }>;
    initialEnemy?: Enemy;
    bossName?: string;
    messageId?: number | null;
    encounteredEnemies?: Enemy[];
    backgroundImage?: string; // New Prop for Background Image
}

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = ({ 
    reward, 
    onClose, 
    characterName, 
    itemTemplates,
    affixes,
    isPvp = false,
    pvpData,
    isDefenderView = false,
    isHunting = false,
    huntingMembers = [],
    allRewards,
    initialEnemy,
    bossName,
    messageId,
    backgroundImage
}) => {
    const { t } = useTranslation();
    const [displayedLogs, setDisplayedLogs] = useState<CombatLogEntry[]>([]);
    const [isAnimationComplete, setIsAnimationComplete] = useState(false);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [copyStatus, setCopyStatus] = useState('');
    
    const [currentPlayerStats, setCurrentPlayerStats] = useState<CharacterStats | null>(null);
    const [partyMembersState, setPartyMembersState] = useState<PartyMember[]>([]);

    const [currentEnemy, setCurrentEnemy] = useState<{name: string, description?: string, stats: EnemyStats | CharacterStats, currentHealth: number, currentMana: number} | null>(() => {
        const startLog = reward.combatLog && reward.combatLog.length > 0 ? reward.combatLog[0] : null;

        if (initialEnemy) {
             const effectiveStats = (startLog && startLog.enemyStats) ? startLog.enemyStats : initialEnemy.stats;

             return {
                 name: initialEnemy.name,
                 description: initialEnemy.description,
                 stats: effectiveStats,
                 currentHealth: startLog ? startLog.enemyHealth : initialEnemy.stats.maxHealth,
                 currentMana: startLog ? startLog.enemyMana : (initialEnemy.stats.maxMana || 0)
             };
        }
        return null;
    });

    useEffect(() => {
        if (isHunting && huntingMembers.length > 0) {
            // 1. Try getting explicit snapshot from start log
            const startLog = reward.combatLog?.find(l => l.action === 'starts a fight with');
            
            if (startLog && startLog.partyMemberStats) {
                 setPartyMembersState(huntingMembers.map(member => ({
                    ...member,
                    stats: startLog.partyMemberStats![member.characterName] || member.stats
                })));
            } else {
                // 2. Fallback: Scrape logs if stats are missing (legacy support)
                if (!huntingMembers[0].stats) {
                    const statsMap = new Map<string, CharacterStats>();
                    for (const log of reward.combatLog) {
                        if (log.playerStats && log.attacker && !statsMap.has(log.attacker)) {
                            statsMap.set(log.attacker, log.playerStats);
                        }
                    }
                    setPartyMembersState(huntingMembers.map(member => ({
                        ...member,
                        stats: statsMap.get(member.characterName)
                    })));
                } else {
                    setPartyMembersState(huntingMembers);
                }
            }
        } else {
            setPartyMembersState(huntingMembers);
        }
    }, [isHunting, huntingMembers, reward.combatLog]);

    const animationTimerRef = useRef<number | null>(null);
    const [tooltipData, setTooltipData] = useState<{ item: ItemInstance, template: ItemTemplate } | null>(null);
    const tooltipTimeoutRef = useRef<number | null>(null);
    
    const [hoveredMember, setHoveredMember] = useState<{ data: PartyMember, rect: DOMRect } | null>(null);
    const [hoveredEnemy, setHoveredEnemy] = useState<{ data: Enemy, rect: DOMRect } | null>(null);

    const handleCopyLink = () => {
        if (!messageId) return;
        const url = `${window.location.origin}/report/${messageId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopyStatus('Skopiowano link!');
            setTimeout(() => setCopyStatus(''), 2000);
        }, (err) => {
            setCopyStatus('Błąd kopiowania');
            console.error('Could not copy text: ', err);
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };

    const handleItemMouseEnter = (itemInstance: ItemInstance) => {
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        const template = itemTemplates.find(t => t.id === itemInstance.templateId);
        if (template) {
            setTooltipData({ item: itemInstance, template });
        }
    };

    const handleItemMouseLeave = () => {
        tooltipTimeoutRef.current = window.setTimeout(() => {
            setTooltipData(null);
        }, 200);
    };
    
    const finalVictoryStatus = isDefenderView ? !reward.isVictory : reward.isVictory;

    const updateCombatantState = (log: CombatLogEntry) => {
         if (isHunting) {
             setPartyMembersState(prev => prev.map(m => {
                 // Use allPlayersHealth snapshot from log if available for accurate team state at this turn
                 if (log.allPlayersHealth) {
                     const snapshot = log.allPlayersHealth.find(p => p.name === m.characterName);
                     if (snapshot && m.stats) {
                         return { ...m, stats: { ...m.stats, currentHealth: snapshot.currentHealth } };
                     }
                 }
                 
                 // Fallback to direct log values (less reliable for multi-actor turns)
                 if (m.stats && (m.characterName === log.attacker || m.characterName === log.defender)) {
                      return { ...m, stats: { ...m.stats, currentHealth: log.playerHealth, currentMana: log.playerMana } };
                 }
                 return m;
             }));
             
             // Update Boss State from log
             if (currentEnemy) {
                 setCurrentEnemy(prev => prev ? { ...prev, currentHealth: log.enemyHealth, currentMana: log.enemyMana } : null);
             }

         } else {
             if (isPvp && pvpData) {
                 setCurrentPlayerStats({ ...pvpData.attacker.stats, currentHealth: log.playerHealth, currentMana: log.playerMana });
                 setCurrentEnemy({ name: pvpData.defender.name, stats: pvpData.defender.stats, currentHealth: log.enemyHealth, currentMana: log.enemyMana });
             } else {
                 setCurrentPlayerStats(prev => {
                    if (log.playerStats) {
                        return { ...log.playerStats, currentHealth: log.playerHealth, currentMana: log.playerMana };
                    }
                    if (prev) {
                        return { ...prev, currentHealth: log.playerHealth, currentMana: log.playerMana };
                    }
                    return null;
                 });

                 if (!currentEnemy && log.enemyStats && (reward.encounteredEnemies || []).length <= 1) {
                      setCurrentEnemy({
                        name: log.defender,
                        description: log.enemyDescription,
                        stats: log.enemyStats,
                        currentHealth: log.enemyHealth,
                        currentMana: log.enemyMana,
                    });
                 } else if (currentEnemy) {
                     setCurrentEnemy(prev => prev ? { ...prev, currentHealth: log.enemyHealth, currentMana: log.enemyMana } : null);
                 }
             }
         }
    };

    const handleSkipAnimation = () => {
        if (animationTimerRef.current) {
            clearTimeout(animationTimerRef.current);
        }
        setDisplayedLogs(reward.combatLog);
        const lastLog = reward.combatLog[reward.combatLog.length - 1];
        if (lastLog) updateCombatantState(lastLog);
        setIsAnimationComplete(true);
    };

    useEffect(() => {
        if (!reward.combatLog || reward.combatLog.length === 0) {
            setIsAnimationComplete(true);
            return;
        }

        const playAnimation = () => {
             if (displayedLogs.length < reward.combatLog.length) {
                const nextLog = reward.combatLog[displayedLogs.length];
                updateCombatantState(nextLog);
                setDisplayedLogs(prev => [...prev, nextLog]);
                
                animationTimerRef.current = window.setTimeout(playAnimation, isHunting ? 500 : 800);
            } else {
                setIsAnimationComplete(true);
            }
        };

        if (!isAnimationComplete && !animationTimerRef.current) {
             playAnimation();
        }

        return () => {
            if(animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
                animationTimerRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayedLogs.length, reward.combatLog.length, isAnimationComplete]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [displayedLogs]);

    // Calculate Damage Stats when logs are fully loaded or during animation (if needed incrementally, but simpler to compute once)
    const damageStats = useMemo(() => {
        if (!reward.combatLog) return [];

        const damageMap: Record<string, number> = {};
        let totalPartyDamage = 0;

        // Determine which names belong to the "party" (players)
        // In Hunting: use huntingMembers list.
        // In Solo/PVP: use attacker name (for PvP assume current player view or attacker view)
        const playerNames = new Set<string>();
        if (isHunting && huntingMembers) {
            huntingMembers.forEach(m => playerNames.add(m.characterName));
        } else {
            // For solo expeditions or PVP attacker view
            playerNames.add(characterName);
        }

        reward.combatLog.forEach(log => {
            // Count damage if attacker is a player.
            // Also include 'specialAttackLog' if players can trigger them (not usually, but future proof)
            // 'shaman_power' is also player damage.
            if (playerNames.has(log.attacker) && (log.damage || 0) > 0) {
                const dmg = log.damage || 0;
                // Note: bonusDamage is usually included in total damage in the log generation, 
                // but if structure implies separation, check core.ts. 
                // In core.ts: totalDamage = damage + bonusDamage. So log.damage is the Total.
                
                damageMap[log.attacker] = (damageMap[log.attacker] || 0) + dmg;
                totalPartyDamage += dmg;
            }
        });

        return Object.entries(damageMap)
            .map(([name, dmg]) => ({
                name,
                damage: dmg,
                percent: totalPartyDamage > 0 ? (dmg / totalPartyDamage) * 100 : 0
            }))
            .sort((a, b) => b.damage - a.damage);
    }, [reward.combatLog, isHunting, huntingMembers, characterName]);

    const combatant1Name = isPvp && pvpData ? pvpData.attacker.name : characterName;
    const combatant2Name = isPvp && pvpData ? pvpData.defender.name : (currentEnemy?.name || (isHunting ? 'Boss' : ''));
    
    const encounteredEnemies = reward.encounteredEnemies || [];
    const latestLog = displayedLogs.length > 0 ? displayedLogs[displayedLogs.length - 1] : null;
    const currentEnemiesHealth = latestLog?.allEnemiesHealth;

    const currentActor = displayedLogs.length > 0 ? displayedLogs[displayedLogs.length - 1].attacker : '';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div 
                className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-7xl w-full flex flex-col" 
                style={{
                    maxHeight: '90vh',
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                }}
            >
                <div className="relative mb-6 flex-shrink-0">
                    <h2 className="text-3xl font-bold text-indigo-400 text-center">
                        {isPvp ? t('pvp.duelResult') : t('expedition.combatReport')}
                    </h2>
                    {!isAnimationComplete && (
                        <button
                            onClick={handleSkipAnimation}
                            className="absolute top-1/2 -translate-y-1/2 right-0 px-4 py-2 text-sm rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors"
                        >
                            {t('expedition.skipAnimation')}
                        </button>
                    )}
                </div>
                
                <div className="flex-grow overflow-y-auto min-h-0">
                    {reward.combatLog && reward.combatLog.length > 0 ? (
                        <div className="grid grid-cols-[288px_1fr_288px] gap-6 mb-6 min-h-[300px]">
                            <div>
                                {isHunting ? (
                                    <PartyMemberList 
                                        members={partyMembersState} 
                                        currentTurnActor={currentActor} 
                                        onMemberHover={(data, rect) => setHoveredMember({ data, rect })}
                                        onMemberLeave={() => setHoveredMember(null)}
                                    />
                                ) : (
                                    <CombatantStatsPanel 
                                        name={combatant1Name} 
                                        stats={currentPlayerStats} 
                                        currentHealth={currentPlayerStats?.currentHealth}
                                        currentMana={currentPlayerStats?.currentMana}
                                    />
                                )}
                            </div>
                            
                            <div ref={logContainerRef} className="bg-slate-900/50 p-4 rounded-lg overflow-y-auto font-mono">
                                <div className="space-y-1 text-left">
                                    {displayedLogs.map((log, index) => {
                                        const prevLog = index > 0 ? displayedLogs[index - 1] : null;
                                        const isNewTurn = prevLog && log.turn !== prevLog.turn;
                                        return (
                                            <React.Fragment key={index}>
                                                {isNewTurn && <div className="my-2 border-t border-slate-700/50"></div>}
                                                <CombatLogRow 
                                                    log={log} 
                                                    characterName={characterName} 
                                                    isHunting={isHunting} 
                                                    huntingMembers={huntingMembers}
                                                />
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div>
                                {encounteredEnemies.length > 1 && !isHunting ? (
                                     <EnemyListPanel 
                                        enemies={encounteredEnemies} 
                                        currentEnemiesHealth={currentEnemiesHealth} 
                                        onEnemyHover={(data, rect) => setHoveredEnemy({ data, rect })}
                                        onEnemyLeave={() => setHoveredEnemy(null)}
                                    />
                                ) : (
                                    <CombatantStatsPanel 
                                        name={combatant2Name}
                                        description={isPvp ? undefined : currentEnemy?.description}
                                        stats={currentEnemy?.stats || null}
                                        currentHealth={currentEnemy?.currentHealth}
                                        currentMana={currentEnemy?.currentMana}
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center min-h-[300px] bg-slate-900/50 p-4 rounded-lg mb-6">
                            <p className="text-gray-400 italic">{t('expedition.noEnemiesEncountered')}</p>
                        </div>
                    )}


                    {isAnimationComplete && (
                        <div className="animate-fade-in text-center">
                            <h3 className={`text-2xl font-bold mb-4 ${finalVictoryStatus ? 'text-green-400' : 'text-red-500'}`}>
                                {finalVictoryStatus ? t('expedition.victory') : t('expedition.defeat')}
                            </h3>
                            
                            {isPvp && (
                                <div className="bg-slate-900/50 p-4 rounded-lg mb-6">
                                    <div className="flex justify-center items-center space-x-8 font-bold text-md px-2">
                                        <span className={finalVictoryStatus ? 'text-amber-300' : 'text-red-400'}>
                                            {finalVictoryStatus ? t('pvp.goldStolen', { amount: reward.totalGold }) : t('pvp.goldLost', { amount: reward.totalGold })}
                                        </span>
                                        <span className="text-sky-300">
                                            {finalVictoryStatus ? t('pvp.xpGained', { amount: reward.totalExperience }) : t('pvp.xpLost', { amount: reward.totalExperience })}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!isPvp && reward.isVictory && (
                                <div className="bg-slate-900/50 p-4 rounded-lg mb-6">
                                    {/* Damage Table */}
                                    {isHunting && damageStats.length > 0 && (
                                        <div className="mb-6">
                                            <h4 className="font-bold text-white mb-2 flex items-center justify-center gap-2">
                                                <SwordsIcon className="h-4 w-4 text-red-400" />
                                                Zadane Obrażenia (DPS)
                                            </h4>
                                            <div className="bg-slate-800/80 rounded-lg overflow-hidden border border-slate-700/50">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-gray-400 bg-slate-800 uppercase">
                                                        <tr>
                                                            <th className="px-3 py-2">Gracz</th>
                                                            <th className="px-3 py-2 text-right">Obrażenia</th>
                                                            <th className="px-3 py-2 text-right w-32">%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-700/50">
                                                        {damageStats.map((stat, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-700/30">
                                                                <td className="px-3 py-2 font-medium text-white">
                                                                    {stat.name}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono text-red-300">
                                                                    {stat.damage.toLocaleString()}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <span className="text-xs text-gray-400 w-8">{stat.percent.toFixed(1)}%</span>
                                                                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                                            <div 
                                                                                className="h-full bg-red-500 transition-all duration-500" 
                                                                                style={{ width: `${stat.percent}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {isHunting && allRewards && (
                                        <div className="mb-4">
                                            <h4 className="font-bold text-white mb-2">Nagrody Drużynowe</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-gray-400 bg-slate-800">
                                                        <tr>
                                                            <th className="px-3 py-2">Gracz</th>
                                                            <th className="px-3 py-2 text-right">Złoto</th>
                                                            <th className="px-3 py-2 text-right">Doświadczenie</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(allRewards).map(([name, rew], idx) => (
                                                            <tr key={idx} className="border-b border-slate-700/50">
                                                                <td className="px-3 py-2 font-medium text-white">{name}</td>
                                                                <td className="px-3 py-2 text-right text-amber-400">{rew.gold}</td>
                                                                <td className="px-3 py-2 text-right text-sky-400">{rew.experience}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="border-t border-slate-700 my-3"></div>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-center font-bold text-md px-2">
                                        <span className="text-white">{t('expedition.totalRewards')} (Ty)</span>
                                        <div className="flex items-center space-x-4 font-mono">
                                            <span className="text-amber-300 flex items-center gap-1">
                                                <CoinsIcon className="h-5 w-5" /> +{reward.totalGold}
                                            </span>
                                            <span className="text-sky-300 flex items-center gap-1">
                                                <StarIcon className="h-5 w-5" /> +{reward.totalExperience}
                                            </span>
                                        </div>
                                    </div>
                                    {reward.itemsFound.length > 0 && (
                                        <div className="border-t border-slate-700 my-3 pt-3">
                                            <h4 className="font-bold text-md text-white mb-2">{t('expedition.itemsFound')}:</h4>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {reward.itemsFound.map(itemInstance => {
                                                    const template = itemTemplates.find(t => t.id === itemInstance.templateId);
                                                    if (!template) return null;
                                                    const colorClass = rarityStyles[template.rarity]?.text || 'text-gray-300';
                                                    const fullName = getGrammaticallyCorrectFullName(itemInstance, template, affixes);
                                                    return (
                                                        <div 
                                                            key={itemInstance.uniqueId}
                                                            onMouseEnter={() => handleItemMouseEnter(itemInstance)}
                                                            onMouseLeave={handleItemMouseLeave}
                                                        >
                                                            <span className={`bg-slate-800/60 px-2 py-1 rounded text-sm font-semibold cursor-help ${colorClass}`}>
                                                                {fullName}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {reward.itemsLostCount && reward.itemsLostCount > 0 && (
                                        <p className="text-sm italic text-red-400 mt-2">
                                            {t('expedition.itemsLost', { count: reward.itemsLostCount })}
                                        </p>
                                    )}
                                    {Object.keys(reward.essencesFound).length > 0 && (
                                        <div className="border-t border-slate-700 my-3 pt-3">
                                            <h4 className="font-bold text-md text-white mb-2">{t('expedition.essencesFound')}:</h4>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {Object.entries(reward.essencesFound).map(([essenceType, amount]) => (
                                                    <span key={essenceType} className="bg-slate-800/60 px-2 py-1 rounded text-sm font-semibold">
                                                    {amount}x {t(`resources.${essenceType}`)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 mt-4 flex-shrink-0">
                    <button
                        onClick={async () => {
                            onClose();
                        }}
                        disabled={!isAnimationComplete}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-indigo-700 transition-colors duration-200 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        {isAnimationComplete ? (finalVictoryStatus ? t('expedition.excellent') : t('expedition.returnToCamp')) : t('expedition.combatInProgress')}
                    </button>
                     {isAnimationComplete && messageId && (
                        <button onClick={handleCopyLink} className="flex-shrink-0 px-4 py-3 rounded-lg bg-slate-600 hover:bg-slate-500 font-semibold text-sm">
                            {copyStatus || 'Kopiuj Link'}
                        </button>
                    )}
                </div>
            </div>
            
            {hoveredMember && hoveredMember.data && (
                <div 
                    className="fixed z-[70] p-3 bg-slate-900 border border-slate-700 rounded shadow-xl pointer-events-none animate-fade-in w-64"
                    style={{
                        top: Math.max(10, hoveredMember.rect.top),
                        left: hoveredMember.rect.right + 10
                    }}
                >
                     <p className="font-bold border-b border-slate-700 pb-1 mb-2 text-white text-center">{hoveredMember.data.characterName}</p>
                     <div className="space-y-1 text-xs text-gray-300">
                        <p className="flex justify-between"><span>HP:</span> <span className="font-mono text-white">{hoveredMember.data.stats?.currentHealth?.toFixed(0) || 0} / {hoveredMember.data.stats?.maxHealth || 1}</span></p>
                        <p className="flex justify-between"><span>Mana:</span> <span className="font-mono text-white">{hoveredMember.data.stats?.currentMana?.toFixed(0) || 0} / {hoveredMember.data.stats?.maxMana || 0}</span></p>
                        <div className="border-t border-slate-700/50 my-1"></div>
                        <p className="flex justify-between"><span>{t('statistics.strength')}:</span> <span>{hoveredMember.data.stats?.strength || 0}</span></p>
                        <p className="flex justify-between"><span>{t('statistics.agility')}:</span> <span>{hoveredMember.data.stats?.agility || 0}</span></p>
                        <p className="flex justify-between"><span>{t('statistics.accuracy')}:</span> <span>{hoveredMember.data.stats?.accuracy || 0}</span></p>
                         <p className="flex justify-between"><span>{t('statistics.stamina')}:</span> <span>{hoveredMember.data.stats?.stamina || 0}</span></p>
                        <p className="flex justify-between"><span>{t('statistics.intelligence')}:</span> <span>{hoveredMember.data.stats?.intelligence || 0}</span></p>
                        <div className="border-t border-slate-700/50 my-1"></div>
                        <p className="flex justify-between"><span>Fiz. DMG:</span> <span className="font-mono">{hoveredMember.data.stats?.minDamage || 0}-{hoveredMember.data.stats?.maxDamage || 0}</span></p>
                        {((hoveredMember.data.stats?.magicDamageMin || 0) > 0 || (hoveredMember.data.stats?.magicDamageMax || 0) > 0) && (
                             <p className="flex justify-between text-purple-300"><span>Mag. DMG:</span> <span className="font-mono">{hoveredMember.data.stats?.magicDamageMin || 0}-{hoveredMember.data.stats?.magicDamageMax || 0}</span></p>
                        )}
                        <p className="flex justify-between"><span>Pancerz:</span> <span>{hoveredMember.data.stats?.armor || 0}</span></p>
                        <p className="flex justify-between"><span>Kryt:</span> <span>{(hoveredMember.data.stats?.critChance || 0).toFixed(1)}% (x{hoveredMember.data.stats?.critDamageModifier || 200}%)</span></p>
                         <p className="flex justify-between"><span>Unik:</span> <span>{(hoveredMember.data.stats?.dodgeChance || 0).toFixed(1)}%</span></p>
                        <p className="flex justify-between"><span>Ataki/tura:</span> <span>{hoveredMember.data.stats?.attacksPerRound || 1}</span></p>
                        {(hoveredMember.data.stats?.lifeStealPercent || 0) > 0 && <p className="flex justify-between text-green-400"><span>Kradzież Życia:</span> <span>{hoveredMember.data.stats?.lifeStealPercent}%</span></p>}
                        {(hoveredMember.data.stats?.manaStealPercent || 0) > 0 && <p className="flex justify-between text-cyan-400"><span>Kradzież Many:</span> <span>{hoveredMember.data.stats?.manaStealPercent}%</span></p>}
                    </div>
                </div>
            )}
            
            {hoveredEnemy && hoveredEnemy.data && (
                <div 
                    className="fixed z-[70] p-3 bg-slate-900 border border-slate-700 rounded shadow-xl pointer-events-none animate-fade-in w-64"
                    style={{
                        top: Math.max(10, hoveredEnemy.rect.top),
                        left: hoveredEnemy.rect.left - 266 // width + padding
                    }}
                >
                     <p className="font-bold border-b border-slate-700 pb-1 mb-2 text-red-400 text-center">{hoveredEnemy.data.name}</p>
                     <div className="space-y-1 text-xs text-gray-300">
                        <p className="flex justify-between"><span>HP:</span> <span className="font-mono text-white">{hoveredEnemy.data.stats.maxHealth}</span></p>
                        {hoveredEnemy.data.stats.maxMana && hoveredEnemy.data.stats.maxMana > 0 && <p className="flex justify-between"><span>Mana:</span> <span className="font-mono text-white">{hoveredEnemy.data.stats.maxMana}</span></p>}
                        <div className="border-t border-slate-700/50 my-1"></div>
                        <p className="flex justify-between"><span>Obrażenia:</span> <span className="font-mono">{hoveredEnemy.data.stats.minDamage}-{hoveredEnemy.data.stats.maxDamage}</span></p>
                        {((hoveredEnemy.data.stats.magicDamageMin || 0) > 0 || (hoveredEnemy.data.stats.magicDamageMax || 0) > 0) && (
                            <p className="flex justify-between text-purple-300">
                                <span>Mag. DMG:</span> 
                                <span className="font-mono">{hoveredEnemy.data.stats.magicDamageMin || 0}-{hoveredEnemy.data.stats.magicDamageMax || 0}</span>
                            </p>
                        )}
                        <p className="flex justify-between"><span>Pancerz:</span> <span>{hoveredEnemy.data.stats.armor}</span></p>
                        <p className="flex justify-between"><span>Kryt:</span> <span>{hoveredEnemy.data.stats.critChance}%</span></p>
                        <p className="flex justify-between"><span>Ataki/tura:</span> <span>{hoveredEnemy.data.stats.attacksPerTurn || 1}</span></p>
                    </div>
                </div>
            )}

            {tooltipData && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
                    onMouseEnter={() => { if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); }}
                    onMouseLeave={handleItemMouseLeave}
                >
                    <div className="w-72 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl p-3 animate-fade-in pointer-events-auto">
                        <ItemDetailsPanel 
                            item={tooltipData.item} 
                            template={tooltipData.template} 
                            affixes={affixes} 
                            size="small" 
                        />
                    </div>
                </div>
            )}
        </div>
    )
};

export const ExpeditionComponent: React.FC<ExpeditionProps> = ({ character, expeditions, enemies, currentLocation, onStartExpedition, itemTemplates, affixes, onCompletion }) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState(0);

    const activeExpedition = character.activeExpedition;
    const currentExpeditionDetails = activeExpedition ? expeditions.find(e => e.id === activeExpedition.expeditionId) : null;

    useEffect(() => {
        if (!activeExpedition) return;

        const updateTimer = () => {
            // Use api.getServerTime() for sync
            const remaining = Math.max(0, Math.floor((activeExpedition.finishTime - api.getServerTime()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                // Check if already completing to prevent double submission
                onCompletion();
            }
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);

        return () => clearInterval(intervalId);
    }, [activeExpedition, onCompletion]);

    // Group expeditions by potential drop rarity for better UI (optional, here just listing all)
    // Filter by current location
    const availableExpeditions = expeditions.filter(e => e.locationIds.includes(currentLocation.id));

    if (activeExpedition && currentExpeditionDetails) {
        return (
            <ContentPanel title={t('expedition.inProgressTitle')}>
                <div className="flex flex-col items-center justify-center space-y-6 py-12">
                    <h3 className="text-3xl font-bold text-amber-400 animate-pulse">
                        {currentExpeditionDetails.name}
                    </h3>
                    {currentExpeditionDetails.image && <img src={currentExpeditionDetails.image} alt={currentExpeditionDetails.name} className="w-64 h-64 object-cover rounded-full border-4 border-slate-700 shadow-2xl" />}
                    <p className="text-lg text-gray-300 italic max-w-md text-center">
                        {currentExpeditionDetails.description}
                    </p>
                    <div className="bg-slate-800/80 p-6 rounded-xl text-center shadow-lg border border-slate-700/50">
                        <p className="text-gray-400 mb-2 uppercase tracking-widest text-xs">{t('expedition.endsIn')}</p>
                        <div className="text-5xl font-mono font-bold text-white tabular-nums">
                            {formatTimeLeft(timeLeft)}
                        </div>
                    </div>
                    {timeLeft <= 0 && (
                        <div className="text-green-400 font-bold text-xl animate-bounce">
                            {t('expedition.finalizing')}
                        </div>
                    )}
                </div>
            </ContentPanel>
        );
    }

    const potentialEnemies = (expedition: ExpeditionType) => {
        // Map enemy IDs to Enemy objects
        const enemyList = (expedition.enemies || []).map(e => enemies.find(en => en.id === e.enemyId)).filter(e => e);
        // Deduplicate
        return Array.from(new Set(enemyList));
    };

    const handleEmbark = (expeditionId: string) => {
        if (character.stats.currentHealth < character.stats.maxHealth * 0.15) {
            if (!window.confirm(t('expedition.lowHealthWarning'))) {
                return;
            }
        }
        onStartExpedition(expeditionId);
    };

    return (
        <ContentPanel title={t('expedition.availableTitle')}>
            {availableExpeditions.length === 0 ? (
                <p className="text-gray-500 italic text-center py-12">{t('expedition.noExpeditions')}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableExpeditions.map(expedition => (
                        <div key={expedition.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 flex flex-col group">
                            <div className="h-32 bg-slate-900 relative overflow-hidden">
                                 {expedition.image ? (
                                     <img src={expedition.image} alt={expedition.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                                 ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-700">
                                        <MapIcon className="w-16 h-16 opacity-20" />
                                    </div>
                                 )}
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900 to-transparent">
                                    <h3 className="text-xl font-bold text-white truncate shadow-black drop-shadow-md">{expedition.name}</h3>
                                </div>
                            </div>
                            
                            <div className="p-4 flex-grow flex flex-col">
                                <p className="text-sm text-gray-400 mb-4 line-clamp-2 min-h-[2.5em]">{expedition.description}</p>
                                
                                <div className="space-y-2 mb-4 text-sm">
                                    <div className="flex justify-between items-center text-amber-400">
                                        <span className="flex items-center"><CoinsIcon className="w-4 h-4 mr-1.5"/> {t('expedition.cost')}:</span>
                                        <span className="font-mono font-bold">{expedition.goldCost}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sky-400">
                                        <span className="flex items-center"><BoltIcon className="w-4 h-4 mr-1.5"/> {t('expedition.cost')}:</span>
                                        <span className="font-mono font-bold">{expedition.energyCost}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-gray-300">
                                        <span className="flex items-center"><ClockIcon className="w-4 h-4 mr-1.5"/> {t('expedition.duration')}:</span>
                                        <span className="font-mono">{formatDuration(expedition.duration)}</span>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-slate-700/50">
                                    <div className="mb-3">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expedition.potentialEnemies')}</p>
                                            <p className="text-[10px] text-gray-400">Ilość: 1-{expedition.maxEnemies || (expedition.enemies || []).length}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {(expedition.enemies || []).length > 0 ? (expedition.enemies || []).slice(0, 3).map((expEnemy, index) => {
                                                const enemyTemplate = enemies.find(e => e.id === expEnemy.enemyId);
                                                if (!enemyTemplate) return null;
                                                return (
                                                    <span key={`${expedition.id}-${index}`} className="text-xs bg-slate-900/50 px-2 py-0.5 rounded text-red-300 border border-red-900/30">
                                                        {enemyTemplate.name} ({expEnemy.spawnChance}%)
                                                    </span>
                                                );
                                            }) : <span className="text-xs text-gray-600">{t('expedition.noEnemies')}</span>}
                                            {(expedition.enemies || []).length > 3 && <span className="text-xs text-gray-500">...</span>}
                                        </div>
                                    </div>
                                    
                                    <div className="mb-4">
                                         <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">{t('expedition.reward')}</p>
                                         <div className="flex gap-3 text-xs font-mono">
                                             <span className="text-amber-300">{expedition.minBaseGoldReward}-{expedition.maxBaseGoldReward} <CoinsIcon className="inline w-3 h-3"/></span>
                                             <span className="text-sky-300">{expedition.minBaseExperienceReward}-{expedition.maxBaseExperienceReward} XP</span>
                                         </div>
                                    </div>

                                    <button
                                        onClick={() => handleEmbark(expedition.id)}
                                        disabled={character.resources.gold < expedition.goldCost || character.stats.currentEnergy < expedition.energyCost}
                                        className={`w-full py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all duration-200 flex items-center justify-center space-x-2
                                            ${character.resources.gold >= expedition.goldCost && character.stats.currentEnergy >= expedition.energyCost
                                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/20' 
                                                : 'bg-slate-700 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        <span>{t('expedition.embark')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ContentPanel>
    );
};