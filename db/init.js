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

  CREATE TABLE IF NOT EXISTS wiring_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    annotation_id INTEGER NOT NULL,
    pin TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT DEFAULT '',
    wire_color TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
  );
`);

// Migration: add marker position columns if missing
const cols = db.prepare("PRAGMA table_info(panels)").all().map(c => c.name);
if (!cols.includes('marker_x_percent')) {
  db.exec("ALTER TABLE panels ADD COLUMN marker_x_percent REAL DEFAULT 0.5");
  db.exec("ALTER TABLE panels ADD COLUMN marker_y_percent REAL DEFAULT 0.5");
}

// Migration: add manual_url and manual_filename columns if missing
if (!cols.includes('manual_url')) {
  db.exec("ALTER TABLE panels ADD COLUMN manual_url TEXT DEFAULT ''");
  db.exec("ALTER TABLE panels ADD COLUMN manual_filename TEXT DEFAULT ''");
}

// Migration: reassign marker values > 31 to valid 0-31 range for 4x4_BCH_13_5_5
const outOfRange = db.prepare('SELECT id, name, marker_value FROM panels WHERE marker_value > 31 ORDER BY id').all();
if (outOfRange.length > 0) {
  const usedValues = new Set(
    db.prepare('SELECT marker_value FROM panels').all().map(r => r.marker_value)
  );
  const updateStmt = db.prepare('UPDATE panels SET marker_value = ? WHERE id = ?');
  const migrate = db.transaction(() => {
    for (const panel of outOfRange) {
      // Find next available value in 0-31
      let newVal = 0;
      while (usedValues.has(newVal) && newVal <= 31) newVal++;
      if (newVal > 31) {
        console.warn(`Migration: no free marker slot for panel "${panel.name}" (id=${panel.id}), skipping`);
        continue;
      }
      console.log(`Migration: panel "${panel.name}" marker ${panel.marker_value} -> ${newVal}`);
      usedValues.delete(panel.marker_value);
      usedValues.add(newVal);
      updateStmt.run(newVal, panel.id);
    }
  });
  migrate();
}

module.exports = db;
