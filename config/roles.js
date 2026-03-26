module.exports = {
    STAFF_ROLE: '000000000000000000',
    MANAGEMENT_ROLE: '000000000000000000',
    
    RANK_ROLES: {
        'Creator': '000000000000000000',
        'Media': '000000000000000000',
        'Famous': '000000000000000000',
        'Partner': '000000000000000000',
        'Builder': '000000000000000000',
        'Trainee': '000000000000000000',
        'Moderator': '000000000000000000',
        'SrModerator': '000000000000000000',
        'Developer': '000000000000000000',
        'Admin': '000000000000000000',
        'SrAdmin': '000000000000000000',
        'Beta-Tester': '000000000000000000'
    },

    FORBIDDEN_ROLES: {
        'Trainee': '000000000000000000',
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
        'Trainee': ['Trainee'],
        'Moderator': ['Moderator'],
        'SrModerator': ['SrModerator'],
        'Admin': ['Admin'],
        'Developer': ['Developer'],
        'SrAdmin': ['SrAdmin'],
        'Beta-Tester': ['Beta-Tester']
    },

    STAFF_RANKS: ['Trainee', 'Moderator', 'SrModerator', 'Admin', 'Developer', 'SrAdmin']
};