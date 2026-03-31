-- db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_number TEXT UNIQUE NOT NULL,
  title TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  client_vat TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  -- New format: multiple "preventivi" (tabs) stored as JSON
  tabs TEXT NOT NULL DEFAULT '[]',
  -- Fallback for legacy/single-tab rendering
  pricing_mode TEXT DEFAULT 'unit',
  subtotal REAL DEFAULT 0,
  tax_rate REAL DEFAULT 22,
  tax_amount REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  validity_days INTEGER DEFAULT NULL,
  status TEXT DEFAULT 'draft',
  pdf_path TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
