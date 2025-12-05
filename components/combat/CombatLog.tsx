
import React, { useMemo } from 'react';
import { CombatLogEntry, PartyMember } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';

export const CombatLogRow: React.FC<{
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
        if (friendlyNames.includes(name) || name === 'Team' || name === 'Drużyna') {
            return 'text-sky-400';
        }
        return 'text-red-400';
    };

    const getHpForEntity = (name: string, healthSnapshot: any) => {
        // First, check allPlayersHealth (used in Raids/TvT for EVERYONE, and in Hunting for players)
        const playerHealthData = healthSnapshot?.allPlayersHealth?.find((p: any) => p.name === name);
        if (playerHealthData) {
            return playerHealthData.currentHealth;
        }
        
        // Second, check allEnemiesHealth (used in 1vMany PvE)
        const enemyHealthData = healthSnapshot?.allEnemiesHealth?.find((e: any) => e.name === name);
        if (enemyHealthData) {
            return enemyHealthData.currentHealth;
        }
        
        // Fallback for 1v1 legacy structure
        if (friendlyNames.includes(name)) {
            return healthSnapshot?.playerHealth;
        }
        return healthSnapshot?.enemyHealth;
    };


    const renderName = (name: string) => {
        const color = getCombatantColor(name);
        if(name === 'Team' || name === 'Drużyna') return <span className={`font-semibold ${color}`}>{name}</span>;
        if(name === 'System') return <span className="font-bold text-gray-500">System</span>;
        
        const hp = Math.max(0, Math.ceil(getHpForEntity(name, log)));
        
        return (
            <>
                <span className={`font-semibold ${color}`}>{name}</span>
                <span className="text-xs text-gray-500 font-normal ml-1">({hp} HP)</span>
            </>
        );
    };
    
    // --- SYSTEM / ERROR LOGS ---
    if (log.action === 'system_error') {
         return (
            <div className="text-center my-2 py-2 bg-red-900/40 rounded border border-red-600/50">
                <p className="font-bold text-sm text-red-300">
                    ⚠️ BŁĄD KRYTYCZNY: system_error
                </p>
                <p className="text-xs text-red-400/80">
                    Symulacja została przerwana. Wynik może być niekompletny.
                </p>
            </div>
        );
    }

    if (log.action === 'walkover') {
         return (
            <div className="text-center my-4 py-3 bg-slate-800 rounded border border-slate-600">
                <h4 className="font-bold text-lg text-white mb-1">WALKOWER</h4>
                <p className="text-sm text-gray-400">
                    Jedna ze stron nie stawiła się do walki. Zwycięstwo zostało przyznane automatycznie.
                </p>
            </div>
        );
    }
    
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
                    <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
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
        // Special case for guild raids, where attacker/defender are guild names
        // and playerStats/enemyStats are not present.
        if (!log.playerStats && !log.enemyStats && log.partyMemberStats) {
             return (
                <div className="text-center my-3 py-2 border-y border-slate-700/50">
                    <p className="font-bold text-lg text-gray-300">
                        <span className="font-semibold text-sky-400">{log.attacker}</span>
                        <span className="text-gray-400 mx-2">{t('expedition.versus')}</span>
                        <span className="font-semibold text-red-400">{log.defender}</span>
                    </p>
                </div>
            )
        }
        // Default rendering for 1v1 and 1vMany
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
    
    if (log.action === 'hardSkinProc') {
        const text = t('expedition.hardSkinLog').replace('{defender}', '');
        return (
            <p className="text-sm text-slate-400 font-bold italic border-l-2 border-slate-500 pl-2 my-1">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.defender)} {text}
            </p>
        );
    }
    
    if (log.action === 'dwarf_defense') {
        const text = t('expedition.dwarfDefenseLog').replace('{defender}', '');
        return (
            <p className="text-sm text-amber-600 font-bold italic border-l-2 border-amber-700 pl-2 my-1 bg-slate-900/30">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.defender)} {text}
            </p>
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
    
    // NEW: Hunter Bonus Shot Log
    if (log.action === 'hunter_bonus_shot') {
        const text = t('expedition.hunterBonusLog').replace('{attacker}', '');
        return (
             <p className="text-sm text-emerald-500 font-bold italic">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {renderName(log.attacker)} {text} <span className="text-xs text-gray-400 ml-1">({log.damage} dmg)</span>
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
    
    // Identify if this is a standard attack/magic log
    const isStandardAttack = log.action === 'attacks' || log.action === 'magicAttack';

    // Fallback for any unrecognized action string - render as simple text message to avoid "System attacks System" confusion
    if (!isStandardAttack) {
         return (
            <p className="text-sm text-gray-400 italic text-center my-1">
                <span className="font-mono text-gray-500 mr-2">{t('expedition.turn')} {log.turn}:</span>
                {log.action}
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
