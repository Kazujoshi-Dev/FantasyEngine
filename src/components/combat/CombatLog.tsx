
import React from 'react';
import { CombatLogEntry, PartyMember } from '../../types';
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
    const isPlayerDefender = log.defender === characterName || (isHunting && huntingMembers?.some(m => m.characterName === log.defender));

    let actionText = '';
    let textColor = 'text-gray-300';

    switch (log.action) {
        case 'starts a fight with':
            actionText = `${t('expedition.versus')} ${log.defender}`;
            textColor = 'text-amber-400 font-bold text-center my-2';
            break;
        case 'attacks':
            // Display weapon name if available
            const weaponText = log.weaponName ? `(${log.weaponName})` : '';
            actionText = `${t('expedition.attacks')} ${log.defender} ${weaponText}`;
            break;
        case 'magicAttack':
            const spellName = log.magicAttackType ? t(`item.magic.${log.magicAttackType}`) : 'Magia';
            actionText = `${t('expedition.casts')} ${spellName} ${t('expedition.on')} ${log.defender}`;
            textColor = 'text-purple-300';
            break;
        case 'dodge':
            actionText = `${t('expedition.dodge')} ${log.attacker}`;
            textColor = 'text-blue-300 italic';
            return (
                <div className={`text-sm ${textColor}`}>
                    <span className="font-bold">{log.defender}</span> {actionText}
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
        case 'manaRegen':
            return null; // Skip detailed regen logs to reduce clutter
        case 'effectApplied':
            const effectName = t(`expedition.combatLog.effect.${log.effectApplied || 'applied'}`, { 
                target: log.defender, 
                damage: log.damage,
                stacks: log.damage // reusing damage field for stacks
            });
            return <div className="text-xs text-yellow-500 italic text-center">{effectName}</div>;
        case 'specialAttackLog':
            const specialName = t(`specialAttacks.${log.specialAttackType}`);
            return <div className="text-sm text-red-400 font-bold text-center border-y border-red-900/30 py-1 my-1">{log.attacker} używa {specialName}!</div>;
        case 'boss_shout':
            return <div className="text-sm text-red-500 font-serif italic text-center">"{t(`bossShouts.${log.shout}`)}"</div>;
        case 'shaman_power':
            actionText = `${t('expedition.shamanPower')} ${log.defender}`;
            textColor = 'text-blue-400';
            break;
        case 'orc_fury':
            return <div className="text-xs text-red-400 italic text-center">{t('expedition.orcFuryLog', { attacker: log.attacker })}</div>;
        case 'berserker_frenzy':
            return <div className="text-xs text-red-400 italic text-center">{t('expedition.berserkerFrenzyLog', { attacker: log.attacker })}</div>;
        case 'hunter_bonus_shot':
            actionText = `(Szybki strzał) ${t('expedition.attacks')} ${log.defender}`;
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
