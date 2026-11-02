import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const API_URL = Constants.expoConfig.extra.apiUrl;
const TOKEN_KEY = 'fsf_auth_token';

async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// For things fetched outside request() - receipt photos shown in an Image,
// or downloaded to share.
export async function authHeaders() {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Set by AuthContext: called when the server says a saved login has
// expired, so the person is asked to log in again instead of every staff
// screen (and the offline queue) quietly failing.
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Long enough for a slow phone signal, short enough that Save, Log in, or
// Submit never spins forever at outreach.
const TIMEOUT_MS = 20000;

// Central request function. Every API call in the app goes through this,
// so auth headers and error handling are handled in exactly one place.
async function request(path, { method = 'GET', body, requiresAuth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  let token = null;
  if (requiresAuth) {
    token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // No status on purpose: the offline queue reads "no status" as "try
    // again later".
    throw new Error(
      err.name === 'AbortError'
        ? 'The server took too long to answer. Check your signal and try again.'
        : 'Could not reach the server. Check your signal and try again.'
    );
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    // Lets the offline queue tell "the server will never accept this" (e.g.
    // the item was deleted) apart from "try again later".
    error.status = response.status;
    if (response.status === 401 && token && onUnauthorized) onUnauthorized();
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  getNames: () => request('/api/auth/names', { requiresAuth: false }),
  login: (userId, pin) => request('/api/auth/login', { method: 'POST', body: { userId, pin }, requiresAuth: false }),
  me: () => request('/api/auth/me'),

  // Items / inventory
  getItems: (lowStockOnly = false) => request(`/api/items${lowStockOnly ? '?lowStock=true' : ''}`),
  createItem: (item) => request('/api/items', { method: 'POST', body: item }),
  updateItem: (id, updates) => request(`/api/items/${id}`, { method: 'PATCH', body: updates }),
  deleteItem: (id) => request(`/api/items/${id}`, { method: 'DELETE' }),
  adjustStock: (id, payload) => request(`/api/items/${id}/adjust-stock`, { method: 'POST', body: payload }),
  getForecast: () => request('/api/items/insights/forecast'),

  // Distribution events + tallies
  createEvent: (payload) => request('/api/events', { method: 'POST', body: payload }),
  // params: { start?, end? } (ISO timestamps) or { upcoming: true } - see
  // backend/src/routes/events.js for what each combination returns.
  getEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/events${qs ? `?${qs}` : ''}`);
  },
  getEvent: (id) => request(`/api/events/${id}`),
  updateEvent: (id, updates) => request(`/api/events/${id}`, { method: 'PATCH', body: updates }),
  tally: (eventId, payload) => request(`/api/events/${eventId}/tally`, { method: 'POST', body: payload }),

  // Budget
  getCurrentBudget: () => request('/api/budget/current'),
  updateBudget: (totalBudget) => request('/api/budget/current', { method: 'PATCH', body: { totalBudget } }),
  logPurchase: (payload) => request('/api/budget/purchases', { method: 'POST', body: payload }),
  getBudgetMonth: (month) => request(`/api/budget/month/${month}`),
  setBudgetMonth: (month, totalBudget) => request(`/api/budget/month/${month}`, { method: 'PATCH', body: { totalBudget } }),

  // Receipts - photo: { base64, contentType }; lines: [{ itemId, quantity }]
  createReceipt: (payload) => request('/api/receipts', { method: 'POST', body: payload }),
  updateReceipt: (id, payload) => request(`/api/receipts/${id}`, { method: 'PATCH', body: payload }),
  deleteReceipt: (id) => request(`/api/receipts/${id}`, { method: 'DELETE' }),
  getReceiptStorage: () => request('/api/receipts/storage'),
  receiptPhotoUrl: (id, download) => `${API_URL}/api/receipts/${id}/photo${download ? '?download=1' : ''}`,
  receiptsCsvUrl: (month) => `${API_URL}/api/receipts/export.csv?month=${month}`,

  // Reports
  getWeeklyReport: (date) => request(`/api/reports/weekly${date ? `?date=${date}` : ''}`),
  getMonthlyReport: (month) => request(`/api/reports/monthly${month ? `?month=${month}` : ''}`),
  // params: { start, end } (ISO timestamps, required), groupBy?: 'week'|'month'|'year'
  getCustomReport: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/reports/custom?${qs}`);
  },

  // Public - totals and "what we're short on" for the public screens.
  // Names and Out/Low only, never counts or costs (cached a minute server-side).
  getPublicSummary: () => request('/api/public/summary', { requiresAuth: false }),

  // Guest - donations
  createPaymentIntent: (amount, donorName, donorEmail) =>
    request('/api/donate/create-payment-intent', {
      method: 'POST',
      body: { amount, donorName, donorEmail },
      requiresAuth: false,
    }),

  // Community survey - public, but sends the token when there is one so
  // volunteer-assisted entries are marked as such (see backend detectStaff).
  submitSurvey: (payload) => request('/api/survey', { method: 'POST', body: payload }),
  getSurveySummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/survey/summary${qs ? `?${qs}` : ''}`);
  },
  getSurveyContactRequests: () => request('/api/survey/contact-requests'),
  resolveSurveyContactRequest: (id) => request(`/api/survey/contact-requests/${id}/resolve`, { method: 'PATCH' }),

  // Guest - contact
  submitContact: (payload) =>
    request('/api/contact', { method: 'POST', body: payload, requiresAuth: false }),
  // Admin - contact form inbox
  getContactMessages: () => request('/api/contact'),
  resolveContactMessage: (id) => request(`/api/contact/${id}/resolve`, { method: 'PATCH' }),

  // Push notifications. Registering works logged in or not; when logged
  // in, the phone is tied to that person so staff notices reach them.
  registerPushDevice: (payload) => request('/api/notifications/devices', { method: 'POST', body: payload }),
  forgetPushDevice: (token) => request('/api/notifications/devices', { method: 'DELETE', body: { token }, requiresAuth: false }),
  // Admin - send a notice. audience: 'staff' | 'everyone'; kind (everyone
  // only): 'outreach' | 'pantry' | 'needs'.
  getNotificationAudience: (audience, kind) => {
    const qs = new URLSearchParams(kind ? { audience, kind } : { audience }).toString();
    return request(`/api/notifications/audience?${qs}`);
  },
  sendNotification: (payload) => request('/api/notifications/send', { method: 'POST', body: payload }),
  getSentNotifications: () => request('/api/notifications/sent'),

  // Admin - people & logins (the backend's admin Data routes for users).
  getPeople: () => request('/api/admin/users?limit=500'),
  addPerson: (person) => request('/api/admin/users', { method: 'POST', body: person }),
  updatePerson: (id, changes) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: changes }),
  deletePerson: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),

  // Staff - messages to chosen people (conversations)
  getInboxPeople: () => request('/api/inbox/people'),
  getInbox: () => request('/api/inbox'),
  getInboxUnread: () => request('/api/inbox/unread'),
  startConversation: (recipientIds, body) => request('/api/inbox', { method: 'POST', body: { recipientIds, body } }),
  getConversation: (id) => request(`/api/inbox/${id}`),
  replyToConversation: (id, body) => request(`/api/inbox/${id}`, { method: 'POST', body: { body } }),

  // Staff - team chat
  getTeamChat: (before) => request(`/api/team-chat${before ? `?before=${encodeURIComponent(before)}` : ''}`),
  postTeamChat: (body) => request('/api/team-chat', { method: 'POST', body: { body } }),
  deleteTeamChat: (id) => request(`/api/team-chat/${id}`, { method: 'DELETE' }),
};
