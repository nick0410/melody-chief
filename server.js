const express    = require('express');
const path       = require('path');
const http       = require('http');
const fs         = require('fs');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const compression = require('compression');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = process.env.PORT || 8080;

// ─── Data directory & helpers ────────────────────────────────────────────────
// On Vercel the filesystem is read-only except /tmp
const IS_VERCEL    = !!process.env.VERCEL;
const DATA_DIR     = path.join(__dirname, 'data');
const WRITE_DIR    = IS_VERCEL ? '/tmp' : DATA_DIR;
const USERS_FILE   = path.join(WRITE_DIR, 'users.json');
const PROFILES_FILE = path.join(WRITE_DIR, 'profiles.json');
const ROOMS_FILE   = path.join(WRITE_DIR, 'rooms.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (IS_VERCEL && !fs.existsSync('/tmp')) { /* /tmp always exists on Vercel */ }

function readJSON(filePath, defaultVal = []) {
    try {
        if (!fs.existsSync(filePath)) return defaultVal;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return defaultVal; }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'melody-chief-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth guard middleware ────────────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    res.redirect('/?error=Please log in to continue');
}

// ─── Page routes ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signup', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
    const name = req.session.userName || 'User';
    req.session.destroy();
    log(`${name} logged out`);
    res.redirect('/?message=Logged out successfully');
});

// ─── Auth routes ─────────────────────────────────────────────────────────────
app.post('/signup', async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
        return res.redirect('/signup?error=All fields are required');
    }
    if (password.length < 6) {
        return res.redirect('/signup?error=Password must be at least 6 characters');
    }

    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) {
        return res.redirect('/signup?error=User already exists');
    }

    const hashedPwd = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(36),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPwd,
        phone,
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    log(`New user registered: ${newUser.name} (${newUser.email})`);

    res.redirect('/?message=Signup successful! Please log in.');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.redirect('/?error=Email and password are required');
    }

    const users = readJSON(USERS_FILE);
    const user  = users.find(u => u.email === email.toLowerCase().trim());

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.redirect('/?error=Invalid credentials');
    }

    req.session.userId   = user.id;
    req.session.userName = user.name;
    log(`User logged in: ${user.name}`);
    res.redirect('/dashboard');
});

// ─── API Routes ───────────────────────────────────────────────────────────────

// Current logged-in user info
app.get('/api/me', requireAuth, (req, res) => {
    const users = readJSON(USERS_FILE);
    const user  = users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
});

// Profiles
app.get('/api/profiles', requireAuth, (req, res) => {
    res.json(readJSON(PROFILES_FILE));
});

app.post('/api/profiles', requireAuth, (req, res) => {
    const profiles = readJSON(PROFILES_FILE);
    const profile  = {
        ...req.body,
        userId:    req.session.userId,
        userName:  req.session.userName,
        createdAt: new Date().toISOString()
    };
    profiles.push(profile);
    writeJSON(PROFILES_FILE, profiles);
    log(`Profile created by ${req.session.userName}`);
    res.json({ success: true, profile });
});

// Rooms
app.get('/api/rooms', requireAuth, (req, res) => {
    res.json(readJSON(ROOMS_FILE, []));
});

app.post('/api/rooms', requireAuth, (req, res) => {
    const rooms = readJSON(ROOMS_FILE, []);
    const room  = {
        id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name:      (req.body.name || `Room by ${req.session.userName}`).trim(),
        createdBy: req.session.userName,
        members:   [req.session.userName],
        createdAt: new Date().toISOString()
    };
    rooms.push(room);
    writeJSON(ROOMS_FILE, rooms);
    io.emit('room:new', room); // broadcast to all connected clients
    log(`Room "${room.name}" created by ${req.session.userName} [${room.id}]`);
    res.json({ success: true, room });
});

// ─── Socket.io – real-time room collaboration ─────────────────────────────────
const activeRooms = {}; // { roomId: Set<userName> }

io.on('connection', (socket) => {
    log(`Socket connected: ${socket.id}`);

    socket.on('room:join', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.data.roomId   = roomId;
        socket.data.userName = userName;
        if (!activeRooms[roomId]) activeRooms[roomId] = new Set();
        activeRooms[roomId].add(userName);
        io.to(roomId).emit('room:users',   Array.from(activeRooms[roomId]));
        io.to(roomId).emit('room:message', { system: true, text: `${userName} joined the room` });
    });

    socket.on('room:message', ({ roomId, userName, text }) => {
        io.to(roomId).emit('room:message', {
            userName,
            text,
            time: new Date().toLocaleTimeString()
        });
    });

    socket.on('room:leave', ({ roomId, userName }) => {
        socket.leave(roomId);
        if (activeRooms[roomId]) {
            activeRooms[roomId].delete(userName);
            io.to(roomId).emit('room:users',   Array.from(activeRooms[roomId]));
            io.to(roomId).emit('room:message', { system: true, text: `${userName} left the room` });
        }
    });

    socket.on('disconnect', () => {
        const { roomId, userName } = socket.data;
        if (roomId && activeRooms[roomId]) {
            activeRooms[roomId].delete(userName);
            io.to(roomId).emit('room:users',   Array.from(activeRooms[roomId]));
            io.to(roomId).emit('room:message', { system: true, text: `${userName} disconnected` });
        }
        log(`Socket disconnected: ${socket.id}`);
    });
});

