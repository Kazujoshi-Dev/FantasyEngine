
import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData, SpecialAttackType } from '../../../types.js';
import { performAttack, AttackerState, DefenderState, StatusEffect } from '../core.js';

export interface TeamCombatPlayerState {
  data: PlayerCharacter;
  currentHealth: number;
  currentMana: number;
  isDead: boolean;
  statusEffects: StatusEffect[];
  hardSkinTriggered?: boolean;
  manaSurgeUsed?: boolean;
  shadowBoltStacks?: number;
}

const defaultEnemyStats: EnemyStats = {
    maxHealth: 1,
    minDamage: 1,
    maxDamage: 1,
    armor: 0,
    critChance: 0,
    agility: 1,
    attacksPerTurn: 1,
    critDamageModifier: 150,
    dodgeChance: 0,
    magicAttackChance: 0,
    magicAttackManaCost: 0,
    magicDamageMax: 0,
    magicDamageMin: 0,
    manaRegen: 0,
    maxMana: 0,
};

export const simulateTeamVsBossCombat = (
    playersData: PlayerCharacter[],
    bossData: Enemy,
    gameData: GameData
): { combatLog: CombatLogEntry[], finalPlayers: TeamCombatPlayerState[] } => {
    
    let playersState: TeamCombatPlayerState[] = playersData.map(p => ({
        data: p,
        currentHealth: p.stats.currentHealth,
        currentMana: p.stats.currentMana,
        isDead: p.stats.currentHealth <= 0,
        statusEffects: [],
        manaSurgeUsed: false,
        hardSkinTriggered: false,
        shadowBoltStacks: 0
    }));

    const effectiveBossStats = { ...defaultEnemyStats, ...(bossData.stats || {}) };
    let bossState: AttackerState & { specialAttacksUsed: Record<string, number> } = {
        stats: effectiveBossStats,
        currentHealth: effectiveBossStats.maxHealth,
        currentMana: effectiveBossStats.maxMana || 0,
        name: bossData.name,
        statusEffects: [],
        specialAttacksUsed: (bossData.specialAttacks || []).reduce((acc, sa) => ({ ...acc, [sa.type]: 0 }), {}),
        isEmpowered: false,
    };

    const log: CombatLogEntry[] = [];
    let turn = 0;

    const getHealthStateForLog = () => ({
        playerHealth: 0, 
        playerMana: 0,
        enemyHealth: bossState.currentHealth,
        enemyMana: bossState.currentMana,
        allPlayersHealth: playersState.map(p => ({ name: p.data.name, currentHealth: p.currentHealth, maxHealth: p.data.stats.maxHealth })),
        allEnemiesHealth: [{ uniqueId: 'boss', name: bossState.name, currentHealth: bossState.currentHealth, maxHealth: bossState.stats.maxHealth }]
    });

    const partyStats: Record<string, CharacterStats> = {};
    playersState.forEach(p => { partyStats[p.data.name] = p.data.stats; });

    log.push({
        turn, attacker: 'Drużyna', defender: bossState.name, action: 'starts a fight with',
        ...getHealthStateForLog(), 
        playerStats: playersData[0]?.stats, 
        enemyStats: bossState.stats as EnemyStats, 
        enemyDescription: bossData.description,
        partyMemberStats: partyStats
    });
    
    // --- Turn 0: Ranged ---
    for (const player of playersState) {
        const weapon = player.data.equipment?.mainHand || player.data.equipment?.twoHand;
        const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;
        if (template?.isRanged && bossState.currentHealth > 0) {
             const attackOptions: any = { hand: 'main' };
             if (player.data.characterClass === CharacterClass.Warrior) {
                 attackOptions.critChanceOverride = 100;
                 attackOptions.ignoreDodge = true;
             }
             const { logs, attackerState, defenderState } = performAttack({ ...player, stats: player.data.stats, name: player.data.name }, { ...bossState, stats: bossState.stats, name: bossState.name }, 0, gameData, [], false, attackOptions);
             Object.assign(player, attackerState);
             bossState.currentHealth = defenderState.currentHealth;
             log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));

             if (bossState.currentHealth <= 0) {
                 log.push({ turn: 0, attacker: player.data.name, defender: bossState.name, action: 'enemy_death', ...getHealthStateForLog() });
             }
        }
    }

    while (playersState.some(p => !p.isDead) && bossState.currentHealth > 0 && turn < 100) {
        turn++;
        
        // Regen / Status Tick
        const allCombatants: any[] = [...playersState.filter(p => !p.isDead), bossState];
        for (const combatant of allCombatants) {
            const stats = combatant.stats || combatant.data?.stats;
            if (stats?.manaRegen) combatant.currentMana = Math.min(stats.maxMana || 0, combatant.currentMana + stats.manaRegen);
            combatant.statusEffects = combatant.statusEffects.map((e: StatusEffect) => ({...e, duration: e.duration - 1})).filter((e: StatusEffect) => e.duration > 0);
        }

        // Kolejka Akcji
        interface ActionEntity { type: 'player' | 'boss'; index: number; name: string; agility: number; }
        const queue: ActionEntity[] = [];
        playersState.forEach((p, index) => { if (!p.isDead) queue.push({ type: 'player', index, name: p.data.name, agility: p.data.stats.agility }); });
        if (bossState.currentHealth > 0) queue.push({ type: 'boss', index: -1, name: bossState.name, agility: (bossState.stats as EnemyStats).agility });

        queue.sort((a, b) => b.agility - a.agility);

        for (const actor of queue) {
            if (bossState.currentHealth <= 0) break;
            if (actor.type === 'player') {
                const player = playersState[actor.index];
                if (player.isDead || player.statusEffects.some(e => e.type === 'stunned')) continue;

                const attacks = player.data.stats.attacksPerRound;
                const isDual = player.data.activeSkills?.includes('dual-wield-mastery') && player.data.equipment?.offHand;

                for (let i = 0; i < attacks; i++) {
                    const hands: ('main' | 'off')[] = isDual ? ['main', 'off'] : ['main'];
                    for (const hand of hands) {
                        if (bossState.currentHealth <= 0) break;
                        const attackOptions: any = { hand };
                        if (player.data.characterClass === CharacterClass.Warrior && i === 0 && hand === 'main') {
                            attackOptions.critChanceOverride = 100;
                            attackOptions.ignoreDodge = true;
                        }
                        const { logs, attackerState, defenderState } = performAttack({ ...player, stats: player.data.stats, name: player.data.name }, { ...bossState, stats: bossState.stats, name: bossState.name }, turn, gameData, [], false, attackOptions);
                        Object.assign(player, attackerState);
                        Object.assign(bossState, defenderState);
                        log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));

                        if (bossState.currentHealth <= 0) {
                            log.push({ turn, attacker: player.data.name, defender: bossState.name, action: 'enemy_death', ...getHealthStateForLog() });
                            break;
                        }
                    }
                }
            } else {
                const bossAttacks = (bossState.stats as EnemyStats).attacksPerTurn || 1;
                for (let i = 0; i < bossAttacks; i++) {
                    const living = playersState.filter(p => !p.isDead);
                    if (living.length === 0) break;
                    const target = living[Math.floor(Math.random() * living.length)];
                    const tIdx = playersState.findIndex(p => p.data.id === target.data.id);
                    const { logs, attackerState, defenderState } = performAttack({ ...bossState }, { ...playersState[tIdx], stats: playersState[tIdx].data.stats, name: playersState[tIdx].data.name }, turn, gameData, []);
                    Object.assign(bossState, attackerState);
                    Object.assign(playersState[tIdx], defenderState);
                    log.push(...logs.map(l => ({...l, ...getHealthStateForLog()})));

                    if (playersState[tIdx].currentHealth <= 0) {
                        playersState[tIdx].isDead = true;
                        log.push({ turn, attacker: bossState.name, defender: playersState[tIdx].data.name, action: 'death', ...getHealthStateForLog() });
                    }
                }
            }
        }

        if (bossState.currentHealth <= 0) break;
    }

    return { combatLog: log, finalPlayers: playersState };
};
