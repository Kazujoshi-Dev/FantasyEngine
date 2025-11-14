import React from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, CharacterStats } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

interface StatisticsProps {
  character: PlayerCharacter;
}

const StatRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-slate-700/50">
    <span className="font-medium text-gray-300">{label}</span>
    <span className="font-mono text-lg font-bold text-white">{value}</span>
  </div>
);

export const Statistics: React.FC<StatisticsProps> = ({ character }) => {
  const { t } = useTranslation();
  const { stats } = character;

  const experiencePercentage = (character.experience / character.experienceToNextLevel) * 100;

  return (
    <ContentPanel title={t('statistics.title')}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Base Attributes */}
        <div className="bg-slate-900/40 p-6 rounded-xl">
          <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('statistics.baseAttributes')}</h3>
          <div className="space-y-2">
            <StatRow label={t('statistics.strength')} value={stats.strength} />
            <StatRow label={t('statistics.agility')} value={stats.agility} />
            <StatRow label={t('statistics.accuracy')} value={stats.accuracy} />
            <StatRow label={t('statistics.stamina')} value={stats.stamina} />
            <StatRow label={t('statistics.intelligence')} value={stats.intelligence} />
            <StatRow label={t('statistics.energy')} value={stats.energy} />
          </div>
        </div>

        {/* Right Column: Derived Stats & Info */}
        <div className="space-y-8">
            <div className="bg-slate-900/40 p-6 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white">{t('statistics.level')} {character.level}</span>
                    <span className="font-mono text-sky-300">{character.experience} / {character.experienceToNextLevel} XP</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: `${experiencePercentage}%` }}></div>
                </div>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-xl">
              <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('statistics.derivedStats')}</h3>
              <div className="space-y-2">
                <StatRow label={t('statistics.health')} value={`${stats.currentHealth} / ${stats.maxHealth}`} />
                <StatRow label={t('statistics.energyLabel')} value={`${stats.currentEnergy} / ${stats.maxEnergy}`} />
              </div>
            </div>
        </div>

      </div>
    </ContentPanel>
  );
};