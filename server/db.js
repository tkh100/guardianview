const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/guardianview.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'counselor',
    cabin_group TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    cabin_group TEXT,
    cgm_provider TEXT DEFAULT 'dexcom',
    cgm_auth_mode TEXT DEFAULT 'publisher',
    cgm_username TEXT,
    cgm_password_enc TEXT,
    cgm_url TEXT,
    cgm_session_id TEXT,
    session_expires_at DATETIME,
    target_low INTEGER DEFAULT 70,
    target_high INTEGER DEFAULT 180,
    last_sync_at DATETIME,
    sync_error TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS glucose_readings (
    id INTEGER PRIMARY KEY,
    camper_id INTEGER NOT NULL REFERENCES campers(id) ON DELETE CASCADE,
    value INTEGER NOT NULL,
    trend TEXT,
    reading_time DATETIME NOT NULL,
    UNIQUE(camper_id, reading_time)
  );

  CREATE INDEX IF NOT EXISTS idx_readings_camper_time ON glucose_readings(camper_id, reading_time DESC);

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY,
    camper_id INTEGER NOT NULL REFERENCES campers(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    value INTEGER,
    acknowledged_by INTEGER REFERENCES app_users(id),
    acknowledged_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_camper ON alerts(camper_id, acknowledged_at);

  CREATE TABLE IF NOT EXISTS camper_events (
    id INTEGER PRIMARY KEY,
    camper_id INTEGER NOT NULL REFERENCES campers(id) ON DELETE CASCADE,
    carbs_g INTEGER,
    insulin_units REAL,
    note TEXT,
    created_by INTEGER REFERENCES app_users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_events_camper ON camper_events(camper_id, created_at DESC);
`);

module.exports = db;
