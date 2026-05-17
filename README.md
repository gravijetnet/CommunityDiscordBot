# GraviJet Discord Bot

Discord bot for Minecraft communities, with support tickets, staff applications, moderation and server logs.

---

## Table of Contents

- [Commands](#commands)
  - [Tickets](#tickets)
  - [Moderation](#moderation)
  - [Staff Management](#staff-management)
  - [Reports](#reports)
  - [Server Utilities](#server-utilities)
  - [Channel Management](#channel-management)
- [Applications System](#applications-system)
- [Logging System](#logging-system)
- [Auto-Events](#auto-events)
- [Permissions Reference](#permissions-reference)
- [Configuration](#configuration)

---

## Commands

### Tickets

| Command | Description | Required Permission |
|---|---|---|
| `/tickets create` | Open a new support ticket in one of the available categories | — |
| `/tickets close <channel>` | Close a ticket channel and generate a transcript | Staff role for that ticket category |
| `/tickets closerequest <channel>` | Send a close-request button to the ticket owner | `STAFF_ROLE` |
| `/tickets add <user>` | Add a user to a ticket channel | `MANAGEMENT_ROLE` |
| `/tickets remove <user>` | Remove a user from a ticket channel | `MANAGEMENT_ROLE` |
| `/tickets ban <user>` | Prevent a user from opening new tickets | `MANAGEMENT_ROLE` |
| `/tickets unban <user>` | Lift a ticket ban from a user | `MANAGEMENT_ROLE` |
| `/tickets slowdown <seconds>` | Set a per-user cooldown on a ticket channel (0 to remove) | `ManageChannels` |

**Ticket categories:** General Support · Bug Report · Player Report · Punishment Appeal · Payment Support

When a ticket is closed:
- A full transcript is posted to the transcript channel.
- The ticket creator receives the transcript via DM.

---

### Moderation

| Command | Description | Required Permission |
|---|---|---|
| `/moderate ban <user>` | Ban a user; optional `reason`, `duration`, `delmessages`, `proof` | `BanMembers` |
| `/moderate unban <user_id>` | Unban a user; optional `reason` | `BanMembers` |
| `/moderate kick <user>` | Kick a user; optional `reason`, `proof` | `KickMembers` |
| `/moderate mute <user>` | Apply a timeout to a user; optional `reason`, `duration` (default 1 h), `proof` | `ModerateMembers` |
| `/moderate unmute <user>` | Remove a timeout from a user; optional `reason` | `ModerateMembers` |
| `/clear <amount>` | Delete messages — use `0` to bulk-clear (up to 2 weeks back), or `1–100` for a specific count | `ManageMessages` |
| `/proof <message_id> <proof_url>` | Attach a proof URL to an existing moderation log entry | `STAFF_ROLE` |

All moderation actions are recorded in the moderation log channel. Active and expired punishments are tracked in a database.

---

### Staff Management

| Command | Description | Required Permission |
|---|---|---|
| `/promote <discordname> <rank>` | Assign a staff rank and its associated roles to a user | `MANAGEMENT_ROLE` |
| `/demote <user> [rank]` | Remove a staff rank; optionally demote to a lower rank instead of Member | `MANAGEMENT_ROLE` |

**Available ranks:** Creator · Media · Famous · Partner · Builder · Helper · Mod · SrMod · Admin · Developer · Beta-Tester

Promotions and demotions are announced in the promotion log channel. Certain ranks receive additional bundled roles automatically (e.g. Media inherits the Famous and Partner role chain).

---

### Reports

| Command | Description | Required Permission |
|---|---|---|
| `/report <user> <proof>` | Report a user to staff with evidence | — |
| `/reportban <user>` | Prevent a user from submitting reports | `STAFF_ROLE` |
| `/reportunban <user>` | Lift a report ban from a user | `STAFF_ROLE` |

Reports are posted in the report channel. Staff can respond with action buttons to mute, ban, or dismiss the report.

---

### Server Utilities

| Command | Description | Required Permission |
|---|---|---|
| `/status` | Show the live status of the example.invalid Minecraft server (version, player count, MOTD) | — |
| `/about` | Display bot uptime and statistics (open tickets, total punishments, etc.) | — |
| `/hoster` | Show hosting provider information | — |
| `/embed <title> <text>` | Send a custom embed; optional `color`, `thumbnail`, `image`, `footer`, `channel` | `ManageMessages` |
| `/massrole <action> <role>` | Add or remove a role from every member; optional `include_bots` | `ManageRoles` |

---

### Channel Management

| Command | Description | Required Permission |
|---|---|---|
| `/lock` | Lock the current channel — prevents `@everyone` from sending messages or adding reactions | `Administrator` |
| `/unlock` | Restore the channel's previous permissions | `Administrator` |
| `/slowdown <seconds>` | Set a per-user message cooldown on the current channel (0 to remove, max 21600) | `ManageChannels` |

---

## Applications System

Users can apply for staff and community roles directly through Discord.

**Available roles to apply for:** Helper · Builder · Developer · Media · Beta-Tester

### How It Works

1. A user selects a role from the application panel in the designated channel.
2. The bot sends a confirmation DM with information about the role.
3. The user begins a multi-step questionnaire entirely through DM.
4. Answers can be reviewed and edited before final submission.
5. The completed application is posted to the appropriate review channel.
6. Management can **Accept**, **Deny** (with an optional reason), or **Open a discussion ticket** directly from the review post.
7. The applicant receives a DM notifying them of the decision.

### Question Counts by Role

| Role | Questions |
|---|---|
| Helper | 12 |
| Builder | 12 |
| Developer | 12 |
| Media | 7 |
| Beta-Tester | 8 |

Applications time out after a configurable period (default: 3 hours). Incomplete sessions started before a bot restart are automatically cleaned up on startup.

---

## Logging System

The bot logs activity across the entire server into dedicated channels.

| Log Type | What Is Recorded |
|---|---|
| **Message Logs** | Message deletions, edits, new messages, reactions added/removed, bulk deletes |
| **Channel Logs** | Channel creation, deletion, and updates (name, category, topic, slowmode, type) |
| **Role Logs** | Role creation, deletion, and updates (name, color, permissions, position) |
| **Member Logs** | Member joins/leaves, nickname changes, role changes, voice activity |
| **User Logs** | Username, discriminator, and avatar changes |
| **Server Logs** | Server name, icon, banner, verification level, boost tier, vanity URL changes |
| **Thread Logs** | Thread creation, deletion, archival, and name changes |
| **Invite Logs** | Invite creation and deletion |
| **Emoji & Sticker Logs** | Creation, deletion, and name/description updates |
| **Moderation Logs** | All actions performed via `/moderate` |
| **Promotion Logs** | All `/promote` and `/demote` actions |

**Monitored category:** Messages deleted from a designated monitored category trigger an additional DM alert to a configured admin user.

Large message content (edits, deletions) is automatically saved as a text file attachment when it exceeds embed limits.

---

## Auto-Events

The following happen automatically without any command:

- **Welcome message** — A welcome embed is sent in the welcome channel when a new member joins.
- **Auto-role** — New human members are automatically assigned `JOIN_ROLE`. New bots are automatically assigned `BOT_ROLE`.
- **Ticket panel** — The ticket selection panel is created or updated in the ticket channel on startup.
- **Application panel** — The application role-selection menu is created or updated on startup.

---

## Permissions Reference

### Discord Permissions Required by Command

| Discord Permission | Commands |
|---|---|
| `BanMembers` | `/moderate ban`, `/moderate unban` |
| `KickMembers` | `/moderate kick` |
| `ModerateMembers` | `/moderate mute`, `/moderate unmute` |
| `ManageMessages` | `/clear`, `/embed` |
| `ManageChannels` | `/slowdown`, `/tickets slowdown` |
| `ManageRoles` | `/massrole` |
| `Administrator` | `/lock`, `/unlock` |

### Role-Based Permissions

| Role | Access |
|---|---|
| `STAFF_ROLE` | `/tickets closerequest`, `/reportban`, `/reportunban`, `/proof`, confirming close requests |
| `MANAGEMENT_ROLE` | `/tickets add/remove/ban/unban`, `/promote`, `/demote`, reviewing and deciding on applications |
| Category staff roles | Viewing and closing tickets for their assigned category |

---

## Configuration

The bot is configured through `config.json`. Key settings:

**General**
- `GUILD_ID` — Discord server ID
- `MINECRAFT_SERVER` / `MINECRAFT_PORT` — Minecraft server address shown by `/status`
- `APPLICATION_TIMEOUT_HOURS` — How long a user has to complete an application (default: 3)
- `DM_USER_ID` — User who receives DM alerts for monitored-category deletions

**Channels**
- `TICKET_CHANNEL` — Where the ticket selection panel is posted
- `SUPPORT_CATEGORY` — Discord category where ticket channels are created
- `TRANSCRIPT_CHANNEL` — Where closed ticket transcripts are archived
- `LOG_CHANNEL` — Main moderation log
- `MESSAGE_LOG_CHANNEL`, `CHANNEL_LOG_CHANNEL`, `ROLE_LOG_CHANNEL`, `USER_LOG_CHANNEL`, `MEMBER_LOG_CHANNEL` — Dedicated log channels
- `WELCOME_CHANNEL` — Where welcome messages are sent
- `PROMOTION_LOG_CHANNEL` — Where promotion/demotion announcements are posted
- `REPORT_CHANNEL` — Where user reports are posted
- `APPLICATION_PANEL_CHANNEL` — Where the application panel is posted
- `APPLICATION_REVIEW_CHANNEL` — Default channel for reviewing submitted applications

**Roles**
- `JOIN_ROLE` — Auto-assigned to new members
- `BOT_ROLE` — Auto-assigned to new bots
- `STAFF_ROLE` — Shared role for all staff
- `MANAGEMENT_ROLE` — Role for managers
- `RANK_ROLES` — Mapping of rank names to role IDs (Creator, Media, Famous, Partner, Builder, Helper, Mod, SrMod, Admin, Developer, Beta-Tester)

**Ticket Category Permissions**
Each ticket category can be configured with:
- `name` — Display name shown in the selection menu
- `staff_roles` — Role IDs that can view and manage tickets in this category
- `color` — Embed accent color
