module.exports = {
    STAFF_ROLE: '000000000000000000',
    MANAGEMENT_ROLE: '000000000000000000',

    RANK_ROLES: {
        'Creator': '000000000000000000',
        'Media': '000000000000000000',
        'Famous': '000000000000000000',
        'Partner': '000000000000000000',
        'Builder': '000000000000000000',
        'Helper': '000000000000000000',
        'Mod': '000000000000000000',
        'SrMod': '000000000000000000',
        'Developer': '000000000000000000',
        'Admin': '000000000000000000',
        'Owner': '000000000000000000',
        'Beta-Tester': '000000000000000000'
    },

    FORBIDDEN_ROLES: {
        'Helper': '000000000000000000',
        'Builder': '000000000000000000',
        'Developer': '000000000000000000',
        'Media': '000000000000000000',
        'Beta-Tester': '000000000000000000'
    },

    ROLE_HIERARCHY: {
        'Creator': ['Creator'],
        'Media': ['Creator', 'Media'],
        'Famous': ['Creator', 'Media', 'Famous'],
        'Partner': ['Creator', 'Media', 'Famous', 'Partner'],
        'Builder': ['Builder'],
        'Helper': ['Helper'],
        'Mod': ['Mod'],
        'SrMod': ['SrMod'],
        'Admin': ['Admin'],
        'Developer': ['Developer'],
        'Owner': ['Owner'],
        'Beta-Tester': ['Beta-Tester']
    },

    STAFF_RANKS: ['Helper', 'Mod', 'SrMod', 'Admin', 'Developer', 'Owner']
};
