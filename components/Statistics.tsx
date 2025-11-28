


import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, CharacterStats, GameData, Race, CharacterClass, MagicAttackType } from '../types';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { MinusCircleIcon } from './icons/MinusCircleIcon';
import { InfoIcon } from './icons/InfoIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface StatisticsProps {
  character: PlayerCharacter;
  baseCharacter: PlayerCharacter;
  onCharacterUpdate: (character: PlayerCharacter, immediate?: boolean) => void;
  calculateDerivedStats: (character: PlayerCharacter, gameData: GameData | null) => PlayerCharacter;
  gameData: GameData | null;
  onResetAttributes: () => void;
  onSelectClass: (characterClass: CharacterClass) => void;
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
      <div className="w-auto text-right">
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

export const Statistics: React.FC<StatisticsProps> = ({ character, baseCharacter, onCharacterUpdate, calculateDerivedStats, gameData, onResetAttributes, onSelectClass }) => {
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'stats' | 'development' | 'skills' | 'knowledge'>('stats');
  const [knowledgeTab, setKnowledgeTab] = useState<'magicAttacks'>('magicAttacks');
  const [pendingStats, setPendingStats] = useState(baseCharacter.stats);
  const [spentPoints, setSpentPoints] = useState(0);
  const [nextEnergyCountdown, setNextEnergyCountdown] = useState('');

  useEffect(() => {
    // This effect synchronizes the form with the canonical character data from the server.
    // However, we don't want to wipe the user's changes if they are in the middle of
    // assigning points when a background refresh happens.
    // We check `spentPoints`. If it's 0, it means the user is not actively editing,
    // so it's safe to reset the form to match the new `baseCharacter`.
    if (spentPoints === 0) {
        setPendingStats(baseCharacter.stats);
        setSpentPoints(0);
    }
  }, [baseCharacter]);

  useEffect(() => {
    if (character.stats.currentEnergy >= character.stats.maxEnergy) {
      setNextEnergyCountdown('');
      return;
    }

    const calculateCountdown = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const diff = Math.floor((nextHour.getTime() - now.getTime()) / 1000);
      
      const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      setNextEnergyCountdown(`(${minutes}:${seconds})`);
    };

    calculateCountdown(); // Initial call
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, [character.stats.currentEnergy, character.stats.maxEnergy]);

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
    }, true); // Force immediate save to the server
    setSpentPoints(0);
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

  const TABS: { id: 'stats' | 'development' | 'skills' | 'knowledge', label: string }[] = [
      { id: 'stats', label: t('statistics.tabs.stats') },
      { id: 'development', label: t('statistics.tabs.developmentPath') },
      { id: 'skills', label: t('statistics.tabs.skills') },
      { id: 'knowledge', label: t('statistics.tabs.knowledge') },
  ];

  const classOptions: Record<Race, CharacterClass[]> = {
    [Race.Human]: [CharacterClass.Mage, CharacterClass.Warrior, CharacterClass.Rogue],
    [Race.Elf]: [CharacterClass.Wizard, CharacterClass.Hunter, CharacterClass.Druid],
    [Race.Orc]: [CharacterClass.Shaman, CharacterClass.Warrior, CharacterClass.Berserker],
    [Race.Dwarf]: [CharacterClass.Warrior, CharacterClass.Blacksmith, CharacterClass.DungeonHunter],
    [Race.Gnome]: [CharacterClass.Thief, CharacterClass.Engineer, CharacterClass.Warrior],
  };

  const availableClasses = classOptions[character.race] || [];

  const handleClassSelect = (charClass: CharacterClass) => {
    const className = t(`class.${charClass}`);
    if (window.confirm(t('class.confirmMessage', { className }))) {
        onSelectClass(charClass);
    }
  };

  const renderDamageWithBonus = (min: number, max: number, isMagic: boolean) => {
      const barracksLevel = character.guildBarracksLevel || 0;
      if (barracksLevel <= 0) {
          return <span className="font-mono text-base font-bold text-white">{min} - {max}</span>;
      }

      // Reverse calculation to find base
      const multiplier = 1 + (barracksLevel * 0.05);
      const baseMin = Math.ceil(min / multiplier);
      const baseMax = Math.ceil(max / multiplier);
      
      const bonusMin = min - baseMin;
      const bonusMax = max - baseMax;

      if (bonusMin <= 0 && bonusMax <= 0) {
           return <span className="font-mono text-base font-bold text-white">{min} - {max}</span>;
      }

      return (
          <div className="flex flex-col items-end">
              <span className="font-mono text-base font-bold text-white">{min} - {max}</span>
              <span className="text-xs text-amber-400 ml-1">
                  (+{bonusMin}-{bonusMax} {t('guild.buildings.barracks')})
              </span>
          </div>
      );
  };

  return (
    <ContentPanel title={t('statistics.title')}>
      <div className="flex border-b border-slate-700 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
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
                                  <>
                                      <span className="font-mono text-base text-green-400 ml-2">(+{itemBonus})</span>
                                      <span className="font-mono text-base text-sky-400 ml-2">({pendingStats[key] + itemBonus})</span>
                                  </>
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
                  {isFreeReset && <p className="text-xs text-gray-500 mt-2">{t('statistics.reset.freeResetNote')}</p>}
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
               <div>
                  <h3 className="text-xl font-bold text-indigo-400 mb-2">{t('statistics.vitals')}</h3>
                  <div className="space-y-1">
                      <StatRow label={t('statistics.health')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.currentHealth.toFixed(0)} / {previewCharacter.stats.maxHealth}</span>} description={t('statistics.healthDesc')} />
                      <StatRow label={t('statistics.mana')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.currentMana.toFixed(0)} / {previewCharacter.stats.maxMana}</span>} description={t('statistics.manaDesc')} />
                      <StatRow 
                        label={t('statistics.energyLabel')} 
                        value={
                          <div className="flex items-baseline justify-end">
                            <span className="font-mono text-base font-bold text-white">{previewCharacter.stats.currentEnergy} / {previewCharacter.stats.maxEnergy}</span>
                            {nextEnergyCountdown && <span className="text-xs text-gray-400 ml-2 font-mono">{nextEnergyCountdown}</span>}
                          </div>
                        } 
                        description={t('statistics.energyDesc')} 
                      />
                  </div>
              </div>
          </div>
          
          {/* Column 3: Combat Stats */}
           <div className="bg-slate-900/40 p-4 rounded-xl">
            <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('statistics.combatStats')}</h3>
            <div className="space-y-1">
              <StatRow label={t('statistics.physicalDamage')} value={renderDamageWithBonus(previewCharacter.stats.minDamage, previewCharacter.stats.maxDamage, false)} description={t('statistics.physicalDamageDesc')} />
              <StatRow label={t('statistics.magicDamage')} value={renderDamageWithBonus(previewCharacter.stats.magicDamageMin, previewCharacter.stats.magicDamageMax, true)} description={t('statistics.magicDamageDesc')} />
              <StatRow label={t('statistics.armor')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.armor}</span>} description={t('statistics.armorDesc')} />
              <StatRow label={t('statistics.critChance')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.critChance.toFixed(1)}%</span>} description={t('statistics.critChanceDesc')} />
              <StatRow label={t('statistics.critDamageModifier')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.critDamageModifier}%</span>} description={t('statistics.critDamageModifierDesc')} />
              <StatRow label={t('statistics.attacksPerTurn')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.attacksPerRound}</span>} description={t('statistics.attacksPerTurnDesc')} />
              <StatRow label={t('statistics.dodgeChance')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.dodgeChance.toFixed(1)}%</span>} description={t('statistics.dodgeChanceDesc')} />
              <StatRow label={t('statistics.manaRegen')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.manaRegen}</span>} description={t('statistics.manaRegenDesc')} />
              <StatRow label={t('statistics.armorPenetration')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.armorPenetrationPercent}% / {previewCharacter.stats.armorPenetrationFlat}</span>} description={t('statistics.armorPenetrationDesc')} />
              <StatRow label={t('statistics.lifeSteal')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.lifeStealPercent}% / {previewCharacter.stats.lifeStealFlat}</span>} description={t('statistics.lifeStealDesc')} />
              <StatRow label={t('statistics.manaSteal')} value={<span className="font-mono text-base font-bold text-white">{previewCharacter.stats.manaStealPercent}% / {previewCharacter.stats.manaStealFlat}</span>} description={t('statistics.manaStealDesc')} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'development' && (
        <div className="animate-fade-in space-y-8">
          <div className="bg-slate-900/40 p-6 rounded-xl">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('statistics.racialBonusTitle')}</h3>
            <p className="text-lg"><span className="font-semibold text-gray-300">{t(`race.${character.race}`)}:</span></p>
            <p className="mt-2 text-gray-400 italic" style={{ whiteSpace: 'pre-line' }}>{t(`raceBonuses.${character.race}`)}</p>
          </div>

           <div className="bg-slate-900/40 p-6 rounded-xl">
                {character.characterClass ? (
                     <div>
                        <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('class.currentClass')}</h3>
                        <p className="text-xl font-semibold text-amber-400">{t(`class.${character.characterClass}`)}</p>
                        <p className="mt-2 text-gray-400 italic" style={{ whiteSpace: 'pre-line' }}>{t(`class.${character.characterClass}Description`)}</p>
                    </div>
                ) : character.level >= 10 ? (
                    <div>
                        <h3 className="text-2xl font-bold text-indigo-400 mb-2">{t('class.title')}</h3>
                        <p className="text-gray-400 italic mb-6">{t('class.description')}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {availableClasses.map(charClass => (
                                <div key={charClass} className="bg-slate-800/50 p-4 rounded-lg flex flex-col justify-between text-center border border-slate-700 hover:border-indigo-500 transition-colors">
                                    <div>
                                        <h4 className="text-xl font-bold text-amber-400 mb-2">{t(`class.${charClass}`)}</h4>
                                        <p className="text-sm text-gray-300 mb-4">{t(`class.${charClass}Description`)}</p>
                                    </div>
                                    <button
                                        onClick={() => handleClassSelect(charClass)}
                                        className="mt-4 w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        {t('class.select')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="animate-fade-in space-y-8">
            {(() => {
                const learnedSkillIds = character.learnedSkills || [];
                if (learnedSkillIds.length === 0) {
                    return <p className="text-gray-500 text-center py-8">{t('skills.noSkills')}</p>;
                }
                
                const learnedSkills = (gameData?.skills || []).filter(s => learnedSkillIds.includes(s.id));
                const passiveSkills = learnedSkills.filter(s => s.category === 'Passive');
                const activeSkills = learnedSkills.filter(s => s.category === 'Active');

                return (
                    <>
                        {passiveSkills.length > 0 && (
                            <div className="bg-slate-900/40 p-6 rounded-xl">
                                <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('skills.passive')}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {passiveSkills.map(skill => (
                                        <div key={skill.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                            <h4 className="font-bold text-amber-400">{skill.name}</h4>
                                            <p className="text-sm text-gray-300 mt-1">{skill.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeSkills.length > 0 && (
                            <div className="bg-slate-900/40 p-6 rounded-xl">
                                <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('skills.active')}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {activeSkills.map(skill => (
                                        <div key={skill.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                            <h4 className="font-bold text-amber-400">{skill.name}</h4>
                                            <p className="text-sm text-gray-300 mt-1">{skill.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}
        </div>
      )}

        {activeTab === 'knowledge' && (
            <div className="animate-fade-in">
                <div className="flex border-b border-slate-800 mb-6">
                    <button
                        onClick={() => setKnowledgeTab('magicAttacks')}
                        className={`px-4 py-2 text-xs font-medium ${knowledgeTab === 'magicAttacks' ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Ataki Magiczne
                    </button>
                    {/* Future tabs can be added here */}
                </div>
                {knowledgeTab === 'magicAttacks' && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.values(MagicAttackType).map(attack => (
                            <div key={attack} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                <h4 className="font-bold text-lg text-purple-400 mb-2">{t(`item.magic.${attack}`)}</h4>
                                <p className="text-sm text-gray-300">{t(`item.magicDescriptions.${attack}`)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
    </ContentPanel>
  );
};