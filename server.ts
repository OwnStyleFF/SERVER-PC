import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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

CREATE TABLE IF NOT EXISTS pc_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pc_id TEXT,
  command TEXT,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  price REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS peripherals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT,
  equipment_id INTEGER,
  status TEXT DEFAULT 'available',
  cost REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rentals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER,
  type TEXT DEFAULT 'PC',
  identifier TEXT,
  start_time DATETIME,
  end_time DATETIME,
  limit_minutes INTEGER DEFAULT 0,
  advance_payment REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  is_frozen INTEGER DEFAULT 0,
  frozen_at DATETIME,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rental_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rental_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT,
  quantity INTEGER DEFAULT 1,
  price_at_time REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(rental_id) REFERENCES rentals(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT,
  amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS losses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT,
  amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pc_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pc_id TEXT NOT NULL,
  image_data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

db.exec(SCHEMA_SQL);

// Migrate rentals table for older databases
const rentalColumns: any[] = db.prepare("PRAGMA table_info('rentals')").all();
const rentalColumnNames = new Set(rentalColumns.map(c => c.name));
const ensureRentalColumn = (name: string, definition: string) => {
  if (!rentalColumnNames.has(name)) {
    db.prepare(`ALTER TABLE rentals ADD COLUMN ${name} ${definition}`).run();
  }
};

ensureRentalColumn('type', "TEXT DEFAULT 'PC'");
ensureRentalColumn('end_time', 'DATETIME');
ensureRentalColumn('advance_payment', 'REAL DEFAULT 0');
ensureRentalColumn('total_price', 'REAL DEFAULT 0');
ensureRentalColumn('is_frozen', 'INTEGER DEFAULT 0');
ensureRentalColumn('frozen_at', 'DATETIME');

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

app.post('/api/pc/pair', (req, res) => {
  const { pc_id, pc_name } = req.body;
  if (!pc_id) return res.status(400).json({ success: false, error: 'pc_id required' });

  const newName = String(pc_name || pc_id).trim();
  if (!newName) return res.status(400).json({ success: false, error: 'pc_name cannot be empty' });

  const conflict = db.prepare('SELECT pc_id FROM pc_agents WHERE LOWER(pc_name) = LOWER(?) AND pc_id != ?').get(newName, pc_id);
  if (conflict) return res.status(409).json({ success: false, error: 'pc_name already in use' });

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60000).toISOString();

  db.prepare(`INSERT INTO pc_agents (pc_id, pc_name, status, created_at, updated_at, expires_at) VALUES (?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(pc_id) DO UPDATE SET pc_name = excluded.pc_name, status = 'pending', updated_at = excluded.updated_at, expires_at = excluded.expires_at;`).run(pc_id, newName, now, now, expiresAt);

  res.json({ success: true, pc_id, pc_name: newName, status: 'pending', expires_at: expiresAt });
});

app.post('/api/pc/register', (req, res) => {
  const { pc_id, pc_name } = req.body;
  if (!pc_id) return res.status(400).json({ success: false, error: 'pc_id required' });

  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id) as any;
  if (!agent) return res.status(404).json({ success: false, error: 'pc not paired' });

  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();

  db.prepare('UPDATE pc_agents SET token = ?, status = ?, updated_at = ?, last_seen = ?, pc_name = COALESCE(?, pc_name) WHERE pc_id = ?')
    .run(token, 'paired', now, now, pc_name || agent.pc_name, pc_id);

  // Nota: no auto-asignar a inventario en registro. La PC debe ser reclamada manualmente via /api/pc/claim.
  res.json({ success: true, pc_id, token });
});

const normalizePcDisplayName = (pc_id: string, pc_name: string | null) => {
  const rawName = String(pc_name || '').trim();
  if (!rawName || /^pc-one/i.test(rawName)) {
    return pc_id;
  }
  return rawName;
};

