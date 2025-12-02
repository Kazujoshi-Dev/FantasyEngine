import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Expedition as ExpeditionType, Location, Enemy, ExpeditionRewardSummary, CombatLogEntry, CharacterStats, EnemyStats, ItemTemplate, PvpRewardSummary, Affix, ItemInstance, PartyMember, MagicAttackType, EssenceType, ItemRarity } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { BoltIcon } from './icons/BoltIcon';
import { StarIcon } from './icons/StarIcon';
import { ClockIcon } from './icons/ClockIcon';
import { SwordsIcon } from './icons/SwordsIcon';
import { MapIcon } from './icons/MapIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { ItemDetailsPanel, rarityStyles, getGrammaticallyCorrectFullName, ItemListItem } from './shared/ItemSlot';
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
    onCancelExpedition: () => Promise<void>;
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
    finalEnemiesHealth: { uniqueId: string; name: string; currentHealth: number; maxHealth: number }[] | undefined;
    onEnemyHover: (enemy: Enemy, rect: DOMRect) => void;
    onEnemyLeave: () => void;
}> = ({ enemies, finalEnemiesHealth, onEnemyHover, onEnemyLeave }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-red-500/50 h-full overflow-y-auto">
             <h4 className="font-bold text-xl text-center border-b border-red-500/50 pb-2 mb-2 text-red-400">
                Wrogowie
            </h4>
            <div className="space-y-3">
                {enemies.map(enemy => {
                    const healthData = finalEnemiesHealth?.find(h => h.uniqueId === enemy.uniqueId);
                    const currentHealth = healthData?.currentHealth ?? enemy.stats.maxHealth;
                    const maxHealth = healthData?.maxHealth ?? enemy.stats.maxHealth;
                    const hpPercent = (currentHealth / maxHealth) * 100;
                    const isDead = currentHealth <= 0;
                    const enemyName = healthData?.name || enemy.name;

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
    finalPartyHealth: Record<string, { currentHealth: number, maxHealth: number }>;
    onMemberHover: (member: PartyMember, rect: DOMRect) => void;
    onMemberLeave: () => void;
}> = ({ members, finalPartyHealth, onMemberHover, onMemberLeave }) => {
    const { t } = useTranslation();
    
    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-sky-500/50 h-full overflow-y-auto overflow-visible">
             <h4 className="font-bold text-xl text-center border-b border-sky-500/50 pb-2 mb-2 text-sky-400">
                {t('hunting.members')}
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
                            className={`p-2 rounded bg-slate-800 relative group ${isDead ? 'opacity-50' : ''}`}
                            onMouseEnter={(e) => onMemberHover(member, e.currentTarget.getBoundingClientRect())}
                            onMouseLeave={onMemberLeave}
                        >
                            <p className={`font-bold text-sm ${isDead ? 'text-red-500 line-through' : 'text-white'}`}>
                                {member.characterName}
                            </p>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className="bg-red-500 h-1.5 transition-all" style={{width: `${hpPercent}%`}}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


export interface ExpeditionSummaryModalProps {
    reward: ExpeditionRewardSummary;
    onClose: () => void;
    characterName: string;
    itemTemplates: ItemTemplate[];
    affixes: Affix[];
    isPvp?: boolean;
    pvpData?: { attacker: PlayerCharacter, defender: PlayerCharacter };
    isDefenderView?: boolean;
    isHunting?: boolean;
    huntingMembers?: PartyMember[];
    allRewards?: Record<string, { gold: number; experience: number, items?: ItemInstance[], essences?: Partial<Record<EssenceType, any>> }>;
    initialEnemy?: Enemy;
    encounteredEnemies?: Enemy[];
    bossName?: string;
    messageId?: number | null;
    backgroundImage?: string;
}

const essenceToRarityMap: Record<EssenceType, ItemRarity> = {
    [EssenceType.Common]: ItemRarity.Common,
    [EssenceType.Uncommon]: ItemRarity.Uncommon,
    [EssenceType.Rare]: ItemRarity.Rare,
    [EssenceType.Epic]: ItemRarity.Epic,
    [EssenceType.Legendary]: ItemRarity.Legendary,
};

export const ExpeditionSummaryModal: React.FC<ExpeditionSummaryModalProps> = (props) => {
    const { 
        reward, onClose, characterName, itemTemplates, affixes, 
        isPvp = false, pvpData, isDefenderView = false, 
        isHunting = false, huntingMembers, allRewards,
        initialEnemy, encounteredEnemies, bossName, messageId
    } = props;
    const { t } = useTranslation();

    const defaultDummyStats: CharacterStats = {
        strength: 0, agility: 0, accuracy: 0, stamina: 0, intelligence: 0, energy: 0, luck: 0,
        statPoints: 0, currentHealth: 0, maxHealth: 1, currentEnergy: 0, maxEnergy: 0,
        currentMana: 0, maxMana: 0, minDamage: 0, maxDamage: 0, magicDamageMin: 0, magicDamageMax: 0,
        critChance: 0, critDamageModifier: 0, armor: 0, armorPenetrationPercent: 0,
        armorPenetrationFlat: 0, attacksPerRound: 0, manaRegen: 0, lifeStealPercent: 0,
        lifeStealFlat: 0, manaStealPercent: 0, manaStealFlat: 0, dodgeChance: 0,
    };

    const initialPlayerStats = useMemo(() => {
        if (isPvp) return isDefenderView ? pvpData!.defender.stats : pvpData!.attacker.stats;
        return reward.combatLog[0]?.playerStats || reward.combatLog[0]?.partyMemberStats?.[characterName];
    }, [isPvp, isDefenderView, pvpData, reward.combatLog, characterName]);

    const initialEnemyForDisplay = useMemo(() => {
        if (isPvp) {
            const opponent = isDefenderView ? pvpData!.attacker : pvpData!.defender;
            return { name: opponent.name, stats: opponent.stats, description: `Lvl ${opponent.level} ${t(`race.${opponent.race}`)}` };
        }
        if (isHunting && bossName && reward.combatLog[0]?.enemyStats) {
            return { name: bossName, stats: reward.combatLog[0].enemyStats, description: reward.combatLog[0].enemyDescription };
        }
        if (encounteredEnemies && encounteredEnemies.length > 0) {
            return { name: encounteredEnemies[0].name, stats: encounteredEnemies[0].stats, description: encounteredEnemies[0].description };
        }
        if (reward.combatLog.length > 0) {
            const firstLog = reward.combatLog[0];
            return { name: firstLog.defender, stats: firstLog.enemyStats, description: firstLog.enemyDescription };
        }
        return null;
    }, [isPvp, isDefenderView, pvpData, isHunting, bossName, reward.combatLog, encounteredEnemies, t]);

    const initialPartyState = useMemo(() => {
        if (!isHunting || !huntingMembers) return {};
        const state: Record<string, { currentHealth: number, maxHealth: number }> = {};
        for (const member of huntingMembers) {
            const stats = reward.combatLog[0]?.partyMemberStats?.[member.characterName];
            state[member.characterName] = {
                currentHealth: stats?.currentHealth ?? 0,
                maxHealth: stats?.maxHealth ?? 1
            };
        }
        return state;
    }, [isHunting, huntingMembers, reward.combatLog]);

    const [hoveredCombatant, setHoveredCombatant] = useState<{ type: 'player' | 'enemy' | 'partyMember', data: any, rect: DOMRect } | null>(null);
    
    const finalState = useMemo(() => {
        const lastLog = reward.combatLog.length > 0 ? reward.combatLog[reward.combatLog.length - 1] : null;
        if (!lastLog) {
            return {
                playerHealth: initialPlayerStats?.currentHealth || 0,
                enemyHealth: initialEnemyForDisplay?.stats?.maxHealth || 0,
                partyHealth: initialPartyState,
                enemiesHealth: encounteredEnemies?.map(e => ({ uniqueId: e.uniqueId!, name: e.name, currentHealth: e.stats.maxHealth, maxHealth: e.stats.maxHealth })) || []
            };
        }
        
        const partyHealth: Record<string, { currentHealth: number, maxHealth: number }> = {};
        if (lastLog.allPlayersHealth) {
            lastLog.allPlayersHealth.forEach(p => {
                partyHealth[p.name] = { currentHealth: p.currentHealth, maxHealth: p.maxHealth };
            });
        }

        return {
            playerHealth: lastLog.playerHealth,
            enemyHealth: lastLog.enemyHealth,
            partyHealth: partyHealth,
            enemiesHealth: lastLog.allEnemiesHealth || []
        };
    }, [reward.combatLog, initialPlayerStats, initialEnemyForDisplay, initialPartyState, encounteredEnemies]);

    const handleCopyLink = useCallback(() => {
        if (!messageId) return;
        const url = `${window.location.origin}/report/${messageId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Skopiowano link do schowka!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('Błąd kopiowania linku.');
        });
    }, [messageId]);

    const backgroundStyle = props.backgroundImage ? { backgroundImage: `url(${props.backgroundImage})` } : {};

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4"
            style={backgroundStyle}
        >
            <div 
                className="w-full max-w-7xl bg-slate-800/80 border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col h-[90vh]"
                style={{ "--window-bg": `url(${props.backgroundImage})` } as React.CSSProperties}
            >
                <h2 className="text-3xl font-bold text-center mb-4 text-indigo-400">{t(isPvp ? 'pvp.duelResult' : 'expedition.combatReport')}</h2>
                <div className="grid grid-cols-12 gap-6 flex-grow min-h-0">
                    <div className="col-span-3">
                         {isHunting && huntingMembers ? (
                             <PartyMemberList 
                                members={huntingMembers} 
                                finalPartyHealth={finalState.partyHealth}
                                onMemberHover={(member, rect) => {
                                    const stats = reward.combatLog[0]?.partyMemberStats?.[member.characterName];
                                    if(stats) setHoveredCombatant({ type: 'partyMember', data: { name: member.characterName, stats }, rect });
                                }}
                                onMemberLeave={() => setHoveredCombatant(null)}
                            />
                         ) : isPvp ? (
                            <CombatantStatsPanel name={isDefenderView ? pvpData!.defender.name : pvpData!.attacker.name} stats={initialPlayerStats} currentHealth={finalState.playerHealth} />
                         ) : (
                             <CombatantStatsPanel name={characterName} stats={initialPlayerStats} currentHealth={finalState.playerHealth} />
                         )}
                    </div>

                    <div className="col-span-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col">
                        <div className="flex-grow overflow-y-auto pr-2 space-y-1.5">
                            {reward.combatLog.map((log, index) => (
                                <CombatLogRow key={index} log={log} characterName={characterName} isHunting={isHunting} huntingMembers={huntingMembers} />
                            ))}
                        </div>
                    </div>

                    <div className="col-span-3">
                        {isPvp ? (
                             <CombatantStatsPanel name={isDefenderView ? pvpData!.attacker.name : pvpData!.defender.name} stats={isDefenderView ? pvpData!.attacker.stats : pvpData!.defender.stats} currentHealth={finalState.enemyHealth} />
                        ) : encounteredEnemies && encounteredEnemies.length > 1 ? (
                             <EnemyListPanel 
                                enemies={encounteredEnemies} 
                                finalEnemiesHealth={finalState.enemiesHealth}
                                onEnemyHover={(enemy, rect) => setHoveredCombatant({ type: 'enemy', data: enemy, rect })}
                                onEnemyLeave={() => setHoveredCombatant(null)}
                            />
                        ) : (
                             <CombatantStatsPanel name={initialEnemyForDisplay?.name || ''} description={initialEnemyForDisplay?.description} stats={initialEnemyForDisplay?.stats || null} currentHealth={finalState.enemyHealth} />
                        )}
                    </div>
                </div>

                <div className="mt-4 text-center animate-fade-in">
                    <h3 className={`text-4xl font-extrabold mb-4 ${reward.isVictory ? 'text-green-400' : 'text-red-500'}`}>
                        {reward.isVictory ? t('expedition.victory') : t('expedition.defeat')}
                    </h3>
                    {reward.isVictory && (
                        <div className="max-w-4xl mx-auto bg-slate-900/50 p-4 rounded-lg border border-slate-700 mt-4">
                            <h4 className="font-bold text-lg text-amber-400 mb-3 text-center">Podsumowanie Nagród</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-800/50 p-3 rounded-lg flex flex-col justify-center">
                                    <p className="flex items-center justify-between text-lg">
                                        <span className="flex items-center gap-2 text-gray-300"><CoinsIcon className="h-5 w-5 text-amber-400"/> {t('resources.gold')}</span>
                                        <span className="font-mono font-bold text-amber-400">+{reward.totalGold.toLocaleString()}</span>
                                    </p>
                                    <p className="flex items-center justify-between text-lg mt-2">
                                        <span className="flex items-center gap-2 text-gray-300"><StarIcon className="h-5 w-5 text-sky-400"/> XP</span>
                                        <span className="font-mono font-bold text-sky-400">+{reward.totalExperience.toLocaleString()}</span>
                                    </p>
                                </div>
                    
                                <div className="bg-slate-800/50 p-3 rounded-lg">
                                    <h5 className="text-gray-400 text-sm font-semibold mb-2">{t('expedition.itemsFound')} ({reward.itemsFound.length})</h5>
                                    {reward.itemsFound.length > 0 ? (
                                        <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
                                            {reward.itemsFound.map((item, index) => {
                                                const template = itemTemplates.find(t => t.id === item.templateId);
                                                if (!template) return null;
                                                return (
                                                    <ItemListItem key={index} item={item} template={template} affixes={affixes} isSelected={false} onClick={() => {}} />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-sm text-gray-500">Brak</p>
                                        </div>
                                    )}
                                </div>
                    
                                <div className="bg-slate-800/50 p-3 rounded-lg">
                                    <h5 className="text-gray-400 text-sm font-semibold mb-2">{t('expedition.essencesFound')}</h5>
                                    {Object.keys(reward.essencesFound).length > 0 && Object.values(reward.essencesFound).some(v => v > 0) ? (
                                        <div className="space-y-1">
                                            {Object.entries(reward.essencesFound).map(([essence, amount]) => {
                                                if (!amount || amount === 0) return null;
                                                const rarity = essenceToRarityMap[essence as EssenceType];
                                                return (
                                                    <p key={essence} className="flex justify-between text-sm">
                                                        <span className={rarityStyles[rarity].text}>{t(`resources.${essence}`)}</span>
                                                        <span className="font-mono font-bold text-white">+{amount}</span>
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-sm text-gray-500">Brak</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {reward.itemsLostCount && reward.itemsLostCount > 0 && (
                                <p className="text-center text-red-400 text-sm mt-3">{t('expedition.itemsLost', { count: reward.itemsLostCount })}</p>
                            )}
                        </div>
                    )}
                    <div className="mt-6 flex justify-center gap-4">
                        <button onClick={onClose} className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors">
                            {t('expedition.returnToCamp')}
                        </button>
                        {messageId && (
                            <button onClick={handleCopyLink} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg">
                                Kopiuj Link do Raportu
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export const ExpeditionComponent: React.FC<ExpeditionProps> = ({ character, expeditions, enemies, currentLocation, onStartExpedition, itemTemplates, affixes, onCompletion, onCancelExpedition }) => {
    const { t } = useTranslation();
    const [selectedExpedition, setSelectedExpedition] = useState<ExpeditionType | null>(null);

    const availableExpeditions = useMemo(() => 
        (expeditions || []).filter(exp => (exp.locationIds || []).includes(character.currentLocationId)),
        [expeditions, character.currentLocationId]
    );

    useEffect(() => {
        if (!selectedExpedition && availableExpeditions.length > 0) {
            setSelectedExpedition(availableExpeditions[0]);
        }
    }, [availableExpeditions, selectedExpedition]);

    const handleEmbark = (expId: string) => {
        if (character.stats.currentHealth < character.stats.maxHealth * 0.15) {
            if (window.confirm(t('expedition.lowHealthWarning'))) {
                onStartExpedition(expId);
            }
        } else {
            onStartExpedition(expId);
        }
    };
    
    // Active Expedition Countdown
    const [timeLeft, setTimeLeft] = useState(0);
    useEffect(() => {
        if (character.activeExpedition) {
            const updateTimer = () => {
                const remaining = Math.max(0, Math.floor((character.activeExpedition!.finishTime - api.getServerTime()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    onCompletion();
                }
            };

            updateTimer();
            const intervalId = setInterval(updateTimer, 1000);
            return () => clearInterval(intervalId);
        }
    }, [character.activeExpedition, onCompletion]);

    if (character.activeExpedition) {
        const expedition = expeditions.find(e => e.id === character.activeExpedition!.expeditionId);
        return (
            <ContentPanel title={t('expedition.inProgressTitle')}>
                <div className="bg-slate-900/40 p-8 rounded-xl text-center">
                    <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('expedition.onExpedition')}</h3>
                    <p className="text-4xl font-extrabold text-white mb-4">{expedition?.name}</p>
                    {expedition?.image && <img src={expedition.image} alt={expedition.name} className="w-full h-48 object-cover rounded-lg my-4 border border-slate-700/50" />}
                    <p className="text-lg text-gray-400 mb-6">{t('expedition.endsIn')}</p>
                    <div className="text-6xl font-mono font-bold text-amber-400 mb-8">{formatTimeLeft(timeLeft)}</div>
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={onCompletion} 
                            disabled={timeLeft > 0} 
                            className="px-8 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed shadow-lg"
                        >
                            {timeLeft > 0 ? t('expedition.inProgress') : t('expedition.finish')}
                        </button>
                        <button
                            onClick={onCancelExpedition}
                            className="px-6 py-3 rounded-lg bg-red-800 hover:bg-red-700 text-white font-semibold transition-colors duration-200"
                        >
                            Anuluj Wyprawę
                        </button>
                    </div>
                </div>
            </ContentPanel>
        );
    }

    return (
        <ContentPanel title={t('expedition.availableTitle')}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-slate-900/40 p-4 rounded-xl">
                    {availableExpeditions.length === 0 ? (
                        <p className="text-gray-500">{t('expedition.noExpeditions')}</p>
                    ) : (
                        <ul className="space-y-2">
                            {availableExpeditions.map(exp => (
                                <li key={exp.id}>
                                    <button 
                                        onClick={() => setSelectedExpedition(exp)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${selectedExpedition?.id === exp.id ? 'bg-indigo-600/50' : 'hover:bg-slate-700/50'}`}
                                    >
                                        <p className="font-semibold text-white">{exp.name}</p>
                                        <p className="text-xs text-gray-400">{exp.description}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {selectedExpedition && (
                    <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl">
                        <h3 className="text-2xl font-bold text-indigo-400 mb-2">{selectedExpedition.name}</h3>
                        {selectedExpedition.image && <img src={selectedExpedition.image} alt={selectedExpedition.name} className="w-full h-40 object-cover rounded-lg my-4 border border-slate-700/50" />}
                        <p className="text-gray-400 mb-6 italic">{selectedExpedition.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* ... Rest of the details ... */}
                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2">{t('expedition.potentialEnemies')}</h4>
                                 <div className="bg-slate-800/50 p-3 rounded-lg text-sm space-y-2">
                                    {selectedExpedition.enemies.length === 0 && <p className="text-gray-500">{t('expedition.noEnemies')}</p>}
                                    {selectedExpedition.enemies.map(e => {
                                        const enemy = enemies.find(en => en.id === e.enemyId);
                                        return <p key={e.enemyId}>{enemy?.name} ({e.spawnChance}%)</p>;
                                    })}
                                     {selectedExpedition.maxEnemies && <p className="text-xs text-gray-500 mt-2">{t('expedition.maxEnemiesNote', { count: selectedExpedition.maxEnemies })}</p>}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2">{t('expedition.reqsAndRewards')}</h4>
                                <div className="bg-slate-800/50 p-3 rounded-lg text-sm space-y-2">
                                    <p className="flex justify-between"><span>{t('expedition.cost')}:</span> <span className="font-mono flex items-center">{selectedExpedition.goldCost} <CoinsIcon className="h-4 w-4 ml-1 text-amber-400"/> / {selectedExpedition.energyCost} <BoltIcon className="h-4 w-4 ml-1 text-sky-400"/></span></p>
                                    <p className="flex justify-between"><span>{t('expedition.duration')}:</span> <span className="font-mono">{formatDuration(selectedExpedition.duration)}</span></p>
                                    <p className="flex justify-between"><span>{t('expedition.reward')} (Złoto):</span> <span className="font-mono">{selectedExpedition.minBaseGoldReward} - {selectedExpedition.maxBaseGoldReward}</span></p>
                                    <p className="flex justify-between"><span>{t('expedition.reward')} (XP):</span> <span className="font-mono">{selectedExpedition.minBaseExperienceReward} - {selectedExpedition.maxBaseExperienceReward}</span></p>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => handleEmbark(selectedExpedition.id)} 
                            disabled={character.resources.gold < selectedExpedition.goldCost || character.stats.currentEnergy < selectedExpedition.energyCost}
                            className="w-full mt-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-lg transition-colors duration-200 disabled:bg-slate-600"
                        >
                            {t('expedition.embark')}
                        </button>
                    </div>
                )}
            </div>
        </ContentPanel>
    );
};
