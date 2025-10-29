import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, CharacterStats, GameData } from '../types';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { MinusCircleIcon } from './icons/MinusCircleIcon';
import { InfoIcon } from './icons/InfoIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface StatisticsProps {
  character: PlayerCharacter;
  baseCharacter: PlayerCharacter;
  onCharacterUpdate: (character: PlayerCharacter) => void;
  calculateDerivedStats: (character: PlayerCharacter, gameData: GameData | null) => PlayerCharacter;
  gameData: GameData | null;
  onResetAttributes: () => void;
}

const StatTooltip: React.FC<{ text: string }> = ({ text }) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});

    useLayoutEffect(() => {
        if (tooltipRef.current && tooltipRef.current.parentElement) {
            const parentRect = tooltipRef.current.parentElement.getBoundingClientRect();
            const tooltipWidth = tooltipRef.current.offsetWidth;
            const spaceOnRight = window.innerWidth - parentRect.right;
            const spaceOnLeft = parentRect.left;

            if (spaceOnRight < tooltipWidth && spaceOnLeft > tooltipWidth) {
                // Not enough space on the right, position on the left
                setStyle({
                    top: '50%',
                    right: '100%',
                    transform: 'translateY(-50%)',
                    marginRight: '1rem'
                });
            } else {
                // Default: position on the right
                setStyle({
                    top: '50%',
                    left: '100%',
                    transform: 'translateY(-50%)',
                    marginLeft: '1rem'
                });
            }
        }
    }, []);

    return (
        <div 
            ref={tooltipRef}
            style={style}
            className="absolute w-48 p-2 bg-slate-900 text-gray-300 text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10"
        >
          {text}
        </div>
    );
};


const StatRow: React.FC<{ 
    label: string; 
    value: React.ReactNode; 
    onIncrease?: () => void; 
    canIncrease?: boolean; 
    onDecrease?: () => void;
    canDecrease?: boolean;
    description?: string;
}> = ({ label, value, onIncrease, canIncrease, onDecrease, canDecrease, description }) => (
  <div className="flex justify-between items-center py-1.5 px-3 rounded-lg transition-colors duration-200 hover:bg-slate-700/50">
    <div className="flex items-center space-x-2 group relative">
        <span className="font-medium text-sm text-gray-300">{label}</span>
        {description && (
            <>
                <InfoIcon className="h-4 w-4 text-gray-500" />
                <StatTooltip text={description} />
            </>
        )}
    </div>
    <div className="flex items-center space-x-2">
      {onDecrease && (
          <button 
            onClick={onDecrease} 
            disabled={!canDecrease}
            className="text-slate-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
            aria-label={`Decrease ${label}`}
          >
            <MinusCircleIcon className="h-5 w-5" />
          </button>
      )}
      <div className="w-32 text-right">
        {value}
      </div>
      {onIncrease && (
          <button 
            onClick={onIncrease} 
            disabled={!canIncrease}
            className="text-slate-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
            aria-label={`Increase ${label}`}
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
      )}
    </div>
  </div>
);