app.get('/api/pc/pending-pair-codes', (req, res) => {
  const now = new Date().toISOString();
  const pending = db.prepare("SELECT pc_id, status, expires_at FROM pc_agents WHERE status = 'pending' AND expires_at > ?").all(now);
  res.json({ success: true, data: pending });
});

app.get('/api/pc/discovered', (req, res) => {
  const freshnessMinutes = Number(req.query.freshnessMinutes ?? 60);
  const onlyUnregistered = req.query.unregistered === 'true';
  const useAll = freshnessMinutes <= 0;
  const cutoff = new Date(Date.now() - freshnessMinutes * 60 * 1000).toISOString();

  let sql = `
    SELECT a.pc_id, a.pc_name, a.status, a.last_seen, a.created_at,
           e.id AS equipment_id, e.name AS equipment_name
    FROM pc_agents a
    LEFT JOIN equipment e ON e.pc_id = a.pc_id
  `;

  if (!useAll) {
    sql += 'WHERE a.last_seen >= ? OR a.last_seen IS NULL\n';
  }

  if (onlyUnregistered) {
    sql += useAll ? 'WHERE ' : 'AND ';
    sql += 'e.id IS NULL AND a.status = "paired"\n';
  }

  sql += 'ORDER BY a.last_seen DESC\n';

  const rows = db.prepare(sql).all(useAll ? [] : [cutoff]);

  const enriched = rows.map((r: any) => ({
    pc_id: r.pc_id,
    pc_name: normalizePcDisplayName(r.pc_id, r.pc_name),
    status: r.status,
    last_seen: r.last_seen,
    created_at: r.created_at,
    assigned: Boolean(r.equipment_id),
    equipment_name: r.equipment_name || null
  }));

  res.json({ success: true, data: enriched });
});

app.get('/api/pc/unassigned', (req, res) => {
  const freshnessMinutes = Number(req.query.freshnessMinutes ?? 10);
  const cutoff = new Date(Date.now() - freshnessMinutes * 60 * 1000).toISOString();

  const rows = db.prepare(`
    SELECT pc_id, pc_name, status, last_seen, created_at
    FROM pc_agents
    WHERE status = 'paired'
      AND (last_seen >= ? OR last_seen IS NULL)
      AND pc_id NOT IN (SELECT pc_id FROM equipment WHERE pc_id IS NOT NULL)
    ORDER BY last_seen DESC
  `).all(cutoff);

  const normalizedRows = rows.map((r: any) => ({
    ...r,
    pc_name: normalizePcDisplayName(r.pc_id, r.pc_name)
  }));

  res.json({ success: true, data: normalizedRows });
});

app.post('/api/pc/:id/video-frame', (req, res) => {
  const pc_id = req.params.id;
  const { frame } = req.body;
  if (!pc_id || !frame) return res.status(400).json({ success: false, error: 'pc_id and frame required' });

  db.prepare('INSERT INTO pc_snapshots (pc_id, image_data) VALUES (?, ?)').run(pc_id, frame);
  res.json({ success: true, pc_id });
});

app.get('/api/pc/:id/video/live', (req, res) => {
  const pc_id = req.params.id;
  if (!pc_id) return res.status(400).json({ success: false, error: 'pc_id required' });

  const frame = db.prepare('SELECT * FROM pc_snapshots WHERE pc_id = ? ORDER BY id DESC LIMIT 1').get(pc_id);
  if (!frame) return res.status(404).json({ success: false, error: 'not found' });
  res.json({ success: true, data: frame });
});

