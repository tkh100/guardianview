const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM app_users WHERE username=?').get(username.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  // Admins and nurses always have medical access
  const medAccess = (user.role === 'admin' || user.role === 'nurse') ? true : !!user.medical_access;

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, cabin_group: user.cabin_group, medical_access: medAccess },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, cabin_group: user.cabin_group, medical_access: medAccess } });
});

module.exports = router;