export const Statistics: React.FC<StatisticsProps> = ({ character, baseCharacter, onCharacterUpdate, calculateDerivedStats, gameData, onResetAttributes }) => {
  const { t } = useTranslation();
  
  const [pendingStats, setPendingStats] = useState(baseCharacter.stats);
  const [spentPoints, setSpentPoints] = useState(0);

  useEffect(() => {
    setPendingStats(baseCharacter.stats);
    setSpentPoints(0);
  }, [baseCharacter]);

  const availablePoints = baseCharacter.stats.statPoints - spentPoints;

  const handleStatChange = (stat: keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>, delta: number) => {
    if (delta > 0 && availablePoints <= 0) return;
    if (delta < 0 && (pendingStats[stat] as number) <= (baseCharacter.stats[stat] as number)) return;

    setPendingStats(prev => ({
      ...prev,
      [stat]: (prev[stat] as number) + delta
    }));
    setSpentPoints(prev => prev + delta);
  };
  
  const handleSaveChanges = () => {
    onCharacterUpdate({
      ...baseCharacter,
      stats: {
        ...pendingStats,
        statPoints: availablePoints,
      }
    });
  };

  const handleResetChanges = () => {
    setPendingStats(baseCharacter.stats);
    setSpentPoints(0);
  };
  
  const tempCharacterForPreview = useMemo(() => ({
    ...baseCharacter,
    stats: pendingStats,
  }), [baseCharacter, pendingStats]);

  const previewCharacter = useMemo(() => calculateDerivedStats(tempCharacterForPreview, gameData), [tempCharacterForPreview, calculateDerivedStats, gameData]);
  
  const baseStatKeys: (keyof Pick<CharacterStats, 'strength' | 'agility' | 'accuracy' | 'stamina' | 'intelligence' | 'energy'>)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy'];

  const experiencePercentage = (character.experience / character.experienceToNextLevel) * 100;

  const isFreeReset = !baseCharacter.freeStatResetUsed;
  const resetCost = 100 * baseCharacter.level;
  const canAffordReset = isFreeReset || baseCharacter.resources.gold >= resetCost;

  return (
    <ContentPanel title={t('statistics.title')}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Base Attributes & Actions */}
        <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('statistics.baseAttributes')}</h3>
            {baseCharacter.stats.statPoints > 0 && (
              <p className="text-amber-400 font-semibold mb-4 text-center bg-slate-800/50 p-2 rounded-lg text-sm">
                {t('statistics.pointsToSpend')}: {availablePoints}
              </p>
            )}
            <div className="space-y-1">
              {baseStatKeys.map(key => {
                const itemBonus = character.stats[key] - baseCharacter.stats[key];
                return (
                    <StatRow
                    key={key}
                    label={t(`statistics.${key}`)}
                    value={
                        <div className="flex items-baseline justify-end">
                        <span className="font-mono text-lg font-bold text-white">{pendingStats[key]}</span>
                        {itemBonus > 0 && (
                            <span className="font-mono text-base text-green-400 ml-2">(+{itemBonus})</span>
                        )}
                        </div>
                    }
                    onIncrease={() => handleStatChange(key, 1)}
                    canIncrease={availablePoints > 0}
                    onDecrease={() => handleStatChange(key, -1)}
                    canDecrease={pendingStats[key] > baseCharacter.stats[key]}
                    description={t(`statistics.${key}Desc`)}
                    />
                )
              })}
            </div>
             <p className="text-xs text-gray-500 italic mt-4 px-3">{t('statistics.itemBonusNote')}</p>
          </div>
          <div className="flex flex-col gap-4 mt-6">
            {spentPoints > 0 && (
                <div className="flex gap-4">
                <button
                    onClick={handleResetChanges}
                    className="w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-bold transition-colors text-sm"
                >
                    {t('statistics.cancelChanges')}
                </button>
                <button
                    onClick={handleSaveChanges}
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors text-sm"
                >
                    {t('statistics.save')}
                </button>
                </div>
            )}
            <div className="text-center">
                <button
                    onClick={onResetAttributes}
                    disabled={spentPoints > 0 || !canAffordReset}
                    className="w-full py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-bold transition-colors text-sm disabled:bg-slate-600 disabled:cursor-not-allowed"
                    title={spentPoints > 0 ? t('statistics.reset.applyChangesFirst') : !canAffordReset ? t('statistics.reset.notEnoughGold', { cost: resetCost }) : ''}
                >
                    {t('statistics.reset.button')} ({isFreeReset ? t('statistics.reset.free') : t('statistics.reset.cost', { cost: resetCost })})
                </button>
            </div>
          </div>
        </div>

        {/* Column 2: Vitals */}
        <div className="bg-slate-900/40 p-4 rounded-xl flex flex-col gap-4">
            <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-bold text-white">{t('statistics.level')} {character.level}</span>
                    <span className="font-mono text-sky-300">{character.experience} / {character.experienceToNextLevel} XP</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${experiencePercentage}%` }}></div>
                </div>
            </div>
            <div className="bg-slate-800/50 p-3 rounded-lg">
                <h4 className="font-bold text-indigo-300 text-sm mb-1">{t('statistics.racialBonusTitle')}</h4>
                <p className="text-xs text-gray-300"><span className="font-semibold">{t(`race.${character.race}`)}:</span> <span className="italic">{t(`raceBonuses.${character.race}`)}</span></p>
            </div>
             <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">{t('statistics.vitals')}</h3>
                <div className="space-y-1">
                    <StatRow label={t('statistics.health')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.currentHealth.toFixed(0)} / {previewCharacter.stats.maxHealth}</span>} description={t('statistics.healthDesc')} />
                    <StatRow label={t('statistics.mana')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.currentMana.toFixed(0)} / {previewCharacter.stats.maxMana}</span>} description={t('statistics.manaDesc')} />
                    <StatRow label={t('statistics.energyLabel')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.currentEnergy} / {previewCharacter.stats.maxEnergy}</span>} description={t('statistics.energyDesc')} />
                </div>
            </div>
        </div>
        
        {/* Column 3: Combat Stats */}
         <div className="bg-slate-900/40 p-4 rounded-xl">
          <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('statistics.combatStats')}</h3>
          <div className="space-y-1">
            <StatRow label={t('statistics.physicalDamage')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.minDamage} - {previewCharacter.stats.maxDamage}</span>} description={t('statistics.physicalDamageDesc')} />
            <StatRow label={t('statistics.magicDamage')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.magicDamageMin} - {previewCharacter.stats.magicDamageMax}</span>} description={t('statistics.magicDamageDesc')} />
            <StatRow label={t('statistics.armor')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.armor}</span>} description={t('statistics.armorDesc')} />
            <StatRow label={t('statistics.critChance')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.critChance.toFixed(1)}%</span>} description={t('statistics.critChanceDesc')} />
            <StatRow label={t('statistics.critDamageModifier')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.critDamageModifier}%</span>} description={t('statistics.critDamageModifierDesc')} />
            <StatRow label={t('statistics.attacksPerTurn')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.attacksPerRound}</span>} description={t('statistics.attacksPerTurnDesc')} />
            <StatRow label={t('statistics.manaRegen')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.manaRegen}</span>} description={t('statistics.manaRegenDesc')} />
            <StatRow label={t('statistics.armorPenetration')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.armorPenetrationPercent}% / {previewCharacter.stats.armorPenetrationFlat}</span>} description={t('statistics.armorPenetrationDesc')} />
            <StatRow label={t('statistics.lifeSteal')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.lifeStealPercent}% / {previewCharacter.stats.lifeStealFlat}</span>} description={t('statistics.lifeStealDesc')} />
            <StatRow label={t('statistics.manaSteal')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.manaStealPercent}% / {previewCharacter.stats.manaStealFlat}</span>} description={t('statistics.manaStealDesc')} />
          </div>
        </div>
      </div>
    </ContentPanel>
  );
};