app.post('/api/pc/update-name', (req, res) => {
  const { pc_id, pc_name } = req.body;
  if (!pc_id || !pc_name) return res.status(400).json({ success: false, error: 'pc_id and pc_name required' });

  const newName = String(pc_name).trim();
  if (!newName) return res.status(400).json({ success: false, error: 'pc_name cannot be empty' });

  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id);
  if (!agent) return res.status(404).json({ success: false, error: 'pc not found' });

  const conflict = db.prepare('SELECT pc_id FROM pc_agents WHERE LOWER(pc_name) = LOWER(?) AND pc_id != ?').get(newName, pc_id);
  if (conflict) return res.status(409).json({ success: false, error: 'pc_name already in use' });

  db.prepare('UPDATE pc_agents SET pc_name = ?, updated_at = ? WHERE pc_id = ?').run(newName, new Date().toISOString(), pc_id);
  db.prepare('UPDATE equipment SET name = ? WHERE pc_id = ?').run(newName, pc_id);
  res.json({ success: true, pc_id, pc_name: newName });
});

app.post('/api/pc/claim', (req, res) => {
  const { pc_id } = req.body;
  if (!pc_id) return res.status(400).json({ success: false, error: 'pc_id required' });

  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id) as any;
  if (!agent) return res.status(404).json({ success: false, error: 'pc not paired' });
  if (agent.status !== 'paired') return res.status(409).json({ success: false, error: 'pc is not in registration state' });

  const existing = db.prepare('SELECT * FROM equipment WHERE pc_id = ?').get(pc_id);
  if (existing) return res.status(409).json({ success: false, error: 'already claimed' });

  try {
    const pcName = agent.pc_name || pc_id;
    const info = db.prepare('INSERT INTO equipment (name, type, status, cost, pc_id) VALUES (?, "PC", "available", 0, ?)').run(pcName, pc_id);
    db.prepare('UPDATE pc_agents SET status = "paired", updated_at = ? WHERE pc_id = ?').run(new Date().toISOString(), pc_id);
    res.json({ success: true, equipmentId: info.lastInsertRowid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return res.status(500).json({ success: false, error: 'claim failed', details: message });
  }
});

app.post('/api/pc/:id/heartbeat', (req, res) => {
  const pc_id = req.params.id;
  const { token, status } = req.body;

  if (!token) return res.status(400).json({ success: false, error: 'token required' });

  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id) as any;
  if (!agent) return res.status(404).json({ success: false, error: 'pc not found' });
  if (agent.token !== token) return res.status(403).json({ success: false, error: 'invalid token' });

  const equipment = db.prepare('SELECT * FROM equipment WHERE pc_id = ?').get(pc_id) as any;
  const isAssigned = Boolean(equipment);

  const now = new Date().toISOString();
  db.prepare('UPDATE pc_agents SET last_seen = ?, status = ?, updated_at = ? WHERE pc_id = ?').run(now, status || 'paired', now, pc_id);

  const command = db.prepare('SELECT * FROM pc_commands WHERE pc_id = ? AND status = ? ORDER BY id ASC LIMIT 1').get(pc_id, 'pending') as any;

  const isMaintenance = agent.status === 'maintenance';
  let normalMode = false;
  let countdown: number | null = null;
  let rental: any = null;

  if (!isAssigned) {
    normalMode = true;
  } else {
    try {
      rental = db.prepare('SELECT * FROM rentals WHERE equipment_id = ? AND status = ?').get(equipment.id, 'active');
    } catch (e) {
      rental = null;
    }

    if (isMaintenance) {
      normalMode = false;
    } else if (rental) {
      normalMode = true;
      const start = rental.start_time ? new Date(String(rental.start_time).replace(' ', 'T')).getTime() : null;
      if (start && rental.limit_minutes > 0) {
        const remaining = Math.max(0, Math.floor((start + rental.limit_minutes * 60 * 1000 - Date.now()) / 1000));
        if (remaining <= 30) countdown = remaining;
      }
    }
  }

  let action: any = null;

  if (isMaintenance) {
    action = { type: 'maintenance', message: 'Modo mantenimiento activo. Técnico autorizado.' };
  } else if (!isAssigned) {
    action = { type: 'unassigned', message: 'PC no inventariada en POS, arranque normal.' };
  } else if (rental) {
    action = { type: 'active', message: 'Renta activa, acceso liberado.' };
  } else {
    action = { type: 'aod', image: '/image/AOD.png', message: 'PC bloqueada, esperando renta.' };
  }

  if (countdown !== null) {
    action = { type: 'countdown', seconds: countdown };
  }

  if (command) {
    action = action || {};
    action.command = { type: command.command, payload: command.payload ? JSON.parse(command.payload) : null };
    db.prepare('UPDATE pc_commands SET status = ?, delivered_at = ? WHERE id = ?').run('delivered', now, command.id);
  }

  res.json({ success: true, action });
});

