const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.DB_PATH || path.join(__dirname, '..', 'data'), 'panels.db');

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

module.exports = db;
