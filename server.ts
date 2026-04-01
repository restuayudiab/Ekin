import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Global logging
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});

let db: Database.Database | null = null;

const apiRouter = express.Router();

// Debug logging for API requests
apiRouter.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Middleware to check if database is ready for API calls
apiRouter.use((req, res, next) => {
  if (!db && req.path !== '/health') {
    return res.status(503).json({ 
      error: 'Database belum terhubung.',
      code: 'DB_NOT_CONNECTED'
    });
  }
  next();
});

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), dbConnected: !!db });
});

apiRouter.get('/users', (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const rows = db.prepare('SELECT * FROM users').all();
    res.json(rows || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/users', (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const u = req.body;
    const sql = `REPLACE INTO users (id, name, idPjlp, jabatan, satuanKerja, unitKerja, username, password, role, whatsapp, pengawasName, pengawasNip, kepalaSatuanName, kepalaSatuanNip) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.prepare(sql).run([u.id, u.name, u.idPjlp, u.jabatan, u.satuanKerja, u.unitKerja, u.username, u.password, u.role, u.whatsapp, u.pengawasName, u.pengawasNip, u.kepalaSatuanName, u.kepalaSatuanNip]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/activities', (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const rows: any = db.prepare('SELECT * FROM activities').all();
    const activities = (rows || []).map((r: any) => ({
      ...r,
      isLibur: !!r.isLibur,
      isMfd: !!r.isMfd,
      isNormal: !!r.isNormal,
      photos: JSON.parse(r.photos || '[]')
    }));
    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/activities', (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const a = req.body;
    const params = [
      a.id, a.userId, a.date, a.startTime || '', a.endTime || '', a.description || '', 
      a.type || '', a.location || '', a.isLibur ? 1 : 0, a.isMfd ? 1 : 0, a.isNormal ? 1 : 0, 
      a.mfdLocation || '', JSON.stringify(a.photos || [])
    ];
    const sql = `REPLACE INTO activities (
      id, userId, date, startTime, endTime, description, type, location, isLibur, isMfd, isNormal, mfdLocation, photos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.prepare(sql).run(params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/activities/:id', (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    db.prepare('DELETE FROM activities WHERE id = ?').run([req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/suggestions', (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const rows = db.prepare('SELECT * FROM suggestions ORDER BY createdAt DESC').all();
    res.json(rows || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/suggestions', (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const s = req.body;
    const sql = `INSERT INTO suggestions (id, userId, userName, content, createdAt) VALUES (?, ?, ?, ?, ?)`;
    db.prepare(sql).run([s.id, s.userId, s.userName, s.content, s.createdAt]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for API routes to prevent falling through to SPA fallback
apiRouter.all('*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

function initDb() {
  try {
    console.log('Initializing SQLite database...');
    db = new Database('pjlp.db');
    console.log('Connected to SQLite database');
    setupTables();
    seedDb();
  } catch (err: any) {
    console.error('Database initialization error:', err.message);
  }
}

function seedDb() {
  if (!db) return;

  try {
    const userCount: any = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      console.log('Seeding initial users...');
      const mockUsers = [
        ['1', 'AGUNG SUMARDI', '80339397', 'PETUGAS TEKNISI AC', 'SATUAN PRASARANA DAN SARANA', 'UP. TERMINAL TERPADU PULO GEBANG', 'agung', 'password123', 'admin', 'DIANTY SUBAGIARTY', '198301112009042006', 'WAHYU HIDAYAT', '198303142010011020'],
        ['2', 'BUDI SANTOSO', '80339400', 'PETUGAS TEKNISI LISTRIK', 'SATUAN PRASARANA DAN SARANA', 'UP. TERMINAL TERPADU PULO GEBANG', 'budi', 'password123', 'user', 'DIANTY SUBAGIARTY', '198301112009042006', 'WAHYU HIDAYAT', '198303142010011020']
      ];
      const insertUser = db.prepare(`INSERT INTO users (id, name, idPjlp, jabatan, satuanKerja, unitKerja, username, password, role, pengawasName, pengawasNip, kepalaSatuanName, kepalaSatuanNip) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const u of mockUsers) {
        insertUser.run(u);
      }
    }

    const activityCount: any = db.prepare('SELECT COUNT(*) as count FROM activities').get();
    if (activityCount.count === 0) {
      console.log('Seeding initial activities...');
      const mockActivities = [
        ['1', '1', '2025-10-30', '', '', 'LIBUR', '2', 1, 0, '[]'],
        ['2', '1', '2025-10-31', '', '', 'LIBUR', '2', 1, 0, '[]'],
        ['3', '1', '2025-11-01', '07:00', '15:00', '- Pelaksanaan Apel Pagi rutin\n- Monitoring unit AC dan Menyalakan unit ac Area Terminal pulogebang.\n- maintenance of indoor air conditioning filter changes in the 2nd floor area of departure.\n- ISHOMA\n- Giat Cleaning filter AC dan mengecek unit AC seluruh area', '1', 0, 1, '["https://picsum.photos/seed/ac1/200/200", "https://picsum.photos/seed/ac2/200/200"]']
      ];
      const insertActivity = db.prepare(`INSERT INTO activities (id, userId, date, startTime, endTime, description, type, isLibur, isNormal, photos) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const a of mockActivities) {
        insertActivity.run(a);
      }
    }
    console.log('Database seeding completed');
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

function setupTables() {
  if (!db) return;

  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    idPjlp TEXT,
    jabatan TEXT,
    satuanKerja TEXT,
    unitKerja TEXT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    whatsapp TEXT,
    pengawasName TEXT,
    pengawasNip TEXT,
    kepalaSatuanName TEXT,
    kepalaSatuanNip TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    userName TEXT,
    content TEXT,
    createdAt TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    userId TEXT,
    date TEXT,
    startTime TEXT,
    endTime TEXT,
    description TEXT,
    type TEXT,
    location TEXT,
    isLibur INTEGER,
    isMfd INTEGER,
    isNormal INTEGER,
    mfdLocation TEXT,
    photos TEXT
  )`);

  // Check for missing columns (SQLite version)
  const tableInfo = db.prepare("PRAGMA table_info(activities)").all();
  const existingCols = tableInfo.map((c: any) => c.name);
  const cols = [
    { n: 'type', t: 'TEXT' },
    { n: 'location', t: 'TEXT' },
    { n: 'isLibur', t: 'INTEGER' },
    { n: 'isMfd', t: 'INTEGER' },
    { n: 'isNormal', t: 'INTEGER' },
    { n: 'mfdLocation', t: 'TEXT' },
    { n: 'photos', t: 'TEXT' }
  ];
  
  for (const c of cols) {
    if (!existingCols.includes(c.n)) {
      db.exec(`ALTER TABLE activities ADD COLUMN ${c.n} ${c.t}`);
    }
  }
}

async function startServer() {
  console.log('Starting server initialization...');
  
  // 1. API Router FIRST
  app.use('/api', apiRouter);

  // 2. Setup Vite or Static files
  if (process.env.NODE_ENV !== 'production') {
    console.log('Setting up Vite middleware...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware ready');
    } catch (err) {
      console.error('Vite setup failed:', err);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // For API routes that somehow reached here, return JSON 404
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 3. Start listening
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // 4. Initialize database
  initDb();
}

startServer();