app.post('/api/pc/:id/command', (req, res) => {
  const pc_id = req.params.id;
  const { command, payload } = req.body;
  if (!command) return res.status(400).json({ success: false, error: 'command required' });

  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id);
  if (!agent) return res.status(404).json({ success: false, error: 'pc not found' });

  db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)').run(pc_id, command, payload ? JSON.stringify(payload) : null);
  res.json({ success: true, message: `Comando '${command}' encolado para ${pc_id}` });
});

app.get('/api/pc/:id/commands', (req, res) => {
  const pc_id = req.params.id;
  const commands = db.prepare('SELECT id, command, payload, created_at FROM pc_commands WHERE pc_id = ? AND status = ? ORDER BY id ASC').all(pc_id, 'pending');
  res.json({ success: true, commands });
});

app.get('/api/pc/:id/status', (req, res) => {
  const pc_id = req.params.id;
  const agent = db.prepare('SELECT * FROM pc_agents WHERE pc_id = ?').get(pc_id);
  if (!agent) return res.status(404).json({ success: false, error: 'not found' });
  res.json({ success: true, agent });
});

function schedulePcEnforcement() {
  setInterval(() => {
    const agents = db.prepare('SELECT a.pc_id, a.status AS agent_status, e.id AS equipment_id FROM pc_agents a LEFT JOIN equipment e ON e.pc_id = a.pc_id WHERE a.status = ?').all('paired');

    agents.forEach((item: any) => {
      if (!item.equipment_id) return; // no equipment no lock/unlock

      const rental = db.prepare('SELECT * FROM rentals WHERE equipment_id = ? AND status = ?').get(item.equipment_id, 'active') as any;
      if (!rental) {
        // No renta activa -> enviar bloqueo
        db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)').run(item.pc_id, 'lock', JSON.stringify({ message: 'PC sin renta activa - bloqueando' }));
        return;
      }

      const start = rental.start_time ? new Date(String(rental.start_time).replace(' ', 'T')).getTime() : null;
      const expire = start && rental.limit_minutes > 0 ? start + (Number(rental.limit_minutes) || 0) * 60 * 1000 : null;
      const rentalId = rental.id;

      if (expire && Date.now() > expire) {
        db.prepare('UPDATE rentals SET status = ? WHERE id = ?').run('completed', rentalId);
        db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)').run(item.pc_id, 'lock', JSON.stringify({ message: 'Renta expirada - bloqueando' }));
      } else {
        // Si renta activa, desbloquear (puede enviarse unlock como seguro)
        db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)').run(item.pc_id, 'unlock', JSON.stringify({ message: 'Renta activa' }));
      }
    });
  }, 15000);
}

schedulePcEnforcement();
app.get('/api/taecel/status', (req, res) => {
  res.json({ success: true, status: 'ok', lastCacheTimestamp: Date.now(), lastBackupTimestamp: Date.now() });
});

const UPDATE_INFO_FILE = path.join(process.cwd(), 'update-info.json');

