const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        for(let i=1; i<=15; i++) {
            db.run(`INSERT INTO players (name, status) VALUES (?, ?)`, [`Player ${i}`, 'waiting']);
        }
        console.log('Inserted 15 mock users into queue.');
    }
});
