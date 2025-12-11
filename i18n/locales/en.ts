export default {
    loading: 'Loading adventure...',
    error: {
        title: 'An error occurred',
        refresh: 'Try refreshing the page.',
        logout: 'Logout'
    },
    auth: {
        welcomeBack: 'Welcome Back',
        joinAdventure: 'Join the Adventure',
        loginPrompt: 'Log in to continue your expedition.',
        registerPrompt: 'Create an account to start a new saga.',
        username: 'Username',
        password: 'Password',
        processing: 'Processing...',
        login: 'Log In',
        register: 'Register',
        toggleToRegister: "Don't have an account? Create one!",
        toggleToLogin: "Already have an account? Log in!"
    },
    trader: {
        junkTypes: 'Common and Uncommon',
        bulkSellConfirm: 'Are you sure you want to sell {count} items ({types}) for {value} gold?'
    },
    hunting: {
        title: 'Hunting',
        statusLabel: 'Status',
        startsIn: 'Starts in',
        leave: 'Leave Party',
        disband: 'Disband Party',
        leaveConfirm: 'Are you sure you want to leave the party?',
        chooseBoss: 'Choose Boss',
        partySize: 'Party Size',
        create: 'Create Party',
        availableParties: 'Available Parties',
        noParties: 'No parties available. Create your own!',
        join: 'Join',
        emptySlot: 'Empty Slot',
        members: 'Party Members',
        status: {
            FORMING: 'Forming',
            PREPARING: 'Preparing',
            FIGHTING: 'Fighting',
            FINISHED: 'Finished'
        },
        memberStatus: {
            LEADER: 'Leader',
            MEMBER: 'Member',
            PENDING: 'Pending'
        }
    },
    bossShouts: {
        Stun: 'Feel the power of my stun!',
        ArmorPierce: 'Your armor is like paper!',
        DeathTouch: 'Your soul belongs to me now!',
        EmpoweredStrikes: 'My strikes shall become crushing!',
        Earthquake: 'The earth trembles before my power!'
    },
    guild: {
        title: 'Guild',
        create: 'Create Guild',
        join: 'Join Guild',
        leave: 'Leave Guild',
        disband: 'Disband Guild',
        name: 'Guild Name',
        tag: 'Tag',
        description: 'Description',
        resources: 'Guild Resources',
        deposit: 'Deposit',
        withdraw: 'Withdraw',
        chat: 'Guild Chat',
        members: 'Members',
        buildings: {
            title: 'Buildings',
            headquarters: 'Headquarters',
            headquartersDesc: 'Increases guild member limit (+1 per level).',
            armory: 'Armory',
            armoryDesc: 'Allows storing and renting items (+1 slot per level).',
            barracks: 'Barracks',
            barracksDesc: 'Increases base damage of guild members by 5% per level.',
            scoutHouse: 'Scout\'s House',
            scoutHouseDesc: 'Allows finding additional items during expeditions (+1 per level).',
            level: 'Level',
            currentEffect: 'Current effect',
            upgrade: 'Upgrade',
            upgradeCost: 'Upgrade cost',
            maxMembers: 'Max members: {count}'
        },
        bank: {
            deposit: 'Deposit',
            withdraw: 'Withdraw',
            rentalFee: 'Rental Fee'
        },
        roles: {
            LEADER: 'Leader',
            OFFICER: 'Officer',
            MEMBER: 'Member',
            RECRUIT: 'Recruit'
        },
        permissions: {
            title: 'Permissions',
            LEADER: 'Full control, manage roles, buildings, bank, and disband guild.',
            OFFICER: 'Manage recruitment, kick members (not officers), upgrade buildings.',
            MEMBER: 'Access chat, deposit to bank, use armory.',
            RECRUIT: 'Access chat, deposit to bank.'
        },
        settings: {
            title: 'Guild Settings',
            description: 'Description',
            crestUrl: 'Crest (URL)',
            minLevel: 'Required Level',
            isPublic: 'Public Guild (Open recruitment)',
            rentalTax: 'Rental Tax',
            rentalTaxDesc: 'Percentage of item value taken as fee when borrowing from guild armory.',
            save: 'Save Settings',
            disband: 'Disband Guild',
            preview: 'Preview',
            disbandConfirm: 'Are you sure you want to disband the guild? This cannot be undone.'
        },
        armory: {
            title: 'Armory',
            deposit: 'Deposit',
            borrow: 'Borrow',
            recall: 'Force Return',
            myBackpack: 'My Backpack',
            borrowedItems: 'Borrowed Items',
            empty: 'The armory is empty.',
            borrowConfirm: 'Borrowing costs 10% of value ({value} gold). Continue?',
            depositConfirm: 'Are you sure you want to donate this item to the guild? You will lose ownership.',
            itemBorrowed: 'Item borrowed',
            itemDeposited: 'Item deposited'
        }
    }
};