app.get('/api/pc/update-info', (req, res) => {
  let updateInfo = {
    version: process.env.PC_CONTROLLER_LATEST_VERSION || '1.0.0',
    url: process.env.PC_CONTROLLER_LATEST_URL || 'https://server-pc-fq7x.onrender.com/downloads/GC%20Web%20Controller%20Devices%20Setup%201.0.0.exe',
    hash: process.env.PC_CONTROLLER_LATEST_HASH || '',
    notes: 'Sin notas de versión'
  };

  if (fs.existsSync(UPDATE_INFO_FILE)) {
    try {
      const raw = fs.readFileSync(UPDATE_INFO_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.version) updateInfo.version = String(parsed.version);
      if (parsed.url) updateInfo.url = String(parsed.url);
      if (parsed.hash) updateInfo.hash = String(parsed.hash);
      if (parsed.notes) updateInfo.notes = String(parsed.notes);
    } catch (err) {
      console.warn('No se pudo leer update-info.json:', err);
    }
  }

  res.json({ success: true, data: updateInfo });
});

app.post('/api/pc/update-info/release', (req, res) => {
  const { version, url, hash, notes, secret } = req.body;

  const expected = process.env.UPDATE_RELEASE_SECRET || 'admin-secret';
  if (!secret || secret !== expected) {
    return res.status(403).json({ success: false, error: 'invalid secret' });
  }

  if (!version || !url) {
    return res.status(400).json({ success: false, error: 'version and url are required' });
  }

  const parsedVersion = String(version).trim();
  if (!parsedVersion) {
    return res.status(400).json({ success: false, error: 'invalid version' });
  }

  const newInfo = {
    version: parsedVersion,
    url: String(url).trim(),
    hash: String(hash || ''),
    notes: String(notes || '')
  };

  try {
    fs.writeFileSync(UPDATE_INFO_FILE, JSON.stringify(newInfo, null, 2), 'utf-8');
    return res.json({ success: true, data: newInfo });
  } catch (err) {
    console.error('No se pudo escribir update-info.json:', err);
    return res.status(500).json({ success: false, error: 'file write failed' });
  }
});

app.post('/api/pc/report-version', (req, res) => {
  const { pc_id, current_version } = req.body;
  if (!pc_id || !current_version) return res.status(400).json({ success: false, error: 'pc_id and current_version required' });

  db.prepare('UPDATE pc_agents SET updated_at = ? WHERE pc_id = ?').run(new Date().toISOString(), pc_id);
  // Opcional: guardar versión en tabla o log para auditoría.

  res.json({ success: true, pc_id, current_version });
});

app.get('/api/taecel/admin/getProductsCount', (req, res) => {
  res.json({ success: true, items: { productos: 0, carriers: 0, categorias: 0, bolsas: 0, productosUnicos: 0 } });
});

app.post('/api/taecel/admin/getProducts', (req, res) => {
  res.json({ success: true, data: { productos: [], carriers: [] } });
});
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json({ success: true, data: products });
});

app.post('/api/products', (req, res) => {
  const { name, category, price, cost, stock } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'name required' });
  const info = db.prepare('INSERT INTO products (name, category, price, cost, stock) VALUES (?, ?, ?, ?, ?)').run(name, category || 'Otros', price || 0, cost || 0, stock || 0);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.json({ success: true, data: product });
});

app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ success: false, error: 'product not found' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ success: true, data: { id } });
});

app.get('/api/equipment', (req, res) => {
  const equipmentList = db.prepare('SELECT * FROM equipment ORDER BY id DESC').all();
  res.json({ success: true, data: equipmentList });
});

app.delete('/api/equipment/:id', (req, res) => {
  const id = Number(req.params.id);
  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  if (!equipment) return res.status(404).json({ success: false, error: 'equipment not found' });
  db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
  res.json({ success: true, data: { id } });
});

app.post('/api/equipment', (req, res) => {
  const { name, type, status, cost, pc_id } = req.body;
  if (!name || !type) return res.status(400).json({ success: false, error: 'name and type required' });
  const info = db.prepare('INSERT INTO equipment (name, type, status, cost, pc_id) VALUES (?, ?, ?, ?, ?)').run(name, type, status || 'available', cost || 0, pc_id || null);
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(info.lastInsertRowid);
  res.json({ success: true, data: item });
});

