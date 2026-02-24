const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// GET /api/users — list all staff (admin only)
router.get('/', ...requireRole('admin'), (req, res) => {
  const users = db.prepare(
    'SELECT id, username, role, cabin_group, medical_access, created_at FROM app_users ORDER BY role, username'
  ).all();
  res.json(users);
});

// POST /api/users — create staff account (admin only)
router.post('/', ...requireRole('admin'), async (req, res) => {
  const { username, password, role, cabin_group } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (!['admin', 'nurse', 'counselor'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const existing = db.prepare('SELECT id FROM app_users WHERE username=?').get(username);
  if (existing) return res.status(400).json({ error: 'Username already taken' });

  const hash = await bcrypt.hash(password, 10);
  // Admins and nurses always have medical access
  const medAccess = (role === 'admin' || role === 'nurse') ? 1 : (req.body.medical_access ? 1 : 0);
  const result = db.prepare(
    'INSERT INTO app_users (username, password_hash, role, cabin_group, medical_access) VALUES (?,?,?,?,?)'
  ).run(username, hash, role, cabin_group || null, medAccess);

  const user = db.prepare('SELECT id, username, role, cabin_group, medical_access, created_at FROM app_users WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/users/:id/password — reset password (admin only)
router.put('/:id/password', ...requireRole('admin'), async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE app_users SET password_hash=? WHERE id=?').run(hash, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/users/:id — remove staff account (admin only, can't delete self)
router.delete('/:id', ...requireRole('admin'), (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: "Can't delete your own account" });
  }
  db.prepare('DELETE FROM app_users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
