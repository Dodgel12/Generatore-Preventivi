// db/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'quotes.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Lightweight migrations for existing DBs (ALTER TABLE when columns are missing)
function ensureQuoteColumns() {
  const cols = db.prepare("PRAGMA table_info('quotes')").all();
  const existing = new Set(cols.map(c => c.name));

  const toAdd = [];
  if (!existing.has('tabs')) toAdd.push("ALTER TABLE quotes ADD COLUMN tabs TEXT NOT NULL DEFAULT '[]'");
  if (!existing.has('pricing_mode')) toAdd.push("ALTER TABLE quotes ADD COLUMN pricing_mode TEXT DEFAULT 'unit'");

  for (const stmt of toAdd) {
    try {
      db.exec(stmt);
      console.log('[DB] Migrazione applicata:', stmt);
    } catch (e) {
      console.warn('[DB] Migrazione saltata (già applicata o non supportata):', stmt, e.message);
    }
  }
}

ensureQuoteColumns();

// Create default admin user if not exists
const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('[DB] Utente admin creato con password: admin123 (cambiala subito!)');
}

module.exports = db;
