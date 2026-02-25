/**
 * Background sync engine
 * Polls all active campers every 60 seconds in batches of 15
 */
const db = require('./db');
const { decrypt } = require('./crypto');
const dexcom = require('./providers/dexcom');
const nightscout = require('./providers/nightscout');
const libre = require('./providers/libre');

const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 500;
const SYNC_INTERVAL_MS = 60_000;
const NO_DATA_ALERT_MINUTES = 15;

// Follower session cache (shared across all follower-mode campers)
// Only re-auth on actual SessionExpiredError — no arbitrary timer
let followerSession = null;

async function getFollowerSession() {
  if (followerSession) return followerSession;
  const { DEXCOM_FOLLOWER_USERNAME, DEXCOM_FOLLOWER_PASSWORD } = process.env;
  if (!DEXCOM_FOLLOWER_USERNAME || !DEXCOM_FOLLOWER_PASSWORD) {
    throw new Error('Follower credentials not configured in env');
  }
  followerSession = await dexcom.loginFollower(DEXCOM_FOLLOWER_USERNAME, DEXCOM_FOLLOWER_PASSWORD);
  return followerSession;
}

async function syncCamper(camper) {
  let readings = [];

  try {
    switch (camper.cgm_provider) {
      case 'dexcom': {
        if (camper.cgm_auth_mode === 'follower') {
          const session = await getFollowerSession();
          try {
            readings = await dexcom.getFollowerReadings(session);
          } catch (e) {
            if (e.name === 'SessionExpiredError') followerSession = null;
            throw e;
          }
        } else {
          // Publisher mode — authenticate once, re-auth only on SessionExpiredError
          let sessionId = camper.cgm_session_id;
          if (!sessionId) {
            const password = decrypt(camper.cgm_password_enc);
            sessionId = await dexcom.loginPublisher(camper.cgm_username, password);
            db.prepare('UPDATE campers SET cgm_session_id=? WHERE id=?').run(sessionId, camper.id);
          }
          try {
            readings = await dexcom.getPublisherReadings(sessionId);
          } catch (e) {
            if (e.name === 'SessionExpiredError') {
              // Session rejected by Dexcom — clear and re-auth next cycle
              db.prepare('UPDATE campers SET cgm_session_id=NULL WHERE id=?').run(camper.id);
            }
            throw e;
          }
        }
        break;
      }
      case 'nightscout': {
        const apiSecret = decrypt(camper.cgm_password_enc);
        readings = await nightscout.getReadings(camper.cgm_url, apiSecret);
        break;
      }
      case 'libre': {
        const password = decrypt(camper.cgm_password_enc);
        readings = await libre.getReadings(camper.cgm_username, password);
        break;
      }
    }

    if (readings.length > 0) {
      insertReadings(camper.id, readings);
      pruneOldReadings(camper.id);
      checkAndCreateAlerts(camper, readings[0]);
    }

    db.prepare('UPDATE campers SET last_sync_at=?, sync_error=NULL WHERE id=?')
      .run(new Date().toISOString(), camper.id);

  } catch (err) {
    db.prepare('UPDATE campers SET last_sync_at=?, sync_error=? WHERE id=?')
      .run(new Date().toISOString(), err.message, camper.id);
  }
}

function insertReadings(camperId, readings) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO glucose_readings (camper_id, value, trend, reading_time) VALUES (?,?,?,?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(camperId, r.value, r.trend, r.readingTime);
  });
  insertMany(readings);
}

function pruneOldReadings(camperId) {
  // Keep last 7 days for weekly trend views
  db.prepare(`
    DELETE FROM glucose_readings
    WHERE camper_id = ? AND reading_time < datetime('now', '-7 days')
  `).run(camperId);
}

function checkAndCreateAlerts(camper, latest) {
  const { value } = latest;
  const { target_low, target_high } = camper;

  let alertType = null;
  if (value < 55) alertType = 'critical_low';
  else if (value < target_low) alertType = 'low';
  else if (value >= 300) alertType = 'critical_high';
  else if (value > target_high) alertType = 'high';

  if (!alertType) {
    // Auto-clear BG alerts when back in range
    db.prepare(`
      UPDATE alerts SET acknowledged_at = datetime('now')
      WHERE camper_id = ? AND acknowledged_at IS NULL
        AND type IN ('low', 'critical_low', 'high', 'critical_high')
    `).run(camper.id);
    return;
  }

  // Avoid duplicate unacknowledged alert of same type within 15 minutes
  const existing = db.prepare(`
    SELECT id FROM alerts
    WHERE camper_id=? AND type=? AND acknowledged_at IS NULL
      AND created_at > datetime('now', '-15 minutes')
  `).get(camper.id, alertType);

  if (!existing) {
    db.prepare('INSERT INTO alerts (camper_id, type, value) VALUES (?,?,?)')
      .run(camper.id, alertType, value);
  }
}

function checkNoDataAlerts() {
  const threshold = new Date(Date.now() - NO_DATA_ALERT_MINUTES * 60 * 1000).toISOString();
  const stale = db.prepare(`
    SELECT id, target_low, target_high FROM campers
    WHERE is_active=1 AND (cgm_username IS NOT NULL OR cgm_url IS NOT NULL)
      AND (last_sync_at IS NULL OR last_sync_at < ?)
  `).all(threshold);

  for (const camper of stale) {
    const existing = db.prepare(`
      SELECT id FROM alerts
      WHERE camper_id=? AND type='no_data' AND acknowledged_at IS NULL
        AND created_at > datetime('now', '-15 minutes')
    `).get(camper.id);
    if (!existing) {
      db.prepare('INSERT INTO alerts (camper_id, type) VALUES (?,?)').run(camper.id, 'no_data');
    }
  }
}

async function runSyncCycle() {
  const campers = db.prepare(`
    SELECT * FROM campers WHERE is_active=1 AND cgm_provider IS NOT NULL AND (cgm_username IS NOT NULL OR cgm_url IS NOT NULL)
  `).all();

  for (let i = 0; i < campers.length; i += BATCH_SIZE) {
    const batch = campers.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(syncCamper));
    if (i + BATCH_SIZE < campers.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  checkNoDataAlerts();
}

function start() {
  console.log('[sync] Starting background sync (60s interval)');
  runSyncCycle(); // immediate first run
  setInterval(runSyncCycle, SYNC_INTERVAL_MS);
}

module.exports = { start, runSyncCycle, syncCamper };
