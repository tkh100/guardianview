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

// GET /api/campers/trends — TIR and stats for all active campers
router.get('/trends', requireAuth, (req, res) => {
  const campers = db.prepare(`
    SELECT c.id, c.name, c.cabin_group, c.delivery_method,
           c.target_low, c.target_high,
           (SELECT value FROM glucose_readings WHERE camper_id=c.id ORDER BY reading_time DESC LIMIT 1) as latest_value,
           (SELECT trend FROM glucose_readings WHERE camper_id=c.id ORDER BY reading_time DESC LIMIT 1) as latest_trend,
           (SELECT reading_time FROM glucose_readings WHERE camper_id=c.id ORDER BY reading_time DESC LIMIT 1) as latest_reading_time,
           ROUND(100.0 * SUM(CASE WHEN r.reading_time >= date('now') AND r.value BETWEEN c.target_low AND c.target_high THEN 1 ELSE 0 END)
             / NULLIF(SUM(CASE WHEN r.reading_time >= date('now') THEN 1 ELSE 0 END), 0), 0) as tir_today,
           ROUND(AVG(CASE WHEN r.reading_time >= date('now') THEN r.value END), 0) as avg_today,
           MAX(CASE WHEN r.reading_time >= date('now') THEN r.value END) as high_today,
           MIN(CASE WHEN r.reading_time >= date('now') THEN r.value END) as low_today,
           ROUND(100.0 * SUM(CASE WHEN r.value BETWEEN c.target_low AND c.target_high THEN 1 ELSE 0 END)
             / NULLIF(COUNT(r.id), 0), 0) as tir_7day
    FROM campers c
    LEFT JOIN glucose_readings r ON r.camper_id = c.id
      AND r.reading_time > datetime('now', '-7 days')
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.cabin_group, c.name
  `).all();
  res.json(campers);
});

// GET /api/campers/:id/readings — historical readings
router.get('/:id/readings', requireAuth, (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 168);
  const readings = db.prepare(`
    SELECT value, trend, reading_time FROM glucose_readings
    WHERE camper_id = ? AND reading_time > datetime('now', ? || ' hours')
    ORDER BY reading_time ASC
  `).all(req.params.id, `-${hours}`);
  res.json(readings);
});

// POST /api/campers — add camper
router.post('/', ...requireRole('admin', 'nurse'), (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO campers (
      name, cabin_group, target_low, target_high, carb_ratio, delivery_method,
      age, allergies, med_breakfast, med_lunch, med_dinner, med_bed, med_emergency,
      a1c, weight, long_acting_type, short_acting_type, cgm_pin, profile_notes,
      home_icr, home_isf, home_target_bg, activity_level,
      reg_recent_illness, reg_open_wounds, reg_scar_tissue, reg_lice,
      reg_meds_received, reg_cgm_supplies_received,
      pump_pin, closed_loop, home_basal_rates, reg_pump_supplies_received,
      pump_site_count, pump_reservoir_count,
      home_long_acting_am, home_long_acting_bed, reg_sensor_count, reg_half_unit_syringes
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    b.name, b.cabin_group || null, b.target_low || 70, b.target_high || 180,
    b.carb_ratio || null, b.delivery_method || 'pump',
    b.age || null, b.allergies || null,
    b.med_breakfast || null, b.med_lunch || null, b.med_dinner || null,
    b.med_bed || null, b.med_emergency || null,
    b.a1c || null, b.weight || null,
    b.long_acting_type || null, b.short_acting_type || null,
    b.cgm_pin || null, b.profile_notes || null,
    b.home_icr || null, b.home_isf || null, b.home_target_bg || 150,
    b.activity_level || 'moderate',
    b.reg_recent_illness || null, b.reg_open_wounds || null,
    b.reg_scar_tissue || null, b.reg_lice || null,
    b.reg_meds_received ? 1 : 0, b.reg_cgm_supplies_received ? 1 : 0,
    b.pump_pin || null, b.closed_loop ? 1 : 0,
    b.home_basal_rates || null, b.reg_pump_supplies_received ? 1 : 0,
    b.pump_site_count || null, b.pump_reservoir_count || null,
    b.home_long_acting_am || null, b.home_long_acting_bed || null,
    b.reg_sensor_count || null, b.reg_half_unit_syringes ? 1 : 0,
  );

  const camper = db.prepare('SELECT * FROM campers WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json(stripCredentials(camper));
});

// PUT /api/campers/:id — update camper info
router.put('/:id', ...requireRole('admin', 'nurse'), (req, res) => {
  const b = req.body;
  db.prepare(`
    UPDATE campers SET
      name=?, cabin_group=?, target_low=?, target_high=?, carb_ratio=?, delivery_method=?,
      age=?, allergies=?, med_breakfast=?, med_lunch=?, med_dinner=?, med_bed=?, med_emergency=?,
      a1c=?, weight=?, long_acting_type=?, short_acting_type=?, cgm_pin=?, profile_notes=?,
      home_icr=?, home_isf=?, home_target_bg=?, activity_level=?,
      reg_recent_illness=?, reg_open_wounds=?, reg_scar_tissue=?, reg_lice=?,
      reg_meds_received=?, reg_cgm_supplies_received=?,
      pump_pin=?, closed_loop=?, home_basal_rates=?, reg_pump_supplies_received=?,
      pump_site_count=?, pump_reservoir_count=?,
      home_long_acting_am=?, home_long_acting_bed=?, reg_sensor_count=?, reg_half_unit_syringes=?
    WHERE id=?
  `).run(
    b.name, b.cabin_group || null, b.target_low || 70, b.target_high || 180,
    b.carb_ratio || null, b.delivery_method || 'pump',
    b.age || null, b.allergies || null,
    b.med_breakfast || null, b.med_lunch || null, b.med_dinner || null,
    b.med_bed || null, b.med_emergency || null,
    b.a1c || null, b.weight || null,
    b.long_acting_type || null, b.short_acting_type || null,
    b.cgm_pin || null, b.profile_notes || null,
    b.home_icr || null, b.home_isf || null, b.home_target_bg || 150,
    b.activity_level || 'moderate',
    b.reg_recent_illness || null, b.reg_open_wounds || null,
    b.reg_scar_tissue || null, b.reg_lice || null,
    b.reg_meds_received ? 1 : 0, b.reg_cgm_supplies_received ? 1 : 0,
    b.pump_pin || null, b.closed_loop ? 1 : 0,
    b.home_basal_rates || null, b.reg_pump_supplies_received ? 1 : 0,
    b.pump_site_count || null, b.pump_reservoir_count || null,
    b.home_long_acting_am || null, b.home_long_acting_bed || null,
    b.reg_sensor_count || null, b.reg_half_unit_syringes ? 1 : 0,
    req.params.id,
  );

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