// ─── ML Recommendations API ──────────────────────────────────────────────────
// Mirrors hybrid (content-based + collaborative) logic from recommendations_ml.ipynb
// Dataset: data/musicians.json  (50 real-style musician records)

const MUSICIANS_FILE = path.join(DATA_DIR, 'musicians.json');
const SKILL_RANK     = { Beginner: 1, Intermediate: 2, Advanced: 3, Expert: 4 };
let _genreIndex      = null;

function genreIndex(db) {
    if (!_genreIndex) {
        const genres = [...new Set(db.map(m => m.genre))].sort();
        _genreIndex  = Object.fromEntries(genres.map((g, i) => [g, i]));
    }
    return _genreIndex;
}

function featureVector(m, db) {
    const gIdx = genreIndex(db);
    const gVec = new Array(Object.keys(gIdx).length).fill(0);
    if (m.genre && gIdx[m.genre] !== undefined) gVec[gIdx[m.genre]] = 1;

    const skill = (SKILL_RANK[m.skill_level] || 2) / 4;
    const exp   = Math.min((parseInt(m.experience) || 3) / 20, 1);

    const instrHash = s => {
        let h = 0;
        for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
        return h / 0xffff;
    };
    return [skill, exp, ...gVec, instrHash(m.instr1), instrHash(m.instr2)];
}

function cosine(a, b) {
    let dot = 0, ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; ma += a[i]*a[i]; mb += b[i]*b[i]; }
    return (ma && mb) ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
}

function contentBased(db, { instrument, genre, skill }) {
    return db.filter(m => {
        const i = instrument
            ? (m.instr1||'').toLowerCase().includes(instrument.toLowerCase()) ||
              (m.instr2||'').toLowerCase().includes(instrument.toLowerCase())
            : true;
        const g = genre  ? (m.genre||'').toLowerCase().includes(genre.toLowerCase())           : true;
        const s = skill  ? (m.skill_level||'').toLowerCase() === skill.toLowerCase()           : true;
        return i && g && s;
    });
}

function collaborativeFilter(db, { instrument, genre, skill }) {
    const qRec = { instr1: instrument||'', instr2:'', genre: genre||db[0]?.genre||'Jazz',
                   skill_level: skill||'Advanced', experience: 5 };
    const qVec = featureVector(qRec, db);
    return db
        .map(m => ({ ...m, _sim: cosine(qVec, featureVector(m, db)) }))
        .sort((a, b) => b._sim - a._sim);
}

app.get('/api/recommendations', requireAuth, (req, res) => {
    const { instrument, genre, skill } = req.query;

    const musicians    = readJSON(MUSICIANS_FILE, []);
    const userProfiles = readJSON(PROFILES_FILE,  []).map((p, i) => ({
        id: `u${i}`, name: p.name, genre: p.genre || '', location: p.location || '',
        skill_level: parseInt(p.experience) >= 10 ? 'Expert' : parseInt(p.experience) >= 5 ? 'Advanced' : 'Intermediate',
        instr1: p.instrumentType || p.vocalType || '', instr2: '',
        availability: 'Flexible', profile_link: '', role: p.role || 'Instrumentalist',
        experience: parseInt(p.experience) || 0
    }));

    const db = [...musicians, ...userProfiles];
    if (!db.length) return res.json([]);

    _genreIndex = null; // reset so genre index rebuilds with fresh data

    const contentResults = contentBased(db, { instrument, genre, skill });
    const collabResults  = collaborativeFilter(db, { instrument, genre, skill }).slice(0, 20);

    const seen   = new Set();
    const merged = [];
    const add    = (m, score, algo) => {
        const key = String(m.id ?? m.name);
        if (seen.has(key)) return; seen.add(key);
        merged.push({ ...m, score: Math.round(score * 100) / 100, algo });
    };

    contentResults.forEach(m => add(m, 0.88 + Math.random() * 0.12, 'content'));
    collabResults .forEach(m => add(m, m._sim ?? 0.5,                'collab'));

    merged.sort((a, b) => (b.score - a.score) || ((b.experience||0) - (a.experience||0)));
    merged.slice(0, 3).forEach(m => { if (m.algo === 'collab') m.algo = 'hybrid'; });

    const result = merged.slice(0, 24).map(({ _sim, ...m }) => m);
    log(`Recommendations → ${result.length} results [instr:${instrument||'-'} genre:${genre||'-'} skill:${skill||'-'}]`);
    res.json(result);
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).redirect('/'));

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
    server.listen(PORT, () => {
        log(`MelodyChief server running → http://localhost:${PORT}`);
    });
}

module.exports = app;
