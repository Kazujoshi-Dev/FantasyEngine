
import React from 'react';
import { CombatLogEntry, PartyMember, SpecialAttackType } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';

interface CombatLogRowProps {
    log: CombatLogEntry;
    characterName: string;
    isHunting?: boolean;
    huntingMembers?: PartyMember[];
}

export const CombatLogRow: React.FC<CombatLogRowProps> = ({ log, characterName, isHunting, huntingMembers }) => {
    const { t } = useTranslation();
    const isPlayerAttacker = log.attacker === characterName || (isHunting && huntingMembers?.some(m => m.characterName === log.attacker));
    
    const getTargetHealthStatus = (targetNameOverride?: string): string => {
        const targetName = targetNameOverride || log.defender;
        if (!targetName) return '';

        let current = 0;
        let max = 0;
        let found = false;

        if (log.allPlayersHealth) {
            const p = log.allPlayersHealth.find(x => x.name === targetName);
            if (p) { current = p.currentHealth; max = p.maxHealth; found = true; }
        }
        if (!found && log.allEnemiesHealth) {
            const e = log.allEnemiesHealth.find(x => x.name === targetName);
            if (e) { current = e.currentHealth; max = e.maxHealth; found = true; }
        }

        if (!found) {
            const isTargetPlayerSide = targetName === characterName;
            if (isTargetPlayerSide) {
                current = log.playerHealth;
                if (log.playerStats) max = log.playerStats.maxHealth;
            } else {
                current = log.enemyHealth;
                if (log.enemyStats) max = log.enemyStats.maxHealth;
            }
        }
        
        const currentDisplay = Math.max(0, Math.floor(current));
        if (max > 0) {
            return `(HP: ${currentDisplay}/${max})`;
        }
        return `(HP: ${currentDisplay})`;
    };

    const hpText = getTargetHealthStatus();
    const hpSpan = <span className="text-gray-500 text-xs ml-1 font-mono">{hpText}</span>;

    let actionText: React.ReactNode = '';
    let textColor = 'text-gray-300';

    switch (log.action) {
        case 'starts a fight with':
            actionText = <span>{`${t('expedition.versus')} ${log.defender}`}</span>;
            textColor = 'text-amber-400 font-bold text-center my-2';
            break;
        case 'attacks':
            const weaponText = log.weaponName ? `(${log.weaponName})` : '';
            actionText = (
                <span>
                    {t('expedition.attacks')} <span className="font-bold text-gray-400">{log.defender}</span> {hpSpan} {weaponText}
                </span>
            );
            break;
        case 'magicAttack':
            const spellName = log.magicAttackType ? t(`item.magic.${log.magicAttackType}`) : 'Magia';
            actionText = (
                <span>
                    {t('expedition.casts')} {spellName} {t('expedition.on')} <span className="font-bold text-gray-400">{log.defender}</span> {hpSpan}
                </span>
            );
            textColor = 'text-purple-300';
            break;
        case 'dodge':
            actionText = `${t('expedition.dodge')} ${log.attacker}`;
            textColor = 'text-blue-300 italic';
            return (
                <div className={`text-sm ${textColor}`}>
                    <span className="font-bold">{log.defender}</span> {hpSpan} {actionText}
                </div>
            );
        case 'death':
            actionText = `${log.defender} ginie!`;
            textColor = 'text-red-500 font-bold';
            return <div className={`text-sm ${textColor} text-center uppercase tracking-widest`}>{actionText}</div>;
        case 'enemy_death':
        case 'all_enemies_defeated':
            actionText = t('expedition.enemyDefeated', { enemyName: log.defender || 'Wrogowie' });
            textColor = 'text-green-400 font-bold';
            return <div className={`text-sm ${textColor} text-center uppercase tracking-widest`}>{actionText}</div>;
        case 'effectApplied':
            const effectName = t(`expedition.combatLog.effect.${log.effectApplied || 'applied'}`, { 
                target: log.defender, 
                damage: log.damage,
                stacks: log.damage
            });
            return (
                <div className="text-xs text-yellow-500 italic text-center">
                    {effectName} {log.damage && log.damage > 0 ? hpSpan : null}
                </div>
            );
        case 'specialAttackLog': {
            const specialName = t(`specialAttacks.${log.specialAttackType}`);
            let resultText = "";
            let aoeDetails: React.ReactNode = null;
            
            switch(log.specialAttackType) {
                case SpecialAttackType.Stun: 
                    resultText = `Ogłusza ${log.defender}! Cel nie może atakować.`; break;
                case SpecialAttackType.Earthquake:
                    resultText = `Ziemia pęka! Cała drużyna otrzymuje obrażenia.`;
                    if (log.aoeDamage) {
                        aoeDetails = (
                            <div className="flex flex-wrap justify-center gap-2 mt-1">
                                {log.aoeDamage.map((d, i) => (
                                    <span key={i} className="text-[10px] text-red-500/80 bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30">
                                        {d.target}: <span className="font-bold">-{d.damage} HP</span> {getTargetHealthStatus(d.target)}
                                    </span>
                                ))}
                            </div>
                        );
                    }
                    break;
                case SpecialAttackType.ArmorPierce:
                    resultText = `Roztrzaskuje pancerz ${log.defender}!`; break;
                case SpecialAttackType.DeathTouch:
                    resultText = `Wysysa życie z ${log.defender} zadając ${log.damage} obrażeń!`; break;
                case SpecialAttackType.EmpoweredStrikes:
                    resultText = `Boss wpada w szał, zwiększając swoją celność!`; break;
            }

            return (
                <div className="text-sm text-red-400 font-bold text-center border-y border-red-900/30 py-1 my-1">
                    {log.attacker} używa {specialName}! {resultText}
                    {aoeDetails}
                </div>
            );
        }
        case 'boss_shout':
            return <div className="text-sm text-red-500 font-serif italic text-center">"{t(`bossShouts.${log.shout}`)}"</div>;
        case 'shaman_power':
            actionText = (
                <span>
                    {t('expedition.shamanPower')} <span className="font-bold text-gray-400">{log.defender}</span> {hpSpan}
                </span>
            );
            textColor = 'text-blue-400';
            break;
        case 'orc_fury':
            return <div className="text-xs text-red-400 italic text-center">{t('expedition.orcFuryLog', { attacker: log.attacker })}</div>;
        case 'berserker_frenzy':
            return <div className="text-xs text-red-400 italic text-center">{t('expedition.berserkerFrenzyLog', { attacker: log.attacker })}</div>;
        case 'hunter_bonus_shot':
            actionText = (
                <span>
                    (Szybki strzał) {t('expedition.attacks')} <span className="font-bold text-gray-400">{log.defender}</span> {hpSpan}
                </span>
            );
            textColor = 'text-green-300';
            break;
        default:
            actionText = log.action;
    }

    if (log.action === 'starts a fight with') {
        return <div className={textColor}>{log.attacker} {actionText}</div>;
    }

    const damageClass = log.isCrit ? 'text-red-500 font-bold text-lg' : 'text-red-400 font-bold';

    return (
        <div className={`text-sm ${textColor} py-0.5`}>
            <span className={`font-semibold ${isPlayerAttacker ? 'text-green-400' : 'text-red-400'}`}>{log.attacker}</span>
            {' '}{actionText}{' '}
            {log.damage !== undefined && (
                <>
                    {t('expedition.dealing')} <span className={damageClass}>{log.damage}</span> {t('expedition.damage')}
                    {log.isCrit && <span className="text-yellow-400 ml-1 font-bold">{t('expedition.critical')}</span>}
                </>
            )}
            {log.healthGained && <span className="text-green-400 ml-1">({t('expedition.healed')} {log.healthGained})</span>}
            {log.manaGained && <span className="text-blue-400 ml-1">({t('expedition.manaStolen')} {log.manaGained} {t('expedition.manaPoints')})</span>}
            {log.damageReduced && <span className="text-gray-500 ml-1 text-xs">{t('expedition.damageReduced', { amount: log.damageReduced })}</span>}
        </div>
    );
};
