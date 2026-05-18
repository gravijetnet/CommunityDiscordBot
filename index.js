require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const CONFIG = require('./config/config');
const { registerEventHandlers } = require('./handlers/eventHandler');

class TicketBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildWebhooks,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildScheduledEvents,
                GatewayIntentBits.AutoModerationConfiguration,
                GatewayIntentBits.AutoModerationExecution
            ],
            partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User, Partials.Reaction]
        });

        this.db = null;
        this.startTime = new Date();
        this.CONFIG = CONFIG;
        this.RANK_ROLES      = CONFIG.RANK_ROLES;
        this.STAFF_ROLE      = CONFIG.STAFF_ROLE;
        this.MANAGEMENT_ROLE = CONFIG.MANAGEMENT_ROLE;
        this.ROLE_HIERARCHY  = CONFIG.ROLE_HIERARCHY;
        this.STAFF_RANKS     = CONFIG.STAFF_RANKS;

        this.initDatabase();
        this.setupEventListeners();
    }

    initDatabase() {
        this.db = new sqlite3.Database('./ticket_bot.db', (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
            }
        });
    }

    createTables() {
        this.db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME
        )`, (err) => { if (err) console.error('Error creating tickets table:', err); });

        this.db.run(`CREATE TABLE IF NOT EXISTS ticket_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            banned_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) console.error('Error creating ticket_bans table:', err); });

        this.db.run(`CREATE TABLE IF NOT EXISTS punishments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            reason TEXT,
            duration TEXT,
            punished_by TEXT NOT NULL,
            expires_at DATETIME,
            active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) console.error('Error creating punishments table:', err); });

        this.db.run(`CREATE TABLE IF NOT EXISTS report_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            banned_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) console.error('Error creating report_bans table:', err); });

        this.db.run(`CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            category TEXT NOT NULL,
            answers TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            started_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            submitted_at DATETIME,
            reviewed_by TEXT,
            review_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => { if (err) console.error('Error creating applications table:', err); });

        this.db.run(`CREATE TABLE IF NOT EXISTS application_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            action TEXT NOT NULL,
            user_id TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES applications (id)
        )`, (err) => {
            if (err) { console.error('Error creating application_logs table:', err); return; }
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_user_id    ON tickets (user_id)`,          (e) => { if (e) console.error('Error creating index idx_tickets_user_id:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_channel_id ON tickets (channel_id)`,       (e) => { if (e) console.error('Error creating index idx_tickets_channel_id:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_status     ON tickets (status)`,           (e) => { if (e) console.error('Error creating index idx_tickets_status:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications (user_id)`,   (e) => { if (e) console.error('Error creating index idx_applications_user_id:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_applications_status  ON applications (status)`,    (e) => { if (e) console.error('Error creating index idx_applications_status:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_punishments_user_id  ON punishments (user_id)`,    (e) => { if (e) console.error('Error creating index idx_punishments_user_id:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_punishments_active   ON punishments (active)`,     (e) => { if (e) console.error('Error creating index idx_punishments_active:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_bans_user_id  ON ticket_bans (user_id)`,   (e) => { if (e) console.error('Error creating index idx_ticket_bans_user_id:', e); });
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_report_bans_user_id  ON report_bans (user_id)`,   (e) => { if (e) console.error('Error creating index idx_report_bans_user_id:', e); });
            console.log('All database tables and indexes created/verified');
            this.cleanupExpiredApplications();
        });
    }

    cleanupExpiredApplications() {
        // Application sessions live only in memory, so any row still marked
        // 'in_progress' after a (re)start is orphaned and unresumable. Leaving
        // it would lock the user out with "application already open" until it
        // expires, so abandon every in_progress row on startup — not just the
        // already-expired ones.
        this.db.run(
            "UPDATE applications SET status = 'timeout' WHERE status = 'in_progress'",
            function(err) {
                if (err) {
                    console.error('Error cleaning up in-progress applications:', err);
                } else {
                    console.log(`Cleaned up ${this.changes} orphaned in-progress applications`);
                }
            }
        );
    }

    setupEventListeners() {
        registerEventHandlers(this);
    }

    login() {
        if (!process.env.BOT_TOKEN) {
            console.error('BOT_TOKEN not found in .env file!');
            process.exit(1);
        }
        console.log('Bot token loaded, starting bot...');
        this.client.login(process.env.BOT_TOKEN).catch(error => {
            console.error('Login failed:', error);
            process.exit(1);
        });
    }
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', promise, 'reason:', reason);
});

const bot = new TicketBot();
bot.login();
