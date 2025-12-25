import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData, ItemCategory } from '../../../types.js';
import { performAttack, AttackerState, DefenderState, StatusEffect } from '../core.js';
import { randomUUID } from 'crypto';

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
    blockChance: 0,
    magicAttackChance: 0,
    magicAttackManaCost: 0,
    magicDamageMax: 0,
    magicDamageMin: 0,
    manaRegen: 0,
    maxMana: 0,
};

export const simulate1vManyCombat = (
    playerData: PlayerCharacter,
    enemiesData: Enemy[],
    gameData: GameData
): CombatLogEntry[] => {
    
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

    const nameCounts: Record<string, number> = {};
    enemiesData.forEach(e => {
        nameCounts[e.name] = (nameCounts[e.name] || 0) + 1;
    });
    
    const nameIterators: Record<string, number> = {};

    const enemiesState = enemiesData.map(e => {
        let displayName = e.name;
        if (nameCounts[e.name] > 1) {
            nameIterators[e.name] = (nameIterators[e.name] || 0) + 1;
            displayName = `${e.name} ${nameIterators[e.name]}`;
        }

        return {
            uniqueId: e.uniqueId || randomUUID(),
            stats: { ...defaultEnemyStats, ...(e.stats || {}) },
            currentHealth: e.stats.maxHealth,
            currentMana: e.stats.maxMana || 0,
            name: displayName,
            hardSkinTriggered: false,
            shadowBoltStacks: 0,
            statusEffects: [],
            data: undefined
        } as AttackerState & { uniqueId: string };
    });

    const log: CombatLogEntry[] = [];
    let turn = 0;

    const getHealthState = () => ({
        playerHealth: playerState.currentHealth,
        playerMana: playerState.currentMana,
        enemyHealth: enemiesState.reduce((sum: number, e: AttackerState) => sum + Math.max(0, e.currentHealth), 0),
        enemyMana: 0,
        allEnemiesHealth: enemiesState.map(e => ({ 
            uniqueId: e.uniqueId, 
            name: e.name, 
            currentHealth: e.currentHealth, 
            maxHealth: e.stats.maxHealth 
        }))
    });

    log.push({
        turn, attacker: playerState.name, defender: 'Grupa Wrogów', action: 'starts a fight with',
        ...getHealthState(),
        playerStats: playerState.stats as CharacterStats, 
        enemyStats: enemiesState[0].stats as EnemyStats
    });

    const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
    const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

    if (template?.isRanged) {
        const target = enemiesState.find(e => e.currentHealth > 0);
        if (target) {
            const attackOptions: any = { hand: 'main' };
            if (playerData.characterClass === CharacterClass.Warrior) {
                attackOptions.critChanceOverride = 100;
                attackOptions.ignoreDodge = true;
            }
            const { logs: attackLogs, attackerState, defenderState } = performAttack(playerState, target, 0, gameData, enemiesState, false, attackOptions);
            Object.assign(playerState, attackerState);
            const tIdx = enemiesState.findIndex(e => e.uniqueId === target.uniqueId);
            enemiesState[tIdx] = defenderState as any;
            log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));

            if (enemiesState[tIdx].currentHealth <= 0) {
                log.push({ turn: 0, attacker: playerState.name, defender: enemiesState[tIdx].name, action: 'enemy_death', ...getHealthState() });
            }
        }
    }

    while (playerState.currentHealth > 0 && enemiesState.some(e => e.currentHealth > 0) && turn < 100) {
        turn++;
        
        const allCombatants: AttackerState[] = [playerState, ...enemiesState.filter(e => e.currentHealth > 0)];
        for(const combatant of allCombatants) {
            const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0) combatant.currentMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
            
            const burnEffects = combatant.statusEffects.filter(e => e.type === 'burning');
            if (burnEffects.length > 0) {
                const totalDmg = burnEffects.reduce((sum: number, _: StatusEffect) => sum + Math.floor(combatant.stats.maxHealth * 0.05), 0);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - totalDmg);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burningTarget', damage: totalDmg, ...getHealthState() });
                
                if (combatant.currentHealth <= 0) {
                    const isPlayer = combatant.name === playerState.name;
                    log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: isPlayer ? 'death' : 'enemy_death', ...getHealthState() });
                }
            }
            
            const isDwarfResistant = (combatant as any).data?.race === Race.Dwarf && (combatant as any).data?.learnedSkills?.includes('bedrock-foundation');
            const reduction = isDwarfResistant ? 2 : 1;

            combatant.statusEffects = combatant.statusEffects
                .map(e => ({...e, duration: e.duration - reduction}))
                .filter(e => e.duration > 0);
        }
        
        if (playerState.currentHealth <= 0) break;

        if (playerState.currentHealth > 0) {
            if (playerState.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                 log.push({ turn, attacker: playerState.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState() });
            } else {
                const attacks = (playerState.stats as CharacterStats).attacksPerRound || 1;
                const reducedAttacksCount = playerState.statusEffects.filter(e => e.type === 'reduced_attacks').reduce((sum: number, e: StatusEffect) => sum + (e.amount || 1), 0);
                const finalAttacks = Math.max(1, Math.floor(attacks - reducedAttacksCount));
                
                // --- DUAL WIELD VALIDATION ---
                const hands: ('main' | 'off')[] = ['main'];
                if (playerState.data.activeSkills?.includes('dual-wield-mastery') && playerState.data.equipment?.offHand) {
                    const ohItem = playerState.data.equipment.offHand;
                    const ohTemplate = gameData.itemTemplates.find(t => t.id === ohItem.templateId);
                    if (ohTemplate?.category === ItemCategory.Weapon) {
                        hands.push('off');
                    }
                }

                for(let i = 0; i < finalAttacks; i++) {
                    for (const hand of hands) {
                        const targetIndex = enemiesState.findIndex(e => e.currentHealth > 0);
                        if (targetIndex === -1) break;
                        const target = enemiesState[targetIndex];

                        const attackOptions: any = { hand };
                        if (playerData.characterClass === CharacterClass.Warrior && i === 0 && hand === 'main') {
                            attackOptions.ignoreDodge = true;
                            attackOptions.critChanceOverride = 100;
                        }

                        const { logs: attackLogs, attackerState, defenderState } = performAttack(playerState, target, turn, gameData, enemiesState, false, attackOptions);
                        Object.assign(playerState, attackerState);
                        enemiesState[targetIndex] = defenderState as any;
                        log.push(...attackLogs.map(l => ({...l, ...getHealthState()})));
                        
                        if (enemiesState[targetIndex].currentHealth <= 0) {
                            log.push({ turn, attacker: playerState.name, defender: enemiesState[targetIndex].name, action: 'enemy_death', ...getHealthState() });
                        }
                    }
                }
            }
        }

        const livingEnemies = enemiesState.filter(e => e.currentHealth > 0);
        for (const enemy of livingEnemies) {
            if (playerState.currentHealth <= 0) break;
            const enemyAttacks = (enemy.stats as EnemyStats).attacksPerTurn || 1;
            for(let i = 0; i < enemyAttacks; i++) {
                if (playerState.currentHealth <= 0) break;
                const { logs: attLogs, attackerState, defenderState } = performAttack(enemy, playerState, turn, gameData, []);
                const eIdx = enemiesState.findIndex(e => e.uniqueId === enemy.uniqueId);
                Object.assign(enemiesState[eIdx], attackerState);
                Object.assign(playerState, defenderState);
                log.push(...attLogs.map(l => ({...l, ...getHealthState()})));

                if (playerState.currentHealth <= 0) {
                    log.push({ turn, attacker: enemy.name, defender: playerState.name, action: 'death', ...getHealthState() });
                    break;
                }
            }
        }
    }
    
    return log;
};