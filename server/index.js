require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const db = require('./db');

// Fail fast on missing/insecure required secrets rather than silently running
// with a guessable default. This handles PHI for minors — a weak/placeholder
// admin password or missing JWT secret is not something to discover later.
function validateEnv() {
  const problems = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET is missing or too short (needs 32+ characters). Generate one with: openssl rand -hex 32');
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword === 'changeme' || adminPassword.length < 8) {
    problems.push('ADMIN_PASSWORD is missing, still the "changeme" placeholder, or shorter than 8 characters. Set a real password.');
  }

  if (process.env.ENCRYPTION_KEY) {
    const key = process.env.ENCRYPTION_KEY;
    if (key.length < 64 || !/^[0-9a-fA-F]+$/.test(key.slice(0, 64))) {
      problems.push('ENCRYPTION_KEY must be a 64-character hex string. Generate one with: openssl rand -hex 32');
    }
  } else {
    problems.push('ENCRYPTION_KEY is missing. Generate one with: openssl rand -hex 32');
  }

  if (problems.length) {
    console.error('[startup] Refusing to start — fix these environment variables:\n' + problems.map(p => `  - ${p}`).join('\n'));
    process.exit(1);
  }
}

validateEnv();

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS for development
if (process.env.NODE_ENV !== 'production') {
  const cors = require('cors');
  app.use(cors({ origin: 'http://localhost:5173' }));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/campers', require('./routes/campers'));
app.use('/api/campers/:id/events', require('./routes/events'));
app.use('/api/campers/:id/daily-settings', require('./routes/dailySettings'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/sync', require('./routes/syncStatus'));
app.use('/api/flowsheet', require('./routes/flowsheet'));
app.use('/api/ai', require('./routes/ai'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// Seed admin user if none exists
function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) as n FROM app_users').get().n;
  if (count === 0) {
    // validateEnv() already guarantees ADMIN_PASSWORD is set and isn't the placeholder
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    db.prepare("INSERT INTO app_users (username, password_hash, role) VALUES ('admin', ?, 'admin')")
      .run(hash);
    console.log('[init] Created admin user. Username: admin');
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  seedAdmin();
  console.log(`[server] GuardianView running on port ${PORT}`);

  // Start background sync
  require('./sync').start();

  // Start Google Sheets sync (no-op if env vars not set)
  require('./sheetsSync').startSheetsSync(db);
});
