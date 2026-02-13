const Database = require('better-sqlite3');
const path = require('path');

const dataDir = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'panels.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_filename TEXT,
    marker_value INTEGER UNIQUE,
    marker_x_percent REAL DEFAULT 0.5,
    marker_y_percent REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    panel_id INTEGER NOT NULL,
    x_percent REAL NOT NULL,
    y_percent REAL NOT NULL,
    label TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#ff0000',
    FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE
  );
`);

// Migration: add marker position columns if missing
const cols = db.prepare("PRAGMA table_info(panels)").all().map(c => c.name);
if (!cols.includes('marker_x_percent')) {
  db.exec("ALTER TABLE panels ADD COLUMN marker_x_percent REAL DEFAULT 0.5");
  db.exec("ALTER TABLE panels ADD COLUMN marker_y_percent REAL DEFAULT 0.5");
}

module.exports = db;
