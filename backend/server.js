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

// ── Performance: Debounced queue broadcast ──────────────────────────
// Coalesce rapid-fire queueUpdate emissions into a single broadcast.
// Under load, 500 registrations would normally fire 500 × N broadcasts.
// This reduces it to ~1 broadcast per 300ms window.
let queueUpdatePending = false;
let queueUpdateTimer = null;

function emitQueueUpdate(ioInstance) {
    if (queueUpdatePending) return; // Already scheduled
    queueUpdatePending = true;
    queueUpdateTimer = setTimeout(() => {
        ioInstance.emit('queueUpdate');
        queueUpdatePending = false;
    }, 300); // 300ms debounce window
}

// ── Performance: Cached settings ────────────────────────────────────
// The defaultTimer value rarely changes but is read on every registration.
// Cache it in memory and only refresh when settings are updated.
let cachedDefaultTimer = 45;
db.get(`SELECT value FROM settings WHERE key = 'defaultTimer'`, (err, row) => {
    if (row) cachedDefaultTimer = parseInt(row.value);
});

const server = http.createServer(app);

// Increase max listeners to handle many concurrent Socket.io connections
server.maxConnections = 1024;
process.setMaxListeners(0); // Remove EventEmitter limit warnings

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    },
    // Performance tuning for high concurrency
    pingTimeout: 60000,        // 60s before considering a client dead (default: 20s)
    pingInterval: 25000,       // Check every 25s (default: 25s)
    transports: ['websocket', 'polling'], // Allow fallback to polling
    maxHttpBufferSize: 1e6,    // 1MB max message size
    connectTimeout: 45000,     // 45s connection timeout
    allowEIO3: true            // Allow Engine.IO v3 clients
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

app.delete('/api/admin/players', (req, res) => {
    db.run(`DELETE FROM players`, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM sqlite_sequence WHERE name='players'`, function() {
            console.log('Admin: Database cleared (all players deleted)');
            emitQueueUpdate(io);
            res.json({ success: true });
        });
    });
});

app.delete('/api/admin/players/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM players WHERE id = ?`, id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        emitQueueUpdate(io);
        res.json({ success: true });
    });
});

app.put('/api/admin/players/:id', (req, res) => {
    const id = req.params.id;
    const { name, status, is_archived } = req.body;
    db.run(`UPDATE players SET name = ?, status = ?, is_archived = ? WHERE id = ?`, [name, status, is_archived, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        emitQueueUpdate(io);
        res.json({ success: true });
    });
});

app.post('/api/players', (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO players (name, created_at) VALUES (?, datetime('now', '+5 hours', '+30 minutes'))`, [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const lastId = this.lastID;
        const timer = cachedDefaultTimer; // Use cached value instead of DB query
        db.get(`SELECT COUNT(*) as position FROM players WHERE status = 'waiting' AND is_archived = 0 AND id <= ?`, [lastId], (err, countRow) => {
            const position = countRow ? countRow.position : 1;
            let waitTime = (position - 1) * timer;
            emitQueueUpdate(io);
            res.json({ success: true, position, waitTime, id: lastId });
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
        // Refresh cached timer when settings change
        if (key === 'defaultTimer') cachedDefaultTimer = parseInt(value);
        io.emit('settingsUpdate');
        emitQueueUpdate(io);
        res.json({ success: true });
    });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


let currentTimerTimeout = null;
let currentEndTime = 0;
let pendingTimerId = null;
let pendingTimerDuration = 0;
let connectionCount = 0;

io.on('connection', (socket) => {
    connectionCount++;
    if (connectionCount % 50 === 0) console.log(`Active connections: ${connectionCount}`);

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
                    const timer = cachedDefaultTimer; // Use cached value
                    if (currentTimerTimeout) clearTimeout(currentTimerTimeout);
                    
                    pendingTimerId = playerId;
                    pendingTimerDuration = timer;
                    currentEndTime = 0;
                    
                    emitQueueUpdate(io);
                    io.emit('preparePlayer', { id: playerId, name: newActiveRow.name, duration: timer });
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
                emitQueueUpdate(io);
                pendingTimerId = null;
            });
        }, timer * 1000);
    });

    socket.on('archivePlayer', (playerId) => {
        db.run(`UPDATE players SET is_archived = 1 WHERE id = ?`, [playerId], (err) => {
            emitQueueUpdate(io);
        });
    });

    socket.on('softDeletePlayer', (playerId) => {
        db.run(`UPDATE players SET is_archived = 1 WHERE id = ?`, [playerId], (err) => {
            emitQueueUpdate(io);
        });
    });

    socket.on('restorePlayer', (playerId) => {
        db.run(`UPDATE players SET is_archived = 0 WHERE id = ?`, [playerId], (err) => {
            emitQueueUpdate(io);
        });
    });

    socket.on('disconnect', () => {
        connectionCount--;
    });
});

const PORT = process.env.PORT || 3012;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// Deployment Test: ${new Date().toISOString()} - Verifying that no test data is generated on push.
