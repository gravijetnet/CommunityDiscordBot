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

    // Erweiterte Logging-Einstellungen
    LOGGING: {
        // Soll der volle Inhalt von gelöschten Nachrichten geloggt werden?
        LOG_FULL_CONTENT: true,

        // Maximale Länge für Embed-Inhalte (Zeichen)
        MAX_EMBED_CONTENT: 1000,

        // Soll bei langen Nachrichten eine Datei erstellt werden?
        CREATE_FILE_FOR_LONG_CONTENT: true,

        // Datei-Erstellungsschwellwert (Zeichen)
        FILE_THRESHOLD: 1900,

        // Sollen Anhänge in Logs verlinkt werden?
        LOG_ATTACHMENT_URLS: true,

        // Sollen bearbeitete Nachrichten detailliert verglichen werden?
        DETAILED_EDIT_LOGGING: true
    }
};

