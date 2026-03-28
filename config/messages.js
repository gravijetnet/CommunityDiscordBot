const json = require('./messages.json');

// Replace {placeholder} tokens in a template string.
function fmt(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{${key}}`));
}

// Pull out meta-keys so they are never accidentally used as messages.
const { _docs, _comment, ...staticMessages } = json;

module.exports = {
    // ── spread all static strings from JSON ──────────────────────────────────
    ...staticMessages,

    // ── function wrappers for dynamic (templated) messages ───────────────────

    // Ticket
    TICKET_WELCOME:             (user, ticketId) => fmt(json.TICKET_WELCOME, { user, ticketId }),
    TICKET_CREATED:             (channel)        => fmt(json.TICKET_CREATED, { channel }),
    TICKET_BAN_SUCCESS:         (user)           => fmt(json.TICKET_BAN_SUCCESS, { user }),
    TICKET_UNBAN_SUCCESS:       (user)           => fmt(json.TICKET_UNBAN_SUCCESS, { user }),
    TICKET_ADD_SUCCESS:         (user)           => fmt(json.TICKET_ADD_SUCCESS, { user }),
    TICKET_REMOVE_SUCCESS:      (user)           => fmt(json.TICKET_REMOVE_SUCCESS, { user }),
    TICKET_CLOSED:              (channel)        => fmt(json.TICKET_CLOSED, { channel }),
    TICKET_CLOSE_REQUEST_SENT:  (channel)        => fmt(json.TICKET_CLOSE_REQUEST_SENT, { channel }),
    TICKET_TRANSCRIPT_DM_BODY:  (guildName)      => fmt(json.TICKET_TRANSCRIPT_DM_BODY, { guildName }),

    // Moderation
    BAN_DM_BODY:        (guildName)                         => fmt(json.BAN_DM_BODY, { guildName }),
    BAN_SUCCESS_BODY:   (user, reason, duration, delMessages) =>
        fmt(json.BAN_SUCCESS_BODY, { user, reason, duration, delMessages: delMessages ? 'Yes (last 7 days)' : 'No' }),

    UNBAN_DM_BODY:      (guildName)          => fmt(json.UNBAN_DM_BODY, { guildName }),
    UNBAN_SUCCESS_BODY: (username, reason)   => fmt(json.UNBAN_SUCCESS_BODY, { username, reason }),

    KICK_DM_BODY:       (guildName)          => fmt(json.KICK_DM_BODY, { guildName }),
    KICK_SUCCESS_BODY:  (user, reason)       => fmt(json.KICK_SUCCESS_BODY, { user, reason }),

    MUTE_DM_BODY:       (guildName)                  => fmt(json.MUTE_DM_BODY, { guildName }),
    MUTE_SUCCESS_BODY:  (user, reason, duration)     => fmt(json.MUTE_SUCCESS_BODY, { user, reason, duration }),
    UNMUTE_DM_BODY:     (guildName)                  => fmt(json.UNMUTE_DM_BODY, { guildName }),
    UNMUTE_SUCCESS_BODY:(user)                       => fmt(json.UNMUTE_SUCCESS_BODY, { user }),

    // Welcome
    WELCOME_BODY:   (user, guild)  => fmt(json.WELCOME_BODY, { user, guild }),
    WELCOME_FOOTER: (count)        => fmt(json.WELCOME_FOOTER, { count }),

    // Applications
    APPLICATION_CONFIRM_BODY:         (category, hours)  => fmt(json.APPLICATION_CONFIRM_BODY, { category, hours }),
    APPLICATION_SUMMARY_TITLE:        (category)         => fmt(json.APPLICATION_SUMMARY_TITLE, { category }),
    APPLICATION_ANSWER_UPDATED:       (n)                => fmt(json.APPLICATION_ANSWER_UPDATED, { n }),
    APPLICATION_IN_PROGRESS_BODY:     (hours)            => fmt(json.APPLICATION_IN_PROGRESS_BODY, { hours }),
    APPLICATION_TIMEOUT_BODY:         (hours)            => fmt(json.APPLICATION_TIMEOUT_BODY, { hours }),
    APPLICATION_ACCEPTED_BODY:        (category)         => fmt(json.APPLICATION_ACCEPTED_BODY, { category }),
    APPLICATION_ACCEPTED_REASON_BODY: (category, reason) => fmt(json.APPLICATION_ACCEPTED_REASON_BODY, { category, reason }),
    APPLICATION_DENIED_BODY:          (category)         => fmt(json.APPLICATION_DENIED_BODY, { category }),
    APPLICATION_DENIED_REASON_BODY:   (category, reason) => fmt(json.APPLICATION_DENIED_REASON_BODY, { category, reason }),
    APPLICATION_PROMOTION_LOG:        (user, category)   => fmt(json.APPLICATION_PROMOTION_LOG, { user, category }),
    APPLICATION_ACCEPT_STAFF_CONFIRM: (tag)              => fmt(json.APPLICATION_ACCEPT_STAFF_CONFIRM, { tag }),
    APPLICATION_DENY_STAFF_CONFIRM:   (tag)              => fmt(json.APPLICATION_DENY_STAFF_CONFIRM, { tag }),
    APPLICATION_INVALID_QUESTION:     (max)              => fmt(json.APPLICATION_INVALID_QUESTION, { max }),

    // Promote / Demote
    PROMOTE_LOG_DESCRIPTION: (user, rank)       => fmt(json.PROMOTE_LOG_DESCRIPTION, { user, rank }),
    PROMOTE_SUCCESS:         (user, rank)       => fmt(json.PROMOTE_SUCCESS, { user, rank }),
    DEMOTE_LOG_DESCRIPTION:  (user, rank)       => fmt(json.DEMOTE_LOG_DESCRIPTION, { user, rank }),
    DEMOTE_SUCCESS:          (user, rank)       => fmt(json.DEMOTE_SUCCESS, { user, rank }),

    // Reports
    REPORT_CANCELLED_BODY: (tag)  => fmt(json.REPORT_CANCELLED_BODY, { tag }),
    REPORT_BAN_SUCCESS:    (user) => fmt(json.REPORT_BAN_SUCCESS, { user }),
    REPORT_UNBAN_SUCCESS:  (user) => fmt(json.REPORT_UNBAN_SUCCESS, { user }),
};
