const json = require('./config.json');

// Flatten the nested CHANNELS and ROLES objects so the rest of the code
// can keep using e.g. bot.CONFIG.TICKET_CHANNEL directly.
module.exports = {
    APPLICATION_ID:   json.APPLICATION_ID,
    GUILD_ID:         json.GUILD_ID,
    MINECRAFT_SERVER: json.MINECRAFT_SERVER,
    MINECRAFT_PORT:   json.MINECRAFT_PORT,
    PANEL_MESSAGE_ID:          json.PANEL_MESSAGE_ID,
    APPLICATION_TIMEOUT_HOURS: json.APPLICATION_TIMEOUT_HOURS,
    DM_USER_ID:       json.DM_USER_ID,

    // Channels (flat)
    ...json.CHANNELS,

    // Roles (flat)
    ...json.ROLES,

    CATEGORY_PERMISSIONS:          json.CATEGORY_PERMISSIONS,
    APPLICATION_CATEGORY_SPECIFIC: json.CHANNELS.APPLICATION_CATEGORY_SPECIFIC,

    // Staff / rank config (previously roles.js)
    STAFF_ROLE:      json.STAFF_CONFIG.STAFF_ROLE,
    MANAGEMENT_ROLE: json.STAFF_CONFIG.MANAGEMENT_ROLE,
    RANK_ROLES:      json.STAFF_CONFIG.RANK_ROLES,
    ROLE_HIERARCHY:  json.STAFF_CONFIG.ROLE_HIERARCHY,
    STAFF_RANKS:     json.STAFF_CONFIG.STAFF_RANKS,
};
