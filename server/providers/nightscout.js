/**
 * Nightscout provider — reads from a camper's self-hosted Nightscout instance
 * API docs: https://nightscout.github.io/nightscout/api/
 */
const fetch = require('node-fetch');

const TREND_MAP = {
  'NONE': '?',
  'DoubleUp': '↑↑',
  'SingleUp': '↑',
  'FortyFiveUp': '↗',
  'Flat': '→',
  'FortyFiveDown': '↘',
  'SingleDown': '↓',
  'DoubleDown': '↓↓',
  'NOT COMPUTABLE': '?',
  'RATE OUT OF RANGE': '?',
};

/**
 * Verify Nightscout URL and API secret are valid.
 * Returns { ok: true } or throws.
 */
async function testConnection(nsUrl, apiSecret) {
  const url = new URL('/api/v1/status.json', nsUrl).toString();
  const headers = {};
  if (apiSecret) headers['api-secret'] = hashApiSecret(apiSecret);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Nightscout unreachable (${res.status})`);
  const data = await res.json();
  if (!data.apiEnabled) throw new Error('Nightscout API is not enabled');
  return { ok: true };
}

/**
 * Fetch the latest glucose entries.
 */
async function getReadings(nsUrl, apiSecret, count = 12) {
  const url = new URL(`/api/v1/entries/sgv.json?count=${count}`, nsUrl).toString();
  const headers = { Accept: 'application/json' };
  if (apiSecret) headers['api-secret'] = hashApiSecret(apiSecret);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Nightscout entries failed (${res.status})`);

  const data = await res.json();
  return data
    .filter(e => e && e.sgv)
    .map(e => ({
      value: e.sgv,
      trend: e.direction || 'Flat',
      trendArrow: TREND_MAP[e.direction] || '→',
      readingTime: new Date(e.date).toISOString(),
    }))
    .sort((a, b) => new Date(b.readingTime) - new Date(a.readingTime));
}

function hashApiSecret(secret) {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(secret).digest('hex');
}

module.exports = { testConnection, getReadings };
