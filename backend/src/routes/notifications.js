const express = require('express');
const PushDevice = require('../models/PushDevice');
const SentNotification = require('../models/SentNotification');
const AuditLog = require('../models/AuditLog');
const { deviceLimiter } = require('../middleware/rateLimiters');
const { requireAuth, requireAdmin, userFromToken, tokenFrom } = require('../middleware/auth');
const { findRecipients, sendPush } = require('../utils/push');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;
const PUBLIC_KINDS = ['outreach', 'pantry', 'needs'];

// Like requireAuth, but a missing or expired login just means "not logged
// in" - anyone can turn on public notifications.
async function optionalUser(req, res, next) {
  req.user = await userFromToken(tokenFrom(req));
  next();
}

function cleanPrefs(prefs) {
  const out = {};
  for (const kind of PushDevice.KINDS) {
    if (typeof prefs?.[kind] === 'boolean') out[kind] = prefs[kind];
  }
  return out;
}

// POST /api/notifications/devices - the app calls this whenever
// notifications are turned on, a switch changes, or someone logs in or out.
// Body: { token, platform?, prefs?: { outreach, pantry, needs, staff, chat }, hideContent? }
router.post('/devices', deviceLimiter, optionalUser, asyncHandler(async (req, res) => {
  const { token, platform, prefs, hideContent } = req.body;
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    return res.status(400).json({ error: 'A valid push token is required.' });
  }

  const set = {
    user: req.user ? req.user._id : null,
    platform: ['android', 'ios'].includes(platform) ? platform : 'other',
    lastSeenAt: new Date(),
  };
  for (const [kind, on] of Object.entries(cleanPrefs(prefs))) set[`prefs.${kind}`] = on;
  if (typeof hideContent === 'boolean') set.hideContent = hideContent;

  const device = await PushDevice.findOneAndUpdate({ token }, { $set: set }, { upsert: true, new: true, runValidators: true });
  res.json({ prefs: device.prefs, hideContent: device.hideContent, linkedToLogin: !!device.user });
}));

// DELETE /api/notifications/devices - every switch turned off: forget the
// phone entirely. Body: { token }
router.delete('/devices', deviceLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    return res.status(400).json({ error: 'A valid push token is required.' });
  }
  await PushDevice.deleteOne({ token });
  res.json({ success: true });
}));

function readSendRequest(body) {
  const audience = body.audience === 'everyone' ? 'everyone' : 'staff';
  const kind = audience === 'staff' ? 'staff' : body.kind;
  if (audience === 'everyone' && !PUBLIC_KINDS.includes(kind)) {
    return { error: 'Choose what kind of notice this is: outreach, pantry, or needs.' };
  }
  return { audience, kind };
}

// GET /api/notifications/audience?audience=staff|everyone&kind=... (admin)
// How many phones a notice would reach - shown before sending.
router.get('/audience', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { audience, kind, error } = readSendRequest(req.query);
  if (error) return res.status(400).json({ error });
  const devices = await findRecipients({ audience, kind, excludeUser: req.user._id });
  res.json({ count: devices.length });
}));

// POST /api/notifications/send (admin) - Body: { title, body, audience, kind? }
// Every send is kept in SentNotification and the Change Log, with the sender.
router.post('/send', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!title || !body) return res.status(400).json({ error: 'A title and a message are both required.' });
  if (title.length > 80 || body.length > 300) {
    return res.status(400).json({ error: 'Keep the title under 80 characters and the message under 300.' });
  }
  const { audience, kind, error } = readSendRequest(req.body);
  if (error) return res.status(400).json({ error });

  const devices = await findRecipients({ audience, kind, excludeUser: req.user._id });
  const screen = audience === 'staff' ? 'StaffHome' : kind === 'needs' ? 'Give' : 'Help';
  const result = await sendPush(devices, { title, body, kind, data: { screen } });

  const record = await SentNotification.create({ title, body, audience, kind, sentBy: req.user._id, recipients: devices.length });
  await AuditLog.create({
    user: req.user._id,
    action: 'create',
    collectionKey: 'sentNotifications',
    docId: String(record._id),
    fields: ['title', 'body', 'audience', 'kind'],
  });

  res.status(201).json({ id: record._id, recipients: devices.length, delivered: result.sent });
}));

// GET /api/notifications/sent (admin) - the most recent sends.
router.get('/sent', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const sent = await SentNotification.find().sort({ createdAt: -1 }).limit(30).populate('sentBy', 'name');
  res.json(sent);
}));

module.exports = router;
