/**
 * LibreLink Up provider
 * Uses the libre-link-up-api-client npm package
 */

const TREND_MAP = {
  1: '↓↓',
  2: '↓',
  3: '↘',
  4: '→',
  5: '↗',
  6: '↑',
  7: '↑↑',
};

async function getClient(username, password) {
  // Dynamic import for ESM package
  const { LibreLinkUpClient } = await import('libre-link-up-api-client');
  const client = new LibreLinkUpClient({ username, password, region: 'us' });
  await client.login();
  return client;
}

async function testConnection(username, password) {
  const client = await getClient(username, password);
  const connections = await client.fetchConnections();
  if (!connections || connections.length === 0) {
    throw new Error('No LibreLink connections found for this account');
  }
  return { ok: true };
}

async function getReadings(username, password) {
  const client = await getClient(username, password);
  const connections = await client.fetchConnections();
  if (!connections || connections.length === 0) return [];

  const conn = connections[0];
  const graph = await client.fetchGlucoseMeasurements(conn.patientId);

  return (graph || [])
    .filter(e => e && e.ValueInMgPerDl)
    .map(e => ({
      value: e.ValueInMgPerDl,
      trend: String(e.TrendArrow || 4),
      trendArrow: TREND_MAP[e.TrendArrow] || '→',
      readingTime: new Date(e.Timestamp).toISOString(),
    }))
    .sort((a, b) => new Date(b.readingTime) - new Date(a.readingTime));
}

module.exports = { testConnection, getReadings };
