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
    // Only auto-redirect if the user had an active session (token expired).
    // If there's no token, we're on the login page — let the error propagate
    // so the form can display "Invalid credentials" to the user.
    if (getToken()) {
      localStorage.removeItem('gv_token');
      localStorage.removeItem('gv_user');
      window.location.href = '/login';
      return;
    }
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
  getTrends: () => request('GET', '/campers/trends'),

  getEvents: (id, hours = 24) => request('GET', `/campers/${id}/events?hours=${hours}`),
  addEvent: (id, data) => request('POST', `/campers/${id}/events`, data),
  deleteEvent: (camperId, eventId) => request('DELETE', `/campers/${camperId}/events/${eventId}`),

  getUsers: () => request('GET', '/users'),
  addUser: (data) => request('POST', '/users', data),
  resetPassword: (id, password) => request('PUT', `/users/${id}/password`, { password }),
  deleteUser: (id) => request('DELETE', `/users/${id}`),

  getDailySettings: (id) => request('GET', `/campers/${id}/daily-settings`),
  getDailySettingByDate: (id, date) => request('GET', `/campers/${id}/daily-settings?date=${date}`),
  getCurrentSettings: (id) => request('GET', `/campers/${id}/daily-settings/current`),
  upsertDailySettings: (id, date, data) => request('PUT', `/campers/${id}/daily-settings/${date}`, data),

  getAlerts: () => request('GET', '/alerts'),
  acknowledgeAlert: (id) => request('POST', `/alerts/${id}/acknowledge`),

  getSyncStatus: () => request('GET', '/sync/status'),
  runSync: () => request('POST', '/sync/run'),

  getFlowsheet: (date) => request('GET', `/flowsheet?date=${date}`),
};
