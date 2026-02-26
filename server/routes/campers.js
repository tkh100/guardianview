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

  try {
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
  } catch (err) {
    console.error('[POST /campers]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/campers/:id — update camper info
router.put('/:id', ...requireRole('admin', 'nurse'), (req, res) => {
  const existing = db.prepare('SELECT * FROM campers WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Camper not found' });
  const b = { ...existing, ...req.body };
  try {
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
    res.json(stripCredentials(camper));
  } catch (err) {
    console.error('[PUT /campers/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
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

// ─── CSV helpers ────────────────────────────────────────────────────────────

function csvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return (str.includes(',') || str.includes('"') || str.includes('\n'))
    ? '"' + str.replace(/"/g, '""') + '"'
    : str;
}
function csvRow(cells) { return cells.map(csvCell).join(','); }

// Camp timezone offset in hours from UTC (e.g. -5 for EST, -4 for EDT).
// Set via TZ_OFFSET_HOURS env var or default to -5 (EST).
const CAMP_TZ_OFFSET = parseInt(process.env.TZ_OFFSET_HOURS ?? '-5', 10);

function getHour(isoStr) {
  const s = isoStr.replace(' ', 'T');
  const utcMs = new Date(s.includes('Z') ? s : s + 'Z').getTime();
  // Shift into camp local time before extracting the hour
  return new Date(utcMs + CAMP_TZ_OFFSET * 3_600_000).getUTCHours();
}

// Return the UTC ISO strings that bracket a single local calendar day.
// e.g. '2025-05-25' in EST (offset -5) → start '2025-05-25T05:00:00Z', end '2025-05-26T05:00:00Z'
function localDayUtcRange(localDateStr) {
  const midnightUtcMs = new Date(localDateStr + 'T00:00:00Z').getTime()
    - CAMP_TZ_OFFSET * 3_600_000;  // subtract offset: for -5 this adds 5 hrs
  const start = new Date(midnightUtcMs).toISOString().replace('T', ' ').slice(0, 19);
  const end   = new Date(midnightUtcMs + 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
  return { start, end };
}

// Map each data column index (0-based, 25 wide) to the hour(s) it covers
const COL_TO_HOURS = {
  2: [0], 3: [1], 4: [2],
  5: [3,4,5,6],              // Overnight
  8: [7], 9: [8], 10: [9], 11: [10], 12: [11],
  13: [12], 14: [13], 15: [14], 16: [15], 17: [16],
  18: [17], 19: [18], 20: [19], 21: [20], 22: [21], 23: [22], 24: [23],
};
const HOUR_TO_COL = {};
for (const [col, hrs] of Object.entries(COL_TO_HOURS)) {
  for (const h of hrs) HOUR_TO_COL[h] = parseInt(col, 10);
}

function buildColData(events, readings) {
  const init = () => ({ bg: [], ketones: [], carbs: [], calcDose: [], doseGiven: [], siteChange: false, longActing: false, prebolus: false, notes: [] });
  const map = {};
  for (const col of Object.keys(COL_TO_HOURS)) map[col] = init();

  readings.forEach(r => {
    const col = HOUR_TO_COL[getHour(r.reading_time)];
    if (col != null && map[col]) map[col].bg.push({ val: r.value, cgm: true });
  });
  events.forEach(ev => {
    const col = HOUR_TO_COL[getHour(ev.created_at)];
    if (col == null || !map[col]) return;
    const c = map[col];
    if (ev.bg_manual != null)   c.bg.push({ val: ev.bg_manual, cgm: false });
    if (ev.ketones != null)     c.ketones.push(ev.ketones);
    if (ev.carbs_g != null)     c.carbs.push(ev.carbs_g);
    if (ev.calc_dose != null)   c.calcDose.push(ev.calc_dose);
    if (ev.dose_given != null)  c.doseGiven.push(ev.dose_given);
    if (ev.site_change)         c.siteChange = true;
    if (ev.long_acting_given)   c.longActing = true;
    if (ev.prebolus)            c.prebolus = true;
    if (ev.note)                c.notes.push(ev.note);
  });
  return map;
}

function fmtBG(bgArr) {
  if (!bgArr.length) return '';
  const manual = bgArr.filter(b => !b.cgm);
  const cgm    = bgArr.filter(b => b.cgm);
  const parts  = [];
  // All fingerstick readings, each labeled
  if (manual.length) parts.push(...manual.map(b => `FS:${b.val}`));
  // Average of CGM readings for the slot (readings every 5 min → up to 12/hr)
  if (cgm.length) {
    const avg = Math.round(cgm.reduce((s, b) => s + b.val, 0) / cgm.length);
    parts.push(`CGM:${avg}`);
  }
  return parts.join(' / ');
}
function fmtNums(arr) {
  if (!arr.length) return '';
  return arr.map(v => Number.isInteger(v) ? v : parseFloat(v.toFixed(1))).join('/');
}

function dataRow(label, colData, field, N = 25) {
  const cells = new Array(N).fill('');
  cells[0] = label;
  for (const [col, data] of Object.entries(colData)) {
    const c = parseInt(col, 10);
    let v = '';
    switch (field) {
      case 'bg':         v = fmtBG(data.bg); break;
      case 'ketones':    v = fmtNums(data.ketones); break;
      case 'carbs':      v = fmtNums(data.carbs); break;
      case 'calcDose':   v = fmtNums(data.calcDose); break;
      case 'doseGiven':  v = fmtNums(data.doseGiven); break;
      case 'site':       v = data.siteChange ? 'Y' : ''; break;
      case 'longActing': v = data.longActing ? 'Y' : ''; break;
      case 'prebolus':   v = data.prebolus ? 'Y' : ''; break;
      case 'notes':      v = data.notes.join('; '); break;
    }
    cells[c] = v;
  }
  return cells;
}

// Directly pull a single field from a day's events/readings for a specific hour
function hourVal(events, readings, hour, field) {
  if (field === 'bg') {
    const manual = events.filter(e => e.bg_manual != null && getHour(e.created_at) === hour);
    const cgm    = readings.filter(r => getHour(r.reading_time) === hour);
    const parts  = [];
    if (manual.length) parts.push(...manual.map(e => `FS:${e.bg_manual}`));
    if (cgm.length) {
      const avg = Math.round(cgm.reduce((s, r) => s + r.value, 0) / cgm.length);
      parts.push(`CGM:${avg}`);
    }
    return parts.join(' / ');
  }
  const evs = events.filter(e => getHour(e.created_at) === hour);
  switch (field) {
    case 'ketones':    return fmtNums(evs.flatMap(e => e.ketones != null ? [e.ketones] : []));
    case 'carbs':      return fmtNums(evs.flatMap(e => e.carbs_g != null ? [e.carbs_g] : []));
    case 'calcDose':   return fmtNums(evs.flatMap(e => e.calc_dose != null ? [e.calc_dose] : []));
    case 'doseGiven':  return fmtNums(evs.flatMap(e => e.dose_given != null ? [e.dose_given] : []));
    case 'site':       return evs.some(e => e.site_change) ? 'Y' : '';
    case 'longActing': return evs.some(e => e.long_acting_given) ? 'Y' : '';
    case 'prebolus':   return evs.some(e => e.prebolus) ? 'Y' : '';
    default: return '';
  }
}

// GET /api/campers/:id/export-flowsheet.csv?week_start=YYYY-MM-DD
router.get('/:id/export-flowsheet.csv', ...requireRole('admin', 'nurse'), (req, res) => {
  try {
    const camperId = req.params.id;
    const camper = db.prepare('SELECT * FROM campers WHERE id=? AND is_active=1').get(camperId);
    if (!camper) return res.status(404).json({ error: 'Camper not found' });

    let weekStart = req.query.week_start;
    if (!weekStart) {
      const today = new Date();
      const day = today.getDay();
      const diffToSat = day >= 6 ? 0 : day + 1;
      today.setDate(today.getDate() - diffToSat);
      weekStart = today.toISOString().slice(0, 10);
    }

    const isPump = camper.delivery_method === 'pump';
    const N = 25;
    const empty = () => new Array(N).fill('');

    // Fetch 8 days: arrival Saturday (index 0) + Sun–Sat (indices 1–7)
    const days = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(weekStart + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const { start, end } = localDayUtcRange(dateStr);

      const events = db.prepare(`
        SELECT created_at, bg_manual, ketones, carbs_g, calc_dose, dose_given,
               site_change, long_acting_given, prebolus, note
        FROM camper_events WHERE camper_id=? AND created_at >= ? AND created_at < ?
        ORDER BY created_at ASC
      `).all(camperId, start, end);

      const readings = db.prepare(`
        SELECT reading_time, value FROM glucose_readings
        WHERE camper_id=? AND reading_time >= ? AND reading_time < ?
        ORDER BY reading_time ASC
      `).all(camperId, start, end);

      const settings = db.prepare(
        'SELECT * FROM daily_settings WHERE camper_id=? AND setting_date=?'
      ).get(camperId, dateStr) || null;

      days.push({ date: dateStr, dayIndex: i, events, readings, settings, colData: buildColData(events, readings) });
    }

    const rows = [];
    const sat = days[0]; // arrival Saturday

    // ── Row 1: title ────────────────────────────────────────────────────────
    const r0 = empty(); r0[1] = isPump ? 'Pump Flowsheet' : 'Injection Flowsheet';
    rows.push(r0);

    // ── Row 2: Name / Age / Group / Allergies ───────────────────────────────
    const r1 = empty();
    r1[0] = 'Name:'; r1[1] = camper.name;
    r1[9] = 'Age:';  r1[10] = camper.age ?? '';
    r1[13] = 'Group:'; r1[14] = camper.cabin_group ?? '';
    r1[19] = 'Allergies:'; r1[20] = camper.allergies ?? '';
    rows.push(r1);

    // ── Row 3: Medications ──────────────────────────────────────────────────
    const r2 = empty();
    r2[0] = 'Medications:';
    r2[2] = 'Breakfast'; r2[3] = camper.med_breakfast ?? '';
    r2[6] = 'Lunch';     r2[7] = camper.med_lunch ?? '';
    r2[10] = 'Dinner';   r2[11] = camper.med_dinner ?? '';
    r2[13] = 'Bed';      r2[14] = camper.med_bed ?? '';
    r2[16] = 'Emergency';r2[17] = camper.med_emergency ?? '';
    rows.push(r2);

    // ── Row 4: A1c / Weight / Closed loop ───────────────────────────────────
    const r3 = empty();
    if (isPump) {
      r3[0] = 'Closed loop?';
      r3[3] = 'Yes'; r3[4] = camper.closed_loop ? 'X' : '';
      r3[6] = 'No';  r3[7] = !camper.closed_loop ? 'X' : '';
      r3[9] = 'A1c:'; r3[10] = camper.a1c ?? '';
      r3[13] = 'Weight:'; r3[14] = camper.weight ?? '';
    } else {
      r3[0] = 'A1c:'; r3[1] = camper.a1c ?? '';
      r3[5] = 'Weight:'; r3[6] = camper.weight ?? '';
    }
    rows.push(r3);

    rows.push(empty()); // blank

    // ── Saturday mini-grid (arrival day, 1P–11P only) ───────────────────────
    // PM hours 13–23 → display cols 14–24
    const PM_COLS  = [14,15,16,17,18,19,20,21,22,23,24];
    const PM_HOURS = [13,14,15,16,17,18,19,20,21,22,23];
    const PM_HDRS  = ['1P','2P','3P','4P','5P','6P','7P','8P','9P','10P','11P'];

    const satHdr = empty();
    satHdr[0] = 'Long acting:'; satHdr[1] = camper.long_acting_type ?? '';
    satHdr[6] = 'Saturday'; satHdr[10] = 'Registration';
    PM_HDRS.forEach((h, i) => { satHdr[PM_COLS[i]] = h; });
    rows.push(satHdr);

    const FIELDS = [
      ['Short acting:', camper.short_acting_type ?? '',  'Blood Glucose', 'bg'],
      ['',              '',                               'Ketones',        'ketones'],
      ['CGM Pin:',      camper.cgm_pin ?? '',             'Carbohydrates',  'carbs'],
      [isPump ? 'Pump Pin:' : 'Notes:', isPump ? (camper.pump_pin ?? '') : (camper.profile_notes ?? ''), 'Calculated dose', 'calcDose'],
      [isPump ? 'Notes:' : '', isPump ? (camper.profile_notes ?? '') : '', 'Dose given', 'doseGiven'],
      ['N= Nabs', 'T=Tabs', isPump ? 'Site change' : 'Long acting given', isPump ? 'site' : 'longActing'],
    ];

    FIELDS.forEach(([lbl0, val0, lbl6, field]) => {
      const row = empty();
      row[0] = lbl0; row[1] = val0; row[6] = lbl6;
      PM_COLS.forEach((col, i) => { row[col] = hourVal(sat.events, sat.readings, PM_HOURS[i], field); });
      rows.push(row);
    });

    rows.push(empty()); // blank

    // ── Daily grids: Sun (days[1]) → Sat departure (days[7]) ────────────────
    const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const INJECTION_ROWS = [
      ['Blood Glucose','bg'], ['Ketones','ketones'], ['Carbohydrates','carbs'],
      ['Calculated dose','calcDose'], ['Dose given','doseGiven'],
      ['Site change','site'], ['Long acting given','longActing'], ['Extra notes','notes'],
    ];
    const PUMP_ROWS = [
      ['Blood Glucose','bg'], ['Ketones','ketones'], ['Carbohydrates','carbs'],
      ['Calculated dose','calcDose'], ['Dose given','doseGiven'],
      ['Site change','site'], ['Prebolus given?','prebolus'], ['Extra notes','notes'],
    ];
    const DATA_ROWS = isPump ? PUMP_ROWS : INJECTION_ROWS;

    for (let di = 1; di <= 7; di++) {
      const dayObj = days[di];
      if (!dayObj) continue;
      const isDep = di === 7; // departure Saturday
      const d2 = new Date(dayObj.date + 'T12:00:00');
      const dName = DAY_NAMES[d2.getDay()];

      // Column header row
      const hdr = empty();
      hdr[0] = dName;
      hdr[2] = '12A'; hdr[3] = '1A'; hdr[4] = '2A'; hdr[5] = 'Overnight';
      hdr[8] = '7A';  hdr[9] = '8A'; hdr[10] = '9A'; hdr[11] = '10A'; hdr[12] = '11A';
      hdr[13] = '12P'; hdr[14] = '1P'; hdr[15] = '2P'; hdr[16] = '3P'; hdr[17] = '4P';
      hdr[18] = '5P';  hdr[19] = '6P'; hdr[20] = '7P'; hdr[21] = '8P'; hdr[22] = '9P';
      hdr[23] = isDep ? '10A' : '10P';
      hdr[24] = isDep ? 'Other' : '11P';
      rows.push(hdr);

      for (const [label, field] of DATA_ROWS) {
        rows.push(dataRow(label, dayObj.colData, field, N));
      }
      rows.push(empty());
    }

    // ── Footer (mirrors paper form corner labels) ────────────────────────────
    const ftr1 = empty(); ftr1[15] = 'Notes:'; rows.push(ftr1);
    const ftr2 = empty();
    ftr2[0] = 'N= Nabs'; ftr2[1] = 'T=Tabs'; ftr2[3] = 'M=Milk';
    rows.push(ftr2);
    const ftr3 = empty(); ftr3[15] = 'Name:'; ftr3[16] = camper.name; rows.push(ftr3);
    const ftr4 = empty(); ftr4[15] = 'Group:'; ftr4[16] = camper.cabin_group ?? ''; rows.push(ftr4);

    const csv = rows.map(r => csvRow(r)).join('\r\n');
    const safe = (camper.name || 'camper').replace(/[^a-z0-9]/gi, '_');
    const filename = `${safe}_${isPump ? 'pump' : 'injection'}_flowsheet_${weekStart}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('[export-flowsheet.csv]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campers/:id/print-flowsheet?week_start=YYYY-MM-DD
// Returns full weekly flowsheet data for printing (admin/nurse only)
router.get('/:id/print-flowsheet', ...requireRole('admin', 'nurse'), (req, res) => {
  try {
    const camperId = req.params.id;
    const camper = db.prepare('SELECT * FROM campers WHERE id=? AND is_active=1').get(camperId);
    if (!camper) return res.status(404).json({ error: 'Camper not found' });

    // Default week_start to most recent Saturday
    let weekStart = req.query.week_start;
    if (!weekStart) {
      const today = new Date();
      const day = today.getDay(); // 0=Sun, 6=Sat
      const diffToSat = (day >= 6) ? 0 : day + 1;
      today.setDate(today.getDate() - diffToSat);
      weekStart = today.toISOString().slice(0, 10);
    }

    // Build 8 days: arrival Saturday + Sun-Sat week
    const days = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(weekStart + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const { start, end } = localDayUtcRange(dateStr);

      const settings = db.prepare(
        'SELECT * FROM daily_settings WHERE camper_id=? AND setting_date=?'
      ).get(camperId, dateStr) || null;

      const events = db.prepare(`
        SELECT created_at, bg_manual, ketones, carbs_g, calc_dose, dose_given,
               site_change, long_acting_given, prebolus, note
        FROM camper_events
        WHERE camper_id=? AND created_at >= ? AND created_at < ?
        ORDER BY created_at ASC
      `).all(camperId, start, end);

      const readings = db.prepare(`
        SELECT reading_time, value, trend
        FROM glucose_readings
        WHERE camper_id=? AND reading_time >= ? AND reading_time < ?
        ORDER BY reading_time ASC
      `).all(camperId, start, end);

      days.push({ date: dateStr, dayIndex: i, events, readings, settings });
    }

    res.json({ camper: stripCredentials(camper), weekStart, days });
  } catch (err) {
    console.error('[GET /campers/:id/print-flowsheet]', err.message);
    res.status(500).json({ error: err.message });
  }
});

function stripCredentials(c) {
  if (!c) return c;
  const { cgm_password_enc, cgm_session_id, ...safe } = c;
  safe.cgm_connected = !!(c.cgm_username || c.cgm_url);
  return safe;
}

module.exports = router;
