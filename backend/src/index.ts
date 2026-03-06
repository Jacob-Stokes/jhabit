import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { initDatabase, db } from './db/database';
import authRouter from './routes/auth';
import { requireAuth } from './middleware/auth';
import { setupMcpRoutes } from './mcp/server';
import { ok, serverError } from './utils/response';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3100;
const APP_NAME = process.env.APP_NAME || 'jhabit';

app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session
if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: SESSION_SECRET is not set. This is unsafe in production.');
  } else {
    console.warn('WARNING: SESSION_SECRET is not set. Using insecure default for development.');
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// Initialize database
initDatabase();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: `${APP_NAME} API is running` });
});

// Auth routes (no auth required)
app.use('/api/auth', authRouter);

// ─── Trackers CRUD ──────────────────────────────────────────
app.get('/api/trackers', requireAuth, (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    let trackers;
    if (type && ['habit', 'quit'].includes(type)) {
      trackers = db.prepare('SELECT * FROM trackers WHERE user_id = ? AND type = ? ORDER BY sort_order, created_at DESC').all(req.user!.id, type);
    } else {
      trackers = db.prepare('SELECT * FROM trackers WHERE user_id = ? ORDER BY sort_order, created_at DESC').all(req.user!.id);
    }
    ok(res, trackers);
  } catch (error: any) {
    serverError(res, error);
  }
});

app.get('/api/trackers/:id', requireAuth, (req, res) => {
  try {
    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?').get(req.params.id as string, req.user!.id);
    if (!tracker) return res.status(404).json({ success: false, error: 'Tracker not found' });
    ok(res, tracker);
  } catch (error: any) {
    serverError(res, error);
  }
});

app.post('/api/trackers', requireAuth, (req, res) => {
  try {
    const { name, type, emoji } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    if (!type || !['habit', 'quit'].includes(type)) return res.status(400).json({ success: false, error: 'Type must be habit or quit' });

    const id = uuidv4();
    db.prepare('INSERT INTO trackers (id, user_id, name, type, emoji) VALUES (?, ?, ?, ?, ?)').run(id, req.user!.id, name, type, emoji || null);

    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
    ok(res, tracker, 201);
  } catch (error: any) {
    serverError(res, error);
  }
});

app.put('/api/trackers/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?').get(req.params.id as string, req.user!.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Tracker not found' });

    const { name, emoji, sort_order } = req.body;
    db.prepare(`UPDATE trackers SET name = COALESCE(?, name), emoji = COALESCE(?, emoji), sort_order = COALESCE(?, sort_order), updated_at = datetime('now') WHERE id = ?`).run(name ?? null, emoji ?? null, sort_order ?? null, req.params.id);

    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ?').get(req.params.id);
    ok(res, tracker);
  } catch (error: any) {
    serverError(res, error);
  }
});

app.delete('/api/trackers/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM trackers WHERE id = ? AND user_id = ?').run(req.params.id as string, req.user!.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Tracker not found' });
    ok(res, { deleted: true });
  } catch (error: any) {
    serverError(res, error);
  }
});

// ─── Entries CRUD ───────────────────────────────────────────
app.get('/api/trackers/:id/entries', requireAuth, (req, res) => {
  try {
    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?').get(req.params.id as string, req.user!.id);
    if (!tracker) return res.status(404).json({ success: false, error: 'Tracker not found' });

    const month = req.query.month as string | undefined; // YYYY-MM
    let entries;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      entries = db.prepare("SELECT * FROM entries WHERE tracker_id = ? AND timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC")
        .all(req.params.id, `${month}-01`, `${month}-32`);
    } else {
      entries = db.prepare('SELECT * FROM entries WHERE tracker_id = ? ORDER BY timestamp DESC').all(req.params.id);
    }
    ok(res, entries);
  } catch (error: any) {
    serverError(res, error);
  }
});

app.post('/api/trackers/:id/entries', requireAuth, (req, res) => {
  try {
    const tracker = db.prepare('SELECT * FROM trackers WHERE id = ? AND user_id = ?').get(req.params.id as string, req.user!.id);
    if (!tracker) return res.status(404).json({ success: false, error: 'Tracker not found' });

    const { timestamp, note } = req.body;
    const id = uuidv4();
    const ts = timestamp || new Date().toISOString();

    db.prepare('INSERT INTO entries (id, tracker_id, user_id, timestamp, note) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, req.user!.id, ts, note || null);

    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
    ok(res, entry, 201);
  } catch (error: any) {
    serverError(res, error);
  }
});

app.delete('/api/entries/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').run(req.params.id as string, req.user!.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Entry not found' });
    ok(res, { deleted: true });
  } catch (error: any) {
    serverError(res, error);
  }
});

// Remote MCP endpoint with OAuth (must be before static files/SPA fallback)
setupMcpRoutes(app);

// Serve frontend static files in production (single-container mode)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`${APP_NAME} running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
