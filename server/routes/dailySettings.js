const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router({ mergeParams: true });

// GET /api/campers/:id/daily-settings
router.get('/', requireAuth, (req, res) => {
  const { date } = req.query;
  if (date) {
    const row = db.prepare(
      'SELECT * FROM daily_settings WHERE camper_id=? AND setting_date=?'
    ).get(req.params.id, date);
    return res.json(row || null);
  }
  const rows = db.prepare(
    'SELECT * FROM daily_settings WHERE camper_id=? ORDER BY setting_date DESC'
  ).all(req.params.id);
  res.json(rows);
});

// GET /api/campers/:id/daily-settings/current — today or most recent
router.get('/current', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(
    'SELECT * FROM daily_settings WHERE camper_id=? AND setting_date<=? ORDER BY setting_date DESC LIMIT 1'
  ).get(req.params.id, today);
  res.json(row || null);
});

// PUT /api/campers/:id/daily-settings/:date — upsert
router.put('/:date', ...requireRole('admin', 'nurse'), (req, res) => {
  const { icr, isf, target_bg, closed_loop, long_acting_am, long_acting_bed } = req.body;
  const camperId = req.params.id;
  const date = req.params.date;

  db.prepare(`
    INSERT INTO daily_settings (camper_id, setting_date, icr, isf, target_bg, closed_loop, long_acting_am, long_acting_bed, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(camper_id, setting_date) DO UPDATE SET
      icr=excluded.icr, isf=excluded.isf, target_bg=excluded.target_bg,
      closed_loop=excluded.closed_loop, long_acting_am=excluded.long_acting_am,
      long_acting_bed=excluded.long_acting_bed, created_by=excluded.created_by
  `).run(
    camperId, date,
    icr || null, isf || null, target_bg || null,
    closed_loop != null ? (closed_loop ? 1 : 0) : null,
    long_acting_am || null, long_acting_bed || null,
    req.user.id,
  );

  const row = db.prepare(
    'SELECT * FROM daily_settings WHERE camper_id=? AND setting_date=?'
  ).get(camperId, date);
  res.json(row);
});

module.exports = router;
