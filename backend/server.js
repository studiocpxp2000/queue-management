const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const authenticateAdmin = (req, res, next) => {
    const { username, password } = req.body;
    const envUser = process.env.ADMIN_USER || '';
    const envPass = process.env.ADMIN_PASS || '';
    
    if (username && password && 
        username.toLowerCase() === envUser.toLowerCase() && 
        password.toLowerCase() === envPass.toLowerCase()) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

app.post('/api/admin/login', authenticateAdmin, (req, res) => {
    res.json({ success: true });
});

app.get('/api/admin/players', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    db.all(`SELECT * FROM players ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get(`SELECT COUNT(*) as count FROM players`, (err, countRow) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                data: rows,
                total: countRow.count,
                page,
                totalPages: Math.ceil(countRow.count / limit)
            });
        });
    });
});

app.delete('/api/admin/players/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM players WHERE id = ?`, id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('queueUpdate');
        res.json({ success: true });
    });
});

app.delete('/api/admin/players', (req, res) => {
    db.run(`DELETE FROM players`, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM sqlite_sequence WHERE name='players'`, function() {
            io.emit('queueUpdate');
            res.json({ success: true });
        });
    });
});

app.put('/api/admin/players/:id', (req, res) => {
    const id = req.params.id;
    const { name, status, is_archived } = req.body;
    db.run(`UPDATE players SET name = ?, status = ?, is_archived = ? WHERE id = ?`, [name, status, is_archived, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('queueUpdate');
        res.json({ success: true });
    });
});

app.post('/api/players', (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO players (name, created_at) VALUES (?, datetime('now', '+5 hours', '+30 minutes'))`, [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get(`SELECT value FROM settings WHERE key = 'defaultTimer'`, (err, row) => {
            const timer = parseInt(row ? row.value : 45);
            db.get(`SELECT COUNT(*) as position FROM players WHERE status = 'waiting' AND is_archived = 0 AND id <= ?`, [this.lastID], (err, countRow) => {
                const position = countRow ? countRow.position : 1;
                let waitTime = (position - 1) * timer;
                io.emit('queueUpdate');
                res.json({ success: true, position, waitTime, id: this.lastID });
            });
        });
    });
});

app.get('/api/queue', (req, res) => {
    db.all(`SELECT * FROM players WHERE status = 'waiting' AND is_archived = 0 ORDER BY id ASC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/active-player', (req, res) => {
    db.get(`SELECT * FROM players WHERE status = 'playing' AND is_archived = 0`, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || null);
    });
});

app.get('/api/players/:id/status', (req, res) => {
    db.get(`SELECT status FROM players WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? { status: row.status } : { status: 'not_found' });
    });
});

app.get('/api/settings', (req, res) => {
    db.all(`SELECT * FROM settings`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.post('/api/admin/settings', (req, res) => {
    const { key, value } = req.body;
    db.run(`UPDATE settings SET value = ? WHERE key = ?`, [value, key], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('settingsUpdate');
        io.emit('queueUpdate'); // Recalculate wait times
        res.json({ success: true });
    });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


let currentTimerTimeout = null;
let currentEndTime = 0;
let pendingTimerId = null;
let pendingTimerDuration = 0;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Provide initial state
    socket.on('requestInitialState', () => {
        db.get(`SELECT * FROM players WHERE status = 'playing'`, (err, row) => {
            if (row) {
                if (currentEndTime > Date.now()) {
                    socket.emit('runTimer', { id: row.id, name: row.name, duration: Math.ceil((currentEndTime - Date.now())/1000), endTime: currentEndTime });
                } else if (pendingTimerId === row.id) {
                    socket.emit('preparePlayer', { id: row.id, name: row.name, duration: pendingTimerDuration });
                }
            }
        });
    });

    socket.on('startPlayer', (playerId) => {
        db.run(`UPDATE players SET status = 'completed' WHERE status = 'playing'`, (err) => {
            db.run(`UPDATE players SET status = 'playing' WHERE id = ?`, [playerId], (err) => {
                db.get(`SELECT * FROM players WHERE id = ?`, [playerId], (err, newActiveRow) => {
                    db.get(`SELECT value FROM settings WHERE key = 'defaultTimer'`, (err, row) => {
                        const timer = parseInt(row ? row.value : 45);
                        if (currentTimerTimeout) clearTimeout(currentTimerTimeout);
                        
                        pendingTimerId = playerId;
                        pendingTimerDuration = timer;
                        currentEndTime = 0;
                        
                        io.emit('queueUpdate');
                        io.emit('preparePlayer', { id: playerId, name: newActiveRow.name, duration: timer });
                    });
                });
            });
        });
    });

    socket.on('beginTimer', () => {
        if (!pendingTimerId) return;
        
        const timer = pendingTimerDuration;
        const playerId = pendingTimerId;
        currentEndTime = Date.now() + timer * 1000;
        
        io.emit('runTimer', { id: playerId, duration: timer, endTime: currentEndTime });
        
        currentTimerTimeout = setTimeout(() => {
            db.run(`UPDATE players SET status = 'completed' WHERE id = ?`, [playerId], () => {
                io.emit('playerCompleted', playerId);
                io.emit('queueUpdate');
                pendingTimerId = null;
            });
        }, timer * 1000);
    });

    socket.on('archivePlayer', (playerId) => {
        db.run(`UPDATE players SET is_archived = 1 WHERE id = ?`, [playerId], (err) => {
            io.emit('queueUpdate');
        });
    });

    socket.on('restorePlayer', (playerId) => {
        db.run(`UPDATE players SET is_archived = 0 WHERE id = ?`, [playerId], (err) => {
            io.emit('queueUpdate');
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3012;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
