const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router({ mergeParams: true });

// GET /api/campers/:id/events?hours=24
router.get('/', requireAuth, (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 72);
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
  const { carbs_g, insulin_units, note } = req.body;

  if (!carbs_g && !insulin_units && !note) {
    return res.status(400).json({ error: 'At least one field required' });
  }

  const result = db.prepare(`
    INSERT INTO camper_events (camper_id, carbs_g, insulin_units, note, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    carbs_g ? parseInt(carbs_g) : null,
    insulin_units ? parseFloat(insulin_units) : null,
    note || null,
    req.user.id,
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
