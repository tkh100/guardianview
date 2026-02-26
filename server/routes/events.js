const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router({ mergeParams: true });

// GET /api/campers/:id/events?hours=24
router.get('/', requireAuth, (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 168);
  const events = db.prepare(`
    SELECT e.*, u.username as created_by_username
    FROM camper_events e
    LEFT JOIN app_users u ON u.id = e.created_by
    WHERE e.camper_id = ? AND e.created_at > datetime('now', ? || ' hours')
    ORDER BY e.created_at DESC
  `).all(req.params.id, `-${hours}`);
  res.json(events);
});

// POST /api/campers/:id/events
router.post('/', requireAuth, (req, res) => {
  const {
    carbs_g, insulin_units, note,
    bg_manual, ketones, calc_dose, dose_given,
    site_change, prebolus, long_acting_given,
    meal_type, med_slot, event_time,
  } = req.body;

  const hasData = carbs_g || insulin_units || calc_dose || dose_given ||
    bg_manual || ketones || note || site_change || prebolus ||
    long_acting_given || meal_type || med_slot;
  if (!hasData) {
    return res.status(400).json({ error: 'At least one field required' });
  }

  // Validate and resolve optional retroactive timestamp
  let created_at = null;
  if (event_time) {
    const d = new Date(event_time);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid event_time' });
    if (d.getTime() > Date.now() + 5 * 60 * 1000) {
      return res.status(400).json({ error: 'event_time cannot be in the future' });
    }
    created_at = d.toISOString();
  }

  // Write dose_given to both dose_given and insulin_units for backward compat
  const effectiveInsulin = dose_given ? parseFloat(dose_given) : (insulin_units ? parseFloat(insulin_units) : null);

  const result = db.prepare(`
    INSERT INTO camper_events (
      camper_id, carbs_g, insulin_units, note, created_by,
      bg_manual, ketones, calc_dose, dose_given,
      site_change, prebolus, long_acting_given,
      meal_type, med_slot, created_at, logged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
  `).run(
    req.params.id,
    carbs_g ? parseInt(carbs_g) : null,
    effectiveInsulin,
    note || null,
    req.user.id,
    bg_manual ? parseInt(bg_manual) : null,
    ketones ? parseFloat(ketones) : null,
    calc_dose ? parseFloat(calc_dose) : null,
    dose_given ? parseFloat(dose_given) : null,
    site_change ? 1 : 0,
    prebolus ? 1 : 0,
    long_acting_given ? 1 : 0,
    meal_type || null,
    med_slot || null,
    created_at,
  );

  const event = db.prepare(`
    SELECT e.*, u.username as created_by_username
    FROM camper_events e
    LEFT JOIN app_users u ON u.id = e.created_by
    WHERE e.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(event);
});

// DELETE /api/campers/:id/events/:eventId
router.delete('/:eventId', ...requireRole('admin', 'nurse'), (req, res) => {
  db.prepare('DELETE FROM camper_events WHERE id = ? AND camper_id = ?')
    .run(req.params.eventId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
