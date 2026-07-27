/**
 * Dexcom Share API client
 * Two-step auth flow:
 * 1. AuthenticatePublisherAccount  → accountId
 * 2. LoginPublisherAccountById     → sessionId
 * 3. ReadPublisherLatestGlucoseValues → readings
 *
 * Dexcom operates separate regional servers that do NOT share accounts — an
 * account registered in the US cannot authenticate against the OUS server and
 * vice versa. Japan additionally uses a different application ID.
 * Region constants match pydexcom / nightscout-clock.
 */
const fetch = require('node-fetch');

const REGIONS = {
  us:  { host: 'share2.dexcom.com',    applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db' },
  ous: { host: 'shareous1.dexcom.com', applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db' },
  jp:  { host: 'share.dexcom.jp',      applicationId: 'd8665ade-9673-4e27-9ff6-92db4ce13d13' },
};
const DEFAULT_REGION = 'us';

function resolveRegion(region) {
  return REGIONS[String(region || DEFAULT_REGION).toLowerCase()] || REGIONS[DEFAULT_REGION];
}

function baseUrl(region) {
  return `https://${resolveRegion(region).host}/ShareWebServices/Services`;
}

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
async function getAccountId(username, password, region) {
  const res = await fetch(
    `${baseUrl(region)}/General/AuthenticatePublisherAccount`,
    {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ accountName: username, password, applicationId: resolveRegion(region).applicationId }),
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
async function getSessionId(accountId, password, region) {
  const res = await fetch(
    `${baseUrl(region)}/General/LoginPublisherAccountById`,
    {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ accountId, password, applicationId: resolveRegion(region).applicationId }),
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
async function loginPublisher(username, password, region) {
  const accountId = await getAccountId(username, password, region);
  return getSessionId(accountId, password, region);
}

/**
 * Fetch latest glucose readings for a publisher session
 */
async function getPublisherReadings(sessionId, region, minutes = 180, maxCount = 36) {
  const url = new URL(`${baseUrl(region)}/Publisher/ReadPublisherLatestGlucoseValues`);
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
 * Follower mode is NOT functional and is intentionally disabled.
 *
 * The previous implementation called Follower/ReadFollowerLatestGlucoseValues
 * with only a sessionId. Two problems:
 *
 *  1. That endpoint is not part of the documented Dexcom Share API. The
 *     follower/subscriber surface is under Subscriber/ (e.g. ReadEvents), and
 *     mature clients such as pydexcom implement publisher mode only.
 *  2. More seriously, it passed no per-camper identifier. A camp follower
 *     account follows many campers, so every follower-mode camper was issued
 *     the exact same request and would have received the exact same readings —
 *     one camper's glucose silently attributed to all of them.
 *
 * Returning wrong-but-plausible glucose values for a child is far more
 * dangerous than returning none, so this fails loudly instead. Implementing
 * follower mode correctly requires enumerating the account's subscriptions and
 * mapping each camper to their subscription/publisher id, then verifying it
 * against a real Dexcom follower account.
 */
async function getFollowerReadings() {
  throw new Error(
    'Dexcom Follow mode is not supported. Connect this camper in Direct mode ' +
    "using their own Dexcom account, or use Nightscout. (Follow mode couldn't " +
    "tell campers apart and risked showing one camper's readings for another.)"
  );
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
  getPublisherReadings,
  getFollowerReadings,
  SessionExpiredError,
  REGIONS,
  resolveRegion,
  baseUrl,
};