app.get('/api/peripherals', (req, res) => {
  const peris = db.prepare('SELECT * FROM peripherals ORDER BY id DESC').all();
  res.json({ success: true, data: peris });
});

app.delete('/api/peripherals/:id', (req, res) => {
  const id = Number(req.params.id);
  const peripheral = db.prepare('SELECT * FROM peripherals WHERE id = ?').get(id);
  if (!peripheral) return res.status(404).json({ success: false, error: 'peripheral not found' });
  db.prepare('DELETE FROM peripherals WHERE id = ?').run(id);
  res.json({ success: true, data: { id } });
});

app.post('/api/peripherals', (req, res) => {
  const { name, type, equipment_id, status, cost } = req.body;
  if (!name || !type || !equipment_id) return res.status(400).json({ success: false, error: 'name, type and equipment_id required' });
  const info = db.prepare('INSERT INTO peripherals (name, type, equipment_id, status, cost) VALUES (?, ?, ?, ?, ?)').run(name, type, equipment_id, status || 'available', cost || 0);
  const item = db.prepare('SELECT * FROM peripherals WHERE id = ?').get(info.lastInsertRowid);
  res.json({ success: true, data: item });
});

app.get('/api/rentals/active', (req, res) => {
  const nowMs = Date.now();
  const rows = db.prepare("SELECT r.*, e.name AS equipment_name, e.pc_id AS equipment_pc_id FROM rentals r LEFT JOIN equipment e ON e.id = r.equipment_id WHERE r.status='active' ORDER BY r.id DESC").all();
  const data = rows.map((r: any) => {
    const start = r.start_time ? new Date(String(r.start_time).replace(' ', 'T')).getTime() : null;
    const limitSec = Number(r.limit_minutes || 0) * 60;
    let remaining_seconds = null;
    let is_overdue = false;

    if (start && limitSec > 0) {
      remaining_seconds = Math.ceil((start + limitSec * 1000 - nowMs) / 1000);
      is_overdue = remaining_seconds <= 0;
    }

    return {
      ...r,
      is_frozen: Boolean(r.is_frozen),
      remaining_seconds,
      is_overdue
    };
  });
  res.json({ success: true, data });
});

app.post('/api/rentals/start', (req, res) => {
  const { type = 'PC', identifier, advance_payment = 0, limit_minutes = 0, peripheral_ids = [], equipment_id = null } = req.body;
  if (!identifier) return res.status(400).json({ success: false, error: 'identifier required' });

  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO rentals (equipment_id, type, identifier, start_time, limit_minutes, advance_payment, total_price, is_frozen, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(equipment_id, type, identifier, now, limit_minutes, advance_payment, 0, 0, 'active', now);

  if (equipment_id) {
    db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('rented', equipment_id);
  }

  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(info.lastInsertRowid);
  res.json({ success: true, data: rental });
});

app.post('/api/rentals/:id/complete', (req, res) => {
  const id = Number(req.params.id);
  const { total_price = 0 } = req.body;
  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id) as any;
  if (!rental) return res.status(404).json({ success: false, error: 'rental not found' });

  const now = new Date().toISOString();
  db.prepare('UPDATE rentals SET status = ?, total_price = ?, end_time = ?, is_frozen = 0 WHERE id = ?')
    .run('completed', total_price, now, id);

  if (rental.equipment_id) {
    db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('available', rental.equipment_id);
  }

  res.json({ success: true, data: { id } });
});

app.post('/api/rentals/:id/timeout', (req, res) => {
  const id = Number(req.params.id);
  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id) as any;
  if (!rental) return res.status(404).json({ success: false, error: 'rental not found' });

  const now = new Date().toISOString();
  db.prepare('UPDATE rentals SET status = ?, end_time = ? WHERE id = ?').run('timed_out', now, id);

  if (rental.equipment_id) {
    db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('available', rental.equipment_id);
  }

  res.json({ success: true, data: { id } });
});

