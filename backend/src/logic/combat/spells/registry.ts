
import { MagicAttackType } from '../../../types.js';
import { SpellLogic } from './types.js';
import { castArcaneMissile } from './arcaneMissile.js';
import { castChainLightning } from './chainLightning.js';
import { castFireball, castFrostWave, castIceLance, castLightningStrike } from './elementalSpells.js';
import { castShadowBolt } from './shadowBolt.js';
import { castEarthquake, castLifeDrain, castMeteorSwarm } from './utilitySpells.js';

export const spellRegistry: Record<MagicAttackType, SpellLogic> = {
    [MagicAttackType.Fireball]: castFireball,
    [MagicAttackType.LightningStrike]: castLightningStrike,
    [MagicAttackType.ShadowBolt]: castShadowBolt,
    [MagicAttackType.FrostWave]: castFrostWave,
    [MagicAttackType.ChainLightning]: castChainLightning,
    [MagicAttackType.IceLance]: castIceLance,
    [MagicAttackType.ArcaneMissile]: castArcaneMissile,
    [MagicAttackType.LifeDrain]: castLifeDrain,
    [MagicAttackType.MeteorSwarm]: castMeteorSwarm,
    [MagicAttackType.Earthquake]: castEarthquake,
};
