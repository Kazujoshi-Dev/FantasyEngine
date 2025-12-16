
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
            spyHideout: 'Kryjówka Szpiegów',
            spyHideoutDesc: 'Umożliwia wysyłanie szpiegów, aby sprawdzić zasoby innych gildii.',
            spyHideoutEffect: 'Maks. szpiegów: {count}',
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
            loot: 'Łup Wojenny'
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
        espionage: {
            title: 'Szpiegostwo',
            activeSpies: 'Aktywni Szpiedzy',
            sendSpy: 'Wyślij Szpiega',
            target: 'Cel',
            cost: 'Koszt Misji',
            duration: 'Czas',
            reports: 'Raporty Wywiadu',
            noActive: 'Brak aktywnych szpiegów.',
            noReports: 'Brak raportów.',
            selectTarget: 'Wybierz cel...',
            costFormula: '(125g * Suma poziomów gildii)',
            level1Info: 'Poziom 1: Tylko Złoto (15 min)',
            level2Info: 'Poziom 2: Złoto + Podst. Esencje (10 min)',
            level3Info: 'Poziom 3: Pełny Raport (5 min)',
            spySent: 'Szpieg wysłany!',
            arrivesIn: 'Raport za',
            reportFrom: 'Raport z',
            hidden: 'Ukryte (Niski Poziom Budynku)'
        }
    }
};
