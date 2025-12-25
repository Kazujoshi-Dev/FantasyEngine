import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData, ItemCategory } from '../../../types.js';
import { performAttack, AttackerState, DefenderState, getFullWeaponName, StatusEffect } from '../core.js';

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

    const getHealthState = (pState: typeof playerState, eState: typeof enemyState) => ({
        playerHealth: pState.currentHealth, playerMana: pState.currentMana,
        enemyHealth: eState.currentHealth, enemyMana: eState.currentMana
    });

    log.push({
        turn, attacker: playerState.name, defender: enemyState.name, action: 'starts a fight with',
        playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
        enemyHealth: enemyState.currentHealth, enemyMana: enemyState.currentMana,
        playerStats: playerState.stats as CharacterStats, enemyStats: enemyState.stats as EnemyStats, enemyDescription: enemyState.description
    });
    
    const weapon = playerData.equipment?.mainHand || playerData.equipment?.twoHand;
    const template = weapon ? (gameData.itemTemplates || []).find(t => t.id === weapon.templateId) : null;

    if (template?.isRanged && enemyState.currentHealth > 0) {
        const attackOptions: { ignoreArmor?: boolean, ignoreDodge?: boolean, critChanceOverride?: number } = {};
        if (playerData.characterClass === CharacterClass.Warrior) {
            attackOptions.critChanceOverride = 100;
            attackOptions.ignoreDodge = true;
        }

        const { logs: attackLogs, attackerState, defenderState } = performAttack(playerState, enemyState, 0, gameData, [], false, attackOptions);
        log.push(...attackLogs);
        Object.assign(playerState, attackerState);
        Object.assign(enemyState, defenderState);

        if (playerData.characterClass === CharacterClass.Hunter && enemyState.currentHealth > 0) {
             const { logs: hunterLogs, defenderState: hunterDefenderState } = performAttack(playerState, enemyState, 0, gameData, []);
             const lastLog = hunterLogs[hunterLogs.length - 1];
             if (lastLog && lastLog.damage !== undefined && !lastLog.isDodge && !lastLog.isBlock) {
                const originalDamage = lastLog.damage;
                const reducedDamage = Math.floor(originalDamage * 0.5);
                const diff = originalDamage - reducedDamage;
                lastLog.damage = reducedDamage;
                hunterDefenderState.currentHealth += diff;
                lastLog.enemyHealth = hunterDefenderState.currentHealth;
                Object.assign(enemyState, hunterDefenderState);
             }
             log.push(...hunterLogs.map(l => ({ ...l, action: 'hunter_bonus_shot' })));
        }
    }

    let playerAttacksFirst = (playerData.race === Race.Elf) || (playerState.stats.agility >= enemyState.stats.agility);

    while (playerState.currentHealth > 0 && enemyState.currentHealth > 0 && turn < 100) {
        turn++;
        
        const turnParticipants = playerAttacksFirst ? [playerState, enemyState] : [enemyState, playerState];
        for(const combatant of turnParticipants) {
            const manaRegen = combatant.stats.manaRegen || 0;
            if (manaRegen > 0) {
                const newMana = Math.min(combatant.stats.maxMana || 0, combatant.currentMana + manaRegen);
                const manaGained = newMana - combatant.currentMana;
                if(manaGained > 0) {
                    combatant.currentMana = newMana;
                    log.push({ turn, attacker: combatant.name, defender: '', action: 'manaRegen', manaGained, ...getHealthState(playerState, enemyState) });
                }
            }

            const burningEffects = combatant.statusEffects.filter(e => e.type === 'burning');
            if (burningEffects.length > 0) {
                const totalBurnDamage = burningEffects.reduce((sum: number, _: StatusEffect) => sum + Math.floor(combatant.stats.maxHealth * 0.05), 0);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - totalBurnDamage);
                log.push({ 
                    turn, 
                    attacker: 'Podpalenie', 
                    defender: combatant.name, 
                    action: 'effectApplied', 
                    effectApplied: 'burningTarget', 
                    damage: totalBurnDamage, 
                    ...getHealthState(playerState, enemyState) 
                });
            }

            const isDwarfResistant = (combatant as any).data?.race === Race.Dwarf && (combatant as any).data?.learnedSkills?.includes('bedrock-foundation');
            const reduction = isDwarfResistant ? 2 : 1;
            
            combatant.statusEffects = combatant.statusEffects
                .map(e => ({...e, duration: e.duration - reduction}))
                .filter(e => e.duration > 0);
        }

        const attacker = playerAttacksFirst ? playerState : enemyState;
        const defender = playerAttacksFirst ? enemyState : playerState;

        if (attacker.currentHealth > 0) {
            const isPlayer = 'data' in attacker;
            const stats = attacker.stats;
            const attacks = isPlayer ? (stats as CharacterStats).attacksPerRound : (stats as EnemyStats).attacksPerTurn || 1;
            
            const reducedAttacksCount = attacker.statusEffects.filter(e => e.type === 'reduced_attacks').reduce((sum: number, e: StatusEffect) => sum + (e.amount || 1), 0);
            const finalAttacks = Math.max(1, Math.floor(attacks - reducedAttacksCount));
            
            if (attacker.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                const pData = isPlayer ? (attacker as any).data as PlayerCharacter : null;
                
                // --- DUAL WIELD VALIDATION ---
                const hands: ('main' | 'off')[] = ['main'];
                if (pData?.activeSkills?.includes('dual-wield-mastery') && pData?.equipment?.offHand) {
                    const ohItem = pData.equipment.offHand;
                    const ohTemplate = gameData.itemTemplates.find(t => t.id === ohItem.templateId);
                    if (ohTemplate?.category === ItemCategory.Weapon) {
                        hands.push('off');
                    }
                }
                
                for (let i = 0; i < finalAttacks && defender.currentHealth > 0; i++) {
                    for (const hand of hands) {
                        if (defender.currentHealth <= 0) break;
                        const attackOptions: any = { hand };
                        if (pData?.characterClass === CharacterClass.Warrior && i === 0 && hand === 'main') {
                            attackOptions.ignoreDodge = true;
                            attackOptions.critChanceOverride = 100;
                        }
                        const { logs: attackLogs, attackerState, defenderState } = performAttack(attacker, defender, turn, gameData, [], false, attackOptions);
                        log.push(...attackLogs);
                        Object.assign(attacker, attackerState);
                        Object.assign(defender, defenderState);
                    }
                }
            }
        }
        
        if (defender.currentHealth > 0) {
            const isPlayer = 'data' in defender;
            const stats = defender.stats;
            const attacks = isPlayer ? (stats as CharacterStats).attacksPerRound : (stats as EnemyStats).attacksPerTurn || 1;
            
            const reducedAttacksCount = defender.statusEffects.filter(e => e.type === 'reduced_attacks').reduce((sum: number, e: StatusEffect) => sum + (e.amount || 1), 0);
            const finalAttacks = Math.max(1, Math.floor(attacks - reducedAttacksCount));

             if (defender.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: defender.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                const pData = isPlayer ? (defender as any).data as PlayerCharacter : null;
                
                // --- DUAL WIELD VALIDATION ---
                const hands: ('main' | 'off')[] = ['main'];
                if (pData?.activeSkills?.includes('dual-wield-mastery') && pData?.equipment?.offHand) {
                    const ohItem = pData.equipment.offHand;
                    const ohTemplate = gameData.itemTemplates.find(t => t.id === ohItem.templateId);
                    if (ohTemplate?.category === ItemCategory.Weapon) {
                        hands.push('off');
                    }
                }

                for (let i = 0; i < finalAttacks && attacker.currentHealth > 0; i++) {
                    for (const hand of hands) {
                        if (attacker.currentHealth <= 0) break;
                        const attackOptions: any = { hand };
                        if (pData?.characterClass === CharacterClass.Warrior && i === 0 && hand === 'main') {
                            attackOptions.ignoreDodge = true;
                            attackOptions.critChanceOverride = 100;
                        }
                        const { logs: attackLogs, attackerState, defenderState } = performAttack(defender, attacker, turn, gameData, [], false, attackOptions);
                        log.push(...attackLogs);
                        Object.assign(defender, attackerState);
                        Object.assign(attacker, defenderState);
                    }
                }
            }
        }
        playerAttacksFirst = playerState.stats.agility >= enemyState.stats.agility;
    }

    if (enemyState.currentHealth <= 0) {
        log.push({ turn, attacker: playerState.name, defender: enemyState.name, action: 'enemy_death', ...getHealthState(playerState, enemyState) });
    } else if (playerState.currentHealth <= 0) {
        log.push({ turn, attacker: enemyState.name, defender: playerState.name, action: 'death', ...getHealthState(playerState, enemyState) });
    }
    
    return log;
};