app.post('/api/rentals/:id/freeze', (req, res) => {
  const id = Number(req.params.id);
  const { is_frozen } = req.body;
  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id) as any;
  if (!rental) return res.status(404).json({ success: false, error: 'rental not found' });

  const frozen = is_frozen ? 1 : 0;
  const frozenAt = is_frozen ? new Date().toISOString() : null;
  db.prepare('UPDATE rentals SET is_frozen = ?, frozen_at = ? WHERE id = ?').run(frozen, frozenAt, id);

  const equipment = rental.equipment_id ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(rental.equipment_id) as any : null;
  if (equipment?.pc_id) {
    db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)')
      .run(equipment.pc_id, 'freeze', JSON.stringify({ is_frozen: Boolean(frozen) }));
  }

  res.json({ success: true, data: { id, is_frozen: Boolean(frozen) } });
});

app.post('/api/rentals/:id/add-time', (req, res) => {
  const id = Number(req.params.id);
  const { minutes } = req.body;
  if (typeof minutes !== 'number' || isNaN(minutes)) return res.status(400).json({ success: false, error: 'minutes required' });

  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id) as any;
  if (!rental) return res.status(404).json({ success: false, error: 'rental not found' });

  db.prepare('UPDATE rentals SET limit_minutes = limit_minutes + ? WHERE id = ?').run(minutes, id);

  const equipment = rental.equipment_id ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(rental.equipment_id) as any : null;
  if (equipment?.pc_id) {
    db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)')
      .run(equipment.pc_id, 'add-time', JSON.stringify({ minutes }));
  }

  res.json({ success: true, data: { id, limit_minutes: rental.limit_minutes + minutes } });
});

app.post('/api/rentals/:id/reduce-time', (req, res) => {
  const id = Number(req.params.id);
  const { minutes } = req.body;
  if (typeof minutes !== 'number' || isNaN(minutes)) return res.status(400).json({ success: false, error: 'minutes required' });

  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id) as any;
  if (!rental) return res.status(404).json({ success: false, error: 'rental not found' });

  const newLimit = Math.max(0, (rental.limit_minutes || 0) - minutes);
  db.prepare('UPDATE rentals SET limit_minutes = ? WHERE id = ?').run(newLimit, id);

  const equipment = rental.equipment_id ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(rental.equipment_id) as any : null;
  if (equipment?.pc_id) {
    db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)')
      .run(equipment.pc_id, 'reduce-time', JSON.stringify({ minutes }));
  }

  res.json({ success: true, data: { id, limit_minutes: newLimit } });
});

app.post('/api/rentals/:id/cancel', (req, res) => {
  const id = Number(req.params.id);
  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id) as any;
  if (!rental) return res.status(404).json({ success: false, error: 'rental not found' });

  db.prepare('UPDATE rentals SET status = ?, end_time = ? WHERE id = ?').run('cancelled', new Date().toISOString(), id);
  if (rental.equipment_id) {
    db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('available', rental.equipment_id);
  }

  const equipment = rental.equipment_id ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(rental.equipment_id) as any : null;
  if (equipment?.pc_id) {
    db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)')
      .run(equipment.pc_id, 'cancel', JSON.stringify({ reason: 'user_cancelled' }));
  }

  res.json({ success: true, data: { id } });
});

app.put('/api/rentals/:id/limit', (req, res) => {
  const id = Number(req.params.id);
  const { limit_minutes } = req.body;
  if (typeof limit_minutes !== 'number' || isNaN(limit_minutes)) return res.status(400).json({ success: false, error: 'limit_minutes required' });

  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id) as any;
  if (!rental) return res.status(404).json({ success: false, error: 'rental not found' });

  db.prepare('UPDATE rentals SET limit_minutes = ? WHERE id = ?').run(limit_minutes, id);

  const equipment = rental.equipment_id ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(rental.equipment_id) as any : null;
  if (equipment?.pc_id) {
    db.prepare('INSERT INTO pc_commands (pc_id, command, payload) VALUES (?, ?, ?)')
      .run(equipment.pc_id, 'set-limit', JSON.stringify({ limit_minutes }));
  }

  res.json({ success: true, data: { id, limit_minutes } });
});

