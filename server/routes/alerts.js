const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/alerts — all unacknowledged alerts with camper info
router.get('/', requireAuth, (req, res) => {
  const alerts = db.prepare(`
    SELECT a.*, c.name as camper_name, c.cabin_group
    FROM alerts a
    JOIN campers c ON c.id = a.camper_id
    WHERE a.acknowledged_at IS NULL
    ORDER BY
      CASE a.type
        WHEN 'critical_low' THEN 1
        WHEN 'critical_high' THEN 2
        WHEN 'low' THEN 3
        WHEN 'high' THEN 4
        WHEN 'no_data' THEN 5
      END,
      a.created_at DESC
  `).all();
  res.json(alerts);
});

// POST /api/alerts/:id/acknowledge
router.post('/:id/acknowledge', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE alerts SET acknowledged_by=?, acknowledged_at=datetime('now') WHERE id=?
  `).run(req.user.id, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
