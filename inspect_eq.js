const Database = require('better-sqlite3');
const db = new Database('gcweb.db');
const cols = db.prepare("PRAGMA table_info('equipment')").all();
console.log(cols.map(c => c.name));
