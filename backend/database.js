const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Store database in a dedicated data/ directory so Docker can mount the
// entire folder. SQLite WAL mode creates 3 files (.sqlite, -wal, -shm)
// and ALL must persist across container restarts.
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.resolve(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Performance: WAL mode allows concurrent reads during writes
        db.run(`PRAGMA journal_mode=WAL`);
        // Wait up to 5 seconds if the database is locked instead of failing instantly
        db.run(`PRAGMA busy_timeout=5000`);
        
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