app.get('/api/rentals/:id/items', (req, res) => {
  const id = Number(req.params.id);
  const items = db.prepare('SELECT * FROM rental_items WHERE rental_id = ? ORDER BY id ASC').all(id);
  res.json({ success: true, data: items });
});

app.post('/api/rentals/:id/add-item', (req, res) => {
  const id = Number(req.params.id);
  const { product_id, quantity = 1, price } = req.body;
  if (!product_id || typeof quantity !== 'number' || isNaN(quantity)) return res.status(400).json({ success: false, error: 'product_id and quantity required' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
  const name = product ? product.name : 'N/A';
  const priceAtTime = typeof price === 'number' && !isNaN(price) ? price : (product ? product.price : 0);

  const existing = db.prepare('SELECT * FROM rental_items WHERE rental_id = ? AND product_id = ?').get(id, product_id) as any;
  if (existing) {
    db.prepare('UPDATE rental_items SET quantity = quantity + ?, price_at_time = ? WHERE id = ?').run(quantity, priceAtTime, existing.id);
    return res.json({ success: true, data: db.prepare('SELECT * FROM rental_items WHERE id = ?').get(existing.id) });
  }

  const info = db.prepare('INSERT INTO rental_items (rental_id, product_id, name, quantity, price_at_time) VALUES (?, ?, ?, ?, ?)')
    .run(id, product_id, name, quantity, priceAtTime);
  const item = db.prepare('SELECT * FROM rental_items WHERE id = ?').get(info.lastInsertRowid);
  res.json({ success: true, data: item });
});

app.patch('/api/rentals/items/:itemId', (req, res) => {
  const itemId = Number(req.params.itemId);
  const { quantity } = req.body;
  if (typeof quantity !== 'number' || isNaN(quantity)) return res.status(400).json({ success: false, error: 'quantity required' });

  const item = db.prepare('SELECT * FROM rental_items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ success: false, error: 'item not found' });

  db.prepare('UPDATE rental_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
  res.json({ success: true, data: db.prepare('SELECT * FROM rental_items WHERE id = ?').get(itemId) });
});

app.delete('/api/rentals/items/:itemId', (req, res) => {
  const itemId = Number(req.params.itemId);
  const item = db.prepare('SELECT * FROM rental_items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ success: false, error: 'item not found' });

  db.prepare('DELETE FROM rental_items WHERE id = ?').run(itemId);
  res.json({ success: true });
});

app.post('/api/equipment/:id/unblock', (req, res) => {
  const id = Number(req.params.id);
  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  if (!equipment) return res.status(404).json({ success: false, error: 'equipment not found' });

  db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('available', id);
  res.json({ success: true, data: { id } });
});

app.get('/api/expenses', (req, res) => {
  const expenses = db.prepare('SELECT * FROM expenses ORDER BY id DESC').all();
  res.json({ success: true, data: expenses });
});

app.get('/api/losses', (req, res) => {
  const losses = db.prepare('SELECT * FROM losses ORDER BY id DESC').all();
  res.json({ success: true, data: losses });
});

app.get('/api/sales', (req, res) => {
  const sales = db.prepare('SELECT * FROM sales ORDER BY id DESC').all();
  res.json({ success: true, data: sales });
});

app.get('/api/analytics/summary', (req, res) => {
  const totalSales = (db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM sales').get() as any).total;
  const totalLosses = (db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM losses').get() as any).total;
  const totalExpenses = (db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM expenses').get() as any).total;
  const totalProducts = (db.prepare('SELECT COUNT(*) AS count FROM products').get() as any).count;
  res.json({ success: true, data: { totalSales, totalLosses, totalExpenses, totalProducts }});
});

app.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
