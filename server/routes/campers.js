const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { encrypt, decrypt } = require('../crypto');
const dexcom = require('../providers/dexcom');
const nightscout = require('../providers/nightscout');
const libre = require('../providers/libre');
const { syncCamper } = require('../sync');

const router = express.Router();

// GET /api/campers — list all active campers with latest reading
router.get('/', requireAuth, (req, res) => {
  const { role, cabin_group } = req.user;
  let query = `
    SELECT c.*,
      r.value as latest_value,
      r.trend as latest_trend,
      r.reading_time as latest_reading_time
    FROM campers c
    LEFT JOIN glucose_readings r ON r.id = (
      SELECT id FROM glucose_readings
      WHERE camper_id = c.id
      ORDER BY reading_time DESC LIMIT 1
    )
    WHERE c.is_active = 1
  `;
  const params = [];

  // Counselors default to their cabin group (frontend handles "show all" toggle)
  if (role === 'counselor' && cabin_group && req.query.group !== 'all') {
    query += ' AND c.cabin_group = ?';
    params.push(cabin_group);
  }

  query += ' ORDER BY c.cabin_group, c.name';

  const campers = db.prepare(query).all(...params).map(stripCredentials);
  res.json(campers);
});

// GET /api/campers/:id/readings — historical readings
router.get('/:id/readings', requireAuth, (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 24);
  const readings = db.prepare(`
    SELECT value, trend, reading_time FROM glucose_readings
    WHERE camper_id = ? AND reading_time > datetime('now', ? || ' hours')
    ORDER BY reading_time ASC
  `).all(req.params.id, `-${hours}`);
  res.json(readings);
});

// POST /api/campers — add camper
router.post('/', ...requireRole('admin', 'nurse'), (req, res) => {
  const { name, cabin_group, target_low, target_high } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO campers (name, cabin_group, target_low, target_high)
    VALUES (?, ?, ?, ?)
  `).run(name, cabin_group || null, target_low || 70, target_high || 180);

  const camper = db.prepare('SELECT * FROM campers WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json(stripCredentials(camper));
});

// PUT /api/campers/:id — update camper info
router.put('/:id', ...requireRole('admin', 'nurse'), (req, res) => {
  const { name, cabin_group, target_low, target_high, carb_ratio } = req.body;
  db.prepare(`
    UPDATE campers SET name=?, cabin_group=?, target_low=?, target_high=?, carb_ratio=? WHERE id=?
  `).run(name, cabin_group || null, target_low || 70, target_high || 180, carb_ratio || null, req.params.id);

  const camper = db.prepare('SELECT * FROM campers WHERE id=?').get(req.params.id);
  if (!camper) return res.status(404).json({ error: 'Camper not found' });
  res.json(stripCredentials(camper));
});

// DELETE /api/campers/:id — deactivate (soft delete)
router.delete('/:id', ...requireRole('admin', 'nurse'), (req, res) => {
  db.prepare('UPDATE campers SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/campers/:id/connect — save CGM credentials and test
router.post('/:id/connect', ...requireRole('admin', 'nurse'), async (req, res) => {
  const { cgm_provider, cgm_auth_mode, cgm_username, cgm_password, cgm_url } = req.body;
  const id = req.params.id;

  try {
    // Test connection before saving; capture session where possible to avoid re-auth on first sync
    let sessionId = null;
    switch (cgm_provider) {
      case 'dexcom':
        if (cgm_auth_mode === 'follower') {
          // Follower uses camp credentials from env — just verify env is set
          if (!process.env.DEXCOM_FOLLOWER_USERNAME) {
            return res.status(400).json({ error: 'Follower credentials not configured on server. Add DEXCOM_FOLLOWER_USERNAME and DEXCOM_FOLLOWER_PASSWORD to env.' });
          }
        } else {
          // Save the session so the sync engine doesn't need to login again
          sessionId = await dexcom.loginPublisher(cgm_username, cgm_password);
        }
        break;
      case 'nightscout':
        await nightscout.testConnection(cgm_url, cgm_password);
        break;
      case 'libre':
        await libre.testConnection(cgm_username, cgm_password);
        break;
      default:
        return res.status(400).json({ error: 'Unknown CGM provider' });
    }

    // Save credentials and the session ID captured above
    const enc = cgm_auth_mode === 'follower' ? null : encrypt(cgm_password);
    db.prepare(`
      UPDATE campers SET
        cgm_provider=?, cgm_auth_mode=?, cgm_username=?,
        cgm_password_enc=?, cgm_url=?, cgm_session_id=?, sync_error=NULL
      WHERE id=?
    `).run(cgm_provider, cgm_auth_mode || 'publisher', cgm_username || null, enc, cgm_url || null, sessionId, id);

    res.json({ ok: true, message: 'Connection verified and saved' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/campers/:id/sync — manual sync
router.post('/:id/sync', requireAuth, async (req, res) => {
  const camper = db.prepare('SELECT * FROM campers WHERE id=?').get(req.params.id);
  if (!camper) return res.status(404).json({ error: 'Camper not found' });
  if (!camper.cgm_provider) return res.status(400).json({ error: 'No CGM connected' });

  await syncCamper(camper);

  const updated = db.prepare('SELECT * FROM campers WHERE id=?').get(camper.id);
  res.json({ ok: !updated.sync_error, error: updated.sync_error || null });
});

function stripCredentials(c) {
  if (!c) return c;
  const { cgm_password_enc, cgm_session_id, ...safe } = c;
  safe.cgm_connected = !!(c.cgm_username || c.cgm_url);
  return safe;
}

module.exports = router;
