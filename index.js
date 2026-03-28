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
        this.ticketCounts = new Map();
        this.applicationSessions = new Map();
        this.CONFIG = CONFIG;
        this.RANK_ROLES      = CONFIG.RANK_ROLES;
        this.STAFF_ROLE      = CONFIG.STAFF_ROLE;
        this.MANAGEMENT_ROLE = CONFIG.MANAGEMENT_ROLE;
        this.ROLE_HIERARCHY  = CONFIG.ROLE_HIERARCHY;
        this.STAFF_RANKS     = CONFIG.STAFF_RANKS;
        this.FORBIDDEN_ROLES = CONFIG.FORBIDDEN_ROLES;
        
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
        // Tickets table
        this.db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME
        )`);

        // Ticket bans table
        this.db.run(`CREATE TABLE IF NOT EXISTS ticket_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            banned_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Punishments table
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
        )`);

        // Report bans table
        this.db.run(`CREATE TABLE IF NOT EXISTS report_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            banned_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Applications table
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
        )`);

        // Application logs table
        this.db.run(`CREATE TABLE IF NOT EXISTS application_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            action TEXT NOT NULL,
            user_id TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES applications (id)
        )`, () => {
            console.log('All database tables created/verified');
            this.cleanupExpiredApplications();
        });
    }

    cleanupExpiredApplications() {
        const now = new Date().toISOString();
        this.db.run(
            "UPDATE applications SET status = 'timeout' WHERE status = 'in_progress' AND expires_at < ?",
            [now],
            function(err) {
                if (err) {
                    console.error('Error cleaning up expired applications:', err);
                } else {
                    console.log(`Cleaned up ${this.changes} expired applications`);
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
            console.error('Please check your .env file in:', __dirname);
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