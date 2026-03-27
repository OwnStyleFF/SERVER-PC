import Database from 'better-sqlite3';
const db = new Database('gcweb.db');

function ensureColumn(table, column, columnDef) {
  const info = db.prepare(`PRAGMA table_info('${table}')`).all();
  const exists = info.some(c => c.name === column);
  if (!exists) {
    console.log(`Agregando columna ${column} a ${table}...`);
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`).run();
  } else {
    console.log(`Columna ${column} ya existe en ${table}.`);
  }
}

function ensureUniqueIndex(table, column, indexName) {
  try {
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`).run();
    console.log(`Índice único confirmado: ${indexName}`);
  } catch (e) {
    console.warn(`No se pudo crear índice único '${indexName}' para ${table}.${column}:`, e.message || e);
  }
}

try {
  ensureColumn('equipment', 'pc_id', 'TEXT');
  ensureColumn('pc_agents', 'pc_id', 'TEXT');
  ensureColumn('pc_agents', 'pc_name', 'TEXT');
  ensureColumn('pc_agents', 'expires_at', 'DATETIME');

  ensureUniqueIndex('equipment', 'pc_id', 'idx_equipment_pc_id_unique');
  ensureUniqueIndex('pc_agents', 'pc_id', 'idx_pc_agents_pc_id_unique');

  console.log('Migración de esquema completada.');
} catch (err) {
  console.error('Error de migración:', err.message || err);
  process.exit(1);
} finally {
  db.close();
}
