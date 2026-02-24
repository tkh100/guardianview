# GuardianView

**Open-source CGM monitoring dashboard for T1D diabetes camps.**

Monitor glucose readings for up to 300 campers in real time — built for volunteer-run camps at zero cost. Supports Dexcom (Share API), LibreLink, and Nightscout.

---

## Features

- Real-time glucose grid — color-coded by status (in range / low / high / critical)
- Alerts panel — automatic alerts for critical/low/high values, with 1-click acknowledge
- Per-camper glucose history charts with time-in-range stats
- Cabin group filtering — counselors default to their group, nurses/admins see all
- Multi-CGM support — Dexcom (direct or follower mode), LibreLink, Nightscout
- Background sync every 60 seconds

---

## Deployment (free, ~10 minutes)

### Prerequisites
- A [GitHub](https://github.com) account (free)
- A [Railway.app](https://railway.app) account (free)

### Steps

**1. Fork this repository on GitHub**

Click "Fork" at the top right of this page.

**2. Connect to Railway**

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your forked `guardianview` repo
4. Railway will detect the config and start deploying

**3. Add a storage volume**

1. In your Railway project, click **+ New** → **Volume**
2. Mount it at `/data`
3. This is where the database is stored (persists across deploys)

**4. Set environment variables**

In Railway → your service → **Variables**, add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | Any long random string (generate: `openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | A 64-character hex string (generate: `openssl rand -hex 32`) |
| `ADMIN_PASSWORD` | Your chosen admin password |
| `DEXCOM_FOLLOWER_USERNAME` | *(Optional)* Camp's Dexcom follower account username |
| `DEXCOM_FOLLOWER_PASSWORD` | *(Optional)* Camp's Dexcom follower account password |

**5. Done!**

Railway gives you a URL like `https://guardianview-production-xxxx.railway.app`. Open it, log in with username `admin` and the password you set.

---

## First-time setup

1. **Sign in** as `admin`
2. Go to **Manage Campers** → Add each camper with their name and cabin group
3. For each camper, click the **wifi icon** → connect their CGM
4. Readings start flowing within 60 seconds

### Connecting Dexcom (Direct / Publisher mode)
Enter the camper's Dexcom account username and password. The camp stores these encrypted.

### Connecting Dexcom (Follower mode)
1. Set `DEXCOM_FOLLOWER_USERNAME` / `DEXCOM_FOLLOWER_PASSWORD` env vars (the camp's follower Dexcom account)
2. The camper's family adds the camp account as a follower in the Dexcom app
3. Select **Follow** mode when connecting the camper

### Connecting Nightscout
Enter the camper's Nightscout URL and API secret.

---

## Adding staff accounts

Currently, use SQLite directly (via Railway shell) to add counselor accounts:

```bash
# In Railway shell
node -e "
const db = require('./server/db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('password123', 10);
db.prepare(\"INSERT INTO app_users (username, password_hash, role, cabin_group) VALUES (?,?,?,?)\")
  .run('counselor1', hash, 'counselor', 'Cabin 4');
console.log('Done');
"
```

A staff management UI is planned for a future release.

---

## Glucose ranges

| Status | Range |
|---|---|
| Critical Low | < 55 mg/dL |
| Low | < target_low (default 70) |
| In Range | target_low – target_high |
| High | > target_high (default 180) |
| Critical High | > 300 mg/dL |
| No Data | No reading in 15 minutes |

---

## Tech stack

- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Frontend**: React + Vite + Tailwind CSS
- **Charts**: Recharts
- **Hosting**: Railway.app (free tier)

---

## Contributing

This project was built for Camp Adam Fisher and is free for any T1D camp to use and improve.
PRs welcome — especially for:
- Staff/counselor account management UI
- Medtrum CGM support
- Export/reporting features
- Multi-camp support

---

## Disclaimer

GuardianView is a monitoring aid and is **not a substitute for clinical judgment**. Glucose readings
from the Dexcom Share API may be delayed. Always follow your camp's medical protocols.

---

MIT License — free to use, modify, and share.
