
export default {
    guild: {
        title: 'Gildia',
        create: 'Załóż Gildię',
        join: 'Dołącz do Gildii',
        leave: 'Opuść Gildię',
        disband: 'Rozwiąż Gildię',
        name: 'Nazwa Gildii',
        tag: 'Tag',
        description: 'Opis',
        resources: 'Zasoby Gildii',
        deposit: 'Wpłać',
        withdraw: 'Wypłać',
        chat: 'Czat Gildii',
        members: 'Członkowie',
        buildings: {
            title: 'Budynki',
            headquarters: 'Siedziba',
            headquartersDesc: 'Zwiększa limit członków gildii (+1 na poziom).',
            armory: 'Zbrojownia',
            armoryDesc: 'Pozwala przechowywać i wypożyczać przedmioty (+1 slot na poziom).',
            barracks: 'Koszary',
            barracksDesc: 'Zwiększa bazowe obrażenia członków gildii o 5% na poziom.',
            scoutHouse: 'Dom Zwiadowcy',
            scoutHouseDesc: 'Pozwala znajdować dodatkowe przedmioty podczas wypraw (+1 na poziom).',
            shrine: 'Kapliczka',
            shrineDesc: 'Zwiększa szczęście o 5 za każdy poziom budynku.',
            altar: 'Ołtarz Mroku',
            altarDesc: 'Umożliwia przeprowadzanie rytuałów dających tymczasowe bonusy członkom gildii.',
            level: 'Poziom',
            currentEffect: 'Obecny efekt',
            upgrade: 'Ulepsz',
            upgradeCost: 'Koszt ulepszenia',
            maxMembers: 'Maks. członków: {count}'
        },
        bank: {
            deposit: 'Wpłata',
            withdraw: 'Wypłata',
            rentalFee: 'Opłata za wypożyczenie',
            tax: 'Podatek',
            loot: 'Grabież'
        },
        roles: {
            LEADER: 'Lider',
            OFFICER: 'Oficer',
            MEMBER: 'Członek',
            RECRUIT: 'Rekrut'
        },
        permissions: {
            title: 'Uprawnienia',
            LEADER: 'Pełna kontrola, zarządzanie rolami, budynkami, skarbcem i rozwiązanie gildii.',
            OFFICER: 'Zarządzanie rekrutacją, wyrzucanie członków (nie oficerów), ulepszanie budynków.',
            MEMBER: 'Dostęp do czatu, wpłaty do skarbca, korzystanie ze zbrojowni.',
            RECRUIT: 'Dostęp do czatu, wpłaty do skarbca.'
        },
        settings: {
            title: 'Ustawienia Gildii',
            description: 'Opis',
            crestUrl: 'Herb (URL)',
            minLevel: 'Wymagany Poziom',
            isPublic: 'Gildia Publiczna (Otwarta rekrutacja)',
            rentalTax: 'Podatek od wypożyczeń',
            rentalTaxDesc: 'Procent wartości przedmiotu pobierany jako opłata za wypożyczenie do skarbca gildii.',
            huntingTax: 'Podatek łowiecki',
            huntingTaxDesc: 'Procent złota i esencji zdobytych podczas polowań gildyjnych, który trafia bezpośrednio do skarbca gildii.',
            save: 'Zapisz Ustawienia',
            disband: 'Rozwiąż Gildię',
            preview: 'Podgląd',
            disbandConfirm: 'Czy na pewno chcesz rozwiązać gildię? Tej operacji nie można cofnąć.'
        },
        armory: {
            title: 'Zbrojownia',
            deposit: 'Zdeponuj',
            borrow: 'Wypożycz',
            recall: 'Wymuś Zwrot',
            myBackpack: 'Mój Plecak',
            borrowedItems: 'Wypożyczone',
            empty: 'Zbrojownia jest pusta.',
            borrowConfirm: 'Wypożyczenie kosztuje 10% wartości ({value} złota). Kontynuować?',
            depositConfirm: 'Czy na pewno chcesz oddać ten przedmiot do gildii? Tracisz go na zawsze.',
            itemBorrowed: 'Przedmiot wypożyczony',
            itemDeposited: 'Przedmiot zdeponowany'
        },
        raids: {
            title: 'Rajdy Gildyjne',
            declare: 'Wypowiedz Wojnę',
            incoming: 'Nadchodzące Ataki',
            outgoing: 'Nasze Ataki',
            target: 'Cel Ataku',
            type: 'Typ Starcia',
            resources: 'Grabież (Zasoby)',
            sparring: 'Sparing (Trening)',
            status: {
                PREPARING: 'Przygotowania',
                FIGHTING: 'Walka Trwa',
                FINISHED: 'Zakończone'
            },
            joinAttack: 'Dołącz do Ataku',
            joinDefense: 'Dołącz do Obrony'
        }
    }
};
