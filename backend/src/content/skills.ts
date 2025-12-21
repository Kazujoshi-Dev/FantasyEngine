
import { Skill, SkillType, SkillCategory, CharacterClass, EssenceType } from '../types.js';

/**
 * Tutaj definiujemy wszystkie umiejętności dostępne w Uniwersytecie.
 * Dodanie nowej umiejętności tutaj automatycznie zsynchronizuje ją z bazą danych przy starcie.
 */
export const GAME_SKILLS: Skill[] = [
    {
        id: 'dual-wield-mastery',
        name: 'Sztuka Dwóch Mieczy',
        description: 'Pozwala władać dwiema broniami jednoręcznymi jednocześnie (niemagicznymi). Używanie dwóch ostrzy nakłada karę -25% do całkowitych zadawanych obrażeń.',
        type: SkillType.Class,
        category: SkillCategory.Active,
        manaMaintenanceCost: 125,
        requirements: {
            strength: 25,
            agility: 30,
            stamina: 10,
            intelligence: 10,
            level: 10
        },
        cost: {
            gold: 50000,
            epicEssence: 10,
            legendaryEssence: 3
        }
    },
    {
        id: 'podstawy-alchemii',
        name: 'Podstawy Alchemii',
        description: 'Odblokowuje możliwość transmutacji niższych esencji w wyższe w zakładce Zasoby.',
        type: SkillType.Universal,
        category: SkillCategory.Passive,
        requirements: {
            intelligence: 15,
            level: 5
        },
        cost: {
            gold: 5000,
            commonEssence: 20
        }
    },
    {
        id: 'lone-wolf',
        name: 'Samotny Wilk',
        description: 'Pozwala na tworzenie 1-osobowych grup polowań na bossów.',
        type: SkillType.Universal,
        category: SkillCategory.Passive,
        requirements: {
            level: 15,
            stamina: 20
        },
        cost: {
            gold: 25000,
            rareEssence: 5
        }
    }
    // Tutaj możesz dopisywać kolejne umiejętności...
];
