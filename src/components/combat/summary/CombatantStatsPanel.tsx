
import React from 'react';
import { CharacterStats, EnemyStats, CharacterClass } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';

interface CombatantStatsPanelProps {
  name: string;
  description?: string;
  stats: CharacterStats | EnemyStats | null;
  currentHealth?: number;
  currentMana?: number;
}

export const CombatantStatsPanel: React.FC<CombatantStatsPanelProps> = ({ name, description, stats, currentHealth, currentMana }) => {
  const { t } = useTranslation();
  if (!stats) {
    return <div className="w-full bg-slate-900 p-4 rounded-lg border border-slate-700 h-full text-gray-500 flex items-center justify-center">Brak danych</div>;
  }

  const isPlayer = 'strength' in stats;
  const borderColor = isPlayer ? 'border-sky-500' : 'border-red-500';
  const textColor = isPlayer ? 'text-sky-400' : 'text-red-400';

  const hpDisplay = currentHealth !== undefined ? `${Math.max(0, currentHealth).toFixed(0)} / ${stats.maxHealth}` : stats.maxHealth;
  const manaDisplay = stats.maxMana !== undefined && stats.maxMana > 0
    ? (currentMana !== undefined ? `${Math.max(0, currentMana).toFixed(0)} / ${stats.maxMana}` : stats.maxMana)
    : null;

  const magicDamageDisplay = (stats.magicDamageMin !== undefined && stats.magicDamageMin > 0) || (stats.magicDamageMax !== undefined && stats.magicDamageMax > 0)
    ? `${stats.magicDamageMin || 0} - ${stats.magicDamageMax || 0}`
    : null;

  const manaRegenDisplay = stats.manaRegen !== undefined && stats.manaRegen > 0 ? stats.manaRegen : null;


  return (
    <div className={`bg-slate-900 p-4 rounded-lg border-2 ${borderColor} h-full shadow-2xl relative z-[100]`}>
      <h4 className={`font-bold text-xl text-center border-b pb-2 mb-2 ${borderColor} ${textColor}`}>
        {name}
      </h4>
      {description && <p className="text-xs italic text-gray-400 mb-2 text-center">{description}</p>}
      <div className="text-left text-sm space-y-1 text-gray-200">
        <p className="flex justify-between"><strong>HP:</strong> <span className="font-mono">{hpDisplay}</span></p>
        {manaDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.mana')}:</strong> <span className="font-mono">{manaDisplay}</span></p>
        )}
        {manaRegenDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.manaRegen')}:</strong> <span className="font-mono">{manaRegenDisplay}</span></p>
        )}
        <div className="border-t border-slate-700 my-2"></div>
        
        {isPlayer && (
            <>
                <p className="flex justify-between"><strong>{t('statistics.strength')}:</strong> <span>{(stats as CharacterStats).strength}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.accuracy')}:</strong> <span>{(stats as CharacterStats).accuracy}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.stamina')}:</strong> <span>{(stats as CharacterStats).stamina}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.intelligence')}:</strong> <span>{(stats as CharacterStats).intelligence}</span></p>
                <p className="flex justify-between"><strong>{t('statistics.energy')}:</strong> <span>{(stats as CharacterStats).energy}</span></p>
            </>
        )}
        
        {stats.agility > 0 && <p className="flex justify-between"><strong>{t('statistics.agility')}:</strong> <span>{stats.agility}</span></p>}
        
        <div className="border-t border-slate-700 my-2"></div>
        
        {(stats.minDamage > 0 || stats.maxDamage > 0) && (
             <p className="flex justify-between"><strong>{isPlayer ? t('statistics.physicalDamage') : t('statistics.damage')}:</strong> <span className="font-mono">{stats.minDamage} - {stats.maxDamage}</span></p>
        )}
        {magicDamageDisplay && (
            <p className="flex justify-between"><strong>{t('statistics.magicDamage')}:</strong> <span className="font-mono">{magicDamageDisplay}</span></p>
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
        <p className="flex justify-between"><strong>{t('statistics.critChance')}:</strong> <span>{(stats.critChance || 0).toFixed(1)}%</span></p>
        {isPlayer && 'critDamageModifier' in stats && (
             <p className="flex justify-between"><strong>{t('statistics.critDamageModifier')}:</strong> <span>{(stats as CharacterStats).critDamageModifier}%</span></p>
        )}
      </div>
    </div>
  );
};
