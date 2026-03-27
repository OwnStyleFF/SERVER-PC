const Database = require('better-sqlite3');
const db = new Database('gcweb.db');
const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(rows);
