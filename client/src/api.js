const BASE = '/api';

function getToken() {
  return localStorage.getItem('gv_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('gv_token');
    localStorage.removeItem('gv_user');
    window.location.href = '/login';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),

  getCampers: (group) => request('GET', `/campers${group === 'all' ? '?group=all' : ''}`),
  addCamper: (data) => request('POST', '/campers', data),
  updateCamper: (id, data) => request('PUT', `/campers/${id}`, data),
  deleteCamper: (id) => request('DELETE', `/campers/${id}`),
  connectCGM: (id, data) => request('POST', `/campers/${id}/connect`, data),
  syncCamper: (id) => request('POST', `/campers/${id}/sync`),
  getReadings: (id, hours = 24) => request('GET', `/campers/${id}/readings?hours=${hours}`),

  getAlerts: () => request('GET', '/alerts'),
  acknowledgeAlert: (id) => request('POST', `/alerts/${id}/acknowledge`),

  getSyncStatus: () => request('GET', '/sync/status'),
  runSync: () => request('POST', '/sync/run'),
};
