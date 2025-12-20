
import { PlayerCharacter, Enemy, CombatLogEntry, CharacterStats, EnemyStats, Race, MagicAttackType, CharacterClass, GameData } from '../../../types.js';
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

    log.push({
        turn, attacker: playerState.name, defender: enemyState.name, action: 'starts a fight with',
        playerHealth: playerState.currentHealth, playerMana: playerState.currentMana,
        enemyHealth: enemyState.currentHealth, enemyMana: enemyState.currentMana,
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
        log.push(...attackLogs);
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
                lastLog.enemyHealth = hunterDefenderState.currentHealth;
                Object.assign(enemyState, hunterDefenderState);
             }
             log.push(...hunterLogs.map(l => ({ ...l, action: 'hunter_bonus_shot' })));
        }
    }

    let playerAttacksFirst = (playerData.race === Race.Elf) || (playerState.stats.agility >= enemyState.stats.agility);

    while (playerState.currentHealth > 0 && enemyState.currentHealth > 0 && turn < 100) {
        turn++;
        
        const getHealthState = (pState: typeof playerState, eState: typeof enemyState) => ({
            playerHealth: pState.currentHealth, playerMana: pState.currentMana,
            enemyHealth: eState.currentHealth, enemyMana: eState.currentMana
        });

        // --- Efekty początku tury ---
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
            const burningEffect = combatant.statusEffects.find(e => e.type === 'burning');
            if (burningEffect) {
                const burnDamage = Math.floor(combatant.stats.maxHealth * 0.05);
                combatant.currentHealth = Math.max(0, combatant.currentHealth - burnDamage);
                log.push({ turn, attacker: 'Podpalenie', defender: combatant.name, action: 'effectApplied', effectApplied: 'burningTarget', damage: burnDamage, ...getHealthState(playerState, enemyState) });
            }
            combatant.statusEffects = combatant.statusEffects.map(e => ({...e, duration: e.duration - 1})).filter(e => e.duration > 0);
        }

        const attacker = playerAttacksFirst ? playerState : enemyState;
        const defender = playerAttacksFirst ? enemyState : playerState;

        // --- Ruch Atakującego ---
        if (attacker.currentHealth > 0) {
            const isPlayer = 'data' in attacker;
            const attacks = isPlayer ? (attacker.stats as CharacterStats).attacksPerRound : (attacker.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = attacker.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, Math.floor(attacks - reducedAttacks));
            
            if (attacker.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: attacker.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                const isDualWielding = isPlayer && attacker.data.activeSkills?.includes('dual-wield-mastery') && attacker.data.equipment?.offHand;
                
                // Pętla ataku
                for (let i = 0; i < finalAttacks && defender.currentHealth > 0; i++) {
                    const hands: ('main' | 'off')[] = isDualWielding ? ['main', 'off'] : ['main'];
                    
                    for (const hand of hands) {
                        if (defender.currentHealth <= 0) break;
                        const isWarrior = isPlayer && (attacker as any).data.characterClass === CharacterClass.Warrior;
                        const attackOptions: any = { hand };
                        if (isWarrior && i === 0 && hand === 'main') {
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
        
        // --- Ruch Obrońcy ---
        if (defender.currentHealth > 0) {
            const isPlayer = 'data' in defender;
            const attacks = isPlayer ? (defender.stats as CharacterStats).attacksPerRound : (defender.stats as EnemyStats).attacksPerTurn || 1;
            const reducedAttacks = defender.statusEffects.filter(e => e.type === 'reduced_attacks').length;
            const finalAttacks = Math.max(1, Math.floor(attacks - reducedAttacks));

             if (defender.statusEffects.some(e => e.type === 'frozen_no_attack')) {
                log.push({ turn, attacker: defender.name, defender: '', action: 'effectApplied', effectApplied: 'frozen_no_attack', ...getHealthState(playerState, enemyState) });
            } else {
                const isDualWielding = isPlayer && defender.data.activeSkills?.includes('dual-wield-mastery') && defender.data.equipment?.offHand;

                for (let i = 0; i < finalAttacks && attacker.currentHealth > 0; i++) {
                    const hands: ('main' | 'off')[] = isDualWielding ? ['main', 'off'] : ['main'];

                    for (const hand of hands) {
                        if (attacker.currentHealth <= 0) break;
                        const isWarrior = isPlayer && (defender as any).data.characterClass === CharacterClass.Warrior;
                        const attackOptions: any = { hand };
                        if (isWarrior && i === 0 && hand === 'main') {
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
    
    return log;
};
