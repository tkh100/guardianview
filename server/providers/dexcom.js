/**
 * Dexcom Share API client
 * Two-step auth flow per nightscout-clock implementation:
 * 1. AuthenticatePublisherAccount  → accountId
 * 2. LoginPublisherAccountById     → sessionId
 * 3. ReadPublisherLatestGlucoseValues → readings
 */
const fetch = require('node-fetch');

const BASE_URL = 'https://share2.dexcom.com/ShareWebServices/Services';
const APPLICATION_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'GuardianView',
};

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
 * Step 1: username + password → accountId
 */
async function getAccountId(username, password) {
  const res = await fetch(
    `${BASE_URL}/General/AuthenticatePublisherAccount`,
    {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ accountName: username, password, applicationId: APPLICATION_ID }),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Dexcom auth failed (${res.status}): ${text}`);

  // Response is a JSON-quoted string e.g. "\"abc-123\""
  const accountId = text.replace(/^"|"$/g, '');
  if (!accountId || accountId === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Invalid Dexcom credentials');
  }
  return accountId;
}

/**
 * Step 2: accountId + password → sessionId
 */
async function getSessionId(accountId, password) {
  const res = await fetch(
    `${BASE_URL}/General/LoginPublisherAccountById`,
    {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ accountId, password, applicationId: APPLICATION_ID }),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Dexcom login failed (${res.status}): ${text}`);

  const sessionId = text.replace(/^"|"$/g, '');
  if (!sessionId || sessionId === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Dexcom login returned invalid session');
  }
  return sessionId;
}

/**
 * Full publisher login: username + password → sessionId
 */
async function loginPublisher(username, password) {
  const accountId = await getAccountId(username, password);
  return getSessionId(accountId, password);
}

/**
 * Follower login uses same two-step flow with camp follower account
 */
async function loginFollower(username, password) {
  return loginPublisher(username, password);
}

/**
 * Fetch latest glucose readings for a publisher session
 */
async function getPublisherReadings(sessionId, minutes = 180, maxCount = 36) {
  const url = new URL(`${BASE_URL}/Publisher/ReadPublisherLatestGlucoseValues`);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('minutes', minutes);
  url.searchParams.set('maxCount', maxCount);

  const res = await fetch(url.toString(), { headers: HEADERS });

  if (res.status === 500) {
    const text = await res.text();
    if (text.includes('Session')) throw new SessionExpiredError('Dexcom session expired');
    throw new Error(`Dexcom readings 500: ${text}`);
  }
  if (!res.ok) throw new Error(`Dexcom readings failed (${res.status})`);

  const data = await res.json();
  return normalizeReadings(data);
}

/**
 * Fetch latest glucose readings for a follower session
 */
async function getFollowerReadings(sessionId, minutes = 180, maxCount = 36) {
  const url = new URL(`${BASE_URL}/Follower/ReadFollowerLatestGlucoseValues`);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('minutes', minutes);
  url.searchParams.set('maxCount', maxCount);

  const res = await fetch(url.toString(), { headers: HEADERS });

  if (res.status === 500) {
    const text = await res.text();
    if (text.includes('Session')) throw new SessionExpiredError('Dexcom follower session expired');
    throw new Error(`Dexcom follower readings 500: ${text}`);
  }
  if (!res.ok) throw new Error(`Dexcom follower readings failed (${res.status})`);

  const data = await res.json();
  return normalizeReadings(data);
}

function normalizeReadings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r && r.Value)
    .map(r => {
      // ST format: "Date(1703182152000)" — extract ms
      const ms = r.ST ? parseInt(r.ST.replace(/\D/g, '')) : null;
      const readingTime = ms ? new Date(ms).toISOString() : null;
      return {
        value: r.Value,
        trend: r.Trend || 'Flat',
        trendArrow: TREND_MAP[r.Trend] || '→',
        readingTime,
      };
    })
    .filter(r => r.readingTime)
    .sort((a, b) => new Date(b.readingTime) - new Date(a.readingTime));
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
