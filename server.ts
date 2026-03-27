import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database('gcweb.db');

// Schema
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  pc_id TEXT UNIQUE,
  cost REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pc_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pc_id TEXT UNIQUE,
  pc_name TEXT,
  token TEXT,
  status TEXT DEFAULT 'pending',
  last_seen DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);
`;

db.exec(SCHEMA_SQL);

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

app.post('/api/pc/pair', (req, res) => {
  const { pc_id, pc_name } = req.body;
  if (!pc_id) return res.status(400).json({ success: false, error: 'pc_id required' });

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60000).toISOString();

  db.prepare(`INSERT INTO pc_agents (pc_id, pc_name, status, created_at, updated_at, expires_at) VALUES (?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(pc_id) DO UPDATE SET pc_name = excluded.pc_name, status = 'pending', updated_at = excluded.updated_at, expires_at = excluded.expires_at;`).run(pc_id, pc_name || null, now, now, expiresAt);

  res.json({ success: true, pc_id, pc_name: pc_name || null, status: 'pending', expires_at: expiresAt });
});

app.post('/api/pc/register', (req, res) => {
  const { pc_id } = req.body;
  if (!pc_id) return res.status(400).json({ success: false, error: 'pc_id required' });

  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id);
  if (!agent) return res.status(404).json({ success: false, error: 'pc not paired' });

  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();

  db.prepare('UPDATE pc_agents SET token = ?, status = ?, updated_at = ?, last_seen = ? WHERE pc_id = ?').run(token, 'paired', now, now, pc_id);

  db.prepare('INSERT OR IGNORE INTO equipment (name, type, status, cost, pc_id) VALUES (?, "PC", "available", 0, ?)').run(pc_id, pc_id);

  res.json({ success: true, pc_id, token });
});

app.get('/api/pc/pending-pair-codes', (req, res) => {
  const now = new Date().toISOString();
  const pending = db.prepare("SELECT pc_id, status, expires_at FROM pc_agents WHERE status = 'pending' AND expires_at > ?").all(now);
  res.json({ success: true, data: pending });
});

app.get('/api/pc/discovered', (req, res) => {
  const freshnessMinutes = Number(req.query.freshnessMinutes || 5);
  const cutoff = new Date(Date.now() - freshnessMinutes * 60 * 1000).toISOString();

  const rows = db.prepare('SELECT pc_id, pc_name, status, last_seen, created_at FROM pc_agents WHERE last_seen >= ? ORDER BY last_seen DESC').all(cutoff);
  res.json({ success: true, data: rows });
});

app.post('/api/pc/claim', (req, res) => {
  const { pc_id } = req.body;
  if (!pc_id) return res.status(400).json({ success: false, error: 'pc_id required' });

  const existing = db.prepare('SELECT * FROM equipment WHERE pc_id = ?').get(pc_id);
  if (existing) return res.status(409).json({ success: false, error: 'already claimed' });

  const info = db.prepare('INSERT INTO equipment (name, type, status, cost, pc_id) VALUES (?, "PC", "available", 0, ?)').run(pc_id, pc_id);
  db.prepare('UPDATE pc_agents SET status = "paired", updated_at = ? WHERE pc_id = ?').run(new Date().toISOString(), pc_id);
  res.json({ success: true, equipmentId: info.lastInsertRowid });
});

app.post('/api/pc/:id/heartbeat', (req, res) => {
  const pc_id = req.params.id;
  const { token } = req.body;
  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id);
  if (!agent || agent.token !== token) return res.status(403).json({ success: false, error: 'invalid token' });
  db.prepare('UPDATE pc_agents SET last_seen = ?, status = ? WHERE pc_id = ?').run(new Date().toISOString(), 'paired', pc_id);
  res.json({ success: true });
});

app.get('/api/pc/:id/status', (req, res) => {
  const pc_id = req.params.id;
  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id);
  if (!agent) return res.status(404).json({ success: false, error: 'not found' });
  res.json({ success: true, agent });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
