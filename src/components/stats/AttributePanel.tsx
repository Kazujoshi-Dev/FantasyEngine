
import React, { useState, useEffect, useMemo } from 'react';
import { PlayerCharacter, CharacterStats, GameData } from '../../types';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { MinusCircleIcon } from '../icons/MinusCircleIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { useTranslation } from '../../contexts/LanguageContext';
import { api } from '../../api';
import { calculateDerivedStats } from '../../logic/stats';

const StatTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="absolute w-48 p-2 bg-slate-900 text-gray-300 text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-hover:visible transition-opacity duration-300 pointer-events-none z-10 left-full ml-2 top-1/2 -translate-y-1/2">
      {text}
    </div>
);

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
            className="text-slate-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            <MinusCircleIcon className="h-5 w-5" />
          </button>
      )}
      <div className="w-auto text-right font-mono font-bold text-white text-sm">{value}</div>
      {onIncrease && (
          <button 
            onClick={onIncrease} 
            disabled={!canIncrease}
            className="text-slate-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
      )}
    </div>
  </div>
);

export const AttributePanel: React.FC<{
    character: PlayerCharacter;
    baseCharacter: PlayerCharacter;
    gameData: GameData;
    updateCharacter: (c: PlayerCharacter) => void;
}> = ({ character, baseCharacter, gameData, updateCharacter }) => {
    const { t } = useTranslation();
    const [pendingStats, setPendingStats] = useState(baseCharacter.stats);
    const [spentPoints, setSpentPoints] = useState(0);

    const availablePoints = baseCharacter.stats.statPoints - spentPoints;

    const handleStatChange = (stat: keyof CharacterStats, delta: number) => {
        if (delta > 0 && availablePoints <= 0) return;
        const currentPendingValue = Number(pendingStats[stat]) || 0;
        const currentBaseValue = Number(baseCharacter.stats[stat]) || 0;
        if (delta < 0 && currentPendingValue <= currentBaseValue) return;

        setPendingStats(prev => ({ ...prev, [stat]: (Number(prev[stat]) || 0) + delta }));
        setSpentPoints(prev => prev + delta);
    };

    const handleSave = async () => {
        const pointsToAdd: Partial<CharacterStats> = {};
        ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'].forEach(key => {
            const delta = (Number(pendingStats[key as keyof CharacterStats]) || 0) - (Number(baseCharacter.stats[key as keyof CharacterStats]) || 0);
            if (delta > 0) pointsToAdd[key as keyof CharacterStats] = delta;
        });
        try {
            const updated = await api.distributeStatPoints(pointsToAdd);
            updateCharacter(updated);
            setSpentPoints(0);
        } catch (e: any) { alert(e.message); }
    };

    const primaryStatKeys: (keyof CharacterStats)[] = ['strength', 'agility', 'accuracy', 'stamina', 'intelligence', 'energy', 'luck'];

    // Obliczanie aktualnego kosztu resetu dla UI
    const currentResetInfo = useMemo(() => {
        let distributedPoints = 0;
        primaryStatKeys.forEach(k => {
            distributedPoints += (baseCharacter.stats[k] - 1);
        });
        const resetsUsed = baseCharacter.resetsUsed || 0;
        const cost = resetsUsed === 0 ? 0 : distributedPoints * 1000;
        return { cost, resetsUsed };
    }, [baseCharacter, primaryStatKeys]);

    const handleReset = async () => {
        if (spentPoints !== 0) {
            alert(t('statistics.reset.applyChangesFirst'));
            return;
        }

        const costText = currentResetInfo.resetsUsed === 0 
            ? t('statistics.reset.free') 
            : t('statistics.reset.cost', { cost: currentResetInfo.cost.toLocaleString() });

        if (window.confirm(t('statistics.reset.confirm', { costText }))) {
            try {
                const updated = await api.resetAttributes();
                updateCharacter(updated);
                setPendingStats(updated.stats);
            } catch (e: any) {
                alert(e.message);
            }
        }
    };

    const previewCharacter = useMemo(() => calculateDerivedStats(
        { ...baseCharacter, stats: pendingStats },
        gameData.itemTemplates, gameData.affixes,
        character.guildBarracksLevel, character.guildShrineLevel,
        gameData.skills, character.activeGuildBuffs
    ), [baseCharacter, pendingStats, gameData, character]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Kolumna 1: Atrybuty Podstawowe */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex flex-col">
                <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('statistics.baseAttributes')}</h3>
                {baseCharacter.stats.statPoints > 0 && (
                    <div className="text-amber-400 font-bold mb-4 text-center bg-slate-800/50 p-2 rounded-lg mx-2">
                        {t('statistics.pointsToSpend')}: {availablePoints}
                    </div>
                )}
                <div className="space-y-1 flex-grow">
                    {primaryStatKeys.map(key => {
                        const baseValue = Number(baseCharacter.stats[key]) || 0;
                        const pendingValue = Number(pendingStats[key]) || 0;
                        const itemBonus = (Number(character.stats[key]) || 0) - baseValue;
                        const totalValue = pendingValue + itemBonus;

                        return (
                            <StatRow
                                key={key}
                                label={t(`statistics.${key}`)}
                                value={
                                    <div className="flex items-baseline justify-end">
                                        <span className="text-gray-400 mr-1">{pendingValue}</span>
                                        {itemBonus > 0 && (
                                            <>
                                                <span className="text-green-400 text-xs">(+{itemBonus})</span>
                                                <span className="text-sky-400 ml-1">({totalValue})</span>
                                            </>
                                        )}
                                    </div>
                                }
                                onIncrease={() => handleStatChange(key, 1)}
                                canIncrease={availablePoints > 0}
                                onDecrease={() => handleStatChange(key, -1)}
                                canDecrease={pendingValue > baseValue}
                                description={t(`statistics.${key}Desc`)}
                            />
                        );
                    })}
                </div>
                
                <div className="mt-6 px-2 space-y-2">
                    {spentPoints > 0 ? (
                        <div className="flex gap-2">
                            <button onClick={() => { setPendingStats(baseCharacter.stats); setSpentPoints(0); }} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">{t('admin.general.cancel')}</button>
                            <button onClick={handleSave} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm transition-colors">{t('statistics.save')}</button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleReset} 
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-gray-400 transition-colors uppercase font-bold tracking-widest"
                            >
                                {t('statistics.reset.button')}
                            </button>
                            <div className="text-center">
                                {currentResetInfo.resetsUsed === 0 ? (
                                    <p className="text-[10px] text-green-500 font-bold uppercase tracking-tight">{t('statistics.reset.freeResetNote')}</p>
                                ) : (
                                    <p className="text-[10px] text-gray-500">
                                        Koszt kolejnego resetu: <span className="text-amber-500 font-mono font-bold">{currentResetInfo.cost.toLocaleString()} złota</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Kolumna 2: Statystyki Witalne */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-2">
                <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('statistics.vitals')}</h3>
                <StatRow label={t('statistics.health')} value={`${previewCharacter.stats.currentHealth.toFixed(0)} / ${previewCharacter.stats.maxHealth}`} description={t('statistics.healthDesc')} />
                <StatRow label={t('statistics.mana')} value={`${previewCharacter.stats.currentMana.toFixed(0)} / ${previewCharacter.stats.maxMana}`} description={t('statistics.manaDesc')} />
                <StatRow label={t('statistics.manaRegen')} value={previewCharacter.stats.manaRegen} description={t('statistics.manaRegenDesc')} />
                <StatRow label={t('statistics.energyLabel')} value={`${previewCharacter.stats.currentEnergy} / ${previewCharacter.stats.maxEnergy}`} description={t('statistics.energyDesc')} />
            </div>

            {/* Kolumna 3: Pełne Statystyki Bojowe */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-1">
                <h3 className="text-xl font-bold text-indigo-400 mb-4 px-2">{t('statistics.combatStats')}</h3>
                <StatRow label={t('statistics.physicalDamage')} value={`${previewCharacter.stats.minDamage} - ${previewCharacter.stats.maxDamage}`} description={t('statistics.physicalDamageDesc')} />
                <StatRow label={t('statistics.magicDamage')} value={`${previewCharacter.stats.magicDamageMin} - ${previewCharacter.stats.magicDamageMax}`} description={t('statistics.magicDamageDesc')} />
                <StatRow label={t('statistics.armor')} value={previewCharacter.stats.armor} description={t('statistics.armorDesc')} />
                <StatRow label={t('statistics.critChance')} value={`${previewCharacter.stats.critChance.toFixed(1)}%`} description={t('statistics.critChanceDesc')} />
                <StatRow label={t('statistics.critDamageModifier')} value={`${previewCharacter.stats.critDamageModifier}%`} description={t('statistics.critDamageModifierDesc')} />
                <StatRow label={t('statistics.attacksPerTurn')} value={previewCharacter.stats.attacksPerRound} description={t('statistics.attacksPerRoundDesc')} />
                <StatRow label={t('statistics.dodgeChance')} value={`${previewCharacter.stats.dodgeChance.toFixed(1)}%`} description={t('statistics.dodgeChanceDesc')} />
                <div className="border-t border-slate-800 my-2 mx-2"></div>
                <StatRow label={t('statistics.armorPenetration')} value={`${previewCharacter.stats.armorPenetrationPercent}% / ${previewCharacter.stats.armorPenetrationFlat}`} description={t('statistics.armorPenetrationDesc')} />
                <StatRow label={t('statistics.lifeSteal')} value={`${previewCharacter.stats.lifeStealPercent}% / ${previewCharacter.stats.lifeStealFlat}`} description={t('statistics.lifeStealDesc')} />
                <StatRow label={t('statistics.manaSteal')} value={`${previewCharacter.stats.manaStealPercent}% / ${previewCharacter.stats.manaStealFlat}`} description={t('statistics.manaStealDesc')} />
            </div>
        </div>
    );
};
