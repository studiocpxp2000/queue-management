const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        db.run(`CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'waiting',
            is_archived INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
        )`);

        db.run(`ALTER TABLE players ADD COLUMN is_archived INTEGER DEFAULT 0`, (err) => {
            if (!err) {
                db.run(`UPDATE players SET is_archived = 1, status = 'waiting' WHERE status = 'deleted'`);
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`, () => {
            db.get(`SELECT * FROM settings WHERE key = 'defaultTimer'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO settings (key, value) VALUES ('defaultTimer', '45')`);
                }
            });
        });
    }
});

module.exports = db;
