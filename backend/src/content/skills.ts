
import { Skill, SkillType, SkillCategory, CharacterClass, EssenceType, Race } from '../types.js';

/**
 * Tutaj definiujemy wszystkie umiejętności dostępne w Uniwersytecie.
 * Dodanie nowej umiejętności tutaj automatycznie zsynchronizuje ją z bazą danych przy starcie.
 */
export const GAME_SKILLS: Skill[] = [
    {
        id: 'behemoths-hide',
        name: 'Skóra Behemota',
        description: 'Mistrzowska technika hartowania ciała Orków. Dodaje 1 pkt pancerza na każde 10 pkt bazowej Siły. Zwiększa próg aktywacji rasowej Furii do 35% PŻ i daje 10% szansy na odzyskanie energii w trudnych walkach (<50% PŻ).',
        type: SkillType.Race,
        category: SkillCategory.Passive,
        requirements: {
            race: Race.Orc,
            level: 15,
            strength: 40,
            stamina: 30
        },
        cost: {
            gold: 15000,
            rareEssence: 20,
            epicEssence: 5
        }
    },
    {
        id: 'ethereal-weave',
        name: 'Splot Eteryczny',
        description: 'Mistrzowska kontrola nad przepływem many pozwala Elfom manipulować rzeczywistością. Zapewnia +1% Szansy na Unik za każde 100 pkt Maksymalnej Many. Dodatkowo, w pierwszej rundzie walki Modyfikator Obrażeń Krytycznych rośnie o 30%, a bazowa regeneracja many jest zwiększona o 5% Inteligencji.',
        type: SkillType.Race,
        category: SkillCategory.Passive,
        requirements: {
            race: Race.Elf,
            level: 15,
            intelligence: 40,
            agility: 30
        },
        cost: {
            gold: 15000,
            rareEssence: 20,
            epicEssence: 5
        }
    },
    {
        id: 'bedrock-foundation',
        name: 'Praca u Podstaw',
        description: 'Dla krasnoluda pancerz to nie ciężar, lecz fundament potęgi. Każde 5 pkt Wytrzymałości zwiększa bazowy Pancerz o 1 pkt. Dodatkowo, krasnolud otrzymuje +1 do Minimalnych Obrażeń na każde 10 pkt całkowitego Pancerza i szybciej regeneruje się z negatywnych efektów statusu.',
        type: SkillType.Race,
        category: SkillCategory.Passive,
        requirements: {
            race: Race.Dwarf,
            level: 16,
            strength: 40,
            stamina: 45
        },
        cost: {
            gold: 18500,
            rareEssence: 30,
            epicEssence: 4
        }
    },
    {
        id: 'gnomish-overengineering',
        name: 'Gnomia Nadzaradność',
        description: 'Gnomowie wyciskają z mechanizmów maksimum możliwości. Każdy punkt Szczęścia zwiększa szansę na dodatkowe esencje o 0.2%. Dodatkowo, każdy wykonany Unik zwiększa szansę na krytyk następnego ataku o 10% (max 3 stosy), a wygrana walka na ekspedycji daje 15% szansy na odzyskanie 1 pkt Energii.',
        type: SkillType.Race,
        category: SkillCategory.Passive,
        requirements: {
            race: Race.Gnome,
            level: 18,
            intelligence: 30,
            luck: 45
        },
        cost: {
            gold: 20000,
            uncommonEssence: 40,
            rareEssence: 15,
            epicEssence: 2
        }
    },
    {
        id: 'pioneers-instinct',
        name: 'Instynkt Pioniera',
        description: 'Unikalna zdolność Ludzi. Zmniejsza koszt energii wypraw i wieży o 1 (min. 1), zwiększa najwyższy atrybut o 5% oraz daje +5% szansy na łup.',
        type: SkillType.Race,
        category: SkillCategory.Passive,
        requirements: {
            race: Race.Human,
            level: 1
        },
        cost: {
            gold: 1000,
            commonEssence: 10
        }
    },
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
];
