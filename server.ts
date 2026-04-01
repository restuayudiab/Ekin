import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise'; // Import mysql2
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000; // Use PORT from environment variables

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Global logging
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});

let db: mysql.Connection | null = null; // Change db type to mysql.Connection

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

apiRouter.get('/health', async (req, res) => {
  try {
    if (db) {
      await db.ping(); // Check database connection
      res.json({ status: 'ok', timestamp: new Date().toISOString(), dbConnected: true });
    } else {
      res.json({ status: 'ok', timestamp: new Date().toISOString(), dbConnected: false });
    }
  } catch (error) {
    console.error('Health check database error:', error);
    res.status(500).json({ status: 'error', timestamp: new Date().toISOString(), dbConnected: false, error: error.message });
  }
});

apiRouter.get('/users', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const [rows] = await db.execute('SELECT * FROM users');
    res.json(rows || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/users', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const u = req.body;
    const sql = `REPLACE INTO users (id, name, idPjlp, jabatan, satuanKerja, unitKerja, username, password, role, whatsapp, pengawasName, pengawasNip, kepalaSatuanName, kepalaSatuanNip) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await db.execute(sql, [u.id, u.name, u.idPjlp, u.jabatan, u.satuanKerja, u.unitKerja, u.username, u.password, u.role, u.whatsapp, u.pengawasName, u.pengawasNip, u.kepalaSatuanName, u.kepalaSatuanNip]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/activities', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const [rows]: any = await db.execute('SELECT * FROM activities');
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

apiRouter.post('/activities', async (req, res) => {
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
    await db.execute(sql, params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/activities/:id', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    await db.execute('DELETE FROM activities WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/suggestions', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const [rows] = await db.execute('SELECT * FROM suggestions ORDER BY createdAt DESC');
    res.json(rows || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/suggestions', async (req, res) => {
  try {
    if (!db) throw new Error('Database not connected');
    const s = req.body;
    const sql = `INSERT INTO suggestions (id, userId, userName, content, createdAt) VALUES (?, ?, ?, ?, ?)`;
    await db.execute(sql, [s.id, s.userId, s.userName, s.content, s.createdAt]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for API routes to prevent falling through to SPA fallback
apiRouter.all('*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

async function initDb() {
  try {
    console.log('Initializing MySQL database...');
    db = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    });
    console.log('Connected to MySQL database');
    await setupTables();
    await seedDb();
  } catch (err: any) {
    console.error('Database initialization error:', err.message);
    // Exit process if database connection fails to prevent app from running without DB
    process.exit(1);
  }
}

async function seedDb() {
  if (!db) return;

  try {
    const [userCountRows]: any = await db.execute('SELECT COUNT(*) as count FROM users');
    const userCount = userCountRows[0].count;

    if (userCount === 0) {
      console.log('Seeding initial users...');
      const mockUsers = [
        ['1', 'AGUNG SUMARDI', '80339397', 'PETUGAS TEKNISI AC', 'SATUAN PRASARANA DAN SARANA', 'UP. TERMINAL TERPADU PULO GEBANG', 'agung', 'password123', 'admin', 'DIANTY SUBAGIARTY', '198301112009042006', 'WAHYU HIDAYAT', '198303142010011020'],
        ['2', 'BUDI SANTOSO', '80339400', 'PETUGAS TEKNISI LISTRIK', 'SATUAN PRASARANA DAN SARANA', 'UP. TERMINAL TERPADU PULO GEBANG', 'budi', 'password123', 'user', 'DIANTY SUBAGIARTY', '198301112009042006', 'WAHYU HIDAYAT', '198303142010011020']
      ];
      const insertUser = `INSERT IGNORE INTO users (id, name, idPjlp, jabatan, satuanKerja, unitKerja, username, password, role, pengawasName, pengawasNip, kepalaSatuanName, kepalaSatuanNip) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const u of mockUsers) {
        await db.execute(insertUser, u);
      }
    }

    const [activityCountRows]: any = await db.execute('SELECT COUNT(*) as count FROM activities');
    const activityCount = activityCountRows[0].count;

    if (activityCount === 0) {
      console.log('Seeding initial activities...');
      const mockActivities = [
        ['1', '1', '2025-10-30', '', '', 'LIBUR', '2', 1, 0, '[]'],
        ['2', '1', '2025-10-31', '', '', 'LIBUR', '2', 1, 0, '[]'],
        ['3', '1', '2025-11-01', '07:00', '15:00', '- Pelaksanaan Apel Pagi rutin\n- Monitoring unit AC dan Menyalakan unit ac Area Terminal pulogebang.\n- maintenance of indoor air conditioning filter changes in the 2nd floor area of departure.\n- ISHOMA\n- Giat Cleaning filter AC dan mengecek unit AC seluruh area', '1', 0, 1, '["https://picsum.photos/seed/ac1/200/200", "https://picsum.photos/seed/ac2/200/200"]']
      ];
      const insertActivity = `INSERT IGNORE INTO activities (id, userId, date, startTime, endTime, description, type, isLibur, isNormal, photos) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const a of mockActivities) {
        await db.execute(insertActivity, a);
      }
      
      const insertActivityMfd = `INSERT IGNORE INTO activities (id, userId, date, startTime, endTime, description, type, isMfd, isNormal, mfdLocation, photos)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      await db.execute(insertActivityMfd, ['4', '1', '2025-11-03', '', '', 'MFD (Mental, Fisik dan Disiplin) RINDAM JAYA CONDET', '3', 1, 0, 'RINDAM JAYA CONDET', '[]']);
    }
    console.log('Database seeding completed');
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

async function setupTables() {
  if (!db) return;

  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    idPjlp VARCHAR(255),
    jabatan VARCHAR(255),
    satuanKerja VARCHAR(255),
    unitKerja VARCHAR(255),
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(255),
    whatsapp VARCHAR(255),
    pengawasName VARCHAR(255),
    pengawasNip VARCHAR(255),
    kepalaSatuanName VARCHAR(255),
    kepalaSatuanNip VARCHAR(255)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS suggestions (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255),
    userName VARCHAR(255),
    content TEXT,
    createdAt VARCHAR(255)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS activities (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255),
    date VARCHAR(255),
    startTime VARCHAR(255),
    endTime VARCHAR(255),
    description TEXT,
    type VARCHAR(255),
    location VARCHAR(255),
    isLibur TINYINT(1) DEFAULT 0,
    isMfd TINYINT(1) DEFAULT 0,
    isNormal TINYINT(1) DEFAULT 0,
    mfdLocation VARCHAR(255),
    photos TEXT
  )`);

  // Check for missing columns (MySQL version - simplified as ALTER TABLE is more direct)
  // This part might need more robust handling for production, but for Railway, direct creation is often sufficient
  // if the schema is managed via migrations or initial setup.
  // For now, we assume the initial CREATE TABLE IF NOT EXISTS handles most cases.
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

  // 3. Initialize database (moved before app.listen to ensure DB is ready)
  await initDb();

  // 4. Start listening
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
