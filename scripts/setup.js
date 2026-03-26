const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');

console.log('Setting up Ticket Bot...');

// Create database and tables
const db = new sqlite3.Database('./ticket_bot.db', (err) => {
    if (err) {
        console.error('Error creating database:', err);
        return;
    }
    
    console.log('Database created successfully');
    
    // Create tables
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ticket_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            banned_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS punishments (
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

        db.run(`CREATE TABLE IF NOT EXISTS report_bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            banned_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS applications (
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

        db.run(`CREATE TABLE IF NOT EXISTS application_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            action TEXT NOT NULL,
            user_id TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES applications (id)
        )`, () => {
            console.log('All tables created successfully');
            console.log('\nSetup completed!');
            console.log('Next steps:');
            console.log('1. Make sure your BOT_TOKEN is correct in .env');
            console.log('2. Run: npm start');
            console.log('3. The bot will create the application panel automatically');
            
            db.close();
        });
    });
});