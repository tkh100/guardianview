/**
 * Dexcom Share API client (unofficial)
 * Based on the community-documented API used by Nightscout, xDrip, and Calebh101/dexcom
 */
const fetch = require('node-fetch');

const BASE_URL = 'https://share2.dexcom.com/ShareWebServices/Services';
const APPLICATION_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';

const TREND_MAP = {
  None: '?',
  DoubleUp: '↑↑',
  SingleUp: '↑',
  FortyFiveUp: '↗',
  Flat: '→',
  FortyFiveDown: '↘',
  SingleDown: '↓',
  DoubleDown: '↓↓',
  NotComputable: '?',
  RateOutOfRange: '?',
};

/**
 * Authenticate with Dexcom Share using publisher (camper's own) credentials.
 * Returns a sessionId valid for ~6 hours.
 */
async function loginPublisher(username, password) {
  const res = await fetch(
    `${BASE_URL}/General/LoginPublisherAccountByName`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ accountName: username, password, applicationId: APPLICATION_ID }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dexcom login failed (${res.status}): ${text}`);
  }
  const sessionId = await res.json();
  if (!sessionId || sessionId === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Invalid Dexcom credentials');
  }
  return sessionId;
}

/**
 * Authenticate with Dexcom Share using the camp's follower account credentials.
 */
async function loginFollower(username, password) {
  // Follower accounts use the same login endpoint
  return loginPublisher(username, password);
}

/**
 * Fetch latest glucose readings for a publisher session.
 * Returns normalized reading objects: { value, trend, trendArrow, readingTime }
 */
async function getPublisherReadings(sessionId, minutes = 60, maxCount = 12) {
  const url = new URL(`${BASE_URL}/Publisher/ReadPublisherLatestGlucoseValues`);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('minutes', minutes);
  url.searchParams.set('maxCount', maxCount);

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });

  if (res.status === 500) {
    // Dexcom returns 500 when session is expired
    throw new SessionExpiredError('Dexcom session expired');
  }
  if (!res.ok) {
    throw new Error(`Dexcom readings failed (${res.status})`);
  }

  const data = await res.json();
  return normalizeReadings(data);
}

/**
 * Fetch latest glucose readings for a follower session.
 */
async function getFollowerReadings(sessionId, minutes = 60, maxCount = 12) {
  const url = new URL(`${BASE_URL}/Follower/ReadFollowerLatestGlucoseValues`);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('minutes', minutes);
  url.searchParams.set('maxCount', maxCount);

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });

  if (res.status === 500) {
    throw new SessionExpiredError('Dexcom follower session expired');
  }
  if (!res.ok) {
    throw new Error(`Dexcom follower readings failed (${res.status})`);
  }

  const data = await res.json();
  return normalizeReadings(data);
}

function normalizeReadings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && r.Value)
    .map(r => ({
      value: r.Value,
      trend: r.Trend || 'Flat',
      trendArrow: TREND_MAP[r.Trend] || '→',
      readingTime: parseDexcomDate(r.WT || r.ST || r.DT),
    }))
    .filter(r => r.readingTime)
    .sort((a, b) => new Date(b.readingTime) - new Date(a.readingTime));
}

function parseDexcomDate(wt) {
  if (!wt) return null;
  const match = wt.match(/\/Date\((\d+)([+-]\d+)?\)\//);
  if (!match) return null;
  return new Date(parseInt(match[1])).toISOString();
}

class SessionExpiredError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'SessionExpiredError';
  }
}

module.exports = {
  loginPublisher,
  loginFollower,
  getPublisherReadings,
  getFollowerReadings,
  SessionExpiredError,
};
