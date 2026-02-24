require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
app.use(express.json());

// CORS for development
if (process.env.NODE_ENV !== 'production') {
  const cors = require('cors');
  app.use(cors({ origin: 'http://localhost:5173' }));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/campers', require('./routes/campers'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/sync', require('./routes/syncStatus'));

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
    const password = process.env.ADMIN_PASSWORD || 'changeme';
    const hash = bcrypt.hashSync(password, 10);
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
});
