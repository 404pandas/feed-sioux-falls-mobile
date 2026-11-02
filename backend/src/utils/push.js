const PushDevice = require('../models/PushDevice');

// Sends push notifications through Expo's push service, which hands them to
// Firebase (Android) for us. No account key is needed on this side - the
// Firebase key lives in the Expo project.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // Expo's limit per request

// What a phone with "Hide what notifications say" turned on gets instead.
const HIDDEN = { title: 'Feed Sioux Falls', body: 'You have a new update' };

// Each kind has two Android channels made by the app: a normal one, and a
// "-private" one that is kept off the lock screen (Android won't let an app
// change a channel's lock screen setting after it's made, so there are two).
function channelFor(kind, hideContent) {
  return hideContent ? `${kind}-private` : kind;
}

function buildMessage(device, { title, body, kind, data }) {
  const hidden = device.hideContent;
  return {
    to: device.token,
    title: hidden ? HIDDEN.title : title,
    body: hidden ? HIDDEN.body : body,
    // Data isn't shown on screen; it tells the app which screen to open.
    data: { kind, ...(data || {}) },
    channelId: channelFor(kind, hidden),
    sound: 'default',
    priority: 'high',
  };
}

// The phones that should get a notification of this kind. 'staff' audience
// only counts phones logged in as an active volunteer or admin.
async function findRecipients({ kind, audience, excludeUser }) {
  const filter = { [`prefs.${kind}`]: true };
  if (audience === 'staff') filter.user = { $ne: null };
  const devices = await PushDevice.find(filter).populate('user', 'role active');
  return devices.filter((d) => {
    if (excludeUser && d.user && String(d.user._id) === String(excludeUser)) return false;
    if (audience !== 'staff') return true;
    return d.user && d.user.active && (d.user.role === 'admin' || d.user.role === 'volunteer');
  });
}

// Sends, and forgets phones Expo says are gone (app uninstalled, etc.).
// Never throws - a failed send must not fail the request that caused it.
// PUSH_DRY_RUN=1 skips the network (tests, local development).
async function sendPush(devices, message) {
  if (!devices.length) return { sent: 0 };
  if (process.env.PUSH_DRY_RUN === '1') return { sent: devices.length, dryRun: true };

  let sent = 0;
  const gone = [];
  for (let i = 0; i < devices.length; i += CHUNK) {
    const batch = devices.slice(i, i + CHUNK);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch.map((d) => buildMessage(d, message))),
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json().catch(() => ({}));
      (json.data || []).forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') gone.push(batch[idx].token);
      });
    } catch (err) {
      console.error('Push send failed:', err.message);
    }
  }
  if (gone.length) await PushDevice.deleteMany({ token: { $in: gone } }).catch(() => {});
  return { sent };
}

module.exports = { findRecipients, sendPush, buildMessage, channelFor };
