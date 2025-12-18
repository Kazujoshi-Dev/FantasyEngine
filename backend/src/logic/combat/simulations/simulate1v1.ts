import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../../../types.js';
import { performAttack, AttackerState } from '../core.js';

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
    maxMana: 0,
    manaRegen: 0,
    magicDamageMin: 0,
    magicDamageMax: 0,
    magicAttackChance: 0,
    magicAttackManaCost: 0,
};

export const simulate1v1Combat = (playerData: PlayerCharacter, enemyData: Enemy, gameData: GameData): CombatLogEntry[] => {
    
    let playerState: AttackerState & {data: PlayerCharacter} = {
        data: playerData,
        stats: playerData.stats,
        currentHealth: playerData.stats.currentHealth,
        currentMana: playerData.stats.currentMana,
        name: playerData.name,
        hardSkinTriggered: false,
        manaSurgeUsed: false,
        shadowBoltStacks: 0,
        statusEffects: [],
    };
    
    const effectiveEnemyStats = { ...defaultEnemyStats, ...(enemyData.stats || {}) };

    let enemyState: AttackerState & {description?: string} = {
        stats: effectiveEnemyStats,
        currentHealth: effectiveEnemyStats.maxHealth,
        currentMana: effectiveEnemyStats.maxMana || 0,
        name: enemyData.name,
        description: enemyData.description,
        hardSkinTriggered: false,
        shadowBoltStacks: 0,
        statusEffects: [],
    };

    const log: CombatLogEntry[] = [];
    let turn = 0;

    const getHealthSnapshot = () => ({
        playerHealth: playerState.currentHealth,
        playerMana: playerState.currentMana,
        enemyHealth: enemyState.currentHealth,
        enemyMana: enemyState.currentMana,
        allPlayersHealth: [{ name: playerState.name, currentHealth: playerState.currentHealth, maxHealth: playerState.stats.maxHealth }],
        allEnemiesHealth: [{ uniqueId: enemyData.uniqueId || 'enemy-0', name: enemyState.name, currentHealth: enemyState.currentHealth, maxHealth: enemyState.stats.maxHealth }]
    });

    log.push({
        turn, attacker: playerState.name, defender: enemyState.name, action: 'starts a fight with',
        ...getHealthSnapshot(),
        playerStats: playerState.stats as CharacterStats, enemyStats: enemyState.stats as EnemyStats, enemyDescription: enemyState.description
    });
    
    // --- Turn 0: Ranged Weapons Logic ---
    const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
    const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

    if (template?.isRanged && enemyState.currentHealth > 0) {
        const attackOptions: { ignoreDodge?: boolean, critChanceOverride?: number } = {};
        if (playerData.characterClass === CharacterClass.Warrior) {
            attackOptions.critChanceOverride = 100;
            attackOptions.ignoreDodge = true;
        }

        const { logs: attackLogs, attackerState, defenderState } = performAttack(playerState, enemyState, 0, gameData, [], false, attackOptions);
        log.push(...attackLogs.map(l => ({ ...l, ...getHealthSnapshot() })));
        Object.assign(playerState, attackerState);
        Object.assign(enemyState, defenderState);

        if (playerData.characterClass === CharacterClass.Hunter && enemyState.currentHealth > 0) {
             const { logs: hunterLogs, defenderState: hunterDefenderState } = performAttack(playerState, enemyState, 0, gameData, []);
             const lastLog = hunterLogs[hunterLogs.length - 1];
             if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge) {
                const originalDamage = lastLog.damage;
                const reducedDamage = Math.floor(originalDamage * 0.5);
                const diff = originalDamage - reducedDamage;
                lastLog.damage = reducedDamage;
                hunterDefenderState.currentHealth += diff;
                Object.assign(enemyState, hunterDefenderState);
             }
             log.push(...hunterLogs.map(l => ({ ...l, ...getHealthSnapshot(), action: 'hunter_bonus_shot' })));
        }
    }

    let playerAttacksFirst = (playerData.race === Race.Elf) || (playerState.stats.agility >= enemyState.stats.agility);

    while (playerState.currentHealth > 0 && enemyState.currentHealth > 0 && turn < 100) {
        turn++;
        
        // Shaman power logic would be placed here if needed
        
        const turnParticipants = playerAttacksFirst ? [playerState, enemyState] : [enemyState, playerState];
        for(const combatant of turnParticipants) {
            // Mana Regen
            const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0) {
                combatant.currentMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
            }
            // Burning
            const burningEffect = combatant.statusEffects.find(e => e.type === 'burning');
            if (burningEffect) {
                const burnDamage = Math.floor(combatant.stats.maxHealth * 0.05);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - burnDamage);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burningTarget', damage: burnDamage, ...getHealthSnapshot() });
            }
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        const attacker = playerAttacksFirst ? playerState : enemyState;
        const defender = playerAttacksFirst ? enemyState : playerState;

        if (attacker.currentHealth > 0) {
            const isPlayerAttacking = 'data' in attacker;
            const attacks = isPlayerAttacking ? (attacker.stats as CharacterStats).attacksPerRound : (attacker.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = attacker.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, attacks - reducedAttacks);
            
            if (attacker.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthSnapshot() });
            } else {
                 for (let i = 0; i < finalAttacks && defender.currentHealth > 0; i++) {
                    const { logs: attackLogs, attackerState, defenderState } = performAttack(attacker, defender, turn, gameData, [], false);
                    log.push(...attackLogs.map(l => ({ ...l, ...getHealthSnapshot() })));
                    Object.assign(attacker, attackerState);
                    Object.assign(defender, defenderState);
                }
            }
        }
        
        // Berserker frenzy logic would be placed here if needed
    }
    
    return log;
};