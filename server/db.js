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

// New tables (safe to re-run — IF NOT EXISTS)
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_settings (
    id INTEGER PRIMARY KEY,
    camper_id INTEGER NOT NULL REFERENCES campers(id) ON DELETE CASCADE,
    setting_date TEXT NOT NULL,
    icr REAL,
    isf REAL,
    target_bg INTEGER,
    closed_loop INTEGER,
    long_acting_am REAL,
    long_acting_bed REAL,
    created_by INTEGER REFERENCES app_users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(camper_id, setting_date)
  );

  CREATE INDEX IF NOT EXISTS idx_daily_settings_camper ON daily_settings(camper_id, setting_date);

  CREATE TABLE IF NOT EXISTS sheets_sync_state (
    table_name TEXT PRIMARY KEY,
    last_synced_id INTEGER DEFAULT 0,
    last_synced_at DATETIME
  );
`);

// Migrations for columns added after initial deploy
const migrate = (sql) => { try { db.exec(sql); } catch {} };

// campers — original migration
migrate('ALTER TABLE campers ADD COLUMN carb_ratio REAL');

// campers — profile fields (both pump and injection)
migrate('ALTER TABLE campers ADD COLUMN age INTEGER');
migrate('ALTER TABLE campers ADD COLUMN allergies TEXT');
migrate("ALTER TABLE campers ADD COLUMN delivery_method TEXT DEFAULT 'pump'");
migrate('ALTER TABLE campers ADD COLUMN med_breakfast TEXT');
migrate('ALTER TABLE campers ADD COLUMN med_lunch TEXT');
migrate('ALTER TABLE campers ADD COLUMN med_dinner TEXT');
migrate('ALTER TABLE campers ADD COLUMN med_bed TEXT');
migrate('ALTER TABLE campers ADD COLUMN med_emergency TEXT');
migrate('ALTER TABLE campers ADD COLUMN a1c REAL');
migrate('ALTER TABLE campers ADD COLUMN weight REAL');
migrate('ALTER TABLE campers ADD COLUMN long_acting_type TEXT');
migrate('ALTER TABLE campers ADD COLUMN short_acting_type TEXT');
migrate('ALTER TABLE campers ADD COLUMN cgm_pin TEXT');
migrate('ALTER TABLE campers ADD COLUMN profile_notes TEXT');
migrate('ALTER TABLE campers ADD COLUMN home_icr REAL');
migrate('ALTER TABLE campers ADD COLUMN home_isf REAL');
migrate('ALTER TABLE campers ADD COLUMN home_target_bg INTEGER DEFAULT 150');
migrate("ALTER TABLE campers ADD COLUMN activity_level TEXT DEFAULT 'moderate'");

// campers — registration review (both)
migrate('ALTER TABLE campers ADD COLUMN reg_recent_illness TEXT');
migrate('ALTER TABLE campers ADD COLUMN reg_open_wounds TEXT');
migrate('ALTER TABLE campers ADD COLUMN reg_scar_tissue TEXT');
migrate('ALTER TABLE campers ADD COLUMN reg_lice TEXT');
migrate('ALTER TABLE campers ADD COLUMN reg_meds_received INTEGER DEFAULT 0');
migrate('ALTER TABLE campers ADD COLUMN reg_cgm_supplies_received INTEGER DEFAULT 0');

// campers — pump-specific
migrate('ALTER TABLE campers ADD COLUMN pump_pin TEXT');
migrate('ALTER TABLE campers ADD COLUMN closed_loop INTEGER DEFAULT 0');
migrate('ALTER TABLE campers ADD COLUMN home_basal_rates TEXT');
migrate('ALTER TABLE campers ADD COLUMN reg_pump_supplies_received INTEGER DEFAULT 0');
migrate('ALTER TABLE campers ADD COLUMN pump_site_count INTEGER');
migrate('ALTER TABLE campers ADD COLUMN pump_reservoir_count INTEGER');

// campers — injection-specific
migrate('ALTER TABLE campers ADD COLUMN home_long_acting_am REAL');
migrate('ALTER TABLE campers ADD COLUMN home_long_acting_bed REAL');
migrate('ALTER TABLE campers ADD COLUMN reg_sensor_count INTEGER');
migrate('ALTER TABLE campers ADD COLUMN reg_half_unit_syringes INTEGER DEFAULT 0');

// Cabin group format: convert old letter-first format (B2, G1) → number-first (2B, 1G)
migrate(`UPDATE campers SET cabin_group = SUBSTR(cabin_group, 2) || SUBSTR(cabin_group, 1, 1) WHERE LENGTH(cabin_group) >= 2 AND UPPER(SUBSTR(cabin_group, 1, 1)) BETWEEN 'A' AND 'Z' AND CAST(SUBSTR(cabin_group, 2) AS INTEGER) > 0`);
migrate(`UPDATE app_users SET cabin_group = SUBSTR(cabin_group, 2) || SUBSTR(cabin_group, 1, 1) WHERE LENGTH(cabin_group) >= 2 AND UPPER(SUBSTR(cabin_group, 1, 1)) BETWEEN 'A' AND 'Z' AND CAST(SUBSTR(cabin_group, 2) AS INTEGER) > 0`);

// camper_events — expanded flowsheet fields
migrate('ALTER TABLE camper_events ADD COLUMN bg_manual INTEGER');
migrate('ALTER TABLE camper_events ADD COLUMN ketones REAL');
migrate('ALTER TABLE camper_events ADD COLUMN calc_dose REAL');
migrate('ALTER TABLE camper_events ADD COLUMN dose_given REAL');
migrate('ALTER TABLE camper_events ADD COLUMN site_change INTEGER DEFAULT 0');
migrate('ALTER TABLE camper_events ADD COLUMN prebolus INTEGER DEFAULT 0');
migrate('ALTER TABLE camper_events ADD COLUMN long_acting_given INTEGER DEFAULT 0');
migrate('ALTER TABLE camper_events ADD COLUMN meal_type TEXT');
migrate('ALTER TABLE camper_events ADD COLUMN med_slot TEXT');

// app_users — medical access flag
migrate('ALTER TABLE app_users ADD COLUMN medical_access INTEGER DEFAULT 0');

module.exports = db;
