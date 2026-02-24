const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { runSyncCycle } = require('../sync');

const router = express.Router();

// GET /api/sync/status
router.get('/status', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM campers WHERE is_active=1').get().n;
  const connected = db.prepare('SELECT COUNT(*) as n FROM campers WHERE is_active=1 AND cgm_username IS NOT NULL').get().n;
  const errors = db.prepare('SELECT COUNT(*) as n FROM campers WHERE is_active=1 AND sync_error IS NOT NULL').get().n;
  const lastSync = db.prepare('SELECT MAX(last_sync_at) as t FROM campers WHERE is_active=1').get().t;

  res.json({ total, connected, errors, lastSync });
});

// POST /api/sync/run — manual full sync (admin only)
router.post('/run', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  runSyncCycle().catch(console.error);
  res.json({ ok: true, message: 'Sync started in background' });
});

module.exports = router;
