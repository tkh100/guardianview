const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../auth');

// GET /api/flowsheet?date=YYYY-MM-DD
// Returns all active campers with their glucose readings and treatment events for the given day.
router.get('/', ...requireRole('admin', 'nurse'), (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [y, m, d] = date.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

    const campers = db.prepare(
      `SELECT id, name, cabin_group, target_low, target_high, delivery_method
       FROM campers WHERE is_active=1 ORDER BY cabin_group, name`
    ).all();

    const readingsStmt = db.prepare(
      `SELECT reading_time, value, trend
       FROM glucose_readings
       WHERE camper_id=? AND reading_time >= ? AND reading_time < ?
       ORDER BY reading_time`
    );

    const eventsStmt = db.prepare(
      `SELECT created_at, carbs_g, dose_given, long_acting_given, bg_manual, meal_type, note, site_change
       FROM camper_events
       WHERE camper_id=? AND created_at >= ? AND created_at < ?
       ORDER BY created_at`
    );

    const result = campers.map(c => ({
      ...c,
      readings: readingsStmt.all(c.id, date, nextDay),
      events: eventsStmt.all(c.id, date, nextDay),
    }));

    res.json(result);
  } catch (err) {
    console.error('[GET /flowsheet]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
